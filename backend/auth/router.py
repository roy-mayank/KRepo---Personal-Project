import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth.dependencies import get_current_user, require_role
from auth.firebase import verify_firebase_token
from auth.models import Invitation, Role, Tenant, User
from auth.schemas import (
    AcceptInviteRequest,
    AcceptInviteResponse,
    InviteRequest,
    InviteResponse,
    RegisterResponse,
    TenantMembership,
    TenantRegister,
    TenantResponse,
    UserResponse,
)
from db import get_db
from settings import settings

router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


def _slugify(name: str) -> str:
    return name.lower().strip().replace(" ", "-").replace("_", "-")


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(body: TenantRegister, db: AsyncSession = Depends(get_db)) -> RegisterResponse:
    """Create a new tenant and its first admin user.

    The caller must have already signed up via Firebase.
    Pass the Firebase ID token; the backend extracts uid and email.
    """
    try:
        decoded = verify_firebase_token(body.firebase_id_token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid Firebase token")

    firebase_uid = decoded["uid"]
    email = decoded.get("email", "")
    slug = _slugify(body.tenant_name)

    existing = await db.execute(select(Tenant).where(Tenant.slug == slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Tenant name already taken")

    tenant = Tenant(name=body.tenant_name, slug=slug)
    db.add(tenant)
    await db.flush()

    user = User(
        tenant_id=tenant.id,
        email=email,
        firebase_uid=firebase_uid,
        role=Role.admin,
    )
    db.add(user)
    await db.commit()

    return RegisterResponse(tenant_slug=slug)


@router.post("/accept-invite", response_model=AcceptInviteResponse, status_code=status.HTTP_201_CREATED)
async def accept_invite(body: AcceptInviteRequest, db: AsyncSession = Depends(get_db)) -> AcceptInviteResponse:
    """Accept an invitation token and create a user account.

    The caller must have already signed up via Firebase.
    """
    try:
        decoded = verify_firebase_token(body.firebase_id_token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid Firebase token")

    firebase_uid = decoded["uid"]
    email = decoded.get("email", "")

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

    if email and email != invitation.email:
        raise HTTPException(status_code=400, detail="Firebase email does not match the invitation email")

    existing = await db.execute(
        select(User).where(
            User.tenant_id == invitation.tenant_id,
            User.firebase_uid == firebase_uid,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="An account already exists for this user")

    tenant_result = await db.execute(select(Tenant).where(Tenant.id == invitation.tenant_id))
    tenant = tenant_result.scalar_one()

    user = User(
        tenant_id=invitation.tenant_id,
        email=email or invitation.email,
        firebase_uid=firebase_uid,
        role=invitation.role,
    )
    db.add(user)
    invitation.accepted_at = datetime.now(timezone.utc)
    await db.commit()

    return AcceptInviteResponse(tenant_slug=tenant.slug)


@router.post("/invite", response_model=InviteResponse)
async def invite_user(
    body: InviteRequest,
    current_user: User = Depends(require_role(Role.admin)),
    db: AsyncSession = Depends(get_db),
) -> InviteResponse:
    """Admin-only: generate an invitation link/token for a new user."""
    existing_user = await db.execute(
        select(User).where(
            User.tenant_id == current_user.tenant_id,
            User.email == body.email,
            User.is_active == True,  # noqa: E712
        )
    )
    if existing_user.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="A user with this email already exists in your organisation")

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


@router.get("/tenants", response_model=list[TenantMembership])
async def list_my_tenants(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> list[TenantMembership]:
    """Return all orgs the current Firebase user belongs to. No X-Tenant-Slug needed."""
    try:
        decoded = verify_firebase_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid Firebase token")

    firebase_uid = decoded.get("uid")
    if not firebase_uid:
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(
        select(User)
        .options(selectinload(User.tenant))
        .join(Tenant)
        .where(
            User.firebase_uid == firebase_uid,
            User.is_active == True,  # noqa: E712
            Tenant.is_active == True,  # noqa: E712
        )
    )
    users = result.scalars().all()
    return [
        TenantMembership(
            tenant=TenantResponse.model_validate(u.tenant),
            role=u.role,
        )
        for u in users
    ]


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
