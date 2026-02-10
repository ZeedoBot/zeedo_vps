# MCP Supabase Validator - Guia de Uso

## 📖 Visão Geral

O **MCP Supabase Validator** é um Model Context Provider que expõe tools somente de leitura para auditar e validar dados do bot no Supabase. Ele permite que o Cursor (ou outras ferramentas compatíveis com MCP) consulte dados reais do banco para manter a lógica do bot alinhada.

## 🚀 Instalação

### 1. Dependências

```bash
pip install supabase python-dotenv fastmcp
```

### 2. Configuração

Certifique-se de que o arquivo `.env` contém:

```env
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_KEY=sua_chave_aqui
# OU
SUPABASE_SERVICE_KEY=sua_service_key_aqui
# OU
SUPABASE_ANON_KEY=sua_anon_key_aqui
```

## 🛠️ Tools Disponíveis

### 1. `get_bot_state_keys()`

Lista todas as chaves disponíveis na tabela `bot_state`.

**Retorna**:
```json
{
  "keys": ["entry_tracker", "history_tracker", "trades_db", "config"],
  "count": 4,
  "expected_keys": ["entry_tracker", "history_tracker", "trades_db", "config"]
}
```

### 2. `get_entry_tracker(symbol: Optional[str] = None)`

Consulta `entry_tracker` completo ou de um símbolo específico.

**Parâmetros**:
- `symbol` (opcional): Símbolo específico para consultar

**Retorna**:
```json
{
  "entry_tracker": {...},
  "symbols": ["BTC", "ETH"],
  "count": 2,
  "validation": {
    "BTC": {
      "has_all_fields": true,
      "missing_fields": [],
      "pnl_realized": 150.50,
      "side": "long",
      "tf": "15m"
    }
  }
}
```

### 3. `get_history_tracker()`

Consulta `history_tracker` completo.

**Retorna**:
```json
{
  "history_tracker": {
    "BTC": {"15m": 1234567890, "1h": 1234567890},
    "ETH": {"15m": 1234567890}
  },
  "symbols": ["BTC", "ETH"],
  "count": 2
}
```

### 4. `get_trades_db(limit: int = 100, symbol: Optional[str] = None)`

Consulta `trades_db` com validação de campos.

**Parâmetros**:
- `limit`: Número máximo de trades a retornar (padrão: 100)
- `symbol`: Filtrar por símbolo (opcional)

**Retorna**:
```json
{
  "trades_db": [...],
  "count": 50,
  "validation": {
    "total_trades": 50,
    "fields_analysis": {
      "coin": {"present_in": 50, "missing_in": 0, "percentage": 100.0},
      "closedPnl": {"present_in": 45, "missing_in": 5, "percentage": 90.0}
    },
    "issues": [...]
  }
}
```

### 5. `get_config()`

Consulta `config` do bot.

**Retorna**:
```json
{
  "config": {
    "symbols": ["BTC", "ETH"],
    "timeframes": ["15m", "1h"],
    "trade_mode": "BOTH"
  },
  "exists": true,
  "has_symbols": true,
  "has_timeframes": true,
  "has_trade_mode": true
}
```

### 6. `validate_pnl_calculation(symbol: Optional[str] = None)`

Validação cruzada de PnL entre `entry_tracker` e `trades_db`.

**Parâmetros**:
- `symbol`: Símbolo específico para validar (opcional)

**Retorna**:
```json
{
  "symbols_checked": [
    {
      "symbol": "BTC",
      "entry_tracker_pnl": 150.50,
      "calculated_from_trades": 150.50,
      "discrepancy": 0.0,
      "matches": true,
      "num_trades": 5
    }
  ],
  "discrepancies": []
}
```

### 7. `get_schema_info()`

Retorna informações sobre o schema esperado pelo código.

**Retorna**:
```json
{
  "table": "bot_state",
  "structure": {
    "key": "text (primary key)",
    "value": "jsonb"
  },
  "expected_keys": {...},
  "code_expectations": {...}
}
```

## 🔌 Configuração no Cursor

### Opção 1: Via Settings do Cursor

