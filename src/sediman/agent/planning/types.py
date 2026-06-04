"""Shared types for the planning module.

This module contains data structures used across different
planning components.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sediman.agent.planner import ScheduleIntent
from sediman.agent.state import Strategy


@dataclass
class ManagerPlan:
    """Plan for executing a task.

    Contains the strategy, subtasks, and metadata needed
    to execute a task through the agent system.
    """
    browser_task: str
    schedule: ScheduleIntent | None = None
    memory: str | None = None
    skill_name: str | None = None
    skill_description: str | None = None
    strategy: Strategy = Strategy.DIRECT
    subtasks: list[str] | None = None
    skill_to_use: str | None = None
    response: str | None = None
    use_subagent: str | None = None
    milestones: list[str] | None = None


@dataclass
class PlanningContext:
    """Context for planning operations.

    Contains information about the current state that
    influences planning decisions.
    """
    task: str
    conversation: list[dict[str, str]] | None = None
    previous_failure: str | None = None
    is_fresh_session: bool = True
    has_conversation: bool = False


@dataclass
class ClassificationResult:
    """Result of task classification.

    Indicates what type of task this is and how it should be handled.
    """
    task_type: str  # "code", "browser", "conversational", "general"
    confidence: float
    reasoning: str = ""


__all__ = [
    "ManagerPlan",
    "PlanningContext",
    "ClassificationResult",
]
