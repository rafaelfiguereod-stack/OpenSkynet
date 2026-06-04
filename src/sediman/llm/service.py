"""LLM service interfaces for abstraction and optimization.

This module provides abstract interfaces for LLM services, enabling
better testing, performance optimization, and reduced coupling.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, AsyncIterator, Optional, List, Dict

from sediman.llm.provider import LLMResponse, ToolDefinition


class LLMService(ABC):
    """Abstract interface for LLM services.

    This interface provides a unified way to interact with different
    LLM providers while enabling optimization and testing.
    """

    @abstractmethod
    async def chat(
        self,
        messages: List[Dict[str, str]],
        tools: Optional[List[ToolDefinition]] = None,
        **kwargs
    ) -> LLMResponse:
        """Send chat messages and get response.

        Args:
            messages: List of message dicts with 'role' and 'content'
            tools: Optional list of available tools
            **kwargs: Additional provider-specific parameters

        Returns:
            LLM response with text and metadata
        """
        pass

    @abstractmethod
    async def stream(
        self,
        messages: List[Dict[str, str]],
        tools: Optional[List[ToolDefinition]] = None,
        **kwargs
    ) -> AsyncIterator[str]:
        """Stream chat responses token by token.

        Args:
            messages: List of message dicts with 'role' and 'content'
            tools: Optional list of available tools
            **kwargs: Additional provider-specific parameters

        Yields:
            Response tokens as they arrive
        """
        pass

    @abstractmethod
    def supports_tool_calling(self) -> bool:
        """Check if this service supports function calling.

        Returns:
            True if tool calling is supported
        """
        pass

    @abstractmethod
    def supports_streaming(self) -> bool:
        """Check if this service supports streaming.

        Returns:
            True if streaming is supported
        """
        pass

    @abstractmethod
    def get_model_info(self) -> Dict[str, Any]:
        """Get information about the model.

        Returns:
            Dictionary with model information
        """
        pass

    @abstractmethod
    async def count_tokens(self, text: str) -> int:
        """Count tokens in text.

        Args:
            text: Text to count tokens in

        Returns:
            Number of tokens
        """
        pass


class LLMPool(ABC):
    """Abstract interface for LLM service pooling.

    Pooling allows reuse of LLM service instances for better
    performance and resource utilization.
    """

    @abstractmethod
    async def acquire(self, service_type: str = "default") -> LLMService:
        """Acquire an LLM service from the pool.

        Args:
            service_type: Type of service to acquire

        Returns:
            LLM service instance
        """
        pass

    @abstractmethod
    async def release(self, service: LLMService) -> None:
        """Release an LLM service back to the pool.

        Args:
            service: Service to release
        """
        pass

    @abstractmethod
    async def get_pool_stats(self) -> Dict[str, Any]:
        """Get pool statistics.

        Returns:
            Dictionary with pool statistics
        """
        pass


class LLMCache(ABC):
    """Abstract interface for LLM response caching.

    Caching LLM responses can significantly improve performance
    and reduce costs for repeated queries.
    """

    @abstractmethod
    async def get(self, key: str) -> Optional[LLMResponse]:
        """Get cached LLM response.

        Args:
            key: Cache key

        Returns:
            Cached response or None
        """
        pass

    @abstractmethod
    async def set(
        self,
        key: str,
        value: LLMResponse,
        ttl: int = 3600
    ) -> None:
        """Cache an LLM response.

        Args:
            key: Cache key
            value: Response to cache
            ttl: Time to live in seconds
        """
        pass

    @abstractmethod
    async def invalidate(self, pattern: str) -> int:
        """Invalidate cache entries matching pattern.

        Args:
            pattern: Glob pattern for cache keys

        Returns:
            Number of entries invalidated
        """
        pass

    @abstractmethod
    async def clear(self) -> None:
        """Clear all cache entries."""
        pass


class LLMMetrics(ABC):
    """Abstract interface for LLM usage metrics.

    Tracking LLM usage enables cost optimization and monitoring.
    """

    @abstractmethod
    def record_tokens(
        self,
        model: str,
        prompt_tokens: int,
        completion_tokens: int
    ) -> None:
        """Record token usage.

        Args:
            model: Model name
            prompt_tokens: Number of prompt tokens
            completion_tokens: Number of completion tokens
        """
        pass

    @abstractmethod
    def record_request(
        self,
        model: str,
        duration_ms: float,
        success: bool,
        error: Optional[str] = None
    ) -> None:
        """Record request metrics.

        Args:
            model: Model name
            duration_ms: Request duration in milliseconds
            success: Whether request succeeded
            error: Error message if failed
        """
        pass

    @abstractmethod
    def get_total_tokens(self) -> int:
        """Get total tokens used.

        Returns:
            Total number of tokens
        """
        pass

    @abstractmethod
    def get_model_stats(self, model: str) -> Dict[str, Any]:
        """Get statistics for a specific model.

        Args:
            model: Model name

        Returns:
            Dictionary with model statistics
        """
        pass

    @abstractmethod
    def get_cost_estimate(self) -> float:
        """Get cost estimate in USD.

        Returns:
            Estimated cost in USD
        """
        pass


class LLMServiceFactory(ABC):
    """Abstract interface for LLM service factory.

    Factory pattern allows creating optimized LLM services
    for different use cases (chat, streaming, tools, etc.).
    """

    @abstractmethod
    def create_chat_service(self, model: str) -> LLMService:
        """Create a service optimized for chat.

        Args:
            model: Model name

        Returns:
            LLM service instance
        """
        pass

    @abstractmethod
    def create_streaming_service(self, model: str) -> LLMService:
        """Create a service optimized for streaming.

        Args:
            model: Model name

        Returns:
            LLM service instance
        """
        pass

    @abstractmethod
    def create_tool_service(self, model: str) -> LLMService:
        """Create a service optimized for tool calling.

        Args:
            model: Model name

        Returns:
            LLM service instance
        """
        pass

    @abstractmethod
    def create_fast_service(self, model: str) -> LLMService:
        """Create a service optimized for speed.

        Args:
            model: Model name

        Returns:
            LLM service instance
        """
        pass


__all__ = [
    "LLMService",
    "LLMPool",
    "LLMCache",
    "LLMMetrics",
    "LLMServiceFactory",
]
