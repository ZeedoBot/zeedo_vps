"""
Rotas Stripe: criação de checkout e webhook.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from backend.app.dependencies import get_current_user_id, get_token_payload
from backend.app.services.supabase_client import get_supabase
from backend.app.config import get_settings

router = APIRouter(prefix="/stripe", tags=["stripe"])
logger = logging.getLogger(__name__)


def _get_stripe():
    import stripe
    key = get_settings().stripe_secret_key
    if not key:
        raise HTTPException(status_code=500, detail="Stripe não configurado")
    stripe.api_key = key
    return stripe


def _price_id_for_plan(plan: str) -> str:
    s = get_settings()
    m = {"basic": s.stripe_price_basic, "pro": s.stripe_price_pro, "satoshi": s.stripe_price_satoshi}
    pid = m.get(plan, "")
    if not pid:
        raise HTTPException(status_code=400, detail=f"Plano {plan} não configurado no Stripe")
    return pid


class CreateCheckoutBody(BaseModel):
    plan: str = Field(..., pattern="^(basic|pro|satoshi)$")
    success_url: str = Field(..., min_length=1)
    cancel_url: str = Field(..., min_length=1)


@router.post("/create-checkout-session")
def create_checkout_session(
    body: CreateCheckoutBody,
    user_id: str = Depends(get_current_user_id),
    token_payload: dict = Depends(get_token_payload),
):
    """Cria sessão Stripe Checkout e retorna a URL para redirecionar o usuário."""
    stripe = _get_stripe()
    supabase = get_supabase()
    email = token_payload.get("email") or ""

    # Busca ou cria stripe_customer_id
    ur = supabase.table("users").select("stripe_customer_id, email").eq("id", user_id).limit(1).execute()
    row = (ur.data or [{}])[0]
    customer_id = row.get("stripe_customer_id")
    if not customer_id and email:
        try:
            cust = stripe.Customer.create(email=email, metadata={"zeedo_user_id": user_id})
            customer_id = cust.id
            supabase.table("users").update({"stripe_customer_id": customer_id}).eq("id", user_id).execute()
        except Exception as e:
            logger.error(f"Erro ao criar Stripe customer: {e}")
            raise HTTPException(status_code=500, detail="Erro ao criar cliente no Stripe")

    price_id = _price_id_for_plan(body.plan)
    if not customer_id:
        raise HTTPException(status_code=400, detail="E-mail necessário para checkout")

    try:
        session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=["card"],
            line_items=[{"price": price_id, "quantity": 1}],
            mode="subscription",
            success_url=body.success_url,
            cancel_url=body.cancel_url,
            metadata={"zeedo_user_id": user_id, "plan": body.plan},
            subscription_data={"metadata": {"zeedo_user_id": user_id, "plan": body.plan}},
            locale="pt-BR",
            allow_promotion_codes=True,
        )
        return {"url": session.url, "session_id": session.id}
    except Exception as e:
        logger.error(f"Erro ao criar checkout: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/webhook")
async def stripe_webhook(request: Request, response: Response):
    """
    Webhook Stripe. Recebe eventos e atualiza users.
    Deve ser chamado apenas pelo Stripe (verificação de assinatura).
    """
    stripe = _get_stripe()
    webhook_secret = get_settings().stripe_webhook_secret
    if not webhook_secret:
        logger.warning("STRIPE_WEBHOOK_SECRET não configurado - webhook ignorado")
        return {"received": True}

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
    except Exception as e:
        logger.error(f"Webhook Stripe: assinatura inválida: {e}")
        raise HTTPException(status_code=400, detail="Assinatura inválida")

    supabase = get_supabase()

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = session.get("metadata", {}).get("zeedo_user_id") or session.get("subscription_data", {}).get("metadata", {}).get("zeedo_user_id")
        plan = session.get("metadata", {}).get("plan") or session.get("subscription_data", {}).get("metadata", {}).get("plan")
        sub_id = session.get("subscription")
        if user_id and plan:
            try:
                supabase.table("users").update({
                    "subscription_tier": plan,
                    "subscription_status": "active",
                    "stripe_subscription_id": sub_id or None,
                }).eq("id", user_id).execute()
                logger.info(f"Stripe: usuário {user_id} ativou plano {plan}")
            except Exception as e:
                logger.error(f"Erro ao atualizar user pós-checkout: {e}")

    elif event["type"] == "customer.subscription.updated":
        sub = event["data"]["object"]
        sub_id = sub.get("id")
        status = sub.get("status")
        user_id = sub.get("metadata", {}).get("zeedo_user_id")
        plan = sub.get("metadata", {}).get("plan")
        if user_id and plan:
            new_status = "active" if status in ("active", "trialing") else "cancelled" if status in ("canceled", "unpaid", "past_due") else "expired"
            try:
                supabase.table("users").update({
                    "subscription_tier": plan,
                    "subscription_status": new_status,
                    "stripe_subscription_id": sub_id,
                }).eq("id", user_id).execute()
                logger.info(f"Stripe: subscription {sub_id} -> {new_status}")
            except Exception as e:
                logger.error(f"Erro ao atualizar subscription: {e}")

    elif event["type"] == "customer.subscription.deleted":
        sub = event["data"]["object"]
        user_id = sub.get("metadata", {}).get("zeedo_user_id")
        if user_id:
            try:
                supabase.table("users").update({
                    "subscription_status": "expired",
                    "stripe_subscription_id": None,
                }).eq("id", user_id).execute()
                logger.info(f"Stripe: assinatura cancelada para user {user_id}")
            except Exception as e:
                logger.error(f"Erro ao marcar assinatura expirada: {e}")

    return {"received": True}
