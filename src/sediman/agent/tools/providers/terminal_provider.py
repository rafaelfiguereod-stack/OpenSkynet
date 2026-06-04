"""Terminal tools provider implementation.

This provider handles terminal command execution and process management.
"""

from __future__ import annotations

from typing import Any, Dict, List

import structlog

from sediman.agent.tools.interfaces import ToolProvider
from sediman.llm.provider import ToolDefinition
from sediman.agent.tool_dispatch import ToolRegistry
from sediman.agent.tools.terminal_tools import register_terminal_tools

logger = structlog.get_logger()


class TerminalToolProvider(ToolProvider):
    """Provider for terminal and process tools.

    This provider handles:
    - terminal: Execute shell commands
    - process: Manage background processes
    """

    def __init__(self):
        """Initialize the terminal tool provider."""
        self._registry = ToolRegistry()
        register_terminal_tools(self._registry)

    def get_tools(self) -> List[ToolDefinition]:
        """Get available terminal tools.

        Returns:
            List of terminal tool definitions
        """
        return list(self._registry._tools.values())

    async def execute(self, tool_name: str, params: Dict[str, Any]) -> Any:
        """Execute a terminal tool.

        Args:
            tool_name: Name of the tool to execute
            params: Tool parameters

        Returns:
            Tool execution result

        Raises:
            ValueError: If tool not found or execution fails
        """
        handler = self._registry._handlers.get(tool_name)
        if not handler:
            raise ValueError(f"Unknown terminal tool: {tool_name}")

        try:
            result = await handler(**params)
            return result
        except Exception as e:
            logger.error("terminal_tool_execution_failed", tool=tool_name, error=str(e))
            raise

    def supports(self, tool_name: str) -> bool:
        """Check if provider supports a tool.

        Args:
            tool_name: Name of the tool to check

        Returns:
            True if provider supports the tool
        """
        return tool_name in self._registry._handlers

    def get_category(self) -> str:
        """Get the tool category.

        Returns:
            Tool category name
        """
        return "terminal"


__all__ = ["TerminalToolProvider"]
