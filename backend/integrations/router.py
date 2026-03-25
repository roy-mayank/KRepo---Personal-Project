import uuid
from datetime import datetime, timezone
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user, require_role
from auth.models import Role, User
from db import get_db
from integrations.encryption import decrypt_token, encrypt_token
from integrations.models import IntegrationConnection
from integrations.oauth import get_oauth_provider, sign_state, verify_state
from rag.ingest import ingest_integration
from rag.models import DocumentChunk

router = APIRouter(prefix="/integrations", tags=["integrations"])

# In-memory sync status (same pattern as rag/router.py)
_sync_status: dict[str, str] = {}


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class ConnectionOut(BaseModel):
    provider: str
    workspace_name: str | None
    workspace_id: str | None
    status: str
    connected_at: datetime
    last_sync_at: datetime | None


class ConnectResponse(BaseModel):
    authorize_url: str


class SyncResponse(BaseModel):
    message: str


class SyncStatusResponse(BaseModel):
    status: dict[str, str]


# ---------------------------------------------------------------------------
# OAuth: connect flow
# ---------------------------------------------------------------------------


@router.get("/{provider}/connect")
async def connect(
    provider: str,
    current_user: User = Depends(require_role(Role.admin, Role.member)),
) -> ConnectResponse:
    config = get_oauth_provider(provider)
    if not config:
        raise HTTPException(400, f"OAuth not configured for '{provider}'")

    state = sign_state(str(current_user.tenant_id), str(current_user.id))
    params = {
        "client_id": config.client_id,
        "redirect_uri": config.redirect_uri,
        "response_type": "code",
        "owner": "user",
        "state": state,
        **config.extra_authorize_params,
    }
    if config.scopes:
        params["scope"] = " ".join(config.scopes)

    authorize_url = f"{config.authorize_url}?{urlencode(params)}"
    return ConnectResponse(authorize_url=authorize_url)


@router.get("/{provider}/callback", response_class=HTMLResponse)
async def callback(
    provider: str,
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
) -> HTMLResponse:
    """OAuth callback — browser redirect from the provider."""
    config = get_oauth_provider(provider)
    if not config:
        return _error_html(f"Unknown provider: {provider}")

    verified = verify_state(state)
    if not verified:
        return _error_html("Invalid or expired state parameter")

    tenant_id, user_id = verified

    # Exchange authorization code for access token
    async with httpx.AsyncClient(timeout=15) as client:
        if config.token_endpoint_auth == "body":
            # Send client credentials in form body (e.g. Google)
            resp = await client.post(
                config.token_url,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": config.redirect_uri,
                    "client_id": config.client_id,
                    "client_secret": config.client_secret,
                },
            )
        else:
            # Default: HTTP Basic Auth + JSON body (e.g. Notion)
            resp = await client.post(
                config.token_url,
                json={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": config.redirect_uri,
                },
                auth=(config.client_id, config.client_secret),
            )

    if resp.status_code != 200:
        return _error_html(f"Token exchange failed: {resp.text}")

    token_data = resp.json()
    creds = config.extract_credentials(token_data)

    # Upsert connection
    existing = await db.execute(
        select(IntegrationConnection).where(
            IntegrationConnection.tenant_id == uuid.UUID(tenant_id),
            IntegrationConnection.provider == provider,
        )
    )
    conn = existing.scalar_one_or_none()

    if conn:
        conn.access_token = encrypt_token(creds.access_token)
        conn.refresh_token = encrypt_token(creds.refresh_token) if creds.refresh_token else None
        conn.workspace_name = creds.workspace_name
        conn.workspace_id = creds.workspace_id
        conn.status = "active"
        conn.connected_by = uuid.UUID(user_id)
        conn.connected_at = datetime.now(timezone.utc)
        conn.raw_token_response = token_data
    else:
        conn = IntegrationConnection(
            tenant_id=uuid.UUID(tenant_id),
            provider=provider,
            access_token=encrypt_token(creds.access_token),
            refresh_token=encrypt_token(creds.refresh_token) if creds.refresh_token else None,
            token_expires_at=None,
            workspace_name=creds.workspace_name,
            workspace_id=creds.workspace_id,
            connected_by=uuid.UUID(user_id),
            status="active",
            raw_token_response=token_data,
        )
        db.add(conn)

    await db.commit()

    # Return HTML that notifies the opener and closes the popup
    return HTMLResponse(_success_html(provider, creds.workspace_name))


# ---------------------------------------------------------------------------
# Connections: list / disconnect
# ---------------------------------------------------------------------------


