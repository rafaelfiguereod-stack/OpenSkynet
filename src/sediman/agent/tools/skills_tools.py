"""Skills management tools registration.

This module handles registration of skill-related tools including
search, management, and execution of reusable skills.
"""

from __future__ import annotations

from sediman.agent.tool_dispatch import ToolRegistry
from sediman.llm.provider import ToolDefinition

from .skill_search import _handle_skill_search
from .skills import _handle_skill_manage


def register_skills_tools(registry: ToolRegistry) -> None:
    """Register all skills management tools.

    Args:
        registry: Tool registry to register tools with
    """
    # skill_search tool
    registry.register(
        ToolDefinition(
            name="skill_search",
            description="Search for reusable skills by semantic similarity. Use this tool when you need a workflow for a task — for example, working with PDFs, spreadsheets, web testing, or any repeatable browser workflow. Use scope='internal' for your own learned skills, 'external' for bundled/community skills, or 'all' for both.",
            parameters={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "What you want to accomplish, e.g. 'create a PDF', 'test a web app', 'read an xlsx file'",
                    },
                    "scope": {
                        "type": "string",
                        "enum": ["internal", "external", "all"],
                        "description": "Where to search: 'internal' = user-learned skills, 'external' = bundled/community skills, 'all' = both",
                    },
                    "k": {
                        "type": "integer",
                        "description": "Number of results to return (default 5)",
                    },
                },
                "required": ["query"],
            },
            toolset="skills",
        ),
        _handle_skill_search,
    )

    # skill_manage tool
    registry.register(
        ToolDefinition(
            name="skill_manage",
            description="Manage reusable skills. Use action='create' after completing a complex multi-step task (5+ steps, error recovery, non-obvious workflow). Use action='patch' when you find an existing skill is outdated or broken. Use action='delete' to remove a skill that is no longer useful. Use action='list' to see all skills, 'view' to inspect one, 'run' to auto-execute a skill.",
            parameters={
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["create", "patch", "list", "view", "delete", "run"],
                        "description": "The action to perform. 'create' saves a new skill, 'patch' updates an existing one, 'delete' removes a skill, 'list' shows all skills, 'view' reads one skill, 'run' auto-executes a skill.",
                    },
                    "name": {
                        "type": "string",
                        "description": "Short kebab-case name for the skill (required for create, patch, view, run)",
                    },
                    "description": {
                        "type": "string",
                        "description": "What this skill does in one sentence (for create and patch)",
                    },
                    "steps": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of step descriptions that capture the workflow (for create and patch)",
                    },
                    "verification": {
                        "type": "string",
                        "description": "How to verify the skill succeeded — what should be true after execution (for create and patch)",
                    },
                },
                "required": ["action"],
            },
            toolset="skills",
        ),
        _handle_skill_manage,
    )


__all__ = ["register_skills_tools"]
