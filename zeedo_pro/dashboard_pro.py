"""
Dashboard Zeedo Pro - Versão demonstrativa.
Sem lógica do bot. Dados apenas de trades_database_telegram.json.
Saldo inicial fixo: $100. Métricas calculadas a partir dos trades que você inserir.
"""
#Para rodar o dashboard: streamlit run zeedo_pro/dashboard_pro.py

import os
import json
import streamlit as st
import pandas as pd
from datetime import datetime, timedelta

# Caminho da database fake (mesmo diretório do script)
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TRADES_DB_FILE = os.path.join(_SCRIPT_DIR, "trades_database_telegram.json")

# Constantes fixas (sem relação com código do bot)
SALDO_INICIAL = 100.0


def load_trades():
    """Carrega lista de trades do JSON. Retorna lista vazia se arquivo não existir ou inválido."""
    if not os.path.exists(TRADES_DB_FILE):
        return []
    try:
        with open(TRADES_DB_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except Exception:
        return []


def parse_data_field(data_str):
    """
    Converte campo 'data' do JSON em timestamp (ms).
    Aceita: YYYY-MM-DD, YYYY-DD-MM
    """
    if not data_str or not isinstance(data_str, str):
        return 0
    s = data_str.strip()[:10]
    for fmt in ("%Y-%m-%d", "%Y-%d-%m"):
        try:
            dt = datetime.strptime(s, fmt)
            return int(dt.timestamp() * 1000)
        except ValueError:
            continue
    return 0


def group_trades_by_id(trades_list):
    """
    Junta trades com o mesmo id: soma o PnL e mantém um registro por id.
    Para coin, side, tf e data usa o primeiro do grupo; time/data é o mais recente do grupo.
    """
    if not trades_list:
        return []
    by_id = {}
    for t in trades_list:
        tid = str(t.get("id", ""))
        t_time = t.get("time", 0) or parse_data_field(t.get("data", ""))
        if tid not in by_id:
            by_id[tid] = {
                "id": tid,
                "coin": t.get("coin", ""),
                "side": t.get("side", ""),
                "tf": t.get("tf", "-"),
                "data": t.get("data", ""),
                "time": t_time,
                "pnl": 0.0,
            }
        by_id[tid]["pnl"] += float(t.get("pnl", 0))
        if t_time > by_id[tid]["time"]:
            by_id[tid]["time"] = t_time
            by_id[tid]["data"] = t.get("data", by_id[tid]["data"])
    return list(by_id.values())


st.set_page_config(page_title="Zeedo Pro", page_icon="📈", layout="wide", initial_sidebar_state="expanded")

st.markdown("""
    <style>
    div.stMetric { background-color: #1E1E1E; padding: 15px; border-radius: 8px; border: 1px solid #333; }
    .stDataFrame { border: none !important; }
    </style>
""", unsafe_allow_html=True)

st.title("🚀 Zeedo Pro")

# Carrega dados apenas do JSON
trades_raw = load_trades()

# Normaliza campos: id, coin, side, pnl, data, tf (time vem do campo data)
trades = []
for t in trades_raw:
    pnl = float(t.get("pnl", 0))
    data_str = t.get("data", "")
    ts = parse_data_field(data_str)
    trades.append({
        "id": str(t.get("id", "")),
        "coin": str(t.get("coin", "")).upper(),
        "side": str(t.get("side", "")).upper(),
        "pnl": pnl,
        "data": data_str,
        "tf": str(t.get("tf", "-")),
        "time": ts,
    })

# Junta trades com o mesmo id (soma PnL, um registro por id) e ordena por data
trades = group_trades_by_id(trades)
trades.sort(key=lambda x: x["time"], reverse=True)

# === FILTROS ===
st.markdown("### 📊 Painel de Lucros e Performance")

c1, c2, c3 = st.columns(3)
with c1:
    period_options = ["24 Horas", "1 Semana", "1 Mês", "3 meses", "6 meses", "1 ano", "All Time"]
    selected_period = st.selectbox("📅 Período:", period_options, index=6)

with c2:
    all_tokens = sorted(set(t.get("coin", "") for t in trades if t.get("coin")))
    tokens_filter = st.multiselect("Filtrar Token:", options=all_tokens or ["BTC", "ETH", "SOL"], default=[])

with c3:
    all_tfs = sorted(set(t.get("tf", "") for t in trades if t.get("tf")))
    tfs_filter = st.multiselect("Filtrar Timeframe:", options=all_tfs or ["5m", "15m", "1h"], default=[])

hide_zeros = st.checkbox("Ocultar PnL Zero", value=True)

# Aplica filtros (período baseado nas datas reais dos trades)
max_ts = max((t["time"] for t in trades), default=0)
filter_start_ts = 0
if selected_period != "All Time" and max_ts > 0:
    days_map = {"24 Horas": 1, "1 Semana": 7, "1 Mês": 30, "3 meses": 90, "6 meses": 180, "1 ano": 360}
    if selected_period in days_map:
        filter_start_ts = max_ts - (days_map[selected_period] * 86400 * 1000)

filtered = []
for t in trades:
    if t["time"] < filter_start_ts:
        continue
    if tokens_filter and t.get("coin") not in tokens_filter:
        continue
    if tfs_filter and t.get("tf") not in tfs_filter:
        continue
    if hide_zeros and t.get("pnl", 0) == 0:
        continue
    filtered.append(t)

# === MÉTRICAS ===
lucro_liquido = sum(t["pnl"] for t in filtered)
saldo_real = SALDO_INICIAL + sum(t["pnl"] for t in trades)  # saldo considera todos os trades, não só filtrados
total_trades = len(filtered)
wins = sum(1 for t in filtered if t["pnl"] > 0)
taxa_acerto = (wins / total_trades * 100) if total_trades > 0 else 0.0

k1, k2, k3, k4 = st.columns(4)
k1.metric("Saldo Real", f"${saldo_real:,.2f}")
k2.metric("Total Trades", total_trades)
k3.metric("Taxa de Acerto", f"{taxa_acerto:.1f}%")
k4.metric("Lucro Líquido", f"${lucro_liquido:.2f}")

# === GRÁFICO CURVA DE CRESCIMENTO ===
st.markdown("#### Curva de Crescimento")
if filtered:
    df_curve = pd.DataFrame(filtered).sort_values("time", ascending=True)
    df_curve["Saldo Acumulado"] = SALDO_INICIAL + df_curve["pnl"].cumsum()
    df_curve["DataHora"] = pd.to_datetime(df_curve["time"], unit="ms")
    st.line_chart(df_curve, x="DataHora", y="Saldo Acumulado", height=250)
else:
    st.info("Adicione trades em trades_database_telegram.json para ver o gráfico.")

# === ANALYTICS (por lado, tf, coin) ===
st.markdown("#### Analytics")
if filtered:
    df = pd.DataFrame(filtered)
    rx1, rx2, rx3 = st.columns(3)
    with rx1:
        st.write("**Performance por Lado**")
        side_stats = df.groupby("side").agg(PnL=("pnl", "sum"), Qtd=("pnl", "count")).reset_index()
        st.bar_chart(side_stats.set_index("side")["PnL"])
        st.dataframe(side_stats, hide_index=True)
    with rx2:
        st.write("**Performance por Timeframe**")
        tf_stats = df.groupby("tf").agg(PnL=("pnl", "sum"), Qtd=("pnl", "count")).reset_index()
        st.bar_chart(tf_stats.set_index("tf")["PnL"])
        st.dataframe(tf_stats, hide_index=True)
    with rx3:
        st.write("**Performance por Ticker**")
        coin_stats = df.groupby("coin").agg(PnL=("pnl", "sum"), Qtd=("pnl", "count")).reset_index()
        st.bar_chart(coin_stats.set_index("coin")["PnL"])
        st.dataframe(coin_stats, hide_index=True)
else:
    st.info("Sem dados suficientes para análise.")

st.markdown("---")
st.subheader("📋 Detalhamento dos Trades")

if filtered:
    display_data = [
        {
            "Data": t["data"],
            "ID": t["id"],
            "Coin": t["coin"],
            "TF": t["tf"],
            "Side": t["side"],
            "PnL ($)": t["pnl"],
        }
        for t in filtered
    ]
    st.dataframe(
        pd.DataFrame(display_data),
        hide_index=True,
        column_config={"PnL ($)": st.column_config.NumberColumn("PnL ($)", format="$%.2f")},
    )
else:
    st.info("Nenhum trade no período ou adicione entradas em trades_database_telegram.json.")

st.caption("Dados em trades_database_telegram.json (id, coin, side, pnl, data, tf). Saldo inicial: $100.")
