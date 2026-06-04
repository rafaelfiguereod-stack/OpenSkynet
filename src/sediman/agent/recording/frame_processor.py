"""Frame processing utilities.

This module provides utilities for processing and manipulating
screenshot frames, including cursor drawing and image manipulation.
"""

from __future__ import annotations

import base64
import io

from PIL import Image, ImageDraw
import structlog

logger = structlog.get_logger()


def draw_cursor_on_frame(screenshot_b64: str, cursor_x: int, cursor_y: int) -> str:
    """Draw a cursor indicator on a screenshot.

    Args:
        screenshot_b64: Base64-encoded screenshot image
        cursor_x: Cursor X position
        cursor_y: Cursor Y position

    Returns:
        Base64-encoded screenshot with cursor drawn
    """
    try:
        # Decode base64 image
        image_data = base64.b64decode(screenshot_b64)
        image = Image.open(io.BytesIO(image_data))

        # Draw cursor indicator
        draw = ImageDraw.Draw(image)
        cursor_size = 10
        # Draw a simple circle cursor
        draw.ellipse(
            [
                cursor_x - cursor_size,
                cursor_y - cursor_size,
                cursor_x + cursor_size,
                cursor_y + cursor_size,
            ],
            outline="red",
            width=2,
        )

        # Encode back to base64
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode("utf-8")

    except Exception as e:
        logger.warning("cursor_draw_failed", error=str(e))
        return screenshot_b64


def resize_frame(screenshot_b64: str, max_width: int = 1024, max_height: int = 768) -> str:
    """Resize a screenshot frame to fit within maximum dimensions.

    Args:
        screenshot_b64: Base64-encoded screenshot image
        max_width: Maximum width in pixels
        max_height: Maximum height in pixels

    Returns:
        Base64-encoded resized screenshot
    """
    try:
        # Decode base64 image
        image_data = base64.b64decode(screenshot_b64)
        image = Image.open(io.BytesIO(image_data))

        # Calculate new size maintaining aspect ratio
        width, height = image.size
        ratio = min(max_width / width, max_height / height)
        new_width = int(width * ratio)
        new_height = int(height * ratio)

        # Resize image
        resized = image.resize((new_width, new_height), Image.Resampling.LANCZOS)

        # Encode back to base64
        buffer = io.BytesIO()
        resized.save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode("utf-8")

    except Exception as e:
        logger.warning("frame_resize_failed", error=str(e))
        return screenshot_b64


def crop_frame(screenshot_b64: str, x: int, y: int, width: int, height: int) -> str:
    """Crop a screenshot frame to the specified region.

    Args:
        screenshot_b64: Base64-encoded screenshot image
        x: Starting X coordinate
        y: Starting Y coordinate
        width: Width of the region
        height: Height of the region

    Returns:
        Base64-encoded cropped screenshot
    """
    try:
        # Decode base64 image
        image_data = base64.b64decode(screenshot_b64)
        image = Image.open(io.BytesIO(image_data))

        # Crop image
        cropped = image.crop((x, y, x + width, y + height))

        # Encode back to base64
        buffer = io.BytesIO()
        cropped.save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode("utf-8")

    except Exception as e:
        logger.warning("frame_crop_failed", error=str(e))
        return screenshot_b64


def add_text_to_frame(screenshot_b64: str, text: str, x: int = 10, y: int = 10, color: str = "red") -> str:
    """Add text overlay to a screenshot frame.

    Args:
        screenshot_b64: Base64-encoded screenshot image
        text: Text to add
        x: X position for text
        y: Y position for text
        color: Text color (red, green, blue, white, black)

    Returns:
        Base64-encoded screenshot with text overlay
    """
    try:
        # Decode base64 image
        image_data = base64.b64decode(screenshot_b64)
        image = Image.open(io.BytesIO(image_data))

        # Draw text
        draw = ImageDraw.Draw(image)
        draw.text((x, y), text, fill=color)

        # Encode back to base64
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode("utf-8")

    except Exception as e:
        logger.warning("text_overlay_failed", error=str(e))
        return screenshot_b64
