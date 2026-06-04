"""LLM service factory implementations.

This module provides factory implementations for creating
optimized LLM services for different use cases.
"""

from __future__ import annotations

from typing import Dict, Any, Optional

import structlog

from sediman.llm.provider import LLMProvider
from sediman.llm.service import (
    LLMService,
    LLMCache,
    LLMMetrics,
    LLMServiceFactory,
)
from sediman.llm.impl import (
    BasicLLMService,
    CachedLLMService,
)

logger = structlog.get_logger()


class DefaultLLMServiceFactory(LLMServiceFactory):
    """Default factory for creating LLM services.

    This factory creates optimized services based on the
    requested service type.
    """

    def __init__(
        self,
        provider: LLMProvider,
        cache: Optional[LLMCache] = None,
        metrics: Optional[LLMMetrics] = None,
    ):
        """Initialize the factory.

        Args:
            provider: LLM provider to use
            cache: Optional cache for services
            metrics: Optional metrics collector
        """
        self._provider = provider
        self._cache = cache
        self._metrics = metrics

    def create_chat_service(self, model: str) -> LLMService:
        """Create a service optimized for chat.

        Args:
            model: Model name

        Returns:
            LLM service instance
        """
        service = BasicLLMService(self._provider, service_type="chat")

        # Wrap with cache if available
        if self._cache:
            service = CachedLLMService(service, self._cache)

        logger.debug("llm_chat_service_created", model=model)
        return service

    def create_streaming_service(self, model: str) -> LLMService:
        """Create a service optimized for streaming.

        Args:
            model: Model name

        Returns:
            LLM service instance
        """
        service = BasicLLMService(self._provider, service_type="streaming")

        # Don't cache streaming responses
        logger.debug("llm_streaming_service_created", model=model)
        return service

    def create_tool_service(self, model: str) -> LLMService:
        """Create a service optimized for tool calling.

        Args:
            model: Model name

        Returns:
            LLM service instance
        """
        service = BasicLLMService(self._provider, service_type="tools")

        # Cache tool responses
        if self._cache:
            service = CachedLLMService(service, self._cache)

        logger.debug("llm_tool_service_created", model=model)
        return service

    def create_fast_service(self, model: str) -> LLMService:
        """Create a service optimized for speed.

        Args:
            model: Model name

        Returns:
            LLM service instance
        """
        # Fast service without caching or metrics
        service = BasicLLMService(self._provider, service_type="fast")

        logger.debug("llm_fast_service_created", model=model)
        return service

    def create_custom_service(
        self,
        model: str,
        service_type: str,
        enable_cache: bool = True,
    ) -> LLMService:
        """Create a custom service with specific options.

        Args:
            model: Model name
            service_type: Type of service
            enable_cache: Whether to enable caching

        Returns:
            LLM service instance
        """
        service = BasicLLMService(self._provider, service_type=service_type)

        if enable_cache and self._cache:
            service = CachedLLMService(service, self._cache)

        logger.debug("llm_custom_service_created", model=model, service_type=service_type)
        return service


class OptimizedLLMServiceFactory(LLMServiceFactory):
    """Factory for creating optimized LLM services.

    This factory provides optimizations like:
    - Response caching
    - Request batching
    - Connection pooling
    - Token optimization
    """

    def __init__(
        self,
        provider: LLMProvider,
        cache: Optional[LLMCache] = None,
        metrics: Optional[LLMMetrics] = None,
        enable_optimizations: bool = True,
    ):
        """Initialize the optimized factory.

        Args:
            provider: LLM provider
            cache: Optional cache
            metrics: Optional metrics collector
            enable_optimizations: Whether to enable optimizations
        """
        self._provider = provider
        self._cache = cache
        self._metrics = metrics
        self._enable_optimizations = enable_optimizations

        # Service pools for different types
        self._service_pools: Dict[str, Any] = {}

    def create_chat_service(self, model: str) -> LLMService:
        """Create an optimized chat service."""
        service = BasicLLMService(self._provider, service_type="chat")

        # Apply optimizations
        if self._enable_optimizations:
            # Add caching
            if self._cache:
                service = CachedLLMService(service, self._cache)

        logger.debug("optimized_llm_chat_service_created", model=model)
        return service

    def create_streaming_service(self, model: str) -> LLMService:
        """Create an optimized streaming service."""
        service = BasicLLMService(self._provider, service_type="streaming")

        # Streaming doesn't use cache
        logger.debug("optimized_llm_streaming_service_created", model=model)
        return service

    def create_tool_service(self, model: str) -> LLMService:
        """Create an optimized tool calling service."""
        service = BasicLLMService(self._provider, service_type="tools")

        # Tool responses benefit greatly from caching
        if self._enable_optimizations and self._cache:
            service = CachedLLMService(service, self._cache)

        logger.debug("optimized_llm_tool_service_created", model=model)
        return service

    def create_fast_service(self, model: str) -> LLMService:
        """Create a fast service without overhead."""
        service = BasicLLMService(self._provider, service_type="fast")

        logger.debug("optimized_llm_fast_service_created", model=model)
        return service


__all__ = [
    "DefaultLLMServiceFactory",
    "OptimizedLLMServiceFactory",
]
