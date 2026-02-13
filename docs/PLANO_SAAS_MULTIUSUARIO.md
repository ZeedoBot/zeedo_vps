# 📋 PLANO DE MIGRAÇÃO PARA SAAS MULTIUSUÁRIO

## 🎯 OBJETIVO
Transformar o bot atual (instância única) em uma arquitetura SaaS que suporte múltiplos usuários simultâneos, cada um com configuração, wallet e controle individual.

---

## 📊 ANÁLISE DO CÓDIGO ATUAL

### Estrutura Atual:
- **`bot.py`**: Lógica completa do bot (1600+ linhas)
- **`run_online.py`**: Entrypoint para produção (usa Supabase)
- **`storage/`**: Sistema de persistência já implementado (Local/Supabase)
- **Variáveis globais**: SYMBOLS, TIMEFRAMES, PRIVATE_KEY, etc.
- **Tabelas Supabase existentes**: `bot_tracker`, `bot_history`, `trades_database`, `bot_config`

### Pontos Críticos Identificados:
1. ✅ Storage já abstraído (facilita multiusuário)
2. ⚠️ Variáveis globais precisam ser parametrizadas
3. ⚠️ Telegram usa tokens globais (precisa ser por usuário)
4. ⚠️ Cache compartilhado (lsr_cache, strength_block_cache)
5. ✅ Lógica de estratégia isolada em funções (pode ser extraída)

---

## 🏗️ ARQUITETURA PROPOSTA

### Estrutura de Arquivos:

```
bot/
├── engine/                    # Lógica pura da estratégia
│   ├── __init__.py
│   ├── bot_engine.py         # Motor principal (refatorado de bot.py)
│   ├── signals.py             # Funções de sinal (get_signal, check_patterns, etc.)
│   ├── risk.py                # Gestão de risco (manage_risk_and_scan)
│   ├── position.py            # Gestão de posições (auto_manage)
│   └── indicators.py          # Indicadores técnicos (RSI, LSR, etc.)
│
├── instance/                  # Instância individual do bot
│   ├── __init__.py
│   ├── bot_instance.py       # Wrapper que roda engine para um user_id
│   └── config_loader.py      # Carrega config do usuário
│
├── manager/                   # Gerenciador de instâncias
│   ├── __init__.py
│   ├── instance_manager.py   # Gerencia processos de usuários
│   └── process_monitor.py    # Monitora saúde das instâncias
│
├── storage/                   # (JÁ EXISTE - ajustar para multiusuário)
│   ├── base.py
│   ├── local_storage.py
│   ├── supabase_storage.py   # MODIFICAR: adicionar user_id
│   └── user_storage.py       # NOVO: wrapper que adiciona user_id
│
├── auth/                      # NOVO: Autenticação e criptografia
│   ├── __init__.py
│   ├── encryption.py         # encrypt/decrypt private keys
│   └── credentials.py        # Gerencia credenciais por usuário
│
├── utils/                     # Utilitários compartilhados
│   ├── __init__.py
│   ├── telegram.py           # NOVO: Telegram por usuário
│   └── logging.py             # NOVO: Logs por user_id
│
├── bot.py                     # (DEPRECADO - manter para compatibilidade temporária)
├── run_online.py             # (DEPRECADO)
└── manager.py                 # NOVO: Entrypoint principal do SaaS
```

---

## 🗄️ ESQUEMA DE BANCO DE DADOS (SUPABASE)

### Tabelas Novas:

#### 1. `users`
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    subscription_status VARCHAR(50) DEFAULT 'trial', -- trial, active, cancelled, expired
    subscription_tier VARCHAR(50) DEFAULT 'basic', -- basic, pro, enterprise
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_subscription ON users(subscription_status, subscription_tier);
```

#### 2. `trading_accounts`
```sql
CREATE TABLE trading_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_address VARCHAR(255) NOT NULL,
    encrypted_private_key TEXT NOT NULL, -- Chave criptografada
    encryption_salt VARCHAR(255) NOT NULL, -- Salt único por chave
    network VARCHAR(20) DEFAULT 'mainnet', -- mainnet, testnet
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(user_id, wallet_address)
);

