# Zeedo Bot – Status do Projeto e Setup

Documento único de referência: estado atual, estrutura, como rodar e serviços.

---

## Checklist do que já foi feito

- [x] Storage abstraído (local JSON e Supabase)
- [x] Entrypoints: `run_local.py`, `run_online.py`, `manager.py`
- [x] Estrutura SaaS multiusuário: `auth/`, `engine/`, `instance/`, `manager/`, `utils/`
- [x] Criptografia de chaves privadas (`auth/encryption.py`)
- [x] Storage multiusuário com `user_id` (`UserStorage`, Supabase com `user_id`)
- [x] InstanceManager: inicia/para/reinicia instâncias por usuário
- [x] Migrations SQL: `users`, `trading_accounts`, `telegram_configs`, `instance_status`, alterações em `bot_config`, `bot_tracker`, `bot_history`, `trades_database`
- [x] Script de migração: `scripts/migrate_to_multiuser.py`
- [x] Logging por usuário: `logs/user_{user_id}.log`
- [x] Telegram por usuário (`utils/telegram.py`)
- [x] MCP e validação Supabase: `mcp/`, `scripts/validate_supabase.py`, `scripts/run_checks.py`
- [ ] BotEngine totalmente extraído de `bot.py` (hoje usa patches globais)
- [x] **Dashboard Web SaaS**: frontend Next.js + API FastAPI (login, carteira, Telegram, controle do bot)
- [ ] Dashboard Streamlit em modo online (hoje só JSON local)

---

## Estrutura atual do projeto

```
Bot - Mainnet (V1)/
├── bot.py                    # Core: lógica de trading + loop principal
├── run_local.py              # Entrypoint: bot local (JSON)
├── run_online.py             # Entrypoint: bot online (Supabase, single-user)
├── manager.py                # Entrypoint: SaaS multiusuário (InstanceManager)
├── dashboard.py              # Dashboard Streamlit (lê JSONs locais)
├── telegram_bot.py           # Bot Telegram (comandos /start, links)
│
├── backend/                  # API do dashboard SaaS (FastAPI)
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── dependencies.py   # JWT → user_id
│   │   ├── routes/          # auth, wallet, telegram, bot
│   │   └── services/
│   └── requirements.txt
├── frontend/                 # Dashboard Web (Next.js 14)
│   ├── app/                  # login, signup, dashboard/* (wallet, telegram, bot)
│   ├── lib/                  # supabase, api
│   └── package.json
│
├── auth/                     # Criptografia (SaaS)
│   ├── __init__.py
│   └── encryption.py
├── engine/
│   ├── __init__.py
│   └── config.py             # BotConfig dataclass
├── instance/
│   ├── __init__.py
│   └── bot_instance.py       # Uma instância do bot por user_id
├── manager/
│   ├── __init__.py
│   └── instance_manager.py   # Gerencia processos por usuário
├── storage/
│   ├── __init__.py           # get_storage(), LocalStorage, SupabaseStorage
│   ├── base.py
│   ├── local_storage.py
│   ├── supabase_storage.py
│   └── user_storage.py       # Wrapper com user_id
├── utils/
│   ├── __init__.py
│   ├── telegram.py           # Telegram por usuário
│   └── logging.py            # Logs por user_id
├── mcp/
│   ├── __init__.py
│   ├── supabase_reader.py
│   └── validator.py          # Servidor MCP (Cursor)
├── migrations/
│   ├── 001_create_multiuser_tables.sql
│   ├── 002_enable_rls_policies.sql
│   └── 003_dashboard_auth_and_plans.sql   # Sync auth.users, subscriptions, plan_limits
├── scripts/
│   ├── migrate_to_multiuser.py
│   ├── validate_supabase.py
│   ├── run_checks.py
│   ├── setup_vps.sh
│   └── deploy_vps.sh
├── zeedo_pro/
│   └── dashboard_pro.py
├── docs/
│   ├── README.md
│   └── DASHBOARD_SAAS.md     # Fluxos e segurança do dashboard web
│
├── requirements.txt
├── .env                       # Não versionar
├── bot_config.json            # Modo local
├── bot_tracker.json
├── bot_history.json
├── trades_database.json
└── logs/                      # user_{user_id}.log quando roda manager
```

---

## Como rodar

### Local (persistência em JSON)

- Na raiz do projeto:
  - `python run_local.py`  
  ou  
  - `BOT_STORAGE=local python bot.py`
- Estado em: `bot_tracker.json`, `bot_history.json`, `trades_database.json`, `bot_config.json`.

### Online – single user (Supabase, sem manager)

- `.env`: `BOT_STORAGE=supabase`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (ou `SUPABASE_KEY`).
- Na raiz: `python run_online.py` (ou `BOT_STORAGE=supabase python bot.py`).
- Estado no Supabase (tabelas usadas pelo storage atual).

### Online – multiusuário (SaaS no VPS)

