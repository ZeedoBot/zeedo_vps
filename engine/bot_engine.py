"""
Engine do bot: encapsula a lógica de trading.
Recebe config, storage e tg_send por injeção — sem globals.
Usado pelo BotInstance (SaaS) e pode ser usado por run_local/run_online.
"""
import logging
from typing import Callable, Optional

from .config import BotConfig


class BotEngine:
    """
    Engine do bot com injeção de dependências.
    Sem variáveis globais; config, storage e tg_send vêm do construtor.
    """

    def __init__(
        self,
        config: BotConfig,
        storage,
        tg_send: Callable[[str], None],
    ):
        self.config = config
        self.storage = storage
        self.tg_send = tg_send

    def _config_to_overrides(self) -> dict:
        """Converte BotConfig em dict para injetar nas globals do bot.

        Injeta APENAS os parâmetros configuráveis por usuário (vindos do banco `bot_config`).
        As constantes de estratégia (lookback, pivôs, RSI, volume, limiares LSR, fallback stop)
        têm fonte única nas globals de `bot.py` e NÃO são sobrescritas aqui — assim, editar
        `bot.py` vale tanto para o modo single-user quanto para o SaaS.
        """
        return {
            "SYMBOLS": self.config.symbols,
            "TIMEFRAMES": self.config.timeframes,
            "TRADE_MODE": self.config.trade_mode,
            "TARGET_LOSS_USD": self.config.target_loss_usd,
            "MAX_GLOBAL_EXPOSURE": self.config.max_global_exposure,
            "MAX_SINGLE_POS_EXPOSURE": self.config.max_single_pos_exposure,
            "MAX_POSITIONS": self.config.max_positions,
            "FIB_LEVELS": self.config.fib_levels,
            "FIB_STOP_LEVEL": self.config.fib_stop_level,
            "STRATEGY_PRESET": self.config.strategy_preset,
            "ENTRY1_MULTIPLIER": self.config.entry1_multiplier,
            "SIGNAL_MODE": self.config.signal_mode,
        }

    def run(self, info, exchange, wallet_addr):
        """
        Executa o loop principal do bot.
        Injeta config e tg_send no módulo bot e chama run_main_loop.
        """
        import bot as bot_module

        overrides = self._config_to_overrides()
        bot_module.tg_send = self.tg_send
        bot_module.run_main_loop(info, exchange, wallet_addr, self.storage, config_overrides=overrides)
