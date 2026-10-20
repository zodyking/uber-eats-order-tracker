from __future__ import annotations

import logging
from typing import Any, Mapping

import aiohttp
import voluptuous as vol
from homeassistant import config_entries
from homeassistant.data_entry_flow import FlowResult

from .const import (
    DOMAIN,
    CONF_COOKIE,
    CONF_SID,
    CONF_SESSION_ID,
    CONF_FULL_COOKIE,
    CONF_ACCOUNT_NAME,
    CONF_TIME_ZONE,
    ENDPOINT,
    ENDPOINT_PAST_ORDERS,
    ENDPOINT_GET_USER,
    HEADERS_TEMPLATE,
)

_LOGGER = logging.getLogger(__name__)

# --- Time zone dropdown ---
TIME_ZONES = [
    # --- Africa ---
    'Africa/Abidjan', 'Africa/Accra', 'Africa/Addis_Ababa', 'Africa/Algiers',
    'Africa/Asmara', 'Africa/Bamako', 'Africa/Bangui', 'Africa/Banjul',
    'Africa/Bissau', 'Africa/Blantyre', 'Africa/Brazzaville', 'Africa/Bujumbura',
    'Africa/Cairo', 'Africa/Casablanca', 'Africa/Ceuta', 'Africa/Conakry',
    'Africa/Dakar', 'Africa/Dar_es_Salaam', 'Africa/Djibouti', 'Africa/Douala',
    'Africa/El_Aaiun', 'Africa/Freetown', 'Africa/Gaborone', 'Africa/Harare',
    'Africa/Johannesburg', 'Africa/Juba', 'Africa/Kampala', 'Africa/Khartoum',
    'Africa/Kigali', 'Africa/Kinshasa', 'Africa/Lagos', 'Africa/Libreville',
    'Africa/Lome', 'Africa/Luanda', 'Africa/Lubumbashi', 'Africa/Lusaka',
    'Africa/Malabo', 'Africa/Maputo', 'Africa/Maseru', 'Africa/Mbabane',
    'Africa/Mogadishu', 'Africa/Monrovia', 'Africa/Nairobi', 'Africa/Ndjamena',
    'Africa/Niamey', 'Africa/Nouakchott', 'Africa/Ouagadougou', 'Africa/Porto-Novo',
    'Africa/Sao_Tome', 'Africa/Tripoli', 'Africa/Tunis', 'Africa/Windhoek',

    # --- Americas ---
    'America/Adak', 'America/Anchorage', 'America/Anguilla', 'America/Antigua',
    'America/Araguaina', 'America/Argentina/Buenos_Aires', 'America/Argentina/Catamarca',
    'America/Argentina/Cordoba', 'America/Argentina/Jujuy', 'America/Argentina/La_Rioja',
    'America/Argentina/Mendoza', 'America/Argentina/Rio_Gallegos', 'America/Argentina/Salta',
    'America/Argentina/San_Juan', 'America/Argentina/San_Luis', 'America/Argentina/Tucuman',
    'America/Argentina/Ushuaia', 'America/Aruba', 'America/Asuncion', 'America/Atikokan',
    'America/Bahia', 'America/Bahia_Banderas', 'America/Barbados', 'America/Belem',
    'America/Belize', 'America/Blanc-Sablon', 'America/Boa_Vista', 'America/Bogota',
    'America/Boise', 'America/Buenos_Aires', 'America/Cambridge_Bay', 'America/Campo_Grande',
    'America/Cancun', 'America/Caracas', 'America/Cayenne', 'America/Cayman',
    'America/Chicago', 'America/Chihuahua', 'America/Ciudad_Juarez', 'America/Costa_Rica',
    'America/Creston', 'America/Cuiaba', 'America/Curacao', 'America/Danmarkshavn',
    'America/Dawson', 'America/Dawson_Creek', 'America/Denver', 'America/Detroit',
    'America/Dominica', 'America/Edmonton', 'America/Eirunepe', 'America/El_Salvador',
    'America/Fort_Nelson', 'America/Fortaleza', 'America/Glace_Bay', 'America/Goose_Bay',
    'America/Grand_Turk', 'America/Grenada', 'America/Guadeloupe', 'America/Guatemala',
    'America/Guayaquil', 'America/Guyana', 'America/Halifax', 'America/Havana',
    'America/Hermosillo', 'America/Indiana/Indianapolis', 'America/Indiana/Knox',
    'America/Indiana/Marengo', 'America/Indiana/Petersburg', 'America/Indiana/Tell_City',
    'America/Indiana/Vevay', 'America/Indiana/Vincennes', 'America/Indiana/Winamac',
    'America/Inuvik', 'America/Iqaluit', 'America/Jamaica', 'America/Juneau',
    'America/Kentucky/Louisville', 'America/Kentucky/Monticello', 'America/Kralendijk',
    'America/La_Paz', 'America/Lima', 'America/Los_Angeles', 'America/Lower_Princes',
    'America/Maceio', 'America/Managua', 'America/Manaus', 'America/Marigot',
    'America/Martinique', 'America/Matamoros', 'America/Mazatlan', 'America/Mendoza',
    'America/Menominee', 'America/Merida', 'America/Metlakatla', 'America/Mexico_City',
    'America/Miquelon', 'America/Moncton', 'America/Monterrey', 'America/Montevideo',
    'America/Montserrat', 'America/Nassau', 'America/New_York', 'America/Nipigon',
    'America/Nome', 'America/Noronha', 'America/North_Dakota/Beulah', 'America/North_Dakota/Center',
    'America/North_Dakota/New_Salem', 'America/Ojinaga', 'America/Panama', 'America/Pangnirtung',
    'America/Paramaribo', 'America/Phoenix', 'America/Port-au-Prince', 'America/Port_of_Spain',
    'America/Porto_Velho', 'America/Puerto_Rico', 'America/Punta_Arenas', 'America/Rainy_River',
    'America/Rankin_Inlet', 'America/Recife', 'America/Regina', 'America/Resolute',
    'America/Rio_Branco', 'America/Santarem', 'America/Santiago', 'America/Santo_Domingo',
    'America/Sao_Paulo', 'America/Scoresbysund', 'America/Sitka', 'America/St_Barthelemy',
    'America/St_Johns', 'America/St_Kitts', 'America/St_Lucia', 'America/St_Thomas',
    'America/St_Vincent', 'America/Swift_Current', 'America/Tegucigalpa', 'America/Thule',
    'America/Thunder_Bay', 'America/Tijuana', 'America/Toronto', 'America/Tortola',
    'America/Vancouver', 'America/Whitehorse', 'America/Winnipeg', 'America/Yakutat',
    'America/Yellowknife',

    # --- Antarctica ---
    'Antarctica/Casey', 'Antarctica/Davis', 'Antarctica/DumontDUrville',
    'Antarctica/Macquarie', 'Antarctica/Mawson', 'Antarctica/McMurdo',
    'Antarctica/Palmer', 'Antarctica/Rothera', 'Antarctica/Syowa',
    'Antarctica/Troll', 'Antarctica/Vostok',

    # --- Asia ---
    'Asia/Almaty', 'Asia/Amman', 'Asia/Anadyr', 'Asia/Aqtau', 'Asia/Aqtobe',
    'Asia/Ashgabat', 'Asia/Atyrau', 'Asia/Baghdad', 'Asia/Baku', 'Asia/Bangkok',
    'Asia/Barnaul', 'Asia/Beirut', 'Asia/Bishkek', 'Asia/Brunei', 'Asia/Calcutta',
    'Asia/Chita', 'Asia/Choibalsan', 'Asia/Colombo', 'Asia/Damascus', 'Asia/Dhaka',
    'Asia/Dili', 'Asia/Dubai', 'Asia/Dushanbe', 'Asia/Famagusta', 'Asia/Gaza',
    'Asia/Hebron', 'Asia/Ho_Chi_Minh', 'Asia/Hong_Kong', 'Asia/Hovd', 'Asia/Irkutsk',
    'Asia/Jakarta', 'Asia/Jayapura', 'Asia/Jerusalem', 'Asia/Kabul', 'Asia/Kamchatka',
    'Asia/Karachi', 'Asia/Kashgar', 'Asia/Katmandu', 'Asia/Khandyga', 'Asia/Kolkata',
    'Asia/Krasnoyarsk', 'Asia/Kuala_Lumpur', 'Asia/Kuching', 'Asia/Kuwait', 'Asia/Macau',
    'Asia/Magadan', 'Asia/Makassar', 'Asia/Manila', 'Asia/Muscat', 'Asia/Nicosia',
    'Asia/Novokuznetsk', 'Asia/Novosibirsk', 'Asia/Omsk', 'Asia/Oral', 'Asia/Phnom_Penh',
    'Asia/Pontianak', 'Asia/Pyongyang', 'Asia/Qatar', 'Asia/Qostanay', 'Asia/Qyzylorda',
    'Asia/Riyadh', 'Asia/Sakhalin', 'Asia/Samarkand', 'Asia/Seoul', 'Asia/Shanghai',
    'Asia/Singapore', 'Asia/Srednekolymsk', 'Asia/Taipei', 'Asia/Tashkent', 'Asia/Tbilisi',
    'Asia/Tehran', 'Asia/Thimphu', 'Asia/Tokyo', 'Asia/Tomsk', 'Asia/Ulaanbaatar',
    'Asia/Urumqi', 'Asia/Ust-Nera', 'Asia/Vientiane', 'Asia/Vladivostok', 'Asia/Yakutsk',
    'Asia/Yangon', 'Asia/Yekaterinburg', 'Asia/Yerevan',

    # --- Atlantic ---
    'Atlantic/Azores', 'Atlantic/Bermuda', 'Atlantic/Canary', 'Atlantic/Cape_Verde',
    'Atlantic/Faroe', 'Atlantic/Madeira', 'Atlantic/Reykjavik', 'Atlantic/South_Georgia',
    'Atlantic/St_Helena', 'Atlantic/Stanley',

    # --- Australia ---
    'Australia/Adelaide', 'Australia/Brisbane', 'Australia/Broken_Hill', 'Australia/Darwin',
    'Australia/Eucla', 'Australia/Hobart', 'Australia/Lindeman', 'Australia/Lord_Howe',
    'Australia/Melbourne', 'Australia/Perth', 'Australia/Sydney',

    # --- Europe ---
    'Europe/Amsterdam', 'Europe/Andorra', 'Europe/Astrakhan', 'Europe/Athens',
    'Europe/Belgrade', 'Europe/Berlin', 'Europe/Bratislava', 'Europe/Brussels',
    'Europe/Bucharest', 'Europe/Budapest', 'Europe/Busingen', 'Europe/Chisinau',
    'Europe/Copenhagen', 'Europe/Dublin', 'Europe/Gibraltar', 'Europe/Guernsey',
    'Europe/Helsinki', 'Europe/Isle_of_Man', 'Europe/Istanbul', 'Europe/Jersey',
    'Europe/Kaliningrad', 'Europe/Kiev', 'Europe/Kirov', 'Europe/Kyiv', 'Europe/Lisbon',
    'Europe/Ljubljana', 'Europe/London', 'Europe/Luxembourg', 'Europe/Madrid',
    'Europe/Malta', 'Europe/Mariehamn', 'Europe/Minsk', 'Europe/Monaco', 'Europe/Moscow',
    'Europe/Nicosia', 'Europe/Oslo', 'Europe/Paris', 'Europe/Podgorica', 'Europe/Prague',
    'Europe/Riga', 'Europe/Rome', 'Europe/Samara', 'Europe/San_Marino', 'Europe/Sarajevo',
    'Europe/Saratov', 'Europe/Simferopol', 'Europe/Skopje', 'Europe/Sofia', 'Europe/Stockholm',
    'Europe/Tallinn', 'Europe/Tirane', 'Europe/Ulyanovsk', 'Europe/Uzhgorod', 'Europe/Vaduz',
    'Europe/Vatican', 'Europe/Vienna', 'Europe/Vilnius', 'Europe/Volgograd', 'Europe/Warsaw',
    'Europe/Zagreb', 'Europe/Zaporozhye', 'Europe/Zurich',

    # --- Indian Ocean ---
    'Indian/Antananarivo', 'Indian/Chagos', 'Indian/Christmas', 'Indian/Cocos',
    'Indian/Comoro', 'Indian/Kerguelen', 'Indian/Mahe', 'Indian/Maldives',
    'Indian/Mauritius', 'Indian/Mayotte', 'Indian/Reunion',

    # --- Pacific ---
    'Pacific/Apia', 'Pacific/Auckland', 'Pacific/Bougainville', 'Pacific/Chatham',
    'Pacific/Chuuk', 'Pacific/Easter', 'Pacific/Efate', 'Pacific/Fakaofo',
    'Pacific/Fiji', 'Pacific/Funafuti', 'Pacific/Galapagos', 'Pacific/Gambier',
    'Pacific/Guadalcanal', 'Pacific/Guam', 'Pacific/Honolulu', 'Pacific/Kanton',
    'Pacific/Kiritimati', 'Pacific/Kosrae', 'Pacific/Kwajalein', 'Pacific/Majuro',
    'Pacific/Marquesas', 'Pacific/Midway', 'Pacific/Nauru', 'Pacific/Niue',
    'Pacific/Norfolk', 'Pacific/Noumea', 'Pacific/Pago_Pago', 'Pacific/Palau',
    'Pacific/Pitcairn', 'Pacific/Pohnpei', 'Pacific/Port_Moresby', 'Pacific/Rarotonga',
    'Pacific/Saipan', 'Pacific/Tahiti', 'Pacific/Tarawa', 'Pacific/Tongatapu',
    'Pacific/Wake', 'Pacific/Wallis',

    # --- Standard / UTC ---
    'UTC'
]


