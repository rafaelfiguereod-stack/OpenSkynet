"""Miscellaneous tools provider implementation.

This provider handles delegation, memory, scheduling, messaging, and other utility tools.
"""

from __future__ import annotations

from typing import Any, Dict, List

import structlog

from sediman.agent.tools.interfaces import ToolProvider
from sediman.llm.provider import ToolDefinition
from sediman.agent.tool_dispatch import ToolRegistry

# Import handler functions directly to avoid circular imports
# NOTE: These imports may fail during circular import initialization
# The handlers will be imported lazily when needed
_handle_clarify = None
_handle_cronjob = None
_handle_delegate_task = None
_handle_get_schedule_results = None
_handle_list_schedules = None
_handle_memory = None
_handle_session_search = None
_handle_todo = None
_handle_send_message = None
_handle_execute_code = None

_handlers_imported = False

def _import_handlers():
    """Lazy import of handlers to avoid circular imports."""
    global _handle_clarify, _handle_cronjob, _handle_delegate_task
    global _handle_get_schedule_results, _handle_list_schedules
    global _handle_memory, _handle_session_search, _handle_todo
    global _handle_send_message, _handle_execute_code, _handlers_imported

    if _handlers_imported:
        return

    try:
        from sediman.agent.tools.misc import (
            _handle_clarify as _hc,
            _handle_cronjob as _hcr,
            _handle_delegate_task as _hdt,
            _handle_get_schedule_results as _hgsr,
            _handle_list_schedules as _hls,
            _handle_memory as _hm,
            _handle_session_search as _hss,
            _handle_todo as _ht,
        )
        from sediman.agent.tools.messaging import _handle_send_message as _hsm
        from sediman.agent.tools.execute_code import _handle_execute_code as _hec

        _handle_clarify = _hc
        _handle_cronjob = _hcr
        _handle_delegate_task = _hdt
        _handle_get_schedule_results = _hgsr
        _handle_list_schedules = _hls
        _handle_memory = _hm
        _handle_session_search = _hss
        _handle_todo = _ht
        _handle_send_message = _hsm
        _handle_execute_code = _hec
        _handlers_imported = True
    except ImportError as e:
        logger.warning("misc_provider_handler_import_failed", error=str(e))

logger = structlog.get_logger()


class MiscToolProvider(ToolProvider):
    """Provider for miscellaneous tools.

    This provider handles:
    - delegate_task: Delegate subtasks to subagents
    - memory: Persistent cross-session memory
    - cronjob: Schedule recurring tasks
    - list_schedules: List scheduled jobs
    - get_schedule_results: Get job execution results
    - session_search: Search past sessions
    - todo: Manage task list
    - clarify: Ask user questions
    - execute_code: Execute Python code
    - send_message: Send platform messages
    """

    def __init__(self):
        """Initialize the misc tool provider."""
        self._registry = ToolRegistry()

        # Import handlers lazily to avoid circular imports
        _import_handlers()

        # Register tools manually if handlers are available
        # Check if critical handlers are available
        if not all([_handle_clarify, _handle_memory, _handle_cronjob]):
            # If handlers not available, create minimal registry
            logger.warning("misc_provider_handlers_not_available", creating="minimal_registry")
            return

        from sediman.llm.provider import ToolDefinition

        # Register clarify tool
        if _handle_clarify:
            clarify_tool = ToolDefinition(
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
            )
            self._registry.register(clarify_tool, _handle_clarify)

        # Register memory tool
        if _handle_memory:
            memory_tool = ToolDefinition(
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
            )
            self._registry.register(memory_tool, _handle_memory)

        # Register cronjob tool
        if _handle_cronjob:
            cronjob_tool = ToolDefinition(
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
            )
            self._registry.register(cronjob_tool, _handle_cronjob)

        # Register session_search tool
        if _handle_session_search:
            session_search_tool = ToolDefinition(
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
            )
            self._registry.register(session_search_tool, _handle_session_search)

        # Register todo tool
        if _handle_todo:
            todo_tool = ToolDefinition(
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
            )
            self._registry.register(todo_tool, _handle_todo)

        # Register execute_code tool
        if _handle_execute_code:
            execute_code_tool = ToolDefinition(
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
            )
            self._registry.register(execute_code_tool, _handle_execute_code)

        # Register send_message tool
        if _handle_send_message:
            send_message_tool = ToolDefinition(
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
                    "required": [],
                },
                toolset="messaging",
            )
            self._registry.register(send_message_tool, _handle_send_message)

        # Register delegate_task tool
        if _handle_delegate_task:
            delegate_task_tool = ToolDefinition(
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
            )
            self._registry.register(delegate_task_tool, _handle_delegate_task)

        # Register list_schedules and get_schedule_results tools
        list_schedules_tool = ToolDefinition(
            name="list_schedules",
            description="List all scheduled cron jobs.",
            parameters={
                "type": "object",
                "properties": {},
                "required": [],
            },
            toolset="cronjob",
        )
        self._registry.register(list_schedules_tool, _handle_list_schedules)

        get_schedule_results_tool = ToolDefinition(
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
        )
        self._registry.register(get_schedule_results_tool, _handle_get_schedule_results)

    def get_tools(self) -> List[ToolDefinition]:
        """Get available misc tools.

        Returns:
            List of misc tool definitions
        """
        return list(self._registry._tools.values())

    async def execute(self, tool_name: str, params: Dict[str, Any]) -> Any:
        """Execute a misc tool.

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
            raise ValueError(f"Unknown misc tool: {tool_name}")

        try:
            result = await handler(**params)
            return result
        except Exception as e:
            logger.error("misc_tool_execution_failed", tool=tool_name, error=str(e))
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
        return "misc"


__all__ = ["MiscToolProvider"]