1. **Supabase**: executar migrations em ordem (`001_...`, depois `002_...` se usar RLS).
2. **Variáveis de ambiente** (ex.: no VPS, no `.env`):
   - `BOT_STORAGE=supabase`
   - `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
   - `ENCRYPTION_MASTER_KEY` (gerar com `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`)
3. **Migração** (uma vez): `python scripts/migrate_to_multiuser.py` (opcional `--email seu@email.com`).
4. **Configurar usuário** (ex.: no SQL Editor do Supabase):
   - Tabela: `bot_config` (não `bot_configs`).
   - Exemplo: definir `symbols`, `timeframes`, `trade_mode`, `bot_enabled = true` para o `user_id` desejado.
5. **Subir o manager**: na raiz do projeto, `python manager.py`.
   - O manager consulta a cada 30s quem tem `bot_enabled = true` e inicia/para/reinicia processos por usuário.

Comandos úteis:

- Bot local: `python run_local.py`
- Bot online single: `python run_online.py`
- SaaS (multiusuário): `python manager.py`
- **API do dashboard**: `uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000` (na raiz)
- **Dashboard Web**: `cd frontend && npm run dev` (requer backend rodando e Supabase Auth)
- Sanity checks: `python scripts/run_checks.py`
- Validação Supabase: `python scripts/validate_supabase.py`
- Dashboard Streamlit: `streamlit run dashboard.py`

Detalhes do dashboard web (auth, carteira, Telegram, segurança): **docs/DASHBOARD_SAAS.md**.

---

## Reinício automático por usuário após mudança de config

- O **InstanceManager** (`manager/instance_manager.py`) roda em loop a cada `check_interval` (30s).
- A cada ciclo:
  - Lê usuários com `bot_enabled = true` na tabela `bot_config`.
  - Para cada usuário:
    - Se `bot_enabled` e ainda não há processo → inicia instância.
    - Se já há processo e a config mudou (ex.: `symbols`, `timeframes`, `trade_mode`, `bot_enabled`) → **reinicia** a instância desse usuário.
    - Se `bot_enabled = false` e há processo → para a instância.
- Reinício = parar processo do usuário + pequeno delay + iniciar novo processo.
- Não é necessário reiniciar o manager manualmente: basta alterar `bot_config` no Supabase; em até ~30s a instância daquele usuário será reiniciada com a nova config.

---

## Dependências

- **requirements.txt** (principais):  
  `numpy`, `pandas`, `python-dotenv`, `eth-account`, `requests`, `supabase>=2.0.0`, `cryptography>=41.0.0`

Para dashboard e ambiente completo no VPS costumam ser usados também:  
`streamlit`, `hyperliquid-python-sdk`, `psutil` (instalar se o script/setup do VPS exigir).

Instalação:

```bash
pip install -r requirements.txt
```

---

## Serviços ativos (VPS)

No VPS, o projeto pode ser rodado com systemd. O script `scripts/setup_vps.sh` cria serviços a partir do **diretório atual** (recomendado: clonar/colocar o projeto num path fixo, ex.: `~/Bot-Mainnet-V1` ou `~/zeedo-bot`).

- **zeedo-bot.service**: bot (single-user) ou, em modo SaaS, pode ser substituído pelo manager (veja abaixo).
- **zeedo-dashboard.service**: Streamlit (`streamlit run dashboard.py`).

Para **SaaS**, o serviço do bot deve iniciar o manager, não o `bot.py` direto:

- `ExecStart=.../venv/bin/python .../manager.py`  
e `WorkingDirectory` = raiz do projeto.

Comandos típicos:

```bash
sudo systemctl start zeedo-bot.service
sudo systemctl start zeedo-dashboard.service
sudo systemctl status zeedo-bot.service
sudo journalctl -u zeedo-bot.service -f
```

Se o `setup_vps.sh` tiver sido feito para `bot.py`, editar o unit do bot para usar `manager.py` quando for modo multiusuário.

---

## Variáveis de ambiente (.env)

| Variável | Uso |
|----------|-----|
| `BOT_STORAGE` | `local` ou `supabase` |
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_KEY` ou `SUPABASE_KEY` | Chave service (backend) |
| `ENCRYPTION_MASTER_KEY` | SaaS: criptografia de chaves privadas (gerar e guardar em seguro) |
| `SUPABASE_JWT_SECRET` | Backend dashboard: validar JWT (Supabase → Settings → API → JWT Secret) |
| `HYPER_PRIVATE_KEY` / `HYPER_ACCOUNT_ADDRESS` | Migração / single-user |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Migração / single-user |

**Frontend** (`.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL`.

Não versionar `.env` nem `.env.local`.

---

## Tabelas Supabase (multiusuário)

- **users** – usuários do sistema (sincronizado com auth.users pela migration 003)  
- **trading_accounts** – wallets e chave privada criptografada por usuário  
- **bot_config** – configuração do bot por usuário (symbols, timeframes, trade_mode, bot_enabled, etc.)  
- **telegram_configs** – Telegram por usuário (view **telegram_connections** em 003)  
- **instance_status** – status do processo por usuário (heartbeat, PID)  
- **subscriptions** / **plan_limits** – faturamento e limites por plano (003)  
- **bot_tracker**, **bot_history**, **trades_database** – com coluna `user_id` (preenchida pela migração e pelo bot).

Toda a documentação antiga fragmentada foi consolidada neste arquivo. Para **dashboard web** (login, carteira, Telegram, segurança): **docs/DASHBOARD_SAAS.md**.
