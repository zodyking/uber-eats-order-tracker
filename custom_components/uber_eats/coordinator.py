import asyncio
import aiohttp
import logging
from datetime import timedelta
from datetime import datetime  # Added this import to fix the error
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed
from homeassistant.util import dt as dt_util

from .const import ENDPOINT, HEADERS_TEMPLATE

_LOGGER = logging.getLogger(__name__)

class UberEatsCoordinator(DataUpdateCoordinator):
    def __init__(self, hass, sid, uuid, account_name, time_zone):
        self.sid = sid
        self.uuid = uuid
        self.account_name = account_name
        self.time_zone = time_zone
        self.hass = hass
        self._order_history = []  # Per-account history
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
            headers["Cookie"] = f"sid={self.sid}; _userUuid={self.uuid}"
            payload = {"orderUuid": None, "timezone": self.time_zone, "showAppUpsellIllustration": True}
            try:
                async with session.post(url, json=payload, headers=headers) as resp:
                    _LOGGER.info(f"API response status: {resp.status}")
                    if resp.status != 200:
                        return self._default_data()
                    data = await resp.json()
                    orders = data.get("data", {}).get("orders", [])
                    current_data = self._default_data()
                    if orders:
                        order = orders[0]
                        feed_cards = order.get("feedCards", [])
                        contacts = order.get("contacts", [])
                        active_overview = order.get("activeOrderOverview", {})
                        background_feed_cards = order.get("backgroundFeedCards", [])
                        lat = background_feed_cards[0].get("mapEntity", [])[0].get("latitude", None) if background_feed_cards else None
                        lon = background_feed_cards[0].get("mapEntity", [])[0].get("longitude", None) if background_feed_cards else None
                        driver_location_str = await self._get_cross_street(lat, lon, session) if lat and lon else "No Active Order"
                        map_url = self._get_map_url(lat, lon) if lat and lon else "No Map Available"
                        current_data.update({
                            "active": True,
                            "order_stage": self._parse_stage(feed_cards),
                            "order_status": feed_cards[0].get("status", {}).get("timelineSummary", "Unknown") if feed_cards else "Unknown",
                            "driver_name": contacts[0].get("title", "Unknown") if contacts else "Unknown",
                            "driver_eta_str": feed_cards[0].get("status", {}).get("title", "Unknown") if feed_cards else "Unknown",
                            "driver_eta": self._parse_eta_timestamp(feed_cards[0].get("status", {}).get("title", "Unknown") if feed_cards else "Unknown"),
                            "driver_location_lat": lat if lat else "No Active Order",
                            "driver_location_lon": lon if lon else "No Active Order",
                            "driver_location": driver_location_str,
                            "map_url": map_url,
                            "minutes_remaining": self._calculate_minutes(feed_cards[0].get("status", {}).get("title", "Unknown") if feed_cards else "Unknown"),
                            "restaurant_name": active_overview.get("title", "Unknown"),
                            "order_id": order.get("uuid", "Unknown"),
                            "order_status_description": feed_cards[0].get("status", {}).get("timelineSummary", "Unknown") if feed_cards else "Unknown",
                            "latest_arrival": feed_cards[0].get("status", {}).get("statusSummary", {}).get("text", "Unknown") if feed_cards else "Unknown",
                        })
                        current_order = {
                            "timestamp": dt_util.now().isoformat(),
                            "restaurant_name": current_data["restaurant_name"],
                            "order_status": current_data["order_status"],
                            "driver_name": current_data["driver_name"],
                            "driver_eta": current_data["driver_eta_str"],
                            "order_stage": current_data["order_stage"],
                        }
                        self._order_history.append(current_order)
                        if len(self._order_history) > 10:
                            self._order_history = self._order_history[-10:]
                    return current_data
            except Exception as err:
                _LOGGER.error(f"Error fetching data: {err}")
                return self._default_data()

    def _default_data(self):
        return {
            "active": False,
            "order_stage": "No Active Order",
            "order_status": "No Active Order",
            "driver_name": "No Driver Assigned",
            "driver_eta_str": "No ETA Available",
            "driver_eta": None,
            "driver_location_lat": self.hass.config.latitude or 0.0,
            "driver_location_lon": self.hass.config.longitude or 0.0,
            "driver_location": "No Active Order",
            "map_url": "No Map Available",
            "minutes_remaining": None,
            "restaurant_name": "No Restaurant",
            "order_id": "No Active Order",
            "order_status_description": "No Active Order",
            "latest_arrival": "No Latest Arrival",
        }

    def _get_locale_code(self, time_zone):
        if time_zone.startswith("America/"):
            return "us"
        elif time_zone.startswith("Australia/"):
            return "au"
        return "us"  # Fallback

    def _parse_stage(self, feed_cards):
        if not feed_cards:
            return "No Active Order"
        progress = feed_cards[0].get("status", {}).get("currentProgress", 0)
        stages = {0: "preparing", 1: "picked up", 2: "en route", 3: "arriving", 4: "delivered", 5: "complete"}
        return stages.get(progress, "unknown")

    def _parse_eta_timestamp(self, eta_str):
        if not eta_str or eta_str == "N/A" or eta_str == "Unknown":
            return None
        try:
            eta_time = datetime.strptime(eta_str, "%I:%M %p").time()
            now_dt = dt_util.now()
            eta_full = now_dt.replace(hour=eta_time.hour, minute=eta_time.minute, second=0, microsecond=0)
            if eta_full < now_dt:
                eta_full += timedelta(days=1)
            return eta_full
        except ValueError:
            _LOGGER.warning(f"Failed to parse ETA: {eta_str}")
            return None

    def _calculate_minutes(self, eta_str):
        eta_ts = self._parse_eta_timestamp(eta_str)
        if eta_ts:
            return int((eta_ts - dt_util.now()).total_seconds() / 60)
        return None

    async def _get_cross_street(self, lat, lon, session):
        nominatim_url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}&zoom=17&addressdetails=1"
        headers = {"User-Agent": "UberEatsHAIntegration/1.0"}
        try:
            async with session.get(nominatim_url, headers=headers) as resp:
                if resp.status != 200:
                    return "No Location Available"
                data = await resp.json()
                road = data.get("address", {}).get("road", "")
                city = data.get("address", {}).get("city", "")
                state = data.get("address", {}).get("state", "")
                cross_street = data.get("address", {}).get("crossroad", "") or ""
                formatted = f"{road} & {cross_street}, {city}, {state}" if cross_street else f"{road}, {city}, {state}"
                return formatted.strip().rstrip(",") or "No Location Available"
        except:
            return "No Location Available"

    def _get_map_url(self, lat, lon):
        min_lon, min_lat, max_lon, max_lat = lon - 0.001, lat - 0.001, lon + 0.001, lat + 0.001
        return f"https://www.openstreetmap.org/export/embed.html?bbox={min_lon}%2C{min_lat}%2C{max_lon}%2C{max_lat}&layer=mapnik&marker={lat}%2C{lon}"
