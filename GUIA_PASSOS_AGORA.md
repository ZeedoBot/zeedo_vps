# 🚀 GUIA PASSO A PASSO - O QUE FAZER AGORA

## ✅ Status Atual

A implementação do código está **95% completa**. O que falta são apenas:
- Testes em ambiente real
- Execução das migrations SQL
- Migração de dados existentes

## 📋 PRÓXIMOS PASSOS (EM ORDEM)

### PASSO 1: Executar Migration SQL no Supabase ⭐

**O que fazer**: Criar as tabelas novas e modificar as existentes no banco Supabase.

#### Opção A: Via Supabase Dashboard (RECOMENDADO - Mais Fácil)

1. **Acesse o Supabase Dashboard**:
   - Vá para: https://app.supabase.com
   - Faça login na sua conta
   - Selecione seu projeto

2. **Abra o SQL Editor**:
   - No menu lateral, clique em **"SQL Editor"**
   - Clique em **"New query"**

3. **Cole o conteúdo da migration**:
   - Abra o arquivo: `migrations/001_create_multiuser_tables.sql`
   - Copie TODO o conteúdo (Ctrl+A, Ctrl+C)
   - Cole no SQL Editor do Supabase (Ctrl+V)

4. **Execute a query**:
   - Clique no botão **"Run"** (ou pressione Ctrl+Enter)
   - Aguarde a execução (pode levar alguns segundos)
   - Verifique se apareceu "Success" ou mensagem de sucesso

5. **Verifique se as tabelas foram criadas**:
   - No menu lateral, clique em **"Table Editor"**
   - Você deve ver as novas tabelas:
     - `users`
     - `trading_accounts`
     - `telegram_configs`
     - `instance_status`
   - As tabelas existentes (`bot_config`, `bot_tracker`, etc.) devem ter a coluna `user_id` agora

#### Opção B: Via psql (Linha de Comando)

Se você tem acesso SSH ao servidor ou prefere usar linha de comando:

```bash
# 1. Instale psql se não tiver (Linux/Mac)
# Ubuntu/Debian: sudo apt-get install postgresql-client
# Mac: brew install postgresql

# 2. Execute a migration
psql "postgresql://postgres:[SUA-SENHA]@[SEU-HOST].supabase.co:5432/postgres" \
  -f migrations/001_create_multiuser_tables.sql

# OU usando variáveis de ambiente:
export PGHOST=[seu-host].supabase.co
export PGUSER=postgres
export PGPASSWORD=[sua-senha]
export PGDATABASE=postgres

psql -f migrations/001_create_multiuser_tables.sql
```

**Onde encontrar as credenciais**:
- No Supabase Dashboard → **Settings** → **Database**
- **Connection string** ou **Connection pooling**

---

### PASSO 2: Configurar Variáveis de Ambiente

Crie/edite o arquivo `.env` na raiz do projeto:

```bash
# Storage
BOT_STORAGE=supabase

# Supabase
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_KEY=sua-service-key-aqui

# ⚠️ IMPORTANTE: Gere uma chave mestra aleatória e segura
# Use: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
ENCRYPTION_MASTER_KEY=sua-chave-mestra-gerada-aqui

# Credenciais atuais (para migração)
HYPER_PRIVATE_KEY=sua-chave-privada-atual
HYPER_ACCOUNT_ADDRESS=sua-wallet-address
TELEGRAM_BOT_TOKEN=seu-token-telegram
TELEGRAM_CHAT_ID=seu-chat-id
```

**Como gerar ENCRYPTION_MASTER_KEY**:
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

**⚠️ IMPORTANTE**: 
- Guarde a `ENCRYPTION_MASTER_KEY` em local seguro
- Se perder, não conseguirá descriptografar as chaves privadas
- Nunca commite no git

---

### PASSO 3: Instalar Dependências Novas

```bash
pip install cryptography>=41.0.0
```

Ou atualize o requirements.txt completo:
```bash
pip install -r requirements.txt
```

---

### PASSO 4: Executar Script de Migração

Este script vai:
- Criar usuário admin no banco
- Criptografar e salvar sua chave privada atual
- Migrar todos os dados existentes para o novo formato
- Configurar Telegram

```bash
python scripts/migrate_to_multiuser.py
```

**Se quiser especificar email customizado**:
```bash
python scripts/migrate_to_multiuser.py --email seu-email@exemplo.com
```

**O que esperar**:
```
============================================================
Migração para Multiusuário
============================================================

📧 Email do admin: seu-email@exemplo.com
🔑 Chave privada: ********************...

1️⃣ Criando/buscando usuário admin...
   ✅ Usuário criado: [uuid]

2️⃣ Criando/buscando trading account...
   ✅ Trading account criada: [uuid]

3️⃣ Migrando bot_config...
   ✅ Config atualizada com user_id

4️⃣ Migrando telegram_configs...
   ✅ Telegram config criada

5️⃣ Atualizando dados existentes com user_id...
   ✅ bot_tracker atualizado
   ✅ bot_history atualizado
   ✅ trades_database atualizado

============================================================
✅ Migração concluída com sucesso!
============================================================
```

