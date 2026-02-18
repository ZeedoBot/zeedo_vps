"""
Wrapper de Storage que adiciona user_id a todas as operações.
Garante isolamento total entre usuários.
"""
from typing import Optional
from .base import StorageBase


class UserStorage(StorageBase):
    """
    Wrapper que adiciona user_id a todas as operações de storage.
    Garante que cada usuário só acessa seus próprios dados.
    """
    
    def __init__(self, user_id: str, backend: StorageBase):
        """
        Inicializa storage com user_id.
        
        Args:
            user_id: ID do usuário
            backend: Storage backend (LocalStorage ou SupabaseStorage)
        """
        self.user_id = user_id
        self.backend = backend
        
        # Verifica se backend suporta user_id
        if hasattr(backend, 'set_user_id'):
            backend.set_user_id(user_id)
    
    def get_entry_tracker(self) -> dict:
        """Retorna entry_tracker filtrado por user_id."""
        if hasattr(self.backend, 'get_entry_tracker'):
            return self.backend.get_entry_tracker(user_id=self.user_id)
        # Fallback para backends antigos (compatibilidade)
        return self.backend.get_entry_tracker()
    
    def save_entry_tracker(self, data: dict) -> None:
        """Salva entry_tracker com user_id."""
        if hasattr(self.backend, 'save_entry_tracker'):
            self.backend.save_entry_tracker(data, user_id=self.user_id)
        else:
            self.backend.save_entry_tracker(data)
    
    def get_history_tracker(self) -> dict:
        """Retorna history_tracker filtrado por user_id."""
        if hasattr(self.backend, 'get_history_tracker'):
            return self.backend.get_history_tracker(user_id=self.user_id)
        return self.backend.get_history_tracker()
    
    def save_history_tracker(self, data: dict) -> None:
        """Salva history_tracker com user_id."""
        if hasattr(self.backend, 'save_history_tracker'):
            self.backend.save_history_tracker(data, user_id=self.user_id)
        else:
            self.backend.save_history_tracker(data)
    
    def get_trades_db(self) -> list:
        """Retorna trades_db filtrado por user_id."""
        if hasattr(self.backend, 'get_trades_db'):
            return self.backend.get_trades_db(user_id=self.user_id)
        return self.backend.get_trades_db()
    
    def save_trades_db(self, data: list) -> None:
        """Salva trades_db com user_id."""
        if hasattr(self.backend, 'save_trades_db'):
            self.backend.save_trades_db(data, user_id=self.user_id)
        else:
            self.backend.save_trades_db(data)
    
    def get_config(self) -> dict:
        """Retorna config do usuário."""
        if hasattr(self.backend, 'get_config'):
            return self.backend.get_config(user_id=self.user_id)
        return self.backend.get_config()

    def get_telegram_config(self) -> dict | None:
        """Retorna config do Telegram do usuário."""
        if hasattr(self.backend, 'get_telegram_config'):
            return self.backend.get_telegram_config(user_id=self.user_id)
        return None

    def get_user_created_at_timestamp_ms(self) -> int | None:
        """Retorna created_at do usuário em ms. None = sem filtro (modo legado)."""
        if hasattr(self.backend, 'get_user_created_at_timestamp_ms'):
            return self.backend.get_user_created_at_timestamp_ms(user_id=self.user_id)
        return None
