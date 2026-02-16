"""
Engine do bot - lógica de trading com injeção de dependências.
"""
from .config import BotConfig
from .bot_engine import BotEngine

__all__ = ["BotConfig", "BotEngine"]
