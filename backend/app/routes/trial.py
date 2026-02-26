"""
Trial Pro 30 dias: ativação via CPF, termina em 30 dias ou $50 de lucro.
Cada CPF e cada usuário só podem ativar 1 vez.
"""
import hashlib
import logging
import re
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

from backend.app.dependencies import get_current_user_id
from backend.app.services.supabase_client import get_supabase
from backend.app.services.trial_service import (
    TRIAL_DAYS,
    TRIAL_PROFIT_LIMIT_USD,
    check_and_end_trial_if_needed,
    get_trial_profit_usd,
)

router = APIRouter(prefix="/trial", tags=["trial"])


def _normalize_cpf(cpf: str) -> str:
    """Remove não-dígitos e retorna 11 dígitos."""
    digits = re.sub(r"\D", "", cpf)
    return digits


def _is_cpf_valid(cpf: str) -> bool:
    """Valida formato e dígitos verificadores do CPF."""
    digits = _normalize_cpf(cpf)
    if len(digits) != 11:
        return False
    if digits == digits[0] * 11:  # todos iguais
        return False

    def calc_dv(s: str, n: int) -> int:
        total = sum(int(s[i]) * (n + 1 - i) for i in range(n))
        rest = total % 11
        return 0 if rest < 2 else 11 - rest

    if int(digits[9]) != calc_dv(digits[:9], 9):
        return False
    if int(digits[10]) != calc_dv(digits[:10], 10):
        return False
    return True


def _cpf_hash(cpf: str) -> str:
    normalized = _normalize_cpf(cpf)
    return hashlib.sha256(normalized.encode()).hexdigest()


class TrialClaimBody(BaseModel):
    cpf: str = Field(..., min_length=11, max_length=20)


@router.get("/status")
def get_trial_status(user_id: str = Depends(get_current_user_id)):
    """Retorna status do trial do usuário (active, ended, none)."""
    supabase = get_supabase()
    r = supabase.table("trial_claims").select("*").eq("user_id", user_id).limit(1).execute()
    if not r.data or len(r.data) == 0:
        return {"status": "none", "trial": None}

    trial = r.data[0]
    check_and_end_trial_if_needed(supabase, trial)

    r2 = supabase.table("trial_claims").select("*").eq("user_id", user_id).limit(1).execute()
    trial = r2.data[0] if r2.data else trial

    if trial.get("status") == "active":
        profit = get_trial_profit_usd(supabase, user_id, trial.get("started_at", ""))
        return {
            "status": "active",
            "trial": {
                "started_at": trial.get("started_at"),
                "expires_at": trial.get("expires_at"),
                "profit_so_far": round(profit, 2),
                "profit_limit": TRIAL_PROFIT_LIMIT_USD,
            },
        }
    return {
        "status": "ended",
        "trial": {
            "ended_reason": trial.get("ended_reason"),
            "profit_at_end": trial.get("profit_at_end"),
        },
    }


@router.post("/claim")
def claim_trial(body: TrialClaimBody, user_id: str = Depends(get_current_user_id)):
    """Ativa o trial Pro 30 dias. Exige CPF válido. 1 trial por CPF e por usuário."""
    if not _is_cpf_valid(body.cpf):
        raise HTTPException(status_code=400, detail="CPF inválido. Verifique os dígitos.")

    cpf_h = _cpf_hash(body.cpf)
    supabase = get_supabase()

    try:
        # Garante que o usuário existe em public.users (evita FK violation)
        user_row = supabase.table("users").select("id").eq("id", user_id).limit(1).execute()
        if not user_row.data or len(user_row.data) == 0:
            logger.warning("Usuário %s não encontrado em public.users ao ativar trial", user_id)
            raise HTTPException(
                status_code=404,
                detail="Usuário não encontrado. Faça logout, entre novamente e tente outra vez.",
            )

        existing_user = supabase.table("trial_claims").select("id").eq("user_id", user_id).limit(1).execute()
        if existing_user.data and len(existing_user.data) > 0:
            raise HTTPException(status_code=400, detail="Você já utilizou o trial. Cada usuário pode ativar apenas uma vez.")

        existing_cpf = supabase.table("trial_claims").select("id").eq("cpf_hash", cpf_h).limit(1).execute()
        if existing_cpf.data and len(existing_cpf.data) > 0:
            raise HTTPException(
                status_code=400,
                detail="Este CPF já foi utilizado para ativar um trial. Cada CPF pode ser usado apenas uma vez.",
            )

        started = datetime.utcnow()
        expires = started + timedelta(days=TRIAL_DAYS)

        supabase.table("trial_claims").insert({
            "user_id": user_id,
            "cpf_hash": cpf_h,
            "started_at": started.isoformat(),
            "expires_at": expires.isoformat(),
            "status": "active",
        }).execute()

        supabase.table("users").update({
            "subscription_status": "trial",
            "subscription_tier": "pro",
        }).eq("id", user_id).execute()

        return {
            "success": True,
            "message": f"Trial Pro ativado por {TRIAL_DAYS} dias ou até atingir ${TRIAL_PROFIT_LIMIT_USD} de lucro.",
            "expires_at": expires.isoformat(),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Erro ao ativar trial Pro: %s", e)
        raise HTTPException(
            status_code=500,
            detail="Erro ao ativar o trial. Verifique se sua conta está correta e tente novamente.",
        )
