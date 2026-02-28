# Changelog: Alvos e Stop Loss Customizáveis

**Data:** 16/02/2026  
**Versão:** V63

## Resumo

Implementação de alvos (take profit), stop loss e entrada 2 customizáveis para planos Pro e Satoshi. Usuários desses planos podem agora definir:
- Seus próprios níveis de fibonacci para alvos (1 obrigatório, 2 e 3 opcionais)
- Nível do stop loss
- Nível da entrada 2 (entre -0.619 e -5.0)
- Se o último alvo deve ajustar para 0.0 quando a entrada 2 executar

O plano Basic mantém as configurações padrão fixas.

## Motivação

Permitir que traders avançados (Pro/Satoshi) personalizem sua estratégia de saída e gerenciamento de risco, mantendo a simplicidade para usuários Basic.

## Mudanças Implementadas

### 1. Banco de Dados (`migrations/013_custom_targets_and_stop.sql`)

**Novas colunas em `bot_config`:**
- `stop_multiplier` (FLOAT, padrão: 1.8): Multiplicador fibonacci do stop loss
- `entry2_multiplier` (FLOAT, padrão: 1.414): Multiplicador fibonacci da entrada 2
- `entry2_adjust_last_target` (BOOLEAN, padrão: true): Se último alvo ajusta para 0.0 após entrada 2
- `target1_level` (FLOAT, padrão: 0.618): Nível fib do alvo 1 (OBRIGATÓRIO)
- `target1_percent` (INT, padrão: 50): % da posição a sair no alvo 1 (OBRIGATÓRIO)
- `target2_level` (FLOAT, padrão: 1.0): Nível fib do alvo 2 (OPCIONAL)
- `target2_percent` (INT, padrão: 50): % da posição a sair no alvo 2 (OPCIONAL)
- `target3_level` (FLOAT, padrão: NULL): Nível fib do alvo 3 (OPCIONAL)
- `target3_percent` (INT, padrão: 0): % da posição a sair no alvo 3 (OPCIONAL)

**Novas colunas em `plan_limits`:**
- `can_customize_targets` (BOOLEAN): Se o plano permite customizar alvos
- `can_customize_stop` (BOOLEAN): Se o plano permite customizar stop

**Permissões por plano:**
- **Basic**: `can_customize_targets = false`, `can_customize_stop = false`
- **Pro**: `can_customize_targets = true`, `can_customize_stop = true`
- **Satoshi**: `can_customize_targets = true`, `can_customize_stop = true`

### 2. Backend (`backend/app/routes/bot.py`)

**Modelo `BotConfigUpdate`:**
- Adicionados campos opcionais para alvos, stop e entrada 2 customizados
- Validação de ranges: 
  - Stop: 1.0-3.0
  - Entrada 2: 0.619-5.0
  - Níveis de alvo: 0.0-5.0
  - Percentuais: 0-100 (alvo 1 mínimo: 1%)

**Endpoint `/bot/config` (GET):**
- Retorna configurações de alvos e stop do usuário
- Inclui flags `can_customize_targets` e `can_customize_stop` nos limites do plano

**Endpoint `/bot/config` (PUT):**
- Valida se o plano permite customização antes de salvar
- Valida que a soma dos percentuais dos alvos seja exatamente 100%
- Valida que alvo 1 tenha percentual > 0 (obrigatório)
- Permite que alvos 2 e 3 sejam NULL (desativados)

### 3. Storage (`storage/supabase_storage.py`)

**Método `get_config()`:**
- Atualizado para buscar e retornar as novas colunas de alvos, stop e entrada 2
- Valores padrão: 
  - stop=1.8
  - entry2=1.414
  - entry2_adjust_last_target=true
  - target1=0.618 (50%)
  - target2=1.0 (50%)
  - target3=NULL (0%)

### 4. Bot Engine (`bot.py`)

**Variáveis globais:**
- `FIB_LEVELS` e `FIB_STOP_LEVEL` agora são dinâmicos, carregados do banco

**Função `load_config()`:**
- Carrega alvos e stop customizados do storage
- Reconstrói `FIB_LEVELS` com base nas configurações do usuário
- Atualiza `FIB_STOP_LEVEL` com o multiplicador customizado
- Log de inicialização mostra alvos e stop configurados

