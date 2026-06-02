"""Logging helpers extracted from tui.py — filter and suppress noisy loggers."""

from __future__ import annotations

import logging
import os
from contextlib import contextmanager


class _AllowSedimanFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        return record.name.startswith("sediman")


_root_filter = _AllowSedimanFilter()


def install_global_log_filter() -> None:
    logging.getLogger().addFilter(_root_filter)
    logging.getLogger().setLevel(logging.CRITICAL)


def remove_global_log_filter() -> None:
    logging.getLogger().removeFilter(_root_filter)


@contextmanager
def suppress_logging():
    import structlog

    old_root_level = logging.getLogger().level
    old_root_handlers = logging.getLogger().handlers[:]
    logging.getLogger().setLevel(logging.CRITICAL)
    devnull = open(os.devnull, "w")
    structlog.configure(
        processors=[lambda _, __, ___: None],
        wrapper_class=structlog.make_filtering_bound_logger(logging.CRITICAL),
        logger_factory=structlog.WriteLoggerFactory(devnull),
    )
    try:
        yield
    finally:
        structlog.reset_defaults()
        logging.getLogger().setLevel(old_root_level)
        try:
            devnull.close()
        except Exception:
            pass
