# Arquitetura: Bot local vs online (base comum + Supabase)

## Estrutura de pastas/arquivos

```
Bot - Mainnet (V1)/
├── bot.py                 # Core: lógica de trading + loop principal (usa storage)
├── run_local.py           # Entrypoint: bot local (JSON)
├── run_online.py          # Entrypoint: bot online (Supabase)
├── dashboard.py           # Dashboard Streamlit (lê JSONs locais)
├── telegram_bot.py        # Bot Telegram (comandos /start, links)
├── storage/
│   ├── __init__.py        # get_storage(), LocalStorage, SupabaseStorage
│   ├── base.py            # Interface StorageBase
│   ├── local_storage.py   # Persistência em JSON (bot_tracker.json, etc.)
│   └── supabase_storage.py# Persistência no Supabase (tabela bot_state)
├── mcp/
│   ├── __init__.py        # Exporta supabase_reader
│   ├── supabase_reader.py # Leitura somente-leitura Supabase (compartilhado)
│   └── validator.py       # Servidor FastMCP (tools para Cursor)
├── scripts/
│   ├── validate_supabase.py # Validação completa Supabase (usa mcp.supabase_reader)
│   └── run_checks.py        # Sanity checks (bot, storage, dashboard, MCP)
├── docs/
│   ├── ARCHITECTURE.md    # Este arquivo
│   ├── MCP_README.md      # Guia do MCP
│   ├── MCP_VALIDATION_REPORT.md
│   └── RESUMO_VALIDACAO.md
├── bot_tracker.json       # Usado apenas em modo local
├── bot_history.json
├── trades_database.json
├── bot_config.json
├── requirements.txt
└── PROJECT_STRUCTURE.md   # Resumo da organização e como testar
```

- **Lógica de trading**: continua em `bot.py`; não foi duplicada.
- **Persistência**: abstraída em `storage`; o bot só chama `storage.get_*` / `storage.save_*`.
- **Modo local**: `LocalStorage` lê/escreve os mesmos JSONs de sempre.
- **Modo online**: `SupabaseStorage` espelha os mesmos dados na tabela `bot_state` do Supabase.

---

## Como rodar o bot local (JSON)

**Opção 1 – Variável de ambiente**

```bash
# Windows (PowerShell)
$env:BOT_STORAGE="local"
python bot.py

# Linux/macOS
export BOT_STORAGE=local
python bot.py
```

**Opção 2 – Entrypoint**

```bash
python run_local.py
```

**Opção 3 – Padrão**

Se `BOT_STORAGE` não estiver definida, o bot usa **local** por padrão.

- Estado em: `bot_tracker.json`, `bot_history.json`, `trades_database.json`, `bot_config.json`.
- Comportamento idêntico ao bot original.

---

## Como rodar o bot online (Supabase)

**Pré-requisitos**

1. Projeto no Supabase com a tabela `bot_state` criada (SQL abaixo).
2. No `.env`:
   - `SUPABASE_URL` = URL do projeto
   - `SUPABASE_SERVICE_KEY` ou `SUPABASE_ANON_KEY` = chave (service para escrita sem RLS)

**Opção 1 – Variável de ambiente**

```bash
$env:BOT_STORAGE="supabase"
python bot.py
```

**Opção 2 – Entrypoint**

```bash
python run_online.py
```

O bot carrega e grava estado no Supabase (entry_tracker, history_tracker, trades_db, config). Logs e PID continuam locais (arquivo e processo).

---

## Tabela Supabase (bot_state)

Crie no SQL Editor do Supabase:

```sql
create table if not exists bot_state (
  key   text primary key,
  value jsonb not null default '{}'::jsonb
);

-- Chaves usadas pelo bot: entry_tracker, history_tracker, trades_db, config
-- O bot faz upsert por key; não é necessário criar linhas antes.
```

- **entry_tracker**: objeto `{ "SYMBOL": { ... }, ... }`.
- **history_tracker**: objeto `{ "SYMBOL": { "15m": ts, ... }, ... }`.
- **trades_db**: array de fills.
- **config**: `{ "symbols": [...], "timeframes": [...], "trade_mode": "BOTH" }`.

---

## MCP + Supabase no Cursor

O **MCP** (Model Context Protocol) no Cursor serve para **desenvolvimento**: consultar schema, dados e rodar queries a partir do editor. O **bot em runtime** usa o **SDK Python do Supabase** no código; MCP e SDK são independentes.

### Passo a passo (MCP Supabase no Cursor)

1. **Criar projeto no Supabase**
   - [supabase.com](https://supabase.com) → New project.
   - Anote: **Project URL** e **API Keys** (anon + service_role).

2. **Obter URL e chaves**
   - Settings → API: **Project URL** = `SUPABASE_URL`.
   - **anon public** = uso em frontend/anon.
   - **service_role** = uso em backend (bot); não exponha em frontend.

3. **Configurar MCP no Cursor**
   - Cursor Settings → Features → MCP (ou `.cursor/mcp.json`).
   - Adicionar servidor MCP do Supabase (se existir extensão/adaptador Supabase para MCP).
   - Ou usar MCP genérico de “database” apontando para a connection string do Supabase (Postgres).
   - Nos parâmetros, usar **Project URL** e **service_role** (ou anon, conforme doc do adaptador).

4. **Para que o MCP serve (dev/debug/schema)**
   - Listar tabelas e colunas.
   - Rodar `SELECT` para inspecionar `bot_state`.
   - Debugar dados sem abrir o dashboard.
   - Não substitui o SDK no bot; o bot continua usando `supabase` no Python.

5. **Diferença MCP (dev) x SDK no bot (runtime)**
   - **MCP**: ferramenta do editor (Cursor) para você consultar/explorar o banco enquanto desenvolve.
   - **SDK no bot**: `from supabase import create_client` em `storage/supabase_storage.py`; o processo do bot usa isso para `get_*`/`save_*` em produção ou na VPS.

---

## Resumo

| Aspecto            | Local                    | Online                |
|--------------------|--------------------------|------------------------|
| Persistência       | JSON no disco            | Supabase (bot_state)  |
| Escolha            | `BOT_STORAGE=local` ou `run_local.py` | `BOT_STORAGE=supabase` ou `run_online.py` |
| Config             | `bot_config.json`        | linha `config` em bot_state |
| Logs / PID         | Sempre locais            | Sempre locais         |
| Lógica de trading  | Idêntica em ambos        | Idêntica em ambos     |

Nenhuma lógica de entrada, stop, TP ou 2ª/3ª entrada foi alterada; apenas o **onde** o estado é lido/escrito (interface de storage).

---

## Dashboard

O `dashboard.py` continua lendo os arquivos JSON locais (`bot_tracker.json`, etc.). Em modo **local**, os dados estão sempre alinhados. Em modo **online** (Supabase), o bot grava só no Supabase; os JSONs locais não são atualizados, então o dashboard mostrará dados desatualizados ou vazios. Para exibir o estado do bot online no dashboard, seria necessário no futuro fazer o dashboard usar a mesma interface de storage (por exemplo, SupabaseStorage) quando configurado para modo online.
