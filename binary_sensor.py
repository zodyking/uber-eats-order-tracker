from .const import DOMAIN, CONF_ACCOUNT_NAME
from homeassistant.components.binary_sensor import BinarySensorEntity
from homeassistant.helpers.entity_registry import async_get as async_get_entity_reg

async def async_setup_entry(hass, config_entry, async_add_entities):
    coordinator = hass.data[DOMAIN][config_entry.entry_id]
    account_name = config_entry.data[CONF_ACCOUNT_NAME]
    entities = [UberEatsActiveOrder(coordinator, account_name)]
    async_add_entities(entities)
    # Apply label to the binary sensor
    entity_reg = async_get_entity_reg(hass)
    label_id = "uber_eats"
    for entity in entities:
        entity_id = entity.entity_id
        if entity_id:
            entity_reg.async_update_entity(entity_id, labels=[label_id])

class UberEatsActiveOrder(BinarySensorEntity):
    _attr_translation_key = "active_order"
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

    @property
    def is_on(self):
        return self.coordinator.data.get("active", False)