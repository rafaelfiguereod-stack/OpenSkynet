"""Multi-language keyword and pattern registry.

This package provides locale-aware keyword tuples used across the agent
for detecting task intent in multiple languages.
"""

from sediman.data.locales.schedule import SCHEDULE_KEYWORDS
from sediman.data.locales.browser import BROWSER_KEYWORDS

__all__ = [
    "SCHEDULE_KEYWORDS",
    "BROWSER_KEYWORDS",
]
