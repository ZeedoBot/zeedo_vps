"""
Sanity checks do projeto Zeedo Bot.
Execute a partir da raiz do projeto: python scripts/run_checks.py
"""
import os
import sys

_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _root not in sys.path:
    sys.path.insert(0, _root)

os.chdir(_root)


def ok(msg: str) -> None:
    print(f"  [OK] {msg}")


def fail(msg: str) -> None:
    print(f"  [FAIL] {msg}")


def section(name: str) -> None:
    print(f"\n--- {name} ---")


def check_bot_imports() -> bool:
    """Verifica se o bot importa sem erros."""
    section("1. Bot (imports)")
    try:
        import bot  # noqa: F401
        ok("bot.py importa corretamente")
        return True
    except Exception as e:
        fail(f"bot.py: {e}")
        return False


def check_storage_local() -> bool:
    """Verifica storage local (JSON)."""
    section("2. Storage local")
    try:
        from storage import get_storage
        os.environ["BOT_STORAGE"] = "local"
        storage = get_storage()
        et = storage.get_entry_tracker()
        ht = storage.get_history_tracker()
        td = storage.get_trades_db()
        cfg = storage.get_config()
        ok(f"entry_tracker: {len(et)} símbolos")
        ok(f"history_tracker: {len(ht)} símbolos")
        ok(f"trades_db: {len(td)} trades")
        ok(f"config: {'tem symbols' if cfg.get('symbols') else 'vazio'}")
        return True
    except Exception as e:
        fail(f"storage local: {e}")
        return False


def check_storage_supabase() -> bool:
    """Verifica se Supabase está configurado e responde (apenas leitura)."""
    section("3. Storage Supabase (leitura)")
    try:
        from storage import get_storage
        os.environ["BOT_STORAGE"] = "supabase"
        storage = get_storage()
        et = storage.get_entry_tracker()
        ht = storage.get_history_tracker()
        td = storage.get_trades_db()
        cfg = storage.get_config()
        ok(f"entry_tracker: {len(et)} símbolos")
        ok(f"history_tracker: {len(ht)} símbolos")
        ok(f"trades_db: {len(td)} trades")
        ok(f"config exists: {bool(cfg)}")
        return True
    except Exception as e:
        fail(f"Supabase (pode ser falta de .env ou rede): {e}")
        return False


def check_dashboard_imports() -> bool:
    """Verifica se o dashboard importa sem erros."""
    section("4. Dashboard (imports)")
    try:
        import streamlit
        import dashboard  # noqa: F401
        ok("dashboard.py importa corretamente")
        return True
    except Exception as e:
        fail(f"dashboard: {e}")
        return False


def check_mcp_reader() -> bool:
    """Verifica mcp.supabase_reader (sem conectar se não houver env)."""
    section("5. MCP supabase_reader")
    try:
        from mcp import supabase_reader
        schema = supabase_reader.get_schema_info()
        tables = schema.get("tables", {})
        ok(f"schema: {len(tables)} tabelas normalizadas")
        return True
    except Exception as e:
        fail(f"mcp.supabase_reader: {e}")
        return False


def check_mcp_validator_import() -> bool:
    """Verifica se o módulo MCP validator importa (FastMCP opcional)."""
    section("6. MCP validator (FastMCP)")
    try:
        from mcp import validator  # noqa: F401
        ok("mcp.validator importa corretamente")
        return True
    except ImportError as e:
        fail(f"FastMCP não instalado (opcional): {e}")
        return False
    except Exception as e:
        fail(f"mcp.validator: {e}")
        return False


def main() -> None:
    print("Zeedo Bot - Sanity checks")
    results = []
    results.append(("Bot", check_bot_imports()))
    results.append(("Storage local", check_storage_local()))
    # Supabase: só falha se quebrar; não exigir rede
    results.append(("Storage Supabase", check_storage_supabase()))
    results.append(("Dashboard", check_dashboard_imports()))
    results.append(("MCP reader", check_mcp_reader()))
    results.append(("MCP validator", check_mcp_validator_import()))

    section("Resumo")
    for name, ok_ in results:
        print(f"  {'OK' if ok_ else 'FAIL'}: {name}")
    critical = ["Bot", "Storage local", "Dashboard", "MCP reader"]
    all_ok = all(r[1] for r in results if r[0] in critical)
    print("\n" + ("Todos os checks críticos passaram." if all_ok else "Alguns checks falharam."))
    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()
