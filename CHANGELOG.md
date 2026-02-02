# Changelog

All notable changes to this project will be documented here.

---

## Version 1.2.2

**Released:** February 1, 2026

### Changed

- **Panel – Dashboard card order status:** Order Status now uses conditional logic: "Preparing order" when active but no driver; "Arriving" when driver is within 1000 ft of address; "Arrived" when within 300 ft; otherwise shows the order stage from the integration (Preparing, Picked up, En route, etc.).
- **Panel – Dashboard card driver/location:** When no driver is assigned, the card shows Driver: "Not assigned" and Location: "None yet" (UI only; sensor values unchanged).

### Added

- **Panel – Dashboard card ETA and ETT:** Dashboard account cards now show ETA (estimated time of arrival) and ETT (estimated time in minutes) when an order is active, using the same data as the driver_eta and driver_ett sensors.

---

## Version 1.2.1

**Released:** February 1, 2026

### Changed

- **Panel – Order Information card:** Removed Time Zone from the Order Information card (time zone remains in Account Details).
- **Panel – Live updates:** Main page and account details page now refresh data every 15 seconds without requiring a page reload (Status, API Connection, order info, driver ETA, etc. update in place).

### Added

- **Panel – Hamburger menu (mobile):** On viewports 870px and below, a hamburger button appears in the panel header. Tapping it opens Home Assistant’s main sidebar so users can access navigation and settings without leaving the panel.