CREATE INDEX idx_trading_accounts_user ON trading_accounts(user_id);
CREATE INDEX idx_trading_accounts_active ON trading_accounts(user_id, is_active);
```

#### 3. `bot_configs` (MODIFICAR TABELA EXISTENTE)
```sql
-- Se já existe bot_config, adicionar colunas:
ALTER TABLE bot_config ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE bot_config ADD COLUMN IF NOT EXISTS trading_account_id UUID REFERENCES trading_accounts(id) ON DELETE CASCADE;
ALTER TABLE bot_config ADD COLUMN IF NOT EXISTS bot_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE bot_config ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Criar índice único por usuário (um config por usuário)
CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_config_user ON bot_config(user_id);

-- Estrutura completa esperada:
-- user_id UUID
-- trading_account_id UUID
-- symbols TEXT[] -- Array de símbolos
-- timeframes TEXT[] -- Array de timeframes
-- trade_mode VARCHAR(20) -- BOTH, LONG_ONLY, SHORT_ONLY
-- target_loss_usd FLOAT DEFAULT 5.0
-- max_global_exposure FLOAT DEFAULT 5000.0
-- max_single_pos_exposure FLOAT DEFAULT 2500.0
-- max_positions INTEGER DEFAULT 2
-- bot_enabled BOOLEAN DEFAULT FALSE
-- updated_at TIMESTAMPTZ
```

#### 4. `telegram_configs` (NOVO)
```sql
CREATE TABLE telegram_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bot_token VARCHAR(255) NOT NULL,
    chat_id VARCHAR(255) NOT NULL,
    bot_token_sender VARCHAR(255), -- Opcional
    chat_id_sender VARCHAR(255),   -- Opcional
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX idx_telegram_configs_user ON telegram_configs(user_id);
```

#### 5. Modificar Tabelas Existentes (adicionar user_id):

```sql
-- bot_tracker (já existe)
ALTER TABLE bot_tracker ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_bot_tracker_user ON bot_tracker(user_id, symbol);

-- bot_history (já existe)
ALTER TABLE bot_history ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_bot_history_user ON bot_history(user_id, symbol, timeframe);

-- trades_database (já existe)
ALTER TABLE trades_database ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_trades_database_user ON trades_database(user_id, closed_at);
```

#### 6. `instance_status` (NOVO - Monitoramento)
```sql
CREATE TABLE instance_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    process_id INTEGER, -- PID do processo
    status VARCHAR(50) DEFAULT 'stopped', -- stopped, starting, running, stopping, error
    last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
    error_message TEXT,
    started_at TIMESTAMPTZ,
    stopped_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX idx_instance_status_user ON instance_status(user_id);
CREATE INDEX idx_instance_status_heartbeat ON instance_status(last_heartbeat);
```

---

## 🔐 SEGURANÇA E CRIPTOGRAFIA

### Funções de Criptografia (`auth/encryption.py`):

```python
# Pseudocódigo da estrutura:

from cryptography.fernet import Fernet
import base64
import os
import hashlib

class EncryptionManager:
    def __init__(self):
        # Chave mestra vem de variável de ambiente
        self.master_key = os.getenv("ENCRYPTION_MASTER_KEY")
        if not self.master_key:
            raise ValueError("ENCRYPTION_MASTER_KEY não configurada")
    
    def encrypt_private_key(self, private_key: str, user_id: str) -> tuple[str, str]:
        """
        Criptografa chave privada usando master_key + user_id como salt.
        Retorna: (encrypted_key, salt)
        """
        # Gera salt único baseado em user_id
        # Cria chave derivada
        # Criptografa usando Fernet
        pass
    
    def decrypt_private_key(self, encrypted_key: str, salt: str, user_id: str) -> str:
        """
        Descriptografa chave privada.
        """
        # Deriva chave usando salt + user_id
        # Descriptografa
        pass
