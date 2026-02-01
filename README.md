# Uber Eats Order Tracker

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?style=for-the-badge)](https://github.com/hacs/integration)
[![GitHub Release](https://img.shields.io/github/v/release/zodyking/uber-eats-order-tracker?style=for-the-badge)](https://github.com/zodyking/uber-eats-order-tracker/releases)
[![GitHub Stars](https://img.shields.io/github/stars/zodyking/uber-eats-order-tracker?style=for-the-badge)](https://github.com/zodyking/uber-eats-order-tracker/stargazers)

<img width="1460" height="461" alt="image" src="https://github.com/user-attachments/assets/38122230-aac8-4302-b67e-cb361ff19de4" />

Custom Home Assistant integration to track live Uber Eats orders in real-time. Features a dedicated sidebar panel, device tracker for map cards, and comprehensive sensor entities.

## ✨ Features

### Sidebar Panel
- **Dedicated Uber Eats panel** in Home Assistant sidebar
- View all accounts and order status at a glance
- **Real-time map** showing driver location or home when idle
- **Step-by-step instructions** for adding new accounts
- Edit and delete accounts directly from the panel

### Order Tracking
- **Real-time updates** every 15 seconds
- Order stage, status, driver name, ETA, and restaurant info
- Driver location with reverse geocoding (street, suburb, address)
- Order history tracking

### Device Tracker
- **Map card compatible** — track your driver on the Home Assistant Map
- Automatically shows driver location when order is active
- Falls back to home location when no active order

### Multi-Account Support
- Add multiple Uber Eats accounts
- Unique nicknames for each account
- Independent tracking per account

### Easy Authentication
- **Single cookie string input** — no need to find individual values
- Automatic extraction of required authentication tokens
- **Reconfigure flow** — update cookies without deleting the integration
- **Reauthentication flow** — automatic prompts when session expires

## 📦 Installation

### HACS (Recommended)

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=zodyking&repository=uber-eats-order-tracker&category=integration)

**Or manually:**
1. Open HACS in Home Assistant
2. Go to **Integrations** → ⋮ (3 dots) → **Custom repositories**
3. Add: `https://github.com/zodyking/uber-eats-order-tracker`
4. Category: **Integration**
5. Click **Add** → Search for "Uber Eats" → **Install**
6. **Restart Home Assistant**
7. Add via **Settings** → **Devices & Services** → **Add Integration** → **Uber Eats**

### Manual Installation
1. Download the [latest release](https://github.com/zodyking/uber-eats-order-tracker/releases)
2. Extract `custom_components/uber_eats/` to your Home Assistant `/config/custom_components/` directory
3. Restart Home Assistant
4. Add via UI

## 🍪 Getting the Cookie String

1. Log into [www.ubereats.com](https://www.ubereats.com) in your browser
2. Open **Developer Tools** (press `F12`)
3. Go to the **Network** tab
4. Refresh the page
5. Click on any request (e.g., `getActiveOrdersV1`)
6. In **Headers** → **Request Headers**, find **Cookie**
7. Copy the **entire value**

<img width="886" height="590" alt="Cookie location in DevTools" src="https://github.com/user-attachments/assets/c37132cd-3b28-44f3-83a3-56ed85e290b7" />

> **Tip:** The integration automatically extracts `sid` and `uev2.id.session` from your cookie string.

## ⚙️ Configuration

| Field | Description |
|-------|-------------|
| **Account Nickname** | A friendly name for this account (e.g., "Personal", "Work") |
| **Time Zone** | Must match your Home Assistant time zone |
| **Cookie String** | Full cookie string from browser DevTools |

## 🔄 Updating Cookies

Sessions expire every 4-6 weeks. When this happens:

1. Go to **Settings** → **Devices & Services** → **Uber Eats**
2. Click the ⋮ menu → **Reconfigure**
3. Paste your new cookie string
4. Done! All entities and automations remain intact

**Or use the sidebar panel:**
1. Click **Uber Eats** in sidebar
2. Click on your account card
3. Click **Edit Account**

## 📊 Entities

### Binary Sensor
| Entity | Description |
|--------|-------------|
| `binary_sensor.<account>_uber_eats_active_order` | On when an order is active |

### Device Tracker
| Entity | Description |
|--------|-------------|
| `device_tracker.<account>_uber_eats_driver` | Driver location for Map card |

### Sensors
| Entity | Description |
|--------|-------------|
| `sensor.<account>_uber_eats_order_stage` | Current stage (Preparing, En Route, etc.) |
| `sensor.<account>_uber_eats_order_status` | Detailed order status |
| `sensor.<account>_uber_eats_driver_name` | Assigned driver's name |
| `sensor.<account>_uber_eats_driver_eta` | Estimated time of arrival |
| `sensor.<account>_uber_eats_driver_ett` | Estimated time (minutes remaining) |
| `sensor.<account>_uber_eats_restaurant_name` | Restaurant name |
| `sensor.<account>_uber_eats_order_id` | Order UUID |
| `sensor.<account>_uber_eats_latest_arrival` | Latest arrival time |
| `sensor.<account>_uber_eats_order_history` | Order history (attribute) |
| `sensor.<account>_uber_eats_driver_latitude` | Driver latitude |
| `sensor.<account>_uber_eats_driver_longitude` | Driver longitude |
| `sensor.<account>_uber_eats_driver_location_street` | Driver's current street |
| `sensor.<account>_uber_eats_driver_location_suburb` | Driver's current suburb |
| `sensor.<account>_uber_eats_driver_location_address` | Full address |

## 🗺️ Map Card Integration

Add your driver to a Map card:

```yaml
type: map
entities:
  - device_tracker.your_account_uber_eats_driver
default_zoom: 14
```

The tracker automatically:
- Shows driver location when order is active and driver assigned
- Falls back to your home location when no active order

## 🤖 Automation Blueprint

Use the official blueprint for TTS announcements:

[![Open your Home Assistant instance and show the blueprint import dialog with a specific blueprint pre-filled.](https://my.home-assistant.io/badges/blueprint_import.svg)](https://my.home-assistant.io/redirect/blueprint_import/?blueprint_url=https%3A%2F%2Fgithub.com%2Fzodyking%2FUber-Eats-Active-Order-Updates-TTS-Blueprint%2Fblob%2Fmain%2Fuber_eats_updates_tts.yaml)

<img width="554" height="1096" alt="Blueprint configuration" src="https://github.com/user-attachments/assets/ff15face-204e-4ad0-8291-33a5e08393ea" />

## 🐛 Issues & Feature Requests

Found a bug or have an idea?

- [🐛 Report a Bug](https://github.com/zodyking/uber-eats-order-tracker/issues/new?template=bug_report.md)
- [✨ Request a Feature](https://github.com/zodyking/uber-eats-order-tracker/issues/new?template=feature_request.md)

## ⚠️ Notes

- This is an **unofficial integration** and may violate Uber's Terms of Service
- Driver location requires an active delivery with an assigned driver
- Cookie sessions expire every 4-6 weeks
- Uses OpenStreetMap Nominatim for reverse geocoding (free, no API key required)

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

---

Developed with ❤️ by [zodyking](https://github.com/zodyking)
