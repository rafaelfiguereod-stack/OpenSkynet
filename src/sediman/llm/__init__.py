"""LLM service abstractions and implementations.

This package provides a unified interface for LLM interactions
with support for caching, metrics, pooling, and optimization.

Modules:
- service: Abstract interfaces for LLM services
- impl: Concrete implementations of LLM services
- factory: Factory functions for creating optimized services

Example usage:
    ```python
    from sediman.llm.factory import DefaultLLMServiceFactory
    from sediman.llm.provider import LLMProvider

    provider = LLMProvider()
    factory = DefaultLLMServiceFactory(provider)
    service = factory.create_chat_service("gpt-4")
    response = await service.chat(messages)
    ```
"""

from sediman.llm.service import (
    LLMService,
    LLMPool,
    LLMCache,
    LLMMetrics,
    LLMServiceFactory,
)
from sediman.llm.impl import (
    BasicLLMService,
    CachedLLMService,
    LLMPoolImpl,
    MemoryLLMCache,
    LLMMetricsCollector,
)
from sediman.llm.factory import (
    DefaultLLMServiceFactory,
    OptimizedLLMServiceFactory,
)
from sediman.llm.provider import LLMProvider

__all__ = [
    # Interfaces
    "LLMService",
    "LLMPool",
    "LLMCache",
    "LLMMetrics",
    "LLMServiceFactory",
    # Implementations
    "BasicLLMService",
    "CachedLLMService",
    "LLMPoolImpl",
    "MemoryLLMCache",
    "LLMMetricsCollector",
    # Factories
    "DefaultLLMServiceFactory",
    "OptimizedLLMServiceFactory",
    # Original provider (for backward compatibility)
    "LLMProvider",
]
