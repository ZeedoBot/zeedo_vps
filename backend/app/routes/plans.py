"""
Plano do usuário: limites por plano e escolha de plano.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from backend.app.dependencies import get_current_user_id
from backend.app.services.supabase_client import get_supabase

router = APIRouter(prefix="/plans", tags=["plans"])


class PlanChooseBody(BaseModel):
    plan: str = Field(..., pattern="^(basic|pro|enterprise)$")


@router.get("/limits")
def get_plan_limits(user_id: str = Depends(get_current_user_id)):
    """Retorna limites do plano do usuário."""
    supabase = get_supabase()
    # Busca plano do usuário
    ur = supabase.table("users").select("subscription_tier").eq("id", user_id).limit(1).execute()
    plan = "basic"
    if ur.data and len(ur.data) > 0:
        plan = (ur.data[0].get("subscription_tier") or "basic").lower()
        if plan not in ("basic", "pro", "enterprise"):
            plan = "basic"

    r = supabase.table("plan_limits").select("*").eq("plan", plan).limit(1).execute()
    if not r.data or len(r.data) == 0:
        r = supabase.table("plan_limits").select("*").eq("plan", "basic").limit(1).execute()
    if not r.data or len(r.data) == 0:
        raise HTTPException(status_code=500, detail="plan_limits não configurado")

    row = r.data[0]
    return {
        "plan": row.get("plan", "basic"),
        "max_positions": row.get("max_positions", 2),
        "max_global_exposure_usd": float(row.get("max_global_exposure_usd", 5000)),
        "max_single_position_usd": float(row.get("max_single_position_usd", 2500)),
        "target_loss_min": float(row.get("target_loss_min", 5)),
        "target_loss_max": float(row.get("target_loss_max", 20)),
        "allowed_symbols": row.get("allowed_symbols") or [],
        "allowed_timeframes": row.get("allowed_timeframes") or ["15m"],
        "allowed_trade_modes": row.get("allowed_trade_modes") or ["LONG_ONLY", "SHORT_ONLY"],
    }


@router.post("/choose")
def choose_plan(
    body: PlanChooseBody,
    user_id: str = Depends(get_current_user_id),
):
    """Salva plano escolhido no perfil do usuário (sem pagamento)."""
    supabase = get_supabase()
    supabase.table("users").update({"subscription_tier": body.plan}).eq("id", user_id).execute()
    return {"success": True, "plan": body.plan}
