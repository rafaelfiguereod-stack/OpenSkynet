"""Miscellaneous tools registration.

This module handles registration of miscellaneous tools including
delegation, memory, scheduling, messaging, and other utilities.
"""

from __future__ import annotations

from sediman.agent.tool_dispatch import ToolRegistry
from sediman.llm.provider import ToolDefinition

from .misc import (
    _handle_clarify,
    _handle_cronjob,
    _handle_delegate_task,
    _handle_get_schedule_results,
    _handle_list_schedules,
    _handle_memory,
    _handle_session_search,
    _handle_todo,
)
from .messaging import _handle_send_message
from .execute_code import _handle_execute_code


def register_misc_tools(registry: ToolRegistry) -> None:
    """Register all miscellaneous tools.

    Args:
        registry: Tool registry to register tools with
    """
    # delegate_task tool
    registry.register(
        ToolDefinition(
            name="delegate_task",
            description="Delegate a subtask to an isolated subagent. Use for parallelizable independent tasks like researching multiple items simultaneously.",
            parameters={
                "type": "object",
                "properties": {
                    "task": {
                        "type": "string",
                        "description": "Subtask to delegate",
                    },
                    "agent_type": {
                        "type": "string",
                        "description": "Type of subagent to use (code, explore, debug, review, etc.)",
                    },
                },
                "required": ["task"],
            },
            toolset="delegation",
        ),
        _handle_delegate_task,
    )

    # memory tool
    registry.register(
        ToolDefinition(
            name="memory",
            description="Store and retrieve persistent information across sessions. Use action='store' to save information, action='retrieve' to get stored information, action='search' to find stored information.",
            parameters={
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["store", "retrieve", "search", "list"],
                        "description": "Action to perform",
                    },
                    "key": {
                        "type": "string",
                        "description": "Storage key (for store/retrieve)",
                    },
                    "value": {
                        "type": "string",
                        "description": "Value to store (for store action)",
                    },
                    "query": {
                        "type": "string",
                        "description": "Search query (for search action)",
                    },
                },
                "required": ["action"],
            },
            toolset="memory",
        ),
        _handle_memory,
    )

    # cronjob tool
    registry.register(
        ToolDefinition(
            name="cronjob",
            description="Schedule recurring tasks using cron syntax. Use this to set up automated recurring operations.",
            parameters={
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["create", "list", "delete", "get_results"],
                        "description": "Action to perform",
                    },
                    "task": {
                        "type": "string",
                        "description": "Task to schedule (for create action)",
                    },
                    "cron": {
                        "type": "string",
                        "description": "Cron expression (e.g., '0 9 * * *' for daily at 9am, '*/5 * * * *' for every 5 minutes)",
                    },
                    "job_id": {
                        "type": "string",
                        "description": "Job identifier (for delete/get_results actions)",
                    },
                },
                "required": ["action"],
            },
            toolset="cronjob",
        ),
        _handle_cronjob,
    )

    # list_schedules tool
    registry.register(
        ToolDefinition(
            name="list_schedules",
            description="List all scheduled cron jobs.",
            parameters={
                "type": "object",
                "properties": {},
                "required": [],
            },
            toolset="cronjob",
        ),
        _handle_list_schedules,
    )

    # get_schedule_results tool
    registry.register(
        ToolDefinition(
            name="get_schedule_results",
            description="Get results from a scheduled job execution.",
            parameters={
                "type": "object",
                "properties": {
                    "job_id": {
                        "type": "string",
                        "description": "Job identifier",
                    },
                },
                "required": ["job_id"],
            },
            toolset="cronjob",
        ),
        _handle_get_schedule_results,
    )

    # session_search tool
    registry.register(
        ToolDefinition(
            name="session_search",
            description="Search past conversation sessions for information. Use when you need to find information from previous interactions.",
            parameters={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum results to return (default: 10)",
                    },
                },
                "required": ["query"],
            },
            toolset="session_search",
        ),
        _handle_session_search,
    )

    # todo tool
    registry.register(
        ToolDefinition(
            name="todo",
            description="Manage session task list. Use to track progress on multi-step tasks.",
            parameters={
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["add", "complete", "list", "clear"],
                        "description": "Action to perform",
                    },
                    "content": {
                        "type": "string",
                        "description": "Task description (for add action)",
                    },
                },
                "required": ["action"],
            },
            toolset="todo",
        ),
        _handle_todo,
    )

    # clarify tool
    registry.register(
        ToolDefinition(
            name="clarify",
            description="Ask the user questions to clarify requirements. Use when you need more information to proceed with a task.",
            parameters={
                "type": "object",
                "properties": {
                    "question": {
                        "type": "string",
                        "description": "Question to ask the user",
                    },
                },
                "required": ["question"],
            },
            toolset="clarify",
        ),
        _handle_clarify,
    )

    # execute_code tool
    registry.register(
        ToolDefinition(
            name="execute_code",
            description="Execute Python code that can call agent tools. Use for complex data processing, calculations, or operations that require programming.",
            parameters={
                "type": "object",
                "properties": {
                    "code": {
                        "type": "string",
                        "description": "Python code to execute",
                    },
                },
                "required": ["code"],
            },
            toolset="code_execution",
        ),
        _handle_execute_code,
    )

    # send_message tool
    registry.register(
        ToolDefinition(
            name="send_message",
            description="Send a message to a connected messaging platform (Discord, Telegram, etc.), or list available targets. Use action='list' to see available targets, action='send' to deliver a message. Target format: 'platform:channel_key' (e.g., 'discord:alerts', 'telegram:admin').",
            parameters={
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["list", "send"],
                        "description": "Action to perform (default: send)",
                    },
                    "target": {
                        "type": "string",
                        "description": "Target in format 'platform:channel_key' (e.g., 'discord:alerts')",
                    },
                    "content": {
                        "type": "string",
                        "description": "Message content to send",
                    },
                },
            },
            toolset="messaging",
        ),
        _handle_send_message,
    )


__all__ = ["register_misc_tools"]
