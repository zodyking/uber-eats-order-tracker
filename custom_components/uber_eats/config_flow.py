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
    'Africa/Abidjan', 'Africa/Accra', 'Africa/Addis_Ababa', 'Africa/Algiers',
    'Africa/Cairo', 'Africa/Casablanca', 'Africa/Johannesburg', 'Africa/Lagos',
    'Africa/Nairobi', 'Africa/Tripoli', 'Africa/Windhoek', 'America/Anchorage',
    'America/Asuncion', 'America/Bogota', 'America/Buenos_Aires', 'America/Caracas',
    'America/Chicago', 'America/Costa_Rica', 'America/Denver', 'America/Detroit', 'America/Edmonton',
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
