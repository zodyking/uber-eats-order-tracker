"""WebSocket API for Uber Eats panel."""
from __future__ import annotations

import logging
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
    DEFAULT_TTS_MESSAGE_PREFIX,
    CONF_TTS_PERIODIC_ENABLED,
    CONF_TTS_PERIODIC_INTERVAL_MINUTES,
    TTS_PERIODIC_INTERVAL_OPTIONS,
    DEFAULT_TTS_PERIODIC_INTERVAL_MINUTES,
)

_LOGGER = logging.getLogger(__name__)


@callback
def async_setup(hass: HomeAssistant) -> None:
    """Set up WebSocket API."""
    websocket_api.async_register_command(hass, websocket_get_accounts)
    websocket_api.async_register_command(hass, websocket_get_account_data)
    websocket_api.async_register_command(hass, websocket_delete_account)
    websocket_api.async_register_command(hass, websocket_get_tts_entities)
    websocket_api.async_register_command(hass, websocket_get_tts_settings)
    websocket_api.async_register_command(hass, websocket_update_tts_settings)


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
    
    connection.send_result(msg["id"], {"accounts": accounts})


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
    interval = options.get(CONF_TTS_PERIODIC_INTERVAL_MINUTES, DEFAULT_TTS_PERIODIC_INTERVAL_MINUTES)
    if interval not in TTS_PERIODIC_INTERVAL_OPTIONS:
        interval = DEFAULT_TTS_PERIODIC_INTERVAL_MINUTES
    connection.send_result(msg["id"], {
        "tts_enabled": options.get(CONF_TTS_ENABLED, False),
        "tts_entity_id": options.get(CONF_TTS_ENTITY_ID, ""),
        "tts_media_players": options.get(CONF_TTS_MEDIA_PLAYERS, []),
        "tts_message_prefix": options.get(CONF_TTS_MESSAGE_PREFIX, DEFAULT_TTS_MESSAGE_PREFIX),
        "tts_periodic_enabled": options.get(CONF_TTS_PERIODIC_ENABLED, False),
        "tts_periodic_interval_minutes": interval,
    })


@websocket_api.websocket_command(
    {
        "type": "uber_eats/update_tts_settings",
        vol.Required("entry_id"): str,
        vol.Required("tts_enabled"): bool,
        vol.Required("tts_entity_id"): str,
        vol.Required("tts_media_players"): list,
        vol.Required("tts_message_prefix"): str,
        vol.Required("tts_periodic_enabled"): bool,
        vol.Required("tts_periodic_interval_minutes"): vol.All(int, vol.In([5, 10, 15, 20])),
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
    options[CONF_TTS_PERIODIC_ENABLED] = msg["tts_periodic_enabled"]
    interval = msg.get("tts_periodic_interval_minutes", DEFAULT_TTS_PERIODIC_INTERVAL_MINUTES)
    options[CONF_TTS_PERIODIC_INTERVAL_MINUTES] = (
        interval if interval in TTS_PERIODIC_INTERVAL_OPTIONS else DEFAULT_TTS_PERIODIC_INTERVAL_MINUTES
    )

    hass.config_entries.async_update_entry(entry, options=options)
    connection.send_result(msg["id"], {"success": True})
