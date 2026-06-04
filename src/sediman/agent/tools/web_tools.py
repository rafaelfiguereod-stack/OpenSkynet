"""Web search and extraction tools registration.

This module handles registration of web-related tools including
search, content extraction, and orchestration.
"""

from __future__ import annotations

from sediman.agent.tool_dispatch import ToolRegistry
from sediman.llm.provider import ToolDefinition

from .misc import (
    _handle_web_extract,
    _handle_web_search,
)
from .orchestrate import _handle_search_orchestrate


def register_web_tools(registry: ToolRegistry) -> None:
    """Register all web-related tools.

    Args:
        registry: Tool registry to register tools with
    """
    # web_search tool
    registry.register(
        ToolDefinition(
            name="web_search",
            description="Search the web for information. Use when you need to find current data, verify facts, or look up URLs before browsing.",
            parameters={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query",
                    },
                },
                "required": ["query"],
            },
            toolset="web",
        ),
        _handle_web_search,
    )

    # web_extract tool
    registry.register(
        ToolDefinition(
            name="web_extract",
            description="Extract and analyze content from web pages without full browser automation. Use for reading documentation, articles, or extracting structured data from known URLs.",
            parameters={
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "URL to extract content from",
                    },
                    "extract": {
                        "type": "string",
                        "description": "What to extract (default: full content)",
                    },
                },
                "required": ["url"],
            },
            toolset="web",
        ),
        _handle_web_extract,
    )

    # search_orchestrate tool
    registry.register(
        ToolDefinition(
            name="search_orchestrate",
            description="Execute complex search pipelines using Python code with SearchSDK. Use for multi-step research, cross-referencing, or structured extraction tasks. Provides parallel search, deterministic filtering, structured extraction, and state persistence.",
            parameters={
                "type": "object",
                "properties": {
                    "code": {
                        "type": "string",
                        "description": "Python code using SearchSDK. Available: sdk.retrieve.web/web_many(), sdk.filter.dedupe/by_domain/by_regex/by_keyword(), sdk.extract.extract_many/extract_one(), sdk.state.save/load/list()",
                    },
                },
                "required": ["code"],
            },
            toolset="search",
        ),
        _handle_search_orchestrate,
    )


__all__ = ["register_web_tools"]
