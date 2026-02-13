"""
Gerenciamento de criptografia para chaves privadas.
Usa Fernet (AES-128) com chave mestra derivada de variável de ambiente.
"""
import os
import base64
import hashlib
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from typing import Tuple


class EncryptionManager:
    """Gerencia criptografia de chaves privadas usando chave mestra."""
    
    def __init__(self, master_key: str = None):
        """
        Inicializa o gerenciador de criptografia.
        
        Args:
            master_key: Chave mestra (se None, lê de ENCRYPTION_MASTER_KEY)
        """
        self.master_key = master_key or os.getenv("ENCRYPTION_MASTER_KEY")
        if not self.master_key:
            raise ValueError(
                "ENCRYPTION_MASTER_KEY não configurada. "
                "Configure a variável de ambiente ou passe master_key no construtor."
            )
    
    def _derive_key(self, salt: bytes, user_id: str) -> bytes:
        """
        Deriva chave de criptografia usando PBKDF2.
        
        Args:
            salt: Salt único
            user_id: ID do usuário para derivação adicional
        
        Returns:
            Chave derivada (32 bytes)
        """
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        # Combina master_key + user_id para derivação
        password = f"{self.master_key}:{user_id}".encode()
        key = base64.urlsafe_b64encode(kdf.derive(password))
        return key
    
    def encrypt_private_key(self, private_key: str, user_id: str) -> Tuple[str, str]:
        """
        Criptografa chave privada usando chave derivada do user_id.
        
        Args:
            private_key: Chave privada em texto plano
            user_id: ID do usuário (usado na derivação)
        
        Returns:
            Tupla (encrypted_key_base64, salt_base64)
        """
        # Gera salt único baseado em user_id (determinístico mas seguro)
        salt_input = f"{self.master_key}:{user_id}".encode()
        salt = hashlib.sha256(salt_input).digest()[:16]  # 16 bytes para PBKDF2
        
        # Deriva chave
        key = self._derive_key(salt, user_id)
        fernet = Fernet(key)
        
        # Criptografa
        encrypted = fernet.encrypt(private_key.encode())
        
        # Retorna em base64 para armazenamento
        return (
            base64.urlsafe_b64encode(encrypted).decode(),
            base64.urlsafe_b64encode(salt).decode()
        )
    
    def decrypt_private_key(self, encrypted_key: str, salt: str, user_id: str) -> str:
        """
        Descriptografa chave privada.
        
        Args:
            encrypted_key: Chave criptografada (base64)
            salt: Salt usado na criptografia (base64)
            user_id: ID do usuário
        
        Returns:
            Chave privada em texto plano
        """
        # Decodifica base64
        encrypted_bytes = base64.urlsafe_b64decode(encrypted_key.encode())
        salt_bytes = base64.urlsafe_b64decode(salt.encode())
        
        # Deriva chave (mesmo processo da criptografia)
        key = self._derive_key(salt_bytes, user_id)
        fernet = Fernet(key)
        
        # Descriptografa
        decrypted = fernet.decrypt(encrypted_bytes)
        return decrypted.decode()
