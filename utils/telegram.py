"""
Cliente Telegram multiusuário.
Cada usuário tem seus próprios tokens e chat_id.
"""
import logging
import requests
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
        except Exception as e:
            self.logger.error(f"Erro Telegram: {e}")
