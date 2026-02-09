from __future__ import annotations

import re
from datetime import datetime, date
from typing import Any

from .const import DOMAIN, CONF_ACCOUNT_NAME
from homeassistant.components.sensor import SensorEntity
from homeassistant.helpers.entity_registry import async_get as async_get_entity_reg
from homeassistant.util import dt as dt_util

# ---------- Helpers ----------
def _format_short_time(value: Any) -> str | None:
    if value in (None, "", "No ETT Available"):
        return None
    ts: datetime | None = None
    if isinstance(value, datetime):
        ts = value if value.tzinfo else value.replace(tzinfo=dt_util.UTC)
    elif isinstance(value, date):
        ts = datetime(value.year, value.month, value.day, tzinfo=dt_util.UTC)
    elif isinstance(value, (int, float)):
        try:
            ts = datetime.fromtimestamp(float(value), tz=dt_util.UTC)
        except Exception:
            ts = None
    elif isinstance(value, str):
        v = value.strip()
        if v.isdigit():
            try:
                ts = datetime.fromtimestamp(float(v), tz=dt_util.UTC)
            except Exception:
                ts = None
        if ts is None:
            try:
                parsed = dt_util.parse_datetime(v)
                if parsed is not None:
                    ts = parsed if parsed.tzinfo else parsed.replace(tzinfo=dt_util.UTC)
            except Exception:
                ts = None
    if ts is None:
        return None
    local_dt = dt_util.as_local(ts)
    try:
        s = local_dt.strftime("%-I:%M%p")
    except ValueError:
        s = local_dt.strftime("%#I:%M%p")
    return s.lower()

# ---------- Setup ----------
async def async_setup_entry(hass, config_entry, async_add_entities):
    coordinator = hass.data[DOMAIN][config_entry.entry_id]
    account_name = config_entry.data[CONF_ACCOUNT_NAME]

    entities = [
        UberEatsOrderStage(coordinator, account_name),
        UberEatsOrderStatus(coordinator, account_name),
        UberEatsDriverName(coordinator, account_name),
        UberEatsDriverETA(coordinator, account_name),
        UberEatsOrderHistory(coordinator, account_name),
        UberEatsRestaurantName(coordinator, account_name),
        UberEatsOrderId(coordinator, account_name),
        UberEatsLatestArrival(coordinator, account_name),
        UberEatsDriverLatitude(coordinator, account_name),
        UberEatsDriverLongitude(coordinator, account_name),

        # Location component sensors (trimmed to match coordinator)
        UberEatsDriverLocationStreet(coordinator, account_name),
        UberEatsDriverLocationSuburb(coordinator, account_name),
        UberEatsDriverLocationQuarter(coordinator, account_name),
        UberEatsDriverLocationCounty(coordinator, account_name),
        UberEatsDriverLocationAddress(coordinator, account_name),

        UberEatsDriverETT(coordinator, account_name),
    ]

    async_add_entities(entities)

    entity_reg = async_get_entity_reg(hass)
    label_id = "uber_eats"
    for entity in entities:
        if entity.entity_id:
            entity_reg.async_update_entity(entity.entity_id, labels=[label_id])

# ---------- Base ----------
class UberEatsEntity(SensorEntity):
    _attr_has_entity_name = True

    def __init__(self, coordinator, account_name: str) -> None:
        self.coordinator = coordinator
        self._account_name = account_name.replace(" ", "_")
        self._attr_unique_id = f"uber_eats_{self._account_name}_{self.translation_key}"

    @property
    def available(self) -> bool:
        return self.coordinator.last_update_success

    async def async_update(self) -> None:
        await self.coordinator.async_request_refresh()

    @property
    def name(self) -> str:
        return f"{self._account_name} Uber Eats {self.translation_key.replace('_', ' ').title()}"

# ---------- Sensors ----------
class UberEatsOrderStage(UberEatsEntity):
    _attr_translation_key = "order_stage"
    @property
    def native_value(self) -> str:
        return self.coordinator.data.get("order_stage", "No Active Order")

class UberEatsOrderStatus(UberEatsEntity):
    _attr_translation_key = "order_status"
    @property
    def native_value(self) -> str:
        return self.coordinator.data.get("order_status", "No Active Order")

