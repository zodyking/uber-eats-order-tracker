"""TTS notification service for Uber Eats order events.

Messages from Agent-Files/tts.md. Sends one TTS per media player in parallel,
with volume_set before each. No idle check.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.const import ATTR_ENTITY_ID

from .const import (
    CONF_TTS_ENTITY_ID,
    CONF_TTS_MEDIA_PLAYERS,
    CONF_TTS_MESSAGE_PREFIX,
    DEFAULT_TTS_MESSAGE_PREFIX,
)

_LOGGER = logging.getLogger(__name__)


def build_message(
    prefix: str,
    account_name: str,
    order_data: dict[str, Any],
    event_type: str,
    prior_data: dict[str, Any] | None = None,
) -> str:
    """Build TTS message from Agent-Files/tts.md templates."""
    prefix = prefix or DEFAULT_TTS_MESSAGE_PREFIX
    restaurant = (order_data.get("restaurant_name") or "Unknown").strip() or "Unknown"
    driver = (order_data.get("driver_name") or "No Driver Assigned").strip() or "No Driver Assigned"
    user = account_name or "you"

    if event_type == "new_order":
        return f"{prefix}, a new {restaurant} order received for {user}."

    if event_type == "driver_assigned":
        return f"{prefix}, {user}, {driver} has been assigned to your {restaurant} order."

    if event_type == "status_change":
        timeline_text = (order_data.get("order_status") or order_data.get("order_status_description") or "").strip()
        if not timeline_text or timeline_text in ("Unknown", "No Active Order"):
            return ""
        return f"{prefix}, regarding {user}'s {restaurant} order, {timeline_text}."

    if event_type == "interval_update":
        street = (order_data.get("driver_location_street") or "unknown street").strip()
        if street in ("No Driver Assigned", "Unknown", ""):
            street = "unknown street"
        county = (order_data.get("driver_location_county") or "").strip()
        suburb = (order_data.get("driver_location_suburb") or "").strip()
        if county and "new york" in county.lower():
            place = suburb or county or "unknown area"
        else:
            place = county or suburb or "unknown area"
        eta = (order_data.get("driver_eta_str") or "—").strip()
        ett = order_data.get("minutes_remaining")
        ett_str = f"{ett} minutes" if ett is not None and ett != "" else "—"
        return f"{prefix}, {driver} was last seen near {street} in {place}, expected to arrive at {eta} in {ett_str}."

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


async def _send_tts_to_one(
    hass: HomeAssistant,
    tts_entity: str,
    media_player_id: str,
    message: str,
    volume_level: float,
    cache: bool,
) -> None:
    """Set volume then send TTS to a single media player."""
    volume_level = max(0.0, min(1.0, volume_level))
    try:
        await hass.services.async_call(
            "media_player",
            "volume_set",
            {ATTR_ENTITY_ID: media_player_id, "volume_level": volume_level},
            blocking=True,
        )
    except Exception as e:
        _LOGGER.warning("Volume set failed for %s: %s", media_player_id, e)
    try:
        await hass.services.async_call(
            "tts",
            "speak",
            {"media_player_entity_id": media_player_id, "message": message, **({"cache": True} if cache else {})},
            target={"entity_id": tts_entity},
            blocking=True,
        )
        _LOGGER.debug("TTS sent to %s via %s", media_player_id, tts_entity)
    except Exception as e:
        _LOGGER.error("TTS speak failed for %s: %s", media_player_id, e)


async def send_tts_if_idle(
    hass: HomeAssistant,
    tts_entity_id: str,
    media_player_ids: list[str],
    message: str,
    cache: bool = False,
    volume_level: float = 0.5,
) -> bool:
    """Send TTS to each media player in parallel; volume_set before each. No idle check."""
    if not message or not message.strip():
        _LOGGER.warning("TTS skipped: empty message")
        return False

    if not media_player_ids:
        _LOGGER.warning("TTS skipped: no media players configured")
        return False

    tts_entity = (tts_entity_id or "").strip()
    if not tts_entity:
        tts_entity = await _find_tts_entity(hass)
    if not tts_entity:
        _LOGGER.error("TTS skipped: no TTS entity configured or found")
        return False

    valid_players = [mp for mp in media_player_ids if hass.states.get(mp) is not None]
    if not valid_players:
        _LOGGER.error("TTS skipped: no media players found: %s", media_player_ids)
        return False

    msg = message.strip()
    await asyncio.gather(
        *[
            _send_tts_to_one(hass, tts_entity, mp, msg, volume_level, cache)
            for mp in valid_players
        ]
    )
    return True
