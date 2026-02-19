"""
Configuração do bot como dataclass.
Substitui variáveis globais por objeto configurável.
"""
from dataclasses import dataclass, field
from typing import List, Set, Tuple


@dataclass
class BotConfig:
    """Configuração completa do bot."""
    
    # Identificação
    user_id: str
    wallet_address: str
    private_key: str  # Já descriptografado
    
    # Trading
    symbols: List[str] = field(default_factory=list)
    timeframes: List[str] = field(default_factory=list)
    trade_mode: str = "BOTH"  # BOTH, LONG_ONLY, SHORT_ONLY
    
    # Network
    is_mainnet: bool = True
    
    # Entrada 2 (Pro/Enterprise): -1.414 fib. Basic=só entrada 1.
    entry2_enabled: bool = True
    entry2_allowed: bool = True  # Por plano: basic=False, pro/enterprise=True

    # Risk Management
    target_loss_usd: float = 5.0
    max_global_exposure: float = 5000.0
    max_single_pos_exposure: float = 2500.0
    max_positions: int = 2
    fallback_stop_pct: float = 0.005
    
    # Indicators
    rsi_period: int = 14
    volume_sma_period: int = 20
    lookback_divergence: int = 35
    min_pivot_dist: int = 4
    local_low_window: int = 4
    
    # Fibonacci Targets
    fib_levels: List[Tuple[float, float]] = field(default_factory=lambda: [
        (0.618, 0.10),  # Alvo 1 (0.618)
        (1.0, 0.60),    # Alvo 2 (1.0)
        (1.618, 0.30)   # Alvo 3 (1.618)
    ])
    fib_stop_level: float = 2.0
    fib_entry2_level: float = 1.6
    
    # LSR Binance
    lsr_timeframe: str = "30m"
    lsr_limit: int = 4
    lsr_threshold_pct: float = 0.5
    lsr_update_interval: int = 1800  # 30 minutos
    
    # LSR Extremo
    lsr_block_short_below: float = 1.1
    lsr_block_long_default: float = 3.0
    lsr_block_long_special_1: float = 3.8
    lsr_block_long_special_2: float = 4.9
    lsr_special_1_symbols: Set[str] = field(default_factory=lambda: {"XRP", "BNB"})
    lsr_special_2_symbols: Set[str] = field(default_factory=lambda: {"SOL"})
    
    # Strength Block
    strength_update_interval: int = 900  # 15 minutos
    
    def get_base_url(self):
        """Retorna URL base da API conforme rede."""
        from hyperliquid.utils import constants
        return constants.MAINNET_API_URL if self.is_mainnet else constants.TESTNET_API_URL
