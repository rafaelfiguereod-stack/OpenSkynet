"""Tool metrics collection implementations.

This module provides concrete implementations of tool metrics
collection for monitoring and optimization.
"""

from __future__ import annotations

import time
from collections import defaultdict
from typing import Any, Dict

import structlog

from sediman.agent.tools.interfaces import ToolMetrics

logger = structlog.get_logger()


class ToolMetricsCollector(ToolMetrics):
    """Collects and aggregates tool execution metrics.

    This collector tracks:
    - Execution count per tool
    - Success/error rates
    - Average execution time
    - Recent errors
    """

    def __init__(self, max_errors: int = 100):
        """Initialize the metrics collector.

        Args:
            max_errors: Maximum number of errors to store per tool
        """
        self._max_errors = max_errors
        self._metrics: Dict[str, Dict[str, Any]] = defaultdict(
            lambda: {
                "call_count": 0,
                "success_count": 0,
                "error_count": 0,
                "total_duration_ms": 0.0,
                "min_duration_ms": float("inf"),
                "max_duration_ms": 0.0,
                "last_call_time": None,
                "errors": [],
            }
        )
        self._lock = None

    def record_execution(
        self,
        tool_name: str,
        duration_ms: float,
        success: bool,
        error: str | None = None,
    ) -> None:
        """Record tool execution metrics.

        Args:
            tool_name: Name of the tool
            duration_ms: Execution duration in milliseconds
            success: Whether execution succeeded
            error: Error message if execution failed
        """
        metrics = self._metrics[tool_name]

        # Update counters
        metrics["call_count"] += 1
        metrics["last_call_time"] = time.time()

        if success:
            metrics["success_count"] += 1
        else:
            metrics["error_count"] += 1
            if error:
                # Add error with timestamp
                error_entry = {"error": error, "time": time.time()}
                metrics["errors"].append(error_entry)

                # Keep only recent errors
                if len(metrics["errors"]) > self._max_errors:
                    metrics["errors"] = metrics["errors"][-self._max_errors :]

        # Update duration stats
        metrics["total_duration_ms"] += duration_ms
        metrics["min_duration_ms"] = min(metrics["min_duration_ms"], duration_ms)
        metrics["max_duration_ms"] = max(metrics["max_duration_ms"], duration_ms)

    def get_metrics(self, tool_name: str) -> Dict[str, Any]:
        """Get metrics for a specific tool.

        Args:
            tool_name: Name of the tool

        Returns:
            Dictionary of metrics
        """
        if tool_name not in self._metrics:
            return {}

        metrics = self._metrics[tool_name].copy()

        # Calculate derived metrics
        if metrics["call_count"] > 0:
            metrics["avg_duration_ms"] = (
                metrics["total_duration_ms"] / metrics["call_count"]
            )
            metrics["success_rate"] = (
                metrics["success_count"] / metrics["call_count"]
            )
        else:
            metrics["avg_duration_ms"] = 0.0
            metrics["success_rate"] = 0.0

        # Add recent errors
        metrics["recent_errors"] = metrics["errors"][-10:]

        return metrics

    def get_all_metrics(self) -> Dict[str, Dict[str, Any]]:
        """Get metrics for all tools.

        Returns:
            Dictionary mapping tool names to metrics
        """
        return {
            tool_name: self.get_metrics(tool_name)
            for tool_name in self._metrics.keys()
        }

    def get_summary(self) -> Dict[str, Any]:
        """Get overall metrics summary.

        Returns:
            Dictionary with overall metrics
        """
        total_calls = sum(m["call_count"] for m in self._metrics.values())
        total_success = sum(m["success_count"] for m in self._metrics.values())
        total_errors = sum(m["error_count"] for m in self._metrics.values())
        total_duration = sum(m["total_duration_ms"] for m in self._metrics.values())

        return {
            "total_tools": len(self._metrics),
            "total_calls": total_calls,
            "total_success": total_success,
            "total_errors": total_errors,
            "overall_success_rate": total_success / total_calls if total_calls > 0 else 0,
            "overall_avg_duration_ms": total_duration / total_calls if total_calls > 0 else 0,
            "most_called_tools": self._get_most_called(5),
        }

    def _get_most_called(self, limit: int = 5) -> list[Dict[str, Any]]:
        """Get most called tools.

        Args:
            limit: Number of tools to return

        Returns:
            List of tool info dicts
        """
        sorted_tools = sorted(
            self._metrics.items(),
            key=lambda x: x[1]["call_count"],
            reverse=True,
        )

        return [
            {"tool": name, "calls": m["call_count"]}
            for name, m in sorted_tools[:limit]
        ]

    def reset_metrics(self, tool_name: str | None = None) -> None:
        """Reset metrics for a tool or all tools.

        Args:
            tool_name: Specific tool to reset, or None for all
        """
        if tool_name:
            if tool_name in self._metrics:
                del self._metrics[tool_name]
        else:
            self._metrics.clear()

        logger.info("metrics_reset", tool=tool_name or "all")

    def get_slowest_tools(self, limit: int = 5) -> list[Dict[str, Any]]:
        """Get slowest tools by average duration.

        Args:
            limit: Number of tools to return

        Returns:
            List of tool info dicts
        """
        tool_avgs = []
        for tool_name, metrics in self._metrics.items():
            if metrics["call_count"] > 0:
                avg_duration = metrics["total_duration_ms"] / metrics["call_count"]
                tool_avgs.append(
                    {"tool": tool_name, "avg_duration_ms": avg_duration}
                )

        return sorted(tool_avgs, key=lambda x: x["avg_duration_ms"], reverse=True)[
            :limit
        ]

    def get_error_prone_tools(self, error_threshold: float = 0.1) -> list[str]:
        """Get tools with high error rates.

        Args:
            error_threshold: Error rate threshold (0.1 = 10%)

        Returns:
            List of tool names with high error rates
        """
        error_prone = []
        for tool_name, metrics in self._metrics.items():
            if metrics["call_count"] > 0:
                error_rate = metrics["error_count"] / metrics["call_count"]
                if error_rate > error_threshold:
                    error_prone.append(tool_name)

        return error_prone


class NoOpMetrics(ToolMetrics):
    """No-op metrics collector that disables metrics collection.

    This implementation is useful when metrics collection is not desired
    but the interface needs to be maintained.
    """

    def record_execution(
        self,
        tool_name: str,
        duration_ms: float,
        success: bool,
        error: str | None = None,
    ) -> None:
        """Do nothing (no metrics collection)."""
        pass

    def get_metrics(self, tool_name: str) -> Dict[str, Any]:
        """Return empty dict (no metrics)."""
        return {}

    def get_all_metrics(self) -> Dict[str, Dict[str, Any]]:
        """Return empty dict (no metrics)."""
        return {}


__all__ = ["ToolMetricsCollector", "NoOpMetrics"]