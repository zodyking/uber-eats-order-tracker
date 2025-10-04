import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResult
from .coordinator import UberEatsCoordinator
from .const import DOMAIN, CONF_SID, CONF_UUID, CONF_ACCOUNT_NAME, CONF_TIME_ZONE

TIME_ZONES = [
    'Africa/Abidjan', 'Africa/Accra', 'Africa/Addis_Ababa', 'Africa/Algiers', 'Africa/Cairo', 'Africa/Casablanca', 'Africa/Johannesburg', 'Africa/Lagos', 'Africa/Nairobi', 'Africa/Tripoli', 'Africa/Windhoek', 'America/Anchorage', 'America/Asuncion', 'America/Bogota', 'America/Buenos_Aires', 'America/Caracas', 'America/Chicago', 'America/Denver', 'America/Detroit', 'America/Edmonton', 'America/Guatemala', 'America/Halifax', 'America/Havana', 'America/Lima', 'America/Los_Angeles', 'America/Mexico_City', 'America/Montevideo', 'America/New_York', 'America/Noronha', 'America/Panama', 'America/Phoenix', 'America/Port-au-Prince', 'America/Puerto_Rico', 'America/Santiago', 'America/Sao_Paulo', 'America/Tegucigalpa', 'America/Tijuana', 'America/Toronto', 'America/Vancouver', 'America/Winnipeg', 'Asia/Almaty', 'Asia/Amman', 'Asia/Baghdad', 'Asia/Baku', 'Asia/Bangkok', 'Asia/Beirut', 'Asia/Calcutta', 'Asia/Damascus', 'Asia/Dhaka', 'Asia/Dubai', 'Asia/Hong_Kong', 'Asia/Irkutsk', 'Asia/Jakarta', 'Asia/Jerusalem', 'Asia/Kabul', 'Asia/Karachi', 'Asia/Katmandu', 'Asia/Kolkata', 'Asia/Krasnoyarsk', 'Asia/Kuala_Lumpur', 'Asia/Kuwait', 'Asia/Manila', 'Asia/Muscat', 'Asia/Nicosia', 'Asia/Novosibirsk', 'Asia/Omsk', 'Asia/Qatar', 'Asia/Riyadh', 'Asia/Seoul', 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Taipei', 'Asia/Tehran', 'Asia/Tokyo', 'Asia/Ulaanbaatar', 'Asia/Vladivostok', 'Asia/Yakutsk', 'Asia/Yekaterinburg', 'Asia/Yerevan', 'Atlantic/Azores', 'Atlantic/Bermuda', 'Atlantic/Cape_Verde', 'Atlantic/Reykjavik', 'Australia/Adelaide', 'Australia/Brisbane', 'Australia/Darwin', 'Australia/Hobart', 'Australia/Melbourne', 'Australia/Perth', 'Australia/Sydney', 'Europe/Amsterdam', 'Europe/Athens', 'Europe/Berlin', 'Europe/Brussels', 'Europe/Bucharest', 'Europe/Budapest', 'Europe/Chisinau', 'Europe/Copenhagen', 'Europe/Dublin', 'Europe/Helsinki', 'Europe/Istanbul', 'Europe/Kaliningrad', 'Europe/Kiev', 'Europe/Lisbon', 'Europe/London', 'Europe/Madrid', 'Europe/Minsk', 'Europe/Moscow', 'Europe/Paris', 'Europe/Prague', 'Europe/Riga', 'Europe/Rome', 'Europe/Sofia', 'Europe/Stockholm', 'Europe/Tallinn', 'Europe/Tirane', 'Europe/Vienna', 'Europe/Vilnius', 'Europe/Warsaw', 'Pacific/Auckland', 'Pacific/Fiji', 'Pacific/Guam', 'Pacific/Honolulu', 'Pacific/Port_Moresby', 'Pacific/Tongatapu', 'UTC'
]  # Abbreviated list; expand with all if needed

class UberEatsConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        errors = {}
        if user_input:
            sid = user_input[CONF_SID]
            uuid = user_input[CONF_UUID]
            account_name = user_input[CONF_ACCOUNT_NAME]
            time_zone = user_input[CONF_TIME_ZONE]
            if not sid or not uuid or not account_name or not time_zone:
                errors["base"] = "required_fields_missing"
            else:
                coordinator = UberEatsCoordinator(self.hass, sid=sid, uuid=uuid, account_name=account_name, time_zone=time_zone)
                await coordinator.async_config_entry_first_refresh()
                if not coordinator.last_update_success:
                    errors["base"] = "invalid_credentials"
                else:
                    return self.async_create_entry(
                        title=account_name,
                        data={CONF_SID: sid, CONF_UUID: uuid, CONF_ACCOUNT_NAME: account_name, CONF_TIME_ZONE: time_zone}
                    )

        schema = vol.Schema({
            vol.Required(CONF_SID): str,
            vol.Required(CONF_UUID): str,
            vol.Required(CONF_ACCOUNT_NAME): str,
            vol.Required(CONF_TIME_ZONE): vol.In(TIME_ZONES)
        })
        return self.async_show_form(
            step_id="user",
            data_schema=schema,
            description_placeholders={
                "instructions": (
                    "1. Log into ubereats.com in a browser.\n"
                    "2. Open Dev Tools (F12) > Application > Cookies > https://www.ubereats.com > Copy the 'sid' value.\n"
                    "3. Find 'uuid' in cookies (e.g., jwt-session) or other headers, decode if needed.\n"
                    "4. Enter a unique account name (e.g., 'Personal' or 'Work') to identify this account.\n"
                    "5. Select your time zone from the dropdown (used for API requests).\n"
                    "Paste SID, UUID, account name, and select time zone below."
                )
            },
            errors=errors
        )