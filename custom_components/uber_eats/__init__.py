import logging
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryAuthFailed, ConfigEntryNotReady
from homeassistant.helpers import label_registry as lr

from .coordinator import UberEatsCoordinator
from .const import DOMAIN, CONF_SID, CONF_SESSION_ID, CONF_ACCOUNT_NAME, CONF_TIME_ZONE

_LOGGER = logging.getLogger(__name__)

PLATFORMS = ["sensor", "binary_sensor", "device_tracker"]


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry):
    hass.data.setdefault(DOMAIN, {})
    try:
        coordinator = UberEatsCoordinator(
            hass,
            entry.data[CONF_SID],
            entry.data[CONF_SESSION_ID],
            entry.data[CONF_ACCOUNT_NAME],
            entry.data[CONF_TIME_ZONE]
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


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry):
    hass.data[DOMAIN].pop(entry.entry_id)
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
