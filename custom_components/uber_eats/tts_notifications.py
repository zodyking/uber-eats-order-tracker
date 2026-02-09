"""TTS notification service for Uber Eats order events."""
from __future__ import annotations

import asyncio
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

IDLE_STATES = ("idle", "off", "standby", "unknown")
IDLE_TIMEOUT_SECONDS = 120
IDLE_POLL_INTERVAL_SECONDS = 2

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
        status = order_data.get("_display_status", "Unknown")
        return f"{prefix}, {account_name}, your {restaurant} order is now {status}."

    if event_type == "driver_arriving":
        return f"{prefix}, {account_name}, your driver is nearby."

    if event_type == "driver_arrived":
        return f"{prefix}, {account_name}, your driver is near your home."

    return ""


async def _wait_for_media_players_idle(
    hass: HomeAssistant,
    media_player_ids: list[str],
) -> bool:
    """Wait until all media players are idle or timeout."""
    elapsed = 0
    while elapsed < IDLE_TIMEOUT_SECONDS:
        all_idle = True
        for entity_id in media_player_ids:
            state = hass.states.get(entity_id)
            if state is None:
                continue
            if state.state.lower() not in IDLE_STATES:
                all_idle = False
                break
        if all_idle:
            return True
        await asyncio.sleep(IDLE_POLL_INTERVAL_SECONDS)
        elapsed += IDLE_POLL_INTERVAL_SECONDS
    return False


async def send_tts_if_idle(
    hass: HomeAssistant,
    entity_id: str,
    media_player_ids: list[str],
    message: str,
    cache: bool = False,
) -> bool:
    """Send TTS if all media players are idle. Wait up to timeout, then speak."""
    if not entity_id or not media_player_ids or not message:
        _LOGGER.warning("TTS skipped: missing entity_id, media_player_ids, or message")
        return False

    idle = await _wait_for_media_players_idle(hass, media_player_ids)
    if not idle:
        _LOGGER.warning("TTS skipped: media players not idle within timeout")
        return False

    service_data: dict[str, Any] = {
        "entity_id": entity_id,
        "message": message,
        "cache": cache,
    }
    if len(media_player_ids) == 1:
        service_data["media_player_entity_id"] = media_player_ids[0]
    else:
        service_data["media_player_entity_id"] = media_player_ids

    try:
        await hass.services.async_call("tts", "speak", service_data)
        return True
    except Exception as e:
        _LOGGER.error("TTS speak failed: %s", e)
        return False