**Função `place_fib_tps()`:**
- Quando `entry2_filled=True` E `ENTRY2_ADJUST_LAST_TARGET=true`, ajusta último alvo para 0.0
- Se usuário desativar o ajuste, mantém os alvos originais mesmo após entrada 2
- Permite flexibilidade para diferentes estratégias

**Função `entry_2()`:**
- Usa `FIB_ENTRY2_LEVEL` (agora customizável) para calcular o preço da entrada 2

**Lógica de cancelamento de ordens:**
- Usa `FIB_LEVELS[0][0]` (primeiro alvo configurado) para determinar quando cancelar ordens pendentes

**Trailing Stop (Breakeven):**
- Usa `FIB_LEVELS[0][0]` (primeiro alvo configurado) para determinar quando mover stop para breakeven

### 5. Frontend (`frontend/app/dashboard/bot/page.tsx`)

**Novos estados:**
- `stopMultiplier`, `entry2Multiplier`, `entry2AdjustLastTarget`
- `target1Level`, `target1Percent`, `target2Level`, `target2Percent`, `target3Level`, `target3Percent`

**Nova seção na UI: "Configurações Avançadas"**
- Visível apenas para planos Pro e Satoshi
- **Seção colapsável**: Oculta por padrão, usuário clica para expandir
- **Aviso para iniciantes**: "Se você é iniciante e não assistiu as aulas, não altere nada aqui. As configurações padrão já estão otimizadas."
- **Botão "Redefinir Padrão"**: Restaura todos os valores para os padrões originais
- Campo para **Stop Loss** (multiplicador fibonacci, 1.0-3.0)
- Campo para **Entrada 2** (multiplicador fibonacci, 0.619-5.0) - visível apenas se entrada 2 permitida
- Toggle para **ajustar último alvo para 0.0** após entrada 2 executar
- Campos para **3 alvos**: nível fibonacci e percentual
  - **Alvo 1**: OBRIGATÓRIO (marcado com *)
  - **Alvo 2**: OPCIONAL (pode deixar em 0)
  - **Alvo 3**: OPCIONAL (pode deixar em 0)
- **Inputs decimais corrigidos**: Permite digitar ponto/vírgula para valores como 0.618, 1.5, etc.
- Validação visual em tempo real: mostra soma dos percentuais
- Alertas:
  - Se alvo 1 está zerado (obrigatório)
  - Se soma ≠ 100%

**Comportamento dos inputs:**
- Mesma UX melhorada dos outros campos numéricos
- Permite limpar campo, auto-clamp nos limites, restaura padrão no blur

**Salvamento:**
- Envia alvos, stop e entrada 2 apenas se o plano permitir
- Se alvos 2 ou 3 forem 0, envia como NULL para o backend
- Alvo 1 sempre é enviado (obrigatório)

## Valores Padrão

**Para todos os planos:**
- Stop Loss: -1.8 fib
- Entrada 2: -1.414 fib
- Ajustar último alvo após entrada 2: Ativado
- **Alvo 1: 0.618 fib (50% da posição)** ← OBRIGATÓRIO
- **Alvo 2: 1.0 fib (50% da posição)**
- Alvo 3: Desativado

**Plano Basic:**
- Valores fixos, não podem ser alterados

**Planos Pro e Satoshi:**
- Todos os valores podem ser customizados
- **Alvo 1 é obrigatório** (deve ter percentual > 0)
- Alvos 2 e 3 são opcionais (deixe em 0 para desativar)
- Soma dos percentuais deve ser 100%
- Entrada 2 customizável: -0.619 a -5.0

## Comportamento Especial

### Entrada 2 Executada
Quando a segunda entrada é executada (nível customizável, padrão -1.414), o comportamento do **último alvo** depende da configuração:

- **Se "Ajustar último alvo" = ATIVADO** (padrão): O último alvo vai para 0.0 fib (retorno ao setup_high/setup_low) para saída rápida em caso de reversão
- **Se "Ajustar último alvo" = DESATIVADO**: Mantém os alvos originais configurados pelo usuário

### Trailing Stop
O trailing stop (breakeven) é acionado quando:
1. O primeiro alvo (TP1) é executado, OU
2. O preço atinge o nível do primeiro alvo configurado

Nesse momento, o stop é movido para o preço de entrada (breakeven).

## Exemplos de Configuração

