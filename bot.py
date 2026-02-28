import os
import time
import logging
import json
import numpy as np
import pandas as pd
from collections import defaultdict
from datetime import datetime
from dotenv import load_dotenv
from logging.handlers import RotatingFileHandler
from eth_account import Account
from hyperliquid.info import Info
from hyperliquid.exchange import Exchange
from hyperliquid.utils import constants
import requests

from storage import get_storage

load_dotenv()

#TELEGRAM 
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

#CONFIGURAÇÕES DE LOGS
log_formatter = logging.Formatter('%(asctime)s - %(message)s', datefmt='%d-%b-%y %H:%M:%S')
logger = logging.getLogger()
logger.setLevel(logging.INFO)
log_handler = RotatingFileHandler('bot_trades.log', maxBytes=5*1024*1024, backupCount=3, encoding='utf-8')
log_handler.setFormatter(log_formatter)
logger.addHandler(log_handler)
console = logging.StreamHandler()
console.setFormatter(log_formatter)
logger.addHandler(console)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)

#CONFIGURAÇÕES GERAIS
PRIVATE_KEY = os.getenv("HYPER_PRIVATE_KEY") 
ACCOUNT_ADDRESS = os.getenv("HYPER_ACCOUNT_ADDRESS") 
IS_MAINNET = True 
BASE_URL = constants.MAINNET_API_URL if IS_MAINNET else constants.TESTNET_API_URL
SYMBOLS = []
TIMEFRAMES = []
TRADE_MODE = "BOTH"
PID_FILE = "bot_process.pid"

#LSR BINANCE
LSR_TIMEFRAME = "30m"
LSR_LIMIT = 4                 # pega t-3, t-2, t-1, t
LSR_THRESHOLD_PCT = 0.5       # 0,5%
LSR_UPDATE_INTERVAL = 1800    # 30 minutos

#LSR EXTREMO
LSR_BLOCK_SHORT_BELOW = 1.1
LSR_BLOCK_LONG_DEFAULT = 3.0
LSR_BLOCK_LONG_SPECIAL_1 = 3.8
LSR_BLOCK_LONG_SPECIAL_2 = 4.9
LSR_SPECIAL_1_SYMBOLS = {"XRP", "BNB"}
LSR_SPECIAL_2_SYMBOLS = {"SOL"}
lsr_cache = {}
last_lsr_update = {}
strength_block_cache = {"blocked_longs": set(), "blocked_shorts": set(), "last_update": 0}
STRENGTH_UPDATE_INTERVAL = 900  # 15 minutos

# GESTÃO DE RISCO
TARGET_LOSS_USD = 5.0       
MAX_GLOBAL_EXPOSURE = 5000.0   
MAX_SINGLE_POS_EXPOSURE = 2500.0 
MAX_POSITIONS = 2            
FALLBACK_STOP_PCT = 0.005    
RSI_PERIOD = 14
VOLUME_SMA_PERIOD = 20
LOOKBACK_DIVERGENCE = 35     
MIN_PIVOT_DIST = 4           
LOCAL_LOW_WINDOW = 4    #MENOR CORPO DOS ÚLTIMOS 4

# ALVOS DE FIBO (customizáveis por plano Pro/Satoshi)
FIB_LEVELS = [
    (0.618, 0.50),  # Alvo 1 (0.618) - 50%
    (1.0, 0.50),    # Alvo 2 (1.0) - 50%
]
FIB_STOP_LEVEL = 1.8  # Padrão: -1.8 fib
FIB_ENTRY2_LEVEL = 1.414  # Padrão: -1.414 fib (customizável: 0.619-5.0)
ENTRY2_ADJUST_LAST_TARGET = True  # Se true, último alvo vai para 0.0 quando entrada 2 executar

# ENTRADA 2 (Pro/Enterprise): plano permite e usuário pode ativar/desativar
ENTRY2_ALLOWED = True   # Definido por plan (basic=False, pro/satoshi=True)
ENTRY2_ENABLED = True   # Toggle do usuário em bot_config.entry2_enabled

# CONEXÃO
def setup_client():
    if not PRIVATE_KEY: raise ValueError("Chave Privada não encontrada no .env")
    account = Account.from_key(PRIVATE_KEY)
    wallet_addr = ACCOUNT_ADDRESS if ACCOUNT_ADDRESS else account.address
    info = Info(BASE_URL, skip_ws=True)
    exchange = Exchange(account, BASE_URL, account_address=wallet_addr)
    logging.info(f"Bot Conectado: {wallet_addr} (Rede: {'MAINNET' if IS_MAINNET else 'TESTNET'})")
    return info, exchange, wallet_addr

def register_process():
    pid = os.getpid()
    with open(PID_FILE, 'w') as f:
        f.write(str(pid))

def cleanup_process():
    if os.path.exists(PID_FILE):
        try:
            os.remove(PID_FILE)
        except: pass

def tg_time(timestamp_ms):
    if not timestamp_ms or timestamp_ms == 0:
        return False
    try:
        trade_time = int(timestamp_ms) / 1000
        now = time.time()
        hours_ago = (now - trade_time) / 3600
        return hours_ago <= 24
    except Exception:
        return False

def tg_send(msg):
    try:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        payload = {"chat_id": TELEGRAM_CHAT_ID, "text": msg}
        requests.post(url, json=payload, timeout=3)
    except Exception as e:
        logging.error(f"Erro Telegram: {e}")

def load_config(storage):
    """Carrega config do storage (local ou Supabase) e atualiza SYMBOLS, TIMEFRAMES, TRADE_MODE, alvos e stop."""
    global SYMBOLS, TIMEFRAMES, TRADE_MODE, FIB_LEVELS, FIB_STOP_LEVEL, FIB_ENTRY2_LEVEL, ENTRY2_ADJUST_LAST_TARGET
    config = storage.get_config()
    if config:
        if "symbols" in config and config["symbols"]:
            SYMBOLS = config["symbols"]
        if "timeframes" in config and config["timeframes"]:
            TIMEFRAMES = config["timeframes"]
        TRADE_MODE = config.get("trade_mode", "BOTH")
        
        # Carrega alvos customizados (alvo 1 obrigatório, alvos 2 e 3 opcionais)
        t1_level = config.get("target1_level", 0.618)
        t1_pct = config.get("target1_percent", 100) / 100.0
        t2_level = config.get("target2_level")
        t2_pct = config.get("target2_percent", 0) / 100.0
        t3_level = config.get("target3_level")
        t3_pct = config.get("target3_percent", 0) / 100.0
        
        # Reconstrói FIB_LEVELS (alvo 1 sempre presente)
        FIB_LEVELS = [(t1_level, t1_pct)]
        if t2_level is not None and t2_level > 0 and t2_pct > 0:
            FIB_LEVELS.append((t2_level, t2_pct))
        if t3_level is not None and t3_level > 0 and t3_pct > 0:
            FIB_LEVELS.append((t3_level, t3_pct))
        
        # Carrega stop e entrada 2 customizados
        FIB_STOP_LEVEL = config.get("stop_multiplier", 1.8)
        FIB_ENTRY2_LEVEL = config.get("entry2_multiplier", 1.414)
        ENTRY2_ADJUST_LAST_TARGET = config.get("entry2_adjust_last_target", True)
        
        logging.info(f"📊 Alvos: {FIB_LEVELS}, Stop: -{FIB_STOP_LEVEL}, Entrada2: -{FIB_ENTRY2_LEVEL}")

def get_precision(meta, coin):
    if not meta:
        return 2
    universes = meta.get("universe") or []
    for universe in universes:
        if universe["name"] == coin: return universe["szDecimals"]
    return 2

def round_sz(num, decimals): return float(f"{num:.{decimals}f}")
def round_px(num): return float(f"{num:.5g}")

def get_tf_seconds(tf):
    unit = tf[-1]
    value = int(tf[:-1])
    if unit == 'm': return value * 60
    if unit == 'h': return value * 3600
    if unit == 'd': return value * 86400
    return 300 

def rsi(series, period=14):
    delta = series.diff()
    up = delta.clip(lower=0)
    down = -1 * delta.clip(upper=0)
    roll_up = up.ewm(alpha=1/period, adjust=False).mean()
    roll_down = down.ewm(alpha=1/period, adjust=False).mean()
    rs = roll_up / roll_down.replace(0, np.nan)
    return 100 - (100 / (1 + rs))

def fmt_ts(ts):
    if not ts:
        return "-"
    return datetime.fromtimestamp(ts / 1000).strftime("%H:%M")

BINANCE_BASE_URL = "https://fapi.binance.com"

