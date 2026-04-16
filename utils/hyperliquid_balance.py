"""
Saldo / equity em USD alinhado ao modo de conta da Hyperliquid.

Em unified account e portfolio margin, a documentação indica que os saldos
relevantes estão no spot clearinghouse; o marginSummary do perp clearinghouse
pode não refletir o património (ex.: UI mostra equity mas API perp devolve 0).
"""
from __future__ import annotations

import logging
import requests

logger = logging.getLogger(__name__)

HL_INFO_MAINNET = "https://api.hyperliquid.xyz/info"

# No spot clearinghouse, tratamos como ~1 USD para exibição / PnL %
_STABLE_SPOT_COINS = frozenset({"USDC", "USDH"})


def fetch_user_abstraction(wallet: str) -> str | None:
    if not wallet or not str(wallet).strip().lower().startswith("0x"):
        return None
    try:
        r = requests.post(
            HL_INFO_MAINNET,
            json={"type": "userAbstraction", "user": wallet},
            timeout=10,
        )
        r.raise_for_status()
        data = r.json()
        if isinstance(data, str):
            return data
        return None
    except Exception as e:
        logger.debug("userAbstraction falhou (%s…): %s", wallet[:10], e)
        return None


def fetch_clearinghouse_account_value(wallet: str) -> float:
    if not wallet:
        return 0.0
    try:
        r = requests.post(
            HL_INFO_MAINNET,
            json={"type": "clearinghouseState", "user": wallet},
            timeout=10,
        )
        r.raise_for_status()
        data = r.json() or {}
        margin = data.get("marginSummary") or {}
        val = margin.get("accountValue")
        return float(val) if val is not None else 0.0
    except Exception as e:
        logger.warning("clearinghouseState (accountValue): %s", e)
        return 0.0


def fetch_spot_stable_equity_usd(wallet: str) -> float:
    """Soma saldos USDC/USDH no spot clearinghouse (collateral típico em modo unificado)."""
    if not wallet:
        return 0.0
    try:
        r = requests.post(
            HL_INFO_MAINNET,
            json={"type": "spotClearinghouseState", "user": wallet},
            timeout=10,
        )
        r.raise_for_status()
        data = r.json() or {}
        balances = data.get("balances") or []
        total = 0.0
        for b in balances:
            coin = str(b.get("coin") or "").upper()
            if coin not in _STABLE_SPOT_COINS:
                continue
            raw = b.get("total", "0") or "0"
            try:
                total += float(raw)
            except (TypeError, ValueError):
                continue
        return total
    except Exception as e:
        logger.warning("spotClearinghouseState: %s", e)
        return 0.0


def fetch_display_account_value_usd(wallet: str) -> float:
    """
    Valor de conta para dashboard / PnL %:
    - Modo standard (default, disabled, dexAbstraction, etc.): perp clearinghouse accountValue.
    - unifiedAccount / portfolioMargin: max(perp, spot USDC/USDH) — o spot é a fonte oficial
      para stable em modo unificado; max cobre cantos em que ainda há valor no perp.
    """
    if not wallet:
        return 0.0
    perp = fetch_clearinghouse_account_value(wallet)
    mode = fetch_user_abstraction(wallet)
    if mode in ("unifiedAccount", "portfolioMargin"):
        spot = fetch_spot_stable_equity_usd(wallet)
        return max(perp, spot)
    return perp
