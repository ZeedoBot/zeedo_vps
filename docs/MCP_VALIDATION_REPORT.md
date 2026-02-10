# Relatório de Validação: Supabase vs Código do Bot

## 📋 Resumo Executivo

Este relatório documenta a análise de alinhamento entre:
- **Dados reais no Supabase** (tabela `bot_state`)
- **Lógica esperada pelo código** (`bot.py`, `storage/supabase_storage.py`)

## 🏗️ Arquitetura de Dados

### Tabela Supabase: `bot_state`

```sql
CREATE TABLE bot_state (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb
);
```

### Chaves Esperadas

| Chave | Tipo Esperado | Estrutura |
|-------|---------------|-----------|
| `entry_tracker` | `dict` | `{symbol: {side, tf, placed_at, signal_ts, planned_stop, pnl_realized, ...}}` |
| `history_tracker` | `dict` | `{symbol: {timeframe: timestamp}}` |
| `trades_db` | `list` | `[{coin, oid, time, closedPnl/pnl, fee, pnl_usd, side, tf, ...}]` |
| `config` | `dict` | `{symbols: [], timeframes: [], trade_mode: 'BOTH'}` |

---

## ✅ O Que Está 100% Correto

### 1. Estrutura de Armazenamento

- ✅ **Tabela única `bot_state`**: Implementação correta usando key-value com JSONB
- ✅ **Abstração de persistência**: `StorageBase` interface bem definida
- ✅ **Compatibilidade**: `SupabaseStorage` espelha fielmente `LocalStorage`

### 2. Campos Críticos em `entry_tracker`

O código espera e usa corretamente:

```python
# Campos obrigatórios (linha 954-971)
'side': str                    # "long" ou "short"
'tf': str                      # Timeframe (ex: "15m")
'placed_at': float            # Timestamp Unix
'signal_ts': float            # Timestamp do sinal
'planned_stop': float         # Preço do stop planejado
'pnl_realized': float         # PnL realizado acumulado
'last_size': float            # Último tamanho da posição

# Campos opcionais (segunda/terceira entrada)
'second_entry_px': float
'second_entry_qty': float
'second_entry_placed': bool
'third_entry_placed': bool
'reentry_candle_ts': int
'post_reentry_sl_moved': bool
'breakeven_moved': bool

# Campos técnicos
'tech_base': float            # Base técnica para cálculos de fib
'setup_high': float
'setup_low': float
'entry_px': float
'qty': float
'trade_id': str
```

**Status**: ✅ Todos esses campos são lidos/escritos corretamente pelo código.

### 3. Campos Críticos em `trades_db`

O código processa fills esperando:

```python
# Campos obrigatórios (linha 616-683)
'coin': str                    # Símbolo (ou 'symbol', 'market' como fallback)
'oid': str                     # Order ID (ou 'id' como fallback)

# Campos de PnL (linha 653-656)
'closedPnl': float            # PnL fechado (preferencial)
'pnl': float                   # Fallback se closedPnl não existir
'fee': float                   # Taxa cobrada
'pnl_usd': float               # PnL líquido calculado (pnl - fee)

# Campos de identificação
'time': int                    # Timestamp (ou 't', 'timestamp')
'dir': str                     # Direção ("Long", "Short")
'side': str                    # Fallback se dir não existir ('B'/'BUY' = LONG)

# Campos de contexto
'tf': str                      # Timeframe
'trade_id': str                # ID do trade
'num_fills': int               # Número de micro-fills agrupados
```

**Status**: ✅ O código trata corretamente múltiplos fallbacks para campos opcionais.

### 4. Cálculo de PnL

**Lógica no código** (linha 648-663):

```python
# Para cada fill:
closed_pnl = float(fill.get('closedPnl', fill.get('pnl', 0) or 0))
fee = float(fill.get('fee', 0) or 0)
total_pnl += closed_pnl
total_fee += fee

pnl_net = total_pnl - total_fee

# Acumula no entry_tracker:
pnl_fill = float(fill.get("closedPnl", 0) or 0) - float(fill.get("fee", 0) or 0)
trade["pnl_realized"] += pnl_fill
```