def fetch_candles_binance(symbol, timeframe, limit=100):
    url = f"{BINANCE_BASE_URL}/fapi/v1/klines"
    params = {"symbol": f"{symbol}USDT", "interval": timeframe, "limit": limit}
    try:
        r = requests.get(url, params=params, timeout=10)
        r.raise_for_status()
        data = r.json()
        df = pd.DataFrame(data, columns=["timestamp", "open", "high", "low", "close", "volume", "_", "_", "_", "_", "_", "_"])
        df = df[["timestamp", "open", "high", "low", "close", "volume"]]
        df["timestamp"] = df["timestamp"].astype(int)
        df["open"] = df["open"].astype(float)
        df["high"] = df["high"].astype(float)
        df["low"] = df["low"].astype(float)
        df["close"] = df["close"].astype(float)
        df["volume"] = df["volume"].astype(float)

        return df
    except Exception as e:
        logging.error(f"Erro Binance candles ({symbol} {timeframe}): {e}")
        return None

def calculate_avg_wicks(df, window=10):
    lower_wicks = np.minimum(df['open'], df['close']) - df['low']
    upper_wicks = df['high'] - np.maximum(df['open'], df['close'])
    avg_lower = lower_wicks.rolling(window).mean()
    avg_upper = upper_wicks.rolling(window).mean()
    return avg_lower, avg_upper

def check_patterns(df, idx):
    curr = df.iloc[idx]
    prev = df.iloc[idx-1]
    open_c, close_c = curr["open"], curr["close"]
    high_c, low_c = curr["high"], curr["low"]
    candle_range_pct = (high_c - low_c) / low_c
    range_ok = candle_range_pct >= 0.007 #Candle > 0,7%
    body = abs(close_c - open_c)
    upper_wick = high_c - max(open_c, close_c)
    lower_wick = min(open_c, close_c) - low_c
    avg_lower_wick = curr['avg_lower_wick']
    avg_upper_wick = curr['avg_upper_wick']
    open_p, close_p = prev["open"], prev["close"]
    patterns = []
    
    if close_c > open_c and range_ok and lower_wick >= 1.8 * body and lower_wick > avg_lower_wick * 0.7 and upper_wick <= lower_wick * 0.5:
        patterns.append("HAMMER_BULL")
    if close_c < open_c and range_ok and upper_wick >= 1.8 * body and upper_wick > avg_upper_wick * 0.7 and lower_wick <= upper_wick * 0.5:
        patterns.append("SHOOTING_STAR") 
    if range_ok and close_p < open_p and close_c > open_c and close_c > open_p:
            patterns.append("ENGULF_BULL")
    if range_ok and close_p > open_p and close_c < open_c and close_c < open_p:
            patterns.append("ENGULF_BEAR")
    return patterns

def check_divergence_at_index(df, idx, symbol, tf):
    target = df.iloc[idx]
    prev = df.iloc[idx - 1]
    target_body_low  = min(target["open"], target["close"])
    target_body_high = max(target["open"], target["close"])
    search_end_idx = idx - MIN_PIVOT_DIST 
    search_start_idx = idx - LOOKBACK_DIVERGENCE
    if search_end_idx <= search_start_idx or search_start_idx < 0:
        return None, None, None
    
    lookback_df = df.iloc[search_start_idx : search_end_idx] 
    if lookback_df.empty: return None, None, None

    # BULL
    min_idx_abs = lookback_df["low"].idxmin()
    rsi_abs = min(df.loc[min_idx_abs]["rsi"], df.loc[min_idx_abs - 1]["rsi"])
    ts_abs = df.loc[min_idx_abs]["timestamp"]

    is_fractal_abs = False #ABS
    if min_idx_abs >= 3 and min_idx_abs <= len(df) - 4:
        abs_low = df.loc[min_idx_abs]["low"]
        prev_lows = df.loc[min_idx_abs-3 : min_idx_abs-1, "low"]
        next_lows = df.loc[min_idx_abs+1 : min_idx_abs+3, "low"]
        if abs_low <= prev_lows.min() and abs_low <= next_lows.min():
            is_fractal_abs = True

    # MÍNIMO RSI (ENTRE 2)
    target_rsi_bull = min(target["rsi"], prev["rsi"]) #TARGET = ATUAL
    ref_body_low = min(df.loc[min_idx_abs]["open"], df.loc[min_idx_abs]["close"])
    if (is_fractal_abs and target_body_low < ref_body_low and target_rsi_bull > rsi_abs):
        return "BULL", ref_body_low, ts_abs

    dynamic_start = int(min_idx_abs) + MIN_PIVOT_DIST
    search_cursor = dynamic_start
    while search_cursor <= search_end_idx:
        window_df = df.iloc[search_cursor : search_end_idx]
        if window_df.empty:
            break

        min_idx_local = window_df["low"].idxmin()
        rsi_local = min(df.loc[min_idx_local]["rsi"], df.loc[min_idx_local - 1]["rsi"])
        ts_local = df.loc[min_idx_local]["timestamp"]

        is_fractal_local = False #LOCAL
        if min_idx_local >= 3 and min_idx_local <= len(df) - 4:
            local_low = df.loc[min_idx_local]["low"]
            prev_lows = df.loc[min_idx_local-3 : min_idx_local-1, "low"]
            next_lows = df.loc[min_idx_local+1 : min_idx_local+3, "low"]

            if local_low <= prev_lows.min() and local_low <= next_lows.min():
                is_fractal_local = True

        if not is_fractal_local:
            search_cursor = min_idx_local + MIN_PIVOT_DIST
            continue

        body_low_local = min(df.loc[min_idx_local]["open"], df.loc[min_idx_local]["close"])
        target_rsi_bull = min(target["rsi"], prev["rsi"])

        if (target_body_low < body_low_local and target_rsi_bull > rsi_local):
            return "BULL", body_low_local, ts_local

        search_cursor = min_idx_local + MIN_PIVOT_DIST

    #BEAR
    wick_highs = lookback_df["high"]
    max_idx_abs = wick_highs.idxmax()
    rsi_abs = max(df.loc[max_idx_abs]["rsi"], df.loc[max_idx_abs - 1]["rsi"])
    ts_abs = df.loc[max_idx_abs]["timestamp"]
    
    #ABS
    is_fractal_bear = False
    if max_idx_abs >= 3 and max_idx_abs <= len(df) - 4:
        abs_high = df.loc[max_idx_abs]["high"]
        prev_highs = df.loc[max_idx_abs-3 : max_idx_abs-1, "high"]
        next_highs = df.loc[max_idx_abs+1 : max_idx_abs+3, "high"]

        if abs_high >= prev_highs.max() and abs_high >= next_highs.max():
            is_fractal_bear = True
            
    #MÁXIMO RSI (ENTRE 2)
    target_rsi_bear = max(target["rsi"], prev["rsi"])
    ref_body_high = max(df.loc[max_idx_abs]["open"], df.loc[max_idx_abs]["close"])
    if (is_fractal_bear and target_body_high > ref_body_high and target_rsi_bear < rsi_abs):
        return "BEAR", ref_body_high, ts_abs

    dynamic_start_bear = int(max_idx_abs) + MIN_PIVOT_DIST
    search_cursor = dynamic_start_bear

    while search_cursor <= search_end_idx:
        window_df = df.iloc[search_cursor : search_end_idx]
        if window_df.empty:
            break

        max_idx_local = window_df["high"].idxmax()
        rsi_local = max(df.loc[max_idx_local]["rsi"], df.loc[max_idx_local - 1]["rsi"])
        ts_local = df.loc[max_idx_local]["timestamp"]

        is_fractal_local = False #LOCAL
        if max_idx_local >= 3 and max_idx_local <= len(df) - 4:
            local_high = df.loc[max_idx_local]["high"]
            prev_highs = df.loc[max_idx_local-3 : max_idx_local-1, "high"]
            next_highs = df.loc[max_idx_local+1 : max_idx_local+3, "high"]

            if local_high >= prev_highs.max() and local_high >= next_highs.max():
                is_fractal_local = True

        if not is_fractal_local:
            search_cursor = max_idx_local + MIN_PIVOT_DIST
            continue

        body_high_local = max(df.loc[max_idx_local]["open"], df.loc[max_idx_local]["close"])
        target_rsi_bear = max(target["rsi"], prev["rsi"])

        if (target_body_high > body_high_local and target_rsi_bear < rsi_local):
            return "BEAR", body_high_local, ts_local

        search_cursor = max_idx_local + MIN_PIVOT_DIST #TENTA DENOVO
    return None, None, None

