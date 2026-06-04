"""Tool bus for centralized tool coordination.

This module provides the ToolBus class that coordinates multiple
tool providers with caching, metrics, and validation.
"""

from __future__ import annotations

import asyncio
import hashlib
import time
from typing import Any, Dict, List, Optional

import structlog

from sediman.agent.tools.interfaces import (
    ToolProvider,
    ToolResultCache,
    ToolMetrics,
    ToolValidator,
)
from sediman.llm.provider import ToolDefinition

logger = structlog.get_logger()


class ToolBus:
    """Central tool coordination with dependency injection and caching.

    The ToolBus provides:
    - Unified tool execution interface
    - Result caching for performance
    - Metrics collection
    - Parameter validation
    - Tool discovery and registration
    """

    def __init__(
        self,
        providers: Optional[List[ToolProvider]] = None,
        cache: Optional[ToolResultCache] = None,
        metrics: Optional[ToolMetrics] = None,
        validator: Optional[ToolValidator] = None,
    ):
        """Initialize the tool bus.

        Args:
            providers: List of tool providers
            cache: Optional result cache
            metrics: Optional metrics collector
            validator: Optional parameter validator
        """
        self._providers = providers or []
        self._cache = cache
        self._metrics = metrics
        self._validator = validator

        # Build indexes for fast lookup
        self._tools = self._build_tool_index()
        self._provider_index = self._build_provider_index()

    def _build_tool_index(self) -> Dict[str, ToolDefinition]:
        """Build fast tool lookup index.

        Returns:
            Dictionary mapping tool names to definitions
        """
        tools = {}
        for provider in self._providers:
            try:
                for tool in provider.get_tools():
                    tools[tool.name] = tool
            except Exception as e:
                logger.warning(
                    "failed_to_index_tools",
                    provider=type(provider).__name__,
                    error=str(e),
                )
        return tools

    def _build_provider_index(self) -> Dict[str, ToolProvider]:
        """Build fast provider lookup index.

        Returns:
            Dictionary mapping tool names to providers
        """
        index = {}
        for provider in self._providers:
            try:
                for tool in provider.get_tools():
                    index[tool.name] = provider
            except Exception as e:
                logger.warning(
                    "failed_to_index_provider",
                    provider=type(provider).__name__,
                    error=str(e),
                )
        return index

    def add_provider(self, provider: ToolProvider) -> None:
        """Add a tool provider dynamically.

        Args:
            provider: Tool provider to add
        """
        self._providers.append(provider)
        # Rebuild indexes
        self._tools = self._build_tool_index()
        self._provider_index = self._build_provider_index()

    def remove_provider(self, provider: ToolProvider) -> None:
        """Remove a tool provider.

        Args:
            provider: Tool provider to remove
        """
        if provider in self._providers:
            self._providers.remove(provider)
            # Rebuild indexes
            self._tools = self._build_tool_index()
            self._provider_index = self._build_provider_index()

    async def execute(
        self,
        tool_name: str,
        params: Dict[str, Any],
        use_cache: bool = True,
        validate: bool = True,
    ) -> Any:
        """Execute a tool with caching and metrics.

        Args:
            tool_name: Name of the tool to execute
            params: Tool parameters
            use_cache: Whether to use result caching
            validate: Whether to validate parameters

        Returns:
            Tool execution result

        Raises:
            ValueError: If tool not found or validation fails
            Exception: If tool execution fails
        """
        # Validate parameters if requested
        if validate and self._validator:
            is_valid, error = await self._validator.validate_params(tool_name, params)
            if not is_valid:
                raise ValueError(f"Parameter validation failed: {error}")

        # Check cache if enabled
        cache_key = None
        if use_cache and self._cache:
            cache_key = self._compute_cache_key(tool_name, params)
            if cached := await self._cache.get(cache_key):
                logger.debug("tool_cache_hit", tool=tool_name)
                if self._metrics:
                    self._metrics.record_execution(tool_name, 0, True)
                return cached

        # Find provider
        provider = self._provider_index.get(tool_name)
        if not provider:
            raise ValueError(f"Tool not found: {tool_name}")

        # Execute with timing and metrics
        start_time = time.perf_counter()
        try:
            result = await provider.execute(tool_name, params)
            duration_ms = (time.perf_counter() - start_time) * 1000

            # Record success metrics
            if self._metrics:
                self._metrics.record_execution(tool_name, duration_ms, True)

            # Validate result if requested
            if validate and self._validator:
                is_valid, error = await self._validator.validate_result(
                    tool_name, result
                )
                if not is_valid:
                    logger.warning("tool_result_invalid", tool=tool_name, error=error)

            # Cache result
            if use_cache and self._cache and cache_key:
                await self._cache.set(cache_key, result)

            logger.debug(
                "tool_executed",
                tool=tool_name,
                duration_ms=duration_ms,
                success=True,
            )
            return result

        except Exception as e:
            duration_ms = (time.perf_counter() - start_time) * 1000
            if self._metrics:
                self._metrics.record_execution(
                    tool_name, duration_ms, False, str(e)
                )
            logger.error("tool_execution_failed", tool=tool_name, error=str(e))
            raise

    def get_tools(self) -> List[ToolDefinition]:
        """Get all available tools.

        Returns:
            List of all tool definitions
        """
        return list(self._tools.values())

    def get_tool(self, name: str) -> Optional[ToolDefinition]:
        """Get a specific tool definition.

        Args:
            name: Tool name

        Returns:
            Tool definition or None if not found
        """
        return self._tools.get(name)

    def has_tool(self, name: str) -> bool:
        """Check if a tool exists.

        Args:
            name: Tool name

        Returns:
            True if tool exists
        """
        return name in self._tools

    def get_tools_by_category(self, category: str) -> List[ToolDefinition]:
        """Get tools by category.

        Args:
            category: Tool category to filter by

        Returns:
            List of tools in the category
        """
        return [
            tool for tool in self._tools.values()
            if tool.toolset == category
        ]

    def get_provider_for_tool(self, tool_name: str) -> Optional[ToolProvider]:
        """Get the provider for a specific tool.

        Args:
            tool_name: Name of the tool

        Returns:
            Tool provider or None if not found
        """
        return self._provider_index.get(tool_name)

    async def execute_batch(
        self,
        executions: List[Dict[str, Any]],
        max_concurrency: int = 5,
    ) -> List[Any]:
        """Execute multiple tools concurrently.

        Args:
            executions: List of execution dicts with 'tool' and 'params' keys
            max_concurrency: Maximum concurrent executions

        Returns:
            List of results in same order as executions
        """
        semaphore = asyncio.Semaphore(max_concurrency)

        async def execute_one(execution: Dict[str, Any]) -> Any:
            async with semaphore:
                return await self.execute(
                    execution["tool"], execution.get("params", {})
                )

        results = await asyncio.gather(
            *[execute_one(exec) for exec in executions],
            return_exceptions=True,
        )

        # Re-raise any exceptions
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                raise result

        return results

    def _compute_cache_key(self, tool_name: str, params: Dict[str, Any]) -> str:
        """Compute cache key for tool execution.

        Args:
            tool_name: Name of the tool
            params: Tool parameters

        Returns:
            Cache key string
        """
        # Create deterministic string representation
        key_data = f"{tool_name}:{self._serialize_params(params)}"
        return hashlib.md5(key_data.encode()).hexdigest()

    def _serialize_params(self, params: Dict[str, Any]) -> str:
        """Serialize parameters for cache key.

        Args:
            params: Parameters to serialize

        Returns:
            Serialized string
        """
        try:
            import json
            return json.dumps(params, sort_keys=True)
        except Exception:
            # Fallback to string representation
            return str(sorted(params.items()))

    async def clear_cache(self) -> None:
        """Clear all tool result caches."""
        if self._cache:
            await self._cache.clear()
            logger.info("tool_cache_cleared")

    async def get_metrics_summary(self) -> Dict[str, Any]:
        """Get summary of tool metrics.

        Returns:
            Dictionary with metrics summary
        """
        if not self._metrics:
            return {"message": "Metrics not enabled"}

        all_metrics = self._metrics.get_all_metrics()
        summary = {
            "total_tools": len(self._tools),
            "total_providers": len(self._providers),
            "tools_with_metrics": len(all_metrics),
        }

        # Add aggregate stats
        total_calls = 0
        total_duration = 0
        total_errors = 0

        for tool_metrics in all_metrics.values():
            total_calls += tool_metrics.get("call_count", 0)
            total_duration += tool_metrics.get("total_duration_ms", 0)
            total_errors += tool_metrics.get("error_count", 0)

        summary["total_calls"] = total_calls
        summary["total_duration_ms"] = total_duration
        summary["total_errors"] = total_errors
        summary["avg_duration_ms"] = (
            total_duration / total_calls if total_calls > 0 else 0
        )

        return summary


__all__ = ["ToolBus"]