```

**⚠️ CRÍTICO**: 
- `ENCRYPTION_MASTER_KEY` deve ser gerada uma vez e armazenada de forma segura
- Nunca commitar no git
- Usar variável de ambiente no VPS
- Considerar usar AWS Secrets Manager ou similar em produção

---

## 🔄 REFATORAÇÃO DO CÓDIGO

### Fase 1: Extrair Engine (`engine/bot_engine.py`)

**Objetivo**: Separar lógica de estratégia de configuração/execução

**Mudanças necessárias**:

1. **Criar classe `BotEngine`**:
```python
class BotEngine:
    def __init__(self, config: BotConfig, storage: StorageBase, telegram: TelegramClient):
        # Recebe config como objeto, não variáveis globais
        self.config = config
        self.storage = storage
        self.telegram = telegram
        # Inicializa caches isolados por instância
        self.lsr_cache = {}
        self.strength_block_cache = {...}
    
    def run(self):
        # Loop principal (extraído de main())
        # Usa self.config ao invés de variáveis globais
        pass
```

2. **Criar classe `BotConfig`** (dataclass):
```python
@dataclass
class BotConfig:
    # Trading
    symbols: list[str]
    timeframes: list[str]
    trade_mode: str  # BOTH, LONG_ONLY, SHORT_ONLY
    
    # Risk
    target_loss_usd: float = 5.0
    max_global_exposure: float = 5000.0
    max_single_pos_exposure: float = 2500.0
    max_positions: int = 2
    
    # Indicators
    rsi_period: int = 14
    volume_sma_period: int = 20
    # ... todos os parâmetros
    
    # Credentials
    private_key: str  # Já descriptografado
    wallet_address: str
    is_mainnet: bool = True
```

3. **Refatorar funções para usar `self.config`**:
   - `get_signal()` → `self.get_signal()`
   - `manage_risk_and_scan()` → `self.manage_risk_and_scan()`
   - `auto_manage()` → `self.auto_manage()`
   - Todas referências a variáveis globais → `self.config.*`

### Fase 2: Criar BotInstance (`instance/bot_instance.py`)

**Objetivo**: Wrapper que carrega config do usuário e roda engine

```python
class BotInstance:
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.engine = None
        self.process = None
    
    def start(self):
        # 1. Carrega config do banco
        config = self._load_user_config()
        
        # 2. Carrega credenciais e descriptografa
        credentials = self._load_credentials()
        
        # 3. Cria storage com user_id
        storage = UserStorage(self.user_id)
        
        # 4. Cria Telegram client com tokens do usuário
        telegram = TelegramClient(self.user_id)
        
        # 5. Cria BotConfig
        bot_config = BotConfig(
            symbols=config['symbols'],
            timeframes=config['timeframes'],
            private_key=credentials['private_key'],
            wallet_address=credentials['wallet_address'],
            ...
        )
        
        # 6. Inicializa e roda engine
        self.engine = BotEngine(bot_config, storage, telegram)
        self.engine.run()
    
    def stop(self):
        # Para engine graciosamente
        pass
    
    def _load_user_config(self) -> dict:
        # Query Supabase: bot_config WHERE user_id = ?
        pass
    
    def _load_credentials(self) -> dict:
        # Query Supabase: trading_accounts WHERE user_id = ?
        # Descriptografa private_key
        pass
```

### Fase 3: Criar InstanceManager (`manager/instance_manager.py`)

**Objetivo**: Gerencia múltiplas instâncias simultâneas

```python
class InstanceManager:
    def __init__(self):
        self.active_instances: dict[str, BotInstance] = {}
        self.process_pool: dict[str, multiprocessing.Process] = {}
    
    def start_monitoring(self):
        """Loop principal que monitora usuários"""
        while True:
            # 1. Busca usuários ativos no banco
            active_users = self._get_active_users()
            
            # 2. Para cada usuário:
            for user_id in active_users:
                config = self._get_user_config(user_id)
                
                if config['bot_enabled']:
                    # Se não está rodando, inicia
                    if user_id not in self.active_instances:
                        self._start_instance(user_id)
                    # Se config mudou, reinicia
                    elif self._config_changed(user_id, config):
                        self._restart_instance(user_id)
                else:
                    # Se está rodando mas desabilitado, para
                    if user_id in self.active_instances:
                        self._stop_instance(user_id)
            
            # 3. Verifica saúde das instâncias
            self._check_instance_health()
            
            # 4. Atualiza heartbeat no banco
            self._update_heartbeats()
            
            time.sleep(30)  # Verifica a cada 30s
    
    def _start_instance(self, user_id: str):
        """Inicia processo para um usuário"""
        instance = BotInstance(user_id)
        process = multiprocessing.Process(target=instance.start)
        process.start()
        
        self.active_instances[user_id] = instance
        self.process_pool[user_id] = process
        
        # Atualiza status no banco
        self._update_instance_status(user_id, 'running', process.pid)
    
    def _stop_instance(self, user_id: str):
        """Para processo graciosamente"""
        if user_id in self.process_pool:
            process = self.process_pool[user_id]
            instance = self.active_instances[user_id]
            
            instance.stop()  # Sinaliza parada
            process.join(timeout=10)  # Aguarda até 10s
            
            if process.is_alive():
                process.terminate()  # Força se necessário
            
            del self.active_instances[user_id]
            del self.process_pool[user_id]
            
            self._update_instance_status(user_id, 'stopped')
