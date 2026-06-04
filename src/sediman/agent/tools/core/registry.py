"""Core tool registry and result classes.

This module provides the fundamental classes for tool registration
and result handling.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Awaitable

import structlog

from sediman.llm.provider import ToolDefinition

logger = structlog.get_logger()


@dataclass
class ToolResult:
    """Result from tool execution.

    Attributes:
        success: Whether the tool executed successfully
        output: Text output from the tool
        data: Optional additional data from the tool
    """
    success: bool
    output: str
    data: dict[str, Any] | None = None


# Type alias for tool handlers
ToolHandler = Callable[..., Awaitable[ToolResult]]


class ToolRegistry:
    """Registry for tool definitions and handlers.

    This class manages tool registration, filtering, and provides
    methods for accessing tools and their definitions.
    """

    def __init__(self) -> None:
        """Initialize the tool registry."""
        self._tools: dict[str, ToolDefinition] = {}
        self._handlers: dict[str, ToolHandler] = {}
        self._toolsets: dict[str, str] = {}
        self._checkpoint_manager: Any | None = None

    def set_checkpoint_manager(self, manager: Any) -> None:
        """Set the checkpoint manager for tool execution.

        Args:
            manager: Checkpoint manager instance
        """
        self._checkpoint_manager = manager

    def register(
        self,
        definition: ToolDefinition,
        handler: ToolHandler,
    ) -> None:
        """Register a tool with its definition and handler.

        Args:
            definition: Tool definition
            handler: Async handler function
        """
        self._tools[definition.name] = definition
        self._handlers[definition.name] = handler
        self._toolsets[definition.name] = definition.toolset

    def _filter_toolset(self, toolsets: list[str] | None) -> set[str] | None:
        """Filter tools by toolset.

        Args:
            toolsets: List of toolset names to filter by

        Returns:
            Set of allowed tool names, or None for all tools
        """
        if toolsets is None:
            return None

        from sediman.agent.tool_dispatch import resolve_toolset

        allowed: set[str] = set()
        for ts in toolsets:
            allowed |= resolve_toolset(ts)
        registered = set(self._tools.keys())
        return allowed & registered

    def get_definitions(self, toolsets: list[str] | None = None) -> list[ToolDefinition]:
        """Get tool definitions.

        Args:
            toolsets: Optional list of toolsets to filter by

        Returns:
            List of tool definitions
        """
        allowed = self._filter_toolset(toolsets)
        if allowed is None:
            return list(self._tools.values())
        return [t for t in self._tools.values() if t.name in allowed]

    def get_openai_tools(self, toolsets: list[str] | None = None) -> list[dict[str, Any]]:
        """Get tools in OpenAI function format.

        Args:
            toolsets: Optional list of toolsets to filter by

        Returns:
            List of tool definitions in OpenAI format
        """
        definitions = self.get_definitions(toolsets=toolsets)
        return [
            {
                "type": "function",
                "function": {
                    "name": t.name,
                    "description": t.description,
                    "parameters": t.parameters,
                },
            }
            for t in definitions
        ]

    def get_toolsets(self) -> dict[str, list[str]]:
        """Get all toolsets and their tools.

        Returns:
            Dictionary mapping toolset names to tool lists
        """
        result: dict[str, list[str]] = {}
        for tool_name, ts_name in self._toolsets.items():
            result.setdefault(ts_name, []).append(tool_name)
        return result

    def get_tools_by_toolset(self, toolset: str) -> list[ToolDefinition]:
        """Get all tools in a specific toolset.

        Args:
            toolset: Toolset name

        Returns:
            List of tool definitions in the toolset
        """
        return [t for t in self._tools.values() if self._toolsets.get(t.name) == toolset]

    @property
    def tools(self) -> dict[str, ToolDefinition]:
        """Get tools dictionary."""
        return self._tools

    @property
    def handlers(self) -> dict[str, ToolHandler]:
        """Get handlers dictionary."""
        return self._handlers


# Backward compatibility - create base class alias
BaseToolRegistry = ToolRegistry
