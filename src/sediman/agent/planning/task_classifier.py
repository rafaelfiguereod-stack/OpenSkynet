"""Task classification for determining task types.

This module provides functionality to classify tasks into
categories like code, browser, conversational, etc.
"""

from __future__ import annotations

import re
from typing import Any

import structlog

from sediman.llm.provider import LLMProvider
from sediman.agent.planning.types import ClassificationResult

logger = structlog.get_logger()


class TaskClassifier:
    """Classifies tasks to determine optimal execution strategy.

    This classifier uses both fast-path regex patterns and
    LLM-based classification to determine task types.
    """

    # Pattern for explicit URL navigation tasks
    _EXPLICIT_URL_RE = re.compile(
        r'^(?:go\s+to|open|visit|browse|navigate\s+to)\s+https?://\S+$',
        re.IGNORECASE
    )

    # Common coding keywords and patterns
    _CODING_KEYWORDS = [
        "implement", "function", "class", "method", "variable",
        "debug", "fix", "refactor", "test", "api", "database",
        "server", "client", "frontend", "backend", "algorithm",
        "code", "programming", "software", "application",
        "script", "module", "package", "library", "framework",
    ]

    # File operation patterns
    _FILE_PATTERNS = [
        r"\.py$", r"\.js$", r"\.ts$", r"\.tsx$", r"\.jsx$",
        r"\.rs$", r"\.go$", r"\.java$", r"\.c$\.cpp$",
        r"\.html$", r"\.css$", r"\.json$", r"\.yaml$",
        r"package\.json", r"requirements\.txt", r"Cargo\.toml",
        r"git", r"repository", r"branch", r"commit",
    ]

    def __init__(self, llm: LLMProvider):
        """Initialize the task classifier.

        Args:
            llm: LLM provider for classification
        """
        self.llm = llm

    def classify(
        self,
        task: str,
        context: Any,
        use_llm: bool = True,
    ) -> ClassificationResult:
        """Classify a task into a type category.

        Args:
            task: The task to classify
            context: Planning context with additional information
            use_llm: Whether to use LLM for classification

        Returns:
            ClassificationResult with task type and confidence
        """
        # Fast-path: explicit URL navigation
        if self._is_explicit_url_task(task):
            return ClassificationResult(
                task_type="browser",
                confidence=0.95,
                reasoning="Explicit URL navigation pattern detected",
            )

        # Fast-path: strong coding task indicators
        if self._is_strong_coding_task(task):
            return ClassificationResult(
                task_type="code",
                confidence=0.85,
                reasoning="Strong coding task patterns detected",
            )

        # Fast-path: conversational (no action verbs)
        if self._is_conversational_task(task):
            return ClassificationResult(
                task_type="conversational",
                confidence=0.70,
                reasoning="No action verbs detected, appears conversational",
            )

        # LLM classification for ambiguous cases
        if use_llm and not context.previous_failure and len(task) < 1000:
            return self._llm_classify(task, context)

        # Default to general task
        return ClassificationResult(
            task_type="general",
            confidence=0.50,
            reasoning="No strong pattern detected, using general classification",
        )

    def _is_explicit_url_task(self, task: str) -> bool:
        """Check if task is an explicit URL navigation.

        Args:
            task: Task description

        Returns:
            True if task matches URL navigation pattern
        """
        return bool(self._EXPLICIT_URL_RE.match(task.strip()))

    def _is_strong_coding_task(self, task: str) -> bool:
        """Check if task has strong coding indicators.

        Args:
            task: Task description

        Returns:
            True if task appears to be coding-related
        """
        task_lower = task.lower()

        # Check for coding keywords
        coding_matches = sum(1 for kw in self._CODING_KEYWORDS if kw in task_lower)
        if coding_matches >= 2:
            return True

        # Check for file patterns
        for pattern in self._FILE_PATTERNS:
            if re.search(pattern, task, re.IGNORECASE):
                return True

        return False

    def _is_conversational_task(self, task: str) -> bool:
        """Check if task appears to be conversational.

        Args:
            task: Task description

        Returns:
            True if task lacks action indicators
        """
        from sediman.agent.locales import ACTION_VERBS

        task_lower = task.lower()
        has_actions = any(kw in task_lower for kw in ACTION_VERBS)
        return not has_actions

    async def _llm_classify(
        self,
        task: str,
        context: Any,
    ) -> ClassificationResult:
        """Use LLM to classify ambiguous tasks.

        Args:
            task: Task description
            context: Planning context

        Returns:
            ClassificationResult from LLM
        """
        system_prompt = """You are a task classifier. Determine if a task is:
- "code": Software development, debugging, file operations
- "browser": Web navigation, scraping, or page interaction
- "conversational": General chat without specific actions
- "general": Other types of tasks

Respond with a single word: code, browser, conversational, or general."""

        try:
            response = await self.llm.chat(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": task},
                ],
                tools=[],
            )

            classification = response.text.strip().lower()
            valid_types = {"code", "browser", "conversational", "general"}

            if classification in valid_types:
                return ClassificationResult(
                    task_type=classification,
                    confidence=0.75,
                    reasoning="LLM-based classification",
                )

        except Exception as e:
            logger.debug("llm_classification_failed", error=str(e))

        # Fallback on LLM failure
        return ClassificationResult(
            task_type="general",
            confidence=0.40,
            reasoning="LLM classification failed, using general fallback",
        )


__all__ = ["TaskClassifier"]
