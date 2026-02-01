# Changelog

All notable changes to this integration will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2025-01-31

### Added
- **Sidebar Panel** — Dedicated Uber Eats panel in Home Assistant sidebar
  - View all accounts and order status at a glance
  - Real-time map showing driver location or home when idle
  - Step-by-step instructions page for adding new accounts
  - Edit and delete accounts directly from the panel
  - Uber Eats dark theme (#0f0f0f background, #06C167 accents)
  - Connection status indicator (Connected/Error/Retrying)
  - Auto-refresh every 15 seconds
- **Device Tracker Entity** — Map card compatible driver tracking
  - Shows driver location when order is active and driver assigned
  - Automatically falls back to home location when no active order
  - Compatible with Home Assistant Map card
  - Includes driver name, ETA, street address as attributes
- **WebSocket API** — Backend communication for sidebar panel
  - `uber_eats/get_accounts` — Get all configured accounts with status
  - `uber_eats/get_account_data` — Get detailed data for specific account
  - `uber_eats/delete_account` — Remove an account
- **GitHub Issue Templates** — YAML form-based templates
  - Bug report template with dropdowns and checkboxes
  - Feature request template with structured fields

### Changed
- Panel cards now show useful sensor fields (Order Status, Restaurant, Driver, Location)
- Map height increased to 240px to avoid footer overlap
- Map overlay moved to top-left corner
- Removed timezone display from inactive account cards

## [1.1.0] - 2025-01-31

### Added
- Initial sidebar panel implementation
- Device tracker for map integration

## [1.0.0] - 2025-01-31

### Added
- **Single Cookie String Input** — Users now paste the full cookie string from browser DevTools
  - Integration automatically extracts `sid` and `uev2.id.session` values
  - No need to manually find individual cookie values
  - Comprehensive validation with helpful error messages
- **Reconfigure Flow** — Update cookies without deleting the integration
  - Access via Settings → Devices & Services → Uber Eats → ⋮ → Reconfigure
  - All entities and automations remain intact
- **Reauthentication Flow** — Automatic prompts when session expires
  - Integration detects 401/403 responses and triggers reauth
  - User-friendly notification to update cookies
- **Dual API Validation** — Config flow validates against both endpoints
  - Tests `getActiveOrdersV1` and `getPastOrdersV1` during setup
  - More reliable credential verification

### Changed
- **Cookie Authentication** — Switched from `uuid` to `uev2.id.session`
  - Fixes authentication issues reported by users
  - `uuid` cookie no longer works with Uber Eats API
- **Field Naming** — Renamed "Account Name" to "Account Nickname"
  - Clearer terminology for users
- **Config Flow Version** — Updated to version 2 for migration support
- **Cookie Header Format** — Now uses `sid={sid}; uev2.id.session={session_id}`

### Fixed
- Authentication failures due to deprecated `uuid` cookie
- Users no longer need to manually edit configuration files to update cookies

### Security
- Full cookie string is parsed but only required values (`sid`, `session_id`) are stored
- Sensitive cookie data is not logged

## [0.9.1] - 2025-01-XX

### Fixed
- Fixed integration setup error in Home Assistant 2025.11+ by replacing `async_config_entry_first_refresh()` with direct credential validation
- Added missing timezone `America/Costa_Rica` to timezone selection dropdown
- Improved error handling during integration setup with proper exception catching and user-friendly error messages
- Enhanced error logging with full stack traces for better debugging

### Changed
- Credential validation now uses direct API calls instead of coordinator refresh during config flow
- Error messages are now more descriptive and include guidance to check logs

### Added
- Comprehensive exception handling in config flow and integration setup
- Better error logging throughout the integration
- Translation support for unknown errors

## [0.9.0] - 2025-01-XX

### Added
- **Order Tracking** — Real-time monitoring with 15-second updates
- **Sensors** — Comprehensive entity coverage:
  - Order stage and status
  - Driver name and ETA
  - Restaurant name
  - Order ID and history
  - Driver latitude/longitude
  - Driver location (street, suburb, quarter, county, full address)
- **Binary Sensor** — Active order detection
- **Multi-Account Support** — Track multiple Uber Eats accounts
- **Reverse Geocoding** — Driver location converted to street addresses using OpenStreetMap Nominatim
- **Order History** — Track past orders with history attribute
- **Time Zone Support** — Configurable timezone for accurate API calls
- **HACS Support** — Easy installation via Home Assistant Community Store

### Technical
- Uses `aiohttp` for async HTTP requests
- `DataUpdateCoordinator` for efficient data management
- Automatic label creation for entity organization
