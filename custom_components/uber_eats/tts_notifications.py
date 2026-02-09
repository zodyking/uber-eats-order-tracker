"""TTS notification service for Uber Eats order events.

Uses the same TTS call format as Home-Energy: target TTS entity, send directly
(no idle wait). See https://github.com/zodyking/Home-Energy
"""
from __future__ import annotations

import logging
from typing import Any

from homeassistant.core import HomeAssistant

from .const import (
    CONF_TTS_ENABLED,
    CONF_TTS_ENTITY_ID,
    CONF_TTS_MEDIA_PLAYERS,
    CONF_TTS_MESSAGE_PREFIX,
    DEFAULT_TTS_MESSAGE_PREFIX,
)

_LOGGER = logging.getLogger(__name__)

# Map order_stage to display labels (matches frontend _displayOrderStatus)
ORDER_STAGE_LABELS = {
    "preparing": "Preparing",
    "picked up": "Picked up",
    "en route": "En route",
    "arriving": "Arriving",
    "delivered": "Delivered",
    "complete": "Complete",
}


def _distance_feet(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine distance in feet between two lat/lon points."""
    import math
    R = 6371000  # Earth radius in meters
    to_rad = lambda x: x * 3.141592653589793 / 180
    d_lat = to_rad(lat2 - lat1)
    d_lon = to_rad(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(to_rad(lat1)) * math.cos(to_rad(lat2)) * math.sin(d_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return (R * c) * 3.28084  # meters to feet


def _get_display_order_status(data: dict[str, Any], home_lat: float, home_lon: float) -> str:
    """Derive display order status (matches frontend logic)."""
    if not data.get("active"):
        return "No Active Order"
    driver_name = data.get("driver_name") or ""
    no_driver = driver_name in ("No Driver Assigned", "Unknown", None, "")
    if no_driver:
        return "Preparing order"
    lat = data.get("driver_location_lat")
    lon = data.get("driver_location_lon")
    if lat is not None and lon is not None and isinstance(lat, (int, float)) and isinstance(lon, (int, float)):
        dist = _distance_feet(float(lat), float(lon), home_lat, home_lon)
        if dist <= 300:
            return "Arrived"
        if dist <= 1000:
            return "Arriving"
    stage = (data.get("order_stage") or "").lower()
    return ORDER_STAGE_LABELS.get(stage, data.get("order_stage", "—") or "—")


def build_message(
    prefix: str,
    account_name: str,
    order_data: dict[str, Any],
    event_type: str,
    prior_data: dict[str, Any] | None = None,
) -> str:
    """Build TTS message for a given event type."""
    prefix = prefix or DEFAULT_TTS_MESSAGE_PREFIX
    restaurant = order_data.get("restaurant_name", "Unknown") or "Unknown"
    driver = order_data.get("driver_name", "No Driver Assigned") or "No Driver Assigned"

    if event_type == "new_order":
        return f"{prefix}, A new {restaurant} order received for {account_name}."

    if event_type == "driver_assigned":
        return f"{prefix}, {account_name}, {driver} has been assigned to your {restaurant} order."

    if event_type == "driver_unassigned":
        prior_driver = (prior_data or {}).get("driver_name", "The driver") or "The driver"
        return f"{prefix}, {account_name}, {prior_driver} could not take delivery of your {restaurant} order. We're looking for a new driver."

    if event_type == "driver_reassigned":
        return f"{prefix}, {account_name}, {driver} has been assigned to your {restaurant} order."

    if event_type == "status_change":
        order_status = order_data.get("order_status", "Unknown") or "Unknown"
        return f"{prefix}, {order_status}."

    if event_type == "driver_arriving":
        return f"{prefix}, {account_name}, your driver is nearby."

    if event_type == "driver_arrived":
        return f"{prefix}, {account_name}, your driver is near your home."

    return ""


async def _find_tts_entity(hass: HomeAssistant, language: str | None = None) -> str | None:
    """Find an available TTS entity (fallback if user config missing)."""
    lang = (language or "en").lower()
    tts_entities = []
    for state in hass.states.async_all():
        if state.entity_id.startswith("tts."):
            tts_entities.append(state.entity_id)
    if not tts_entities:
        _LOGGER.warning("No TTS entities found in Home Assistant")
        return None
    for entity_id in tts_entities:
        if lang in entity_id.lower():
            return entity_id
    return tts_entities[0] if tts_entities else None


async def send_tts_if_idle(
    hass: HomeAssistant,
    tts_entity_id: str,
    media_player_ids: list[str],
    message: str,
    cache: bool = False,
) -> bool:
    """Send TTS to media player(s). Matches Home-Energy format: target TTS entity, speak directly."""
    if not message or not message.strip():
        _LOGGER.warning("TTS skipped: empty message")
        return False

    if not media_player_ids:
        _LOGGER.warning("TTS skipped: no media players configured")
        return False

    # Resolve TTS entity (user config or auto-find)
    tts_entity = (tts_entity_id or "").strip()
    if not tts_entity:
        tts_entity = await _find_tts_entity(hass)
    if not tts_entity:
        _LOGGER.error("TTS skipped: no TTS entity configured or found")
        return False

    # Validate at least one media player exists
    valid_players = [
        mp for mp in media_player_ids
        if hass.states.get(mp) is not None
    ]
    if not valid_players:
        _LOGGER.error("TTS skipped: no media players found: %s", media_player_ids)
        return False

    # Build service call (same format as Home-Energy)
    media_player_entity_id = valid_players[0] if len(valid_players) == 1 else valid_players
    service_data: dict[str, Any] = {
        "media_player_entity_id": media_player_entity_id,
        "message": message.strip(),
    }
    if cache:
        service_data["cache"] = True

    try:
        await hass.services.async_call(
            "tts",
            "speak",
            service_data,
            target={"entity_id": tts_entity},
            blocking=True,
        )
        _LOGGER.debug("TTS sent to %s via %s: %s", media_player_entity_id, tts_entity, message[:50])
        return True
    except Exception as e:
        _LOGGER.error("TTS speak failed: %s", e)
        return False
