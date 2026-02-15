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

---

Developed with ❤️ by [zodyking](https://github.com/zodyking)
