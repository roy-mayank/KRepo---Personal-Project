from pathlib import Path

from dotenv import load_dotenv
from pydantic import field_validator
from pydantic_settings import BaseSettings

_BACKEND_DIR = Path(__file__).resolve().parent
_BACKEND_ENV = _BACKEND_DIR / ".env"
_ROOT_ENV = _BACKEND_DIR.parent / ".env"

# Load env vars early so third-party SDKs (e.g. Langfuse) can read them.
# Repo-root .env is the usual local store; backend/.env overrides when present.
if _ROOT_ENV.exists():
    load_dotenv(dotenv_path=_ROOT_ENV)
if _BACKEND_ENV.exists():
    load_dotenv(dotenv_path=_BACKEND_ENV, override=True)

_ENV_FILES = tuple(p for p in (_ROOT_ENV, _BACKEND_ENV) if p.exists())


class Settings(BaseSettings):
    model_config = {"env_file": _ENV_FILES}

    # LLM
    ANTHROPIC_API_KEY: str = ""

    # Jira
    JIRA_DOMAIN: str = ""
    JIRA_ACCESS_TOKEN: str = ""
    JIRA_PROJECT_KEYS: str = ""

    # Confluence
    CONFLUENCE_SPACE_KEYS: str = ""

    # Slack
    SLACK_BOT_TOKEN: str = ""
    SLACK_CHANNEL_IDS: str = ""

    # Linear
    LINEAR_API_KEY: str = ""

    # GitHub
    GITHUB_TOKEN: str = ""
    GITHUB_REPOS: str = ""  # comma-separated "owner/repo" pairs, e.g. "myorg/backend,myorg/frontend"

    # Azure DevOps
    AZURE_DEVOPS_TOKEN: str = ""
    AZURE_DEVOPS_ORG: str = ""
    AZURE_DEVOPS_REPOS: str = ""  # comma-separated "project/repo" pairs

    # Notion OAuth
    NOTION_CLIENT_ID: str = ""
    NOTION_CLIENT_SECRET: str = ""
    NOTION_REDIRECT_URI: str = ""  # e.g. http://localhost:8000/integrations/notion/callback

    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = ""  # e.g. http://localhost:8000/integrations/google_drive/callback

    # Integration credentials encryption
    CREDENTIALS_ENCRYPTION_KEY: str = ""  # Fernet key for encrypting OAuth tokens at rest

    # Langfuse observability
    LANGFUSE_SECRET_KEY: str = ""
    LANGFUSE_PUBLIC_KEY: str = ""
    LANGFUSE_BASE_URL: str = "https://cloud.langfuse.com"

    # Parsing
    LEMONFOX_API_KEY: str = ""
    LLAMA_CLOUD_API_KEY: str = ""

    # Database — Railway Postgres (pgvector template) or local Postgres
    DATABASE_URL: str = ""
    REQUIRE_PGVECTOR: bool = False

    # CORS — comma-separated origins; include your Railway frontend URL in production
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Auth
    FIREBASE_SERVICE_ACCOUNT: str = ""  # base64-encoded service account JSON
    INVITE_TOKEN_EXPIRE_HOURS: int = 72

    @field_validator("DATABASE_URL", mode="after")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        """Ensure SQLAlchemy async engine gets the asyncpg driver."""
        if not value:
            raise ValueError(
                "DATABASE_URL is not set. For Railway, reference the Postgres service "
                "(${{Postgres.DATABASE_URL}}). For local dev, use repo-root .env "
                "(e.g. postgresql+asyncpg://postgres:password@127.0.0.1:5432/krepo)."
            )
        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+asyncpg://", 1)
        if value.startswith("postgresql://") and "+asyncpg" not in value:
            return value.replace("postgresql://", "postgresql+asyncpg://", 1)
        return value


settings = Settings()

if settings.ANTHROPIC_API_KEY:
    print(f"DEBUG: API Key loaded (starts with: {settings.ANTHROPIC_API_KEY[:10]}...)")
else:
    print("DEBUG: API Key is EMPTY!")
