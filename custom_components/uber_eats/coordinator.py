import aiohttp
import logging
from datetime import datetime, timedelta
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator
from homeassistant.exceptions import ConfigEntryAuthFailed
from homeassistant.util import dt as dt_util

from .const import (
    ENDPOINT,
    HEADERS_TEMPLATE,
    CONF_TTS_ENABLED,
    CONF_TTS_ENTITY_ID,
    CONF_TTS_MEDIA_PLAYERS,
    CONF_TTS_MESSAGE_PREFIX,
    CONF_TTS_VOLUME,
    CONF_TTS_INTERVAL_ENABLED,
    CONF_TTS_INTERVAL_MINUTES,
    CONF_DRIVER_NEARBY_AUTOMATION_ENABLED,
    CONF_DRIVER_NEARBY_AUTOMATION_ENTITY,
    CONF_DRIVER_NEARBY_DISTANCE_FEET,
    DEFAULT_TTS_MESSAGE_PREFIX,
    DEFAULT_DRIVER_NEARBY_DISTANCE_FEET,
    DEFAULT_TTS_VOLUME,
    DEFAULT_TTS_INTERVAL_MINUTES,
)

_LOGGER = logging.getLogger(__name__)


def _no_driver(driver_name):
    return driver_name in ("No Driver Assigned", "Unknown", None, "")


def _has_driver(driver_name):
    return not _no_driver(driver_name)