### Conservador (Saída Rápida)
- Alvo 1: 0.382 fib (100%)
- Alvo 2: Desativado
- Alvo 3: Desativado
- Stop: -1.5 fib
- Entrada 2: -1.2 fib

### Padrão (Atual)
- Alvo 1: 0.618 fib (50%)
- Alvo 2: 1.0 fib (50%)
- Alvo 3: Desativado
- Stop: -1.8 fib
- Entrada 2: -1.414 fib
- Ajustar último alvo: Ativado

### Balanceado (2 Alvos)
- Alvo 1: 0.618 fib (50%)
- Alvo 2: 1.0 fib (50%)
- Alvo 3: Desativado
- Stop: -1.8 fib
- Entrada 2: -1.414 fib
- Ajustar último alvo: Ativado

### Agressivo (Maximizar Ganhos)
- Alvo 1: 0.618 fib (30%)
- Alvo 2: 1.0 fib (40%)
- Alvo 3: 1.618 fib (30%)
- Stop: -2.0 fib
- Entrada 2: -1.6 fib
- Ajustar último alvo: Desativado (mantém alvos originais)

### Escalonado
- Alvo 1: 0.5 fib (25%)
- Alvo 2: 1.0 fib (50%)
- Alvo 3: 1.5 fib (25%)
- Stop: -1.8 fib
- Entrada 2: -1.414 fib
- Ajustar último alvo: Ativado

## Validações

### Backend
- ✅ Stop: 1.0 – 3.0
- ✅ Entrada 2: 0.619 – 5.0
- ✅ Níveis de alvo: 0.0 – 5.0
- ✅ Percentuais: 0 – 100
- ✅ **Alvo 1 deve ter percentual > 0** (obrigatório)
- ✅ Soma dos percentuais = 100%
- ✅ Apenas Pro/Satoshi podem customizar
- ✅ Alvos 2 e 3 podem ser NULL (desativados)

### Frontend
- ✅ Campos desabilitados para plano Basic
- ✅ Validação visual da soma em tempo real
- ✅ Alerta se alvo 1 está zerado
- ✅ Auto-clamp nos limites permitidos
- ✅ Permite limpar e redigitar valores
- ✅ Restaura padrões se campo vazio no blur
- ✅ Toggle visual para ajuste de último alvo após entrada 2

## Notas Técnicas

1. **Primeira entrada fixa em -0.618**: O ponto da primeira entrada continua fixo em -0.618 fib (não customizável).

2. **Segunda entrada customizável**: Usuários Pro/Satoshi podem ajustar entre -0.619 e -5.0 fib (padrão: -1.414).

3. **Alvo 1 obrigatório**: Deve sempre ter um nível e percentual > 0. Alvos 2 e 3 são opcionais.

4. **Compatibilidade**: Usuários existentes foram atualizados para o padrão (alvo 1 = 50%, alvo 2 = 50%, alvo 3 desativado).

5. **Reload do bot**: Após alterar configurações, o bot será reiniciado em até 30 segundos (se estiver ligado) para aplicar as mudanças.

6. **Logs**: O bot exibe no log de inicialização: `📊 Alvos: [(0.618, 0.5), (1.0, 0.5)], Stop: -1.8, Entrada2: -1.414`

## Testes Recomendados

1. ✅ Usuário Basic tenta alterar alvos/stop → Deve ver campos desabilitados
2. ✅ Usuário Pro configura apenas alvo 1 (100%) → Deve salvar e funcionar
3. ✅ Usuário Pro altera alvos para 30/40/30 → Deve salvar e bot usar novos valores
4. ✅ Usuário tenta configurar soma ≠ 100% → Backend rejeita com erro
5. ✅ Usuário tenta deixar alvo 1 em 0% → Backend rejeita (obrigatório)
6. ✅ Usuário desativa alvos 2 e 3 (deixa em 0) → Deve funcionar com 1 alvo apenas
7. ✅ Usuário altera entrada 2 para -1.2 → Bot deve colocar entrada 2 no novo nível
8. ✅ Usuário desativa "ajustar último alvo" → Entrada 2 não altera alvos
9. ✅ Bot com alvos customizados executa trade → TPs nos níveis corretos
10. ✅ Trade atinge alvo 1 customizado → Trailing stop move para breakeven
11. ✅ Segunda entrada executada com ajuste ativado → Último alvo vai para 0.0
12. ✅ Segunda entrada executada com ajuste desativado → Alvos mantêm configuração original
