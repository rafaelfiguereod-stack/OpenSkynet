"""Media processing tools registration.

This module handles registration of media-related tools including
vision analysis, image generation, and text-to-speech.
"""

from __future__ import annotations

from sediman.agent.tool_dispatch import ToolRegistry
from sediman.llm.provider import ToolDefinition

from .media import _handle_vision_analyze, _handle_image_generate, _handle_text_to_speech


def register_media_tools(registry: ToolRegistry) -> None:
    """Register all media processing tools.

    Args:
        registry: Tool registry to register tools with
    """
    # vision_analyze tool
    registry.register(
        ToolDefinition(
            name="vision_analyze",
            description="Analyze images using vision AI. Use when you need to understand image contents, extract text from images, or describe visual elements.",
            parameters={
                "type": "object",
                "properties": {
                    "image": {
                        "type": "string",
                        "description": "Image URL or file path to analyze",
                    },
                    "prompt": {
                        "type": "string",
                        "description": "Specific question about the image (optional)",
                    },
                },
                "required": ["image"],
            },
            toolset="vision",
        ),
        _handle_vision_analyze,
    )

    # image_generate tool
    registry.register(
        ToolDefinition(
            name="image_generate",
            description="Generate images from text descriptions. Use when you need to create visual content based on textual descriptions.",
            parameters={
                "type": "object",
                "properties": {
                    "prompt": {
                        "type": "string",
                        "description": "Text description of the image to generate",
                    },
                    "size": {
                        "type": "string",
                        "enum": ["256x256", "512x512", "1024x1024", "1792x1024", "1024x1792"],
                        "description": "Image size (default: 1024x1024)",
                    },
                },
                "required": ["prompt"],
            },
            toolset="image_gen",
        ),
        _handle_image_generate,
    )

    # text_to_speech tool
    registry.register(
        ToolDefinition(
            name="text_to_speech",
            description="Convert text to speech audio. Use when you need to generate audio content from text.",
            parameters={
                "type": "object",
                "properties": {
                    "text": {
                        "type": "string",
                        "description": "Text to convert to speech",
                    },
                    "voice": {
                        "type": "string",
                        "description": "Voice to use (alloy, echo, fable, onyx, nova, shimmer)",
                        "enum": ["alloy", "echo", "fable", "onyx", "nova", "shimmer"],
                    },
                },
                "required": ["text"],
            },
            toolset="tts",
        ),
        _handle_text_to_speech,
    )


__all__ = ["register_media_tools"]
