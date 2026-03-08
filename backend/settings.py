from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = {"env_file": ".env"}

    ANTHROPIC_API_KEY: str = ""
    JIRA_DOMAIN: str = ""
    LEMONFOX_API_KEY: str = ""
    LLAMA_CLOUD_API_KEY: str = ""


settings = Settings()