def get_signal(df_binance, df_hyperliquid, symbol, timeframe):
    df = df_binance
    if len(df) < LOOKBACK_DIVERGENCE + 20: return None
    df["rsi"] = rsi(df["close"], RSI_PERIOD)
    df['avg_lower_wick'], df['avg_upper_wick'] = calculate_avg_wicks(df, window=10)
    df["body_low"]  = df[["open", "close"]].min(axis=1)
    df["body_high"] = df[["open", "close"]].max(axis=1)

    idx_curr = len(df) - 1
    idx_prev = len(df) - 2
    curr = df.iloc[idx_curr]
    prev = df.iloc[idx_prev]

    LOOKBACK_ENGULF = 10
    start_engulf = max(0, idx_curr - LOOKBACK_ENGULF)
    engulf_window = df.iloc[start_engulf:idx_curr]
    div_type, div_px, div_ts = check_divergence_at_index(df, idx_curr, symbol, timeframe)
    if not div_type:
        return None

    vol_sma = df["volume"].rolling(VOLUME_SMA_PERIOD).mean().iloc[idx_curr]
    if vol_sma == 0:
        is_vol_ok = True 
    else:
        is_vol_ok = curr["volume"] > vol_sma * 1.2 
    if not is_vol_ok: return None

    patterns = check_patterns(df, idx_curr)
    if not patterns: return None

    df_hl = df_hyperliquid
    if len(df_hl) < 2:
        logging.warning(f"[{symbol} {timeframe}] ⚠️ Hyperliquid: candles insuficientes")
        return None
    
    curr_hl = df_hl.iloc[-1]
    prev_hl = df_hl.iloc[-2]

    def entry_2(high_p, low_p, side):
        base = high_p - low_p
        if side == "long":
            return high_p - (base * FIB_ENTRY2_LEVEL)
        return low_p + (base * FIB_ENTRY2_LEVEL)
    
    def format_ref_info(px, ts):
        if not px or not ts: return ""
        dt = datetime.fromtimestamp(ts/1000).strftime('%H:%M')
        return f"Ref: {px} ({dt})"

    window_start = max(0, idx_curr - LOCAL_LOW_WINDOW)
    recent_window = df.iloc[window_start : idx_curr + 1]
    local_min_window = recent_window["body_low"].min()
    local_max_window = recent_window["body_high"].max()
    prefix = f"[{symbol} {timeframe}]"
    signal_ts = int(curr["timestamp"])
    signal = {"take": False, "side": None, "trigger": 0.0, "entry2_px": 0.0}

    #LONG
    if "HAMMER_BULL" in patterns:
        if div_type == "BULL":
            if curr["body_low"] <= local_min_window * 1.0003:
                setup_high_hl = curr_hl["high"]
                setup_low_hl = curr_hl["low"]
                tech_base = setup_high_hl - setup_low_hl
                
                trigger_hl = setup_high_hl - (tech_base * 0.618) #ENTRADA 1: LIMIT -0.618
                entry2_px = entry_2(setup_high_hl, setup_low_hl, "long")
                
                ref_info = format_ref_info(div_px, div_ts)
                stop_inicial = round_px(setup_high_hl - FIB_STOP_LEVEL * tech_base)
                signal = {
                    "take": True, "side": "long", 
                    "trigger": trigger_hl,
                    "entry2_px": entry2_px, 
                    "stop_real": stop_inicial,
                    "tech_base": tech_base, 
                    "setup_high": setup_high_hl, 
                    "setup_low": setup_low_hl,
                    "signal_ts": signal_ts
                }
                logging.info(f"✅ SINAL {prefix}: LONG (Martelo Binance + Setup HL) | {ref_info}")

    elif "ENGULF_BULL" in patterns:
        if div_type == "BULL":
            prev_body_low = df.iloc[idx_prev]["body_low"]
            curr_high = curr["high"]
            recent_high_10 = engulf_window["high"].max()
            
            if curr_high >= recent_high_10:
                logging.info(f"{prefix} 🚫 Engolfo Bull ignorado (high extremo)")
                tg_send(
                    f"⚠️ ALERTA DE POSSÍVEL TRADE ⚠️\n"
                    f"🚫🟢 LONG BLOQUEADO (High extremo)🚫\n"
                    f"{symbol} | {timeframe}\n"
                    f"Engolfo Bull ignorado por high extremo. O trade pode já ter subido muito.\n"
                    f"Recomendação: Faça sua própria análise.\n"
                    f"https://app.hyperliquid.xyz/trade/{symbol}"
                )
                return None

            if prev_body_low <= local_min_window * 1.0003:
                setup_high_hl = curr_hl["high"]
                setup_low_hl = prev_hl["low"]
                tech_base = setup_high_hl - setup_low_hl

                # Primeira entrada: LIMIT no nível -0.618 da fib (simplificado)
                trigger_hl = setup_high_hl - (tech_base * 0.618)
                entry2_px = entry_2(setup_high_hl, setup_low_hl, "long")
                
                ref_info = format_ref_info(div_px, div_ts)
                stop_inicial = round_px(setup_high_hl - FIB_STOP_LEVEL * tech_base)
                signal = {
                    "take": True, "side": "long", 
                    "trigger": trigger_hl,
                    "entry2_px": entry2_px, 
                    "stop_real": stop_inicial,
                    "tech_base": tech_base, 
                    "setup_high": setup_high_hl,
                    "setup_low": setup_low_hl,
                    "signal_ts": signal_ts
                }
                logging.info(f"✅ SINAL {prefix}: LONG (Engolfo Bullish) | {ref_info}")

    #SHORT
    if "SHOOTING_STAR" in patterns:
        if div_type == "BEAR":
            if curr["body_high"] >= local_max_window * 0.9997:
                setup_high_hl = curr_hl["high"]
                setup_low_hl = curr_hl["low"]
                tech_base = setup_high_hl - setup_low_hl
                
                # Primeira entrada: LIMIT no nível +0.618 da fib (simplificado)
                trigger_hl = setup_low_hl + (tech_base * 0.618)
                entry2_px = entry_2(setup_high_hl, setup_low_hl, "short")
                
                ref_info = format_ref_info(div_px, div_ts)
                stop_inicial = round_px(setup_low_hl + FIB_STOP_LEVEL * tech_base)
                signal = {
                    "take": True, "side": "short", 
                    "trigger": trigger_hl,
                    "entry2_px": entry2_px, 
                    "stop_real": stop_inicial,
                    "tech_base": tech_base, 
                    "setup_high": setup_high_hl,
                    "setup_low": setup_low_hl,
                    "signal_ts": signal_ts
                }
                logging.info(f"✅ SINAL {prefix}: SHORT (Shooting Star Binance + Setup HL) | {ref_info}")

    elif "ENGULF_BEAR" in patterns:
        if div_type == "BEAR":
            prev_body_high = df.iloc[idx_prev]["body_high"]
            curr_low = curr["low"]
            recent_low_10 = engulf_window["low"].min()
            
            if curr_low <= recent_low_10:
                logging.info(f"{prefix} 🚫 Engolfo Bear ignorado (low extremo)")
                tg_send(
                    f"⚠️ ALERTA DE POSSÍVEL TRADE ⚠️\n"
                    f"🚫🔴 SHORT BLOQUEADO (Low extremo)🚫\n"
                    f"{symbol} | {timeframe}\n"
                    f"Engolfo Bear ignorado por low extremo. O trade pode já ter caído muito.\n"
                    f"Recomendação: Faça sua própria análise.\n"
                    f"https://app.hyperliquid.xyz/trade/{symbol}"
                )
                return None

            if prev_body_high >= local_max_window * 0.9997:
                setup_high_hl = prev_hl["high"]
                setup_low_hl = curr_hl["low"]
                tech_base = setup_high_hl - setup_low_hl
                
                # Primeira entrada: LIMIT no nível +0.618 da fib (simplificado)
                trigger_hl = setup_low_hl + (tech_base * 0.618)
                entry2_px = entry_2(setup_high_hl, setup_low_hl, "short")
                
                ref_info = format_ref_info(div_px, div_ts)
                stop_inicial = round_px(setup_low_hl + FIB_STOP_LEVEL * tech_base)
                signal = {
                    "take": True, "side": "short", 
                    "trigger": trigger_hl,
                    "entry2_px": entry2_px, 
                    "stop_real": stop_inicial,
                    "tech_base": tech_base, 
                    "setup_high": setup_high_hl, 
                    "setup_low": setup_low_hl,
                    "signal_ts": signal_ts
                }
                logging.info(f"✅ SINAL {prefix}: SHORT (Engolfo Bearish) | {ref_info}")
    return signal if signal["take"] else None

def place_trade_entry(exchange, symbol, side, qty, entry_px):
    """
    Coloca ordem LIMIT para primeira entrada no nível -0.618 da fib do setup (fixo).
    Simplificado: não usa mais STOP LIMIT, apenas LIMIT direto.
    """
    is_buy = True if side == "long" else False
    logging.info(f"📥 1ª Entrada Pendente: {side.upper()} {symbol} | Qty:{qty} | Entry:{entry_px:.4f}") 
    
    trade_id = f"{symbol}-{int(time.time())}"  
    try:
        entry_px = round_px(entry_px)
        res = exchange.order(symbol, is_buy, qty, entry_px, {"limit": {"tif": "Gtc"}}, reduce_only=False)
        return res, trade_id
    except Exception as e:
        logging.error(f"Erro Entry LIMIT: {e}")
        return None, None

