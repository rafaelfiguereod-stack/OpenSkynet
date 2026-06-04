"""Media tools provider implementation.

This provider handles vision, image generation, and text-to-speech tools.
"""

from __future__ import annotations

from typing import Any, Dict, List

import structlog

from sediman.agent.tools.interfaces import ToolProvider
from sediman.llm.provider import ToolDefinition
from sediman.agent.tool_dispatch import ToolRegistry
from sediman.agent.tools.media_tools import register_media_tools

logger = structlog.get_logger()


class MediaToolProvider(ToolProvider):
    """Provider for media processing tools.

    This provider handles:
    - vision_analyze: Image analysis via vision AI
    - image_generate: Text-to-image generation
    - text_to_speech: Text-to-speech audio generation
    """

    def __init__(self):
        """Initialize the media tool provider."""
        self._registry = ToolRegistry()
        register_media_tools(self._registry)

    def get_tools(self) -> List[ToolDefinition]:
        """Get available media tools.

        Returns:
            List of media tool definitions
        """
        return list(self._registry._tools.values())

    async def execute(self, tool_name: str, params: Dict[str, Any]) -> Any:
        """Execute a media tool.

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
            raise ValueError(f"Unknown media tool: {tool_name}")

        try:
            result = await handler(**params)
            return result
        except Exception as e:
            logger.error("media_tool_execution_failed", tool=tool_name, error=str(e))
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
        return "media"


__all__ = ["MediaToolProvider"]
