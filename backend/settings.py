from pydantic_settings import BaseSettings


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

    # Parsing
    LEMONFOX_API_KEY: str = ""
    LLAMA_CLOUD_API_KEY: str = ""

    # Qdrant
    QDRANT_PATH: str = "./qdrant_data"

    # Database
    DATABASE_URL: str = ""

    # Auth
    JWT_SECRET: str = ""
    INVITE_TOKEN_EXPIRE_HOURS: int = 72


settings = Settings()

if settings.ANTHROPIC_API_KEY:
    print(f"DEBUG: API Key loaded (starts with: {settings.ANTHROPIC_API_KEY[:10]}...)")
else:
    print("DEBUG: API Key is EMPTY!")
