"""
Instância individual do bot para um usuário.
Carrega configuração, credenciais e roda o engine.
"""
import logging
import os
from eth_account import Account
from hyperliquid.info import Info
from hyperliquid.exchange import Exchange

from engine.config import BotConfig
from engine.bot_engine import BotEngine
from storage import get_storage
from storage.user_storage import UserStorage
from utils.telegram import TelegramClient
from utils.logging import setup_user_logger
from auth.encryption import EncryptionManager


class BotInstance:
    """Instância do bot para um usuário específico."""
    
    def __init__(self, user_id: str):
        """
        Inicializa instância do bot para um usuário.
        
        Args:
            user_id: ID do usuário
        """
        self.user_id = user_id
        self.logger = setup_user_logger(user_id)
        self.config = None
        self.storage = None
        self.telegram = None
        self.info = None
        self.exchange = None
        self.wallet_address = None
        self.running = False
    
    def start(self):
        """Inicia o bot para este usuário."""
        try:
            self.logger.info(f"Iniciando bot para usuário {self.user_id}")
            
            # 1. Carrega configuração do banco
            bot_config_dict = self._load_user_config()
            if not bot_config_dict:
                self.logger.error(f"Configuração não encontrada para usuário {self.user_id}")
                return
            
            # 2. Carrega credenciais e descriptografa
            credentials = self._load_credentials()
            if not credentials:
                self.logger.error(f"Credenciais não encontradas para usuário {self.user_id}")
                return
            
            # 3. Cria storage com user_id
            backend_storage = get_storage()
            self.storage = UserStorage(self.user_id, backend_storage)
            
            # 4. Cria Telegram client
            self.telegram = TelegramClient(self.user_id, self.storage)
            
            # Plano e entrada 2: basic=só entrada 1; pro/satoshi=entrada 1+2 com toggle
            plan = self._get_user_plan()
            allowed_entry2 = plan in ('pro', 'satoshi')
            entry2_enabled = bool(bot_config_dict.get('entry2_enabled', True))

            # 5. Monta config de Fibo (alvos e stop) a partir do bot_config
            stop_mult = float(bot_config_dict.get('stop_multiplier', 1.8) or 1.8)
            entry1_mult = float(bot_config_dict.get('entry1_multiplier', 0.618) or 0.618)
            entry2_mult = float(bot_config_dict.get('entry2_multiplier', 1.414) or 1.414)

            fib_levels: list[tuple[float, float]] = []
            entry2_adjust_last_target = bool(bot_config_dict.get('entry2_adjust_last_target', True))
            entry2_fib_levels_after: list[tuple[float, float]] = []
            try:
                t1_level = bot_config_dict.get('target1_level')
                t1_pct = bot_config_dict.get('target1_percent')
                if t1_level is not None and t1_pct is not None:
                    lvl = float(t1_level or 0)
                    pct = float(t1_pct or 0)
                    if pct > 0:
                        fib_levels.append((lvl, pct / 100.0))

                t2_level = bot_config_dict.get('target2_level')
                t2_pct = bot_config_dict.get('target2_percent')
                if t2_level is not None and t2_pct is not None:
                    lvl = float(t2_level or 0)
                    pct = float(t2_pct or 0)
                    if lvl != 0 and pct > 0:
                        fib_levels.append((lvl, pct / 100.0))

                t3_level = bot_config_dict.get('target3_level')
                t3_pct = bot_config_dict.get('target3_percent')
                if t3_level is not None and t3_pct is not None:
                    lvl = float(t3_level or 0)
                    pct = float(t3_pct or 0)
                    if lvl != 0 and pct > 0:
                        fib_levels.append((lvl, pct / 100.0))
            except Exception:
                # Em caso de qualquer problema de parsing, deixa fib_levels vazio e usa defaults
                fib_levels = []

            # Alvos após entrada 2 (opcionais; se houver, substituem todos os alvos quando entrada 2 executar)
            try:
                e1_level = bot_config_dict.get('entry2_target1_level')
                e1_pct = bot_config_dict.get('entry2_target1_percent')
                if e1_level is not None and e1_pct is not None:
                    lvl = float(e1_level)
                    pct = float(e1_pct or 0)
                    if pct > 0:
                        entry2_fib_levels_after.append((lvl, pct / 100.0))

                e2_level = bot_config_dict.get('entry2_target2_level')
                e2_pct = bot_config_dict.get('entry2_target2_percent')
                if e2_level is not None and e2_pct is not None:
                    lvl = float(e2_level)
                    pct = float(e2_pct or 0)
                    if pct > 0:
                        entry2_fib_levels_after.append((lvl, pct / 100.0))

                e3_level = bot_config_dict.get('entry2_target3_level')
                e3_pct = bot_config_dict.get('entry2_target3_percent')
                if e3_level is not None and e3_pct is not None:
                    lvl = float(e3_level)
                    pct = float(e3_pct or 0)
                    if pct > 0:
                        entry2_fib_levels_after.append((lvl, pct / 100.0))
            except Exception:
                entry2_fib_levels_after = []

            fib_kwargs = {}
            if fib_levels:
                fib_kwargs["fib_levels"] = fib_levels
            if entry2_fib_levels_after:
                fib_kwargs["entry2_fib_levels_after"] = entry2_fib_levels_after

            # 6. Cria BotConfig
            # Plano Basic: sempre Modo Sinal (sem execução automática de trades pelo motor)
            signal_mode = plan == 'basic' or bool(bot_config_dict.get('signal_mode', False))
            self.config = BotConfig(
                user_id=self.user_id,
                wallet_address=credentials['wallet_address'],
                private_key=credentials['private_key'],
                symbols=bot_config_dict.get('symbols', []),
                timeframes=bot_config_dict.get('timeframes', []),
                trade_mode=bot_config_dict.get('trade_mode', 'BOTH'),
                signal_mode=signal_mode,
                entry2_enabled=entry2_enabled,
                entry2_allowed=allowed_entry2,
                target_loss_usd=bot_config_dict.get('target_loss_usd', 5.0),
                max_global_exposure=bot_config_dict.get('max_global_exposure', 5000.0),
                max_single_pos_exposure=bot_config_dict.get('max_single_pos_exposure', 2500.0),
                max_positions=bot_config_dict.get('max_positions', 2),
                is_mainnet=credentials.get('network', 'mainnet') == 'mainnet',
                fib_stop_level=stop_mult,
                entry1_multiplier=entry1_mult,
                fib_entry2_level=entry2_mult,
                entry2_adjust_last_target=entry2_adjust_last_target,
                **fib_kwargs,
            )
            
            # 6. Inicializa conexão Hyperliquid
            self._setup_client()

            # 7. Cria e executa BotEngine (sem patches globais)
            engine = BotEngine(self.config, self.storage, lambda msg: self.telegram.send(msg))
            self.running = True
            self.logger.info(f"Bot iniciado para usuário {self.user_id}")
            engine.run(self.info, self.exchange, self.wallet_address)
            
        except Exception as e:
            self.logger.error(f"Erro ao iniciar bot: {e}", exc_info=True)
            self.running = False
            raise
    
    def stop(self):
        """Para o bot graciosamente."""
        self.logger.info(f"Parando bot para usuário {self.user_id}")
        self.running = False
        # TODO: Implementar sinalização de parada para o engine
    
    def _get_user_plan(self) -> str:
        """Retorna o plano do usuário (basic, pro, satoshi)."""
        try:
            backend = get_storage()
            if hasattr(backend, '_client') and backend._client:
                r = backend._client.table("users").select("subscription_tier").eq("id", self.user_id).limit(1).execute()
                if r.data and r.data[0].get("subscription_tier"):
                    return (r.data[0]["subscription_tier"] or "basic").lower()
        except Exception as e:
            self.logger.warning(f"Erro ao buscar plano: {e}")
        return "basic"

    def _load_user_config(self) -> dict:
        """Carrega configuração do usuário do banco."""
        try:
            backend = get_storage()
            if hasattr(backend, 'get_user_config'):
                return backend.get_user_config(self.user_id)
            
            # Fallback: busca direto no Supabase
            if hasattr(backend, '_client') and backend._client:
                from storage.supabase_storage import TABLE_CONFIG
                r = backend._client.table(TABLE_CONFIG).select("*").eq("user_id", self.user_id).limit(1).execute()
                if r.data:
                    return r.data[0]
            
            return {}
        except Exception as e:
            self.logger.error(f"Erro ao carregar config: {e}")
            return {}
    
    def _load_credentials(self) -> dict:
        """Carrega e descriptografa credenciais do usuário."""
        try:
            backend = get_storage()
            if hasattr(backend, '_client') and backend._client:
                from storage.supabase_storage import TABLE_TRADES
                # Busca em trading_accounts
                r = backend._client.table("trading_accounts").select("*").eq("user_id", self.user_id).eq("is_active", True).limit(1).execute()
                if r.data:
                    account = r.data[0]
                    encrypted_key = account.get('encrypted_private_key')
                    salt = account.get('encryption_salt')
                    
                    if encrypted_key and salt:
                        # Descriptografa
                        enc_manager = EncryptionManager()
                        private_key = enc_manager.decrypt_private_key(encrypted_key, salt, self.user_id)
                        
                        return {
                            'wallet_address': account.get('wallet_address'),
                            'private_key': private_key,
                            'network': account.get('network', 'mainnet'),
                        }
            
            return {}
        except Exception as e:
            self.logger.error(f"Erro ao carregar credenciais: {e}")
            return {}
    
    def _setup_client(self):
        """Configura cliente Hyperliquid. Suporta chave principal ou API Wallet (agent)."""
        if not self.config.private_key:
            raise ValueError("Chave Privada não encontrada")

        account = Account.from_key(self.config.private_key)
        # wallet_address = master (onde estão os fundos); account.address = signer (pode ser agent)
        self.wallet_address = self.config.wallet_address or account.address
        from hyperliquid.utils import constants
        base_url = constants.MAINNET_API_URL if self.config.is_mainnet else constants.TESTNET_API_URL
        self.info = Info(base_url, skip_ws=True)
        # Para API Wallet (agent): account_address=master. Para chave principal: account_address=master (mesmo valor).
        self.exchange = Exchange(account, base_url, account_address=self.wallet_address)
        
        self.logger.info(f"Bot Conectado: {self.wallet_address} (Rede: {'MAINNET' if self.config.is_mainnet else 'TESTNET'})")
        self.telegram.send("🟢 Zeedo Conectado")
    