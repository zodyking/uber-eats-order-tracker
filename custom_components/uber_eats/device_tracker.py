"""Device tracker for Uber Eats driver location."""
from __future__ import annotations

import logging
from typing import Any

from homeassistant.components.device_tracker import SourceType
from homeassistant.components.device_tracker.config_entry import TrackerEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN, CONF_ACCOUNT_NAME
from .coordinator import UberEatsCoordinator

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    config_entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up Uber Eats device tracker from a config entry."""
    coordinator: UberEatsCoordinator = hass.data[DOMAIN][config_entry.entry_id]
    account_name = config_entry.data[CONF_ACCOUNT_NAME]
    
    async_add_entities([UberEatsDriverTracker(coordinator, account_name)])


class UberEatsDriverTracker(CoordinatorEntity, TrackerEntity):
    """Uber Eats driver location tracker for Map card."""

    _attr_has_entity_name = True
    _attr_icon = "mdi:moped"

    def __init__(self, coordinator: UberEatsCoordinator, account_name: str) -> None:
        """Initialize the driver tracker."""
        super().__init__(coordinator)
        self._account_name = account_name.replace(" ", "_")
        self._attr_unique_id = f"uber_eats_{self._account_name}_driver_tracker"
        self._attr_name = f"{self._account_name} Uber Eats Driver"

    @property
    def source_type(self) -> SourceType:
        """Return the source type."""
        return SourceType.GPS

    @property
    def latitude(self) -> float | None:
        """Return latitude value of the driver, or home location if no active order."""
        if not self.coordinator.data.get("active", False):
            # Return HA home latitude when no active order
            return self.coordinator.hass.config.latitude
        
        lat = self.coordinator.data.get("driver_location_lat")
        if lat is None or lat == "No Active Order" or not isinstance(lat, (int, float)):
            # Fallback to home if driver location not available yet
            return self.coordinator.hass.config.latitude
        return float(lat)

    @property
    def longitude(self) -> float | None:
        """Return longitude value of the driver, or home location if no active order."""
        if not self.coordinator.data.get("active", False):
            # Return HA home longitude when no active order
            return self.coordinator.hass.config.longitude
        
        lon = self.coordinator.data.get("driver_location_lon")
        if lon is None or lon == "No Active Order" or not isinstance(lon, (int, float)):
            # Fallback to home if driver location not available yet
            return self.coordinator.hass.config.longitude
        return float(lon)

    @property
    def location_name(self) -> str | None:
        """Return a location name for the driver."""
        if not self.coordinator.data.get("active", False):
            return "home"
        
        street = self.coordinator.data.get("driver_location_street", "")
        if street and street != "No Driver Assigned":
            return street
        return None

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return extra attributes."""
        data = self.coordinator.data
        return {
            "driver_name": data.get("driver_name", "No Driver Assigned"),
            "restaurant_name": data.get("restaurant_name", "No Restaurant"),
            "order_stage": data.get("order_stage", "No Active Order"),
            "eta": data.get("driver_eta_str", "No ETA"),
            "minutes_remaining": data.get("minutes_remaining"),
            "street": data.get("driver_location_street", "Unknown"),
            "suburb": data.get("driver_location_suburb", "Unknown"),
            "full_address": data.get("driver_location_address", "Unknown"),
        }

    @property
    def state(self) -> str | None:
        """Return the state of the tracker."""
        if not self.coordinator.data.get("active", False):
            return "home"  # At home location when no active order
        
        # Return order stage as state when active
        stage = self.coordinator.data.get("order_stage", "unknown")
        return stage if stage != "No Active Order" else "home"

    @property
    def available(self) -> bool:
        """Return True if entity is available."""
        return self.coordinator.last_update_success
