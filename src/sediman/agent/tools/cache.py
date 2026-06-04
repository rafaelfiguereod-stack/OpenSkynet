"""Tool result caching implementations.

This module provides concrete implementations of tool result caching
for performance optimization.
"""

from __future__ import annotations

import asyncio
import fnmatch
import time
from typing import Any, Dict, Optional

import structlog

from sediman.agent.tools.interfaces import ToolResultCache

logger = structlog.get_logger()


class MemoryCache(ToolResultCache):
    """In-memory tool result cache with TTL support.

    This cache provides:
    - Fast in-memory storage
    - Automatic expiration
    - Pattern-based invalidation
    - Thread-safe operations
    """

    def __init__(self, max_size: int = 1000, default_ttl: int = 3600):
        """Initialize the memory cache.

        Args:
            max_size: Maximum number of cached items
            default_ttl: Default TTL in seconds
        """
        self._max_size = max_size
        self._default_ttl = default_ttl
        self._cache: Dict[str, tuple[Any, float]] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> Optional[Any]:
        """Get cached result.

        Args:
            key: Cache key

        Returns:
            Cached result or None if not found/expired
        """
        async with self._lock:
            if key not in self._cache:
                return None

            result, expiry = self._cache[key]

            # Check if expired
            if time.time() > expiry:
                del self._cache[key]
                return None

            return result

    async def set(self, key: str, value: Any, ttl: int = 3600) -> None:
        """Cache a result with TTL.

        Args:
            key: Cache key
            value: Result to cache
            ttl: Time to live in seconds
        """
        async with self._lock:
            # Enforce size limit
            if len(self._cache) >= self._max_size:
                self._evict_lru()

            expiry = time.time() + ttl
            self._cache[key] = (value, expiry)

    async def invalidate(self, pattern: str) -> int:
        """Invalidate cache entries matching pattern.

        Args:
            pattern: Glob pattern for cache keys

        Returns:
            Number of entries invalidated
        """
        async with self._lock:
            keys_to_remove = [
                key for key in self._cache.keys() if fnmatch.fnmatch(key, pattern)
            ]

            for key in keys_to_remove:
                del self._cache[key]

            logger.debug("cache_invalidated", pattern=pattern, count=len(keys_to_remove))
            return len(keys_to_remove)

    async def clear(self) -> None:
        """Clear all cache entries."""
        async with self._lock:
            self._cache.clear()
            logger.debug("cache_cleared")

    def _evict_lru(self) -> None:
        """Evict least recently used cache entry."""
        if not self._cache:
            return

        # Find entry with earliest expiry (closest to LRU approximation)
        lru_key = min(self._cache.keys(), key=lambda k: self._cache[k][1])
        del self._cache[lru_key]

    async def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics.

        Returns:
            Dictionary with cache stats
        """
        async with self._lock:
            now = time.time()
            expired_count = sum(1 for _, expiry in self._cache.values() if now > expiry)

            return {
                "total_entries": len(self._cache),
                "expired_entries": expired_count,
                "max_size": self._max_size,
                "utilization": len(self._cache) / self._max_size,
            }


class NoOpCache(ToolResultCache):
    """No-op cache that disables caching.

    This implementation is useful when caching is not desired
    but the interface needs to be maintained.
    """

    async def get(self, key: str) -> Optional[Any]:
        """Return None (no caching)."""
        return None

    async def set(self, key: str, value: Any, ttl: int = 3600) -> None:
        """Do nothing (no caching)."""
        pass

    async def invalidate(self, pattern: str) -> int:
        """Return 0 (no caching)."""
        return 0

    async def clear(self) -> None:
        """Do nothing (no caching)."""
        pass


__all__ = ["MemoryCache", "NoOpCache"]