class UberEatsCoordinator(DataUpdateCoordinator):
    def __init__(self, hass, entry_id, sid, session_id, account_name, time_zone):
        self.entry_id = entry_id
        self.sid = sid
        self.session_id = session_id  # Renamed from uuid
        self.account_name = account_name
        self.time_zone = time_zone
        self.hass = hass
        self._order_history = []  # Per-account history
        self._previous_data = None  # Set on first update
        self._last_interval_tts_time = None  # For interval TTS when driver assigned
        self._last_driver_nearby_triggered = False  # For 200 ft automation trigger
        super().__init__(
            hass,
            _LOGGER,
            name=f"Uber Eats Orders - {account_name}",
            update_interval=timedelta(seconds=15),
        )

    async def _async_update_data(self):
        async with aiohttp.ClientSession() as session:
            locale_code = self._get_locale_code(self.time_zone)
            url = f"{ENDPOINT}?localeCode={locale_code}"
            headers = HEADERS_TEMPLATE.copy()
            headers["Cookie"] = f"sid={self.sid}; uev2.id.session={self.session_id}"
            payload = {"orderUuid": None, "timezone": self.time_zone, "showAppUpsellIllustration": True}
            try:
                async with session.post(url, json=payload, headers=headers) as resp:
                    _LOGGER.debug("API response status: %s", resp.status)
                    
                    # Detect authentication failure (401/403)
                    if resp.status in (401, 403):
                        raise ConfigEntryAuthFailed(
                            "Session expired. Please reconfigure with new cookies."
                        )
                    
                    if resp.status != 200:
                        _LOGGER.warning(
                            "API returned status %s - may indicate auth issue",
                            resp.status
                        )
                        return self._default_data()

                    data = await resp.json()
                    
                    # Check for auth errors in response body
                    if "error" in data:
                        error_code = data.get("error", {}).get("code", "")
                        if error_code in ("UNAUTHORIZED", "SESSION_EXPIRED", "INVALID_TOKEN"):
                            raise ConfigEntryAuthFailed(
                                f"Authentication error: {error_code}"
                            )
                    
                    orders = data.get("data", {}).get("orders", [])
                    current_data = self._default_data()

                    if orders:
                        order = orders[0]
                        feed_cards = order.get("feedCards", [])
                        contacts = order.get("contacts", [])
                        active_overview = order.get("activeOrderOverview", {})
                        background_feed_cards = order.get("backgroundFeedCards", [])
                        order_info = order.get("orderInfo", {})

                        # Extract map entities (EATER=home, STORE=restaurant, COURIER=driver)
                        map_entities = self._get_map_entities(background_feed_cards)
                        store_loc = order_info.get("storeInfo", {}).get("location", {})
                        store_lat = store_loc.get("latitude")
                        store_lon = store_loc.get("longitude")
                        if store_lat is not None and store_lon is not None and "STORE" not in map_entities:
                            map_entities["STORE"] = {"lat": float(store_lat), "lon": float(store_lon)}

                        eater = map_entities.get("EATER", {})
                        store = map_entities.get("STORE", {})
                        courier = map_entities.get("COURIER", {})

                        lat = courier.get("lat") or store.get("lat") or eater.get("lat")
                        lon = courier.get("lon") or store.get("lon") or eater.get("lon")

                        # Reverse geocode remaining components (or use defaults)
                        if lat and lon:
                            loc = await self._reverse_geocode(lat, lon, session)
                        else:
                            loc = {}

                        map_url = self._get_map_url(lat, lon) if lat and lon else "No Map Available"
                        driver_eta_title = feed_cards[0].get("status", {}).get("title", "Unknown") if feed_cards else "Unknown"

                        # Full timeline text: prefer timelineSummary; when empty, use titleSummary.summary.text (e.g. "Picking up your order…")
                        status_obj = feed_cards[0].get("status", {}) if feed_cards else {}
                        timeline_summary = status_obj.get("timelineSummary", "") or ""
                        if isinstance(timeline_summary, dict):
                            timeline_summary = timeline_summary.get("text", "") or ""
                        if not timeline_summary or timeline_summary.strip() == "":
                            title_summary = status_obj.get("titleSummary", {}).get("summary", {})
                            timeline_summary = title_summary.get("text", "") or ""
                        order_status_text = (timeline_summary or "Unknown").strip() or "Unknown"

                        # Driver picture and phone
                        driver_picture_url = None
                        for fc in feed_cards:
                            if fc.get("type") == "courier" and fc.get("courier"):
                                driver_picture_url = fc["courier"][0].get("iconUrl") or None
                                break
                        courier_contact = next((c for c in contacts if c.get("type") == "COURIER"), contacts[0] if contacts else {})
                        driver_phone_formatted = courier_contact.get("formattedPhoneNumber") or courier_contact.get("phoneNumber") or ""

                        # User (customer) picture
                        user_picture_url = None
                        customer_infos = order_info.get("customerInfos") or []
                        if customer_infos:
                            user_picture_url = customer_infos[0].get("pictureUrl") or None

                        current_data.update({
                            "active": True,
                            "order_stage": self._parse_stage(feed_cards),
                            "order_status": order_status_text,
                            "driver_name": contacts[0].get("title", "Unknown") if contacts else "Unknown",

                            "driver_eta_str": driver_eta_title,
                            "driver_eta": self._parse_eta_timestamp(driver_eta_title),

                            "driver_location_lat": lat if lat else "No Active Order",
                            "driver_location_lon": lon if lon else "No Active Order",

                            # Location pieces (trimmed)
                            "driver_location_street":   loc.get("road", "No Driver Assigned"),
                            "driver_location_suburb":   loc.get("suburb", "No Driver Assigned"),
                            "driver_location_quarter":  loc.get("quarter", "No Driver Assigned"),
                            "driver_location_county":   loc.get("county", "No Driver Assigned"),
                            "driver_location_address":  loc.get("address", "No Driver Assigned"),

                            "map_url": map_url,
                            "minutes_remaining": self._calculate_minutes(driver_eta_title),

                            "restaurant_name": active_overview.get("title", "Unknown"),
                            "order_id": order.get("uuid", "Unknown"),
                            "order_status_description": order_status_text,
                            "latest_arrival": feed_cards[0].get("status", {}).get("statusSummary", {}).get("text", "Unknown") if feed_cards else "Unknown",

                            # Extended: pics, phone, map locations for multi-marker map
                            "user_picture_url": user_picture_url,
                            "driver_picture_url": driver_picture_url,
                            "driver_phone_formatted": driver_phone_formatted,
                            "home_location": eater if eater else {"lat": self.hass.config.latitude or 0, "lon": self.hass.config.longitude or 0},
                            "store_location": store if store else None,
                            "driver_location_coords": courier if courier else None,
                        })

                        # optional history (kept as you had)
                        self._order_history.append({
                            "timestamp": dt_util.now().isoformat(),
                            "restaurant_name": current_data["restaurant_name"],
                            "order_status": current_data["order_status"],
                            "driver_name": current_data["driver_name"],
                            "driver_eta": current_data["driver_eta_str"],
                            "order_stage": current_data["order_stage"],
                        })
                        if len(self._order_history) > 10:
                            self._order_history = self._order_history[-10:]

                    # TTS event detection and announcements (before updating previous)
                    self._process_tts_events(current_data)
                    self._previous_data = dict(current_data) if current_data else self._default_data()

                    return current_data

            except ConfigEntryAuthFailed:
                raise  # Re-raise auth failures for HA to handle
            except Exception as err:
                _LOGGER.error("Error fetching data: %s", err, exc_info=True)
                return self._default_data()

    def _get_map_entities(self, background_feed_cards):
        """Extract EATER (home), STORE (restaurant), COURIER (driver) from mapEntity."""
        out = {}
        if not background_feed_cards:
            return out
        for m in (background_feed_cards[0].get("mapEntity") or []):
            t = m.get("type")
            lat = m.get("latitude")
            lon = m.get("longitude")
            if t and lat is not None and lon is not None:
                out[t] = {"lat": float(lat), "lon": float(lon)}
        return out

    def _default_data(self):
        home_lat = self.hass.config.latitude or 0.0
        home_lon = self.hass.config.longitude or 0.0
        return {
            "active": False,
            "order_stage": "No Active Order",
            "order_status": "No Active Order",
            "driver_name": "No Driver Assigned",
            "driver_eta_str": "No ETA Available",
            "driver_eta": None,

            "driver_location_lat": home_lat,
            "driver_location_lon": home_lon,

            # Location pieces (trimmed)
            "driver_location_street": "No Driver Assigned",
            "driver_location_suburb": "No Driver Assigned",
            "driver_location_quarter": "No Driver Assigned",
            "driver_location_county": "No Driver Assigned",
            "driver_location_address": "No Driver Assigned",

            "map_url": "No Map Available",
            "minutes_remaining": None,
            "restaurant_name": "No Restaurant",
            "order_id": "No Active Order",
            "order_status_description": "No Active Order",
            "latest_arrival": "No Latest Arrival",

            "user_picture_url": None,
            "driver_picture_url": None,
            "driver_phone_formatted": "",
            "home_location": {"lat": home_lat, "lon": home_lon},
            "store_location": None,
            "driver_location_coords": None,
        }

    def _get_locale_code(self, time_zone):
        if time_zone.startswith("America/"):
            return "us"
        if time_zone.startswith("Australia/"):
            return "au"
        return "us"

    def _parse_stage(self, feed_cards):
        if not feed_cards:
            return "No Active Order"
        progress = feed_cards[0].get("status", {}).get("currentProgress", 0)
        stages = {0: "preparing", 1: "picked up", 2: "en route", 3: "arriving", 4: "delivered", 5: "complete"}
        return stages.get(progress, "unknown")

    def _parse_eta_timestamp(self, eta_str):
        if not eta_str or eta_str in ("N/A", "Unknown"):
            return None
        try:
            eta_time = datetime.strptime(eta_str, "%I:%M %p").time()
            now_dt = dt_util.now()
            eta_full = now_dt.replace(hour=eta_time.hour, minute=eta_time.minute, second=0, microsecond=0)
            if eta_full < now_dt:
                eta_full += timedelta(days=1)
            return eta_full
        except ValueError:
            _LOGGER.warning("Failed to parse ETA: %s", eta_str)
            return None

    def _calculate_minutes(self, eta_str):
        """No 24h wrap; clamp negatives to 0."""
        eta_ts = self._parse_eta_timestamp(eta_str)
        if not eta_ts:
            return None
        delta_secs = (eta_ts - dt_util.now()).total_seconds()
        if delta_secs <= 0:
            return 0
        return int(delta_secs // 60)

    async def _reverse_geocode(self, lat, lon, session):
        """
        Return dict with location components we keep:
        road, suburb, quarter, county, address
        """
        url = (
            "https://nominatim.openstreetmap.org/reverse"
            f"?format=json&lat={lat}&lon={lon}&zoom=17&addressdetails=1&accept-language=en"
        )
        headers = {"User-Agent": "UberEatsHAIntegration/1.0"}
        try:
            async with session.get(url, headers=headers) as resp:
                if resp.status != 200:
                    return {}
                data = await resp.json()
                addr = data.get("address", {}) or {}
                return {
                    "road":     addr.get("road") or addr.get("pedestrian") or addr.get("footway") or "No Driver Assigned",
                    "suburb":   addr.get("suburb") or "No Driver Assigned",
                    "quarter":  addr.get("quarter") or "No Driver Assigned",
                    "county":   addr.get("county") or "No Driver Assigned",
                    "address":  data.get("display_name") or "No Driver Assigned",
                }
        except Exception as e:
            _LOGGER.debug("Reverse geocode failed: %s", e)
            return {}

    def _get_map_url(self, lat, lon):
        if not lat or not lon:
            return "No Map Available"
        min_lon, min_lat = lon - 0.001, lat - 0.001
        max_lon, max_lat = lon + 0.001, lat + 0.001
        return (
            "https://www.openstreetmap.org/export/embed.html"
            f"?bbox={min_lon}%2C{min_lat}%2C{max_lon}%2C{max_lat}&layer=mapnik&marker={lat}%2C{lon}"
        )

    @staticmethod
    def _distance_feet(lat1, lon1, lat2, lon2):
        """Haversine distance in feet between two lat/lon points."""
        if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
            return None
        import math
        R = 6371000  # meters
        to_rad = lambda x: x * math.pi / 180
        d_lat = to_rad(lat2 - lat1)
        d_lon = to_rad(lon2 - lon1)
        a = math.sin(d_lat / 2) ** 2 + math.cos(to_rad(lat1)) * math.cos(to_rad(lat2)) * math.sin(d_lon / 2) ** 2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return (R * c) * 3.28084  # meters to feet

    def _process_tts_events(self, current_data):
        """Detect order events and send TTS if enabled. Fire-and-forget."""
        from . import tts_notifications

        prev = self._previous_data
        if prev is None:
            return  # First run, no prior state to compare

        entry = self.hass.config_entries.async_get_entry(self.entry_id)
        if not entry:
            return
        options = entry.options or {}
        if not options.get(CONF_TTS_ENABLED, False):
            return
        tts_entity = options.get(CONF_TTS_ENTITY_ID, "").strip()
        media_players = options.get(CONF_TTS_MEDIA_PLAYERS, [])
        prefix = options.get(CONF_TTS_MESSAGE_PREFIX, DEFAULT_TTS_MESSAGE_PREFIX) or DEFAULT_TTS_MESSAGE_PREFIX
        volume = float(options.get(CONF_TTS_VOLUME, DEFAULT_TTS_VOLUME))
        interval_enabled = options.get(CONF_TTS_INTERVAL_ENABLED, False)
        interval_minutes = max(5, min(15, int(options.get(CONF_TTS_INTERVAL_MINUTES, DEFAULT_TTS_INTERVAL_MINUTES))))

        if not media_players:
            return

        curr_with_status = dict(current_data)
        curr_active = current_data.get("active")
        messages_to_send = []

        # 1. New order: same logic as active order sensor — was off, now on (with restaurant for message)
        if not prev.get("active") and current_data.get("active"):
            rest = (current_data.get("restaurant_name") or "").strip()
            if rest and rest not in ("No Restaurant", "Unknown"):
                msg = tts_notifications.build_message(
                    prefix, self.account_name, curr_with_status, "new_order"
                )
                if msg:
                    messages_to_send.append(("new_order", msg))

        # 2. Driver assigned
        prev_driver = prev.get("driver_name", "No Driver Assigned")
        curr_driver = current_data.get("driver_name", "No Driver Assigned")
        had_driver = _has_driver(prev_driver)
        has_driver = _has_driver(curr_driver)
        if not had_driver and has_driver:
            msg = tts_notifications.build_message(
                prefix, self.account_name, curr_with_status, "driver_assigned"
            )
            if msg:
                messages_to_send.append(("driver_assigned", msg))
            if interval_enabled:
                self._last_interval_tts_time = dt_util.utcnow()
        if had_driver and not has_driver:
            self._last_interval_tts_time = None
            self._last_driver_nearby_triggered = False

        # 3. Card timeline / order status change (order_status from API)
        prev_order_status = prev.get("order_status", "")
        curr_order_status = current_data.get("order_status", "")
        if curr_active and curr_order_status and curr_order_status != prev_order_status:
            msg = tts_notifications.build_message(
                prefix, self.account_name, curr_with_status, "status_change"
            )
            if msg:
                messages_to_send.append(("status_change", msg))

        # 4. Interval update (when driver assigned, every N minutes)
        if interval_enabled and has_driver and self._last_interval_tts_time:
            now = dt_util.utcnow()
            elapsed = (now - self._last_interval_tts_time).total_seconds()
            if elapsed >= interval_minutes * 60:
                msg = tts_notifications.build_message(
                    prefix, self.account_name, curr_with_status, "interval_update"
                )
                if msg:
                    messages_to_send.append(("interval_update", msg))
                self._last_interval_tts_time = now

        for _event_type, message in messages_to_send:
            self.hass.async_create_task(
                tts_notifications.send_tts_if_idle(
                    self.hass, tts_entity, media_players, message, cache=False, volume_level=volume
                )
            )

        # 5. Driver nearby action: trigger user-selected automation when within distance (once per approach)
        driver_nearby_enabled = options.get(CONF_DRIVER_NEARBY_AUTOMATION_ENABLED, False)
        automation_entity = (options.get(CONF_DRIVER_NEARBY_AUTOMATION_ENTITY) or "").strip()
        distance_feet = max(50, min(2000, int(options.get(CONF_DRIVER_NEARBY_DISTANCE_FEET, DEFAULT_DRIVER_NEARBY_DISTANCE_FEET))))
        reset_feet = distance_feet + 50  # allow re-trigger after driver leaves and comes back
        if driver_nearby_enabled and automation_entity and automation_entity.startswith("automation.") and has_driver:
            home_lat = self.hass.config.latitude or 0.0
            home_lon = self.hass.config.longitude or 0.0
            lat = current_data.get("driver_location_lat")
            lon = current_data.get("driver_location_lon")
            if lat is not None and lon is not None and isinstance(lat, (int, float)) and isinstance(lon, (int, float)):
                dist_ft = self._distance_feet(float(lat), float(lon), home_lat, home_lon)
                if dist_ft is not None:
                    if dist_ft > reset_feet:
                        self._last_driver_nearby_triggered = False
                    elif dist_ft <= distance_feet and not self._last_driver_nearby_triggered:
                        self._last_driver_nearby_triggered = True
                        self.hass.async_create_task(
                            self.hass.services.async_call(
                                "automation",
                                "trigger",
                                {"skip_condition": False},
                                target={"entity_id": automation_entity},
                                blocking=False,
                            )
                        )
        else:
            if not has_driver:
                self._last_driver_nearby_triggered = False


__all__ = ["UberEatsCoordinator"]
