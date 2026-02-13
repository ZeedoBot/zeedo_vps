# 🚀 Zeedo SaaS - Guia de Implementação

## 📋 Visão Geral

Este documento descreve a implementação do sistema SaaS multiusuário para o bot Zeedo. A arquitetura permite que múltiplos usuários rodem instâncias independentes do bot simultaneamente, cada um com sua própria configuração, wallet e controle.

## 🏗️ Arquitetura

```
manager.py (Entrypoint Principal)
    └── InstanceManager
        ├── BotInstance (User 1)
        ├── BotInstance (User 2)
        └── BotInstance (User N)
```

### Componentes Principais:

1. **manager.py**: Entrypoint que roda o InstanceManager
2. **InstanceManager**: Gerencia múltiplas instâncias simultaneamente
3. **BotInstance**: Wrapper que carrega config/credenciais e roda o bot
4. **UserStorage**: Wrapper de storage que adiciona isolamento por user_id
5. **EncryptionManager**: Criptografa/descriptografa chaves privadas

## 📦 Estrutura de Arquivos

```
bot/
├── auth/                    # Autenticação e criptografia
│   ├── encryption.py        # Criptografia de chaves privadas
│   └── __init__.py
├── utils/                   # Utilitários compartilhados
│   ├── telegram.py          # Cliente Telegram multiusuário
│   ├── logging.py           # Logging por usuário
│   └── __init__.py
├── instance/                # Instância individual do bot
│   ├── bot_instance.py      # Wrapper que roda bot para um usuário
│   └── __init__.py
├── manager/                 # Gerenciador de instâncias
│   ├── instance_manager.py   # Gerencia processos de usuários
│   └── __init__.py
├── storage/                 # Persistência (modificado para multiusuário)
│   ├── user_storage.py      # Wrapper com user_id
│   └── ...
├── migrations/              # Migrations SQL
│   └── 001_create_multiuser_tables.sql
├── scripts/                 # Scripts utilitários
│   └── migrate_to_multiuser.py
└── manager.py              # Entrypoint principal
```

## 🗄️ Banco de Dados

### Tabelas Novas:

1. **users**: Usuários do sistema
2. **trading_accounts**: Contas de trading (wallets) com chaves criptografadas
3. **telegram_configs**: Configuração Telegram por usuário
4. **instance_status**: Status das instâncias em execução

### Tabelas Modificadas:

- **bot_config**: Adicionado `user_id`, `trading_account_id`, `bot_enabled`
- **bot_tracker**: Adicionado `user_id`
- **bot_history**: Adicionado `user_id`
- **trades_database**: Adicionado `user_id`

## 🔐 Segurança

### Criptografia de Chaves Privadas:

- Usa **Fernet** (AES-128) com chave mestra
- Chave mestra vem de variável de ambiente `ENCRYPTION_MASTER_KEY`
- Cada chave usa salt único baseado em `user_id`
- Chaves nunca são logadas ou expostas

**⚠️ IMPORTANTE**: Configure `ENCRYPTION_MASTER_KEY` antes de usar:

```bash
export ENCRYPTION_MASTER_KEY="sua-chave-mestra-aqui"
```

## 🚀 Como Usar

### 1. Executar Migrations

```bash
# Conecte ao Supabase e execute:
psql -h seu-host.supabase.co -U postgres -d postgres -f migrations/001_create_multiuser_tables.sql
```

### 2. Migrar Dados Existentes

```bash
# Migra dados atuais para estrutura multiusuário
python scripts/migrate_to_multiuser.py

# Ou com parâmetros customizados:
python scripts/migrate_to_multiuser.py --email admin@exemplo.com
```

### 3. Configurar Usuário

Após migração, configure símbolos e timeframes na tabela `bot_configs`:

```sql
UPDATE bot_configs 
SET 
    symbols = ARRAY['BTC', 'ETH', 'SOL'],
    timeframes = ARRAY['15m', '1h'],
    trade_mode = 'BOTH',
    bot_enabled = TRUE
WHERE user_id = 'seu-user-id';
```

### 4. Iniciar Manager

```bash
# Define variáveis de ambiente
export BOT_STORAGE=supabase
export SUPABASE_URL=sua-url
export SUPABASE_SERVICE_KEY=sua-key
export ENCRYPTION_MASTER_KEY=sua-chave-mestra

# Inicia o manager
python manager.py
```

## 📊 Adicionar Novo Usuário

### Via SQL:

```sql
-- 1. Criar usuário
INSERT INTO users (email, subscription_status, subscription_tier)
VALUES ('novo@usuario.com', 'active', 'basic')
RETURNING id;

-- 2. Criar trading account (criptografar chave primeiro)
-- Use: python -c "from auth.encryption import EncryptionManager; em = EncryptionManager(); print(em.encrypt_private_key('sua-chave', 'user-id'))"

INSERT INTO trading_accounts (user_id, wallet_address, encrypted_private_key, encryption_salt, network)
VALUES ('user-id', 'wallet-address', 'encrypted-key', 'salt', 'mainnet');

-- 3. Criar config
INSERT INTO bot_configs (user_id, trading_account_id, symbols, timeframes, trade_mode, bot_enabled)
VALUES ('user-id', 'account-id', ARRAY['BTC'], ARRAY['15m'], 'BOTH', TRUE);

-- 4. Criar Telegram config (opcional)
INSERT INTO telegram_configs (user_id, bot_token, chat_id)
VALUES ('user-id', 'bot-token', 'chat-id');
```

### Via Script Python:

```python
from storage import get_storage
from auth.encryption import EncryptionManager

storage = get_storage()
enc_manager = EncryptionManager()

# 1. Criar usuário
user = storage._client.table("users").insert({
    "email": "novo@usuario.com",
    "subscription_status": "active"
}).execute()

user_id = user.data[0]["id"]

# 2. Criptografar e criar trading account
encrypted_key, salt = enc_manager.encrypt_private_key("private-key", user_id)
# ... resto do código
```

## 🔍 Monitoramento

### Ver Status das Instâncias:

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

### Logs por Usuário:

Logs são salvos em `logs/user_{user_id}.log`

## ⚠️ Limitações Atuais

1. **BotEngine não refatorado**: Ainda usa `bot.py` original com patches globais
2. **Cache compartilhado**: LSR e strength podem ser compartilhados (não crítico)
3. **Processos**: Cada usuário = 1 processo Python (pode ser pesado com muitos usuários)

## 🔄 Próximos Passos

1. Refatorar completamente `BotEngine` para remover dependências globais
2. Implementar sistema de filas para escalabilidade
3. Adicionar API REST para gerenciar usuários
4. Implementar dashboard web para usuários
5. Adicionar métricas e monitoramento avançado

## 📝 Notas

- O código mantém compatibilidade com `bot.py` original durante migração
- Todos os dados são isolados por `user_id`
- Chaves privadas são sempre criptografadas no banco
- O manager verifica usuários a cada 30 segundos (configurável)
