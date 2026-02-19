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
        """Converte BotConfig em dict para injetar nas globals do bot (compatibilidade)."""
        return {
            "SYMBOLS": self.config.symbols,
            "TIMEFRAMES": self.config.timeframes,
            "TRADE_MODE": self.config.trade_mode,
            "TARGET_LOSS_USD": self.config.target_loss_usd,
            "MAX_GLOBAL_EXPOSURE": self.config.max_global_exposure,
            "MAX_SINGLE_POS_EXPOSURE": self.config.max_single_pos_exposure,
            "MAX_POSITIONS": self.config.max_positions,
            "FALLBACK_STOP_PCT": self.config.fallback_stop_pct,
            "RSI_PERIOD": self.config.rsi_period,
            "VOLUME_SMA_PERIOD": self.config.volume_sma_period,
            "LOOKBACK_DIVERGENCE": self.config.lookback_divergence,
            "MIN_PIVOT_DIST": self.config.min_pivot_dist,
            "LOCAL_LOW_WINDOW": self.config.local_low_window,
            "FIB_LEVELS": self.config.fib_levels,
            "FIB_STOP_LEVEL": self.config.fib_stop_level,
            "FIB_ENTRY2_LEVEL": self.config.fib_entry2_level,
            "LSR_TIMEFRAME": self.config.lsr_timeframe,
            "LSR_LIMIT": self.config.lsr_limit,
            "LSR_THRESHOLD_PCT": self.config.lsr_threshold_pct,
            "LSR_UPDATE_INTERVAL": self.config.lsr_update_interval,
            "LSR_BLOCK_SHORT_BELOW": self.config.lsr_block_short_below,
            "LSR_BLOCK_LONG_DEFAULT": self.config.lsr_block_long_default,
            "LSR_BLOCK_LONG_SPECIAL_1": self.config.lsr_block_long_special_1,
            "LSR_BLOCK_LONG_SPECIAL_2": self.config.lsr_block_long_special_2,
            "LSR_SPECIAL_1_SYMBOLS": self.config.lsr_special_1_symbols,
            "LSR_SPECIAL_2_SYMBOLS": self.config.lsr_special_2_symbols,
            "STRENGTH_UPDATE_INTERVAL": self.config.strength_update_interval,
            "ENTRY2_ENABLED": self.config.entry2_enabled,
            "ENTRY2_ALLOWED": self.config.entry2_allowed,
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
