import uuid

from pydantic import BaseModel

from auth.models import Role


class TenantRegister(BaseModel):
    tenant_name: str
    firebase_id_token: str


class RegisterResponse(BaseModel):
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
    firebase_id_token: str


class AcceptInviteResponse(BaseModel):
    tenant_slug: str


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


class TenantMembership(BaseModel):
    tenant: TenantResponse
    role: Role

    model_config = {"from_attributes": True}
