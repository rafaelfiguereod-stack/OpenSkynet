"""Agent tools package.

This package provides modular tool registration for agent operations.
Tools are organized by category for better maintainability.

Modules:
- interfaces: Abstract interfaces for tool system
- bus: Central tool coordination with caching and metrics
- factory: Factory functions for creating configured tool buses
- cache: Tool result caching implementations
- metrics: Tool metrics collection implementations
- validator: Tool parameter and result validation
- providers: Concrete tool providers for each category
- registry: ToolRegistry and global state management (legacy)
- file_tools: File operations (read, write, patch, search, list)
- terminal_tools: Terminal and process management
- web_tools: Web search and content extraction
- media_tools: Vision, image generation, text-to-speech
- skills_tools: Skill search and management
- misc_tools: Miscellaneous tools (delegation, memory, scheduling, etc.)
"""

from __future__ import annotations

from typing import Any

import structlog

from sediman.agent.tool_dispatch import ToolRegistry

# New tool system components
from .bus import ToolBus
from .factory import (
    create_tool_bus,
    create_minimal_tool_bus,
    create_performance_tool_bus,
    create_development_tool_bus,
)
from .cache import MemoryCache, NoOpCache
from .metrics import ToolMetricsCollector, NoOpMetrics
from .validator import DefaultToolValidator, NoOpValidator
from .interfaces import (
    ToolProvider,
    ToolResultCache,
    ToolMetrics,
    ToolValidator,
)
from .migration import (
    ToolRegistryAdapter,
    create_legacy_registry,
    migrate_to_new_tool_system,
    get_tool_bus_from_registry,
)

# Legacy components
from .registry import (
    TerminalApprovalCallback,
    set_terminal_approval_callback,
    set_terminal_allowed,
    is_terminal_allowed,
    reset_terminal_state,
    set_memory_manager,
    get_memory_manager,
    set_subagent_factory,
    get_subagent_factory,
    _terminal_approval_callback,  # Backward compatibility
    _terminal_session_allowed,  # Backward compatibility
)

from .file_tools import register_file_tools
from .terminal_tools import register_terminal_tools
from .web_tools import register_web_tools
from .media_tools import register_media_tools
from .skills_tools import register_skills_tools, _handle_skill_manage
from .misc_tools import register_misc_tools

logger = structlog.get_logger()


def create_agent_tool_registry(toolsets: list[str] | None = None) -> ToolRegistry:
    """Create and populate a tool registry with agent tools.

    This function creates a new ToolRegistry and registers all
    available tools. The toolsets parameter can be used to filter
    which tool categories are registered.

    Args:
        toolsets: Optional list of toolset names to register.
                  If None, all toolsets are registered.

    Returns:
        Populated ToolRegistry instance
    """
    registry = ToolRegistry()

    # Register tools from external integrations first
    from sediman.integrations import get_all_tools
    for tool_def, handler in get_all_tools():
        registry.register(tool_def, handler)

    # Register all tool categories
    if _should_register_toolset(toolsets, "file"):
        register_file_tools(registry)

    if _should_register_toolset(toolsets, "terminal"):
        register_terminal_tools(registry)

    if _should_register_toolset(toolsets, "web"):
        register_web_tools(registry)

    if _should_register_toolset(toolsets, "media"):
        register_media_tools(registry)

    if _should_register_toolset(toolsets, "skills"):
        register_skills_tools(registry)

    if _should_register_toolset(toolsets, "misc"):
        register_misc_tools(registry)

    logger.info(
        "tool_registry_created",
        toolsets=toolsets or "all",
        total_tools=len(registry._tools),
    )

    return registry


def _should_register_toolset(
    requested: list[str] | None,
    toolset: str,
) -> bool:
    """Check if a toolset should be registered.

    Args:
        requested: List of requested toolsets, or None for all
        toolset: Toolset name to check

    Returns:
        True if the toolset should be registered
    """
    if requested is None:
        return True

    if "all" in requested or "*" in requested:
        return True

    return toolset in requested


# Re-exports for backward compatibility
from .skills import _TodoStore  # noqa: E402, F401


__all__ = [
    # New tool system
    "ToolBus",
    "ToolProvider",
    "ToolResultCache",
    "ToolMetrics",
    "ToolValidator",
    "MemoryCache",
    "NoOpCache",
    "ToolMetricsCollector",
    "NoOpMetrics",
    "DefaultToolValidator",
    "NoOpValidator",
    # Factory functions
    "create_tool_bus",
    "create_minimal_tool_bus",
    "create_performance_tool_bus",
    "create_development_tool_bus",
    # Migration utilities
    "ToolRegistryAdapter",
    "create_legacy_registry",
    "migrate_to_new_tool_system",
    "get_tool_bus_from_registry",
    # Legacy registry exports
    "TerminalApprovalCallback",
    "set_terminal_approval_callback",
    "set_terminal_allowed",
    "is_terminal_allowed",
    "reset_terminal_state",
    "set_memory_manager",
    "get_memory_manager",
    "get_subagent_factory",
    # Main factory
    "create_agent_tool_registry",
    # Backward compatibility
    "_TodoStore",
    "_handle_skill_manage",
]