def _parse_cookie_string(cookie_string: str) -> dict[str, str | None]:
    """
    Parse a full cookie string and extract sid and uev2.id.session.
    
    Returns dict with 'sid' and 'session_id' keys (None if not found).
    """
    result = {"sid": None, "session_id": None}
    
    if not cookie_string:
        return result
    
    # Split by '; ' to get individual cookies
    cookies = cookie_string.split("; ")
    
    for cookie in cookies:
        if "=" in cookie:
            key, _, value = cookie.partition("=")
            key = key.strip()
            value = value.strip()
            
            if key == "sid":
                result["sid"] = value
            elif key == "uev2.id.session":
                result["session_id"] = value
    
    return result


def _validate_cookie_string(cookie_string: str) -> tuple[str | None, dict[str, str]]:
    """
    Validate cookie string and return parsed values.
    
    Returns:
        (error_key, parsed_values) - error_key is None if valid
    """
    if not cookie_string or len(cookie_string) < 50:
        return ("cookie_too_short", {})
    
    parsed = _parse_cookie_string(cookie_string)
    
    if not parsed["sid"]:
        return ("sid_not_found", {})
    
    if not parsed["sid"].startswith("QA."):
        return ("invalid_sid", {})
    
    if not parsed["session_id"]:
        return ("session_not_found", {})
    
    if "-" not in parsed["session_id"]:
        return ("invalid_session", {})
    
    return (None, parsed)


