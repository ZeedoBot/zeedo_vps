"""
Dependências FastAPI: autenticação via JWT do Supabase.
O frontend envia o token no header Authorization: Bearer <access_token>.
Suporta tokens assinados com ES256/RS256 (JWKS) e HS256 (Legacy).
"""
import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from backend.app.config import get_settings

security = HTTPBearer(auto_error=False)


def _get_jwks_client():
    """Cliente JWKS do Supabase (cache implícito pelo PyJWKClient)."""
    settings = get_settings()
    url = settings.supabase_url.rstrip("/") + "/auth/v1/.well-known/jwks.json"
    return PyJWKClient(url)


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> str:
    """Valida JWT do Supabase e retorna o user_id (sub)."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token não informado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = credentials.credentials
    settings = get_settings()
    alg = jwt.get_unverified_header(token).get("alg", "HS256")

    # ES256 ou RS256: valida via JWKS (Supabase com chaves assimétricas)
    if alg in ("ES256", "RS256"):
        if not settings.supabase_url:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Servidor não configurado (SUPABASE_URL)",
            )
        try:
            jwks_client = _get_jwks_client()
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["ES256", "RS256"],
                audience="authenticated",
            )
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expirado")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Token inválido")
    else:
        # HS256: Legacy JWT Secret
        if not settings.supabase_jwt_secret:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Servidor não configurado (JWT secret)",
            )
        try:
            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
            )
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expirado")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Token inválido")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token inválido")
    return user_id
