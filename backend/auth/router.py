import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user, require_role
from auth.jwt import create_access_token
from auth.models import Invitation, Role, Tenant, User
from auth.schemas import (
    AcceptInviteRequest,
    InviteRequest,
    InviteResponse,
    LoginRequest,
    TenantRegister,
    TenantResponse,
    TokenResponse,
    UserResponse,
)
from db import get_db
from settings import settings

router = APIRouter(prefix="/auth", tags=["auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _hash_password(password: str) -> str:
    return pwd_context.hash(password)


def _verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _slugify(name: str) -> str:
    return name.lower().strip().replace(" ", "-").replace("_", "-")


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: TenantRegister, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    """Create a new tenant and its first admin user.

    Only one admin per tenant can be created this way. All other users must be invited.
    """
    slug = _slugify(body.tenant_name)

    existing = await db.execute(select(Tenant).where(Tenant.slug == slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Tenant name already taken")

    tenant = Tenant(name=body.tenant_name, slug=slug)
    db.add(tenant)
    await db.flush()  # populate tenant.id before referencing it

    user = User(
        tenant_id=tenant.id,
        email=body.admin_email,
        hashed_password=_hash_password(body.admin_password),
        role=Role.admin,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return TokenResponse(
        access_token=create_access_token(str(user.id), str(tenant.id), user.role.value, slug),
        tenant_slug=slug,
    )


@router.post("/token", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    """Login with email + password + tenant_slug. Returns a JWT bearer token."""
    result = await db.execute(
        select(User)
        .join(Tenant, User.tenant_id == Tenant.id)
        .where(
            User.email == body.email,
            User.is_active == True,  # noqa: E712
            Tenant.slug == body.tenant_slug,
            Tenant.is_active == True,  # noqa: E712
        )
    )
    user = result.scalar_one_or_none()

    if not user or not _verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email, password, or tenant",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return TokenResponse(
        access_token=create_access_token(str(user.id), str(user.tenant_id), user.role.value, body.tenant_slug),
        tenant_slug=body.tenant_slug,
    )


@router.post("/invite", response_model=InviteResponse)
async def invite_user(
    body: InviteRequest,
    current_user: User = Depends(require_role(Role.admin)),
    db: AsyncSession = Depends(get_db),
) -> InviteResponse:
    """Admin-only: generate an invitation link/token for a new user."""
    # Block re-inviting existing active users
    existing_user = await db.execute(
        select(User).where(
            User.tenant_id == current_user.tenant_id,
            User.email == body.email,
            User.is_active == True,  # noqa: E712
        )
    )
    if existing_user.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="A user with this email already exists in your organisation")

    # Block duplicate pending invitations
    pending = await db.execute(
        select(Invitation).where(
            Invitation.tenant_id == current_user.tenant_id,
            Invitation.email == body.email,
            Invitation.accepted_at == None,  # noqa: E711
        )
    )
    if pending.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="A pending invitation already exists for this email")

    token = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(hours=settings.INVITE_TOKEN_EXPIRE_HOURS)

    invitation = Invitation(
        tenant_id=current_user.tenant_id,
        email=body.email,
        role=body.role,
        token=token,
        invited_by_id=current_user.id,
        expires_at=expires_at,
    )
    db.add(invitation)
    await db.commit()

    return InviteResponse(
        invite_token=token,
        email=body.email,
        role=body.role,
        expires_in_hours=settings.INVITE_TOKEN_EXPIRE_HOURS,
    )


@router.post("/accept-invite", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def accept_invite(body: AcceptInviteRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    """Accept an invitation token and create a user account."""
    result = await db.execute(select(Invitation).where(Invitation.token == body.token))
    invitation = result.scalar_one_or_none()

    if not invitation:
        raise HTTPException(status_code=404, detail="Invalid invitation token")
    if invitation.accepted_at is not None:
        raise HTTPException(status_code=410, detail="Invitation has already been used")

    expires = invitation.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Invitation has expired")

    # Guard against race conditions
    existing = await db.execute(
        select(User).where(
            User.tenant_id == invitation.tenant_id,
            User.email == invitation.email,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    # Fetch tenant slug for the token
    tenant_result = await db.execute(select(Tenant).where(Tenant.id == invitation.tenant_id))
    tenant = tenant_result.scalar_one()

    user = User(
        tenant_id=invitation.tenant_id,
        email=invitation.email,
        hashed_password=_hash_password(body.password),
        role=invitation.role,
    )
    db.add(user)
    invitation.accepted_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)

    return TokenResponse(
        access_token=create_access_token(str(user.id), str(user.tenant_id), user.role.value, tenant.slug),
        tenant_slug=tenant.slug,
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(current_user)


@router.get("/tenant", response_model=TenantResponse)
async def get_tenant(current_user: User = Depends(get_current_user)) -> TenantResponse:
    return TenantResponse.model_validate(current_user.tenant)


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    current_user: User = Depends(require_role(Role.admin)),
    db: AsyncSession = Depends(get_db),
) -> list[UserResponse]:
    """Admin-only: list all active users in the tenant."""
    result = await db.execute(
        select(User).where(User.tenant_id == current_user.tenant_id, User.is_active == True)  # noqa: E712
    )
    return [UserResponse.model_validate(u) for u in result.scalars().all()]


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_user(
    user_id: uuid.UUID,
    current_user: User = Depends(require_role(Role.admin)),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Admin-only: deactivate a user (soft delete). Cannot deactivate yourself."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")

    result = await db.execute(select(User).where(User.id == user_id, User.tenant_id == current_user.tenant_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found in your organisation")

    user.is_active = False
    await db.commit()
