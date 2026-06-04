"""Tool bus factory for creating configured tool buses.

This module provides factory functions for creating ToolBus instances
with all necessary providers and components.
"""

from __future__ import annotations

from typing import List, Optional

import structlog

from sediman.agent.tools.bus import ToolBus
from sediman.agent.tools.interfaces import ToolResultCache, ToolMetrics, ToolValidator
from sediman.agent.tools.cache import MemoryCache, NoOpCache
from sediman.agent.tools.metrics import ToolMetricsCollector, NoOpMetrics
from sediman.agent.tools.validator import DefaultToolValidator, NoOpValidator
from sediman.agent.tools.providers import (
    FileToolProvider,
    TerminalToolProvider,
    WebToolProvider,
    MediaToolProvider,
    SkillsToolProvider,
    MiscToolProvider,
)

logger = structlog.get_logger()


def create_tool_bus(
    enable_cache: bool = True,
    enable_metrics: bool = True,
    enable_validation: bool = True,
    cache_size: int = 1000,
    strict_validation: bool = False,
) -> ToolBus:
    """Create a fully configured ToolBus with all providers.

    Args:
        enable_cache: Whether to enable result caching
        enable_metrics: Whether to enable metrics collection
        enable_validation: Whether to enable parameter validation
        cache_size: Maximum cache size
        strict_validation: Whether to use strict validation mode

    Returns:
        Configured ToolBus instance
    """
    # Create all tool providers
    providers: List = [
        FileToolProvider(),
        TerminalToolProvider(),
        WebToolProvider(),
        MediaToolProvider(),
        SkillsToolProvider(),
        MiscToolProvider(),
    ]

    # Create cache (or no-op)
    cache: Optional[ToolResultCache] = None
    if enable_cache:
        cache = MemoryCache(max_size=cache_size)
    else:
        cache = NoOpCache()

    # Create metrics collector (or no-op)
    metrics: Optional[ToolMetrics] = None
    if enable_metrics:
        metrics = ToolMetricsCollector()
    else:
        metrics = NoOpMetrics()

    # Create validator (or no-op)
    validator: Optional[ToolValidator] = None
    if enable_validation:
        validator = DefaultToolValidator(strict_mode=strict_validation)
        # Register all tool definitions for validation
        for provider in providers:
            for tool in provider.get_tools():
                validator.register_tool(tool)
    else:
        validator = NoOpValidator()

    # Create and return ToolBus
    bus = ToolBus(
        providers=providers,
        cache=cache,
        metrics=metrics,
        validator=validator,
    )

    logger.info(
        "tool_bus_created",
        providers=len(providers),
        cache_enabled=enable_cache,
        metrics_enabled=enable_metrics,
        validation_enabled=enable_validation,
    )

    return bus


def create_minimal_tool_bus() -> ToolBus:
    """Create a minimal ToolBus without caching, metrics, or validation.

    This is useful for testing or when performance is critical.

    Returns:
        Minimal ToolBus instance
    """
    return create_tool_bus(
        enable_cache=False,
        enable_metrics=False,
        enable_validation=False,
    )


def create_performance_tool_bus(cache_size: int = 5000) -> ToolBus:
    """Create a ToolBus optimized for performance.

    This creates a ToolBus with large cache and metrics.

    Args:
        cache_size: Large cache size for performance

    Returns:
        Performance-optimized ToolBus instance
    """
    return create_tool_bus(
        enable_cache=True,
        enable_metrics=True,
        enable_validation=False,  # Skip validation for speed
        cache_size=cache_size,
    )


def create_development_tool_bus() -> ToolBus:
    """Create a ToolBus optimized for development.

    This creates a ToolBus with strict validation and metrics
    for better debugging during development.

    Returns:
        Development-optimized ToolBus instance
    """
    return create_tool_bus(
        enable_cache=True,
        enable_metrics=True,
        enable_validation=True,
        strict_validation=True,
        cache_size=1000,
    )


__all__ = [
    "create_tool_bus",
    "create_minimal_tool_bus",
    "create_performance_tool_bus",
    "create_development_tool_bus",
]