def place_fib_tps(exchange, symbol, side, entry_px, stop_px, total_qty, sz_dec, custom_base=None, anchor_px=None, entry2_filled=False):
    """Coloca TPs customizados. Se entry2_filled E ENTRY2_ADJUST_LAST_TARGET=true, último TP vai para 0.0."""
    if custom_base: fib_base_dist = custom_base
    else: fib_base_dist = abs(entry_px - stop_px)
    if fib_base_dist == 0: return

    start_px = anchor_px if anchor_px else entry_px
    is_buy_tp = False if side == "long" else True
    
    # Se entry2_filled E usuário quer ajustar, último alvo vai para 0.0 (retorno ao setup)
    if entry2_filled and ENTRY2_ADJUST_LAST_TARGET and len(FIB_LEVELS) >= 1:
        fib_levels = list(FIB_LEVELS)
        # Mantém todos os alvos, mas o último vai para 0.0
        fib_levels[-1] = (0.0, fib_levels[-1][1])
    else:
        fib_levels = FIB_LEVELS
    
    logging.info(f"📐 Fibs {symbol}. Base Técnica: {fib_base_dist:.3f}" + (f" | Último TP→0.0 (entrada 2)" if (entry2_filled and ENTRY2_ADJUST_LAST_TARGET) else ""))

    for idx, (fib_mult, pct) in enumerate(fib_levels, start=1):
        qty_tp = round_sz(total_qty * pct, sz_dec)
        if qty_tp <= 0:
            continue
        if side == "long":
            target_px = start_px + (fib_base_dist * fib_mult)
        else:
            target_px = start_px - (fib_base_dist * fib_mult)

        target_px = round_px(target_px)
        client_oid = f"TP{idx}_{fib_mult}"

        try:
            exchange.order(symbol, is_buy_tp, qty_tp, target_px, {"limit": {"tif": "Gtc"}, "clientOrderId": client_oid}, reduce_only=True)
            logging.info(f"🎯 TP{idx} ({fib_mult}) @ {target_px}")
        except Exception as e:
            logging.error(f"Erro TP {fib_mult}: {e}")

def sync_trade_history(info, wallet, entry_tracker, history_tracker, storage):
    try:
        # Limite: só considera trades após criação da conta no Zeedo (multiusuário)
        min_ts_ms = None
        if hasattr(storage, 'get_user_created_at_timestamp_ms'):
            min_ts_ms = storage.get_user_created_at_timestamp_ms()

        user_fills = info.user_fills(wallet)
        if not user_fills:
            return

        trades_db = storage.get_trades_db()
        if not isinstance(trades_db, list):
            trades_db = []
        processed_oids = {str(t.get('oid')) for t in trades_db if t.get('oid')}
        all_known_trades = list(trades_db)
        
        # AGRUPA micro-fills com mesmo OID
        new_fills_by_oid = defaultdict(list)
        
        for fill in user_fills:
            oid = str(fill.get('oid') or fill.get('id') or "")
            if not oid:
                continue
            if oid in processed_oids:
                continue
            # Ignora trades anteriores à criação da conta no Zeedo
            fill_ts = int(fill.get('time') or fill.get('t') or fill.get('timestamp') or 0)
            if min_ts_ms is not None and fill_ts > 0 and fill_ts < min_ts_ms:
                processed_oids.add(oid)  # evita reprocessar
                continue

            new_fills_by_oid[oid].append(fill)
        
        new_trades = []
        user_state = info.user_state(wallet) or {}
        positions_by_coin = {p["position"]["coin"]: float(p["position"]["szi"]) for p in user_state.get("assetPositions", [])}
        
        for oid, fills in new_fills_by_oid.items():
            base_fill = fills[0]
            coin = base_fill.get('coin') or base_fill.get('symbol') or base_fill.get('market') or None
            tf = "-"
            trade_id = "-"
            
            if coin and coin in entry_tracker:
                fill_ts = base_fill.get('time') or base_fill.get('t') or base_fill.get('timestamp') or 0
                tracker_ts = int(entry_tracker[coin].get('placed_at', 0) * 1000)
                try:
                    if abs(int(fill_ts) - tracker_ts) < 86400000:
                        tf = entry_tracker[coin].get('tf', '-')
                        trade_id = entry_tracker[coin].get('trade_id', '-')
                except Exception:
                    pass

            if (tf == "-" or trade_id == "-") and coin:
                fill_ts = int(base_fill.get('time') or base_fill.get('t') or base_fill.get('timestamp') or 0)
                
                for past_trade in reversed(all_known_trades):
                    past_coin = past_trade.get('coin') or past_trade.get('token')
                    if past_coin == coin:
                        past_ts = int(past_trade.get('time', 0))
                        if abs(fill_ts - past_ts) < (72 * 3600 * 1000):
                            candidate_tf = past_trade.get('tf', '-')
                            candidate_tid = past_trade.get('trade_id', '-')
                            
                            if candidate_tf != "-" and candidate_tid != "-":
                                tf = candidate_tf
                                trade_id = candidate_tid
                                break

            # Órfãos (tf="-", trade_id="-"): agrupa por coin + janela de 12h
            WINDOW_12H_MS = 12 * 3600 * 1000
            if tf == "-" and trade_id == "-" and coin:
                fill_ts = int(base_fill.get('time') or base_fill.get('t') or base_fill.get('timestamp') or 0)
                for t in all_known_trades + new_trades:
                    tc = t.get('coin') or t.get('token')
                    tt = int(t.get('time', 0) or 0)
                    if tc == coin and tt and abs(fill_ts - tt) <= WINDOW_12H_MS:
                        tid = t.get('trade_id', '-')
                        if tid and tid != "-" and str(tid).startswith("MANUAL_"):
                            trade_id = tid
                            break
                if trade_id == "-":
                    trade_id = f"MANUAL_{coin}_{fill_ts}"

            # ✅ SOMA todos os micro-fills com mesmo OID
            total_pnl = 0.0
            total_fee = 0.0
            
            for fill in fills:
                closed_pnl = float(fill.get('closedPnl', fill.get('pnl', 0) or 0))
                fee = float(fill.get('fee', 0) or 0)
                total_pnl += closed_pnl
                total_fee += fee
            
            pnl_net = total_pnl - total_fee
            trade = entry_tracker.get(coin)
            if trade:
                for fill in fills:
                    pnl_fill = float(fill.get("closedPnl", 0) or 0) - float(fill.get("fee", 0) or 0)
                    trade["pnl_realized"] += pnl_fill
                storage.save_entry_tracker(entry_tracker)
            
            # Side: usa o tracker (correto) quando disponível. Fill indica a ação de fechamento (ex: BUY fecha SHORT),
            # não a direção original do trade — por isso inferir do fill erra (SHORT fechando = BUY → LONG errado).
            if trade:
                side = (trade.get("side") or "long").upper()
            else:
                raw_dir = str(base_fill.get('dir') or "")
                if "Long" in raw_dir or raw_dir.lower().startswith("long"):
                    side = "LONG"
                elif "short" in raw_dir or raw_dir.lower().startswith("short"):
                    side = "SHORT"
                else:
                    side = "LONG" if str(base_fill.get('side','')).upper() in ('B','BUY') else "SHORT"

            # Cria registro
            fill_safe = dict(base_fill)
            fill_safe['tf'] = tf
            fill_safe['trade_id'] = trade_id
            fill_safe['pnl_usd'] = round(pnl_net, 6)
            fill_safe['side'] = side
            fill_safe['oid'] = oid
            fill_safe['num_fills'] = len(fills)
            
            trades_db.append(fill_safe)
            new_trades.append(fill_safe)
            processed_oids.add(oid)

            fill_timestamp = base_fill.get('time') or base_fill.get('t') or base_fill.get('timestamp') or 0
            if total_pnl != 0 and tg_time(fill_timestamp):
                emoji = "🤑 PARCIAL REALIZADA" if pnl_net >= 0 else "❌ STOP"
                sign = "+" if pnl_net >= 0 else ""                
                if trade and trade.get("tf"):
                    tg_send(
                        f"{emoji}\n"
                        f"{side} {coin} {tf}\n"
                        f"PnL: {sign}${pnl_net:.2f}"
                    )
                else:
                    tg_send(
                        f"{emoji}\n"
                        f"{side} {coin} (Trade Manual)\n"
                        f"PnL: {sign}${pnl_net:.2f}"
                    )
            
            position_still_open = positions_by_coin.get(coin, 0) != 0
            if not position_still_open and tg_time(fill_timestamp):
                trade = entry_tracker.get(coin)
                if trade:
                    total_pnl = trade.get("pnl_realized", 0.0)
                else:
                    total_pnl = pnl_net  #fallback de segurança

                sign = "+" if total_pnl >= 0 else ""
                tg_send(
                    f"🏁 TRADE ENCERRADO\n"
                    f"{side} {coin}\n"
                    f"PnL TOTAL: {sign}${total_pnl:.2f}"
                )

        if new_trades:
            storage.save_trades_db(trades_db)
            total_fills = sum(t.get('num_fills', 1) for t in new_trades)
            logging.info(f"📚 Histórico: {len(new_trades)} trades ({total_fills} fills) adicionados.")
            
    except Exception as e:
        logging.error(f"Erro sync_trade_history: {e}")

