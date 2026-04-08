from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    github_token: str
    max_files: int = 300
    cache_ttl: int = 3600
    log_level: str = "INFO"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,https://git-map.com,https://www.git-map.com"

    supported_extensions: tuple = (
        ".py", ".js", ".ts", ".tsx", ".jsx",
        ".java", ".go", ".rs", ".rb",
        ".cpp", ".c", ".h", ".cs",
        ".php", ".swift", ".kt",
    )

    class Config:
        env_file = ".env"

    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
