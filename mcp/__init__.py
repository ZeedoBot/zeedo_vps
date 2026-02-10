"""
MCP (Model Context Provider) e leitura Supabase.
- supabase_reader: funções somente-leitura compartilhadas (MCP + scripts).
- validator: servidor FastMCP que expõe tools para o Cursor.
"""
from .supabase_reader import (
    get_client,
    get_bot_state_keys,
    get_entry_tracker,
    get_history_tracker,
    get_trades_db,
    get_config,
    validate_pnl_calculation,
    get_schema_info,
)

__all__ = [
    "get_client",
    "get_bot_state_keys",
    "get_entry_tracker",
    "get_history_tracker",
    "get_trades_db",
    "get_config",
    "validate_pnl_calculation",
    "get_schema_info",
]