def is_stop_order(o):
    ot = str(o.get("orderType", "")).lower()
    cond = str(o.get("triggerCondition", "")).lower()
    is_trig = o.get("isTrigger", False)
    return (is_trig or "stop" in ot or "below" in cond or "above" in cond) and o.get("reduceOnly", False)

def fetch_candles_hyperliquid(info, symbol, timeframe, retries=3):
    tf_seconds = get_tf_seconds(timeframe)
    now_ms = int(time.time() * 1000)
    total_candles = 10
    start_ms = now_ms - (total_candles * tf_seconds * 1000)

    for attempt in range(retries):
        try:
            raw = info.candles_snapshot(symbol, timeframe, start_ms, now_ms)
            return raw
        except Exception as e:
            if "429" in str(e) or "50" in str(e):
                time.sleep((attempt + 1) * 2)
            else: return None
    return None

def get_24h_change_pct(info, symbol):
    try:
        now_ms = int(time.time() * 1000)
        start_ms = now_ms - (26 * 3600 * 1000)  # 26H
        candles = info.candles_snapshot(symbol, "1h", start_ms, now_ms)
        if not candles or len(candles) < 25:
            return None

        candles = sorted(candles, key=lambda x: x["t"])
        close_24h_ago = float(candles[-25]["c"])  # candle diário fechado
        last_close = float(candles[-1]["c"])

        if close_24h_ago == 0:
            return None
        return ((last_close - close_24h_ago) / close_24h_ago) * 100
    except Exception as e:
        logging.error(f"Erro variação 24h {symbol}: {e}")
        return None

def get_strength_blocks(info, symbols):
    changes = {}
    for sym in symbols:
        pct = get_24h_change_pct(info, sym)
        if pct is not None:
            changes[sym] = pct

    if len(changes) < 4:
        return set(), set()
    ranked = sorted(changes.items(), key=lambda x: x[1])
    weakest = {ranked[0][0], ranked[1][0]}
    strongest = {ranked[-1][0], ranked[-2][0]}
    return weakest, strongest

