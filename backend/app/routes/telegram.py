"""
Conexão com Telegram: salvar bot_token e chat_id.
Para leigos: chat_id pode ser o número retornado por @userinfobot ou o username.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from backend.app.dependencies import get_current_user_id
from backend.app.services.supabase_client import get_supabase

router = APIRouter(prefix="/telegram", tags=["telegram"])


class TelegramConnectBody(BaseModel):
    bot_token: str = Field(..., min_length=1)
    chat_id: str = Field(..., min_length=1)


@router.post("/connect")
def connect_telegram(
    body: TelegramConnectBody,
    user_id: str = Depends(get_current_user_id),
):
    """Salva token do bot e chat_id (ou username) em telegram_configs."""
    supabase = get_supabase()
    data = {
        "user_id": user_id,
        "bot_token": body.bot_token.strip(),
        "chat_id": body.chat_id.strip(),
    }
    supabase.table("telegram_configs").upsert(
        data,
        on_conflict="user_id",
    ).execute()
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
