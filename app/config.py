from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    github_token: str
    max_files: int = 300
    cache_ttl: int = 3600
    log_level: str = "INFO"

    supported_extensions: tuple = (
        ".py", ".js", ".ts", ".tsx", ".jsx",
        ".java", ".go", ".rs", ".rb",
        ".cpp", ".c", ".h", ".cs",
        ".php", ".swift", ".kt",
    )

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