@router.get("/connections")
async def list_connections(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ConnectionOut]:
    result = await db.execute(
        select(IntegrationConnection).where(
            IntegrationConnection.tenant_id == current_user.tenant_id,
        )
    )
    connections = result.scalars().all()
    return [
        ConnectionOut(
            provider=c.provider,
            workspace_name=c.workspace_name,
            workspace_id=c.workspace_id,
            status=c.status,
            connected_at=c.connected_at,
            last_sync_at=c.last_sync_at,
        )
        for c in connections
    ]


@router.delete("/{provider}/disconnect")
async def disconnect(
    provider: str,
    current_user: User = Depends(require_role(Role.admin, Role.member)),
    db: AsyncSession = Depends(get_db),
) -> SyncResponse:
    tenant_id = current_user.tenant_id

    # Delete the connection
    await db.execute(
        delete(IntegrationConnection).where(
            IntegrationConnection.tenant_id == tenant_id,
            IntegrationConnection.provider == provider,
        )
    )
    # Delete all ingested chunks from this provider
    await db.execute(
        delete(DocumentChunk).where(
            DocumentChunk.tenant_id == str(tenant_id),
            DocumentChunk.source == provider,
        )
    )
    await db.commit()
    return SyncResponse(message=f"Disconnected {provider} and removed ingested data")


# ---------------------------------------------------------------------------
# Sync: trigger full ingestion
# ---------------------------------------------------------------------------


async def _run_sync(provider: str, tenant_id: str, access_token: str) -> None:
    key = f"{tenant_id}:{provider}"
    _sync_status[key] = "running"
    try:
        from integrations import get_integration

        cls = get_integration(provider)
        if cls is None:
            _sync_status[key] = f"error: unknown integration '{provider}'"
            return
        integration = cls(access_token=access_token)
        count = await ingest_integration(integration, tenant_id)

        # Update last_sync_at
        from db import _session_factory

        async with _session_factory() as session:
            result = await session.execute(
                select(IntegrationConnection).where(
                    IntegrationConnection.tenant_id == uuid.UUID(tenant_id),
                    IntegrationConnection.provider == provider,
                )
            )
            conn = result.scalar_one_or_none()
            if conn:
                conn.last_sync_at = datetime.now(timezone.utc)
                await session.commit()

        _sync_status[key] = f"completed: {count} chunks ingested"
    except Exception as e:
        _sync_status[key] = f"error: {e}"


@router.post("/{provider}/sync")
async def sync(
    provider: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role(Role.admin, Role.member)),
    db: AsyncSession = Depends(get_db),
) -> SyncResponse:
    tenant_id = current_user.tenant_id

    # Look up stored connection
    result = await db.execute(
        select(IntegrationConnection).where(
            IntegrationConnection.tenant_id == tenant_id,
            IntegrationConnection.provider == provider,
            IntegrationConnection.status == "active",
        )
    )
    conn = result.scalar_one_or_none()
    if not conn:
        raise HTTPException(404, f"No active {provider} connection found. Please connect first.")

    access_token = decrypt_token(conn.access_token)
    key = f"{tenant_id}:{provider}"
    _sync_status[key] = "started"
    background_tasks.add_task(_run_sync, provider, str(tenant_id), access_token)
    return SyncResponse(message=f"Sync started for {provider}")


@router.get("/sync/status")
async def sync_status(
    current_user: User = Depends(get_current_user),
) -> SyncStatusResponse:
    tenant_id = str(current_user.tenant_id)
    tenant_status = {key.split(":", 1)[1]: val for key, val in _sync_status.items() if key.startswith(f"{tenant_id}:")}
    return SyncStatusResponse(status=tenant_status)


# ---------------------------------------------------------------------------
# HTML helpers for OAuth popup
# ---------------------------------------------------------------------------


def _success_html(provider: str, workspace_name: str) -> str:
    return f"""<!DOCTYPE html>
<html><body>
<p>Connected to {provider} ({workspace_name}). This window will close automatically.</p>
<script>
  if (window.opener) {{
    window.opener.postMessage({{ type: "oauth_success", provider: "{provider}" }}, "*");
  }}
  window.close();
</script>
</body></html>"""


def _error_html(message: str) -> str:
    return f"""<!DOCTYPE html>
<html><body>
<p>Error: {message}</p>
<script>
  if (window.opener) {{
    window.opener.postMessage({{ type: "oauth_error", message: "{message}" }}, "*");
  }}
</script>
</body></html>"""
