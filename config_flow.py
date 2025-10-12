from __future__ import annotations

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.data_entry_flow import FlowResult

from .coordinator import UberEatsCoordinator
from .const import DOMAIN, CONF_SID, CONF_UUID, CONF_ACCOUNT_NAME, CONF_TIME_ZONE

# --- SAME dropdown as your existing file ---
TIME_ZONES = [
    'Africa/Abidjan', 'Africa/Accra', 'Africa/Addis_Ababa', 'Africa/Algiers',
    'Africa/Cairo', 'Africa/Casablanca', 'Africa/Johannesburg', 'Africa/Lagos',
    'Africa/Nairobi', 'Africa/Tripoli', 'Africa/Windhoek', 'America/Anchorage',
    'America/Asuncion', 'America/Bogota', 'America/Buenos_Aires', 'America/Caracas',
    'America/Chicago', 'America/Denver', 'America/Detroit', 'America/Edmonton',
    'America/Guatemala', 'America/Halifax', 'America/Havana', 'America/Lima',
    'America/Los_Angeles', 'America/Mexico_City', 'America/Montevideo',
    'America/New_York', 'America/Noronha', 'America/Panama', 'America/Phoenix',
    'America/Port-au-Prince', 'America/Puerto_Rico', 'America/Santiago',
    'America/Sao_Paulo', 'America/Tegucigalpa', 'America/Tijuana', 'America/Toronto',
    'America/Vancouver', 'America/Winnipeg', 'Asia/Almaty', 'Asia/Amman',
    'Asia/Baghdad', 'Asia/Baku', 'Asia/Bangkok', 'Asia/Beirut', 'Asia/Calcutta',
    'Asia/Damascus', 'Asia/Dhaka', 'Asia/Dubai', 'Asia/Hong_Kong', 'Asia/Irkutsk',
    'Asia/Jakarta', 'Asia/Jerusalem', 'Asia/Kabul', 'Asia/Karachi', 'Asia/Katmandu',
    'Asia/Kolkata', 'Asia/Krasnoyarsk', 'Asia/Kuala_Lumpur', 'Asia/Kuwait',
    'Asia/Manila', 'Asia/Muscat', 'Asia/Nicosia', 'Asia/Novosibirsk', 'Asia/Omsk',
    'Asia/Qatar', 'Asia/Riyadh', 'Asia/Seoul', 'Asia/Shanghai', 'Asia/Singapore',
    'Asia/Taipei', 'Asia/Tehran', 'Asia/Tokyo', 'Asia/Ulaanbaatar', 'Asia/Vladivostok',
    'Asia/Yakutsk', 'Asia/Yekaterinburg', 'Asia/Yerevan', 'Atlantic/Azores',
    'Atlantic/Bermuda', 'Atlantic/Cape_Verde', 'Atlantic/Reykjavik',
    'Australia/Adelaide', 'Australia/Brisbane', 'Australia/Darwin', 'Australia/Hobart',
    'Australia/Melbourne', 'Australia/Perth', 'Australia/Sydney', 'Europe/Amsterdam',
    'Europe/Athens', 'Europe/Berlin', 'Europe/Brussels', 'Europe/Bucharest',
    'Europe/Budapest', 'Europe/Chisinau', 'Europe/Copenhagen', 'Europe/Dublin',
    'Europe/Helsinki', 'Europe/Istanbul', 'Europe/Kaliningrad', 'Europe/Kiev',
    'Europe/Lisbon', 'Europe/London', 'Europe/Madrid', 'Europe/Minsk', 'Europe/Moscow',
    'Europe/Paris', 'Europe/Prague', 'Europe/Riga', 'Europe/Rome', 'Europe/Sofia',
    'Europe/Stockholm', 'Europe/Tallinn', 'Europe/Tirane', 'Europe/Vienna',
    'Europe/Vilnius', 'Europe/Warsaw', 'Pacific/Auckland', 'Pacific/Fiji',
    'Pacific/Guam', 'Pacific/Honolulu', 'Pacific/Port_Moresby', 'Pacific/Tongatapu',
    'UTC'
]

def _validate_sid(sid: str) -> str | None:
    """Return an error key if invalid, else None."""
    if not isinstance(sid, str) or not sid or len(sid) < 30:
        return "entry_too_short"
    if not sid.startswith("QA."):
        return "must_start_with_qa"
    return None

def _validate_uuid(uuid: str) -> str | None:
    """Return an error key if invalid, else None."""
    if not isinstance(uuid, str) or not uuid or len(uuid) < 20:
        return "entry_too_short"
    if "-" not in uuid:
        return "must_include_dash"
    return None

class UberEatsConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None) -> FlowResult:
        errors: dict[str, str] = {}
        ha_tz = self.hass.config.time_zone or "UTC"

        if user_input:
            sid = user_input.get(CONF_SID, "").strip()
            uuid = user_input.get(CONF_UUID, "").strip()
            account_name = user_input.get(CONF_ACCOUNT_NAME, "").strip()
            tz_selected = user_input.get(CONF_TIME_ZONE, ha_tz)

            # --- Validations ---
            sid_err = _validate_sid(sid)
            if sid_err:
                errors[CONF_SID] = sid_err

            uuid_err = _validate_uuid(uuid)
            if uuid_err:
                errors[CONF_UUID] = uuid_err

            if not account_name:
                errors[CONF_ACCOUNT_NAME] = "entry_too_short"

            # Keep dropdown, but require it equals HA's timezone
            if tz_selected != ha_tz:
                errors[CONF_TIME_ZONE] = "invalid_time_zone"

            # If fields pass, try a live refresh to validate creds
            if not errors:
                coordinator = UberEatsCoordinator(
                    self.hass,
                    sid=sid,
                    uuid=uuid,
                    account_name=account_name,
                    time_zone=ha_tz,  # always store HA TZ
                )
                await coordinator.async_config_entry_first_refresh()
                if not coordinator.last_update_success:
                    errors["base"] = "invalid_credentials"
                else:
                    return self.async_create_entry(
                        title=account_name,
                        data={
                            CONF_SID: sid,
                            CONF_UUID: uuid,
                            CONF_ACCOUNT_NAME: account_name,
                            CONF_TIME_ZONE: ha_tz,
                        },
                    )

        # Schema with the full dropdown; default = HA timezone
        schema = vol.Schema(
            {
                vol.Required(CONF_SID): str,
                vol.Required(CONF_UUID): str,
                vol.Required(CONF_ACCOUNT_NAME): str,
                vol.Required(CONF_TIME_ZONE, default=ha_tz): vol.In(TIME_ZONES),
            }
        )

        # A clear, per-field explainer (title + description)
        desc = (
            "**SID** — Session ID from ubereats.com cookies. Must be ≥30 chars and start with `QA.`\n"
            "**UUID** — User UUID from cookies/headers. Must be ≥20 chars and include `-`.\n"
            "**Account name** — Just a nickname (e.g., `Personal`, `Work`).\n"
            f"**Time zone** — Select **{ha_tz}** (locked to your Home Assistant time zone; others will be rejected)."
        )

        return self.async_show_form(
            step_id="user",
            data_schema=schema,
            description_placeholders={
                "field_help": desc,
            },
            errors=errors,
        )