---

### PASSO 5: Configurar Símbolos e Timeframes

Após a migração, você precisa configurar quais símbolos e timeframes o bot vai operar.

#### Via SQL Editor no Supabase:

```sql
-- Busque seu user_id primeiro
SELECT id, email FROM users;

-- Configure o bot (substitua 'seu-user-id' pelo ID retornado acima)
UPDATE bot_configs 
SET 
    symbols = ARRAY['BTC', 'ETH', 'SOL'],  -- Símbolos que você quer operar
    timeframes = ARRAY['15m', '1h'],       -- Timeframes desejados
    trade_mode = 'BOTH',                    -- BOTH, LONG_ONLY, ou SHORT_ONLY
    bot_enabled = TRUE                      -- Habilita o bot
WHERE user_id = 'seu-user-id';
```

#### Ou via Python:

```python
from storage import get_storage

storage = get_storage()
client = storage._client

# Busca user_id
users = client.table("users").select("id, email").execute()
user_id = users.data[0]["id"]

# Atualiza config
client.table("bot_configs").update({
    "symbols": ["BTC", "ETH", "SOL"],
    "timeframes": ["15m", "1h"],
    "trade_mode": "BOTH",
    "bot_enabled": True
}).eq("user_id", user_id).execute()

print("Config atualizada!")
```

---

### PASSO 6: Testar o Manager (Modo Teste)

Antes de rodar em produção, teste localmente:

```bash
# 1. Certifique-se que o bot está DESABILITADO no banco
# (bot_enabled = FALSE) para não iniciar automaticamente

# 2. Execute o manager
python manager.py
```

**O que esperar**:
```
============================================================
Zeedo SaaS - Instance Manager
============================================================
InstanceManager iniciado
```

**Se aparecer erros**, verifique:
- ✅ Migration SQL foi executada?
- ✅ Variáveis de ambiente estão corretas?
- ✅ Script de migração rodou com sucesso?
- ✅ `bot_enabled = FALSE` no banco (para não iniciar ainda)?

---

### PASSO 7: Habilitar e Testar Instância Real

Quando estiver pronto para testar com o bot real:

1. **Habilite o bot no banco**:
```sql
UPDATE bot_configs SET bot_enabled = TRUE WHERE user_id = 'seu-user-id';
```

2. **O manager vai detectar automaticamente** (em até 30 segundos) e iniciar a instância

3. **Monitore os logs**:
```bash
# Logs do manager
tail -f manager.log  # Se configurado

# Logs do usuário específico
tail -f logs/user_[seu-user-id].log
```

4. **Verifique status no banco**:
```sql
SELECT 
    u.email,
    is.status,
    is.process_id,
    is.last_heartbeat,
    bc.bot_enabled
FROM instance_status is
JOIN users u ON u.id = is.user_id
LEFT JOIN bot_configs bc ON bc.user_id = u.id;
```

---

### PASSO 8: Parar o Bot (Se Necessário)

Para parar o bot temporariamente:

```sql
UPDATE bot_configs SET bot_enabled = FALSE WHERE user_id = 'seu-user-id';
```

O manager vai detectar e parar a instância automaticamente.

---

## 🔍 Verificações Importantes

### ✅ Checklist Antes de Rodar em Produção:

- [ ] Migration SQL executada com sucesso
- [ ] Todas as tabelas criadas (verificar no Table Editor)
- [ ] `ENCRYPTION_MASTER_KEY` configurada e guardada com segurança
- [ ] Script de migração executado sem erros
- [ ] Dados existentes migrados (verificar `user_id` nas tabelas)
- [ ] Símbolos e timeframes configurados
- [ ] Manager testado localmente
- [ ] Logs funcionando (`logs/user_*.log`)
- [ ] Backup do banco feito antes de começar

---

## 🆘 Troubleshooting

### Erro: "ENCRYPTION_MASTER_KEY não configurada"
**Solução**: Configure a variável de ambiente `ENCRYPTION_MASTER_KEY` no `.env`

### Erro: "Tabela não existe"
**Solução**: Execute a migration SQL novamente

### Erro: "user_id não encontrado"
**Solução**: Execute o script de migração: `python scripts/migrate_to_multiuser.py`

### Manager não inicia instâncias
**Solução**: 
1. Verifique se `bot_enabled = TRUE` no banco
2. Verifique logs do manager
3. Verifique se há erros no `instance_status` (coluna `error_message`)

### Instância inicia mas para imediatamente
**Solução**: 
1. Verifique logs em `logs/user_[id].log`
2. Verifique se credenciais estão corretas
3. Verifique se chave privada foi descriptografada corretamente

---

## 📞 Próximos Passos Após Testes

1. **Refatorar BotEngine** (opcional, melhoria futura)
   - Remover patches globais
   - Extrair completamente do `bot.py`

2. **Adicionar mais usuários** (quando necessário)
   - Use o guia em `README_SAAS.md`

3. **Monitoramento avançado**
   - Dashboard web
   - Alertas
   - Métricas

---

**🎯 Foco Agora**: Execute os passos 1-6 acima para colocar o sistema em funcionamento!