class UberEatsDriverName(UberEatsEntity):
    _attr_translation_key = "driver_name"
    @property
    def native_value(self) -> str:
        return self.coordinator.data.get("driver_name", "No Driver Assigned")

class UberEatsDriverETA(UberEatsEntity):
    _attr_translation_key = "driver_eta"
    @property
    def native_value(self) -> str:
        raw = self.coordinator.data.get("driver_eta")
        short = _format_short_time(raw)
        return short if short else "No ETT Available"
    @property
    def extra_state_attributes(self) -> dict:
        raw = self.coordinator.data.get("driver_eta")
        short = _format_short_time(raw)
        return {
            "raw_eta": raw,
            "eta_local": short,
            "minutes_remaining": self.coordinator.data.get("minutes_remaining", "No ETT Available"),
            "timezone": str(dt_util.DEFAULT_TIME_ZONE),
        }

class UberEatsOrderHistory(UberEatsEntity):
    _attr_translation_key = "order_history"
    @property
    def native_value(self) -> str:
        return "Order History" if getattr(self.coordinator, "_order_history", None) else "No History Available"
    @property
    def extra_state_attributes(self) -> dict:
        return {"history": getattr(self.coordinator, "_order_history", [])}

class UberEatsRestaurantName(UberEatsEntity):
    _attr_translation_key = "restaurant_name"
    @property
    def native_value(self) -> str:
        name = self.coordinator.data.get("restaurant_name", "No Restaurant") or "No Restaurant"
        return re.sub(r"[^a-zA-Z0-9\s]", "", name)

class UberEatsOrderId(UberEatsEntity):
    _attr_translation_key = "order_id"
    @property
    def native_value(self) -> str:
        return self.coordinator.data.get("order_id", "No Active Order")

class UberEatsLatestArrival(UberEatsEntity):
    _attr_translation_key = "latest_arrival"
    @property
    def native_value(self) -> str:
        return self.coordinator.data.get("latest_arrival", "No Latest Arrival")

class UberEatsDriverLatitude(UberEatsEntity):
    _attr_translation_key = "driver_latitude"
    _attr_native_unit_of_measurement = "°"
    @property
    def native_value(self) -> Any:
        return self.coordinator.data.get("driver_location_lat", "No Active Order")

class UberEatsDriverLongitude(UberEatsEntity):
    _attr_translation_key = "driver_longitude"
    _attr_native_unit_of_measurement = "°"
    @property
    def native_value(self) -> Any:
        return self.coordinator.data.get("driver_location_lon", "No Active Order")

# ---- Location sensors (trimmed to match coordinator) ----
class UberEatsDriverLocationStreet(UberEatsEntity):
    _attr_translation_key = "driver_location_street"
    @property
    def native_value(self) -> str:
        return self.coordinator.data.get("driver_location_street", "No Active Order")

class UberEatsDriverLocationSuburb(UberEatsEntity):
    _attr_translation_key = "driver_location_suburb"
    @property
    def native_value(self) -> str:
        return self.coordinator.data.get("driver_location_suburb", "Unknown")

class UberEatsDriverLocationQuarter(UberEatsEntity):
    _attr_translation_key = "driver_location_quarter"
    @property
    def native_value(self) -> str:
        return self.coordinator.data.get("driver_location_quarter", "Unknown")

class UberEatsDriverLocationCounty(UberEatsEntity):
    _attr_translation_key = "driver_location_county"
    @property
    def native_value(self) -> str:
        return self.coordinator.data.get("driver_location_county", "Unknown")

class UberEatsDriverLocationAddress(UberEatsEntity):
    _attr_translation_key = "driver_location_address"
    @property
    def native_value(self) -> str:
        return self.coordinator.data.get("driver_location_address", "Unknown")

class UberEatsDriverETT(UberEatsEntity):
    _attr_translation_key = "driver_ett"
    @property
    def native_value(self) -> str:
        minutes = self.coordinator.data.get("minutes_remaining", None)
        return f"{minutes} minutes" if isinstance(minutes, int) else "No ETT Available"
