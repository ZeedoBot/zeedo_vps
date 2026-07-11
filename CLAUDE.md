# CLAUDE.md — Zeedo

Guia para assistentes de IA (e humanos) trabalharem neste repositório. Leia antes de editar.

Zeedo é um **bot de trading de perpétuos na Hyperliquid** com um SaaS multiusuário
(dashboard web + API + gerenciador de instâncias). A estratégia é baseada em
**divergências de RSI + padrões de candle (Binance) confirmados por setup na Hyperliquid**,
com alvos e stop em níveis de Fibonacci.

> ⚠️ **Isto executa ordens reais com dinheiro real na mainnet.** Qualquer alteração na
> lógica de sinal, gestão de risco, ordens ou sincronização de trades muda o comportamento
> financeiro. Trate mudanças em `bot.py`, `engine/`, `instance/` e `storage/` como críticas:
> prefira reportar e confirmar antes de alterar comportamento.

---

## Arquitetura

Dois modos de execução compartilham o mesmo core (`bot.py`):

### 1. Single-user (local / online)
```
run_local.py  → bot.main()  (BOT_STORAGE=local → JSON no disco)
run_online.py → bot.main()  (BOT_STORAGE=supabase, sem user_id)
```
`bot.main()` usa credenciais do `.env` (`HYPER_PRIVATE_KEY`) e as variáveis globais
de módulo em `bot.py` como configuração.

### 2. Multiusuário (SaaS, produção no VPS)
```
Frontend (Next.js) ──HTTP──> Backend (FastAPI, backend/app) ──> Supabase (Postgres + Auth)
                                                                     │
manager.py (PM2: zeedo-manager) ── lê bot_config (bot_enabled=true) ─┘
   └─ InstanceManager  (loop a cada 30s)
        └─ multiprocessing.Process por usuário
             └─ instance/bot_instance.py: BotInstance
                  ├─ carrega config (bot_config) + credenciais (trading_accounts, descriptografa)
                  ├─ UserStorage(user_id, SupabaseStorage)   # isola dados por usuário
                  ├─ TelegramClient(user_id)                 # notificações por usuário
                  └─ engine/bot_engine.py: BotEngine
                       └─ injeta config nas globals do módulo `bot` e chama bot.run_main_loop()
```

**Ponto-chave:** cada usuário roda em **processo separado** (`multiprocessing`). Por isso o
`BotEngine` pode sobrescrever variáveis globais de `bot.py` (`SYMBOLS`, `tg_send`, etc.) sem
colisão entre usuários — cada processo tem sua própria cópia do módulo.

### Fluxo do usuário (dashboard)
1. Login (Supabase Auth) → JWT.
2. Carteira: assina `approveAgent` (EIP-712) → backend gera **API Wallet (agent)** e guarda a
   chave **criptografada** (`trading_accounts`). O agent **opera mas não saca**.
3. Telegram: link `t.me/<bot>?start=z<base64(user_id)>` → webhook salva `chat_id`.
4. Liga o bot: `PUT /bot/config { bot_enabled: true }` → o `zeedo-manager` sobe a instância em ≤30s.

---

## Estrutura de diretórios

| Caminho | Papel |
|---|---|
| `bot.py` | **Core de trading**: sinal, gestão de risco, ordens, sync de histórico, `run_main_loop`. |
| `run_local.py` / `run_online.py` | Entrypoints single-user. |
| `manager.py` | Entrypoint SaaS (roda `InstanceManager`). |
| `dashboard.py` | Dashboard **Streamlit legado** (lê JSONs locais). Não faz parte do fluxo SaaS/PM2. |
| `engine/` | `config.py` (`BotConfig` dataclass) + `bot_engine.py` (injeção de dependências). |
| `instance/bot_instance.py` | Uma instância do bot por `user_id`. |
| `manager/instance_manager.py` | Sobe/para/reinicia processos por usuário; heartbeats. |
| `storage/` | `get_storage()`, `LocalStorage` (JSON), `SupabaseStorage`, `UserStorage` (wrapper com `user_id`). |
| `auth/encryption.py` | Criptografia Fernet das chaves privadas (PBKDF2 + `ENCRYPTION_MASTER_KEY`). |
| `utils/` | `telegram.py` (client por usuário), `logging.py`, `hyperliquid_balance.py`, `hyperliquid_symbols.py`. |
| `backend/app/` | API FastAPI. `routes/` + `services/` + `dependencies.py` (JWT→user_id) + `config.py` (Settings). |
| `frontend/` | Dashboard Next.js 14 (App Router). |
| `migrations/` | SQL do Supabase, numeradas. Aplicar em ordem. |
| `scripts/` | `set_telegram_webhook.py`, `migrate_to_multiuser.py`, `validate_supabase.py`, `run_checks.py`, `*.sh`. |
| `mcp/` | Leitor/validador Supabase (ferramentas auxiliares). |

