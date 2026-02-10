"""
Interface de persistência do bot.
Toda leitura/escrita de estado (entry_tracker, history_tracker, trades_db, config)
deve passar por uma implementação desta interface.
"""
from abc import ABC, abstractmethod


class StorageBase(ABC):
    """Interface que abstrai persistência (JSON local ou Supabase)."""

    @abstractmethod
    def get_entry_tracker(self) -> dict:
        """Retorna o entry_tracker (dict keyed by symbol)."""
        pass

    @abstractmethod
    def save_entry_tracker(self, data: dict) -> None:
        """Persiste o entry_tracker."""
        pass

    @abstractmethod
    def get_history_tracker(self) -> dict:
        """Retorna o history_tracker (dict: symbol -> tf -> signal_ts)."""
        pass

    @abstractmethod
    def save_history_tracker(self, data: dict) -> None:
        """Persiste o history_tracker."""
        pass

    @abstractmethod
    def get_trades_db(self) -> list:
        """Retorna a lista de fills (trades_database)."""
        pass

    @abstractmethod
    def save_trades_db(self, data: list) -> None:
        """Persiste a lista de fills."""
        pass

    @abstractmethod
    def get_config(self) -> dict:
        """Retorna a config (symbols, timeframes, trade_mode)."""
        pass
