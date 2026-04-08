import logging
import time
from abc import ABC, abstractmethod
from typing import Any

logger = logging.getLogger(__name__)


class BaseCache(ABC):
    @abstractmethod
    def get(self, key: str) -> Any | None:
        ...

    @abstractmethod
    def set(self, key: str, value: Any, ttl: int = 3600) -> None:
        ...

    @abstractmethod
    def clear(self) -> None:
        ...


class MemoryCache(BaseCache):
    """
    Simple in-memory cache. Thread-safe enough for single-worker dev use.
    Swap this for RedisCache in production with the same interface.
    """

    def __init__(self):
        self._store: dict[str, tuple[Any, float]] = {}

    def get(self, key: str) -> Any | None:
        entry = self._store.get(key)
        if entry is None:
            return None
        value, expires_at = entry
        if time.time() > expires_at:
            del self._store[key]
            logger.debug("Cache expired: %s", key)
            return None
        logger.debug("Cache hit: %s", key)
        return value

    def set(self, key: str, value: Any, ttl: int = 3600) -> None:
        expires_at = time.time() + ttl
        self._store[key] = (value, expires_at)
        logger.debug("Cache set: %s (ttl=%ds)", key, ttl)

    def clear(self) -> None:
        self._store.clear()
        logger.info("Cache cleared")

    @property
    def size(self) -> int:
        return len(self._store)