**Status**: ✅ Lógica correta e robusta com fallbacks.

---

## ⚠️ Possíveis Desalinhamentos Identificados

### 1. Variável de Ambiente: `SUPABASE_KEY` vs `SUPABASE_SERVICE_KEY`

**Problema**:
- `.env` define: `SUPABASE_KEY`
- Código original esperava: `SUPABASE_SERVICE_KEY` ou `SUPABASE_ANON_KEY`

**Correção Aplicada**:
- ✅ Atualizado `supabase_storage.py` linha 26 para aceitar `SUPABASE_KEY` como fallback
- ✅ Atualizado `mcp/supabase_reader.py` e `storage/supabase_storage.py` para aceitar `SUPABASE_KEY`

**Status**: ✅ **CORRIGIDO**

### 2. Detecção de Side em `trades_db`

**Código atual** (linha 666-673):

```python
raw_dir = str(base_fill.get('dir') or "")
if "Long" in raw_dir or raw_dir.lower().startswith("long"):
    side = "LONG"
elif "short" in raw_dir or raw_dir.lower().startswith("short"):
    side = "SHORT"
else:
    side = "LONG" if str(base_fill.get('side','')).upper() in ('B','BUY') else "SHORT"
```

**Potencial problema**:
- Se `dir` não existir e `side` também não existir, assume `"LONG"` por padrão
- Pode gerar side incorreto se o fill realmente for SHORT mas não tiver esses campos

**Recomendação**: 
- ⚠️ Validar se dados reais do Supabase sempre têm `dir` ou `side` preenchidos
- Se não, considerar adicionar log de warning quando usar fallback

**Status**: ⚠️ **REQUER VALIDAÇÃO COM DADOS REAIS**

### 3. Timestamp em `trades_db`

**Código atual** (linha 623, 633):

```python
fill_ts = base_fill.get('time') or base_fill.get('t') or base_fill.get('timestamp') or 0
```

**Potencial problema**:
- Se nenhum campo existir, usa `0`, o que pode causar problemas na comparação (linha 626, 639)
- Comparação `abs(int(fill_ts) - tracker_ts) < 86400000` pode falhar se `fill_ts == 0`

**Recomendação**:
- ⚠️ Validar se dados reais sempre têm pelo menos um campo de timestamp
- Se não, considerar tratar `0` como caso especial

**Status**: ⚠️ **REQUER VALIDAÇÃO COM DADOS REAIS**

### 4. Identificação de Símbolo em `trades_db`

**Código atual** (linha 618):

```python
coin = base_fill.get('coin') or base_fill.get('symbol') or base_fill.get('market') or None
```

**Potencial problema**:
- Se nenhum campo existir, `coin = None`, o que pode causar problemas nas linhas 622, 636
- O código verifica `if coin and coin in entry_tracker:` mas pode perder fills se `coin` for None

**Recomendação**:
- ⚠️ Validar se dados reais sempre têm pelo menos um campo de símbolo
- Se não, considerar log de warning para fills sem símbolo identificável

**Status**: ⚠️ **REQUER VALIDAÇÃO COM DADOS REAIS**

---

## 🔧 Correções Aplicadas no Código

### 1. Suporte a `SUPABASE_KEY` no `.env`

**Arquivo**: `storage/supabase_storage.py`
- **Linha 26**: Adicionado fallback para `SUPABASE_KEY`

**Arquivo**: `mcp/supabase_reader.py` (e `storage/supabase_storage.py`)
- **Linha 30**: Adicionado fallback para `SUPABASE_KEY`

---

## 📊 Ferramentas de Validação Criadas

### 1. MCP Server: `mcp/validator.py` (usa `mcp/supabase_reader.py`)

**Tools disponíveis**:

| Tool | Descrição |
|------|-----------|
| `get_bot_state_keys()` | Lista todas as chaves na tabela `bot_state` |
| `get_entry_tracker(symbol=None)` | Consulta `entry_tracker` completo ou de um símbolo específico |
| `get_history_tracker()` | Consulta `history_tracker` completo |
| `get_trades_db(limit=100, symbol=None)` | Consulta `trades_db` com validação de campos |
| `get_config()` | Consulta `config` do bot |
| `validate_pnl_calculation(symbol=None)` | Validação cruzada de PnL entre `entry_tracker` e `trades_db` |
| `get_schema_info()` | Retorna schema esperado pelo código |

