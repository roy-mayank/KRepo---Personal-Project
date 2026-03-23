import uuid

from pydantic import BaseModel

from auth.models import Role


class TenantRegister(BaseModel):
    tenant_name: str
    admin_email: str
    admin_password: str


class LoginRequest(BaseModel):
    email: str
    password: str
    tenant_slug: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    tenant_slug: str


class InviteRequest(BaseModel):
    email: str
    role: Role


class InviteResponse(BaseModel):
    invite_token: str
    email: str
    role: Role
    expires_in_hours: int


class AcceptInviteRequest(BaseModel):
    token: str
    password: str


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    role: Role
    tenant_id: uuid.UUID
    is_active: bool

    model_config = {"from_attributes": True}


class TenantResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str

    model_config = {"from_attributes": True}
