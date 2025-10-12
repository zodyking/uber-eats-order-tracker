from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import label_registry as lr

from .coordinator import UberEatsCoordinator
from .const import DOMAIN, CONF_SID, CONF_UUID, CONF_ACCOUNT_NAME, CONF_TIME_ZONE

PLATFORMS = ["sensor", "binary_sensor"]

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry):
    hass.data.setdefault(DOMAIN, {})
    coordinator = UberEatsCoordinator(
        hass,
        entry.data[CONF_SID],
        entry.data[CONF_UUID],
        entry.data[CONF_ACCOUNT_NAME],
        entry.data[CONF_TIME_ZONE]
    )
    await coordinator.async_refresh()
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

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry):
    hass.data[DOMAIN].pop(entry.entry_id)
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)