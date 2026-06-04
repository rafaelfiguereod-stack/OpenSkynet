"""Terminal and process tools registration.

This module handles registration of terminal command execution
and process management tools.
"""

from __future__ import annotations

from sediman.agent.tool_dispatch import ToolRegistry
from sediman.llm.provider import ToolDefinition

from .terminal import _handle_terminal
from .process import _handle_process


def register_terminal_tools(registry: ToolRegistry) -> None:
    """Register all terminal and process tools.

    Args:
        registry: Tool registry to register tools with
    """
    # terminal tool
    registry.register(
        ToolDefinition(
            name="terminal",
            description="Execute shell commands in a terminal. Use for running build tools, package managers, git operations, and other system commands. Requires approval for network operations.",
            parameters={
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "Shell command to execute",
                    },
                    "allow_net": {
                        "type": "boolean",
                        "description": "Allow network access (default: false)",
                    },
                },
                "required": ["command"],
            },
            toolset="terminal",
        ),
        _handle_terminal,
    )

    # process tool
    registry.register(
        ToolDefinition(
            name="process",
            description="Manage long-running background processes. Use to start, stop, or check status of background services.",
            parameters={
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["start", "stop", "status", "list"],
                        "description": "Action to perform on the process",
                    },
                    "command": {
                        "type": "string",
                        "description": "Command to start (for start action)",
                    },
                    "name": {
                        "type": "string",
                        "description": "Process name identifier",
                    },
                },
                "required": ["action"],
            },
            toolset="terminal",
        ),
        _handle_process,
    )


__all__ = ["register_terminal_tools"]