**Uso**:
```bash
# Como servidor MCP (requer FastMCP)
python -m mcp.validator

# Ou importar funções diretamente
from mcp.supabase_reader import get_entry_tracker, get_trades_db
```

### 2. Script de Validação: `scripts/validate_supabase.py`

**Funcionalidades**:
- ✅ Verifica conexão e chaves disponíveis
- ✅ Valida estrutura de `entry_tracker`
- ✅ Valida estrutura de `history_tracker`
- ✅ Valida estrutura de `trades_db` (campos, tipos, problemas)
- ✅ Valida estrutura de `config`
- ✅ Validação cruzada de PnL (`entry_tracker` vs `trades_db`)
- ✅ Relatório detalhado de inconsistências

**Uso**:
```bash
python scripts/validate_supabase.py
```

---

## 🎯 Próximos Passos Recomendados

### 1. Executar Validação com Dados Reais

```bash
# Certifique-se de que .env está configurado
python scripts/validate_supabase.py
```

### 2. Validar Campos Críticos

Após executar a validação, verificar:

- ✅ Todos os trades têm `coin`, `oid`, `time`?
- ✅ Todos os trades têm `closedPnl` ou `pnl`?
- ✅ Todos os trades têm `fee`?
- ✅ Todos os trades têm `dir` ou `side`?
- ✅ PnL calculado bate com `pnl_realized` no `entry_tracker`?

### 3. Configurar MCP no Cursor (Opcional)

Para usar o MCP no Cursor para desenvolvimento:

1. Instalar FastMCP:
   ```bash
   pip install fastmcp
   ```

2. Configurar MCP no Cursor (`.cursor/mcp.json` ou Settings):
   ```json
   {
     "mcpServers": {
       "supabase-validator": {
         "command": "python",
         "args": ["-m", "mcp.validator"]
       }
     }
   }
   ```

3. Usar no Cursor:
   - O Cursor poderá consultar dados reais do Supabase
   - Útil para debugging e auditoria durante desenvolvimento

---

## 📝 Conclusão

### ✅ Pontos Fortes

1. **Arquitetura sólida**: Abstração de persistência bem implementada
2. **Fallbacks robustos**: Código trata múltiplos formatos de campos
3. **Validação de tipos**: Código verifica tipos antes de usar
4. **Estrutura consistente**: Schema JSONB permite flexibilidade sem perder estrutura

### ⚠️ Pontos de Atenção

1. **Campos opcionais**: Alguns campos críticos têm fallbacks que podem mascarar problemas
2. **Validação de dados**: Falta validação explícita de dados ao ler do Supabase
3. **Logs de warning**: Poucos logs quando fallbacks são usados

### 🔄 Melhorias Sugeridas (Futuro)

1. Adicionar validação explícita ao ler dados do Supabase
2. Adicionar logs de warning quando fallbacks são usados
3. Adicionar métricas de qualidade de dados (ex: % de trades com todos os campos)
4. Considerar schema validation usando bibliotecas como `pydantic` ou `jsonschema`

---

## 📚 Arquivos Criados/Modificados

### Novos Arquivos

- ✅ `mcp/validator.py` - Servidor MCP com tools de validação
- ✅ `mcp/supabase_reader.py` - Leitura Supabase compartilhada
- ✅ `scripts/validate_supabase.py` - Script de validação
- ✅ `MCP_VALIDATION_REPORT.md` - Este relatório

### Arquivos Modificados

- ✅ `storage/supabase_storage.py` - Adicionado suporte a `SUPABASE_KEY`

---

**Data da Análise**: 2026-02-02  
**Versão do Código Analisado**: Bot - Mainnet (V1)  
**Status Geral**: ✅ **Código bem alinhado com estrutura esperada. Requer validação com dados reais para confirmar.**
