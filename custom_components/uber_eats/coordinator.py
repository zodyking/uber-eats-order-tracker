import aiohttp
import asyncio
import json
import logging
import os
from datetime import datetime, timedelta
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator
from homeassistant.exceptions import ConfigEntryAuthFailed
from homeassistant.util import dt as dt_util

from .const import (
    ENDPOINT,
    ENDPOINT_PAST_ORDERS,
    ENDPOINT_GET_USER,
    HEADERS_TEMPLATE,
    CONF_TTS_ENABLED,
    CONF_TTS_ENTITY_ID,
    CONF_TTS_MEDIA_PLAYERS,
    CONF_TTS_MESSAGE_PREFIX,
    CONF_TTS_VOLUME,
    CONF_TTS_MEDIA_PLAYER_VOLUMES,
    CONF_TTS_MEDIA_PLAYER_SETTINGS,
    CONF_TTS_CACHE,
    CONF_TTS_LANGUAGE,
    CONF_TTS_OPTIONS,
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
    def __init__(self, hass, entry_id, sid, session_id, account_name, time_zone, full_cookie=None):
        self.entry_id = entry_id
        self.sid = sid
        self.session_id = session_id  # Renamed from uuid
        self.account_name = account_name
        self.time_zone = time_zone
        self.full_cookie = full_cookie  # Full cookie for APIs that need it
        self.hass = hass
        self._order_history = []  # Per-account history
        self._previous_data = None  # Set on first update
        self._last_interval_tts_time = None  # For interval TTS when driver assigned
        self._driver_nearby_triggered_orders = set()  # Track which order UUIDs have triggered nearby action
        self._cached_user_profile = None  # Cached user profile from getUserV1
        self._cached_past_orders = None  # In-memory cache of past orders data
        self._past_orders_cache_loaded = False  # Track if cache has been loaded from disk
        super().__init__(
            hass,
            _LOGGER,
            name=f"Uber Eats Orders - {account_name}",
            update_interval=timedelta(seconds=15),
        )

    async def _async_update_data(self):
        # Systematically poll user profile on every update to detect changes
        try:
            profile = await self.fetch_user_profile()
            old_profile = self._cached_user_profile or {}
            self._cached_user_profile = profile
            
            # Check if name has changed and update account_name
            new_first = profile.get("first_name", "")
            new_last = profile.get("last_name", "")
            if new_first or new_last:
                new_name = f"{new_first} {new_last}".strip()
                if new_name and new_name != self.account_name:
                    _LOGGER.info("User profile name changed from '%s' to '%s'", self.account_name, new_name)
                    self.account_name = new_name
        except Exception as e:
            _LOGGER.debug("Failed to fetch user profile: %s", e)
            if self._cached_user_profile is None:
                self._cached_user_profile = {"picture_url": None, "first_name": "", "last_name": ""}

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
                    
                    raw_orders = data.get("data", {}).get("orders", [])
                    current_data = self._default_data()

                    # Parse ALL orders into an array for multi-order support
                    parsed_orders = []
                    for order in raw_orders:
                        parsed_order = await self._parse_single_order(order, session)
                        if parsed_order:
                            parsed_orders.append(parsed_order)

                    # Store orders array and count
                    current_data["orders"] = parsed_orders
                    current_data["orders_count"] = len(parsed_orders)

                    if parsed_orders:
                        # Use first order for flat fields (backward compatibility)
                        first = parsed_orders[0]
                        current_data.update({
                            "active": True,
                            "order_stage": first.get("order_stage", "No Active Order"),
                            "order_status": first.get("order_status", "No Active Order"),
                            "driver_name": first.get("driver_name", "No Driver Assigned"),

                            "driver_eta_str": first.get("driver_eta_str", "No ETA Available"),
                            "driver_eta": first.get("driver_eta"),

                            "driver_location_lat": first.get("driver_location_lat", "No Active Order"),
                            "driver_location_lon": first.get("driver_location_lon", "No Active Order"),

                            "driver_location_street": first.get("driver_location_street", "No Driver Assigned"),
                            "driver_location_suburb": first.get("driver_location_suburb", "No Driver Assigned"),
                            "driver_location_quarter": first.get("driver_location_quarter", "No Driver Assigned"),
                            "driver_location_county": first.get("driver_location_county", "No Driver Assigned"),
                            "driver_location_address": first.get("driver_location_address", "No Driver Assigned"),

                            "map_url": first.get("map_url", "No Map Available"),
                            "minutes_remaining": first.get("minutes_remaining"),

                            "restaurant_name": first.get("restaurant_name", "Unknown"),
                            "order_id": first.get("order_id", "Unknown"),
                            "order_status_description": first.get("order_status_description", "No Active Order"),
                            "latest_arrival": first.get("latest_arrival", "No Latest Arrival"),

                            "user_picture_url": first.get("user_picture_url") or (self._cached_user_profile or {}).get("picture_url"),
                            "driver_picture_url": first.get("driver_picture_url"),
                            "driver_phone_formatted": first.get("driver_phone_formatted", ""),
                            "home_location": first.get("home_location", {"lat": self.hass.config.latitude or 0, "lon": self.hass.config.longitude or 0}),
                            "store_location": first.get("store_location"),
                            "driver_location_coords": first.get("driver_location_coords"),
                            # User profile info for sensor names and display
                            "user_first_name": (self._cached_user_profile or {}).get("first_name", ""),
                            "user_last_name": (self._cached_user_profile or {}).get("last_name", ""),
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

    async def _parse_single_order(self, order, session):
        """Parse a single order object into a normalized dict."""
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

        # Full timeline text
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

        return {
            "order_id": order.get("uuid", "Unknown"),
            "order_stage": self._parse_stage(feed_cards),
            "order_status": order_status_text,
            "order_status_description": order_status_text,
            "restaurant_name": active_overview.get("title", "Unknown"),
            "driver_name": contacts[0].get("title", "Unknown") if contacts else "Unknown",
            "driver_eta_str": driver_eta_title,
            "driver_eta": self._parse_eta_timestamp(driver_eta_title),
            "minutes_remaining": self._calculate_minutes(driver_eta_title),
            "driver_location_lat": lat if lat else "No Active Order",
            "driver_location_lon": lon if lon else "No Active Order",
            "driver_location_street": loc.get("road", "No Driver Assigned"),
            "driver_location_suburb": loc.get("suburb", "No Driver Assigned"),
            "driver_location_quarter": loc.get("quarter", "No Driver Assigned"),
            "driver_location_county": loc.get("county", "No Driver Assigned"),
            "driver_location_address": loc.get("address", "No Driver Assigned"),
            "map_url": map_url,
            "latest_arrival": feed_cards[0].get("status", {}).get("statusSummary", {}).get("text", "Unknown") if feed_cards else "Unknown",
            "user_picture_url": user_picture_url or (self._cached_user_profile or {}).get("picture_url"),
            "driver_picture_url": driver_picture_url,
            "driver_phone_formatted": driver_phone_formatted,
            "home_location": eater if eater else {"lat": self.hass.config.latitude or 0, "lon": self.hass.config.longitude or 0},
            "store_location": store if store else None,
            "driver_location_coords": courier if courier else None,
        }

    def _default_data(self):
        home_lat = self.hass.config.latitude or 0.0
        home_lon = self.hass.config.longitude or 0.0
        return {
            "active": False,
            "orders": [],
            "orders_count": 0,
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

            "user_picture_url": (self._cached_user_profile or {}).get("picture_url"),
            "driver_picture_url": None,
            "driver_phone_formatted": "",
            "home_location": {"lat": home_lat, "lon": home_lon},
            "store_location": None,
            "driver_location_coords": None,
            # User profile info
            "user_first_name": (self._cached_user_profile or {}).get("first_name", ""),
            "user_last_name": (self._cached_user_profile or {}).get("last_name", ""),
        }

    def _get_locale_code(self, time_zone):
        if time_zone.startswith("America/"):
            return "us"
        if time_zone.startswith("Australia/"):
            return "au"
        return "us"

    def _get_cache_file_path(self):
        """Get the path to the cache file for this account's past orders."""
        cache_dir = self.hass.config.path("custom_components", "uber_eats", ".cache")
        # Use entry_id for unique file per account
        return os.path.join(cache_dir, f"past_orders_{self.entry_id}.json")

    async def _load_past_orders_cache(self):
        """Load past orders cache from disk."""
        if self._past_orders_cache_loaded:
            return self._cached_past_orders
        
        cache_file = self._get_cache_file_path()
        try:
            if os.path.exists(cache_file):
                def read_file():
                    with open(cache_file, "r", encoding="utf-8") as f:
                        return json.load(f)
                data = await self.hass.async_add_executor_job(read_file)
                self._cached_past_orders = data
                self._past_orders_cache_loaded = True
                _LOGGER.debug("Loaded past orders cache for %s", self.account_name)
                return data
        except Exception as e:
            _LOGGER.warning("Failed to load past orders cache: %s", e)
        
        self._past_orders_cache_loaded = True
        return None

    async def _save_past_orders_cache(self, data):
        """Save past orders data to disk cache."""
        cache_file = self._get_cache_file_path()
        try:
            cache_dir = os.path.dirname(cache_file)
            def write_file():
                os.makedirs(cache_dir, exist_ok=True)
                with open(cache_file, "w", encoding="utf-8") as f:
                    json.dump(data, f)
            await self.hass.async_add_executor_job(write_file)
            self._cached_past_orders = data
            _LOGGER.debug("Saved past orders cache for %s", self.account_name)
        except Exception as e:
            _LOGGER.warning("Failed to save past orders cache: %s", e)

    async def get_past_orders_cached(self):
        """Get past orders with caching - returns cached data immediately, refreshes in background.
        
        Returns dict with:
          - orders: list of order dicts
          - statistics: computed stats
          - from_cache: True if this is cached data (fresh fetch happening in background)
        """
        # Load from disk cache if not yet loaded
        cached = await self._load_past_orders_cache()
        
        if cached and cached.get("orders"):
            # Return cached data immediately, schedule background refresh
            asyncio.create_task(self._refresh_past_orders_background())
            return {**cached, "from_cache": True}
        
        # No cache - fetch fresh
        fresh_data = await self.fetch_past_orders()
        await self._save_past_orders_cache(fresh_data)
        return {**fresh_data, "from_cache": False}

    async def _refresh_past_orders_background(self):
        """Fetch fresh past orders in background and update cache."""
        try:
            fresh_data = await self.fetch_past_orders()
            await self._save_past_orders_cache(fresh_data)
        except Exception as e:
            _LOGGER.debug("Background past orders refresh failed: %s", e)

    async def fetch_past_orders(self):
        """Fetch all past orders from the Uber Eats API (paginated), filtered to current year.
        
        Returns dict with:
          - orders: list of order dicts (current year only)
          - statistics: computed stats for current year
        """
        locale = self._get_locale_code(self.time_zone)
        url = f"{ENDPOINT_PAST_ORDERS}?localeCode={locale}"
        headers = dict(HEADERS_TEMPLATE)
        # Use full cookie if available, otherwise fall back to sid
        if self.full_cookie:
            headers["Cookie"] = self.full_cookie
        else:
            headers["Cookie"] = f"sid={self.sid}"

        all_orders = []
        current_year = datetime.now().year
        last_workflow_uuid = ""

        async with aiohttp.ClientSession() as session:
            try:
                while True:
                    async with session.post(url, headers=headers, json={"lastWorkflowUUID": last_workflow_uuid}) as resp:
                        if resp.status != 200:
                            _LOGGER.error("Past orders API returned %s", resp.status)
                            break
                        data = await resp.json()
                        orders_map = data.get("data", {}).get("ordersMap", {})
                        meta = data.get("data", {}).get("meta", {})
                        has_more = meta.get("hasMore", False)

                        batch_orders = []
                        for order_uuid, order_data in orders_map.items():
                            base = order_data.get("baseEaterOrder", {})
                            store_info = order_data.get("storeInfo", {})
                            fare_info = order_data.get("fareInfo", {})

                            # Extract from checkoutInfo
                            checkout = fare_info.get("checkoutInfo", [])
                            subtotal = 0
                            delivery_fee = 0
                            tax = 0
                            promotions = 0  # Sum of all discounts/credits (negative value)
                            total_raw = fare_info.get("totalPrice", 0) / 100.0

                            for item in checkout:
                                key = item.get("key", "")
                                item_type = item.get("type", "")
                                raw_val = item.get("rawValue", 0)
                                
                                if key == "eats_fare.subtotal":
                                    subtotal = raw_val
                                elif "booking_fee" in key:
                                    delivery_fee = raw_val
                                elif key == "eats.tax.base":
                                    tax = raw_val
                                elif item_type == "debit" and raw_val < 0:
                                    # Sum all debits (promotions/discounts) - they have negative values
                                    promotions += raw_val
                                elif key == "eats_fare.total":
                                    total_raw = raw_val

                            # Parse completed date and filter by current year
                            completed_at = base.get("completedAt", "") or base.get("lastStateChangeAt", "")
                            order_year = None
                            date_formatted = ""
                            if completed_at:
                                try:
                                    dt_obj = datetime.fromisoformat(completed_at.replace("Z", "+00:00"))
                                    order_year = dt_obj.year
                                    date_formatted = dt_obj.strftime("%b %d, %Y")
                                except Exception:
                                    date_formatted = completed_at[:10] if len(completed_at) >= 10 else completed_at

                            # Only include orders from current year
                            if order_year != current_year:
                                continue

                            location = store_info.get("location", {})
                            address_info = location.get("address", {})
                            store_address = address_info.get("eaterFormattedAddress", "")

                            batch_orders.append({
                                "uuid": order_uuid,
                                "store_uuid": store_info.get("uuid", ""),
                                "restaurant_name": store_info.get("title", "Unknown"),
                                "hero_image_url": store_info.get("heroImageUrl", ""),
                                "date": date_formatted,
                                "completed_at": completed_at,
                                "subtotal": subtotal,
                                "delivery_fee": delivery_fee,
                                "tax": tax,
                                "promotions": promotions,  # Negative value for discounts/credits
                                "total": total_raw,
                                "store_address": store_address,
                                "store_rating": store_info.get("rating"),
                                "is_cancelled": base.get("isCancelled", False),
                            })

                        all_orders.extend(batch_orders)

                        # Pagination: get last order UUID for next request
                        if has_more and orders_map:
                            # Get the last order UUID from the batch
                            last_order = list(orders_map.values())[-1]
                            last_workflow_uuid = last_order.get("baseEaterOrder", {}).get("uuid", "")
                            if not last_workflow_uuid:
                                break
                        else:
                            break

            except Exception as e:
                _LOGGER.error("Error fetching past orders: %s", e, exc_info=True)

        # Sort by completed date descending
        all_orders.sort(key=lambda o: o.get("completed_at", ""), reverse=True)

        # Compute statistics from current year orders
        statistics = self._compute_order_statistics(all_orders, current_year)

        return {"orders": all_orders, "statistics": statistics}

    async def fetch_user_profile(self):
        """Fetch user profile from the Uber Eats API.
        
        Returns dict with:
          - picture_url: user's profile picture URL
          - first_name: user's first name
          - last_name: user's last name
        """
        locale = self._get_locale_code(self.time_zone)
        url = f"{ENDPOINT_GET_USER}?localeCode={locale}"
        headers = dict(HEADERS_TEMPLATE)
        # Use full cookie if available, otherwise fall back to sid
        if self.full_cookie:
            headers["Cookie"] = self.full_cookie
        else:
            headers["Cookie"] = f"sid={self.sid}"

        async with aiohttp.ClientSession() as session:
            try:
                async with session.post(url, headers=headers, json={}) as resp:
                    if resp.status != 200:
                        _LOGGER.error("getUserV1 API returned %s", resp.status)
                        return {"picture_url": None, "first_name": "", "last_name": ""}
                    data = await resp.json()
                    user_data = data.get("data", {})
                    return {
                        "picture_url": user_data.get("pictureUrl"),
                        "first_name": user_data.get("firstName", ""),
                        "last_name": user_data.get("lastName", ""),
                    }
            except Exception as e:
                _LOGGER.error("Error fetching user profile: %s", e, exc_info=True)
                return {"picture_url": None, "first_name": "", "last_name": ""}

    def _compute_order_statistics(self, orders, year):
        """Compute statistics from orders list."""
        if not orders:
            return {
                "year": year,
                "total_orders": 0,
                "total_spent": 0,
                "total_delivery_fees": 0,
                "top_restaurants": [],
            }

        # Aggregate by restaurant
        restaurant_stats = {}
        total_spent = 0
        total_delivery_fees = 0
        total_orders = 0

        for order in orders:
            if order.get("is_cancelled"):
                continue

            total_orders += 1
            total_spent += order.get("total", 0)
            total_delivery_fees += order.get("delivery_fee", 0)

            store_uuid = order.get("store_uuid", "")
            store_name = order.get("restaurant_name", "Unknown")
            order_total = order.get("total", 0)

            if store_uuid:
                if store_uuid not in restaurant_stats:
                    restaurant_stats[store_uuid] = {
                        "name": store_name,
                        "order_count": 0,
                        "total_spent": 0,
                    }
                restaurant_stats[store_uuid]["order_count"] += 1
                restaurant_stats[store_uuid]["total_spent"] += order_total

        # Get top 3 restaurants by order count
        sorted_restaurants = sorted(
            restaurant_stats.values(),
            key=lambda r: r["order_count"],
            reverse=True
        )
        top_restaurants = sorted_restaurants[:3]

        return {
            "year": year,
            "total_orders": total_orders,
            "total_spent": round(total_spent, 2),
            "total_delivery_fees": round(total_delivery_fees, 2),
            "top_restaurants": top_restaurants,
        }

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
        per_player_volumes = options.get(CONF_TTS_MEDIA_PLAYER_VOLUMES, {})
        per_player_settings = options.get(CONF_TTS_MEDIA_PLAYER_SETTINGS, {})
        tts_cache = options.get(CONF_TTS_CACHE, True)
        tts_language = (options.get(CONF_TTS_LANGUAGE) or "").strip() or None
        tts_options = options.get(CONF_TTS_OPTIONS) or None
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
            self._driver_nearby_triggered_orders.clear()

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
                    self.hass, tts_entity, media_players, message,
                    cache=tts_cache, volume_level=volume,
                    per_player_volumes=per_player_volumes,
                    language=tts_language,
                    options=tts_options,
                    per_player_settings=per_player_settings,
                )
            )

        # 5. Driver nearby action: trigger user-selected automation when any driver is within distance
        #    Supports multiple orders - triggers once per order when each driver approaches
        driver_nearby_enabled = options.get(CONF_DRIVER_NEARBY_AUTOMATION_ENABLED, False)
        automation_entity = (options.get(CONF_DRIVER_NEARBY_AUTOMATION_ENTITY) or "").strip()
        distance_feet = max(50, min(2000, int(options.get(CONF_DRIVER_NEARBY_DISTANCE_FEET, DEFAULT_DRIVER_NEARBY_DISTANCE_FEET))))
        reset_feet = distance_feet + 50  # allow re-trigger after driver leaves and comes back
        
        if driver_nearby_enabled and automation_entity and automation_entity.startswith("automation."):
            home_lat = self.hass.config.latitude or 0.0
            home_lon = self.hass.config.longitude or 0.0
            all_orders = current_data.get("orders", [])
            current_order_ids = set()
            
            for order in all_orders:
                order_uuid = order.get("order_uuid") or order.get("order_id", "")
                if not order_uuid:
                    continue
                current_order_ids.add(order_uuid)
                
                # Skip if order has no driver
                driver_name = order.get("driver_name", "")
                if _no_driver(driver_name):
                    continue
                
                # Get driver coordinates from order
                coords = order.get("driver_location_coords", {})
                lat = coords.get("lat") if coords else None
                lon = coords.get("lon") if coords else None
                
                # Fall back to flat fields if coords not in order
                if lat is None:
                    lat = order.get("driver_location_lat")
                if lon is None:
                    lon = order.get("driver_location_lon")
                
                if lat is not None and lon is not None and isinstance(lat, (int, float)) and isinstance(lon, (int, float)):
                    dist_ft = self._distance_feet(float(lat), float(lon), home_lat, home_lon)
                    if dist_ft is not None:
                        if dist_ft > reset_feet:
                            # Driver left the area, allow re-trigger
                            self._driver_nearby_triggered_orders.discard(order_uuid)
                        elif dist_ft <= distance_feet and order_uuid not in self._driver_nearby_triggered_orders:
                            # Driver is nearby and hasn't triggered yet for this order
                            self._driver_nearby_triggered_orders.add(order_uuid)
                            _LOGGER.info("Driver nearby trigger for order %s (%.0f ft)", order_uuid[:8], dist_ft)
                            self.hass.async_create_task(
                                self.hass.services.async_call(
                                    "automation",
                                    "trigger",
                                    {"skip_condition": False},
                                    target={"entity_id": automation_entity},
                                    blocking=False,
                                )
                            )
            
            # Clean up triggered orders that are no longer active
            self._driver_nearby_triggered_orders = self._driver_nearby_triggered_orders & current_order_ids
        else:
            # Reset if feature disabled or no orders
            if not has_driver:
                self._driver_nearby_triggered_orders.clear()


__all__ = ["UberEatsCoordinator"]
