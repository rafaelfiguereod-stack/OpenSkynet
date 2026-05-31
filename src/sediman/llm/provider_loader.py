from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml
import structlog

logger = structlog.get_logger()

_PROVIDERS_DIR = Path(__file__).parent / "providers"

_PROVIDER_CATEGORIES: dict[str, str] = {
    "cloud": "Cloud Providers",
    "cloud-cn": "Chinese Cloud Providers",
    "inference": "Inference Platforms",
    "local": "Local / Self-hosted",
}


def _find_display_name(models_data: dict[str, Any], default_id: str) -> str:
    for m in models_data.get("list", []):
        if m.get("id") == default_id:
            return m.get("name", default_id)
    return default_id


def _normalize_provider(data: dict[str, Any], category: str) -> dict[str, Any]:
    models_data = data.get("models", {})
    default_model = models_data.get("default", "")
    extra_models = [
        {"id": m["id"], "name": m.get("name", m["id"])}
        for m in models_data.get("list", [])
        if m.get("id") != default_model
    ]
    return {
        "model": default_model,
        "model_name": _find_display_name(models_data, default_model),
        "base_url": data.get("base_url"),
        "api_key_env": data.get("api_key_env"),
        "category": category,
        "extra_models": extra_models,
        "auto_detect": models_data.get("auto_detect", False),
    }


def load_providers() -> dict[str, dict[str, Any]]:
    providers: dict[str, dict[str, Any]] = {}
    if not _PROVIDERS_DIR.is_dir():
        logger.warning("providers_dir_missing", path=str(_PROVIDERS_DIR))
        return providers

    for category_dir in sorted(_PROVIDERS_DIR.iterdir()):
        if not category_dir.is_dir() or category_dir.name.startswith(("_", ".")):
            continue
        category = category_dir.name
        for yaml_file in sorted(category_dir.glob("*.yaml")):
            try:
                data = yaml.safe_load(yaml_file.read_text(encoding="utf-8"))
            except (yaml.YAMLError, OSError) as exc:
                logger.warning("provider_yaml_error", file=str(yaml_file), error=str(exc))
                continue
            if not data or "name" not in data:
                continue
            providers[data["name"]] = _normalize_provider(data, category)
            logger.debug("provider_loaded", name=data["name"], category=category)

    logger.info("providers_loaded", count=len(providers))
    return providers


def load_provider_categories() -> dict[str, str]:
    return dict(_PROVIDER_CATEGORIES)
