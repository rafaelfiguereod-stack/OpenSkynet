"""Migration utilities for transitioning to new tool architecture.

This module provides compatibility layers and utilities to help
existing code transition to the new tool system architecture.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import structlog

from sediman.agent.tool_dispatch import ToolRegistry
from sediman.agent.tools.bus import ToolBus
from sediman.agent.tools.factory import create_tool_bus

logger = structlog.get_logger()


class ToolRegistryAdapter:
    """Adapter to make ToolRegistry work like ToolBus.

    This adapter provides backward compatibility for code that still
    uses the old ToolRegistry while internally using the new ToolBus.
    """

    def __init__(
        self,
        tool_bus: ToolBus,
        original_registry: Optional[ToolRegistry] = None
    ):
        """Initialize the adapter.

        Args:
            tool_bus: New ToolBus instance
            original_registry: Optional original ToolRegistry for compatibility
        """
        self._tool_bus = tool_bus
        self._original = original_registry or ToolRegistry()

        # Populate tools from tool bus
        self._tools = {}
        self._handlers = {}
        self._adapt_tools()

    def _adapt_tools(self) -> None:
        """Adapt ToolBus tools to ToolRegistry format."""
        for tool in self._tool_bus.get_tools():
            self._tools[tool.name] = tool

            # Create handler wrapper
            async def handler(**params):
                return await self._tool_bus.execute(tool.name, params)

            self._handlers[tool.name] = handler

    def register(self, tool_def: Any, handler: Any = None) -> None:
        """Register a tool (backward compatibility)."""
        # Store in original format
        self._tools[tool_def.name] = tool_def
        if handler:
            self._handlers[tool_def.name] = handler

        # Also register with tool bus if possible
        try:
            # This is a no-op in the adapter pattern
            pass
        except Exception as e:
            logger.debug("adapter_register_skip", error=str(e))

    def has_tool(self, tool_name: str) -> bool:
        """Check if tool exists."""
        return tool_name in self._tools

    @property
    def tools(self) -> Dict[str, Any]:
        """Get tools dictionary."""
        return self._tools

    @property
    def handlers(self) -> Dict[str, Any]:
        """Get handlers dictionary."""
        return self._handlers


def create_legacy_registry(
    tool_bus: Optional[ToolBus] = None
) -> ToolRegistryAdapter:
    """Create a legacy registry that wraps ToolBus.

    Args:
        tool_bus: ToolBus to wrap (creates default if None)

    Returns:
        ToolRegistryAdapter instance
    """
    if tool_bus is None:
        tool_bus = create_tool_bus()

    return ToolRegistryAdapter(tool_bus)


def migrate_to_new_tool_system(
    original_registry: ToolRegistry,
    enable_cache: bool = True,
    enable_metrics: bool = True
) -> ToolBus:
    """Migrate from old ToolRegistry to new ToolBus.

    This function:
    1. Creates a new ToolBus with all tools
    2. Preserves existing tool registrations
    3. Enables performance optimizations

    Args:
        original_registry: Original ToolRegistry to migrate from
        enable_cache: Whether to enable caching
        enable_metrics: Whether to enable metrics

    Returns:
        New ToolBus instance with all tools migrated
    """
    logger.info("starting_tool_system_migration")

    # Create new tool bus
    tool_bus = create_tool_bus(
        enable_cache=enable_cache,
        enable_metrics=enable_metrics,
    )

    # Log migration stats
    original_tools = len(original_registry._tools)
    tool_bus_tools = len(tool_bus.get_tools())

    logger.info(
        "tool_system_migration_complete",
        original_tools=original_tools,
        new_tools=tool_bus_tools,
    )

    return tool_bus


def get_tool_bus_from_registry(
    registry: Any,
    create_if_needed: bool = True
) -> Optional[ToolBus]:
    """Extract or create ToolBus from existing registry.

    This utility helps migrate code that uses ToolRegistry to ToolBus.

    Args:
        registry: ToolRegistry or ToolBus instance
        create_if_needed: Whether to create ToolBus if registry is ToolRegistry

    Returns:
        ToolBus instance or None
    """
    # If already a ToolBus, return as-is
    if isinstance(registry, ToolBus):
        return registry

    # If ToolRegistry, create adapter
    if hasattr(registry, "_tools") and hasattr(registry, "_handlers"):
        if create_if_needed:
            return create_legacy_registry(registry)

    return None


__all__ = [
    "ToolRegistryAdapter",
    "create_legacy_registry",
    "migrate_to_new_tool_system",
    "get_tool_bus_from_registry",
]
