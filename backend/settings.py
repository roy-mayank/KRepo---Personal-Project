from dotenv import load_dotenv
from pydantic_settings import BaseSettings

# Load .env into os.environ early so third-party SDKs (e.g. Langfuse)
# that read env vars directly can find them.
load_dotenv()


class Settings(BaseSettings):
    model_config = {"env_file": ".env"}

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

    # Integration credentials encryption
    CREDENTIALS_ENCRYPTION_KEY: str = ""  # Fernet key for encrypting OAuth tokens at rest

    # Langfuse observability
    LANGFUSE_SECRET_KEY: str = ""
    LANGFUSE_PUBLIC_KEY: str = ""
    LANGFUSE_BASE_URL: str = "https://cloud.langfuse.com"

    # Parsing
    LEMONFOX_API_KEY: str = ""
    LLAMA_CLOUD_API_KEY: str = ""

    # Database
    DATABASE_URL: str = ""

    # Auth
    FIREBASE_SERVICE_ACCOUNT: str = ""  # base64-encoded service account JSON
    INVITE_TOKEN_EXPIRE_HOURS: int = 72


settings = Settings()

if settings.ANTHROPIC_API_KEY:
    print(f"DEBUG: API Key loaded (starts with: {settings.ANTHROPIC_API_KEY[:10]}...)")
else:
    print("DEBUG: API Key is EMPTY!")
