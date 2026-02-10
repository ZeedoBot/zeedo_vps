"""
Servidor MCP (Model Context Provider) para validação do Supabase.
Expõe tools somente de leitura; usa mcp.supabase_reader para evitar duplicação.
Execute: python -m mcp.validator (a partir da raiz do projeto)
"""
from typing import Any, Dict, Optional
from fastmcp import FastMCP

from . import supabase_reader

mcp = FastMCP("Supabase Bot Validator")


@mcp.tool()
def get_bot_state_keys() -> Dict[str, Any]:
    """Lista todas as tabelas normalizadas e contagem de registros."""
    return supabase_reader.get_bot_state_keys()


@mcp.tool()
def get_entry_tracker(symbol: Optional[str] = None) -> Dict[str, Any]:
    """Consulta entry_tracker do bot. Se symbol for fornecido, retorna apenas dados desse símbolo."""
    return supabase_reader.get_entry_tracker(symbol)


@mcp.tool()
def get_history_tracker() -> Dict[str, Any]:
    """Consulta history_tracker do bot."""
    return supabase_reader.get_history_tracker()


@mcp.tool()
def get_trades_db(limit: int = 100, symbol: Optional[str] = None) -> Dict[str, Any]:
    """Consulta trades_db (lista de fills). limit: máximo de trades; symbol: filtrar por símbolo (opcional)."""
    return supabase_reader.get_trades_db(limit=limit, symbol=symbol)


@mcp.tool()
def get_config() -> Dict[str, Any]:
    """Consulta config do bot."""
    return supabase_reader.get_config()


@mcp.tool()
def validate_pnl_calculation(symbol: Optional[str] = None) -> Dict[str, Any]:
    """Validação cruzada de PnL entre entry_tracker e trades_db. symbol: opcional."""
    return supabase_reader.validate_pnl_calculation(symbol)


@mcp.tool()
def get_schema_info() -> Dict[str, Any]:
    """Retorna schema esperado pelo código (tabelas normalizadas: bot_tracker, bot_history, trades_database, bot_config)."""
    return supabase_reader.get_schema_info()


if __name__ == "__main__":
    mcp.run()
