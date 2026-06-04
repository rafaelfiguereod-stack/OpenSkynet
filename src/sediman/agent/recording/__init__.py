"""Recording package for browser automation recording.

This package provides data structures and utilities for recording
browser automation sessions, including frames, events, and processing.
"""

from sediman.agent.recording.models import RecordedFrame, ActionEvent, RecordingSession
from sediman.agent.recording.frame_processor import (
    draw_cursor_on_frame,
    resize_frame,
    crop_frame,
    add_text_to_frame,
)

__all__ = [
    "RecordedFrame",
    "ActionEvent", 
    "RecordingSession",
    "draw_cursor_on_frame",
    "resize_frame",
    "crop_frame",
    "add_text_to_frame",
]
