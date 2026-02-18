"""
Conexão com Hyperliquid via API Wallet (agent). A carteira do usuário é conectada
por assinatura; armazenamos apenas a chave do agent (criptografada), que não
possui permissão de saque.
"""
import logging
import secrets
import time

import requests
from eth_account import Account
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.app.dependencies import get_current_user_id
from backend.app.services.supabase_client import get_supabase
from backend.app.services.wallet_service import encrypt_and_save_private_key

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/wallet", tags=["wallet"])

# Cache temporário para agent (user_id, nonce) -> (agent_address, agent_key). TTL 5 min.
_agent_pending: dict[tuple[str, int], tuple[str, str, float]] = {}

HYPERLIQUID_EXCHANGE_URL_MAINNET = "https://api.hyperliquid.xyz/exchange"
HYPERLIQUID_EXCHANGE_URL_TESTNET = "https://api.hyperliquid.xyz/exchange"


def _clean_agent_cache():
    now = time.time()
    to_remove = [k for k, v in _agent_pending.items() if now - v[2] > 300]
    for k in to_remove:
        del _agent_pending[k]


class ConnectAgentBody(BaseModel):
    master_address: str = Field(..., min_length=40, max_length=44)
    agent_address: str = Field(..., min_length=40, max_length=44)
    nonce: int = Field(..., gt=0)
    signature_r: str = Field(..., min_length=64, max_length=66)
    signature_s: str = Field(..., min_length=64, max_length=66)
    signature_v: int = Field(..., ge=27, le=28)
    network: str = Field(default="mainnet", pattern="^(mainnet|testnet)$")


@router.post("/prepare-agent")
def prepare_agent(user_id: str = Depends(get_current_user_id)):
    """
    Gera um agent (API wallet) e retorna o endereço + dados EIP-712 para o usuário assinar.
    O usuário assina com a carteira principal (master) no frontend.
    """
    _clean_agent_cache()
    agent_key = "0x" + secrets.token_hex(32)
    account = Account.from_key(agent_key)
    nonce = int(time.time() * 1000)
    is_mainnet = True
    hyperliquid_chain = "Mainnet"

    action = {
        "hyperliquidChain": hyperliquid_chain,
        "signatureChainId": "0x66eee",
        "agentAddress": account.address,
        "agentName": "Zeedo",
        "nonce": nonce,
    }

    # EIP-712 typed data para o frontend assinar (chainId 0x66eee = 421614)
    typed_data = {
        "domain": {
            "name": "HyperliquidSignTransaction",
            "version": "1",
            "chainId": 0x66EEE,  # 421614
            "verifyingContract": "0x0000000000000000000000000000000000000000",
        },
        "types": {
            "EIP712Domain": [
                {"name": "name", "type": "string"},
                {"name": "version", "type": "string"},
                {"name": "chainId", "type": "uint256"},
                {"name": "verifyingContract", "type": "address"},
            ],
            "HyperliquidTransaction:ApproveAgent": [
                {"name": "hyperliquidChain", "type": "string"},
                {"name": "agentAddress", "type": "address"},
                {"name": "agentName", "type": "string"},
                {"name": "nonce", "type": "uint64"},
            ],
        },
        "primaryType": "HyperliquidTransaction:ApproveAgent",
        "message": {
            "hyperliquidChain": action["hyperliquidChain"],
            "agentAddress": action["agentAddress"],
            "agentName": action["agentName"],
            "nonce": action["nonce"],
        },
    }

    _agent_pending[(user_id, nonce)] = (account.address, agent_key, time.time())

    return {
        "agent_address": account.address,
        "nonce": nonce,
        "typed_data": typed_data,
    }


@router.post("/connect-agent")
def connect_agent(
    body: ConnectAgentBody,
    user_id: str = Depends(get_current_user_id),
):
    """
    Recebe a assinatura do approveAgent, submete à Hyperliquid e salva o agent.
    O agent tem permissão apenas para operar (não pode sacar).
    """
    _clean_agent_cache()
    key = (user_id, body.nonce)
    if key not in _agent_pending:
        raise HTTPException(status_code=400, detail="Sessão expirada. Conecte a carteira novamente e assine.")

    agent_address, agent_private_key, _ = _agent_pending[key]
    del _agent_pending[key]

    if agent_address.lower() != body.agent_address.lower():
        raise HTTPException(status_code=400, detail="Endereço do agent inválido.")

    master = body.master_address.strip()
    if not master.startswith("0x"):
        master = "0x" + master

    # Formata r, s para hex com 0x
    r = body.signature_r if body.signature_r.startswith("0x") else "0x" + body.signature_r
    s = body.signature_s if body.signature_s.startswith("0x") else "0x" + body.signature_s

    action = {
        "type": "approveAgent",
        "hyperliquidChain": "Mainnet" if body.network == "mainnet" else "Testnet",
        "signatureChainId": "0x66eee",
        "agentAddress": body.agent_address,
        "agentName": "Zeedo",
        "nonce": body.nonce,
    }

    payload = {
        "action": action,
        "nonce": body.nonce,
        "signature": {"r": r, "s": s, "v": body.signature_v},
    }

    url = HYPERLIQUID_EXCHANGE_URL_MAINNET if body.network == "mainnet" else HYPERLIQUID_EXCHANGE_URL_TESTNET
    try:
        resp = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=15)
        data = resp.json()
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Hyperliquid não respondeu. Tente novamente.")
        if data.get("status") != "ok":
            resp_obj = data.get("response", {})
            err = resp_obj.get("error") if isinstance(resp_obj, dict) else str(resp_obj)
            raise HTTPException(status_code=400, detail=f"Hyperliquid rejeitou: {err or data}")
    except requests.RequestException as e:
        logger.exception("Erro ao conectar à Hyperliquid")
        raise HTTPException(status_code=502, detail="Erro ao comunicar com a Hyperliquid. Tente novamente.")

    try:
        encrypted_key, salt = encrypt_and_save_private_key(agent_private_key, user_id)
    except Exception as e:
        logger.exception("Erro ao criptografar chave do agent")
        raise HTTPException(status_code=500, detail="Erro ao salvar. Tente novamente.")

    try:
        supabase = get_supabase()
        supabase.table("trading_accounts").update({"is_active": False}).eq("user_id", user_id).execute()
        supabase.table("trading_accounts").upsert(
            {
                "user_id": user_id,
                "wallet_address": master,  # master (onde estão os fundos)
                "encrypted_private_key": encrypted_key,  # API Wallet (agent) – sem saque
                "encryption_salt": salt,
                "network": body.network,
                "is_active": True,
            },
            on_conflict="user_id,wallet_address",
        ).execute()
    except Exception as e:
        logger.exception("Erro ao salvar carteira")
        raise HTTPException(status_code=500, detail="Erro ao salvar carteira. Tente novamente.")

    return {
        "success": True,
        "message": "Carteira conectada com sucesso (API Wallet – sem permissão de saque)",
        "wallet_address": master,
        "network": body.network,
    }


@router.get("/status")
def wallet_status(user_id: str = Depends(get_current_user_id)):
    """
    Retorna status da conexão e endereço (mascarado).
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


@router.post("/disconnect")
def disconnect_wallet(user_id: str = Depends(get_current_user_id)):
    """Desativa a carteira do usuário (is_active = False)."""
    supabase = get_supabase()
    supabase.table("trading_accounts").update({"is_active": False}).eq("user_id", user_id).execute()
    return {"success": True, "message": "Carteira desconectada."}
