# Configuração Stripe - Zeedo

Este guia descreve os passos que **você precisa fazer manualmente** no Stripe e no servidor.

---

## O que já está configurado

- ✅ Chaves de API no `.env` (raiz) e `frontend/.env.local`
- ✅ Backend: rota `POST /stripe/create-checkout-session` e `POST /stripe/webhook`
- ✅ Frontend: página `/choose-plan` redireciona para o Stripe Checkout
- ✅ Migration `007_stripe_columns.sql` para `stripe_customer_id` e `stripe_subscription_id` na tabela `users`

---

## Passos manuais obrigatórios

### 1. Rodar a migration

Execute no Supabase (SQL Editor) ou via seu script de migração:

```sql
-- Conteúdo de migrations/007_stripe_columns.sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='stripe_customer_id') THEN
    ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='stripe_subscription_id') THEN
    ALTER TABLE users ADD COLUMN stripe_subscription_id VARCHAR(255);
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
```

---

### 2. Criar produtos e preços no Stripe

1. Acesse [Dashboard Stripe](https://dashboard.stripe.com) → **Produtos** → **Adicionar produto**
2. Crie 3 produtos com preços recorrentes mensais:

| Produto | Preço mensal | Price ID (copiar depois) |
|---------|--------------|--------------------------|
| Zeedo Basic | R$ 49,00/mês | `price_xxx` |
| Zeedo Pro | R$ 79,00/mês | `price_xxx` |
| Zeedo Satoshi | R$ 199,00/mês | `price_xxx` |

3. Para cada produto: **Adicionar preço** → Tipo **Recorrente** → Frequência **Mensal** → Valor em BRL
4. Copie o **Price ID** de cada um (começa com `price_`)

---

### 3. Adicionar Price IDs no .env

Edite o arquivo `.env` na **raiz do projeto** e preencha:

```
STRIPE_PRICE_BASIC=price_xxxxxxxxxxxxx
STRIPE_PRICE_PRO=price_xxxxxxxxxxxxx
STRIPE_PRICE_SATOSHI=price_xxxxxxxxxxxxx
```

Reinicie o backend após alterar.

---

### 4. Configurar o webhook no Stripe

1. No Stripe: **Desenvolvedores** → **Webhooks** → **Adicionar endpoint**
2. **URL do endpoint:** `https://SEU-DOMINIO-BACKEND/stripe/webhook`  
   - Exemplo: `https://zeedo.ia.br/api/stripe/webhook` (se o backend estiver em `/api`)
   - Ou `https://api.zeedo.ia.br/stripe/webhook` (se usar subdomínio)
3. **Eventos a escutar:**
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Clique em **Adicionar endpoint**
5. Na tela do webhook, clique em **Revelar** no "Signing secret" e copie o valor (`whsec_...`)

---

### 5. Adicionar o Webhook Secret no .env

No `.env` na raiz:

```
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx
```

Reinicie o backend.

---

### 6. Instalar dependência Stripe no backend

```bash
pip install stripe
```

Ou, se usar `requirements.txt`:

```bash
pip install -r backend/requirements.txt
```

---

## Resumo de variáveis

| Variável | Onde | Exemplo |
|----------|------|---------|
| `STRIPE_SECRET_KEY` | `.env` (raiz) | `sk_live_...` ✅ |
| `STRIPE_WEBHOOK_SECRET` | `.env` (raiz) | `whsec_...` (você adiciona) |
| `STRIPE_PRICE_BASIC` | `.env` (raiz) | `price_...` (você adiciona) |
| `STRIPE_PRICE_PRO` | `.env` (raiz) | `price_...` (você adiciona) |
| `STRIPE_PRICE_SATOSHI` | `.env` (raiz) | `price_...` (você adiciona) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `frontend/.env.local` | `pk_live_...` ✅ |

---

## Fluxo de pagamento

1. Usuário em `/choose-plan` clica em um plano
2. Frontend chama `POST /stripe/create-checkout-session` com `plan`, `success_url`, `cancel_url`
3. Backend cria sessão Stripe e retorna `url`
4. Frontend redireciona para o Stripe Checkout
5. Usuário paga no Stripe
6. Stripe redireciona para `success_url` e envia evento `checkout.session.completed` ao webhook
7. Webhook atualiza `users.subscription_tier`, `subscription_status`, `stripe_subscription_id`

---

## Segurança

- **Nunca** commite o `.env` ou `.env.local` no Git (já estão no `.gitignore`)
- A chave ** secreta** (`sk_live_`) fica apenas no backend
- A chave **pública** (`pk_live_`) pode ser usada no frontend
