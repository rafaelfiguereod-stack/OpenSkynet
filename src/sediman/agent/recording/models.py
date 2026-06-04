"""Recording data models.

This module provides the data structures for recording sessions,
frames, and action events.
"""

from __future__ import annotations

import base64
import json
import uuid
from dataclasses import dataclass, field
from typing import Any

import structlog

logger = structlog.get_logger()


@dataclass
class RecordedFrame:
    """A single recorded frame from browser execution.

    Attributes:
        timestamp: When the frame was captured
        screenshot_b64: Base64-encoded screenshot image
        url: Current URL when frame was captured
        title: Page title when frame was captured
        cursor_x: Mouse cursor X position
        cursor_y: Mouse cursor Y position
    """
    timestamp: float
    screenshot_b64: str
    url: str
    title: str
    cursor_x: int = 0
    cursor_y: int = 0

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary.

        Returns:
            Dictionary representation of the frame
        """
        return {
            "timestamp": self.timestamp,
            "screenshot_b64": self.screenshot_b64,
            "url": self.url,
            "title": self.title,
            "cursor_x": self.cursor_x,
            "cursor_y": self.cursor_y,
        }


@dataclass
class ActionEvent:
    """An action event that occurred during execution.

    Attributes:
        timestamp: When the action occurred
        action: Action name (e.g., 'click', 'type', 'navigate')
        element: Element description that was acted upon
        parameters: Action parameters
        result: Result of the action
    """
    timestamp: float
    action: str
    element: str
    parameters: dict[str, Any] = field(default_factory=dict)
    result: str | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary.

        Returns:
            Dictionary representation of the event
        """
        return {
            "timestamp": self.timestamp,
            "action": self.action,
            "element": self.element,
            "parameters": self.parameters,
            "result": self.result,
        }


@dataclass
class RecordingSession:
    """A recording session containing frames and events.

    Attributes:
        id: Unique session identifier
        task: Task being recorded
        start_time: When the session started
        end_time: When the session ended (None if still active)
        frames: List of recorded frames
        events: List of action events
        metadata: Additional session metadata
    """
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    task: str = ""
    start_time: float = field(default_factory=lambda: 0.0)
    end_time: float | None = None
    frames: list[RecordedFrame] = field(default_factory=list)
    events: list[ActionEvent] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

    def add_frame(self, frame: RecordedFrame) -> None:
        """Add a frame to the session.

        Args:
            frame: Frame to add
        """
        self.frames.append(frame)

    def add_event(self, event: ActionEvent) -> None:
        """Add an event to the session.

        Args:
            event: Event to add
        """
        self.events.append(event)

    def duration(self) -> float:
        """Get session duration.

        Returns:
            Duration in seconds (0 if not ended)
        """
        if self.end_time is None:
            return 0.0
        return self.end_time - self.start_time

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary.

        Returns:
            Dictionary representation of the session
        """
        return {
            "id": self.id,
            "task": self.task,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "duration": self.duration(),
            "frames": [f.to_dict() for f in self.frames],
            "events": [e.to_dict() for e in self.events],
            "metadata": self.metadata,
        }

    def to_json(self) -> str:
        """Convert to JSON string.

        Returns:
            JSON representation of the session
        """
        return json.dumps(self.to_dict())