1. Abra Settings do Cursor
2. Vá para Features → MCP
3. Adicione novo servidor:
   - **Nome**: `supabase-validator`
   - **Command**: `python`
   - **Args**: `["-m", "mcp.validator"]`
   - **Working Directory**: Caminho do projeto

### Opção 2: Via Arquivo de Configuração

Crie/edite `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "supabase-validator": {
      "command": "python",
      "args": ["-m", "mcp.validator"],
      "cwd": "<raiz do projeto>"
    }
  }
}
```

## 📝 Uso Standalone (Sem MCP)

Para usar as funções diretamente em Python:

```python
from validate_supabase import validate_data

# Executa validação completa
validate_data()
```

Ou importe funções específicas:

```python
from validate_supabase import get_entry_tracker, get_trades_db

entry_data = get_entry_tracker("BTC")
trades = get_trades_db(limit=50, symbol="BTC")
```

## 🧪 Executar Validação Completa

```bash
python scripts/validate_supabase.py
```

Isso gerará um relatório completo validando:
- ✅ Conexão e chaves disponíveis
- ✅ Estrutura de `entry_tracker`
- ✅ Estrutura de `history_tracker`
- ✅ Estrutura de `trades_db` (campos, tipos, problemas)
- ✅ Estrutura de `config`
- ✅ Validação cruzada de PnL

## 🔍 Exemplos de Uso

### Exemplo 1: Verificar símbolos ativos

```python
from validate_supabase import get_entry_tracker

result = get_entry_tracker()
print(f"Símbolos ativos: {result['symbols']}")
print(f"Total: {result['count']}")
```

### Exemplo 2: Validar PnL de um símbolo específico

```python
from validate_supabase import validate_pnl_calculation

result = validate_pnl_calculation("BTC")
for check in result['symbols_checked']:
    if not check['matches']:
        print(f"⚠️ Discrepância em {check['symbol']}: "
              f"esperado ${check['entry_tracker_pnl']:.2f}, "
              f"calculado ${check['calculated_from_trades']:.2f}")
```

### Exemplo 3: Analisar problemas em trades_db

```python
from validate_supabase import get_trades_db

result = get_trades_db(limit=1000)
validation = result['validation']

print(f"Total de trades: {validation['total_trades']}")
print(f"Problemas encontrados: {len(validation['issues'])}")

for issue in validation['issues'][:10]:
    print(f"Trade {issue['oid']}: {', '.join(issue['issues'])}")
```

## ⚠️ Troubleshooting

### Erro: "Variáveis de ambiente não encontradas"

**Solução**: Verifique se `.env` está no diretório correto e contém `SUPABASE_URL` e `SUPABASE_KEY`.

### Erro: "supabase-py não está instalado"

**Solução**: 
```bash
pip install supabase
```

### Erro: "fastmcp não está instalado"

**Solução**: 
```bash
pip install fastmcp
```

**Nota**: FastMCP só é necessário para o servidor MCP. O script `scripts/validate_supabase.py` usa apenas `mcp.supabase_reader` (sem FastMCP).

### Erro de conexão

**Possíveis causas**:
- URL do Supabase incorreta
- Chave inválida ou expirada
- Problemas de rede/firewall
- Proxy bloqueando conexão

**Solução**: Verifique credenciais e conectividade de rede.

## 📚 Documentação Adicional

- [Relatório de Validação](./MCP_VALIDATION_REPORT.md) - Análise detalhada de alinhamento código/dados
- [Arquitetura do Bot](./ARCHITECTURE.md) - Documentação da arquitetura geral

## 🔒 Segurança

⚠️ **IMPORTANTE**: 
- O MCP expõe apenas tools de **leitura**
- Nunca commite o arquivo `.env` com credenciais
- Use `SUPABASE_ANON_KEY` se possível (read-only)
- `SUPABASE_SERVICE_KEY` tem acesso completo (use com cuidado)

## 📞 Suporte

Para problemas ou dúvidas:
1. Verifique o relatório de validação: `MCP_VALIDATION_REPORT.md`
2. Execute `python scripts/validate_supabase.py` para diagnóstico
3. Revise logs de erro no console
