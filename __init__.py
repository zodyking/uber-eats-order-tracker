"""The Uber Eats integration."""
from __future__ import annotations

import logging
import os

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryAuthFailed, ConfigEntryNotReady
from homeassistant.helpers import label_registry as lr
from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig

from .coordinator import UberEatsCoordinator
from .const import DOMAIN, CONF_SID, CONF_SESSION_ID, CONF_ACCOUNT_NAME, CONF_TIME_ZONE

_LOGGER = logging.getLogger(__name__)

PLATFORMS = ["sensor", "binary_sensor", "device_tracker"]

# Panel configuration
PANEL_ICON = "mdi:food"
PANEL_TITLE = "Uber Eats"
PANEL_URL = "uber-eats"


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up the Uber Eats component."""
    hass.data.setdefault(DOMAIN, {})
    
    # Register WebSocket API
    from .websocket import async_setup as async_setup_websocket
    async_setup_websocket(hass)
    
    # Register sidebar panel
    await async_register_panel(hass)
    
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Uber Eats from a config entry."""
    hass.data.setdefault(DOMAIN, {})
    
    try:
        coordinator = UberEatsCoordinator(
            hass,
            entry.entry_id,
            entry.data[CONF_SID],
            entry.data[CONF_SESSION_ID],
            entry.data[CONF_ACCOUNT_NAME],
            entry.data[CONF_TIME_ZONE],
        )
        # Use async_config_entry_first_refresh to properly handle auth errors
        await coordinator.async_config_entry_first_refresh()
        hass.data[DOMAIN][entry.entry_id] = coordinator

        # Create Uber Eats label if it doesn't exist
        label_reg = lr.async_get(hass)
        label_id = "uber_eats"
        if label_id not in label_reg.labels:
            label_reg.async_create(
                name="Uber Eats",
                color="black",
                icon="mdi:food"
            )

        await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
        return True
    except ConfigEntryAuthFailed:
        raise  # Let HA handle reauth flow
    except Exception as e:
        _LOGGER.exception("Failed to setup Uber Eats integration: %s", e)
        raise ConfigEntryNotReady from e


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    hass.data[DOMAIN].pop(entry.entry_id, None)
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)


async def async_register_panel(hass: HomeAssistant) -> None:
    """Register the Uber Eats sidebar panel."""
    # Check if panel is already registered (avoid duplicates)
    if DOMAIN in hass.data.get("frontend_panels", {}):
        return

    # Get the path to our panel JS file
    panel_path = os.path.join(os.path.dirname(__file__), "frontend")
    panel_url = f"/{DOMAIN}_panel"

    # Register static path for the panel files
    try:
        await hass.http.async_register_static_paths([
            StaticPathConfig(panel_url, panel_path, cache_headers=False)
        ])
    except Exception as e:
        _LOGGER.warning("Failed to register static path: %s", e)

    # Register the custom panel
    try:
        await panel_custom.async_register_panel(
            hass,
            webcomponent_name="uber-eats-panel",
            frontend_url_path=PANEL_URL,
            sidebar_title=PANEL_TITLE,
            sidebar_icon=PANEL_ICON,
            module_url=f"{panel_url}/uber-eats-panel.js",
            embed_iframe=False,
            require_admin=False,
        )
        _LOGGER.info("Uber Eats panel registered successfully")
    except Exception as e:
        _LOGGER.warning("Failed to register panel: %s", e)
