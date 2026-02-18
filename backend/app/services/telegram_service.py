"""Envia mensagens no Telegram para usuários do SaaS."""
import logging
import requests
from backend.app.config import get_settings

logger = logging.getLogger(__name__)


def send_telegram_to_user(supabase, user_id: str, text: str) -> bool:
    """
    Envia mensagem no Telegram para o usuário.
    Usa bot_token e chat_id de telegram_configs; fallback para env.
    Retorna True se enviou com sucesso.
    """
    try:
        r = supabase.table("telegram_configs").select("bot_token, chat_id").eq("user_id", user_id).limit(1).execute()
        if not r.data or len(r.data) == 0:
            logger.warning(f"Telegram não configurado para usuário {user_id}")
            return False
        row = r.data[0]
        token = (row.get("bot_token") or "").strip()
        chat_id = (row.get("chat_id") or "").strip()
        if not token:
            token = get_settings().telegram_bot_token or ""
        if not chat_id:
            return False
        resp = requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": text},
            timeout=5,
        )
        if not resp.ok:
            logger.warning(f"Telegram send failed: {resp.status_code} {resp.text}")
            return False
        return True
    except Exception as e:
        logger.error(f"Erro ao enviar Telegram para {user_id}: {e}")
        return False
