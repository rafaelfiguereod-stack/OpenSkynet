"""Tool decorator and related utilities.

This module provides the @tool decorator for registering functions
as callable tools with automatic schema generation.
"""

from __future__ import annotations

import inspect
import json
from typing import Any, Callable

import structlog

from sediman.llm.provider import ToolDefinition
from sediman.agent.tool_dispatch import _TOOL_REGISTRY

logger = structlog.get_logger()


def _py_type_to_json_type(py_type: type) -> str:
    """Convert Python type to JSON schema type.

    Args:
        py_type: Python type

    Returns:
        JSON schema type string
    """
    type_map = {
        int: "integer",
        float: "number",
        str: "string",
        bool: "boolean",
        list: "array",
        dict: "object",
    }
    return type_map.get(py_type, "string")


def tool(func: Callable | None = None, *, name: str | None = None, description: str | None = None):
    """Decorator that registers a function as a callable tool.

    Can be used as @tool or @tool(name="my_name", description="Does X").
    The function's type annotations and docstring are auto-extracted
    to build the OpenAI tool schema.

    Example:
        ```python
        @tool
        def get_stock_price(symbol: str) -> float:
            \"\"\"Get current price for a stock symbol.\"\"\"
            ...

        @tool(name="send_email", description="Send an email via SMTP")
        def send_email_handler(to: str, subject: str, body: str) -> str:
            ...
        ```

    Args:
        func: Function to decorate
        name: Optional custom name for the tool
        description: Optional custom description

    Returns:
        Decorated function or decorator
    """
    def decorator(fn: Callable) -> Callable:
        tool_name = name or fn.__name__
        tool_desc = description or (inspect.getdoc(fn) or fn.__name__).split("\n")[0].strip()

        sig = inspect.signature(fn)
        properties: dict[str, dict[str, Any]] = {}
        required: list[str] = []
        for param_name, param in sig.parameters.items():
            if param_name == "return" or param_name.startswith("_"):
                continue
            param_type = param.annotation if param.annotation is not inspect.Parameter.empty else str
            json_type = _py_type_to_json_type(param_type)
            prop: dict[str, Any] = {"type": json_type}
            if param.default is not inspect.Parameter.empty:
                prop["default"] = param.default
            else:
                required.append(param_name)
            properties[param_name] = prop

        parameters: dict[str, Any] = {
            "type": "object",
            "properties": properties,
        }
        if required:
            parameters["required"] = required

        tool_def = ToolDefinition(
            name=tool_name,
            description=tool_desc,
            parameters=parameters,
        )

        _TOOL_REGISTRY[tool_name] = {
            "definition": tool_def,
            "handler": fn,
        }

        logger.debug("tool_registered", name=tool_name, params=list(properties.keys()))

        return fn

    if func is None:
        # Called with arguments: @tool(name="...")
        return decorator
    else:
        # Called without arguments: @tool
        return decorator(func)


def discover_tools(module: str | None = None) -> list[tuple[str, Callable, ToolDefinition]]:
    """Discover and return all @tool-decorated functions.

    Args:
        module: Optional module name to filter by

    Returns:
        List of tuples (name, handler, definition)
    """
    if module:
        return [
            (name, entry["handler"], entry["definition"])
            for name, entry in _TOOL_REGISTRY.items()
            if entry["handler"].__module__ == module
        ]
    return [
        (name, entry["handler"], entry["definition"])
        for name, entry in _TOOL_REGISTRY.items()
    ]


def register_tool_fn(
    name: str,
    handler: Callable,
    parameters: dict[str, Any] | None = None,
    description: str = ""
) -> ToolDefinition:
    """Register a tool function programmatically.

    Args:
        name: Tool name
        handler: Handler function
        parameters: Optional parameter schema
        description: Tool description

    Returns:
        Tool definition
    """
    tool_def = ToolDefinition(
        name=name,
        description=description,
        parameters=parameters or {"type": "object", "properties": {}},
    )

    _TOOL_REGISTRY[name] = {
        "definition": tool_def,
        "handler": handler,
    }

    return tool_def


def get_decorated_tool_definitions() -> list[ToolDefinition]:
    """Get all @tool-decorated tool definitions.

    Returns:
        List of tool definitions
    """
    return [entry["definition"] for entry in _TOOL_REGISTRY.values()]


def get_decorated_tool_handlers() -> dict[str, Callable]:
    """Get handler dict for all @tool-decorated functions.

    Returns:
        Dictionary mapping tool names to handlers
    """
    return {name: entry["handler"] for name, entry in _TOOL_REGISTRY.items()}
