"""File tools provider implementation.

This provider handles file system operations including reading,
writing, patching, searching, and listing files.
"""

from __future__ import annotations

from typing import Any, Dict, List

import structlog

from sediman.agent.tools.interfaces import ToolProvider
from sediman.llm.provider import ToolDefinition
from sediman.agent.tool_dispatch import ToolRegistry

# Import handler functions directly to avoid circular imports
try:
    from sediman.agent.tools.file_tools import (
        _handle_read_file,
        _handle_write_file,
        _handle_patch_file,
        _handle_search_files,
        _handle_list_files,
    )
except ImportError:
    # If imports fail, define placeholders
    _handle_read_file = None
    _handle_write_file = None
    _handle_patch_file = None
    _handle_search_files = None
    _handle_list_files = None

logger = structlog.get_logger()


class FileToolProvider(ToolProvider):
    """Provider for file system tools.

    This provider handles:
    - read_file: Read file contents
    - write_file: Write contents to file
    - patch_file: Apply patches to files
    - search_files: Search for content in files
    - list_files: List directory contents
    """

    def __init__(self):
        """Initialize the file tool provider."""
        self._registry = ToolRegistry()

        # Register tools manually if handlers are available
        if all([_handle_read_file, _handle_write_file, _handle_patch_file, _handle_search_files, _handle_list_files]):
            from sediman.llm.provider import ToolDefinition

            # Register read_file tool
            read_file_tool = ToolDefinition(
                name="read_file",
                description="Read file contents with optional line ranges",
                parameters={
                    "type": "object",
                    "properties": {
                        "path": {
                            "type": "string",
                            "description": "Path to the file to read"
                        },
                        "start_line": {
                            "type": "integer",
                            "description": "Optional start line number (1-based)"
                        },
                        "end_line": {
                            "type": "integer",
                            "description": "Optional end line number (1-based)"
                        },
                    },
                    "required": ["path"],
                },
                toolset="file",
            )
            self._registry.register(read_file_tool, _handle_read_file)

            # Register write_file tool
            write_file_tool = ToolDefinition(
                name="write_file",
                description="Write content to a file",
                parameters={
                    "type": "object",
                    "properties": {
                        "path": {
                            "type": "string",
                            "description": "Path to the file to write"
                        },
                        "content": {
                            "type": "string",
                            "description": "Content to write"
                        },
                    },
                    "required": ["path", "content"],
                },
                toolset="file",
            )
            self._registry.register(write_file_tool, _handle_write_file)

            # Register patch_file tool
            patch_file_tool = ToolDefinition(
                name="patch",
                description="Apply a unified diff patch to a file",
                parameters={
                    "type": "object",
                    "properties": {
                        "path": {
                            "type": "string",
                            "description": "Path to the file to patch"
                        },
                        "patch": {
                            "type": "string",
                            "description": "Unified diff patch to apply"
                        },
                    },
                    "required": ["path", "patch"],
                },
                toolset="file",
            )
            self._registry.register(patch_file_tool, _handle_patch_file)

            # Register search_files tool
            search_files_tool = ToolDefinition(
                name="search_files",
                description="Search for content across files",
                parameters={
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Search query (supports regex)"
                        },
                        "path": {
                            "type": "string",
                            "description": "Root directory to search in"
                        },
                        "file_pattern": {
                            "type": "string",
                            "description": "File pattern to match (e.g., '*.py')"
                        },
                    },
                    "required": ["query"],
                },
                toolset="file",
            )
            self._registry.register(search_files_tool, _handle_search_files)

            # Register list_files tool
            list_files_tool = ToolDefinition(
                name="list_files",
                description="List directory contents",
                parameters={
                    "type": "object",
                    "properties": {
                        "path": {
                            "type": "string",
                            "description": "Directory path to list"
                        },
                        "pattern": {
                            "type": "string",
                            "description": "File pattern to filter results"
                        },
                    },
                    "required": ["path"],
                },
                toolset="file",
            )
            self._registry.register(list_files_tool, _handle_list_files)

    def get_tools(self) -> List[ToolDefinition]:
        """Get available file tools.

        Returns:
            List of file tool definitions
        """
        return list(self._registry._tools.values())

    async def execute(self, tool_name: str, params: Dict[str, Any]) -> Any:
        """Execute a file tool.

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
            raise ValueError(f"Unknown file tool: {tool_name}")

        try:
            # Call the handler with parameters
            result = await handler(**params)
            return result
        except Exception as e:
            logger.error("file_tool_execution_failed", tool=tool_name, error=str(e))
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
        return "file"


__all__ = ["FileToolProvider"]
