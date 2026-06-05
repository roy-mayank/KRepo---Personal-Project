from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from auth.firebase import init_firebase
from auth.router import router as auth_router
from chat.router import router as chat_router
from db import create_all_tables
from integrations.router import router as integrations_router
from onboarding.router import router as onboarding_router
from rag.documents import router as documents_router
from rag.github_router import router as github_router
from rag.router import router as rag_router
from settings import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_firebase()
    await create_all_tables()
    yield


app = FastAPI(title="KRepo API", lifespan=lifespan)

_cors_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    # Local Vite may use any port (5173, 5175, etc.) when hitting a remote API
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Conversation-Id"],
)

app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(integrations_router)
app.include_router(onboarding_router)
app.include_router(rag_router)
app.include_router(documents_router)
app.include_router(github_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