---

## Como rodar

```bash
# Bot local (JSON)
python run_local.py                 # ou: BOT_STORAGE=local python bot.py

# Bot online single-user (Supabase, sem user_id)
python run_online.py

# SaaS (VPS)
pm2 start ecosystem.config.js       # zeedo-backend (uvicorn) + zeedo-manager
# ou manualmente:
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
python manager.py

# Frontend
cd frontend && npm run dev

# Webhook Telegram (uma vez após deploy)
python scripts/set_telegram_webhook.py

# Sanity check
python scripts/run_checks.py
```

O backend tem `root_path="/api"` → nginx faz proxy de `zeedo.ia.br/api` para o uvicorn na porta 8000.

---

## Variáveis de ambiente

`.env` na raiz (bot + manager) e `backend/.env.example` (mesmo `.env`):

| Variável | Uso |
|---|---|
| `BOT_STORAGE` | `local` ou `supabase`. `manager.py` força `supabase`. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | Acesso service-role (bypassa RLS — ver Segurança). |
| `SUPABASE_JWT_SECRET` | Validação de JWT HS256 (legacy) no backend. |
| `ENCRYPTION_MASTER_KEY` | Chave mestra da criptografia das private keys. **Perder = perder todas as carteiras.** |
| `TELEGRAM_BOT_TOKEN` | Bot do Telegram (webhook + notificações). |
| `TELEGRAM_WEBHOOK_SECRET` | *(opcional)* Se definido, o webhook exige o header secreto do Telegram. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_{BASIC,PRO,SATOSHI}` | Pagamentos. |
| `HYPER_PRIVATE_KEY`, `HYPER_ACCOUNT_ADDRESS` | Só modo local/single-user. |
| `TELEGRAM_CHAT_ID` | Só modo local/single-user. |

Frontend (`frontend/.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_POSTHOG_*`.

`.env` **não é versionado** (só os `.env.example`). Confirmado no `.gitignore`.

---

## Banco de dados (Supabase / Postgres)

Tabelas principais: `users` (sync com `auth.users`), `trading_accounts` (carteira + chave
criptografada), `bot_config`, `telegram_configs`, `instance_status`, `subscriptions`/`plan_limits`,
`blocked_trades`, e as de estado do bot com `user_id`: `bot_tracker`, `bot_history`, `trades_database`.

- Migrations em `migrations/NNN_*.sql`, aplicar em ordem numérica.
- **RLS** existe (migration 002), mas o **backend usa a service-role key**, que ignora RLS.
  Portanto **todo query no backend/storage precisa filtrar manualmente por `user_id`** (`.eq("user_id", ...)`).
  Isto é feito de forma consistente hoje — mantenha o padrão em qualquer código novo.

---

## Modelo da estratégia (visão geral)

`get_signal()` em `bot.py`:
1. Candles da **Binance** (`fetch_candles_binance`) para detecção; candles da **Hyperliquid** para o setup de preço.
2. Precisa de **divergência de RSI** (`check_divergence_at_index`) + **padrão** (`check_patterns`:
   HAMMER_BULL, SHOOTING_STAR, ENGULF_BULL/BEAR) + volume acima da média + extremo local.
3. Define `trigger` (entrada limit no nível `ENTRY1_MULTIPLIER` da fib), `stop_real` (`FIB_STOP_LEVEL`)
   e `tech_base` (setup_high − setup_low).

`manage_risk_and_scan()`: varre símbolos/timeframes, aplica bloqueios (Modo Sinal, LSR, símbolo já
ativo, limite de posições), dimensiona a ordem por `TARGET_LOSS_USD`/risco e coloca a entrada.
Sinais bloqueados viram `blocked_trades` + alerta no Telegram.

`auto_manage()`: cancela entradas pendentes que estouraram a fib 1.0, coloca stop de pânico e TPs
faltantes, move stop para break-even ao atingir o alvo 1, e detecta trades manuais.

`sync_trade_history()`: reconcilia fills da HL → `trades_database`, agrupando micro-fills por `oid`
e notificando parciais/stops/encerramento no Telegram.

**Planos:** `basic` = sempre Modo Sinal (sem execução automática). `pro`/`satoshi` = execução +
customização de alvos/stop. Preset `DEGEN` só libera 7 dias após criação da conta. Limites por
plano em `plan_limits` (validados em `backend/app/routes/bot.py`).

---

## Convenções e armadilhas (importante)

### Configuração: fonte única por tipo de parâmetro
- **Constantes de estratégia** (`LOOKBACK_DIVERGENCE`, `MIN_PIVOT_DIST`, `LOCAL_LOW_WINDOW`,
  `RSI_PERIOD`, `VOLUME_SMA_PERIOD`, `FALLBACK_STOP_PCT`, limiares `LSR_*`): **fonte única nas
  globals de `bot.py`**. O `BotEngine._config_to_overrides()` **não** as sobrescreve, então editar
  `bot.py` vale para os dois modos (single-user e SaaS).
- **Parâmetros por-usuário** (symbols, timeframes, trade_mode, signal_mode, target_loss, max_*,
  alvos, stop, entry1, strategy_preset): vêm do banco `bot_config` → `BotConfig` → overrides.

> Histórico: antes havia defaults duplicados em `bot.py` e `engine/config.py` que divergiram
> (bot.py=350/6/6 vs BotConfig=300/4/4), fazendo ajustes em `bot.py` não terem efeito em produção.
> Isso foi unificado: os campos duplicados foram removidos do `BotConfig`. **Não os recrie lá.**

### Storage
- `UserStorage` embrulha o backend e injeta `user_id`. Métodos como `expire_blocked_trades(all_mids)`
  têm assinatura diferente no `SupabaseStorage` (`expire_blocked_trades(user_id, all_mids, ...)`);
  **sempre acesse via `UserStorage`** no caminho SaaS. `LocalStorage` implementa esses métodos como no-op.
- `SupabaseStorage` mantém cache em memória de trades (janela de 48h) para reduzir egress.

### Telegram
- No SaaS, o `BotEngine` faz `bot_module.tg_send = self.tg_send` (client do usuário). Funções em
  `bot.py` chamam `tg_send(...)` global — resolvido em runtime, então usam a versão do usuário.
- Webhook (`backend/app/routes/webhooks.py`) roda **sem autenticação por padrão**. Defina
  `TELEGRAM_WEBHOOK_SECRET` (e rode `set_telegram_webhook.py`) para exigir o header secreto.

### Carteira
- `backend/app/routes/wallet.py` usa cache em memória (`_agent_pending`) entre `prepare-agent` e
  `connect-agent`. **Não rode o uvicorn com múltiplos workers** sem mover esse estado para fora do
  processo — senão a conexão de carteira quebra intermitentemente.

### Estado local (single-user)
`bot_tracker.json`, `bot_history.json`, `trades_database.json`, `bot_config.json` — gerados em
runtime e **ignorados no git**.

---

## Estilo de código
- Python, comentários em **português**. Sem framework de testes formal — validação via
  `scripts/run_checks.py` e execução real.
- Muitas funções têm tratamento defensivo (`try/except` amplo com log) porque lidam com APIs
  externas (Binance/Hyperliquid/Supabase/Telegram). Preserve isso ao refatorar.
- Faça `python -m py_compile <arquivo>` após editar (não há CI que pegue erros de sintaxe).

---

## O que NÃO fazer sem confirmar com o dono
- Alterar lógica de sinal, dimensionamento, stop/TP, break-even ou reconciliação de fills.
- Trocar parâmetros de estratégia (ver "Duas fontes de configuração").
- Mexer em criptografia (`auth/encryption.py`) ou no formato de `trading_accounts` — quebra chaves existentes.
- Rodar migrations destrutivas em produção.
