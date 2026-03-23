from collections.abc import AsyncGenerator

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import selectinload

from auth.firebase import verify_firebase_token
from auth.models import Role, Tenant, User
from db import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    x_tenant_slug: str = Header(..., alias="X-Tenant-Slug"),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        decoded = verify_firebase_token(token)
    except Exception:
        raise credentials_error

    firebase_uid: str | None = decoded.get("uid")
    if not firebase_uid:
        raise credentials_error

    result = await db.execute(
        select(User)
        .options(selectinload(User.tenant))
        .join(Tenant)
        .where(
            User.firebase_uid == firebase_uid,
            Tenant.slug == x_tenant_slug,
            User.is_active == True,  # noqa: E712
            Tenant.is_active == True,  # noqa: E712
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise credentials_error

    return user


def require_role(*roles: Role):
    """Dependency factory — raises 403 if the current user's role is not in `roles`."""

    async def checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role}' is not authorized for this action",
            )
        return current_user

    return checker


# --- SOC2 MIGRATION HOOK ---
# See auth/models.py Tenant.db_url for migration steps.
async def get_tenant_db(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AsyncGenerator[AsyncSession, None]:
    if current_user.tenant and current_user.tenant.db_url:
        engine = create_async_engine(current_user.tenant.db_url)
        factory = async_sessionmaker(engine, expire_on_commit=False)
        async with factory() as tenant_session:
            yield tenant_session
    else:
        yield db
