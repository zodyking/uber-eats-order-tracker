"""Device tracker for Uber Eats driver location."""
from __future__ import annotations

import logging
from typing import Any

from homeassistant.components.device_tracker import SourceType
from homeassistant.components.device_tracker.config_entry import TrackerEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
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
    
    async_add_entities([UberEatsDriverTracker(coordinator, account_name, config_entry.entry_id)])


class UberEatsDriverTracker(CoordinatorEntity, TrackerEntity):
    """Uber Eats driver location tracker for Map card."""

    _attr_has_entity_name = True
    _attr_icon = "mdi:moped"

    def __init__(self, coordinator: UberEatsCoordinator, account_name: str, entry_id: str) -> None:
        """Initialize the driver tracker."""
        super().__init__(coordinator)
        self._account_name = account_name.replace(" ", "_")
        self._entry_id = entry_id
        self._attr_unique_id = f"uber_eats_{self._account_name}_driver_tracker"
        self._attr_name = f"{self._account_name} Uber Eats Order Tracker"

    def _is_driver_tracking_active(self) -> bool:
        """Check if driver tracking should be active (order active AND driver assigned)."""
        data = self.coordinator.data
        if not data.get("active", False):
            return False
        
        driver_name = data.get("driver_name", "No Driver Assigned")
        if driver_name in ("No Driver Assigned", "Unknown", None, ""):
            return False
        
        # Check if we have valid coordinates
        lat = data.get("driver_location_lat")
        lon = data.get("driver_location_lon")
        if lat in (None, "No Active Order") or lon in (None, "No Active Order"):
            return False
        if not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)):
            return False
        
        return True

    @property
    def source_type(self) -> SourceType:
        """Return the source type."""
        return SourceType.GPS

    @property
    def latitude(self) -> float | None:
        """Return latitude value of the driver, or home location if not tracking."""
        if not self._is_driver_tracking_active():
            return self.coordinator.hass.config.latitude
        
        return float(self.coordinator.data.get("driver_location_lat"))

    @property
    def longitude(self) -> float | None:
        """Return longitude value of the driver, or home location if not tracking."""
        if not self._is_driver_tracking_active():
            return self.coordinator.hass.config.longitude
        
        return float(self.coordinator.data.get("driver_location_lon"))

    @property
    def location_name(self) -> str | None:
        """Return a location name for the driver."""
        if not self._is_driver_tracking_active():
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
            "tracking_active": self._is_driver_tracking_active(),
            "order_active": data.get("active", False),
            "driver_name": data.get("driver_name", "No Driver Assigned"),
            "restaurant_name": data.get("restaurant_name", "No Restaurant"),
            "order_stage": data.get("order_stage", "No Active Order"),
            "order_id": data.get("order_id", "No Active Order"),
            "eta": data.get("driver_eta_str", "No ETA"),
            "minutes_remaining": data.get("minutes_remaining"),
            "street": data.get("driver_location_street", "Unknown"),
            "suburb": data.get("driver_location_suburb", "Unknown"),
            "full_address": data.get("driver_location_address", "Unknown"),
            "account_name": self._account_name,
            "entry_id": self._entry_id,
        }

    @property
    def state(self) -> str | None:
        """Return the state of the tracker."""
        if not self._is_driver_tracking_active():
            return "home"
        
        # Return order stage as state when tracking
        stage = self.coordinator.data.get("order_stage", "unknown")
        return stage if stage != "No Active Order" else "home"

    @property
    def available(self) -> bool:
        """Return True if entity is available."""
        return self.coordinator.last_update_success
