"""
Cliente Telegram multiusuário.
Cada usuário tem seus próprios tokens e chat_id.
"""
import logging
import requests
import re
from typing import Optional


class TelegramClient:
    """Cliente Telegram isolado por usuário."""
    
    def __init__(self, user_id: str, storage=None):
        """
        Inicializa cliente Telegram para um usuário.
        
        Args:
            user_id: ID do usuário
            storage: Instância de StorageBase para carregar config
        """
        self.user_id = user_id
        self.storage = storage
        self.config = None
        self.logger = logging.getLogger(f"telegram.user_{user_id}")
        self._load_config()
    
    def _load_config(self):
        """Carrega configuração do Telegram do banco ou .env."""
        import os
        fallback = {
            "bot_token": os.getenv("TELEGRAM_BOT_TOKEN"),
            "chat_id": os.getenv("TELEGRAM_CHAT_ID"),
            "bot_token_sender": os.getenv("TELEGRAM_BOT_TOKEN_SENDER", ""),
            "chat_id_sender": os.getenv("TELEGRAM_CHAT_ID_SENDER", ""),
        }
        if self.storage and hasattr(self.storage, "get_telegram_config"):
            cfg = self.storage.get_telegram_config()
            if cfg and cfg.get("bot_token") and cfg.get("chat_id"):
                self.config = cfg
                return
        self.config = fallback
    
    def send(self, msg: str):
        """
        Envia mensagem no Telegram usando tokens do usuário.
        
        Args:
            msg: Mensagem a enviar
        """
        if not self.config or not self.config.get("bot_token") or not self.config.get("chat_id"):
            self.logger.warning(f"Telegram não configurado para usuário {self.user_id}")
            return
        
        try:
            url = f"https://api.telegram.org/bot{self.config['bot_token']}/sendMessage"
            payload = {"chat_id": self.config["chat_id"], "text": msg}
            requests.post(url, json=payload, timeout=3)
            
            # Envia para sender secundário se configurado
            if self.config.get("bot_token_sender") and self.config.get("chat_id_sender"):
                try:
                    # Multiplica valores monetários (lógica original)
                    price_keywords = ['entrada:', '1ª entrada:', '2ª entrada:', '3ª entrada:', 'stop:', 'novo stop:', 'stop atual:', 'trigger:', 'preço:']
                    value_keywords = ['tamanho:', 'total:', 'qty:', 'size:', 'valor:', 'pnl:', 'investido:']
                    
                    def mult_val(m):
                        start = max(0, m.start() - 30)
                        context = msg[start:m.start()].lower()
                        has_dollar = m.group(2) == '$'
                        is_value = any(kw in context for kw in value_keywords)
                        is_price = any(kw in context for kw in price_keywords)
                        if (has_dollar or is_value) and not is_price:
                            n = float(m.group(3))
                            d = len(m.group(3).split('.')[1]) if '.' in m.group(3) else 0
                            f = f"{n * 5:.{d}f}".rstrip('0').rstrip('.') if d else f"{n * 5:.0f}"
                            return (m.group(1) or '') + (m.group(2) or '') + f
                        return m.group(0)
                    
                    multiplied_msg = re.sub(r'(\+|\-)?\s*(\$)?\s*(\d+\.?\d*)', mult_val, msg)
                    requests.post(
                        f"https://api.telegram.org/bot{self.config['bot_token_sender']}/sendMessage",
                        json={"chat_id": self.config["chat_id_sender"], "text": multiplied_msg},
                        timeout=3
                    )
                except Exception as e:
                    self.logger.error(f"Erro ao enviar para sender secundário: {e}")
        except Exception as e:
            self.logger.error(f"Erro Telegram: {e}")
