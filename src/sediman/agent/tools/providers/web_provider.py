"""Web tools provider implementation.

This provider handles web search and content extraction tools.
"""

from __future__ import annotations

from typing import Any, Dict, List

import structlog

from sediman.agent.tools.interfaces import ToolProvider
from sediman.llm.provider import ToolDefinition
from sediman.agent.tool_dispatch import ToolRegistry

# Import handler functions directly to avoid circular imports
# Importing from implementation modules instead of through __init__.py
try:
    from sediman.agent.tools.web_tools import _handle_web_extract, _handle_web_search
except ImportError:
    # If imports fail, define placeholders
    _handle_web_extract = None
    _handle_web_search = None

logger = structlog.get_logger()


class WebToolProvider(ToolProvider):
    """Provider for web tools.

    This provider handles:
    - web_search: Search the web
    - web_extract: Extract content from web pages
    """

    def __init__(self):
        """Initialize the web tool provider."""
        self._registry = ToolRegistry()

        # Register tools if handlers are available
        if _handle_web_search and _handle_web_extract:
            from sediman.llm.provider import ToolDefinition

            # Register web_search tool
            web_search_tool = ToolDefinition(
                name="web_search",
                description="Search the web for information",
                parameters={
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Search query"
                        },
                        "num_results": {
                            "type": "integer",
                            "description": "Number of results to return (default: 5)"
                        }
                    },
                    "required": ["query"],
                },
                toolset="web",
            )
            self._registry.register(web_search_tool, _handle_web_search)

            # Register web_extract tool
            web_extract_tool = ToolDefinition(
                name="web_extract",
                description="Extract and summarize content from web pages",
                parameters={
                    "type": "object",
                    "properties": {
                        "url": {
                            "type": "string",
                            "description": "URL of the page to extract"
                        }
                    },
                    "required": ["url"],
                },
                toolset="web",
            )
            self._registry.register(web_extract_tool, _handle_web_extract)

    def get_tools(self) -> List[ToolDefinition]:
        """Get available web tools.

        Returns:
            List of web tool definitions
        """
        return list(self._registry._tools.values())

    async def execute(self, tool_name: str, params: Dict[str, Any]) -> Any:
        """Execute a web tool.

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
            raise ValueError(f"Unknown web tool: {tool_name}")

        try:
            result = await handler(**params)
            return result
        except Exception as e:
            logger.error("web_tool_execution_failed", tool=tool_name, error=str(e))
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
        return "web"


__all__ = ["WebToolProvider"]
