"""WebSocket API for Uber Eats panel."""
from __future__ import annotations

import json
import logging
import os
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.config_entries import ConfigEntryState

from .const import (
    DOMAIN,
    CONF_ACCOUNT_NAME,
    CONF_TIME_ZONE,
    CONF_TTS_ENABLED,
    CONF_TTS_ENTITY_ID,
    CONF_TTS_MEDIA_PLAYERS,
    CONF_TTS_MESSAGE_PREFIX,
    CONF_TTS_VOLUME,
    CONF_TTS_INTERVAL_ENABLED,
    CONF_TTS_INTERVAL_MINUTES,
    CONF_DRIVER_NEARBY_AUTOMATION_ENABLED,
    CONF_DRIVER_NEARBY_AUTOMATION_ENTITY,
    CONF_DRIVER_NEARBY_DISTANCE_FEET,
    DEFAULT_TTS_MESSAGE_PREFIX,
    DEFAULT_DRIVER_NEARBY_DISTANCE_FEET,
    DEFAULT_TTS_VOLUME,
    DEFAULT_TTS_INTERVAL_MINUTES,
)

_LOGGER = logging.getLogger(__name__)

_INTEGRATION_VERSION: str | None = None


def _get_integration_version() -> str:
    """Return integration version from manifest (cached). Never raises."""
    global _INTEGRATION_VERSION
    if _INTEGRATION_VERSION is None:
        try:
            manifest_path = os.path.join(os.path.dirname(__file__), "manifest.json")
            with open(manifest_path, encoding="utf-8") as f:
                _INTEGRATION_VERSION = json.load(f).get("version", "1.0.0")
        except Exception:
            _INTEGRATION_VERSION = "1.0.0"
    return _INTEGRATION_VERSION


@callback
def async_setup(hass: HomeAssistant) -> None:
    """Set up WebSocket API."""
    websocket_api.async_register_command(hass, websocket_get_accounts)
    websocket_api.async_register_command(hass, websocket_get_account_data)
    websocket_api.async_register_command(hass, websocket_delete_account)
    websocket_api.async_register_command(hass, websocket_get_tts_entities)
    websocket_api.async_register_command(hass, websocket_get_tts_settings)
    websocket_api.async_register_command(hass, websocket_update_tts_settings)
    websocket_api.async_register_command(hass, websocket_get_automations)


