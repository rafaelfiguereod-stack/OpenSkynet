"""Tool system interfaces for abstraction and decoupling.

This module provides abstract interfaces for the tool system, enabling
better testing, performance optimization, and reduced coupling.
"""

from abc import ABC, abstractmethod
from typing import Any, Optional, Dict, List
from sediman.llm.provider import ToolDefinition


class ToolProvider(ABC):
    """Abstract interface for tool providers.

    A tool provider is responsible for:
    - Providing tool definitions
    - Executing tools
    - Managing tool lifecycle
    """

    @abstractmethod
    def get_tools(self) -> List[ToolDefinition]:
        """Get available tools from this provider.

        Returns:
            List of tool definitions
        """
        pass

    @abstractmethod
    async def execute(self, tool_name: str, params: Dict[str, Any]) -> Any:
        """Execute a tool with given parameters.

        Args:
            tool_name: Name of the tool to execute
            params: Tool parameters

        Returns:
            Tool execution result
        """
        pass

    @abstractmethod
    def supports(self, tool_name: str) -> bool:
        """Check if provider supports a tool.

        Args:
            tool_name: Name of the tool to check

        Returns:
            True if provider supports the tool
        """
        pass

    @abstractmethod
    def get_category(self) -> str:
        """Get the category of tools this provider provides.

        Returns:
            Tool category name
        """
        pass


class ToolResultCache(ABC):
    """Abstract interface for tool result caching."""

    @abstractmethod
    async def get(self, key: str) -> Optional[Any]:
        """Get cached result.

        Args:
            key: Cache key

        Returns:
            Cached result or None if not found
        """
        pass

    @abstractmethod
    async def set(self, key: str, value: Any, ttl: int = 3600) -> None:
        """Cache a result with TTL.

        Args:
            key: Cache key
            value: Result to cache
            ttl: Time to live in seconds
        """
        pass

    @abstractmethod
    async def invalidate(self, pattern: str) -> int:
        """Invalidate cache entries matching pattern.

        Args:
            pattern: Glob pattern for cache keys

        Returns:
            Number of entries invalidated
        """
        pass

    @abstractmethod
    async def clear(self) -> None:
        """Clear all cache entries."""
        pass


class ToolMetrics(ABC):
    """Abstract interface for tool metrics collection."""

    @abstractmethod
    def record_execution(
        self,
        tool_name: str,
        duration_ms: float,
        success: bool,
        error: Optional[str] = None
    ) -> None:
        """Record tool execution metrics.

        Args:
            tool_name: Name of the tool
            duration_ms: Execution duration in milliseconds
            success: Whether execution succeeded
            error: Error message if execution failed
        """
        pass

    @abstractmethod
    def get_metrics(self, tool_name: str) -> Dict[str, Any]:
        """Get metrics for a specific tool.

        Args:
            tool_name: Name of the tool

        Returns:
            Dictionary of metrics
        """
        pass

    @abstractmethod
    def get_all_metrics(self) -> Dict[str, Dict[str, Any]]:
        """Get metrics for all tools.

        Returns:
            Dictionary mapping tool names to metrics
        """
        pass


class ToolValidator(ABC):
    """Abstract interface for tool validation."""

    @abstractmethod
    async def validate_params(
        self,
        tool_name: str,
        params: Dict[str, Any]
    ) -> tuple[bool, Optional[str]]:
        """Validate tool parameters.

        Args:
            tool_name: Name of the tool
            params: Parameters to validate

        Returns:
            Tuple of (is_valid, error_message)
        """
        pass

    @abstractmethod
    async def validate_result(self, tool_name: str, result: Any) -> tuple[bool, Optional[str]]:
        """Validate tool execution result.

        Args:
            tool_name: Name of the tool
            result: Result to validate

        Returns:
            Tuple of (is_valid, error_message)
        """
        pass


__all__ = [
    "ToolProvider",
    "ToolResultCache",
    "ToolMetrics",
    "ToolValidator",
]