"""
Implementação de persistência em arquivos JSON (comportamento atual do bot).
"""
import json
import logging
import os
from typing import Any

from .base import StorageBase

TRACKER_FILE = "bot_tracker.json"
HISTORY_FILE = "bot_history.json"
TRADES_DB_FILE = "trades_database.json"
CONFIG_FILE = "bot_config.json"


def _load_json(filename: str) -> Any:
    if os.path.exists(filename):
        try:
            with open(filename, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logging.error(f"Erro ao carregar {filename}: {e}")
    return {} if "tracker" in filename or "history" in filename or "config" in filename else []


def _save_json(filename: str, data: Any) -> None:
    try:
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
    except Exception as e:
        logging.error(f"Erro ao salvar {filename}: {e}")


class LocalStorage(StorageBase):
    """Persistência em JSON no disco (comportamento idêntico ao bot original)."""

    def __init__(
        self,
        tracker_file: str = TRACKER_FILE,
        history_file: str = HISTORY_FILE,
        trades_db_file: str = TRADES_DB_FILE,
        config_file: str = CONFIG_FILE,
    ):
        self.tracker_file = tracker_file
        self.history_file = history_file
        self.trades_db_file = trades_db_file
        self.config_file = config_file

    def get_entry_tracker(self) -> dict:
        out = _load_json(self.tracker_file)
        return out if isinstance(out, dict) else {}

    def save_entry_tracker(self, data: dict) -> None:
        _save_json(self.tracker_file, data)

    def get_history_tracker(self) -> dict:
        out = _load_json(self.history_file)
        return out if isinstance(out, dict) else {}

    def save_history_tracker(self, data: dict) -> None:
        _save_json(self.history_file, data)

    def get_trades_db(self) -> list:
        out = _load_json(self.trades_db_file)
        return out if isinstance(out, list) else []

    def save_trades_db(self, data: list) -> None:
        _save_json(self.trades_db_file, data)

    def get_config(self) -> dict:
        return _load_json(self.config_file)
