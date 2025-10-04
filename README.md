# Uber Eats Order Tracker

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?style=for-the-badge)](https://github.com/hacs/integration)

Custom Home Assistant integration to track live Uber Eats orders, including entities for order stage, status, driver name, ETA, restaurant name, lat/long, cross street, and history.

![Uber Eats Logo](<img width="1460" height="461" alt="image" src="https://github.com/user-attachments/assets/f6ce6dc2-8399-4cc2-b829-58d1f3bebb12" />
)

## Features
- Monitors active orders with real-time updates every 15 seconds.
- Entities for order details, driver location (lat/long), cross street (using free OSM), and history.
- Supports multiple accounts with unique names.
- Time zone selection for accurate API calls.
- Defaults to home address for location when no order.

## Installation

### HACS (Recommended)
1. Open HACS in Home Assistant.
2. Go to "Integrations" > 3 dots > "Custom repositories".
3. Add repo: `https://github.com/zodyking/uber-eats-order-tracker`
4. Category: Integration.
5. Click "Add" > Search for "Uber Eats Order Tracker" > Install.

Or use this button:

[![Add to my HACS](https://my.home-assistant.io/badges/hacs_repository.svg?style=for-the-badge)](https://my.home-assistant.io/redirect/hacs_repository/?owner=zodyking&repository=uber-eats-order-tracker&category=integration)

3. Restart Home Assistant.
4. Configure via Settings > Devices & Services > Add Integration > Uber Eats.

### Manual
1. Download the repo ZIP.
2. Extract `custom_components/uber_eats/` to `/config/custom_components/uber_eats/` in HA.
3. Restart HA.
4. Add via UI.

## Configuration
- **SID and UUID**: From Uber Eats browser cookies (Dev Tools > Application > Cookies).
- **Account Name**: Unique name (e.g., "Personal").
- **Time Zone**: Select from dropdown (used for API).

## Entities
- binary_sensor.<account>_uber_eats_active_order
- sensor.<account>_uber_eats_order_stage
- sensor.<account>_uber_eats_order_status
- sensor.<account>_uber_eats_driver_name
- sensor.<account>_uber_eats_driver_eta (attribute: minutes_remaining)
- sensor.<account>_uber_eats_order_history (attribute: history)
- sensor.<account>_uber_eats_restaurant_name
- sensor.<account>_uber_eats_order_id
- sensor.<account>_uber_eats_order_status_description
- sensor.<account>_uber_eats_latest_arrival
- sensor.<account>_uber_eats_driver_latitude
- sensor.<account>_uber_eats_driver_longitude
- sensor.<account>_uber_eats_driver_location (cross street)

## Testing
1. Place an Uber Eats order.
2. Entities update automatically.

## Notes
- Unofficial integration; may violate Uber ToS.
- Driver location (lat/long/cross street) requires active delivery.
- For issues, open a GitHub issue.

Developed by [zodyking](https://github.com/zodyking).