```

### Fase 4: Modificar Storage para Multiusuário

**Objetivo**: Adicionar `user_id` em todas as operações

**Criar `storage/user_storage.py`**:
```python
class UserStorage(StorageBase):
    """Wrapper que adiciona user_id a todas as operações"""
    
    def __init__(self, user_id: str, backend: StorageBase):
        self.user_id = user_id
        self.backend = backend
    
    def get_entry_tracker(self) -> dict:
        # Modifica query para filtrar por user_id
        return self.backend.get_entry_tracker(user_id=self.user_id)
    
    # Similar para todos os métodos
```

**Modificar `storage/supabase_storage.py`**:
- Adicionar parâmetro `user_id` em todos os métodos
- Modificar queries SQL para incluir `WHERE user_id = ?`
- Manter compatibilidade com código antigo (user_id opcional)

---

## 📱 TELEGRAM MULTIUSUÁRIO

### Criar `utils/telegram.py`:

```python
class TelegramClient:
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.config = self._load_config()
    
    def send(self, message: str):
        """Envia mensagem usando tokens do usuário"""
        # Usa self.config['bot_token'] e self.config['chat_id']
        pass
    
    def _load_config(self) -> dict:
        # Query: telegram_configs WHERE user_id = ?
        pass
```

**Modificar `tg_send()` no engine**:
- Remover função global
- Usar `self.telegram.send()` dentro do engine

---

## 📝 LOGGING POR USUÁRIO

### Criar `utils/logging.py`:

```python
def setup_user_logger(user_id: str) -> logging.Logger:
    """Cria logger isolado por usuário"""
    logger = logging.getLogger(f"bot.user_{user_id}")
    
    # Handler para arquivo específico
    handler = RotatingFileHandler(
        f'logs/user_{user_id}.log',
        maxBytes=5*1024*1024,
        backupCount=3
    )
    
    formatter = logging.Formatter(
        f'[USER:{user_id}] %(asctime)s - %(message)s'
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    
    return logger
```

---

## 🚀 ENTRYPOINT PRINCIPAL (`manager.py`)

```python
"""
Entrypoint principal do SaaS.
Roda o InstanceManager que gerencia todas as instâncias de usuários.
"""
from manager.instance_manager import InstanceManager

def main():
    manager = InstanceManager()
    manager.start_monitoring()

if __name__ == "__main__":
    main()
```

---

## 🔄 MIGRAÇÃO DE DADOS EXISTENTES

### Script de Migração (`scripts/migrate_to_multiuser.py`):

1. **Criar usuário padrão**:
   - Criar registro em `users` com email do admin
   - Criar `trading_account` com wallet atual
   - Criptografar `PRIVATE_KEY` atual

2. **Migrar dados existentes**:
   - Atualizar `bot_tracker`: adicionar `user_id` do admin
   - Atualizar `bot_history`: adicionar `user_id` do admin
   - Atualizar `trades_database`: adicionar `user_id` do admin
   - Migrar `bot_config` atual para novo formato

3. **Criar config inicial**:
   - Criar `bot_configs` com dados atuais
   - Criar `telegram_configs` com tokens atuais

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### Fase 1: Preparação (Sem quebrar código atual)
- [x] Criar estrutura de diretórios (`engine/`, `instance/`, `manager/`, `auth/`, `utils/`)
- [x] Criar tabelas no Supabase (migrations SQL)
- [x] Implementar `auth/encryption.py`
- [x] Criar script de migração de dados

### Fase 2: Refatoração do Engine
- [x] Criar `BotConfig` dataclass
- [ ] Extrair `BotEngine` de `bot.py` (⚠️ Parcial - usa patches temporários)
- [ ] Refatorar funções para usar `self.config` (⚠️ Parcial - patches globais)
- [ ] Testar engine isoladamente

### Fase 3: Storage Multiusuário
- [x] Criar `UserStorage` wrapper
- [x] Modificar `SupabaseStorage` para aceitar `user_id`
- [x] Atualizar todas as queries SQL
- [ ] Testar isolamento entre usuários

### Fase 4: Instância Individual
- [x] Criar `BotInstance`
- [x] Implementar carregamento de config/credenciais
- [x] Integrar com `BotEngine` (⚠️ Via patches temporários)
- [ ] Testar instância isolada

### Fase 5: Manager
- [x] Criar `InstanceManager`
- [x] Implementar monitoramento de usuários
- [x] Implementar start/stop/restart
- [x] Implementar health checks
- [ ] Testar múltiplas instâncias

### Fase 6: Telegram e Logging
- [x] Criar `TelegramClient` por usuário
- [x] Implementar logging por usuário
- [x] Integrar no engine (⚠️ Via patches temporários)

### Fase 7: Entrypoint e Deploy
- [x] Criar `manager.py` principal
- [ ] Atualizar scripts de deploy
- [ ] Testar em ambiente de staging
- [ ] Migrar dados de produção
- [ ] Deploy gradual

---

## ⚠️ CONSIDERAÇÕES IMPORTANTES

### Performance:
- **Cache compartilhado**: LSR e strength podem ser compartilhados (market data é global)
- **Rate Limits**: Hyperliquid tem rate limits - considerar pool de conexões
- **Recursos do VPS**: Monitorar CPU/RAM com múltiplas instâncias

### Segurança:
- **Chaves privadas**: Nunca logar, sempre criptografadas
- **Isolamento**: Garantir que nenhum usuário acesse dados de outro
- **Validação**: Validar todas as queries SQL com `user_id`

### Escalabilidade:
- **Processos**: Cada usuário = 1 processo Python (pode ser pesado)
- **Alternativa futura**: Considerar threads ou async (mais complexo)
- **Horizontal scaling**: Manager pode rodar em múltiplos VPS com load balancer

### Monitoramento:
- **Health checks**: Verificar se processos estão vivos
- **Logs centralizados**: Considerar ELK ou similar
- **Métricas**: Tracking de trades por usuário, performance, etc.

### Rollback:
- **Manter código antigo**: `bot.py` e `run_online.py` funcionando durante migração
- **Feature flag**: Permitir voltar ao modo single-user se necessário
- **Backup**: Backup completo do banco antes de migração

---

## 📊 ORDEM DE IMPLEMENTAÇÃO RECOMENDADA

1. **Semana 1**: Preparação
   - Estrutura de diretórios
   - Tabelas SQL
   - Encryption
   - Script de migração

2. **Semana 2**: Engine
   - Extrair e refatorar engine
   - Testes unitários

3. **Semana 3**: Storage e Instância
   - Storage multiusuário
   - BotInstance
   - Testes de isolamento

4. **Semana 4**: Manager
   - InstanceManager
   - Monitoramento
   - Testes de múltiplas instâncias

5. **Semana 5**: Integração e Deploy
   - Telegram e logging
   - Testes end-to-end
   - Migração de dados
   - Deploy gradual

---

## 🎯 RESULTADO FINAL ESPERADO

- ✅ Múltiplos usuários rodando simultaneamente
- ✅ Cada usuário com sua própria wallet e config
- ✅ Isolamento total entre usuários
- ✅ Controle individual (ligar/desligar)
- ✅ Lógica de estratégia preservada (sem alterações)
- ✅ Escalável e seguro
- ✅ Fácil adicionar novos usuários

---

**Status**: 📋 PLANO COMPLETO - PRONTO PARA IMPLEMENTAÇÃO
