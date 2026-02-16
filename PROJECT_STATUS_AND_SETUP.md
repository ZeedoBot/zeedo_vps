# Zeedo Bot – Status do Projeto e Setup

Documento único de referência: estado atual, estrutura, como rodar e serviços.

---

## Análise de conectividade (após alterações recentes)

### Fluxo SaaS (Dashboard Web + Manager)

| Etapa | Componente | Conexão |
|-------|------------|---------|
| 1 | Usuário acessa zeedo.ia.br | Frontend Next.js (proxy nginx) |
| 2 | Login → Supabase Auth | JWT gerado |
| 3 | Dashboard: Carteira | API `POST /wallet/connect` → `trading_accounts` (chave criptografada com ENCRYPTION_MASTER_KEY) |
| 4 | Dashboard: Telegram | Link "Conectar" → Telegram /start com payload → Webhook `POST /webhooks/telegram` salva `chat_id` em `telegram_configs` e envia mensagem Zeedo ON + links |
| 5 | Dashboard: Ligar Bot | API `PUT /bot/config` → `bot_config.bot_enabled = true` |
| 6 | Manager (zeedo-manager) | A cada 30s, lê `bot_config` onde `bot_enabled = true` |
| 7 | Manager inicia BotInstance | Processo por `user_id` |
| 8 | BotInstance | Carrega config + credenciais (Supabase) → BotConfig → BotEngine |
| 9 | BotEngine | Injeta config em `bot.run_main_loop()` e executa loop de trading |
| 10 | instance_status | Manager atualiza `status = running` e heartbeats |

### Fluxo Local / Online (single-user)

- `run_local.py` / `run_online.py` → `bot.main()` → `run_main_loop()` (usa .env + JSON ou Supabase sem `user_id`)

### Fluxo Telegram

- **Webhook**: `https://zeedo.ia.br/api/webhooks/telegram` (registrar com `python scripts/set_telegram_webhook.py` ou curl)
- Comandos do bot (Zeedo ON, links) vêm do webhook; não existe mais `telegram_bot.py` standalone.

**Resultado**: Tudo conectado e funcionando após as alterações.

---

## Checklist do que já foi feito

- [x] Storage abstraído (local JSON e Supabase)
- [x] Entrypoints: `run_local.py`, `run_online.py`, `manager.py`
- [x] Estrutura SaaS multiusuário: `auth/`, `engine/`, `instance/`, `manager/`, `utils/`
- [x] Criptografia de chaves privadas (`auth/encryption.py`) — ENCRYPTION_MASTER_KEY no .env
- [x] Storage multiusuário com `user_id` (`UserStorage`, Supabase com `user_id`)
- [x] InstanceManager: inicia/para/reinicia instâncias por usuário
- [x] Migrations SQL: `users`, `trading_accounts`, `telegram_configs`, `instance_status`, `bot_config`, `bot_tracker`, `bot_history`, `trades_database`, `plan_limits`
- [x] Script de migração: `scripts/migrate_to_multiuser.py`
- [x] Logging por usuário: `logs/user_{user_id}.log`
- [x] Telegram por usuário (`utils/telegram.py`)
- [x] Webhook Telegram: `backend/app/routes/webhooks.py` — /start salva chat_id e envia Zeedo ON + links (Comunidade, TikTok)
- [x] BotEngine extraído: `engine/bot_engine.py` — config/storage/tg_send por injeção; `instance` usa BotEngine (sem patches globais); `run_local`/`run_online` usam `bot.main()`
- [x] Dashboard Web SaaS: frontend Next.js + API FastAPI (login, carteira, Telegram, controle do bot)
- [x] Carteira: conexão Web3 (Rabby/MetaMask) + manual; link "Não tem carteira? Crie agora" → Rabby
- [x] PM2: `zeedo-backend` (API) + `zeedo-manager` (InstanceManager)

---

## Estrutura atual do projeto

