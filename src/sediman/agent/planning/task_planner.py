"""LLM-based task planning.

This module provides functionality for creating detailed plans
for tasks using LLM reasoning.
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import Callable
from typing import Any

import structlog

from sediman.llm.provider import LLMProvider
from sediman.agent.planner import ScheduleIntent
from sediman.agent.planning.types import ManagerPlan, PlanningContext
from sediman.agent.state import Strategy

logger = structlog.get_logger()


class TaskPlanner:
    """Creates detailed plans for task execution.

    This planner uses LLM reasoning to break down tasks,
    determine strategies, and create execution plans.
    """

    def __init__(
        self,
        llm: LLMProvider,
        memory: Any | None = None,
    ):
        """Initialize the task planner.

        Args:
            llm: LLM provider for planning
            memory: Optional memory strategy for context
        """
        self.llm = llm
        self.memory = memory

    async def plan(
        self,
        context: PlanningContext,
        on_streaming_token: Callable[[str], None] | None = None,
        regex_plan: Any | None = None,
    ) -> ManagerPlan | None:
        """Create a plan for executing a task.

        Args:
            context: Planning context with task and state information
            on_streaming_token: Optional callback for streaming tokens
            regex_plan: Optional pre-computed regex plan

        Returns:
            ManagerPlan or None if planning fails
        """
        # Handle schedule from regex planner
        if regex_plan and regex_plan.schedule and not context.has_conversation:
            return ManagerPlan(
                browser_task="",
                schedule=regex_plan.schedule,
            )

        # Try LLM-based planning
        try:
            if on_streaming_token:
                plan = await self._llm_plan_stream(
                    context, on_streaming_token
                )
                if plan is None:
                    plan = await self._llm_plan(context)
            else:
                plan = await self._llm_plan(context)

            if plan:
                # Merge schedule from regex plan if present
                if regex_plan and regex_plan.schedule and not plan.schedule:
                    plan.schedule = regex_plan.schedule
                    if plan.strategy != Strategy.CONVERSATIONAL:
                        plan.browser_task = ""
                return plan

        except Exception as e:
            logger.debug("llm_planning_failed", error=str(e))

        # Fallback to regex plan or simple direct execution
        if regex_plan and regex_plan.schedule:
            browser_task = self._contextualize_browser_task(
                regex_plan.browser_task,
                context.conversation
            )
            return ManagerPlan(
                browser_task=browser_task,
                schedule=regex_plan.schedule,
            )

        # Default fallback
        return ManagerPlan(browser_task=context.task)

    async def _llm_plan(
        self,
        context: PlanningContext,
    ) -> ManagerPlan | None:
        """Create plan using LLM.

        Args:
            context: Planning context

        Returns:
            ManagerPlan or None
        """
        prompt = await self._build_prompt(context)

        try:
            response = await self.llm.chat(
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": context.task},
                ],
                tools=[],
            )

            return self._parse_plan_response(response.text, context)

        except Exception as e:
            logger.warning("llm_plan_failed", error=str(e))
            return None

    async def _llm_plan_stream(
        self,
        context: PlanningContext,
        on_streaming_token: Callable[[str], None],
    ) -> ManagerPlan | None:
        """Create plan using LLM with streaming support.

        Args:
            context: Planning context
            on_streaming_token: Callback for streaming tokens

        Returns:
            ManagerPlan or None
        """
        # TODO: Implement streaming version
        return await self._llm_plan(context)

    async def _build_prompt(
        self,
        context: PlanningContext,
    ) -> str:
        """Build the system prompt for planning.

        Args:
            context: Planning context

        Returns:
            System prompt string
        """
        from sediman.agent.prompts.builder import _load_template
        from sediman.utils import format_conversation_context

        system_prompt = _load_template("manager_system.md")

        # Add conversation context
        if context.conversation:
            conv_context = format_conversation_context(context.conversation, limit=10)
            system_prompt += (
                "\n\n<conversation_history>\n"
                "The user has had previous interactions. Use this context to "
                "understand follow-up messages, corrections, and references "
                "to earlier tasks.\n\n"
                f"{conv_context}\n"
                "</conversation_history>"
            )

        # Add previous failure context
        if context.previous_failure:
            system_prompt += (
                f"\n\n<previous_failure>\n"
                f"The previous attempt failed with this error:\n{context.previous_failure}\n"
                f"Adjust the plan to avoid the same failure.\n"
                f"</previous_failure>"
            )

        # Add memory contexts asynchronously
        async def _empty() -> str | None:
            return None

        results = await asyncio.gather(
            self._get_episodic_context_async(context.task),
            self.memory.get_preference_context() if self.memory else _empty(),
            self.memory.get_trajectory_context(context.task) if self.memory else _empty(),
            return_exceptions=True,
        )

        episodic = results[0] if not isinstance(results[0], Exception) else None
        preference_ctx = results[1] if not isinstance(results[1], Exception) else None
        trajectory_ctx = results[2] if not isinstance(results[2], Exception) else None

        if episodic:
            system_prompt += (
                f"\n\n<episodic_memory>\n"
                f"Relevant past experiences:\n{episodic}\n"
                f"</episodic_memory>"
            )

        if preference_ctx:
            system_prompt += (
                f"\n\n<preferences>\n"
                f"User preferences:\n{preference_ctx}\n"
                f"</preferences>"
            )

        if trajectory_ctx:
            system_prompt += (
                f"\n\n<trajectory>\n"
                f"Relevant execution patterns:\n{trajectory_ctx}\n"
                f"</trajectory>"
            )

        return system_prompt

    def _parse_plan_response(
        self,
        response_text: str,
        context: PlanningContext,
    ) -> ManagerPlan | None:
        """Parse LLM response into ManagerPlan.

        Args:
            response_text: LLM response text
            context: Original planning context

        Returns:
            ManagerPlan or None if parsing fails
        """
        try:
            # Try to extract JSON from response
            json_text = self._extract_json(response_text)
            if json_text:
                data = json.loads(json_text)

                return ManagerPlan(
                    browser_task=data.get("browser_task", context.task),
                    schedule=self._parse_schedule(data.get("schedule")),
                    memory=data.get("memory"),
                    skill_name=data.get("skill_name"),
                    skill_description=data.get("skill_description"),
                    strategy=Strategy(data.get("strategy", "direct")),
                    subtasks=data.get("subtasks"),
                    skill_to_use=data.get("skill_to_use"),
                    response=data.get("response"),
                    use_subagent=data.get("use_subagent"),
                    milestones=data.get("milestones"),
                )

        except Exception as e:
            logger.debug("parse_plan_failed", error=str(e))

        # Fallback: parse as text
        return self._parse_text_plan(response_text, context)

    def _parse_text_plan(
        self,
        text: str,
        context: PlanningContext,
    ) -> ManagerPlan:
        """Parse text-based plan.

        Args:
            text: Plan text
            context: Planning context

        Returns:
            ManagerPlan with basic information
        """
        # Default to direct execution with original task
        return ManagerPlan(
            browser_task=context.task,
            strategy=Strategy.DIRECT,
        )

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

    def _parse_schedule(self, schedule_data: Any) -> Any:
        """Parse schedule information from LLM response.

        Args:
            schedule_data: Schedule data from LLM response

        Returns:
            ScheduleIntent object or None
        """
        if not schedule_data or not isinstance(schedule_data, dict):
            return None

        try:
            from sediman.agent.planner import ScheduleIntent

            # Handle different formats
            if isinstance(schedule_data, dict):
                cron = schedule_data.get("cron")
                task = schedule_data.get("task")
                if cron:
                    return ScheduleIntent(cron=cron, task=task or "")
            return None
        except Exception:
            logger.debug("parse_schedule_failed", data=str(schedule_data))
            return None

    def _contextualize_browser_task(
        self,
        browser_task: str,
        conversation: list[dict[str, str]] | None,
    ) -> str:
        """Contextualize browser task with conversation history.

        Args:
            browser_task: Original browser task
            conversation: Conversation history

        Returns:
            Contextualized task description
        """
        if not conversation:
            return browser_task

        # Add context from last user message
        last_user_msg = None
        for msg in reversed(conversation):
            if msg.get("role") == "user":
                last_user_msg = msg.get("content", "")
                break

        if last_user_msg and last_user_msg not in browser_task:
            return f"{last_user_msg}\n\n{browser_task}"

        return browser_task

    async def _get_episodic_context_async(self, task: str) -> str | None:
        """Get episodic memory context asynchronously.

        Args:
            task: Current task

        Returns:
            Episodic context string or None
        """
        if not self.memory:
            return None

        try:
            return await self.memory.get_episodic_context(task)
        except Exception:
            return None


__all__ = ["TaskPlanner"]
