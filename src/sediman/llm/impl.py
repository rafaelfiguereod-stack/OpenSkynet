"""LLM service implementations.

This module provides concrete implementations of LLM services
with caching, pooling, and metrics collection.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import time
from collections import defaultdict
from typing import Any, AsyncIterator, Optional, List, Dict

import structlog

from sediman.llm.provider import LLMProvider, LLMResponse, ToolDefinition
from sediman.llm.service import (
    LLMService,
    LLMPool,
    LLMCache,
    LLMMetrics,
    LLMServiceFactory,
)

logger = structlog.get_logger()


class BasicLLMService(LLMService):
    """Basic LLM service wrapper around LLMProvider.

    This service provides a unified interface while delegating
    to the underlying LLM provider.
    """

    def __init__(
        self,
        provider: LLMProvider,
        service_type: str = "default"
    ):
        """Initialize the LLM service.

        Args:
            provider: Underlying LLM provider
            service_type: Type of service (chat, streaming, tools, fast)
        """
        self._provider = provider
        self._service_type = service_type
        self._created_at = time.time()

    async def chat(
        self,
        messages: List[Dict[str, str]],
        tools: Optional[List[ToolDefinition]] = None,
        **kwargs
    ) -> LLMResponse:
        """Send chat messages and get response."""
        return await self._provider.chat(messages=messages, tools=tools, **kwargs)

    async def stream(
        self,
        messages: List[Dict[str, str]],
        tools: Optional[List[ToolDefinition]] = None,
        **kwargs
    ) -> AsyncIterator[str]:
        """Stream chat responses token by token."""
        async for token in self._provider.stream(messages=messages, tools=tools, **kwargs):
            yield token

    def supports_tool_calling(self) -> bool:
        """Check if this service supports function calling."""
        return self._provider.supports_tool_calling()

    def supports_streaming(self) -> bool:
        """Check if this service supports streaming."""
        return self._provider.supports_streaming()

    def get_model_info(self) -> Dict[str, Any]:
        """Get information about the model."""
        return {
            "model": self._provider.model,
            "service_type": self._service_type,
            "supports_tools": self.supports_tool_calling(),
            "supports_streaming": self.supports_streaming(),
            "created_at": self._created_at,
        }

    async def count_tokens(self, text: str) -> int:
        """Count tokens in text."""
        return self._provider.count_tokens(text)


class CachedLLMService(LLMService):
    """LLM service with response caching.

    This service wraps another service and adds caching
    for improved performance and cost reduction.
    """

    def __init__(
        self,
        inner: LLMService,
        cache: LLMCache,
        cache_ttl: int = 3600
    ):
        """Initialize the cached service.

        Args:
            inner: Inner LLM service to wrap
            cache: Cache implementation
            cache_ttl: Default TTL in seconds
        """
        self._inner = inner
        self._cache = cache
        self._cache_ttl = cache_ttl

    async def chat(
        self,
        messages: List[Dict[str, str]],
        tools: Optional[List[ToolDefinition]] = None,
        **kwargs
    ) -> LLMResponse:
        """Send chat messages with caching."""
        # Generate cache key
        cache_key = self._compute_cache_key(messages, tools)

        # Check cache
        if cached := await self._cache.get(cache_key):
            logger.debug("llm_cache_hit", cache_key=cache_key[:16])
            return cached

        # Execute request
        response = await self._inner.chat(messages, tools, **kwargs)

        # Cache result
        await self._cache.set(cache_key, response, self._cache_ttl)

        return response

    async def stream(
        self,
        messages: List[Dict[str, str]],
        tools: Optional[List[ToolDefinition]] = None,
        **kwargs
    ) -> AsyncIterator[str]:
        """Stream responses (no caching for streams)."""
        # Delegate to inner service for streaming
        async for token in self._inner.stream(messages, tools, **kwargs):
            yield token

    def supports_tool_calling(self) -> bool:
        """Check if this service supports function calling."""
        return self._inner.supports_tool_calling()

    def supports_streaming(self) -> bool:
        """Check if this service supports streaming."""
        return self._inner.supports_streaming()

    def get_model_info(self) -> Dict[str, Any]:
        """Get information about the model."""
        info = self._inner.get_model_info()
        info["cached"] = True
        return info

    async def count_tokens(self, text: str) -> int:
        """Count tokens in text."""
        return await self._inner.count_tokens(text)

    def _compute_cache_key(
        self,
        messages: List[Dict[str, str]],
        tools: Optional[List[ToolDefinition]] = None
    ) -> str:
        """Compute cache key for request.

        Args:
            messages: Chat messages
            tools: Available tools

        Returns:
            Cache key string
        """
        key_data = {
            "messages": messages,
            "tools": [
                {"name": t.name, "parameters": t.parameters}
                for t in (tools or [])
            ]
        }

        key_str = json.dumps(key_data, sort_keys=True)
        return hashlib.md5(key_str.encode()).hexdigest()


class LLMPoolImpl(LLMPool):
    """Implementation of LLM service pool."""

    def __init__(
        self,
        factory: LLMServiceFactory,
        max_size: int = 5,
        max_idle_time: float = 300.0
    ):
        """Initialize the LLM pool.

        Args:
            factory: Factory for creating services
            max_size: Maximum pool size
            max_idle_time: Maximum idle time before eviction
        """
        self._factory = factory
        self._max_size = max_size
        self._max_idle_time = max_idle_time

        self._available: asyncio.Queue[LLMService] = asyncio.Queue(maxsize=max_size)
        self._in_use: Dict[LLMService, float] = {}
        self._service_count = 0

    async def acquire(self, service_type: str = "default") -> LLMService:
        """Acquire an LLM service from the pool."""
        # Try to get available service
        try:
            service = await asyncio.wait_for(
                self._available.get(),
                timeout=5.0
            )
            logger.debug("llm_pool_acquired_existing", service_type=service_type)
            return service
        except asyncio.TimeoutError:
            # Create new service if pool not full
            if self._service_count < self._max_size:
                service = await self._create_service(service_type)
                self._service_count += 1
                logger.debug("llm_pool_created_new", service_type=service_type)
                return service
            else:
                # Wait for available service
                service = await self._available.get()
                return service

    async def release(self, service: LLMService) -> None:
        """Release an LLM service back to the pool."""
        if service in self._in_use:
            del self._in_use[service]
            await self._available.put(service)
            logger.debug("llm_pool_released")

    async def _create_service(self, service_type: str) -> LLMService:
        """Create a new LLM service.

        Args:
            service_type: Type of service to create

        Returns:
            New LLM service instance
        """
        if service_type == "streaming":
            # Get model from factory
            return await self._factory.create_streaming_service("gpt-4")
        elif service_type == "tools":
            return await self._factory.create_tool_service("gpt-4")
        else:
            return await self._factory.create_chat_service("gpt-4")

    async def get_pool_stats(self) -> Dict[str, Any]:
        """Get pool statistics."""
        return {
            "total_services": self._service_count,
            "available_services": self._available.qsize(),
            "in_use_services": len(self._in_use),
            "max_size": self._max_size,
        }


class MemoryLLMCache(LLMCache):
    """In-memory LLM response cache."""

    def __init__(self, max_size: int = 1000, default_ttl: int = 3600):
        """Initialize the memory cache.

        Args:
            max_size: Maximum number of cached items
            default_ttl: Default TTL in seconds
        """
        self._max_size = max_size
        self._default_ttl = default_ttl
        self._cache: Dict[str, tuple[LLMResponse, float]] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> Optional[LLMResponse]:
        """Get cached LLM response."""
        async with self._lock:
            if key not in self._cache:
                return None

            response, expiry = self._cache[key]

            # Check if expired
            if time.time() > expiry:
                del self._cache[key]
                return None

            return response

    async def set(
        self,
        key: str,
        value: LLMResponse,
        ttl: int = 3600
    ) -> None:
        """Cache an LLM response."""
        async with self._lock:
            # Enforce size limit
            if len(self._cache) >= self._max_size:
                self._evict_lru()

            expiry = time.time() + ttl
            self._cache[key] = (value, expiry)

    async def invalidate(self, pattern: str) -> int:
        """Invalidate cache entries matching pattern."""
        import fnmatch

        async with self._lock:
            keys_to_remove = [
                key for key in self._cache.keys() if fnmatch.fnmatch(key, pattern)
            ]

            for key in keys_to_remove:
                del self._cache[key]

            logger.debug("llm_cache_invalidated", pattern=pattern, count=len(keys_to_remove))
            return len(keys_to_remove)

    async def clear(self) -> None:
        """Clear all cache entries."""
        async with self._lock:
            self._cache.clear()
            logger.debug("llm_cache_cleared")

    def _evict_lru(self) -> None:
        """Evict least recently used cache entry."""
        if not self._cache:
            return

        lru_key = min(self._cache.keys(), key=lambda k: self._cache[k][1])
        del self._cache[lru_key]


class LLMMetricsCollector(LLMMetrics):
    """Collector for LLM usage metrics."""

    def __init__(self):
        """Initialize the metrics collector."""
        self._token_counts: Dict[str, Dict[str, int]] = defaultdict(
            lambda: {"prompt": 0, "completion": 0}
        )
        self._request_stats: Dict[str, dict] = defaultdict(
            lambda: {"count": 0, "success": 0, "errors": 0, "total_duration_ms": 0.0}
        )

    def record_tokens(
        self,
        model: str,
        prompt_tokens: int,
        completion_tokens: int
    ) -> None:
        """Record token usage."""
        self._token_counts[model]["prompt"] += prompt_tokens
        self._token_counts[model]["completion"] += completion_tokens

    def record_request(
        self,
        model: str,
        duration_ms: float,
        success: bool,
        error: Optional[str] = None
    ) -> None:
        """Record request metrics."""
        stats = self._request_stats[model]
        stats["count"] += 1
        stats["total_duration_ms"] += duration_ms

        if success:
            stats["success"] += 1
        else:
            stats["errors"] += 1
            if error:
                logger.warning("llm_request_error", model=model, error=error)

    def get_total_tokens(self) -> int:
        """Get total tokens used."""
        total = 0
        for model_counts in self._token_counts.values():
            total += model_counts["prompt"] + model_counts["completion"]
        return total

    def get_model_stats(self, model: str) -> Dict[str, Any]:
        """Get statistics for a specific model."""
        tokens = self._token_counts.get(model, {"prompt": 0, "completion": 0})
        stats = self._request_stats.get(model, {"count": 0, "success": 0, "errors": 0})

        return {
            "model": model,
            "total_requests": stats["count"],
            "successful_requests": stats["success"],
            "failed_requests": stats["errors"],
            "total_prompt_tokens": tokens["prompt"],
            "total_completion_tokens": tokens["completion"],
            "total_tokens": tokens["prompt"] + tokens["completion"],
            "avg_duration_ms": (
                stats["total_duration_ms"] / stats["count"] if stats["count"] > 0 else 0
            ),
        }

    def get_cost_estimate(self) -> float:
        """Get cost estimate in USD."""
        # Simple cost model (can be enhanced with actual pricing)
        cost_per_1k_tokens = 0.002  # $0.002 per 1K tokens
        total_tokens = self.get_total_tokens()
        return (total_tokens / 1000) * cost_per_1k_tokens


__all__ = [
    "BasicLLMService",
    "CachedLLMService",
    "LLMPoolImpl",
    "MemoryLLMCache",
    "LLMMetricsCollector",
]
