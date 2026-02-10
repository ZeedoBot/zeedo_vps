"""
Script de validação Supabase – analisa dados reais e compara com o que o código espera.
Usa mcp.supabase_reader (sem duplicar lógica). Execute a partir da raiz do projeto:
  python scripts/validate_supabase.py
"""
import os
import sys
import io

# Garante que a raiz do projeto está no path
_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _root not in sys.path:
    sys.path.insert(0, _root)

# Encoding UTF-8 para Windows
if sys.platform == "win32":
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")
    except Exception:
        pass

from dotenv import load_dotenv
load_dotenv(os.path.join(_root, ".env"))

from mcp.supabase_reader import (
    get_bot_state_keys,
    get_entry_tracker,
    get_history_tracker,
    get_trades_db,
    get_config,
    validate_pnl_calculation,
    get_schema_info,
)


def print_section(title: str) -> None:
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)


def validate_data() -> None:
    """Executa validação completa dos dados do Supabase."""
    print_section("VALIDAÇÃO SUPABASE - BOT TRADING")

    # 1. Conexão e tabelas
    print_section("1. VERIFICAÇÃO DE CONEXÃO E TABELAS")
    try:
        keys_result = get_bot_state_keys()
        if "error" in keys_result:
            print(f"Erro: {keys_result['error']}")
            return
        tables = keys_result.get("tables", {})
        total_records = keys_result.get("total_records", 0)
        print(f"OK Conexão estabelecida | Total de registros: {total_records}")
        for table_name, count in tables.items():
            print(f"  {table_name}: {count} registros")
    except Exception as e:
        print(f"Erro: {e}")
        return

    # 2. entry_tracker
    print_section("2. VALIDAÇÃO: entry_tracker")
    try:
        entry_result = get_entry_tracker()
        if "error" in entry_result:
            print(f"Erro: {entry_result['error']}")
        else:
            print(f"Símbolos ativos: {entry_result['count']} | {', '.join(entry_result.get('symbols', []))}")
            validation = entry_result.get("validation", {})
            all_valid = all(v.get("has_all_fields", False) for v in validation.values())
            print("OK Campos esperados presentes" if all_valid else "AVISO Alguns símbolos com campos faltando")
            for sym, val in validation.items():
                pnl = val.get("pnl_realized", 0.0)
                print(f"  {sym}: pnl_realized=${pnl:.2f}")
    except Exception as e:
        print(f"Erro: {e}")

    # 3. history_tracker
    print_section("3. VALIDAÇÃO: history_tracker")
    try:
        history_result = get_history_tracker()
        if "error" in history_result:
            print(f"Erro: {history_result['error']}")
        else:
            print(f"Símbolos no histórico: {history_result['count']}")
    except Exception as e:
        print(f"Erro: {e}")

    # 4. trades_db
    print_section("4. VALIDAÇÃO: trades_db")
    try:
        trades_result = get_trades_db(limit=1000)
        if "error" in trades_result:
            print(f"Erro: {trades_result['error']}")
        else:
            print(f"Total de trades: {trades_result['count']}")
            validation = trades_result.get("validation", {})
            issues = validation.get("issues", [])
            print("OK Nenhum problema" if not issues else f"AVISO {len(issues)} trades com problemas")
            for field in ["coin", "oid", "closedPnl", "fee", "pnl_usd"]:
                fa = validation.get("fields_analysis", {}).get(field, {})
                pct = fa.get("percentage", 0)
                print(f"  {field}: {pct:.1f}% presente")
    except Exception as e:
        print(f"Erro: {e}")

    # 5. config
    print_section("5. VALIDAÇÃO: config")
    try:
        config_result = get_config()
        if "error" in config_result:
            print(f"Erro: {config_result['error']}")
        else:
            print("OK Config encontrada" if config_result.get("exists") else "AVISO Config não encontrada")
    except Exception as e:
        print(f"Erro: {e}")

    # 6. Validação cruzada PnL
    print_section("6. VALIDAÇÃO CRUZADA: PnL")
    try:
        pnl_result = validate_pnl_calculation()
        if "error" in pnl_result:
            print(f"Erro: {pnl_result['error']}")
        else:
            discrepancies = pnl_result.get("discrepancies", [])
            print("OK PnL consistente" if not discrepancies else f"AVISO {len(discrepancies)} discrepâncias")
            for d in discrepancies:
                print(f"  {d['symbol']}: esperado ${d['expected']:.2f} vs calculado ${d['calculated']:.2f}")
    except Exception as e:
        print(f"Erro: {e}")

    # 7. Schema
    print_section("7. SCHEMA ESPERADO")
    try:
        schema = get_schema_info()
        tables = schema.get("tables", {})
        print(f"Tabelas normalizadas: {len(tables)}")
        for table_name, table_info in tables.items():
            purpose = table_info.get("purpose", "N/A")
            print(f"  {table_name}: {purpose}")
            if "expected_fields_in_data" in table_info:
                fields = table_info["expected_fields_in_data"]
                print(f"    Campos esperados no JSONB: {len(fields)} campos")
    except Exception as e:
        print(f"Erro: {e}")

    print_section("VALIDAÇÃO CONCLUÍDA")


if __name__ == "__main__":
    validate_data()
