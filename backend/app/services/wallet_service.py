"""
Serviço de carteira: criptografa e persiste chave privada.
Nunca retorna a chave privada; apenas confirmação e endereço.
"""
import sys
from pathlib import Path

# Permite importar auth.encryption do projeto raiz
_REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from auth.encryption import EncryptionManager
from backend.app.config import get_settings


def encrypt_and_save_private_key(private_key: str, user_id: str) -> tuple[str, str]:
    """
    Criptografa a chave privada e retorna (encrypted_key_b64, salt_b64).
    O backend deve salvar esses valores em trading_accounts; nunca devolve a chave em texto plano.
    """
    key = (get_settings().encryption_master_key or "").strip().strip("[]")
    if not key:
        raise ValueError("ENCRYPTION_MASTER_KEY não configurada no servidor. Configure no .env do backend.")
    enc = EncryptionManager(master_key=key)
    return enc.encrypt_private_key(private_key.strip(), user_id)
