"""Agent manager for task planning and coordination.

This refactored version uses specialized planning components
to separate concerns and improve maintainability.
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import Callable
from typing import Any

import structlog

from sediman.agent.planner import ScheduleIntent, TaskPlanner as RegexTaskPlanner
from sediman.agent.planning import (
    TaskClassifier,
    TaskPlanner,
    ManagerPlan,
    PlanningContext,
)
from sediman.agent.state import PlanStep, Strategy
from sediman.llm.provider import LLMProvider
from sediman.memory.strategy import BaseMemoryStrategy

logger = structlog.get_logger()


class ManagerAgent:
    """Manages task planning and coordination.

    This simplified version coordinates specialized components
    for classification, planning, and reflection.
    """

    def __init__(self, llm: LLMProvider, memory: BaseMemoryStrategy | None = None):
        """Initialize the manager agent.

        Args:
            llm: LLM provider for operations
            memory: Optional memory strategy
        """
        self.llm = llm
        self._memory = memory
        self._regex_planner = RegexTaskPlanner()

        # Initialize specialized components
        self._classifier = TaskClassifier(llm)
        self._task_planner = TaskPlanner(llm, memory)

    async def plan(
        self,
        task: str,
        conversation: list[dict[str, str]] | None = None,
        previous_failure: str | None = None,
        on_streaming_token: Callable[[str], None] | None = None,
        regex_plan: Any | None = None,
    ) -> ManagerPlan:
        """Create a plan for executing a task.

        Args:
            task: The task to plan
            conversation: Optional conversation history
            previous_failure: Optional previous failure context
            on_streaming_token: Optional streaming callback
            regex_plan: Optional pre-computed regex plan

        Returns:
            ManagerPlan for the task
        """
        # Get regex plan if not provided
        if regex_plan is None:
            regex_plan = self._regex_planner.plan(task)

        # Create planning context
        context = PlanningContext(
            task=task,
            conversation=conversation,
            previous_failure=previous_failure,
            is_fresh_session=conversation is not None and len(conversation) == 0,
            has_conversation=bool(conversation),
        )

        # Check for schedule fast-path
        if regex_plan.schedule and not context.has_conversation:
            return ManagerPlan(
                browser_task="",
                schedule=regex_plan.schedule,
            )

        # Try classification fast-paths
        classification = self._classifier.classify(
            task, context, use_llm=context.is_fresh_session
        )

        # Handle fast-path classifications
        if classification.confidence > 0.8:
            return self._classification_to_plan(
                classification, task, context
            )

        # Use detailed planner for complex cases
        plan = await self._task_planner.plan(
            context, on_streaming_token, regex_plan
        )

        if plan:
            return plan

        # Fallback
        return ManagerPlan(browser_task=task)

    def _classification_to_plan(
        self,
        classification: Any,
        task: str,
        context: PlanningContext,
    ) -> ManagerPlan:
        """Convert classification result to manager plan.

        Args:
            classification: Classification result
            task: Original task
            context: Planning context

        Returns:
            ManagerPlan based on classification
        """
        if classification.task_type == "code":
            return ManagerPlan(
                browser_task=task,
                strategy=Strategy.DELEGATE,
                subtasks=[task],
                use_subagent="code",
            )
        elif classification.task_type == "browser":
            return ManagerPlan(browser_task=task)
        elif classification.task_type == "conversational":
            return ManagerPlan(
                browser_task="",
                strategy=Strategy.CONVERSATIONAL,
                response=None,
            )

        # Default to direct execution
        return ManagerPlan(browser_task=task)

    async def decompose(
        self,
        task: str,
        max_subtasks: int = 5,
        beam_width: int = 2,
    ) -> list[PlanStep]:
        """Decompose a task into subtasks.

        Args:
            task: Task to decompose
            max_subtasks: Maximum number of subtasks
            beam_width: Number of parallel decompositions to try

        Returns:
            List of PlanSteps for the subtasks
        """
        candidates = await asyncio.gather(
            *[self._single_decompose(task, max_subtasks, seed=i)
              for i in range(beam_width)],
            return_exceptions=True,
        )

        valid = [c for c in candidates if isinstance(c, list) and c]

        if not valid:
            return [PlanStep(id=0, description=task, strategy=Strategy.DIRECT)]

        if len(valid) == 1:
            return valid[0]

        # Score and return best decomposition
        scored = [(self._score_decomposition(steps, task), steps) for steps in valid]
        scored.sort(key=lambda x: x[0], reverse=True)
        return scored[0][1]

    async def _single_decompose(
        self,
        task: str,
        max_subtasks: int,
        seed: int = 0,
    ) -> list[PlanStep]:
        """Generate a single decomposition.

        Args:
            task: Task to decompose
            max_subtasks: Maximum subtasks
            seed: Random seed for variation

        Returns:
            List of PlanSteps
        """
        from sediman.agent.prompts.builder import _load_template

        system_prompt = _load_template("manager_system.md")

        seed_hint = "\nProvide an alternative decomposition approach.\n" if seed > 0 else ""

        decompose_prompt = (
            system_prompt
            + "\n\n## Task Decomposition\n\n"
            "Break this task into subtasks. Most should be independent and parallelizable.\n"
            "If some subtasks have ordering constraints (e.g. infrastructure before API before UI),\n"
            "specify depends_on with the titles of prerequisite subtasks.\n"
            "Each subtask should be a complete, self-contained task.\n"
            f"{seed_hint}"
            f"Maximum {max_subtasks} subtasks.\n\n"
            'Respond with JSON: {"subtasks": [{"title": "task1", "depends_on": []}, {"title": "task2", "depends_on": ["task1"]}]}'
        )

        messages = [
            {"role": "system", "content": decompose_prompt},
            {"role": "user", "content": task},
        ]

        try:
            response = await self.llm.chat(messages=messages, tools=[])
            text = self._extract_json(response.text or "")
            if text:
                data = json.loads(text)
                subtasks = data.get("subtasks", [])
                steps = []
                for i, subtask in enumerate(subtasks[:max_subtasks]):
                    desc = subtask if isinstance(subtask, str) else subtask.get("title", str(subtask))
                    steps.append(PlanStep(
                        id=i,
                        description=desc,
                        strategy=Strategy.DELEGATE,
                    ))
                return steps
        except Exception as e:
            logger.debug("decompose_failed", error=str(e))

        return []

    def _score_decomposition(self, steps: list[PlanStep], task: str) -> float:
        """Score a decomposition for quality.

        Args:
            steps: List of plan steps
            task: Original task

        Returns:
            Quality score
        """
        if not steps:
            return 0.0

        score = 0.0
        n = len(steps)

        # Prefer 2-4 subtasks
        if 2 <= n <= 4:
            score += 1.0
        elif n == 1:
            score += 0.3
        elif n > 4:
            score += 0.5

        # Prefer reasonable description length
        total_desc_len = sum(len(s.description) for s in steps)
        avg_len = total_desc_len / n if n else 0
        if 20 <= avg_len <= 120:
            score += 0.5

        # Check for task keyword overlap
        task_words = set(task.lower().split())
        for s in steps:
            desc_words = set(s.description.lower().split())
            if len(task_words & desc_words) > 0:
                score += 0.3
                break

        return score

    async def reflect(
        self,
        task: str,
        result: str,
        observations: list[str],
    ) -> dict[str, Any]:
        """Reflect on task execution results.

        Args:
            task: Original task
            result: Result obtained
            observations: Observations during execution

        Returns:
            Reflection result dictionary
        """
        from sediman.agent.prompts.builder import _load_template

        system_prompt = _load_template("reflection.md")

        obs_text = "\n".join(f"- {o}" for o in observations[-10:]) if observations else "None"

        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    f"Original task: {task}\n\n"
                    f"Result obtained:\n{result[:2000]}\n\n"
                    f"Observations during execution:\n{obs_text}\n\n"
                    "Evaluate whether the task was completed successfully."
                ),
            },
        ]

        try:
            response = await self.llm.chat(messages=messages, tools=[])
            text = self._extract_json(response.text or "")
            if text:
                data = json.loads(text)
                task_complete = data.get("task_complete", False)
                if not isinstance(task_complete, bool):
                    task_complete = str(task_complete).lower() in ("true", "yes", "1")
                confidence = float(data.get("confidence", 0.3))
                confidence = max(0.0, min(1.0, confidence))
                return {
                    "task_complete": task_complete,
                    "confidence": confidence,
                    "reasoning": data.get("reasoning", ""),
                    "issues": data.get("issues", []),
                    "suggested_fix": data.get("suggested_fix"),
                }
        except Exception as e:
            logger.warning("reflect_failed", error=str(e))

        return {
            "task_complete": False,
            "confidence": 0.2,
            "reasoning": "Reflection failed — defaulting to incomplete for safety.",
            "issues": ["reflection_llm_failure"],
            "suggested_fix": None,
        }

    async def generate_milestones(self, task: str) -> list[str]:
        """Generate milestones for tracking task progress.

        Args:
            task: Task to generate milestones for

        Returns:
            List of milestone descriptions
        """
        from sediman.agent.progress import generate_milestones_prompt, parse_milestones

        prompt = generate_milestones_prompt(task)
        messages = [
            {"role": "system", "content": "You are a task planning assistant. Generate milestones as requested."},
            {"role": "user", "content": prompt},
        ]

        try:
            response = await self.llm.chat(messages=messages, tools=[])
            milestones = parse_milestones(response.text or "")
            if milestones:
                return milestones
        except Exception as e:
            logger.debug("generate_milestones_failed", error=str(e))

        return []

    def _extract_json(self, text: str) -> str | None:
        """Extract JSON from text response.

        Args:
            text: Response text

        Returns:
            JSON string or None
        """
        try:
            start = text.index("{")
            end = text.rindex("}") + 1
            return text[start:end]
        except (ValueError, AttributeError):
            return None


__all__ = ["ManagerAgent", "ManagerPlan"]
