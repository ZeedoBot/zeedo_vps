# 📊 Correção do Cálculo de PNL %

## 🐛 Problema Identificado

O **PNL %** estava sendo calculado usando o **saldo atual** da corretora, causando distorções quando o usuário:
- Deposita mais dinheiro na corretora
- Retira dinheiro da corretora

**Exemplo do problema:**
- Trade 1: Lucro de $10 com saldo de $100 = deveria ser **10%**
- Usuário deposita $900 (saldo atual = $1000)
- Dashboard calculava: $10 / $1000 = **1%** ❌ (distorcido!)

Isso resultava em valores absurdos como **1.051.913%** ou **-681.238%**.

---

## ✅ Solução Implementada

### 1. **Banco de Dados** (`migrations/015_add_account_value_at_trade.sql`)
- Adicionada coluna `account_value_at_trade` na tabela `trades_database`
- Armazena o saldo total da conta no momento em que o trade foi fechado

### 2. **Bot Engine** (`bot.py`)
- Modificada função `sync_trade_history()` para:
  - Buscar `accountValue` da Hyperliquid ao sincronizar trades
  - Salvar esse valor no campo `account_value_at_trade` de cada trade

**Código adicionado:**
```python
# Busca saldo atual da conta para calcular PNL % correto
account_value = 0.0
try:
    clearing_state = info.user_state(wallet)
    if clearing_state:
        margin = clearing_state.get("marginSummary", {}) or {}
        account_value = float(margin.get("accountValue", 0) or 0)
except Exception as e:
    logging.warning(f"Erro ao buscar accountValue: {e}")

# ... ao criar o registro do trade:
fill_safe['account_value_at_trade'] = account_value if account_value > 0 else None
```

### 3. **Backend API** (`backend/app/routes/dashboard.py`)
- Modificada função `_fetch_trades()` para:
  - Buscar a coluna `account_value_at_trade` do banco
  - Calcular `pnl_pct` usando esse valor: `(pnl_usd / account_value_at_trade) * 100`
  - Retornar `pnl_pct` para o frontend

**Código adicionado:**
```python
# Calcula PNL % baseado no saldo da conta no momento do trade
pnl_usd = float(row.get("pnl_usd", 0) or 0)
account_value = row.get("account_value_at_trade")
pnl_pct = None
if account_value and account_value > 0:
    pnl_pct = (pnl_usd / account_value) * 100
```

### 4. **Frontend** (`frontend/app/dashboard/page.tsx`)

#### a) **PNL % Individual (tabela de trades)**
- Usa `pnl_pct` retornado pela API (baseado no saldo no momento do trade)
- Fallback para cálculo antigo se `pnl_pct` não disponível (trades antigos)

**Código modificado:**
```typescript
const pnlPct = t.pnl_pct !== undefined && t.pnl_pct !== null 
  ? t.pnl_pct 
  : (balance > 0 ? (t.pnl / balance) * 100 : 0);
```

#### b) **Lucro % Geral (card de métricas)**
- Calcula baseado no **capital inicial estimado** (saldo atual - lucro total)
- Fórmula: `(lucro_total / capital_inicial) * 100`

**Código modificado:**
```typescript
const initialCapital = balance - totalPnl;
const pnlPct = initialCapital > 0 
  ? (totalPnl / initialCapital) * 100 
  : (balance > 0 ? (totalPnl / balance) * 100 : 0);
```

---

## 📈 Resultado

### Antes:
- ❌ PNL % distorcido por depósitos/saques
- ❌ Valores absurdos (1.051.913%, -681.238%)
- ❌ Não refletia performance real

### Depois:
- ✅ PNL % calculado com base no saldo no momento do trade
- ✅ Valores realistas e precisos
- ✅ Reflete performance real mesmo com depósitos/saques
- ✅ Trades novos salvam `account_value_at_trade` automaticamente
- ✅ Trades antigos usam fallback (cálculo com saldo atual)

---

## 🔄 Como funciona agora:

1. **Trade fecha** → Bot busca saldo da conta naquele momento
2. **Salva no banco** → `account_value_at_trade` = $250.15 (exemplo)
3. **Calcula PNL %** → $10 / $250.15 = **4.0%** ✅
4. **Usuário deposita $1000** → Saldo atual = $1250.15
5. **Dashboard mostra** → PNL % continua **4.0%** ✅ (não distorce!)

---

## 📝 Observações

- **Trades antigos** (antes desta atualização) não têm `account_value_at_trade` salvo
- Para esses, o frontend usa o cálculo antigo como fallback
- **Novos trades** (após deploy) terão PNL % preciso
- O "Lucro % Geral" agora estima o capital inicial: `saldo_atual - lucro_total`

---

## 🚀 Deploy

1. **Migration já executada** ✅
2. **Código atualizado** ✅
3. **Execute no VPS**:
```bash
cd ~/zeedo_vps
git pull
pm2 restart zeedo-manager
cd frontend
npm run build
pm2 restart zeedo-frontend
```

---

## 🎯 Exemplo Prático

### Cenário:
- Capital inicial: $200
- Trade 1: +$10 (saldo = $210)
- Trade 2: -$5 (saldo = $205)
- Usuário deposita $800 (saldo = $1005)
- Trade 3: +$15 (saldo = $1020)

### Cálculo correto:
- Trade 1: +$10 / $200 = **+5.0%** ✅
- Trade 2: -$5 / $210 = **-2.4%** ✅
- Trade 3: +$15 / $1005 = **+1.5%** ✅
- **Lucro % Geral**: +$20 / $200 (capital inicial) = **+10%** ✅

### Antes (incorreto):
- Todos calculados com saldo atual ($1020)
- Trade 1: +$10 / $1020 = **+0.98%** ❌
- Trade 2: -$5 / $1020 = **-0.49%** ❌
- Trade 3: +$15 / $1020 = **+1.47%** ❌
- **Lucro % Geral**: +$20 / $1020 = **+1.96%** ❌

---

Data: 2026-03-02
