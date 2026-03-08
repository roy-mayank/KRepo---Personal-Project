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

    # Parsing
    LEMONFOX_API_KEY: str = ""
    LLAMA_CLOUD_API_KEY: str = ""

    # Qdrant
    QDRANT_PATH: str = "./qdrant_data"


settings = Settings()
