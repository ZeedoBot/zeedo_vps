"""
Conexão com Telegram: usa bot_token do .env, usuário só conecta via link.
Fluxo: usuário clica no link → abre Telegram → envia /start → webhook salva chat_id.
"""
import base64
import logging
import requests
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from backend.app.dependencies import get_current_user_id
from backend.app.services.supabase_client import get_supabase
from backend.app.config import get_settings

router = APIRouter(prefix="/telegram", tags=["telegram"])
logger = logging.getLogger(__name__)


class TelegramConnectBody(BaseModel):
    """Conectar com chat_id manual (fallback)."""
    chat_id: str = Field(..., min_length=1)
    bot_token: Optional[str] = None


def _get_bot_token() -> str:
    t = get_settings().telegram_bot_token or ""
    if not t:
        raise HTTPException(503, "TELEGRAM_BOT_TOKEN não configurado no servidor")
    return t


def _get_bot_username() -> str:
    """Obtém username do bot via API do Telegram."""
    token = _get_bot_token()
    r = requests.get(f"https://api.telegram.org/bot{token}/getMe", timeout=5)
    if not r.ok:
        raise HTTPException(503, "Não foi possível obter dados do bot")
    data = r.json()
    if not data.get("ok"):
        raise HTTPException(503, "Resposta inválida do Telegram")
    username = (data.get("result") or {}).get("username") or ""
    if not username:
        raise HTTPException(503, "Bot sem username configurado")
    return username


@router.get("/connect-link")
def get_connect_link(user_id: str = Depends(get_current_user_id)):
    """Retorna link para o usuário conectar Telegram (fluxo simples)."""
    username = _get_bot_username()
    payload = base64.urlsafe_b64encode(user_id.encode()).decode().rstrip("=")
    return {"url": f"https://t.me/{username}?start=z{payload}", "bot_username": username}


@router.post("/connect")
def connect_telegram(
    body: TelegramConnectBody,
    user_id: str = Depends(get_current_user_id),
):
    """Salva chat_id. Se bot_token não vier, usa o do .env."""
    supabase = get_supabase()
    bot_token = (body.bot_token or "").strip() or _get_bot_token()
    data = {
        "user_id": user_id,
        "bot_token": bot_token,
        "chat_id": body.chat_id.strip(),
    }
    supabase.table("telegram_configs").upsert(data, on_conflict="user_id").execute()
    return {"success": True, "message": "Telegram conectado com sucesso"}


@router.get("/status")
def telegram_status(user_id: str = Depends(get_current_user_id)):
    """Retorna se está conectado. Nunca retorna bot_token ou chat_id em claro."""
    supabase = get_supabase()
    r = supabase.table("telegram_configs").select("id, chat_id").eq("user_id", user_id).limit(1).execute()
    if not r.data or len(r.data) == 0:
        return {"connected": False, "chat_id_masked": None}
    row = r.data[0]
    cid = (row.get("chat_id") or "")[:4] + "***" if row.get("chat_id") else None
    return {"connected": True, "chat_id_masked": cid}


@router.delete("/disconnect")
def disconnect_telegram(user_id: str = Depends(get_current_user_id)):
    """Desconecta o Telegram do usuário."""
    supabase = get_supabase()
    supabase.table("telegram_configs").delete().eq("user_id", user_id).execute()
    return {"success": True, "message": "Telegram desconectado com sucesso"}
