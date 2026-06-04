"""Core tool registry and decorator utilities.

This package provides the fundamental classes for tool registration,
result handling, and decoration.
"""

from sediman.agent.tools.core.registry import ToolResult, ToolRegistry, ToolHandler, BaseToolRegistry
from sediman.agent.tools.core.decorators import tool, discover_tools, register_tool_fn

__all__ = [
    "ToolResult",
    "ToolRegistry",
    "ToolHandler",
    "BaseToolRegistry",
    "tool",
    "discover_tools",
    "register_tool_fn",
]
