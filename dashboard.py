import streamlit as st
import pandas as pd
import json
import os
import time
import subprocess
import sys
import psutil 
import shutil
from datetime import datetime, timedelta, time as dt_time
from dotenv import load_dotenv
from hyperliquid.info import Info
from hyperliquid.utils import constants

#Para rodar o dashboard: streamlit run dashboard.py

load_dotenv()
st.set_page_config(page_title="Zeedo Bot", page_icon="📈", layout="wide", initial_sidebar_state="expanded")
st.markdown("""
    <style>
    div.stMetric { background-color: #1E1E1E; padding: 15px; border-radius: 8px; border: 1px solid #333; }
    .stDataFrame { border: none !important; }
    </style>
""", unsafe_allow_html=True)

st.title("🚀 Zeedo - Mainnet")

TRACKER_FILE = "bot_tracker.json"
HISTORY_FILE = "bot_history.json"
TRADES_DB = "trades_database.json"
LOG_FILE = "bot_trades.log"
PID_FILE = "bot_process.pid" 
CONFIG_FILE = "bot_config.json"

def load_json(filename):
    if os.path.exists(filename):
        try:
            with open(filename, 'r') as f: return json.load(f)
        except: return {}
    return {}

def save_json(filename, data):
    try:
        with open(filename, 'w') as f: json.dump(data, f, indent=4)
        return True
    except: return False

