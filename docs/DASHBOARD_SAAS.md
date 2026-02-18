# Dashboard Web SaaS – Estrutura, Fluxos e Segurança

Documento de referência para o dashboard (frontend Next.js + API FastAPI): organização, banco, autenticação, conexão da carteira e boas práticas de segurança.

---

## Estrutura recomendada (frontend + backend)

```
Bot - Mainnet (V1)/
├── backend/                    # API FastAPI
│   ├── app/
│   │   ├── main.py             # App + CORS + routers
│   │   ├── config.py           # Settings (env)
│   │   ├── dependencies.py     # get_current_user_id (JWT)
│   │   ├── routes/
│   │   │   ├── auth.py         # GET /auth/me, /auth/health
│   │   │   ├── wallet.py       # POST /wallet/prepare-agent, connect-agent; GET /wallet/status
│   │   │   ├── telegram.py     # POST/GET /telegram/connect, /telegram/status
│   │   │   └── bot.py          # GET/PUT /bot/config, GET /bot/status
│   │   └── services/
│   │       ├── supabase_client.py
│   │       └── wallet_service.py  # Criptografia (usa auth/encryption)
│   └── requirements.txt
│
├── frontend/                   # Next.js 14 (App Router)
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx            # Landing (Entrar / Criar conta)
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── dashboard/
│   │       ├── layout.tsx      # Layout protegido (logout, nav)
│   │       ├── page.tsx        # Visão geral
│   │       ├── wallet/page.tsx
│   │       ├── telegram/page.tsx
│   │       └── bot/page.tsx
│   ├── lib/
│   │   ├── supabase.ts         # Cliente Supabase (auth)
│   │   └── api.ts              # apiGet, apiPost, apiPut (token no header)
│   ├── .env.example
│   └── package.json
│
├── migrations/
│   └── 003_dashboard_auth_and_plans.sql   # Sync auth.users → users, subscriptions, plan_limits
└── auth/
    └── encryption.py           # Criptografia da chave da API Wallet (agent)
```

---

## SQL das tabelas (resumo)

- **users**: já existe em `001`; id, email, subscription_status, subscription_tier. Sincronizado com `auth.users` via trigger em `003`.
- **trading_accounts**: user_id, wallet_address (master), encrypted_private_key (chave do agent), encryption_salt, network, is_active.
- **telegram_configs**: já existe; user_id, bot_token, chat_id (e opcionais). View **telegram_connections** em `003` (apenas indicadores has_bot_token, has_chat_id).
- **bot_config**, **instance_status**: já existem.
- **003** adiciona: trigger `on_auth_user_created` (auth.users → public.users), tabelas **subscriptions** e **plan_limits**, view **telegram_connections**.

Executar no Supabase, em ordem: `001` → `002` → `003`.

---

## Fluxo completo de autenticação

1. **Cadastro**
   - Usuário acessa `/signup`, preenche e-mail e senha.
   - Frontend chama `supabase.auth.signUp({ email, password })`.
   - Supabase cria registro em `auth.users` e envia e-mail de confirmação (se habilitado).
   - Trigger `handle_new_user` insere em `public.users` (id = auth.uid(), email).

2. **Login**
   - Usuário acessa `/login`, preenche e-mail e senha.
   - Frontend chama `supabase.auth.signInWithPassword({ email, password })`.
   - Supabase retorna sessão (access_token, refresh_token). O cliente guarda no localStorage (padrão).

3. **Sessão autenticada**
   - Em rotas `/dashboard/*`, o layout chama `supabase.auth.getSession()`; se não houver sessão, redireciona para `/login`.
   - Todas as chamadas à API do backend enviam `Authorization: Bearer <access_token>`.
   - Backend valida o JWT com `SUPABASE_JWT_SECRET` e extrai `sub` (user_id).

4. **Logout**
   - Botão "Sair" chama `supabase.auth.signOut()` e redireciona para `/login`.

**Estrutura para “comprar” e enviar login por e-mail (futuro):**  
Fluxo alternativo: formulário “Solicitar acesso” com e-mail → backend (ou Edge Function) cria usuário com `supabase.auth.admin.createUser()` com senha temporária e envia e-mail (SendGrid, Resend, etc.) com link de login e instruções. Tabelas `subscriptions` e `plan_limits` já estão em `003` para amarrar plano e limites depois.

---

## Fluxo de conexão da carteira (Hyperliquid – API Wallet)

1. Usuário acessa **Dashboard → Carteira** e clica em **Conectar com Rabby / MetaMask**.
2. Frontend chama `POST /wallet/prepare-agent` → backend gera agent, retorna `agent_address`, `nonce` e `typed_data` (EIP-712).
3. Usuário assina a mensagem com sua carteira (`eth_signTypedData_v4`). Frontend envia `POST /wallet/connect-agent` com `master_address`, `agent_address`, `signature_*`, `nonce`.
4. Backend submete `approveAgent` à Hyperliquid, criptografa e grava a chave do agent em `trading_accounts`. O agent não tem permissão de saque.
5. `GET /wallet/status`: retorna `connected`, `wallet_address` (mascarado) e `network`.

---

## Boas práticas de segurança

- **Chave da API Wallet (agent)**
  - Criptografada no backend com `ENCRYPTION_MASTER_KEY` + salt por usuário antes de persistir.
  - Nunca logada; nunca enviada em resposta da API; nunca exposta no frontend. O agent não possui permissão de saque.
- **API**
  - Todas as rotas de dados protegidas por `Depends(get_current_user_id)`; uso de `user_id` do token em todas as operações.
  - Backend usa **SUPABASE_SERVICE_KEY** para escrita no Supabase; frontend usa apenas **ANON_KEY** para auth.
- **Supabase**
  - RLS habilitado (migration `002`); políticas por `auth.uid()`. Service role ignora RLS para operações server-side.
- **Frontend**
  - Token só enviado em requisições à API; não colocar em query string.
  - HTTPS em produção; em desenvolvimento, CORS da API restrito a origem do frontend (ex.: `http://localhost:3000`).
- **Env**
  - `ENCRYPTION_MASTER_KEY` e `SUPABASE_JWT_SECRET` apenas no backend; nunca em variáveis `NEXT_PUBLIC_*`.

---

## Como rodar (desenvolvimento)

1. **Supabase**: aplicar migrations `001`, `002`, `003`. Habilitar Auth (Email).
2. **Backend** (na raiz do projeto):  
   `pip install -r backend/requirements.txt`  
   Configurar `.env` em `backend/` (ou na raiz) com `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_JWT_SECRET`, `ENCRYPTION_MASTER_KEY`.  
   `uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000`  
   (Ou de dentro de `backend/`: `PYTHONPATH=.. uvicorn app.main:app --reload --port 8000`.)
3. **Frontend**:  
   `cd frontend && npm install && cp .env.example .env.local`  
   Preencher `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL=http://localhost:8000`.  
   `npm run dev` → http://localhost:3000.
4. **Manager** (para o bot reagir a config): na raiz, `python manager.py` (com mesmo `.env` do bot/Supabase).

Documentação geral do projeto: [PROJECT_STATUS_AND_SETUP.md](../PROJECT_STATUS_AND_SETUP.md).
