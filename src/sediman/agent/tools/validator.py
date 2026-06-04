"""Tool validation implementations.

This module provides concrete implementations of tool parameter
and result validation for safety and correctness.
"""

from __future__ import annotations

import re
from typing import Any, Dict, Optional, List

import structlog

from sediman.agent.tools.interfaces import ToolValidator
from sediman.llm.provider import ToolDefinition

logger = structlog.get_logger()


class DefaultToolValidator(ToolValidator):
    """Default tool validator with common validation rules.

    This validator provides:
    - Required parameter checking
    - Type validation
    - Range validation
    - Pattern validation
    - Result validation
    """

    def __init__(self, strict_mode: bool = False):
        """Initialize the validator.

        Args:
            strict_mode: If True, all validations are enforced
        """
        self._strict_mode = strict_mode
        self._tool_definitions: Dict[str, ToolDefinition] = {}

    def register_tool(self, definition: ToolDefinition) -> None:
        """Register a tool definition for validation.

        Args:
            definition: Tool definition to register
        """
        self._tool_definitions[definition.name] = definition

    async def validate_params(
        self, tool_name: str, params: Dict[str, Any]
    ) -> tuple[bool, Optional[str]]:
        """Validate tool parameters.

        Args:
            tool_name: Name of the tool
            params: Parameters to validate

        Returns:
            Tuple of (is_valid, error_message)
        """
        # Get tool definition
        if tool_name not in self._tool_definitions:
            return True, None  # Unknown tool, skip validation

        definition = self._tool_definitions[tool_name]

        # Check required parameters
        required = definition.parameters.get("required", [])
        for param_name in required:
            if param_name not in params:
                return False, f"Missing required parameter: {param_name}"

        # Validate parameter types and constraints
        param_defs = definition.parameters.get("properties", {})
        for param_name, param_value in params.items():
            if param_name not in param_defs:
                # Unknown parameter
                if self._strict_mode:
                    return False, f"Unknown parameter: {param_name}"
                continue

            param_def = param_defs[param_name]

            # Type validation
            valid, error = self._validate_type(param_name, param_value, param_def)
            if not valid:
                return False, error

            # Enum validation
            if "enum" in param_def:
                if param_value not in param_def["enum"]:
                    return False, (
                        f"Parameter {param_name} must be one of "
                        f"{param_def['enum']}, got: {param_value}"
                    )

            # Range validation
            if "minimum" in param_def and isinstance(param_value, (int, float)):
                if param_value < param_def["minimum"]:
                    return False, (
                        f"Parameter {param_name} must be >= {param_def['minimum']}, "
                        f"got: {param_value}"
                    )

            if "maximum" in param_def and isinstance(param_value, (int, float)):
                if param_value > param_def["maximum"]:
                    return False, (
                        f"Parameter {param_name} must be <= {param_def['maximum']}, "
                        f"got: {param_value}"
                    )

            # Pattern validation
            if "pattern" in param_def and isinstance(param_value, str):
                pattern = param_def["pattern"]
                if not re.match(pattern, param_value):
                    return False, (
                        f"Parameter {param_name} must match pattern {pattern}, "
                        f"got: {param_value}"
                    )

        return True, None

    def _validate_type(
        self, param_name: str, value: Any, param_def: Dict[str, Any]
    ) -> tuple[bool, Optional[str]]:
        """Validate parameter type.

        Args:
            param_name: Parameter name
            value: Parameter value
            param_def: Parameter definition

        Returns:
            Tuple of (is_valid, error_message)
        """
        param_type = param_def.get("type")
        if not param_type:
            return True, None  # No type specified

        # Handle array types
        if param_type == "array":
            if not isinstance(value, list):
                return False, f"Parameter {param_name} must be an array, got: {type(value).__name__}"

            # Validate item types if specified
            if "items" in param_def:
                items_def = param_def["items"]
                item_type = items_def.get("type")
                if item_type:
                    for i, item in enumerate(value):
                        valid, error = self._validate_type(f"{param_name}[{i}]", item, items_def)
                        if not valid:
                            return False, error
            return True, None

        # Handle object types
        if param_type == "object":
            if not isinstance(value, dict):
                return False, f"Parameter {param_name} must be an object, got: {type(value).__name__}"
            return True, None

        # Handle basic types
        type_map = {
            "string": str,
            "integer": int,
            "number": (int, float),
            "boolean": bool,
        }

        if param_type in type_map:
            expected_types = type_map[param_type]
            if isinstance(expected_types, tuple):
                if not any(isinstance(value, t) for t in expected_types):
                    return False, (
                        f"Parameter {param_name} must be one of "
                        f"{[t.__name__ for t in expected_types]}, got: {type(value).__name__}"
                    )
            else:
                if not isinstance(value, expected_types):
                    return False, (
                        f"Parameter {param_name} must be {expected_types.__name__}, "
                        f"got: {type(value).__name__}"
                    )

        return True, None

    async def validate_result(
        self, tool_name: str, result: Any
    ) -> tuple[bool, Optional[str]]:
        """Validate tool execution result.

        Args:
            tool_name: Name of the tool
            result: Result to validate

        Returns:
            Tuple of (is_valid, error_message)
        """
        # Basic validation rules that apply to all tools

        # Check for None results (usually indicates failure)
        if result is None:
            return False, "Tool returned None (indicating failure)"

        # Check for error strings
        if isinstance(result, str):
            # Common error patterns
            error_patterns = [
                r"error:",
                r"failed",
                r"exception",
                r"traceback",
                r"permission denied",
                r"not found",
                r"does not exist",
            ]

            result_lower = result.lower()
            for pattern in error_patterns:
                if re.search(pattern, result_lower):
                    logger.warning(
                        "tool_result_error_pattern",
                        tool=tool_name,
                        pattern=pattern,
                    )
                    # Don't fail validation, just warn
                    break

        # Check result size (protect against memory issues)
        if hasattr(result, "__len__"):
            try:
                size = len(result)
                if size > 10_000_000:  # 10MB
                    return False, f"Tool result too large: {size} bytes"
            except Exception:
                pass  # Can't determine size

        return True, None


class NoOpValidator(ToolValidator):
    """No-op validator that disables validation.

    This implementation is useful when validation is not desired
    but the interface needs to be maintained.
    """

    async def validate_params(
        self, tool_name: str, params: Dict[str, Any]
    ) -> tuple[bool, Optional[str]]:
        """Return True (no validation)."""
        return True, None

    async def validate_result(self, tool_name: str, result: Any) -> tuple[bool, Optional[str]]:
        """Return True (no validation)."""
        return True, None


__all__ = ["DefaultToolValidator", "NoOpValidator"]