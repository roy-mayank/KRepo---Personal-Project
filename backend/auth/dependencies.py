import uuid
from collections.abc import AsyncGenerator

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import selectinload

from auth.jwt import decode_token
from auth.models import Role, User
from db import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
    except ValueError:
        raise credentials_error

    user_id: str | None = payload.get("sub")
    if not user_id:
        raise credentials_error

    result = await db.execute(
        select(User).options(selectinload(User.tenant)).where(User.id == uuid.UUID(user_id), User.is_active == True)  # noqa: E712
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


# ─── SOC2 MIGRATION HOOK ────────────────────────────────────────────────────
# Currently all tenants share the same Postgres instance (tenant_id row filter).
# To migrate a tenant to a fully dedicated database (required for SOC2 silo model):
#   1. Provision a dedicated Postgres instance (e.g. separate RDS on its own EC2)
#   2. Run `alembic upgrade head` against the new DB
#   3. Migrate the tenant's existing data (pg_dump/restore or a custom script)
#   4. Set Tenant.db_url to the new connection string in the control-plane DB
#   5. This dependency will automatically start routing that tenant's requests
#      to the dedicated DB — no application code changes needed elsewhere.
# ─────────────────────────────────────────────────────────────────────────────
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
