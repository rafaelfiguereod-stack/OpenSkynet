"""File operation tools registration.

This module handles registration of file-related tools including
read, write, patch, search, and list operations.
"""

from __future__ import annotations

from sediman.agent.tool_dispatch import ToolRegistry
from sediman.llm.provider import ToolDefinition

from .fileops import (
    _handle_list_files,
    _handle_patch,
    _handle_read_file,
    _handle_search_files,
    _handle_write_file,
)


def register_file_tools(registry: ToolRegistry) -> None:
    """Register all file operation tools.

    Args:
        registry: Tool registry to register tools with
    """
    # read_file tool
    registry.register(
        ToolDefinition(
            name="read_file",
            description="Read the contents of a file. Use this when you need to examine file contents.",
            parameters={
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "Path to the file to read",
                    },
                },
                "required": ["file_path"],
            },
            toolset="file",
        ),
        _handle_read_file,
    )

    # write_file tool
    registry.register(
        ToolDefinition(
            name="write_file",
            description="Write content to a file. Use this when creating new files or completely replacing existing file contents.",
            parameters={
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "Path to the file to write",
                    },
                    "content": {
                        "type": "string",
                        "description": "Content to write to the file",
                    },
                },
                "required": ["file_path", "content"],
            },
            toolset="file",
        ),
        _handle_write_file,
    )

    # patch tool
    registry.register(
        ToolDefinition(
            name="patch",
            description="Apply targeted edits to a file using search/replace. Use this for making specific changes without rewriting the entire file.",
            parameters={
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "Path to the file to patch",
                    },
                    "old_string": {
                        "type": "string",
                        "description": "String to search for",
                    },
                    "new_string": {
                        "type": "string",
                        "description": "Replacement string",
                    },
                },
                "required": ["file_path", "old_string", "new_string"],
            },
            toolset="file",
        ),
        _handle_patch,
    )

    # search_files tool
    registry.register(
        ToolDefinition(
            name="search_files",
            description="Search for text across multiple files. Use this to find where code or text is used.",
            parameters={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Text to search for",
                    },
                    "path": {
                        "type": "string",
                        "description": "Directory path to search in (defaults to current directory)",
                    },
                },
                "required": ["query"],
            },
            toolset="file",
        ),
        _handle_search_files,
    )

    # list_files tool
    registry.register(
        ToolDefinition(
            name="list_files",
            description="List files in a directory. Use this to explore directory structure.",
            parameters={
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Directory path to list (defaults to current directory)",
                    },
                },
                "required": [],
            },
            toolset="file",
        ),
        _handle_list_files,
    )


__all__ = ["register_file_tools"]