@websocket_api.websocket_command(
    {
        "type": "uber_eats/get_accounts",
    }
)
@websocket_api.async_response
async def websocket_get_accounts(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Get all Uber Eats accounts."""
    accounts = []
    
    # Get home coordinates for fallback
    home_lat = hass.config.latitude
    home_lon = hass.config.longitude
    
    for entry in hass.config_entries.async_entries(DOMAIN):
        # Determine connection status based on entry state
        if entry.state == ConfigEntryState.LOADED:
            connection_status = "connected"
        elif entry.state == ConfigEntryState.SETUP_ERROR:
            connection_status = "error"
        elif entry.state == ConfigEntryState.SETUP_RETRY:
            connection_status = "retrying"
        else:
            connection_status = "unknown"
        
        coordinator = hass.data.get(DOMAIN, {}).get(entry.entry_id)
        
        if not coordinator:
            # Entry exists but coordinator not loaded - might be auth error
            accounts.append({
                "entry_id": entry.entry_id,
                "account_name": entry.data.get(CONF_ACCOUNT_NAME, "Unknown"),
                "time_zone": entry.data.get(CONF_TIME_ZONE, "UTC"),
                "active": False,
                "connection_status": "error" if entry.state == ConfigEntryState.SETUP_ERROR else connection_status,
                "order_stage": "No Active Order",
                "order_status": "No Active Order",
                "restaurant_name": "No Restaurant",
                "driver_name": "No Driver Assigned",
                "driver_eta": "No ETA",
                "minutes_remaining": None,
                "order_id": "No Active Order",
                "latest_arrival": "No Latest Arrival",
                "driver_location": {
                    "lat": home_lat,
                    "lon": home_lon,
                    "street": "Home",
                    "suburb": "Unknown",
                    "address": "Home",
                },
            })
            continue
        
        data = coordinator.data or {}
        
        # Check if last update was successful
        if not coordinator.last_update_success:
            connection_status = "error"
        
        # Get driver location or fall back to home
        is_active = data.get("active", False)
        driver_name = data.get("driver_name", "No Driver Assigned")
        driver_assigned = driver_name not in ("No Driver Assigned", "Unknown", None, "")
        
        lat = data.get("driver_location_lat")
        lon = data.get("driver_location_lon")
        
        has_valid_coords = (
            lat not in (None, "No Active Order") and
            lon not in (None, "No Active Order") and
            isinstance(lat, (int, float)) and
            isinstance(lon, (int, float))
        )
        
        # Use driver location only if order active and driver assigned with valid coords
        if is_active and driver_assigned and has_valid_coords:
            display_lat = float(lat)
            display_lon = float(lon)
        else:
            display_lat = home_lat
            display_lon = home_lon
        
        accounts.append({
            "entry_id": entry.entry_id,
            "account_name": entry.data.get(CONF_ACCOUNT_NAME, "Unknown"),
            "time_zone": entry.data.get(CONF_TIME_ZONE, "UTC"),
            "active": is_active,
            "connection_status": connection_status,
            "order_stage": data.get("order_stage", "No Active Order"),
            "order_status": data.get("order_status", "No Active Order"),
            "restaurant_name": data.get("restaurant_name", "No Restaurant"),
            "driver_name": driver_name,
            "driver_eta": data.get("driver_eta_str", "No ETA"),
            "minutes_remaining": data.get("minutes_remaining"),
            "order_id": data.get("order_id", "No Active Order"),
            "latest_arrival": data.get("latest_arrival", "No Latest Arrival"),
            "driver_location": {
                "lat": display_lat,
                "lon": display_lon,
                "street": data.get("driver_location_street", "Unknown"),
                "suburb": data.get("driver_location_suburb", "Unknown"),
                "address": data.get("driver_location_address", "Unknown"),
            },
        })
    
    try:
        version = _get_integration_version()
    except Exception:
        version = "1.0.0"
    connection.send_result(msg["id"], {
        "accounts": accounts,
        "version": version,
    })


@websocket_api.websocket_command(
    {
        "type": "uber_eats/get_account_data",
        vol.Required("entry_id"): str,
    }
)
@websocket_api.async_response
async def websocket_get_account_data(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Get detailed data for a specific account."""
    entry_id = msg["entry_id"]
    
    entry = hass.config_entries.async_get_entry(entry_id)
    if not entry:
        connection.send_error(msg["id"], "not_found", "Config entry not found")
        return
    
    # Get home coordinates
    home_lat = hass.config.latitude
    home_lon = hass.config.longitude
    
    # Determine connection status
    if entry.state == ConfigEntryState.LOADED:
        connection_status = "connected"
    elif entry.state == ConfigEntryState.SETUP_ERROR:
        connection_status = "error"
    elif entry.state == ConfigEntryState.SETUP_RETRY:
        connection_status = "retrying"
    else:
        connection_status = "unknown"
    
    coordinator = hass.data.get(DOMAIN, {}).get(entry_id)
    if not coordinator:
        # Return basic info if coordinator not available
        result = {
            "entry_id": entry_id,
            "account_name": entry.data.get(CONF_ACCOUNT_NAME, "Unknown"),
            "time_zone": entry.data.get(CONF_TIME_ZONE, "UTC"),
            "active": False,
            "tracking_active": False,
            "driver_assigned": False,
            "connection_status": "error",
            "order_stage": "No Active Order",
            "order_status": "No Active Order",
            "order_status_description": "No Active Order",
            "restaurant_name": "No Restaurant",
            "driver_name": "No Driver Assigned",
            "driver_eta": "No ETA",
            "minutes_remaining": None,
            "order_id": "No Active Order",
            "latest_arrival": "No Latest Arrival",
            "driver_location": {
                "lat": home_lat,
                "lon": home_lon,
                "street": "Home",
                "suburb": "Unknown",
                "quarter": "Unknown",
                "county": "Unknown",
                "address": "Home",
            },
            "home_location": {
                "lat": home_lat,
                "lon": home_lon,
            },
            "map_url": "No Map Available",
        }
        connection.send_result(msg["id"], result)
        return
    
    data = coordinator.data or {}
    
    # Check last update success
    if not coordinator.last_update_success:
        connection_status = "error"
    
    # Determine if driver tracking is active
    driver_name = data.get("driver_name", "No Driver Assigned")
    is_active = data.get("active", False)
    driver_assigned = driver_name not in ("No Driver Assigned", "Unknown", None, "")
    
    lat = data.get("driver_location_lat")
    lon = data.get("driver_location_lon")
    
    has_valid_coords = (
        lat not in (None, "No Active Order") and
        lon not in (None, "No Active Order") and
        isinstance(lat, (int, float)) and
        isinstance(lon, (int, float))
    )
    
    tracking_active = is_active and driver_assigned and has_valid_coords
    
    result = {
        "entry_id": entry_id,
        "account_name": entry.data.get(CONF_ACCOUNT_NAME, "Unknown"),
        "time_zone": entry.data.get(CONF_TIME_ZONE, "UTC"),
        "active": is_active,
        "tracking_active": tracking_active,
        "driver_assigned": driver_assigned,
        "connection_status": connection_status,
        "order_stage": data.get("order_stage", "No Active Order"),
        "order_status": data.get("order_status", "No Active Order"),
        "order_status_description": data.get("order_status_description", "No Active Order"),
        "restaurant_name": data.get("restaurant_name", "No Restaurant"),
        "driver_name": driver_name,
        "driver_eta": data.get("driver_eta_str", "No ETA"),
        "minutes_remaining": data.get("minutes_remaining"),
        "order_id": data.get("order_id", "No Active Order"),
        "latest_arrival": data.get("latest_arrival", "No Latest Arrival"),
        "driver_location": {
            "lat": float(lat) if tracking_active else home_lat,
            "lon": float(lon) if tracking_active else home_lon,
            "street": data.get("driver_location_street", "Unknown"),
            "suburb": data.get("driver_location_suburb", "Unknown"),
            "quarter": data.get("driver_location_quarter", "Unknown"),
            "county": data.get("driver_location_county", "Unknown"),
            "address": data.get("driver_location_address", "Unknown"),
        },
        "home_location": {
            "lat": home_lat,
            "lon": home_lon,
        },
        "map_url": data.get("map_url", "No Map Available"),
    }
    
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command(
    {
        "type": "uber_eats/delete_account",
        vol.Required("entry_id"): str,
    }
)
@websocket_api.async_response
async def websocket_delete_account(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Delete an Uber Eats account."""
    entry_id = msg["entry_id"]
    
    entry = hass.config_entries.async_get_entry(entry_id)
    if not entry:
        connection.send_error(msg["id"], "not_found", "Account not found")
        return
    
    try:
        await hass.config_entries.async_remove(entry_id)
        connection.send_result(msg["id"], {"success": True})
    except Exception as e:
        _LOGGER.error("Failed to delete account: %s", e)
        connection.send_error(msg["id"], "delete_failed", str(e))


@websocket_api.websocket_command(
    {
        "type": "uber_eats/get_tts_entities",
    }
)
@websocket_api.async_response
async def websocket_get_tts_entities(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Get TTS and media player entities for dropdowns."""
    tts_entities = []
    media_player_entities = []

    for state in hass.states.async_all():
        entity_id = state.entity_id
        if entity_id.startswith("tts."):
            tts_entities.append({"entity_id": entity_id, "name": state.name or entity_id})
        elif entity_id.startswith("media_player."):
            media_player_entities.append({"entity_id": entity_id, "name": state.name or entity_id})

    tts_entities.sort(key=lambda x: x["entity_id"])
    media_player_entities.sort(key=lambda x: x["entity_id"])

    connection.send_result(msg["id"], {
        "tts_entities": tts_entities,
        "media_player_entities": media_player_entities,
    })


@websocket_api.websocket_command(
    {
        "type": "uber_eats/get_automations",
    }
)
@websocket_api.async_response
async def websocket_get_automations(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Get all automation entities for driver-nearby dropdown."""
    automations = []
    for state in hass.states.async_all():
        if state.entity_id.startswith("automation."):
            automations.append({"entity_id": state.entity_id, "name": state.name or state.entity_id})
    automations.sort(key=lambda x: (x["name"] or "").lower())
    connection.send_result(msg["id"], {"automations": automations})


@websocket_api.websocket_command(
    {
        "type": "uber_eats/get_tts_settings",
        vol.Required("entry_id"): str,
    }
)
@websocket_api.async_response
async def websocket_get_tts_settings(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Get TTS settings for an account."""
    entry_id = msg["entry_id"]
    entry = hass.config_entries.async_get_entry(entry_id)
    if not entry:
        connection.send_error(msg["id"], "not_found", "Config entry not found")
        return

    options = entry.options or {}
    connection.send_result(msg["id"], {
        "tts_enabled": options.get(CONF_TTS_ENABLED, False),
        "tts_entity_id": options.get(CONF_TTS_ENTITY_ID, ""),
        "tts_media_players": options.get(CONF_TTS_MEDIA_PLAYERS, []),
        "tts_message_prefix": options.get(CONF_TTS_MESSAGE_PREFIX, DEFAULT_TTS_MESSAGE_PREFIX),
        "tts_volume": float(options.get(CONF_TTS_VOLUME, DEFAULT_TTS_VOLUME)),
        "tts_interval_enabled": options.get(CONF_TTS_INTERVAL_ENABLED, False),
        "tts_interval_minutes": int(options.get(CONF_TTS_INTERVAL_MINUTES, DEFAULT_TTS_INTERVAL_MINUTES)),
        "driver_nearby_automation_enabled": options.get(CONF_DRIVER_NEARBY_AUTOMATION_ENABLED, False),
        "driver_nearby_automation_entity": options.get(CONF_DRIVER_NEARBY_AUTOMATION_ENTITY, ""),
        "driver_nearby_distance_feet": int(options.get(CONF_DRIVER_NEARBY_DISTANCE_FEET, DEFAULT_DRIVER_NEARBY_DISTANCE_FEET)),
    })


@websocket_api.websocket_command(
    {
        "type": "uber_eats/update_tts_settings",
        vol.Required("entry_id"): str,
        vol.Required("tts_enabled"): bool,
        vol.Required("tts_entity_id"): str,
        vol.Required("tts_media_players"): list,
        vol.Required("tts_message_prefix"): str,
        vol.Optional("tts_volume"): vol.Any(int, float),
        vol.Optional("tts_interval_enabled"): bool,
        vol.Optional("tts_interval_minutes"): int,
        vol.Optional("driver_nearby_automation_enabled"): bool,
        vol.Optional("driver_nearby_automation_entity"): str,
        vol.Optional("driver_nearby_distance_feet"): int,
    }
)
@websocket_api.async_response
async def websocket_update_tts_settings(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Update TTS settings for an account."""
    entry_id = msg["entry_id"]
    entry = hass.config_entries.async_get_entry(entry_id)
    if not entry:
        connection.send_error(msg["id"], "not_found", "Config entry not found")
        return

    options = dict(entry.options or {})
    options[CONF_TTS_ENABLED] = msg["tts_enabled"]
    options[CONF_TTS_ENTITY_ID] = (msg["tts_entity_id"] or "").strip()
    options[CONF_TTS_MEDIA_PLAYERS] = [
        e for e in msg["tts_media_players"] if isinstance(e, str) and e.startswith("media_player.")
    ]
    options[CONF_TTS_MESSAGE_PREFIX] = (msg["tts_message_prefix"] or "").strip() or DEFAULT_TTS_MESSAGE_PREFIX
    if "tts_volume" in msg and msg["tts_volume"] is not None:
        options[CONF_TTS_VOLUME] = max(0.0, min(1.0, float(msg["tts_volume"])))
    if "tts_interval_enabled" in msg and msg["tts_interval_enabled"] is not None:
        options[CONF_TTS_INTERVAL_ENABLED] = bool(msg["tts_interval_enabled"])
    if "tts_interval_minutes" in msg and msg["tts_interval_minutes"] is not None:
        options[CONF_TTS_INTERVAL_MINUTES] = max(5, min(15, int(msg["tts_interval_minutes"])))
    if "driver_nearby_automation_enabled" in msg and msg["driver_nearby_automation_enabled"] is not None:
        options[CONF_DRIVER_NEARBY_AUTOMATION_ENABLED] = bool(msg["driver_nearby_automation_enabled"])
    if "driver_nearby_automation_entity" in msg:
        options[CONF_DRIVER_NEARBY_AUTOMATION_ENTITY] = (msg["driver_nearby_automation_entity"] or "").strip()
    if "driver_nearby_distance_feet" in msg and msg["driver_nearby_distance_feet"] is not None:
        options[CONF_DRIVER_NEARBY_DISTANCE_FEET] = max(50, min(2000, int(msg["driver_nearby_distance_feet"])))

    hass.config_entries.async_update_entry(entry, options=options)
    connection.send_result(msg["id"], {"success": True})