def _get_locale_code(tz: str) -> str:
    """Get locale code from timezone."""
    if tz.startswith("America/"):
        return "us"
    if tz.startswith("Australia/"):
        return "au"
    return "us"


async def _fetch_user_profile(full_cookie: str, time_zone: str) -> dict[str, str] | None:
    """Fetch user profile from getUserV1 API.
    
    Returns dict with 'first_name' and 'last_name' on success, None on failure.
    """
    try:
        async with aiohttp.ClientSession() as session:
            locale_code = _get_locale_code(time_zone)
            url = f"{ENDPOINT_GET_USER}?localeCode={locale_code}"
            headers = HEADERS_TEMPLATE.copy()
            headers["Cookie"] = full_cookie
            
            async with session.post(url, json={}, headers=headers) as resp:
                if resp.status != 200:
                    _LOGGER.debug("getUserV1 returned status %s", resp.status)
                    return None
                data = await resp.json()
                user_data = data.get("data", {})
                if not user_data.get("isLoggedIn"):
                    return None
                return {
                    "first_name": user_data.get("firstName", ""),
                    "last_name": user_data.get("lastName", ""),
                }
    except Exception as e:
        _LOGGER.debug("User profile fetch error: %s", e)
        return None


async def _validate_credentials(hass, sid: str, session_id: str, time_zone: str) -> bool:
    """Validate credentials by making test API calls to both endpoints. Returns True if valid."""
    try:
        async with aiohttp.ClientSession() as session:
            locale_code = _get_locale_code(time_zone)
            headers = HEADERS_TEMPLATE.copy()
            headers["Cookie"] = f"sid={sid}; uev2.id.session={session_id}"
            
            # Test 1: getActiveOrdersV1
            url_active = f"{ENDPOINT}?localeCode={locale_code}"
            payload_active = {"orderUuid": None, "timezone": time_zone, "showAppUpsellIllustration": True}
            
            async with session.post(url_active, json=payload_active, headers=headers) as resp:
                if resp.status != 200:
                    _LOGGER.debug("getActiveOrdersV1 returned status %s", resp.status)
                    return False
                data = await resp.json()
                if "data" not in data:
                    return False
            
            # Test 2: getPastOrdersV1
            url_past = f"{ENDPOINT_PAST_ORDERS}?localeCode={locale_code}"
            payload_past = {"lastWorkflowUUID": ""}
            
            async with session.post(url_past, json=payload_past, headers=headers) as resp:
                if resp.status != 200:
                    _LOGGER.debug("getPastOrdersV1 returned status %s", resp.status)
                    return False
                data = await resp.json()
                if "data" not in data:
                    return False
            
            return True
    except Exception as e:
        _LOGGER.debug("Credential validation error: %s", e)
        return False


class UberEatsConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 2  # Bumped for new config schema

    async def async_step_user(self, user_input=None) -> FlowResult:
        """Handle initial setup."""
        errors: dict[str, str] = {}
        ha_tz = self.hass.config.time_zone or "UTC"

        if user_input:
            cookie_string = user_input.get(CONF_COOKIE, "").strip()
            tz_selected = user_input.get(CONF_TIME_ZONE, ha_tz)

            # Validate timezone
            if tz_selected != ha_tz:
                errors[CONF_TIME_ZONE] = "invalid_time_zone"

            # Validate and parse cookie string
            cookie_err, parsed = _validate_cookie_string(cookie_string)
            if cookie_err:
                errors[CONF_COOKIE] = cookie_err

            # If fields pass, try a live refresh to validate creds
            if not errors:
                try:
                    is_valid = await _validate_credentials(
                        self.hass,
                        parsed["sid"],
                        parsed["session_id"],
                        ha_tz
                    )
                    if not is_valid:
                        errors["base"] = "invalid_credentials"
                    else:
                        # Fetch user profile to get account name
                        user_profile = await _fetch_user_profile(cookie_string, ha_tz)
                        if not user_profile:
                            errors["base"] = "invalid_credentials"
                        else:
                            first_name = user_profile.get("first_name", "")
                            last_name = user_profile.get("last_name", "")
                            account_name = f"{first_name} {last_name}".strip() or "Uber Eats Account"
                            
                            # Store parsed values and full cookie for APIs that need it
                            return self.async_create_entry(
                                title=account_name,
                                data={
                                    CONF_SID: parsed["sid"],
                                    CONF_SESSION_ID: parsed["session_id"],
                                    CONF_FULL_COOKIE: cookie_string,
                                    CONF_ACCOUNT_NAME: account_name,
                                    CONF_TIME_ZONE: ha_tz,
                                },
                            )
                except Exception as e:
                    _LOGGER.exception("Error during integration setup: %s", e)
                    errors["base"] = "unknown_error"

        schema = vol.Schema(
            {
                vol.Required(CONF_TIME_ZONE, default=ha_tz): vol.In(TIME_ZONES),
                vol.Required(CONF_COOKIE): str,
            }
        )

        return self.async_show_form(
            step_id="user",
            data_schema=schema,
            errors=errors,
        )

    async def async_step_reconfigure(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Handle reconfiguration of existing entry."""
        errors: dict[str, str] = {}
        entry = self.hass.config_entries.async_get_entry(self.context["entry_id"])

        if user_input is not None:
            cookie_string = user_input.get(CONF_COOKIE, "").strip()

            # Validate and parse cookie string
            cookie_err, parsed = _validate_cookie_string(cookie_string)
            if cookie_err:
                errors[CONF_COOKIE] = cookie_err

            if not errors:
                is_valid = await _validate_credentials(
                    self.hass,
                    parsed["sid"],
                    parsed["session_id"],
                    entry.data[CONF_TIME_ZONE]
                )
                if is_valid:
                    return self.async_update_reload_and_abort(
                        entry,
                        data={
                            **entry.data,
                            CONF_SID: parsed["sid"],
                            CONF_SESSION_ID: parsed["session_id"],
                            CONF_FULL_COOKIE: cookie_string,
                        },
                    )
                errors["base"] = "invalid_credentials"

        return self.async_show_form(
            step_id="reconfigure",
            data_schema=vol.Schema({
                vol.Required(CONF_COOKIE): str,
            }),
            errors=errors,
            description_placeholders={
                "account_name": entry.data[CONF_ACCOUNT_NAME]
            },
        )

    async def async_step_reauth(
        self, entry_data: Mapping[str, Any]
    ) -> FlowResult:
        """Handle reauthentication request."""
        return await self.async_step_reauth_confirm()

    async def async_step_reauth_confirm(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Confirm reauthentication with new credentials."""
        errors: dict[str, str] = {}
        entry = self.hass.config_entries.async_get_entry(self.context["entry_id"])

        if user_input is not None:
            cookie_string = user_input.get(CONF_COOKIE, "").strip()

            # Validate and parse cookie string
            cookie_err, parsed = _validate_cookie_string(cookie_string)
            if cookie_err:
                errors[CONF_COOKIE] = cookie_err

            if not errors:
                is_valid = await _validate_credentials(
                    self.hass,
                    parsed["sid"],
                    parsed["session_id"],
                    entry.data[CONF_TIME_ZONE]
                )
                if is_valid:
                    return self.async_update_reload_and_abort(
                        entry,
                        data={
                            **entry.data,
                            CONF_SID: parsed["sid"],
                            CONF_SESSION_ID: parsed["session_id"],
                            CONF_FULL_COOKIE: cookie_string,
                        },
                    )
                errors["base"] = "invalid_credentials"

        return self.async_show_form(
            step_id="reauth_confirm",
            data_schema=vol.Schema({
                vol.Required(CONF_COOKIE): str,
            }),
            errors=errors,
            description_placeholders={
                "account_name": entry.data[CONF_ACCOUNT_NAME]
            },
        )
