"""
Serviço de verificação e encerramento de trials.
Usado pelo backend (API) e pelo manager (checagem periódica).
"""
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

TRIAL_DAYS = 30
TRIAL_PROFIT_LIMIT_USD = 50.0


def get_trial_profit_usd(client, user_id: str, since: str) -> float:
    try:
        r = client.table("trades_database").select("pnl_usd").eq("user_id", user_id).gte("closed_at", since).execute()
        if not r.data:
            return 0.0
        total = sum(float(row.get("pnl_usd", 0) or 0) for row in r.data)
        return total
    except Exception as e:
        logger.warning("get_trial_profit_usd falhou: %s", e)
        return 0.0


def _end_trial(client, trial: dict, reason: str, profit: float = 0.0):
    user_id = trial["user_id"]
    client.table("trial_claims").update({
        "status": "ended",
        "ended_reason": reason,
        "profit_at_end": profit,
    }).eq("id", trial["id"]).execute()

    client.table("users").update({
        "subscription_tier": "basic",
        "subscription_status": "expired",
    }).eq("id", user_id).execute()

    client.table("bot_config").update({"bot_enabled": False}).eq("user_id", user_id).execute()

    try:
        from backend.app.services.telegram_service import send_telegram_to_user
        msg = "⏱️ Seu trial Pro terminou. Acesse zeedo.ia.br/choose-plan para assinar um plano e continuar."
        if reason == "profit_reached":
            msg = f"🎉 Parabéns! Você atingiu ${profit:.0f} de lucro no trial. Acesse zeedo.ia.br/choose-plan para assinar e continuar."
        send_telegram_to_user(client, user_id, msg)
    except Exception:
        pass


def check_and_end_trial_if_needed(client, trial: dict) -> bool:
    """Se trial deve terminar (30 dias ou $50 lucro), encerra e retorna True."""
    if trial.get("status") != "active":
        return False

    started = trial.get("started_at")
    expires = trial.get("expires_at")
    user_id = trial["user_id"]

    if not started:
        logger.warning("Trial sem started_at: user_id=%s", user_id)
        return False

    now = datetime.utcnow()
    if isinstance(expires, str):
        try:
            expires_dt = datetime.fromisoformat(expires.replace("Z", "+00:00"))
        except Exception as e:
            logger.warning("Trial expires_at inválido: %s", e)
            expires_dt = now + timedelta(days=1)
    else:
        expires_dt = expires

    since_str = started.isoformat() if hasattr(started, "isoformat") else str(started)
    profit = get_trial_profit_usd(client, user_id, since_str)
    logger.info("Trial check user_id=%s profit=%.2f limit=%.2f expires=%s now=%s", user_id, profit, TRIAL_PROFIT_LIMIT_USD, expires_dt, now)

    if now >= expires_dt:
        _end_trial(client, trial, "expired", profit)
        return True

    if profit >= TRIAL_PROFIT_LIMIT_USD:
        _end_trial(client, trial, "profit_reached", profit)
        return True

    return False


def check_all_active_trials(client) -> int:
    """
    Verifica todos os trials ativos e encerra os que expiraram ou atingiram $50 lucro.
    Retorna quantos foram encerrados.
    """
    try:
        r = client.table("trial_claims").select("*").eq("status", "active").execute()
        if not r.data:
            return 0
        count = 0
        for trial in r.data:
            if check_and_end_trial_if_needed(client, trial):
                count += 1
        return count
    except Exception:
        return 0
