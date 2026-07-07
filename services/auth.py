"""AWS Cognito JWT verification."""
import os
import json
import logging
import urllib.request
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

logger = logging.getLogger(__name__)
security = HTTPBearer(auto_error=False)

COGNITO_REGION = os.environ.get("AWS_REGION", "us-east-1")
COGNITO_USER_POOL_ID = os.environ.get("COGNITO_USER_POOL_ID", "")
COGNITO_CLIENT_ID = os.environ.get("COGNITO_CLIENT_ID", "")

_jwks_cache = None


def _is_configured() -> bool:
    return bool(COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID)


def _get_jwks() -> dict:
    """Fetch and cache Cognito public keys."""
    global _jwks_cache
    if _jwks_cache:
        return _jwks_cache
    url = (
        f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com"
        f"/{COGNITO_USER_POOL_ID}/.well-known/jwks.json"
    )
    try:
        with urllib.request.urlopen(url, timeout=5) as resp:
            _jwks_cache = json.loads(resp.read())
    except Exception as e:
        logger.error(f"Failed to fetch Cognito JWKS: {e}")
        raise HTTPException(status_code=503, detail="Auth service unavailable")
    return _jwks_cache


def verify_token(token: str) -> dict:
    """Verify a Cognito JWT and return its decoded claims."""
    try:
        from jose import jwt, jwk, JWTError
        headers = jwt.get_unverified_headers(token)
        kid = headers.get("kid")
        jwks = _get_jwks()
        key_data = next((k for k in jwks.get("keys", []) if k["kid"] == kid), None)
        if not key_data:
            raise HTTPException(status_code=401, detail="Invalid token key ID")
        public_key = jwk.construct(key_data)
        claims = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            audience=COGNITO_CLIENT_ID,
        )
        return claims
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Token verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> dict | None:
    """FastAPI dependency — returns user claims or None if unauthenticated."""
    if not credentials or not _is_configured():
        return None
    return verify_token(credentials.credentials)


def require_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> dict:
    """FastAPI dependency — raises 401 if not authenticated."""
    if not _is_configured():
        raise HTTPException(status_code=503, detail="Auth not configured on server")
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")
    return verify_token(credentials.credentials)
