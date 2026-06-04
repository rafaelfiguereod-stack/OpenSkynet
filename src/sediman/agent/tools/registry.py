"""Tool registry and related utilities.

This module provides the ToolRegistry class and tool context management
for tool operations. Global state is managed through ToolContext for
better testability and dependency injection.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable

import structlog

from sediman.agent.tool_dispatch import ToolRegistry as BaseToolRegistry
from sediman.agent.tool_dispatch import ToolDefinition

logger = structlog.get_logger()

# Type aliases
TerminalApprovalCallback = Callable[[str, str], Awaitable[bool]]


@dataclass
class ToolContext:
    """Context for tool operations, replacing global state.

    This context holds all the configuration and dependencies that
    tools might need, making it easier to inject dependencies and
    test tool behavior.

    Attributes:
        terminal_approval_callback: Callback for terminal approval
        terminal_session_allowed: Whether terminal is allowed in current session
        memory_manager: Memory manager instance
        subagent_factory: Factory for creating subagents
    """
    terminal_approval_callback: TerminalApprovalCallback | None = None
    terminal_session_allowed: bool = False
    memory_manager: Any = None
    subagent_factory: Any | None = None

    def with_terminal_callback(self, callback: TerminalApprovalCallback) -> "ToolContext":
        """Create a new context with the terminal callback set."""
        return ToolContext(
            terminal_approval_callback=callback,
            terminal_session_allowed=self.terminal_session_allowed,
            memory_manager=self.memory_manager,
            subagent_factory=self.subagent_factory,
        )

    def with_terminal_allowed(self, allowed: bool) -> "ToolContext":
        """Create a new context with terminal allowed set."""
        return ToolContext(
            terminal_approval_callback=self.terminal_approval_callback,
            terminal_session_allowed=allowed,
            memory_manager=self.memory_manager,
            subagent_factory=self.subagent_factory,
        )


# Global tool context for backward compatibility
_global_context: ToolContext = ToolContext()


def get_global_context() -> ToolContext:
    """Get the global tool context.

    Returns:
        Current global tool context
    """
    global _global_context
    if not isinstance(_global_context, ToolContext):
        _global_context = ToolContext()
    return _global_context


def set_global_context(context: ToolContext) -> None:
    """Set the global tool context.

    Args:
        context: New global tool context
    """
    global _global_context
    _global_context = context


def reset_global_context() -> None:
    """Reset global context to defaults."""
    global _global_context
    _global_context = ToolContext()


# Legacy global state for backward compatibility
_terminal_approval_callback: TerminalApprovalCallback | None = None
_terminal_session_allowed: bool = False
_memory_manager = None
_subagent_factory: Any | None = None


def set_terminal_approval_callback(cb: TerminalApprovalCallback | None) -> None:
    """Set the terminal approval callback.

    Args:
        cb: Callback function for terminal approval requests
    """
    global _terminal_approval_callback, _global_context
    _terminal_approval_callback = cb
    # Update global context as well
    context = get_global_context()
    _global_context = context.with_terminal_callback(cb)


def set_terminal_allowed(allowed: bool) -> None:
    """Set whether terminal operations are allowed.

    Args:
        allowed: True to allow terminal operations
    """
    global _terminal_session_allowed, _global_context
    _terminal_session_allowed = allowed
    # Update global context as well
    context = get_global_context()
    _global_context = context.with_terminal_allowed(allowed)


def is_terminal_allowed() -> bool:
    """Check if terminal operations are allowed.

    Returns:
        True if terminal operations are allowed
    """
    return _terminal_session_allowed


def reset_terminal_state() -> None:
    """Reset terminal state to defaults."""
    global _terminal_approval_callback, _terminal_session_allowed, _global_context
    _terminal_approval_callback = None
    _terminal_session_allowed = False
    # Reset global context terminal state
    context = get_global_context()
    _global_context = ToolContext(
        memory_manager=context.memory_manager,
        subagent_factory=context.subagent_factory,
    )


def set_memory_manager(manager) -> None:
    """Set the memory manager instance.

    Args:
        manager: Memory manager instance
    """
    global _memory_manager, _global_context
    _memory_manager = manager
    # Update global context as well
    context = get_global_context()
    _global_context = ToolContext(
        terminal_approval_callback=context.terminal_approval_callback,
        terminal_session_allowed=context.terminal_session_allowed,
        memory_manager=manager,
        subagent_factory=context.subagent_factory,
    )


def get_memory_manager():
    """Get the current memory manager instance.

    Returns:
        Memory manager instance or None
    """
    return _memory_manager


def set_subagent_factory(factory: Any | None) -> None:
    """Set the subagent factory instance.

    Args:
        factory: Subagent factory instance
    """
    global _subagent_factory, _global_context
    _subagent_factory = factory
    # Update global context as well
    context = get_global_context()
    _global_context = ToolContext(
        terminal_approval_callback=context.terminal_approval_callback,
        terminal_session_allowed=context.terminal_session_allowed,
        memory_manager=context.memory_manager,
        subagent_factory=factory,
    )


def get_subagent_factory() -> Any | None:
    """Get the current subagent factory instance.

    Returns:
        Subagent factory instance or None
    """
    return _subagent_factory


__all__ = [
    "TerminalApprovalCallback",
    "set_terminal_approval_callback",
    "set_terminal_allowed",
    "is_terminal_allowed",
    "reset_terminal_state",
    "set_memory_manager",
    "get_memory_manager",
    "set_subagent_factory",
    "get_subagent_factory",
]
