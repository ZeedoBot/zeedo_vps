# Zeedo Bot – Mainnet – Estrutura e Validação

## Estrutura final do projeto

```
Bot - Mainnet (V1)/
├── bot.py                 # Core: lógica de trading + loop principal
├── run_local.py           # Entrypoint bot local (JSON)
├── run_online.py          # Entrypoint bot online (Supabase)
├── dashboard.py           # Dashboard Streamlit (lê JSONs locais)
├── telegram_bot.py        # Bot Telegram (/start, links)
├── storage/               # Camada de persistência
│   ├── __init__.py        # get_storage(), LocalStorage, SupabaseStorage
│   ├── base.py            # Interface StorageBase
│   ├── local_storage.py   # JSON (bot_tracker.json, etc.)
│   └── supabase_storage.py# Supabase (tabela bot_state)
├── mcp/                   # MCP e leitura Supabase (somente leitura)
│   ├── __init__.py        # Exporta supabase_reader
│   ├── supabase_reader.py # Funções compartilhadas (MCP + scripts)
│   └── validator.py       # Servidor FastMCP (tools para Cursor)
├── scripts/               # Utilitários
│   ├── validate_supabase.py # Validação completa Supabase
│   └── run_checks.py        # Sanity checks (bot, storage, dashboard, MCP)
├── docs/                  # Documentação
│   ├── ARCHITECTURE.md
│   ├── MCP_README.md
│   ├── MCP_VALIDATION_REPORT.md
│   └── RESUMO_VALIDACAO.md
├── bot_tracker.json       # Estado local (modo local)
├── bot_history.json
├── trades_database.json
├── bot_config.json
├── requirements.txt
├── .env                   # Credenciais (não versionar)
└── PROJECT_STRUCTURE.md   # Este arquivo
```

## Responsabilidades

| Tipo | Arquivos | Função |
|------|----------|--------|
| **Core** | `bot.py`, `run_local.py`, `run_online.py` | Bot em produção; entrypoints por modo (local/online). |
| **Suporte** | `storage/`, `dashboard.py`, `telegram_bot.py` | Persistência (local + Supabase), UI Streamlit, bot Telegram. |
| **Utilitários** | `scripts/validate_supabase.py`, `scripts/run_checks.py` | Validação Supabase e sanity checks. |
| **MCP** | `mcp/supabase_reader.py`, `mcp/validator.py` | Leitura Supabase (compartilhada) e servidor MCP para Cursor. |
| **Documentação** | `docs/*.md`, `PROJECT_STRUCTURE.md` | Arquitetura, MCP, validação e este resumo. |

## O que foi organizado

1. **MCP e validação**
   - Lógica de leitura Supabase centralizada em `mcp/supabase_reader.py` (sem duplicação).
   - Servidor MCP em `mcp/validator.py` (usa `supabase_reader`).
   - Script de validação em `scripts/validate_supabase.py` (usa `mcp.supabase_reader`).
   - Removidos da raiz: `mcp_supabase_validator.py`, `validate_supabase.py`.

2. **Documentação**
   - Toda a documentação (.md) movida para `docs/`.
   - `docs/ARCHITECTURE.md` atualizado com a estrutura atual (mcp/, scripts/, docs/).

3. **Scripts**
   - `scripts/run_checks.py`: sanity checks (bot, storage local, Supabase, dashboard, MCP reader/validator).
   - Execução sempre a partir da **raiz do projeto**.

## O que foi testado

- **Bot**: `import bot` sem erro.
- **Storage local**: `get_storage()` (BOT_STORAGE=local), leitura de entry_tracker, history_tracker, trades_db, config.
- **Storage Supabase**: `get_storage()` (BOT_STORAGE=supabase), leitura (falha esperada se tabela `bot_state` não existir ou sem rede).
- **Dashboard**: `import dashboard` sem erro (Streamlit pode avisar quando não é executado com `streamlit run`).
- **MCP reader**: `mcp.supabase_reader.get_schema_info()`.
- **MCP validator**: import do `mcp.validator` (opcional; depende de FastMCP instalado).

Comando usado:

```bash
python scripts/run_checks.py
```

## O que está OK

- Estrutura de pastas clara: core na raiz, storage, mcp, scripts, docs separados.
- Uma única fonte de verdade para leitura Supabase (`mcp/supabase_reader.py`).
- Entrypoints do bot intactos: `run_local.py`, `run_online.py`, `from bot import main`.
- Dashboard e bot continuam usando os mesmos arquivos/contratos (dashboard lê JSONs locais).
- Nenhum dado nem schema do Supabase foram alterados; apenas organização e código do projeto.

## Pontos de atenção futuros

1. **Dashboard em modo online**  
   O dashboard lê apenas JSONs locais. Com bot em Supabase, os JSONs não são atualizados; para refletir estado online, o dashboard precisaria usar a mesma camada de storage (ex.: Supabase) quando em modo online.

2. **Tabela `bot_state` no Supabase**  
   Se a tabela `bot_state` não existir no projeto Supabase, o storage Supabase e o MCP retornam vazio/erro 404. Criar a tabela conforme `docs/ARCHITECTURE.md` (SQL da tabela `bot_state`).

3. **FastMCP (MCP validator)**  
   O check “MCP validator” pode falhar se `fastmcp` (e dependências como `mcp.types`) não estiver instalado. É opcional; a validação via `scripts/validate_supabase.py` não depende de FastMCP.

4. **Execução sempre na raiz**  
   Rodar sempre a partir da raiz do projeto, por exemplo:
   - `python run_local.py` / `python run_online.py`
   - `python scripts/run_checks.py`
   - `python scripts/validate_supabase.py`
   - `python -m mcp.validator` (servidor MCP)

## Comandos rápidos

| Ação | Comando |
|------|--------|
| Bot local | `python run_local.py` |
| Bot online | `python run_online.py` |
| Sanity checks | `python scripts/run_checks.py` |
| Validação Supabase | `python scripts/validate_supabase.py` |
| Servidor MCP | `python -m mcp.validator` |
| Dashboard | `streamlit run dashboard.py` |

## Arquivos que podem ser ignorados ou só documentação

- **docs/** – apenas documentação; não afeta execução.
- **scripts/** – utilitários; não fazem parte do core do bot.
- **mcp/** – usado por scripts de validação e pelo Cursor (MCP); o bot em produção usa apenas `storage/`.

Nada foi removido sem justificativa: arquivos duplicados (MCP/validação) foram consolidados em `mcp/` e `scripts/`; documentação concentrada em `docs/`.