def manage_risk_and_scan(info, exchange, wallet, meta, entry_tracker, all_open_orders, history_tracker, analyzed_candles, user_state_cache, all_mids_cache, storage):
    user_state = user_state_cache
    raw_positions = user_state.get("assetPositions", [])
    positions = [p["position"] for p in raw_positions if float(p["position"]["szi"]) != 0]
    pending_orders = [o for o in all_open_orders if not o["reduceOnly"]]
    busy_symbols = set()
    for p in positions: busy_symbols.add(p["coin"])
    for o in all_open_orders:
        if not o["reduceOnly"]: busy_symbols.add(o["coin"])

    if len(busy_symbols) >= MAX_POSITIONS:
        return
    current_exposure = 0.0
    all_mids = all_mids_cache

    for p in positions: 
        current_exposure += abs(float(p["szi"]) * float(all_mids.get(p["coin"], 0)))
    available_exposure = MAX_GLOBAL_EXPOSURE - current_exposure
    if os.path.exists("bot_paused.lock"): return
    if available_exposure <= 50: return
    for sym in SYMBOLS:
        if sym in busy_symbols:
            continue

        for tf in TIMEFRAMES:
            tf_sec = get_tf_seconds(tf)
            now = int(time.time())
            current_closed_candle_ts = ((now // tf_sec) - 1) * tf_sec
            if current_closed_candle_ts < 0:
                current_closed_candle_ts = 0

            candle_id = f"{sym}_{tf}_{current_closed_candle_ts}"
            if candle_id in analyzed_candles:
                continue

            df_binance = fetch_candles_binance(sym, tf, limit=100)
            if df_binance is None or len(df_binance) < 5:
                continue
            if df_binance.iloc[-1]["timestamp"] + tf_sec * 1000 > now * 1000:
                df_binance = df_binance.iloc[:-1]
            if len(df_binance) < LOOKBACK_DIVERGENCE + 20:
                continue

            raw_hl = fetch_candles_hyperliquid(info, sym, tf)
            if not raw_hl or len(raw_hl) < 2:
                continue
            try:
                data_hl = [[c["t"], float(c["o"]), float(c["h"]), float(c["l"]), float(c["c"]), float(c["v"])] for c in raw_hl]
                df_hyperliquid = pd.DataFrame(data_hl, columns=["timestamp", "open", "high", "low", "close", "volume"])
                df_hyperliquid = df_hyperliquid.sort_values("timestamp").reset_index(drop=True)
            except Exception as e:
                logging.error(f"[{sym} {tf}] Erro parsing HL: {e}")
                continue

            if df_hyperliquid.iloc[-1]["timestamp"] + tf_sec * 1000 > now * 1000:
                df_hyperliquid = df_hyperliquid.iloc[:-1]
            if len(df_hyperliquid) < 2:
                continue

            sig = get_signal(df_binance, df_hyperliquid, sym, tf)
            if not sig:
                analyzed_candles[candle_id] = True
                continue

            update_lsr_cache(sym, force=True)

            if not lsr_allows_trade(sym, sig["side"]):
                logging.info(f"[{sym} {tf}] 🚫 Trade bloqueado por LSR ({lsr_cache.get(sym, {}).get('trend')})")
                tg_send(
                    f"⚠️ ALERTA DE POSSÍVEL TRADE ⚠️\n"
                    f"🚫{'🟢' if sig['side'] == 'long' else '🔴'} {sig['side'].upper()} BLOQUEADO (LSR)🚫\n"
                    f"{sym} | {tf}\n"
                    f"O Trade está a favor do LSR (junto com as sardinhas)!\n" 
                    f"Recomendação: Faça sua própria análise. Se resolver entrar: Entre com uma mão mais leve ou em um ativo com LSR neutro/contrário.\n"
                    f"https://app.hyperliquid.xyz/trade/{sym}"
                )
                analyzed_candles[candle_id] = True
                continue

            if sig["side"] == "long" and sym in strength_block_cache["blocked_longs"]:
                tg_send(
                    f"⚠️ ALERTA DE POSSÍVEL TRADE ⚠️\n"
                    f"🚫🟢 LONG BLOQUEADO (Ativo fraco 24h)🚫\n"
                    f"{sym} | {tf}\n"
                    f"O ativo está muito fraco nas últimas 24 horas.\n"
                    f"Recomendação: Faça sua própria análise. Se resolver entrar: Entre com uma mão mais leve ou escolha outro ativo mais forte.\n"
                    f"https://app.hyperliquid.xyz/trade/{sym}"
                )
                logging.info(f"[{sym} {tf}] 🚫 LONG bloqueado (Ativo fraco 24h)")
                analyzed_candles[candle_id] = True
                continue

            if sig["side"] == "short" and sym in strength_block_cache["blocked_shorts"]:
                tg_send(
                    f"⚠️ ALERTA DE POSSÍVEL TRADE ⚠️\n"
                    f"🚫🔴 SHORT BLOQUEADO (Ativo forte 24h)🚫\n"
                    f"{sym} | {tf}\n"
                    f"O ativo está muito forte nas últimas 24 horas.\n"
                    f"Recomendação: Faça sua própria análise. Se resolver entrar: Entre com uma mão mais leve ou escolha outro ativo mais fraco.\n"
                    f"https://app.hyperliquid.xyz/trade/{sym}"
                )
                logging.info(f"[{sym} {tf}] 🚫 SHORT bloqueado (Ativo forte 24h)")
                analyzed_candles[candle_id] = True
                continue

            if TRADE_MODE == "LONG_ONLY" and sig["side"] == "short":
                logging.info(f"[{sym} {tf}] 🚫 SHORT ignorado (Modo LONG_ONLY)")
                analyzed_candles[candle_id] = True
                continue

            if TRADE_MODE == "SHORT_ONLY" and sig["side"] == "long":
                logging.info(f"[{sym} {tf}] 🚫 LONG ignorado (Modo SHORT_ONLY)")
                analyzed_candles[candle_id] = True
                continue

            sig_ts = sig["signal_ts"]
            last_ts = history_tracker.get(sym, {}).get(tf, 0)
            if sig_ts <= last_ts:
                analyzed_candles[candle_id] = True
                continue
            try:        
                entry_px = round_px(sig["trigger"])
                entry2_px = round_px(sig["entry2_px"])
                stop_real = round_px(sig["stop_real"])
                avg_entry = (entry_px + entry2_px) / 2
                use_two_entries = ENTRY2_ALLOWED and ENTRY2_ENABLED
                risk_per_unit = abs(avg_entry - stop_real) if use_two_entries else abs(entry_px - stop_real)
                if risk_per_unit == 0: 
                    analyzed_candles[candle_id] = True
                    continue
                total_size = TARGET_LOSS_USD / risk_per_unit
                if use_two_entries:
                    qty_first = total_size / 2
                    qty_second = total_size / 2
                else:
                    qty_first = total_size
                    qty_second = 0
                trade_notional = total_size * entry_px
                limit_notional = min(available_exposure, MAX_SINGLE_POS_EXPOSURE)
                anchor_entry = avg_entry if use_two_entries else entry_px
                if trade_notional > limit_notional:
                    total_size = limit_notional / anchor_entry
                    if use_two_entries:
                        qty_first = total_size / 2
                        qty_second = total_size / 2
                    else:
                        qty_first = total_size
                        qty_second = 0
                sz_dec = get_precision(meta, sym)
                final_qty = round_sz(qty_first, sz_dec)
                second_qty = round_sz(qty_second, sz_dec) if use_two_entries else 0
                if final_qty * entry_px < 10: 
                    analyzed_candles[candle_id] = True
                    continue

                tg_send(
                    f"📡 NOVO SINAL DE TRADE\n"
                    f"{sym} | TF {tf}\n"
                    f"Side: {sig['side'].upper()}\n"
                    f"1ª entrada: {entry_px:.4f}\n"
                    f"2ª entrada: {entry2_px:.4f}\n"
                    f"Stop: {stop_real:.4f}\n"
                    f"https://app.hyperliquid.xyz/trade/{sym}"   
                )

                res, trade_id = place_trade_entry(exchange, sym, sig["side"], final_qty, entry_px)
                signal_ts_sec = sig["signal_ts"] / 1000
                if res:
                    # 1ª entrada: -0.618 (fixo). 2ª entrada (se permitido): -1.414. Apenas 2 entradas.
                    qty_entry_1 = final_qty  # 1ª entrada
                    qty_entry_2 = final_qty + second_qty  # 1ª + 2ª (apenas se ENTRY2_ALLOWED e ENTRY2_ENABLED)
                    tracker_data = {
                        'side': sig["side"],
                        'tf': tf,
                        'placed_at': time.time(),
                        'signal_ts': signal_ts_sec,
                        'planned_stop': stop_real,
                        'tech_base': sig["tech_base"],
                        'setup_high': sig["setup_high"],
                        'setup_low': sig["setup_low"],
                        'entry_px': entry_px,
                        'qty': final_qty,
                        'qty_entry_1': qty_entry_1,
                        'qty_entry_2': qty_entry_2,
                        'trade_id': trade_id,
                        'pnl_realized': 0.0,
                        'last_size': 0.0
                    }
                    if ENTRY2_ALLOWED and ENTRY2_ENABLED:
                        tracker_data['entry2_px'] = entry2_px
                        tracker_data['entry2_qty'] = second_qty
                        tracker_data['entry2_placed'] = False
                    else:
                        tracker_data['entry2_placed'] = True  # Bloqueia entrada 2
                    entry_tracker[sym] = tracker_data
                    storage.save_entry_tracker(entry_tracker)
                    
                    if sym not in history_tracker: history_tracker[sym] = {}
                    history_tracker[sym][tf] = sig_ts
                    storage.save_history_tracker(history_tracker)
                        
                    analyzed_candles[candle_id] = True
                    busy_symbols.add(sym)
                    return 

            except Exception as e:
                logging.error(f"[{sym} {tf}] ❌ Erro lógica trade: {e}")
                analyzed_candles[candle_id] = True

def auto_manage(info, exchange, wallet, meta, entry_tracker, all_open_orders, user_state_cache, all_mids_cache, storage):
    try:
        user_state = user_state_cache
        positions = [
            p["position"] for p in user_state.get("assetPositions", []) 
            if float(p["position"]["szi"]) != 0
        ]

        active_symbols = {p["coin"] for p in positions}
        order_symbols = {o["coin"] for o in all_open_orders if not o["reduceOnly"]}
        now = time.time()

        # Se o preço tocar no alvo 1, cancela ordens ativas
        target1_fib = FIB_LEVELS[0][0] if FIB_LEVELS else 0.618  # Usa primeiro alvo configurado
        for sym in list(entry_tracker.keys()):
            mem = entry_tracker.get(sym, {})
            if mem.get("alvo1_cancel_done"):
                continue  # Já cancelou e notificou; evita spam a cada ciclo
            tech_base = mem.get("tech_base")
            setup_high = mem.get("setup_high")
            setup_low = mem.get("setup_low")
            side = mem.get("side", "long")
            if tech_base is None or tech_base <= 0:
                continue
            curr_price = float(all_mids_cache.get(sym, 0))
            if curr_price <= 0:
                continue
            cancel = False
            if side == "long" and setup_high is not None:
                level_target1 = setup_high + (tech_base * target1_fib)
                if curr_price >= level_target1:
                    cancel = True
            elif side == "short" and setup_low is not None:
                level_target1 = setup_low - (tech_base * target1_fib)
                if curr_price <= level_target1:
                    cancel = True
            if not cancel:
                continue
            for o in all_open_orders:
                if o["coin"] == sym and not o.get("reduceOnly"):
                    try:
                        exchange.cancel(sym, o["oid"])
                        logging.info(f"⏹️ Ordem {sym} cancelada: preço atingiu alvo 1 ({target1_fib})")
                    except Exception as e:
                        logging.error(f"Erro ao cancelar ordem {sym}: {e}")
            
            mem["alvo1_cancel_done"] = True
            if sym not in active_symbols:
                entry_tracker.pop(sym, None)
                storage.save_entry_tracker(entry_tracker)
            else:
                storage.save_entry_tracker(entry_tracker)
                tg_send(
                    f"⏹️ Ordens canceladas (preço tocou alvo 1)\n"
                    f"{side.upper()} {sym} {mem.get('tf', '')}"
                )

        for sym in list(entry_tracker.keys()):
            if sym not in active_symbols and sym not in order_symbols:
                logging.info(f"🧹 Trade encerrado detectado em {sym}. Cancelando ordens pendentes e removendo do tracker.")
                for o in all_open_orders:
                    if o["coin"] == sym:
                        try:
                            exchange.cancel(sym, o["oid"])
                            logging.info(f"🧹 Ordem pendente cancelada (trade encerrado): {sym} oid={o.get('oid')}")
                        except Exception as e:
                            logging.error(f"Erro ao cancelar ordem {sym}: {e}")
                entry_tracker.pop(sym, None)
                storage.save_entry_tracker(entry_tracker)

        all_mids = all_mids_cache

        for pos in positions:
            sym = pos["coin"]
            raw_size = float(pos["szi"])
            size = abs(raw_size)
            mem_data = entry_tracker.get(sym, {})
            entry = float(pos["entryPx"])
            side = "long" if raw_size > 0 else "short"
            
            # Só aplica detecção de entrada 1/2 para trades do bot (não manuais)
            is_bot_trade = mem_data.get('tf') is not None and mem_data.get('origin') != 'MANUAL'
            
            # Identificação determinística baseada em qty esperado (apenas 2 entradas)
            qty_entry_1 = mem_data.get('qty_entry_1')
            qty_entry_2 = mem_data.get('qty_entry_2')
            
            # Tolerância para arredondamentos de precisão (0.1% ou mínimo 0.01)
            def qty_matches(expected, actual):
                if expected is None:
                    return False
                tolerance = max(expected * 0.001, 0.01)
                return abs(actual - expected) <= tolerance
            
            # Verifica se o tamanho mudou para evitar detecções múltiplas
            last_size = mem_data.get("last_size", 0)
            size_changed = abs(size - last_size) > 0.001  # Tolerância mínima
            
            # Entrada 1 confirmada (apenas para trade do bot)
            if is_bot_trade and qty_entry_1 and qty_matches(qty_entry_1, size) and (last_size == 0 or not qty_matches(qty_entry_1, last_size)):
                usd_value = size * entry
                logging.info(f"🚀 ENTRADA 1 CONFIRMADA: {side.upper()} {sym} | Qty:{size:.2f} | Preço:{entry:.4f} | Valor: ${usd_value:.2f}")
                tg_send(
                    f"🚀 ENTRADA 1 CONFIRMADA\n"
                    f"{side.upper()} {sym} {mem_data.get('tf')}\n"
                    f"Entrada: {entry:.4f}\n"
                    f"Tamanho: {size:.2f}\n"
                    f"Valor: ${usd_value:.2f}"
                )
                entry_tracker[sym]["last_size"] = size
                storage.save_entry_tracker(entry_tracker)
            
            # Entrada 2 confirmada (apenas para trade do bot; só dispara uma vez ao atingir qty_entry_2)
            elif is_bot_trade and qty_entry_2 and qty_matches(qty_entry_2, size) and size_changed and (not qty_matches(qty_entry_1, size) if qty_entry_1 else True) and (not qty_matches(qty_entry_2, last_size) if last_size > 0 else True):
                usd_value = size * entry
                logging.info(f"🚀 ENTRADA 2 CONFIRMADA: {side.upper()} {sym} | Qty:{size:.2f} | Preço:{entry:.4f} | Valor: ${usd_value:.2f}")
                tg_send(
                    f"🚀 ENTRADA 2 CONFIRMADA\n"
                    f"{side.upper()} {sym} {mem_data.get('tf')}\n"
                    f"Entrada: {entry:.4f}\n"
                    f"Total: {size:.2f}\n"
                    f"Valor: ${usd_value:.2f}"
                )
                
                # Cancela SL/TP para recalcular
                for o in all_open_orders:
                    if o["coin"] == sym and o.get("reduceOnly", False):
                        try:
                            exchange.cancel(sym, o["oid"])
                        except Exception as e:
                            logging.error(f"Erro ao cancelar SL/TP {sym}: {e}")
                
                entry_tracker[sym]["last_size"] = size
                storage.save_entry_tracker(entry_tracker)
            curr_price = float(all_mids.get(sym, entry))

            my_orders = [o for o in all_open_orders if o["coin"] == sym]
            has_sl = any(is_stop_order(o) for o in my_orders)
            has_tp = any((not o.get("isTrigger", False)) and o.get("reduceOnly", False) for o in my_orders)
            
            mem_data = entry_tracker.get(sym, {})
            planned_stop = mem_data.get('planned_stop')
            tech_base = mem_data.get('tech_base') 
            setup_high = mem_data.get('setup_high')
            setup_low = mem_data.get('setup_low')

            if tech_base and tech_base <= 0:
                logging.error(f"INVALID TECH_BASE {sym}: {tech_base}")
                tech_base = None

            is_manual = (mem_data.get("tf") is None)
            if not has_sl and not is_manual:
                logging.info(f"🛡️ Pânico: Posição sem Stop em {sym}! Colocando...")
                stop_px = planned_stop if planned_stop else round_px(entry * (1 - FALLBACK_STOP_PCT) if side == "long" else entry * (1 + FALLBACK_STOP_PCT))
                
                # Se segunda entrada automática está ativada, stop cobre AMBAS as entradas desde o início
                stop_qty = size
                if not mem_data.get('entry2_placed', True):  # Se entrada 2 ainda não foi colocada/executada
                    entry2_qty = mem_data.get('entry2_qty', 0)
                    if entry2_qty > 0:
                        stop_qty = size + entry2_qty  # Quantidade total (entrada 1 + entrada 2)
                        logging.info(f"🛡️ Stop com proteção para 2 entradas: {stop_qty} (atual: {size} + futura: {entry2_qty})")
                
                exchange.order(sym, not (side=="long"), stop_qty, stop_px, {"trigger": {"triggerPx": stop_px, "isMarket": True, "tpsl": "sl"}}, reduce_only=True)
                if sym in entry_tracker:
                    entry_tracker[sym]['planned_stop'] = stop_px
                    storage.save_entry_tracker(entry_tracker)
            
            if not has_tp and not is_manual:
                logging.info(f"💰 Posição sem TP em {sym}. Colocando Fibs...")
                sz_dec = get_precision(meta, sym)

                if tech_base and setup_high and setup_low:
                    base_to_use = tech_base

                    if side == "long":
                        anchor = setup_high
                    else:
                        anchor = setup_low

                    logging.info(f"📐 Fibs técnicos | Base={base_to_use:.4f} | Anchor={anchor}")
                else:
                    base_to_use = abs(entry * FALLBACK_STOP_PCT)
                    anchor = entry
                    logging.warning(f"⚠️ Fallback Fib para {sym}")

                qty_entry_2 = mem_data.get('qty_entry_2')
                def _qty_matches(exp, act):
                    if exp is None: return False
                    tol = max(exp * 0.001, 0.01)
                    return abs(act - exp) <= tol
                entry2_filled = bool(qty_entry_2 and _qty_matches(qty_entry_2, abs(size)))
                place_fib_tps(exchange, sym, side, entry, None, abs(size), sz_dec, custom_base=base_to_use, anchor_px=anchor, entry2_filled=entry2_filled)

            # Segunda entrada (limit) no nível -1.414 fib (Pro/Enterprise, se ativada)
            if not is_manual and not mem_data.get('entry2_placed', True):
                if mem_data.get("pnl_realized", 0) > 0:
                    entry_tracker[sym]['entry2_placed'] = True
                    storage.save_entry_tracker(entry_tracker)
                    logging.info(f"🚫 2ª entrada bloqueada em {sym}: PnL já realizado (TP parcial).")
                else:
                    entry2_px = mem_data.get('entry2_px')
                    entry2_qty = mem_data.get('entry2_qty')
                    if entry2_px is not None and entry2_qty and entry2_qty > 0:
                        my_add_orders = [o for o in my_orders if not o.get("reduceOnly") and not o.get("isTrigger", False)]
                        if my_add_orders:
                            entry_tracker[sym]['entry2_placed'] = True
                            storage.save_entry_tracker(entry_tracker)
                            logging.info(f"📥 2ª entrada já existente em {sym} (ordem limit ativa). Marcando como colocada.")
                        else:
                            try:
                                is_buy_add = (side == "long")
                                trade_id = mem_data.get('trade_id', sym)
                                client_oid = f"{trade_id}_{int(time.time()*1000)}".replace(" ", "_").replace("-", "_")
                                exchange.order(sym, is_buy_add, entry2_qty, round_px(entry2_px), {"limit": {"tif": "Gtc"}, "clientOrderId": client_oid}, reduce_only=False)
                                logging.info(f"📥 2ª entrada pendente: {sym} @ {entry2_px} qty {entry2_qty} | oid={client_oid}")
                                entry_tracker[sym]['entry2_placed'] = True
                                storage.save_entry_tracker(entry_tracker)
                            except Exception as e:
                                logging.error(f"Erro ao colocar 2ª entrada {sym}: {e}")

            pnl_pct = (curr_price - entry) / entry if side == "long" else (entry - curr_price) / entry
            sl_order = next((o for o in my_orders if is_stop_order(o)), None)
            
            if sl_order and tech_base and not is_manual:
                base = tech_base
                current_sl_px = float(sl_order["triggerPx"])
                new_sl = None
                breakeven_moved = mem_data.get('breakeven_moved', False)
                pnl_realized = mem_data.get("pnl_realized", 0)
                
                # Usa o primeiro alvo configurado para trailing stop
                target1_fib = FIB_LEVELS[0][0] if FIB_LEVELS else 0.618
                
                # Usa o mesmo anchor do TP1 (setup_high/setup_low) para garantir que breakeven e TP1 sejam no mesmo preço
                if side == "long":
                    if setup_high is not None:
                        trigger_target1 = setup_high + (base * target1_fib)  # Mesmo cálculo do TP1
                    else:
                        trigger_target1 = entry + (base * target1_fib)  # Fallback se não tiver setup_high
                    stop_entry = entry * 1.0002 
                    
                    # Trailing: Quando TP1 executa (pnl_realized > 0) OU preço >= alvo 1 -> Breakeven
                    # Garante que ajusta mesmo se o preço já passou do nível
                    if not breakeven_moved and (pnl_realized > 0 or curr_price >= trigger_target1):
                        if current_sl_px < entry: 
                            new_sl = stop_entry
                            logging.info(f"🛡️ Trailing Alvo 1 ({target1_fib}): Stop movido para Break-Even")
                            tg_send(
                                f"🛡️ Trade Protegido: Break-Even (Alvo 1)\n"
                                f"{side.upper()} {sym} {mem_data.get('tf')}\n"
                                f"Novo Stop: {new_sl:.4f}"
                            )

                else: # Short
                    if setup_low is not None:
                        trigger_target1 = setup_low - (base * target1_fib)  # Mesmo cálculo do TP1
                    else:
                        trigger_target1 = entry - (base * target1_fib)  # Fallback se não tiver setup_low
                    stop_entry = entry * 0.9998 
                    
                    # Trailing: Quando TP1 executa (pnl_realized > 0) OU preço <= alvo 1 -> Breakeven
                    if not breakeven_moved and (pnl_realized > 0 or curr_price <= trigger_target1):
                        if current_sl_px > entry:
                            new_sl = stop_entry
                            logging.info(f"🛡️ Trailing Alvo 1 ({target1_fib}): Stop movido para Break-Even")
                            tg_send(
                                f"🛡️ Trade Protegido: Break-Even (Alvo 1)\n"
                                f"{side.upper()} {sym} {mem_data.get('tf')}\n"
                                f"Novo Stop: {new_sl:.4f}"
                            )

                if new_sl:
                    exchange.cancel(sym, sl_order["oid"])
                    new_sl = round_px(new_sl)
                    
                    # Quando move para breakeven, a entrada 2 já foi cancelada (alvo 1 atingido)
                    # Portanto, usa apenas a quantidade atual da posição
                    stop_qty = abs(size)
                    
                    exchange.order(sym, False if side == "long" else True, stop_qty, new_sl, {"trigger": {"triggerPx": new_sl, "isMarket": True, "tpsl": "sl"}}, reduce_only=True)
                    if sym in entry_tracker:
                        entry_tracker[sym]['planned_stop'] = new_sl
                        entry_tracker[sym]['breakeven_moved'] = True
                        storage.save_entry_tracker(entry_tracker)

            # Atualiza last_size apenas se mudou significativamente (para manter estado sincronizado)
            if sym in entry_tracker:
                current_last_size = entry_tracker[sym].get("last_size", 0)
                if abs(size - current_last_size) > 0.001:  # Tolerância mínima
                    entry_tracker[sym]["last_size"] = size
                    storage.save_entry_tracker(entry_tracker)
            
            # Detecta trade manual apenas se não há ordens pendentes do bot para este símbolo
            if sym not in entry_tracker:
                has_bot_orders = False
                for o in my_orders:
                    if o["coin"] == sym:
                        client_oid = str(o.get("clientOrderId", "")).lower()
                        # Padrões de ordens do bot: trade_id, TP1, TP2
                        if any(pattern in client_oid for pattern in ["tp1", "tp2", "tp1_", "tp2_"]):
                            has_bot_orders = True
                            break
                        # Verifica se o clientOrderId começa com um padrão conhecido de trade_id
                        # trade_id geralmente é "SYMBOL-timestamp"
                        if sym.lower() in client_oid and any(char.isdigit() for char in client_oid):
                            has_bot_orders = True
                            break
                
                # Só considera manual se não há ordens pendentes do bot
                if not has_bot_orders:
                    usd_value = size * entry
                    tg_send(
                        f"🕹️ TRADE MANUAL DETECTADO\n"
                        f"{side.upper()} {sym}\n"
                        f"Entry: {entry:.4f}\n"
                        f"Size: {size:.2f}\n"
                        f"Valor: ${usd_value:.2f}\n"
                    )
                    entry_tracker[sym] = {
                        "symbol": sym,
                        "side": side,
                        "entry": entry,
                        "size": size,
                        "tf": None, #MANUAL
                        "origin": "MANUAL",
                        "opened_at": time.time(),
                        "pnl_realized": 0.0
                    }
                    storage.save_entry_tracker(entry_tracker)
    except Exception as e:
        logging.error(f"Erro gestão: {e}")
        return

def fetch_lsr_binance(symbol):
    url = "https://fapi.binance.com/futures/data/globalLongShortAccountRatio"
    params = {"symbol": f"{symbol}USDT", "period": LSR_TIMEFRAME, "limit": LSR_LIMIT}
    try:
        r = requests.get(url, params=params, timeout=5)
        r.raise_for_status()
        data = r.json()
        if not data or len(data) < LSR_LIMIT:
            return None
        return [float(x["longShortRatio"]) for x in data]
    except Exception as e:
        logging.error(f"Erro LSR Binance ({symbol}): {e}")
        return None

def get_lsr_trend(lsr_values):
    if not lsr_values or len(lsr_values) < 4:
        return None
    base_avg = (lsr_values[0] + lsr_values[1] + lsr_values[2]) / 3
    current = lsr_values[3]
    if base_avg == 0:
        return None
    change_pct = ((current - base_avg) / base_avg) * 100
    if abs(change_pct) < LSR_THRESHOLD_PCT:
        return "FLAT"
    elif change_pct > 0:
        return "UP"
    else:
        return "DOWN"

def update_lsr_cache(symbol, force=False):
    now = time.time()
    last_update = last_lsr_update.get(symbol, 0)
    if not force and now - last_update < LSR_UPDATE_INTERVAL:
        return

    lsr_vals = fetch_lsr_binance(symbol)
    if not lsr_vals:
        return

    trend = get_lsr_trend(lsr_vals)
    lsr_cache[symbol] = {"values": lsr_vals, "trend": trend, "updated_at": now}
    last_lsr_update[symbol] = now

def lsr_allows_trade(symbol, side):
    data = lsr_cache.get(symbol)
    if not data:
        return True

    lsr_value = data["values"][-1]
    trend = data.get("trend")

    if side == "short" and lsr_value < LSR_BLOCK_SHORT_BELOW:
        logging.info(f"[LSR BLOCK] {symbol} SHORT bloqueado | LSR muito baixo ({lsr_value:.2f})")
        return False

    if symbol in LSR_SPECIAL_2_SYMBOLS:
        long_block_level = LSR_BLOCK_LONG_SPECIAL_2
    elif symbol in LSR_SPECIAL_1_SYMBOLS:
        long_block_level = LSR_BLOCK_LONG_SPECIAL_1
    else:
        long_block_level = LSR_BLOCK_LONG_DEFAULT

    if side == "long" and lsr_value > long_block_level:
        logging.info(f"[LSR BLOCK] {symbol} LONG bloqueado | LSR muito alto ({lsr_value:.2f})")
        return False

    if trend == "FLAT" or trend is None:
        return True
    if side == "short" and trend == "UP":
        return True
    if side == "long" and trend == "DOWN":
        return True
    return False

def run_main_loop(info, exchange, wallet, storage, config_overrides=None):
    """
    Loop principal do bot. Chamado por main() (modo local/online) ou por BotEngine (SaaS).
    Se config_overrides for dict, injeta valores nas variáveis globais do módulo.
    """
    if config_overrides:
        g = globals()
        for k, v in config_overrides.items():
            if k in g:
                g[k] = v
        # Garante que SYMBOLS e TIMEFRAMES nunca são None
        if g.get("SYMBOLS") is None:
            g["SYMBOLS"] = []
        if g.get("TIMEFRAMES") is None:
            g["TIMEFRAMES"] = []

    exchange_meta = info.meta() or {}
    entry_tracker = storage.get_entry_tracker()
    history_tracker = storage.get_history_tracker()
    logging.info(f"Memória carregada: {len(entry_tracker)} ordens.")
    analyzed_candles = {}
    last_history_sync = 0
    last_lsr_global_update = 0

    try:
        while True:
            loop_start = time.time()
            try:
                all_open_orders = info.frontend_open_orders(wallet) or []
                user_state_cache = info.user_state(wallet) or {}
                all_mids_cache = info.all_mids() or {}
            
            except Exception as e:
                if "429" in str(e):
                    time.sleep(5)
                    continue 
                else:
                    logging.error(f"Erro API Geral: {e}")
                    time.sleep(5)
                    continue 

            if time.time() - last_history_sync > 20:
                sync_trade_history(info, wallet, entry_tracker, history_tracker, storage)
                last_history_sync = time.time()

            if time.time() - last_lsr_global_update > LSR_UPDATE_INTERVAL:
                up, down, flat = [], [], []

                for sym in SYMBOLS:
                    update_lsr_cache(sym)
                    data = lsr_cache.get(sym)
                    if not data:
                        continue

                    val = data["values"][-1]
                    trend = data["trend"]
                    label = f"{sym}({val:.1f})"

                    if trend == "UP":
                        up.append(label)
                    elif trend == "DOWN":
                        down.append(label)
                    else:
                        flat.append(label)

                log_parts = []
                if up:
                    log_parts.append(f"UP: {', '.join(up)}")
                if down:
                    log_parts.append(f"DOWN: {', '.join(down)}")
                if flat:
                    log_parts.append(f"FLAT: {', '.join(flat)}")

            if time.time() - strength_block_cache["last_update"] > STRENGTH_UPDATE_INTERVAL:
                blocked_longs, blocked_shorts = get_strength_blocks(info, SYMBOLS)
                strength_block_cache["blocked_longs"] = blocked_longs
                strength_block_cache["blocked_shorts"] = blocked_shorts
                strength_block_cache["last_update"] = time.time()

            auto_manage(info, exchange, wallet, exchange_meta, entry_tracker, all_open_orders, user_state_cache, all_mids_cache, storage)
            manage_risk_and_scan(info, exchange, wallet, exchange_meta, entry_tracker, all_open_orders, history_tracker, analyzed_candles, user_state_cache, all_mids_cache, storage)
                
            # LIMPA CANDLES NO FIM DO LOOP
            if len(analyzed_candles) > 1000:
                analyzed_candles.clear()
            elapsed = time.time() - loop_start
            time.sleep(max(1, 30 - elapsed)) # Fez em 5 dorme 25

    except KeyboardInterrupt:
        logging.info("Parado.")
    except Exception as e:
        logging.error(f"Erro Crítico: {e}", exc_info=True)


def main():
    """Entrypoint modo local/online: usa .env e storage (JSON ou Supabase)."""
    try:
        storage = get_storage()
        info, exchange, wallet = setup_client()
        register_process()
        load_config(storage)
        logging.info("BOT FINAL V62 (Zeedo)")
        run_main_loop(info, exchange, wallet, storage)
    except Exception as e:
        logging.error(f"Erro Setup: {e}")
        return
    finally:
        cleanup_process()

if __name__ == "__main__":
    main()