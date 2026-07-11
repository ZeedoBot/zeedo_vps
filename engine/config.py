"""
Configuração do bot como dataclass.
Substitui variáveis globais por objeto configurável.
"""
from dataclasses import dataclass, field
from typing import List, Tuple


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
    
    # Modo Sinal: não coloca ordens; envia alerta e regista trade bloqueado.
    signal_mode: bool = False

    # Risk Management (por-usuário; vêm do banco bot_config)
    target_loss_usd: float = 5.0
    max_global_exposure: float = 5000.0
    max_single_pos_exposure: float = 2500.0
    max_positions: int = 2

    # NOTA: as constantes de estratégia (fallback_stop_pct, rsi_period, volume_sma_period,
    # lookback_divergence, min_pivot_dist, local_low_window e os limiares LSR) têm fonte
    # única nas globals de bot.py. Não são replicadas aqui para evitar divergência de config.

    # Fibonacci Targets (2+ alvos — default 2 alvos de 50% cada)
    fib_levels: List[Tuple[float, float]] = field(default_factory=lambda: [
        (0.618, 0.50),  # Alvo 1 (0.618)
        (1.0, 0.50),    # Alvo 2 (1.0)
    ])
    # Entrada 1 (Prolongamento do setup): long usa -valor; short usa +valor
    # Ex: 0.618 => long: setup_high - tech_base*0.618 (equivale a "entrada -0.618")
    entry1_multiplier: float = 0.618
    fib_stop_level: float = 1.8
    strategy_preset: str = ""

    def get_base_url(self):
        """Retorna URL base da API conforme rede."""
        from hyperliquid.utils import constants
        return constants.MAINNET_API_URL if self.is_mainnet else constants.TESTNET_API_URL
