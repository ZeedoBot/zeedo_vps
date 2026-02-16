"""
Conexão com Hyperliquid: salvar wallet + chave privada (criptografada).
A chave privada NUNCA é retornada ao frontend.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from backend.app.dependencies import get_current_user_id
from backend.app.services.supabase_client import get_supabase
from backend.app.services.wallet_service import encrypt_and_save_private_key

router = APIRouter(prefix="/wallet", tags=["wallet"])


class WalletConnectBody(BaseModel):
    wallet_address: str = Field(..., min_length=10, max_length=255)
    private_key: str = Field(..., min_length=1)
    network: str = Field(default="mainnet", pattern="^(mainnet|testnet)$")


@router.post("/connect")
def connect_wallet(
    body: WalletConnectBody,
    user_id: str = Depends(get_current_user_id),
):
    """
    Recebe wallet address e chave privada, criptografa a chave e salva em trading_accounts.
    Nunca retorna a chave privada.
    """
    import logging
    logger = logging.getLogger(__name__)

    wallet_address = body.wallet_address.strip()
    private_key = body.private_key.strip()
    if not wallet_address or not private_key:
        raise HTTPException(status_code=400, detail="Endereço e chave são obrigatórios")

    try:
        encrypted_key, salt = encrypt_and_save_private_key(private_key, user_id)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.exception("Erro ao criptografar chave privada")
        raise HTTPException(status_code=500, detail="Erro ao processar chave privada. Verifique ENCRYPTION_MASTER_KEY no servidor.")

    try:
        supabase = get_supabase()
        # Desativa outras contas do mesmo usuário (uma carteira ativa por usuário)
        supabase.table("trading_accounts").update({"is_active": False}).eq("user_id", user_id).execute()
        # Insere ou atualiza esta carteira como ativa
        data = {
            "user_id": user_id,
            "wallet_address": wallet_address,
            "encrypted_private_key": encrypted_key,
            "encryption_salt": salt,
            "network": body.network,
            "is_active": True,
        }
        supabase.table("trading_accounts").upsert(
            data,
            on_conflict="user_id,wallet_address",
        ).execute()
    except Exception as e:
        logger.exception("Erro ao salvar carteira no banco")
        raise HTTPException(status_code=500, detail="Erro ao salvar carteira. Tente novamente.")

    return {
        "success": True,
        "message": "Carteira conectada com sucesso",
        "wallet_address": wallet_address,
        "network": body.network,
    }


@router.get("/status")
def wallet_status(user_id: str = Depends(get_current_user_id)):
    """
    Retorna apenas status da conexão e endereço (mascarado). Nunca retorna chave privada.
    """
    supabase = get_supabase()
    r = supabase.table("trading_accounts").select("id, wallet_address, network, is_active, created_at").eq("user_id", user_id).eq("is_active", True).limit(1).execute()
    if not r.data or len(r.data) == 0:
        return {"connected": False, "wallet_address": None, "network": None}
    row = r.data[0]
    addr = row.get("wallet_address") or ""
    # Opcional: mascarar no meio do endereço para exibição
    if len(addr) > 16:
        masked = addr[:8] + "..." + addr[-8:]
    else:
        masked = addr
    return {
        "connected": True,
        "wallet_address": masked,
        "wallet_address_full": addr,  # frontend pode usar para exibir "conectado como 0x..."
        "network": row.get("network"),
    }
