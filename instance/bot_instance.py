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
            
            # 5. Cria BotConfig
            self.config = BotConfig(
                user_id=self.user_id,
                wallet_address=credentials['wallet_address'],
                private_key=credentials['private_key'],
                symbols=bot_config_dict.get('symbols', []),
                timeframes=bot_config_dict.get('timeframes', []),
                trade_mode=bot_config_dict.get('trade_mode', 'BOTH'),
                target_loss_usd=bot_config_dict.get('target_loss_usd', 5.0),
                max_global_exposure=bot_config_dict.get('max_global_exposure', 5000.0),
                max_single_pos_exposure=bot_config_dict.get('max_single_pos_exposure', 2500.0),
                max_positions=bot_config_dict.get('max_positions', 2),
                is_mainnet=credentials.get('network', 'mainnet') == 'mainnet',
            )
            
            # 6. Inicializa conexão Hyperliquid
            self._setup_client()
            
            # 7. Importa e roda engine (por enquanto usa bot.py original)
            # TODO: Migrar para engine/bot_engine.py quando estiver pronto
            import bot as bot_module
            
            # Substitui variáveis globais temporariamente
            self._patch_globals(bot_module)
            
            self.running = True
            self.logger.info(f"Bot iniciado para usuário {self.user_id}")
            
            # Roda loop principal (chama função main do bot.py)
            bot_module.main()
            
        except Exception as e:
            self.logger.error(f"Erro ao iniciar bot: {e}", exc_info=True)
            self.running = False
            raise
    
    def stop(self):
        """Para o bot graciosamente."""
        self.logger.info(f"Parando bot para usuário {self.user_id}")
        self.running = False
        # TODO: Implementar sinalização de parada para o engine
    
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
        """Configura cliente Hyperliquid."""
        if not self.config.private_key:
            raise ValueError("Chave Privada não encontrada")
        
        account = Account.from_key(self.config.private_key)
        self.wallet_address = self.config.wallet_address or account.address
        
        from hyperliquid.utils import constants
        base_url = constants.MAINNET_API_URL if self.config.is_mainnet else constants.TESTNET_API_URL
        self.info = Info(base_url, skip_ws=True)
        self.exchange = Exchange(account, base_url, account_address=self.wallet_address)
        
        self.logger.info(f"Bot Conectado: {self.wallet_address} (Rede: {'MAINNET' if self.config.is_mainnet else 'TESTNET'})")
        self.telegram.send(f"🟢 Zeedo Conectado: Notificações Ativas")
    
    def _patch_globals(self, bot_module):
        """Patches temporários para compatibilidade com bot.py original."""
        # TODO: Remover quando engine estiver completamente refatorado
        
        # Injeta config no módulo bot
        bot_module.PRIVATE_KEY = self.config.private_key
        bot_module.ACCOUNT_ADDRESS = self.config.wallet_address
        bot_module.IS_MAINNET = self.config.is_mainnet
        bot_module.SYMBOLS = self.config.symbols
        bot_module.TIMEFRAMES = self.config.timeframes
        bot_module.TRADE_MODE = self.config.trade_mode
        
        # Injeta storage e telegram
        bot_module._storage_instance = self.storage
        bot_module._telegram_instance = self.telegram
        
        # Substitui função tg_send para usar instância do usuário
        original_tg_send = bot_module.tg_send
        def patched_tg_send(msg):
            self.telegram.send(msg)
        bot_module.tg_send = patched_tg_send
