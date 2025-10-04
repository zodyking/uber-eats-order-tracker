from .const import DOMAIN, CONF_ACCOUNT_NAME
from homeassistant.components.sensor import SensorEntity, SensorDeviceClass
from homeassistant.const import CONF_NAME

async def async_setup_entry(hass, config_entry, async_add_entities):
    coordinator = hass.data[DOMAIN][config_entry.entry_id]
    account_name = config_entry.data[CONF_ACCOUNT_NAME]
    async_add_entities([
        UberEatsOrderStage(coordinator, account_name),
        UberEatsOrderStatus(coordinator, account_name),
        UberEatsDriverName(coordinator, account_name),
        UberEatsDriverETA(coordinator, account_name),
        UberEatsOrderHistory(coordinator, account_name),
        UberEatsRestaurantName(coordinator, account_name),
        UberEatsOrderId(coordinator, account_name),
        UberEatsOrderStatusDescription(coordinator, account_name),
        UberEatsLatestArrival(coordinator, account_name),
        UberEatsDriverLatitude(coordinator, account_name),
        UberEatsDriverLongitude(coordinator, account_name),
        UberEatsDriverLocation(coordinator, account_name),
    ])

class UberEatsEntity(SensorEntity):
    _attr_has_entity_name = True
    def __init__(self, coordinator, account_name):
        self.coordinator = coordinator
        self._account_name = account_name.replace(" ", "_")
        self._attr_unique_id = f"uber_eats_{self._account_name}_{self.translation_key}"

    @property
    def available(self):
        return self.coordinator.last_update_success

    async def async_update(self):
        await self.coordinator.async_request_refresh()

    @property
    def name(self):
        return f"{self._account_name} Uber Eats {self.translation_key.replace('_', ' ').title()}"

class UberEatsOrderStage(UberEatsEntity):
    _attr_translation_key = "order_stage"
    @property
    def native_value(self):
        return self.coordinator.data.get("order_stage", "No Active Order")

class UberEatsOrderStatus(UberEatsEntity):
    _attr_translation_key = "order_status"
    @property
    def native_value(self):
        return self.coordinator.data.get("order_status", "No Active Order")

class UberEatsDriverName(UberEatsEntity):
    _attr_translation_key = "driver_name"
    @property
    def native_value(self):
        return self.coordinator.data.get("driver_name", "No Driver Assigned")

class UberEatsDriverETA(UberEatsEntity):
    _attr_device_class = SensorDeviceClass.TIMESTAMP
    _attr_translation_key = "driver_eta"
    @property
    def native_value(self):
        return self.coordinator.data.get("driver_eta", "No ETA Available")
    @property
    def extra_state_attributes(self):
        return {"minutes_remaining": self.coordinator.data.get("minutes_remaining", "No ETA Available")}

class UberEatsOrderHistory(UberEatsEntity):
    _attr_translation_key = "order_history"
    @property
    def native_value(self):
        return "Order History" if self.coordinator._order_history else "No History Available"
    @property
    def extra_state_attributes(self):
        return {"history": self.coordinator._order_history}

class UberEatsRestaurantName(UberEatsEntity):
    _attr_translation_key = "restaurant_name"
    @property
    def native_value(self):
        name = self.coordinator.data.get("restaurant_name", "No Restaurant")
        return name.replace(r'[^a-zA-Z0-9\s]', '')

class UberEatsOrderId(UberEatsEntity):
    _attr_translation_key = "order_id"
    @property
    def native_value(self):
        return self.coordinator.data.get("order_id", "No Active Order")

class UberEatsOrderStatusDescription(UberEatsEntity):
    _attr_translation_key = "order_status_description"
    @property
    def native_value(self):
        return self.coordinator.data.get("order_status_description", "No Active Order")

class UberEatsLatestArrival(UberEatsEntity):
    _attr_translation_key = "latest_arrival"
    @property
    def native_value(self):
        return self.coordinator.data.get("latest_arrival", "No Latest Arrival")

class UberEatsDriverLatitude(UberEatsEntity):
    _attr_translation_key = "driver_latitude"
    _attr_native_unit_of_measurement = "°"
    @property
    def native_value(self):
        return self.coordinator.data.get("driver_location_lat", "No Active Order")

class UberEatsDriverLongitude(UberEatsEntity):
    _attr_translation_key = "driver_longitude"
    _attr_native_unit_of_measurement = "°"
    @property
    def native_value(self):
        return self.coordinator.data.get("driver_location_lon", "No Active Order")

class UberEatsDriverLocation(UberEatsEntity):
    _attr_translation_key = "driver_location"
    @property
    def native_value(self):
        return self.coordinator.data.get("driver_location", "No Active Order")