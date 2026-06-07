"""Helpers para símbolos Hyperliquid (perp vs spot)."""

def is_spot_coin(coin) -> bool:
    """Spot na HL usa coin com prefixo @ (ex.: @151 = par spot)."""
    if coin is None:
        return False
    return str(coin).strip().startswith("@")
