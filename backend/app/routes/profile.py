"""
Perfil do usuário: nome, username, data de nascimento, país, telefone.
"""
import logging
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from backend.app.dependencies import get_current_user_id
from backend.app.services.supabase_client import get_supabase

router = APIRouter(prefix="/profile", tags=["profile"])
logger = logging.getLogger(__name__)


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(None, max_length=255)
    username: Optional[str] = Field(None, max_length=100)
    birth_date: Optional[date] = None
    country: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=50)


@router.get("")
def get_profile(user_id: str = Depends(get_current_user_id)):
    """Retorna perfil do usuário (colunas na tabela users)."""
    supabase = get_supabase()
    r = supabase.table("users").select("full_name, username, birth_date, country, phone").eq("id", user_id).limit(1).execute()
    if not r.data or len(r.data) == 0:
        return {
            "full_name": None,
            "username": None,
            "birth_date": None,
            "country": None,
            "phone": None,
        }
    row = r.data[0]
    return {
        "full_name": row.get("full_name"),
        "username": row.get("username"),
        "birth_date": row.get("birth_date"),
        "country": row.get("country"),
        "phone": row.get("phone"),
    }


@router.put("")
def update_profile(
    body: ProfileUpdate,
    user_id: str = Depends(get_current_user_id),
):
    """Atualiza perfil do usuário (colunas na tabela users)."""
    supabase = get_supabase()
    raw = body.model_dump(exclude_none=True)
    payload = {}
    for k, v in raw.items():
        if v is None:
            continue
        if isinstance(v, str) and v.strip() == "":
            payload[k] = None
        else:
            payload[k] = v
    if not payload:
        return {"success": True, "message": "Nada a atualizar"}

    try:
        supabase.table("users").update(payload).eq("id", user_id).execute()
    except Exception as e:
        logger.exception("Erro ao atualizar perfil")
        raise HTTPException(status_code=500, detail="Erro ao salvar perfil. Tente novamente.")
    return {"success": True, "message": "Perfil atualizado."}
