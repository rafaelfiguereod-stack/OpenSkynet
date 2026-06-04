"""Schedule-related keywords in multiple languages.

This module contains keywords for detecting scheduling intent
across multiple languages.
"""

from __future__ import annotations

# Schedule keywords for detecting scheduling intent
SCHEDULE_KEYWORDS: tuple[str, ...] = (
    "schedule",
    "cron",
    "remind",
    "recurring",
    "interval",
    "periodically",
    "every day",
    "every hour",
    "every week",
    # Spanish
    "programar",
    "programación",
    "planificar",
    "recordatorio",
    "periódico",
    "periódica",
    "cada día",
    "cada hora",
    "cada semana",
    # French
    "tous les jours",
    "toutes les heures",
    "chaque jour",
    "chaque heure",
    "hebdomadaire",
    "planifier",
    "rappel",
    "récurrent",
    "régulièrement",
    # German
    "alle minuten",
    "stündlich",
    "täglich",
    "wöchentlich",
    "planen",
    "zeitplan",
    "regelmäßig",
    # Chinese (Simplified)
    "定期",
    "定时",
    "定时任务",
    "每天",
    "每小时",
    "每分钟",
    "每周",
    "每月",
    "监控",
    "计划",
    "提醒",
    # Chinese (Traditional)
    "每小時",
    "每分鐘",
    "每週",
    "每月",
    "監控",
    "計劃",
    # Japanese
    "スケジュール",
    "リマインド",
    "モニター",
    # Korean
    "모니터링",
    "매일",
    "매시간",
    "매주",
    "매월",
    "매분",
    "예약",
    "알림",
    "정기적",
    "주기적",
    # Portuguese
    "cada dia",
    "cada hora",
    "cada semana",
    "diariamente",
    "semanalmente",
    "agendar",
    "lembrete",
    "recorrente",
    "periodicamente",
    # Brazilian Portuguese
    "diariamente",
    "semanalmente",
    "mensalmente",
    "anualmente",
)

__all__ = ["SCHEDULE_KEYWORDS"]
