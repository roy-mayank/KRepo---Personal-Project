import hashlib
import hmac
from dataclasses import dataclass, field
from typing import Callable

from settings import settings


@dataclass
class CredentialResult:
    access_token: str
    refresh_token: str | None = None
    expires_at: float | None = None  # unix timestamp
    workspace_name: str = ""
    workspace_id: str = ""


@dataclass
class OAuthProviderConfig:
    provider: str
    authorize_url: str
    token_url: str
    client_id: str
    client_secret: str
    redirect_uri: str
    scopes: list[str] = field(default_factory=list)
    # Transforms raw token response dict into structured credentials
    extract_credentials: Callable[[dict], CredentialResult] = field(
        default=lambda d: CredentialResult(access_token=d["access_token"])
    )
    # Extra params appended to the authorization URL (provider-specific)
    extra_authorize_params: dict[str, str] = field(default_factory=dict)
    # "basic" = HTTP Basic Auth (default), "body" = client credentials in form body
    token_endpoint_auth: str = "basic"


# ---------------------------------------------------------------------------
# Provider registry
# ---------------------------------------------------------------------------

_OAUTH_PROVIDERS: dict[str, OAuthProviderConfig] = {}


def register_oauth_provider(config: OAuthProviderConfig) -> None:
    _OAUTH_PROVIDERS[config.provider] = config


def get_oauth_provider(name: str) -> OAuthProviderConfig | None:
    # Lazy-register providers on first lookup so env vars loaded after import still work
    if name not in _OAUTH_PROVIDERS:
        if name == "notion":
            _register_notion()
        elif name == "google_drive":
            _register_google_drive()
    return _OAUTH_PROVIDERS.get(name)


# ---------------------------------------------------------------------------
# HMAC-signed state for CSRF protection
# ---------------------------------------------------------------------------


def _signing_key() -> bytes:
    key = settings.CREDENTIALS_ENCRYPTION_KEY
    if not key:
        raise RuntimeError("CREDENTIALS_ENCRYPTION_KEY is required for OAuth state signing")
    return key.encode()


def sign_state(tenant_id: str, user_id: str) -> str:
    """Create an HMAC-signed state parameter: tenant_id:user_id:signature."""
    payload = f"{tenant_id}:{user_id}"
    sig = hmac.new(_signing_key(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}:{sig}"


def verify_state(state: str) -> tuple[str, str] | None:
    """Verify and extract (tenant_id, user_id) from signed state. Returns None if invalid."""
    parts = state.split(":")
    if len(parts) != 3:
        return None
    tenant_id, user_id, sig = parts
    payload = f"{tenant_id}:{user_id}"
    expected = hmac.new(_signing_key(), payload.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, expected):
        return None
    return tenant_id, user_id


# ---------------------------------------------------------------------------
# Notion provider registration
# ---------------------------------------------------------------------------


def _notion_extract(data: dict) -> CredentialResult:
    return CredentialResult(
        access_token=data["access_token"],
        refresh_token=None,  # Notion tokens don't expire and have no refresh token
        expires_at=None,
        workspace_name=data.get("workspace_name", ""),
        workspace_id=data.get("workspace_id", ""),
    )


def _register_notion() -> None:
    if not settings.NOTION_CLIENT_ID:
        return
    register_oauth_provider(
        OAuthProviderConfig(
            provider="notion",
            authorize_url="https://api.notion.com/v1/oauth/authorize",
            token_url="https://api.notion.com/v1/oauth/token",
            client_id=settings.NOTION_CLIENT_ID,
            client_secret=settings.NOTION_CLIENT_SECRET,
            redirect_uri=settings.NOTION_REDIRECT_URI,
            scopes=[],
            extract_credentials=_notion_extract,
        )
    )


_register_notion()


# ---------------------------------------------------------------------------
# Google Drive provider registration
# ---------------------------------------------------------------------------


def _google_extract(data: dict) -> CredentialResult:
    import time

    expires_in = data.get("expires_in", 3600)
    return CredentialResult(
        access_token=data["access_token"],
        refresh_token=data.get("refresh_token"),
        expires_at=time.time() + expires_in,
        workspace_name="Google Drive",
        workspace_id="",
    )


def _register_google_drive() -> None:
    if not settings.GOOGLE_CLIENT_ID:
        return
    register_oauth_provider(
        OAuthProviderConfig(
            provider="google_drive",
            authorize_url="https://accounts.google.com/o/oauth2/v2/auth",
            token_url="https://oauth2.googleapis.com/token",
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
            redirect_uri=settings.GOOGLE_REDIRECT_URI,
            scopes=["https://www.googleapis.com/auth/drive.readonly"],
            extract_credentials=_google_extract,
            extra_authorize_params={
                "access_type": "offline",
                "prompt": "consent",
            },
            token_endpoint_auth="body",
        )
    )


_register_google_drive()