```
Bot - Mainnet (V1)/
├── bot.py                    # Core: lógica de trading + run_main_loop (chamado por main ou BotEngine)
├── run_local.py              # Entrypoint: bot local (JSON)
├── run_online.py             # Entrypoint: bot online (Supabase, single-user)
├── manager.py                # Entrypoint: SaaS multiusuário (InstanceManager)
├── dashboard.py              # Dashboard Streamlit (lê JSONs locais)
├── ecosystem.config.js       # PM2: zeedo-backend + zeedo-manager
│
├── backend/                  # API do dashboard SaaS (FastAPI)
│   ├── app/
│   │   ├── main.py           # Inclui routes: auth, wallet, telegram, bot, plans, webhooks
│   │   ├── config.py
│   │   ├── dependencies.py   # JWT → user_id
│   │   ├── routes/           # auth, wallet, telegram, bot, plans, webhooks
│   │   └── services/
│   └── requirements.txt
├── frontend/                 # Dashboard Web (Next.js 14)
│   ├── app/                  # login, signup, choose-plan, dashboard/* (wallet, telegram, bot)
│   ├── lib/                  # supabase, api
│   └── package.json
│
├── auth/
│   ├── __init__.py
│   └── encryption.py         # Criptografia de chaves (ENCRYPTION_MASTER_KEY)
├── engine/
│   ├── __init__.py           # BotConfig, BotEngine
│   ├── config.py             # BotConfig dataclass
│   └── bot_engine.py         # BotEngine: injeção de dependências, chama bot.run_main_loop
├── instance/
│   ├── __init__.py
│   └── bot_instance.py       # Uma instância do bot por user_id → BotEngine
├── manager/
│   ├── __init__.py
│   └── instance_manager.py   # Gerencia processos por usuário (BotInstance)
├── storage/
│   ├── __init__.py           # get_storage(), LocalStorage, SupabaseStorage
│   ├── base.py
│   ├── local_storage.py
│   ├── supabase_storage.py
│   └── user_storage.py       # Wrapper com user_id
├── utils/
│   ├── __init__.py
│   ├── telegram.py           # TelegramClient por usuário
│   └── logging.py            # Logs por user_id
├── mcp/
│   ├── __init__.py
│   ├── supabase_reader.py
│   └── validator.py
├── migrations/
│   ├── 001_create_multiuser_tables.sql
│   ├── 002_enable_rls_policies.sql
│   └── 003_dashboard_auth_and_plans.sql
├── scripts/
│   ├── set_telegram_webhook.py  # Registrar webhook no Telegram
│   ├── migrate_to_multiuser.py
│   ├── validate_supabase.py
│   ├── run_checks.py
│   ├── setup_vps.sh
│   └── deploy_vps.sh
├── zeedo_pro/
│   └── dashboard_pro.py
├── docs/
│   ├── README.md
│   └── DASHBOARD_SAAS.md
│
├── requirements.txt
├── .env                       # Não versionar
├── bot_config.json            # Modo local
├── bot_tracker.json
├── bot_history.json
├── trades_database.json
└── logs/                      # user_{user_id}.log quando roda manager
```

**Nota**: `telegram_bot.py` foi removido. O Telegram é tratado via webhook em `backend/app/routes/webhooks.py`.

---

## Como rodar

### Local (persistência em JSON)

- Na raiz: `python run_local.py` ou `BOT_STORAGE=local python bot.py`
- Estado em: `bot_tracker.json`, `bot_history.json`, `trades_database.json`, `bot_config.json`.

### Online – single user (Supabase, sem manager)

- `.env`: `BOT_STORAGE=supabase`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- Na raiz: `python run_online.py`

### Online – multiusuário (SaaS no VPS)

1. **Supabase**: executar migrations em ordem.
2. **Variáveis de ambiente** (`.env` no VPS):
   - `BOT_STORAGE=supabase`
   - `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
   - `ENCRYPTION_MASTER_KEY`
   - `TELEGRAM_BOT_TOKEN` (para webhook e notificações)
3. **Webhook Telegram**: `python scripts/set_telegram_webhook.py`
4. **PM2** (recomendado): `pm2 start ecosystem.config.js`
   - `zeedo-backend`: API FastAPI (porta 8000)
   - `zeedo-manager`: InstanceManager (inicia BotInstance por usuário com `bot_enabled = true`)

Comandos úteis:

- Bot local: `python run_local.py`
- Bot online single: `python run_online.py`
- SaaS: `pm2 start ecosystem.config.js` (ou `python manager.py`)
- API: `uvicorn backend.app.main:app --host 127.0.0.1 --port 8000`
- Frontend: `cd frontend && npm run dev`
- Webhook Telegram: `python scripts/set_telegram_webhook.py`
- Sanity: `python scripts/run_checks.py`

---

## Reinício automático por usuário

- O InstanceManager roda em loop a cada 30s.
- Lê `bot_config` onde `bot_enabled = true`.
- Inicia/para/reinicia processos (BotInstance) conforme mudanças.
- Não é necessário reiniciar o manager manualmente.

---

## Serviços no VPS (PM2)

O arquivo `ecosystem.config.js` define:

| App | Descrição |
|-----|-----------|
| zeedo-backend | API FastAPI (uvicorn) |
| zeedo-manager | InstanceManager (inicia instâncias do bot) |

```bash
pm2 start ecosystem.config.js
pm2 status
pm2 logs zeedo-manager
pm2 restart zeedo-backend
```

Ajuste `cwd` em `ecosystem.config.js` conforme o path do projeto no VPS (ex.: `/home/zeedo/zeedo_vps`).

---

## Variáveis de ambiente (.env)

| Variável | Uso |
|----------|-----|
| `BOT_STORAGE` | `local` ou `supabase` |
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_KEY` / `SUPABASE_KEY` | Chave service |
| `SUPABASE_JWT_SECRET` | Validação JWT (backend) |
| `ENCRYPTION_MASTER_KEY` | Criptografia de chaves privadas (sem colchetes) |
| `TELEGRAM_BOT_TOKEN` | Bot e webhook do Telegram |
| `HYPER_PRIVATE_KEY` / `HYPER_ACCOUNT_ADDRESS` | Modo local/single-user |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Modo local/single-user |

**Frontend** (`.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL`.

---

## Tabelas Supabase

- **users** – usuários (sync com auth.users)
- **trading_accounts** – carteiras e chave criptografada
- **bot_config** – symbols, timeframes, trade_mode, bot_enabled
- **telegram_configs** – chat_id por usuário
- **instance_status** – status (running/stopped), heartbeat
- **subscriptions** / **plan_limits** – planos e limites
- **bot_tracker**, **bot_history**, **trades_database** – com `user_id`

Detalhes do dashboard web: **docs/DASHBOARD_SAAS.md**.
