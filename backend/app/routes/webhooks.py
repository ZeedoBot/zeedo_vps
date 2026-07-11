"""
Webhook para Telegram: recebe /start, salva chat_id e responde com Zeedo ON + links.
Chamado pelo Telegram (sem autenticação).
"""
import base64
import logging
import requests
from fastapi import APIRouter, Request, HTTPException
from backend.app.services.supabase_client import get_supabase
from backend.app.config import get_settings

router = APIRouter(prefix="/webhooks", tags=["webhooks"])
logger = logging.getLogger(__name__)

COMMUNITY_LINK = "https://t.me/+YXF26gnIg5U4MTc5"
TIKTOK_LINK = "https://www.tiktok.com/@zeedobot"

WELCOME_MESSAGE = (
    "🚀 Zeedo ON!\n\n"
    "Agora você receberá todas as notificações dos seus trades por aqui: Entradas, Parciais, Stops, PnL...\n\n"
    "Acesse nossa comunidade e fique por dentro dos conteúdos diários."
)

WELCOME_KEYBOARD = {
    "inline_keyboard": [
        [{"text": "💬 Comunidade", "url": COMMUNITY_LINK}],
        [{"text": "🎵 TikTok", "url": TIKTOK_LINK}],
    ]
}


def _send_welcome(chat_id: int, token: str) -> None:
    """Envia mensagem de boas-vindas com botões."""
    try:
        requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={
                "chat_id": chat_id,
                "text": WELCOME_MESSAGE,
                "reply_markup": WELCOME_KEYBOARD,
            },
            timeout=5,
        )
    except Exception as e:
        logger.error(f"Erro ao enviar welcome: {e}")


@router.post("/telegram")
async def telegram_webhook(request: Request):
    """Recebe updates do Telegram. Em /start: salva chat_id (se payload) e envia Zeedo ON + links."""
    # Segurança opcional: se TELEGRAM_WEBHOOK_SECRET estiver configurado, exige que o
    # Telegram envie o mesmo valor no header (configurado via setWebhook secret_token).
    # Sem a variável, mantém o comportamento atual (aberto), para não quebrar deploys existentes.
    expected_secret = (get_settings().telegram_webhook_secret or "").strip()
    if expected_secret:
        got = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
        if got != expected_secret:
            logger.warning("Webhook Telegram: secret token inválido")
            raise HTTPException(403, "Forbidden")

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(400, "JSON inválido")

    message = body.get("message") or body.get("edited_message")
    if not message:
        return {"ok": True}

    text = (message.get("text") or "").strip()
    chat = message.get("chat") or {}
    chat_id = chat.get("id")
    if not chat_id or not text.lower().startswith("/start"):
        return {"ok": True}

    token = (get_settings().telegram_bot_token or "").strip()
    if not token:
        logger.error("TELEGRAM_BOT_TOKEN não configurado")
        return {"ok": True}

    user_id = None
    parts = text.split(maxsplit=1)
    if len(parts) >= 2:
        payload = parts[1].strip()
        if payload.startswith("z"):
            try:
                b64 = payload[1:]
                padding = 4 - len(b64) % 4
                if padding != 4:
                    b64 += "=" * padding
                user_id = base64.urlsafe_b64decode(b64).decode()
            except Exception as e:
                logger.warning(f"Webhook Telegram: payload inválido: {e}")

    if user_id:
        try:
            supabase = get_supabase()
            # Verifica se o chat_id já está em uso por outro usuário
            existing = supabase.table("telegram_configs").select("user_id").eq("chat_id", str(chat_id)).limit(1).execute()
            if existing.data and len(existing.data) > 0:
                existing_user_id = existing.data[0].get("user_id")
                if existing_user_id != user_id:
                    # Chat já em uso por outro usuário - envia mensagem de erro
                    requests.post(
                        f"https://api.telegram.org/bot{token}/sendMessage",
                        json={
                            "chat_id": chat_id,
                            "text": "❌ Este chat do Telegram já está conectado a outra conta Zeedo.\n\nPara conectar aqui, desconecte o Telegram na outra conta primeiro.",
                        },
                        timeout=5,
                    )
                    return {"ok": True}
            
            supabase.table("telegram_configs").upsert(
                {
                    "user_id": user_id,
                    "bot_token": token,
                    "chat_id": str(chat_id),
                },
                on_conflict="user_id",
            ).execute()
            logger.info(f"Telegram conectado: user_id={user_id}, chat_id={chat_id}")
        except Exception as e:
            logger.error(f"Erro ao salvar telegram_configs: {e}")

    _send_welcome(chat_id, token)
    return {"ok": True}