def load_logs(n_lines=100):
    if os.path.exists(LOG_FILE):
        try:
            with open(LOG_FILE, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
                return [line.strip() for line in lines[-n_lines:]][::-1] 
        except PermissionError:
            try:
                temp_file = LOG_FILE + ".tmp_read"
                shutil.copy(LOG_FILE, temp_file)
                with open(temp_file, 'r', encoding='utf-8', errors='ignore') as f:
                    lines = f.readlines()
                os.remove(temp_file) 
                return [line.strip() for line in lines[-n_lines:]][::-1] 
            except:
                return ["Arquivo de log travado temporariamente."]
        except:
            return ["Erro genérico ao ler logs."]
    return []

def get_bot_status():
    if os.path.exists(PID_FILE):
        try:
            with open(PID_FILE, 'r') as f: pid = int(f.read().strip())
            if psutil.pid_exists(pid): return True, pid
        except: pass
    return False, None

def kill_bot(pid):
    try:
        process = psutil.Process(pid)
        process.terminate()
        time.sleep(1)
        if process.is_running(): process.kill()
        return True
    except: return False

@st.cache_data(show_spinner=False) 
def get_hyperliquid_state_cached():
    try:
        address = os.getenv("HYPER_ACCOUNT_ADDRESS")
        if not address: return None
        info = Info(constants.MAINNET_API_URL, skip_ws=True)
        return info.user_state(address)
    except Exception: return None

# === FUNÇÃO DE MIGRAÇÃO E LIMPEZA ===
def migrate_and_clean_db(trades):
    if not isinstance(trades, list): return trades
    cleaned_trades = []
    has_changes = False
    
    for t in trades:
        current_side = t.get('side', '')
        current_tf = t.get('tf', '-')
        
        needs_fix = ('closedPnl' in t) or (current_side in ['A', 'B']) or ('tf' not in t) or ('trade_id' not in t)
        
        if not needs_fix:
            cleaned_trades.append(t)
            continue
            
        has_changes = True
        oid = str(t.get('oid', ''))
        ts = t.get('time', 0)
        token = t.get('coin', t.get('token', '?'))
        tf = current_tf 
        trade_id = t.get('trade_id', '-')
        
        raw_dir = t.get('dir', '')
        if "Long" in raw_dir: side = "LONG"
        elif "Short" in raw_dir: side = "SHORT"
        else: side = "LONG" if current_side == 'B' else "SHORT"

        try:
            size_usd = float(t.get('size_usd', 0))
            if size_usd == 0:
                sz = float(t.get('sz', 0))
                px = float(t.get('px', 0))
                size_usd = sz * px
            closed_pnl = float(t.get('pnl_usd', t.get('closedPnl', 0)))
        except:
            size_usd, closed_pnl = 0, 0
        
        pnl_pct = float(t.get('pnl_pct', 0))
        if pnl_pct == 0 and closed_pnl != 0 and size_usd > 0:
            invested = size_usd - closed_pnl if side == "LONG" else size_usd + closed_pnl
            if invested > 0: pnl_pct = (closed_pnl / invested) * 100
        
        # PRESERVA OS DADOS ORIGINAIS (sz, px, etc) PARA O BOT NÃO DUPLICAR
        new_trade = t.copy()
        new_trade.update({
            "oid": oid,
            "trade_id": trade_id,
            "time": ts,
            "token": token,
            "tf": tf,
            "side": side,
            "size_usd": round(size_usd, 2),
            "pnl_usd": round(closed_pnl, 4),
            "pnl_pct": round(pnl_pct, 2)
        })
        cleaned_trades.append(new_trade)
            
    if has_changes:
        # save_json(TRADES_DB, cleaned_trades)
        return cleaned_trades
    return trades

# SIDEBAR
with st.sidebar:
    st.header("🎮 Operação")
    is_running, pid = get_bot_status()
    
    if is_running:
        st.success(f"🟢 ONLINE (PID: {pid})")
        if st.button("🔴 DESLIGAR BOT", type="primary", width="stretch"):
            if kill_bot(pid):
                if os.path.exists(PID_FILE): os.remove(PID_FILE)
                st.rerun()
    else:
        st.error("⚫ OFFLINE")
        if st.button("🚀 LIGAR BOT", width="stretch"):
            current_dir = os.getcwd()
            bot_file = "bot.py" 
            
            if os.name == 'nt':
                subprocess.Popen([sys.executable, bot_file], cwd=current_dir, creationflags=0)
            else:
                subprocess.Popen([sys.executable, bot_file], cwd=current_dir)
            time.sleep(3)
            st.rerun()
    
    st.markdown("---")
    st.header("⚙️ Configurações")
    config = load_json(CONFIG_FILE)
    trade_mode = st.selectbox(
    "Modo de Operação:",
    options=["BOTH", "LONG_ONLY", "SHORT_ONLY"],
    index=["BOTH", "LONG_ONLY", "SHORT_ONLY"].index(
        config.get("trade_mode", "BOTH")
    )
)
    DEFAULT_SYMBOLS = ["BTC", "ETH", "SOL", "AVAX", "LINK", "SUI", "HYPE", "XRP", "AAVE", "DOGE", "BNB", "ADA", "UNI", "NEAR", "DOT", "ZEC", "SEI", "ARB", "ENA"]
    DEFAULT_TFS = ["5m", "15m", "30m", "1h", "4h", "1d"]
    
    selected_symbols = st.multiselect("Moedas:", options=DEFAULT_SYMBOLS, default=config.get("symbols", ["BTC", "ETH", "SOL", "AVAX", "LINK", "SUI", "HYPE", "XRP", "AAVE", "DOGE", "BNB", "ADA", "UNI", "NEAR", "DOT", "ZEC", "SEI", "ARB", "ENA"]))
    selected_tfs = st.multiselect("Timeframes (Bot):", options=DEFAULT_TFS, default=config.get("timeframes", ["15m", "30m", "1h", "4h", "1d"]))
    
    if st.button("💾 Salvar Config", width="stretch"):
        if save_json(
            CONFIG_FILE,
            {
                "symbols": selected_symbols,
                "timeframes": selected_tfs,
                "trade_mode": trade_mode
            }
        ):
            st.toast("Salvo!", icon="✅")
    
    st.markdown("---")
    st.header("🧹 Manutenção")
    log_keyword = st.text_input("Apagar linhas contendo:", placeholder="Ex: Ignorado", label_visibility="collapsed")
    
    if st.button("🗑️ Limpar Arquivo de Log", width="stretch"):
        if not log_keyword:
            st.warning("Digite uma palavra-chave para filtrar.")
        elif os.path.exists(LOG_FILE):
            try:
                shutil.copy(LOG_FILE, f"{LOG_FILE}.bak")
                with open(LOG_FILE, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                new_lines = [line for line in lines if log_keyword not in line]
                removed_count = len(lines) - len(new_lines)
                if removed_count > 0:
                    with open(LOG_FILE, 'w', encoding='utf-8') as f:
                        f.writelines(new_lines)
                    st.toast(f"Sucesso! {removed_count} linhas removidas.", icon="✅")
                    time.sleep(1)
                    st.rerun()
                else:
                    st.info("Nenhuma linha encontrada.")
            except Exception as e:
                st.error(f"Erro ao limpar: {e}")
        else:
            st.error("Arquivo de log não encontrado.")

    st.markdown("---")
    if st.button('🔄 Atualizar Tudo'):
        get_hyperliquid_state_cached.clear()
        st.rerun()

# MAIN
tracker_data = load_json(TRACKER_FILE)
history_trades_data_raw = load_json(TRADES_DB)
history_trades_data = migrate_and_clean_db(history_trades_data_raw)
logs = load_logs()

user_state = get_hyperliquid_state_cached()
real_balance = 0.0
if user_state:
    try: real_balance = float(user_state["marginSummary"]["accountValue"])
    except: pass

active_positions = {}
if user_state:
    for p in user_state.get("assetPositions", []):
        sz = float(p["position"]["szi"])
        if sz != 0:
            active_positions[p["position"]["coin"]] = sz

active_orders_display = []
if tracker_data:
    for symbol, info in tracker_data.items():
        qty = info.get('qty', 0) 
        entry_price = info.get('entry_px', 0)
        usd_val = qty * entry_price if qty and entry_price else 0
        placed_ts = info.get('placed_at', time.time())
        created_str = datetime.fromtimestamp(placed_ts).strftime('%d/%m %H:%M')
        stop_val = info.get('planned_stop', 0)
        init_stop = info.get('initial_stop', stop_val)
        
        if symbol in active_positions:
            status = "🟢 ATIVA"
            pos_size = active_positions[symbol]
            side = "LONG" if pos_size > 0 else "SHORT"
        else:
            status = "⏳ PENDENTE"
            side = "LONG" if entry_price > init_stop else "SHORT"
        
        active_orders_display.append({
            "Ticker": symbol,
            "TF": info.get('tf', '-'),
            "Lado": side,
            "Status": status,
            "Entrada": f"${entry_price:.2f}" if entry_price else "-",
            "Valor": f"${usd_val:.0f}",
            "Stop Atual": f"${stop_val:.2f}",
            "Criado": created_str
        })

list_open_positions = [o for o in active_orders_display if "ATIVA" in o["Status"]]
list_pending_orders = [o for o in active_orders_display if "PENDENTE" in o["Status"]]

# 2. PAINEL DE LUCROS (FILTROS)
st.markdown("### 📊 Painel de Lucros e Performance")

c_filter1, c_filter2, c_filter3 = st.columns(3)
filter_start_ts = 0
filter_end_ts = float('inf')

with c_filter1:
    period_options = ["24 Horas", "1 Semana", "1 Mês", "3 meses", "6 meses", "1 ano", "All Time", "Personalizado"]
    selected_period_label = st.selectbox("📅 Período:", period_options, index=5)
    
    if selected_period_label == "Personalizado":
        today = datetime.now().date()
        date_range = st.date_input("Selecione o intervalo:", value=(today, today), max_value=today, format="DD/MM/YYYY")
        if isinstance(date_range, tuple):
            start_date = date_range[0]
            end_date = date_range[1] if len(date_range) > 1 else start_date
            filter_start_ts = datetime.combine(start_date, dt_time.min).timestamp() * 1000
            filter_end_ts = datetime.combine(end_date, dt_time.max).timestamp() * 1000
    else:
        days_map = {"24 Horas": 1, "1 Semana": 7, "1 Mês": 30, "3 meses": 90, "6 meses": 180, "1 ano": 360}
        if selected_period_label in days_map:
            cutoff_days = days_map[selected_period_label]
            filter_start_ts = (time.time() - (cutoff_days * 86400)) * 1000

with c_filter2:
    FIXED_TOKENS = ["BTC", "ETH", "SOL", "AVAX", "LINK", "SUI", "HYPE", "XRP", "AAVE", "DOGE", "BNB", "ADA", "UNI", "NEAR", "DOT", "ZEC", "SEI", "ARB", "ENA"]
    tokens_filter = st.multiselect("Filtrar Token:", options=FIXED_TOKENS, default=[])

with c_filter3:
    available_tfs = sorted(list(set([t.get('tf', '-') for t in history_trades_data]))) if isinstance(history_trades_data, list) else []
    tfs_filter = st.multiselect("Filtrar Timeframe:", options=available_tfs, default=[])

hide_zeros = st.checkbox("Ocultar PnL Zero", value=True)

filtered_history = []
if isinstance(history_trades_data, list):
    history_trades_data.sort(key=lambda x: x['time'], reverse=True)
    for trade in history_trades_data:
        t_ts = trade.get('time', 0)
        t_token = trade.get('token', '')
        t_pnl = float(trade.get('pnl_usd', 0))
        t_tf = trade.get('tf', '-')
        
        is_time_ok = (t_ts >= filter_start_ts and t_ts <= filter_end_ts)
        is_token_ok = t_token in tokens_filter if tokens_filter else t_token in FIXED_TOKENS
        is_tf_ok = t_tf in tfs_filter if tfs_filter else True
        is_zero_ok = not (hide_zeros and t_pnl == 0)

        if is_time_ok and is_token_ok and is_zero_ok and is_tf_ok:
            filtered_history.append(trade)

# === CHANGE START: Cálculo de métricas baseado em Trades Agrupados ===
f_pnl = sum([float(t.get('pnl_usd', 0)) for t in filtered_history])

# Agrupamento para contagem correta de Wins/Total (Trades completos e não Fills)
if filtered_history:
    df_temp = pd.DataFrame(filtered_history)
    # Garante que temos uma chave de agrupamento (trade_id ou oid como fallback)
    df_temp['group_key'] = df_temp['trade_id'].replace('-', pd.NA).fillna(df_temp['oid'])
    
    df_grouped_trades = df_temp.groupby('group_key')['pnl_usd'].sum()
    
    f_total = len(df_grouped_trades)
    f_wins = (df_grouped_trades > -0.5).sum()
    f_winrate = (f_wins / f_total * 100) if f_total > 0 else 0.0
else:
    f_total = 0
    f_wins = 0
    f_winrate = 0.0
# === CHANGE END ===

balance_display = f"${real_balance:,.2f}" if real_balance is not None else "---"

st.markdown("#### Resumo")

ts_24h_ago = (time.time() - 86400) * 1000
pnl_24h = 0.0
if isinstance(history_trades_data, list):
    pnl_24h = sum([float(t.get('pnl_usd', 0)) for t in history_trades_data if t.get('time', 0) >= ts_24h_ago])

# Cálculo da % de 24h sobre a banca atual
pct_24h = (pnl_24h / real_balance * 100) if real_balance > 0 else 0.0

k1, k2, k3, k4 = st.columns(4)
k1.metric("Saldo Real", balance_display)
k2.metric("Total Trades", f_total) # Renomeado para Trades
k3.metric("Taxa de Acerto", f"{f_winrate:.1f}%")
k4.metric("Lucro Líquido", f"${f_pnl:.2f}", delta=f"${pnl_24h:.2f} (24h)")

# === 3. ANÁLISE AVANÇADA ===
st.markdown("#### Analytics")

if filtered_history:
    df_analytics = pd.DataFrame(filtered_history)
    df_analytics['DataHora'] = pd.to_datetime(df_analytics['time'], unit='ms')
    
    # 1. CURVA DE CRESCIMENTO (Baseado em Fills é OK para curva financeira)
    df_curve = df_analytics.sort_values('time', ascending=True).copy()
    df_curve['Saldo Acumulado'] = df_curve['pnl_usd'].cumsum()
    st.line_chart(df_curve, x='DataHora', y='Saldo Acumulado', height=250)
    
    # 2. PAYOFF E MÉTRICAS (Baseado em Trades Agrupados para precisão)
    df_analytics['group_key'] = df_analytics['trade_id'].replace('-', pd.NA).fillna(df_analytics['oid'])
    grouped_stats = df_analytics.groupby('group_key')['pnl_usd'].sum()
    
    wins = grouped_stats[grouped_stats > -0.5]
    losses = grouped_stats[grouped_stats <= -0.5]
    
    avg_win = wins.mean() if not wins.empty else 0
    avg_loss = losses.mean() if not losses.empty else 0
    payoff = abs(avg_win / avg_loss) if avg_loss != 0 else 0
    
    # === CÁLCULO DO CRESCIMENTO DA CONTA (PERDA/GANHO % SOBRE BANCA) ===
    percent_account = (f_pnl / real_balance * 100) if real_balance > 0 else 0.0
    
    m1, m2, m3, m4 = st.columns(4)
    m1.metric("Média Lucro", f"${avg_win:.2f}")
    m2.metric("Média Prejuízo", f"${avg_loss:.2f}")
    m3.metric("Payoff", f"{payoff:.2f}")
    m4.metric("Lucro %", f"{percent_account:.2f}%", delta=f"{pct_24h:.2f}% (24h)")

    st.markdown("---")
    
    # Função auxiliar para gerar tabelas agrupadas corretamente
    def calculate_metrics_grouped(df, group_col):
        # 1. Agrupa por Trade ID primeiro (consolida parciais) + Coluna Alvo
        # Preserva a coluna de agrupamento pegando o primeiro valor (já que um trade tem mesmo lado/token)
        df_trades = df.groupby('group_key').agg({
            'pnl_usd': 'sum',
            group_col: 'first' 
        }).reset_index()
        
        # 2. Agrupa pela coluna alvo (Lado, TF, Token)
        res = df_trades.groupby(group_col).agg(
            PnL=('pnl_usd', 'sum'),
            Qtd=('pnl_usd', 'count'), # Conta Trades únicos
            Wins=('pnl_usd', lambda x: (x > 0.5).sum()),
            Losses=('pnl_usd', lambda x: (x <= -0.5).sum()) # <--- NOVA LINHA
        )
        res['Win Rate'] = (res['Wins'] / res['Qtd'] * 100).fillna(0)
        return res

    # 3. RAIO-X (COM QUANTIDADE E PORCENTAGEM)
    rx1, rx2, rx3 = st.columns(3)
    
    with rx1:
        st.write("**Performance por Lado**")
        df_side = calculate_metrics_grouped(df_analytics, 'side')
        st.bar_chart(df_side['PnL'])
        st.dataframe(df_side[['Qtd', 'Wins', 'Win Rate', 'PnL']], width="stretch", 
                     column_config={"Win Rate": st.column_config.NumberColumn(format="%.1f%%")})
        
    with rx2:
        st.write("**Performance por Timeframe**")
        df_tf = calculate_metrics_grouped(df_analytics, 'tf')
        st.bar_chart(df_tf['PnL'])
        st.dataframe(df_tf[['Qtd', 'Wins', 'Win Rate', 'PnL']], width="stretch",
                     column_config={"Win Rate": st.column_config.NumberColumn(format="%.1f%%")})

    with rx3:
        st.write("**Performance por Ticker**")
        df_token = calculate_metrics_grouped(df_analytics, 'token')
        st.bar_chart(df_token['PnL'])
        st.dataframe(df_token[['Qtd', 'Wins', 'Win Rate', 'PnL']], width="stretch",
                     column_config={"Win Rate": st.column_config.NumberColumn(format="%.1f%%")})

else:
    st.info("Sem dados suficientes para análise avançada.")

st.markdown("---")

# ==========================================
# TABELA DETALHADA E LOGS
# ==========================================
c_chart, c_table = st.columns([1, 1])

# (Gráfico removido aqui pois já está na análise avançada)

with c_table:
    st.subheader("📋 Detalhamento (Agrupado por Trade ID)")
    if filtered_history:
        grouped_display = {}
        for t in filtered_history:
            tid = t.get('trade_id', '-')
            key = tid if tid != '-' else t.get('oid')
            
            if key not in grouped_display:
                grouped_display[key] = {
                    "Data": t['time'], 
                    "ID": tid,
                    "Token": t['token'],
                    "TF": t.get('tf', '-'),
                    "Side": t.get('side', '-'),
                    "PnL ($)": 0.0,
                    "Investido": 0.0
                }
            
            grouped_display[key]["PnL ($)"] += float(t.get('pnl_usd', 0))
            grouped_display[key]["Investido"] += float(t.get('size_usd', 0))
            if t['time'] > grouped_display[key]["Data"]:
                grouped_display[key]["Data"] = t['time']

        display_data = []
        sorted_keys = sorted(grouped_display.keys(), key=lambda k: grouped_display[k]['Data'], reverse=True)
        
        for k in sorted_keys:
            v = grouped_display[k]
            pnl = v["PnL ($)"]
            inv = v["Investido"]
            pnl_pct = (pnl / inv * 100) if inv > 0 else 0.0
            
            display_data.append({
                "Data": datetime.fromtimestamp(v['Data']/1000).strftime('%d/%m %H:%M'),
                "ID": v['ID'],
                "Token": v['Token'],
                "TF": v['TF'],
                "Side": v['Side'],
                "PnL ($)": pnl,
                "PnL (%)": pnl_pct
            })
            
        st.dataframe(
            pd.DataFrame(display_data), 
            hide_index=True,
            width="stretch",
            column_config={
                "PnL ($)": st.column_config.NumberColumn("PnL ($)", format="$%.2f"),
                "PnL (%)": st.column_config.NumberColumn("PnL (%)", format="%.2f%%")
            }
        )
    else:
        st.info("Nenhum dado encontrado.")

st.markdown("---")

c_orders, c_logs = st.columns([2, 1])

with c_orders:
    st.subheader("🟢 Posições em Aberto")
    if list_open_positions:
        st.dataframe(pd.DataFrame(list_open_positions), hide_index=True, width="stretch")
    else:
        st.info("Nenhuma posição ativa.")
        
    st.divider()
    
    st.subheader("⏳ Ordens Pendentes")
    if list_pending_orders:
        st.dataframe(pd.DataFrame(list_pending_orders), hide_index=True, width="stretch")
    else:
        st.info("Nenhuma ordem pendente.")

with c_logs:
    cl1, cl2 = st.columns([1, 1])
    with cl1: st.subheader("📜 Logs")
    with cl2: filter_text = st.text_input("Ocultar:", placeholder="Ex: Ignorado", label_visibility="collapsed")

    log_container = st.container(height=350)
    for line in logs:
        if filter_text and filter_text.lower() in line.lower(): continue
        if "✅" in line: log_container.success(line)
        elif "🚀" in line: log_container.info(line)
        elif "🚫" in line: log_container.text(line)
        elif "Erro" in line or "Pânico" in line: log_container.error(line)
        elif "💰" in line: log_container.warning(line)
        else: log_container.caption(line)

time.sleep(10)
st.rerun()