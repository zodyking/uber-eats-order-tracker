# Uber Eats Order Tracking HACS Integration

Custom HA integration for tracking Uber Eats orders, with entities for stage, status, driver name, ETA, restaurant, lat/long, cross street, and history.

## Installation via HACS
1. Open HACS > Integrations.
2. Click "Explore & Add Repositories".
3. Search for "Uber Eats Order Tracking" or add the repo URL: https://github.com/yourusername/hacs-uber-eats.
4. Install and restart HA.
5. Configure via Settings > Devices & Services > Add Integration > Uber Eats.

## Manual Installation
1. Download the repo.
2. Copy `custom_components/uber_eats/` to `/config/custom_components/uber_eats/` in HA.
3. Restart HA.
4. Add via UI.

## Configuration
- SID and UUID: From Uber Eats browser cookies.
- Account Name: e.g., "BrandonPersonal".
- Time Zone: Select from dropdown.

## Entities
- binary_sensor.<account>_uber_eats_active_order
- sensor.<account>_uber_eats_order_stage
- sensor.<account>_uber_eats_order_status
- sensor.<account>_uber_eats_driver_name
- sensor.<account>_uber_eats_driver_eta (with minutes_remaining attribute)
- sensor.<account>_uber_eats_order_history (with history attribute)
- sensor.<account>_uber_eats_restaurant_name
- sensor.<account>_uber_eats_order_id
- sensor.<account>_uber_eats_order_status_description
- sensor.<account>_uber_eats_latest_arrival
- sensor.<account>_uber_eats_driver_latitude
- sensor.<account>_uber_eats_driver_longitude
- sensor.<account>_uber_eats_driver_location (cross street)

## Testing
- Place an order; entities update every 15s.

Disclaimer: Unofficial, may violate Uber ToS.
