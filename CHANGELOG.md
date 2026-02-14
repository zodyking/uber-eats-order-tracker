# Changelog

All notable changes to this project will be documented here. Formatted as GitHub release notes.

---

## [1.4.3]

### Added

- **Stats & past orders caching** – Statistics and past orders cached per account; account details load instantly from cache and refresh in the background
- **Per-player TTS engine** – Each media player card has its own TTS engine selector
- **Per-player TTS test button** – Test button inside each media player card (default message: "uber eats", no text field)
- **Sensor mock data doc** – `Agent-Files/sensor-mock-data.md` reference for all sensor states and attributes

### Changed

- **No-order card** – Removed "NO ORDER" badge; centered and enlarged "Waiting for orders..." text
- **Restaurant addresses** – Removed empty fields (e.g. double commas): `2592 Atlantic Ave, , NY 11207` → `2592 Atlantic Ave, NY 11207`
- **TTS notifications** – Support per-player TTS entities via `per_player_settings` (tts_entity_id, cache, language, options)
- **Device tracker** – Renamed from "{account} Uber Eats Driver" to "{account} Uber Eats Order Tracker"
- **Sensor states** – All sensors now show "No active order" or order count ("1", "2", …); per-order data in attributes only

### Fixed

- **Media player toggle** – Toggle knob no longer extends outside its track when active

### Removed

- **Rating field** – Removed from past order cards
- **Global TTS engine select** – Moved into each media player card
- **Global TTS test section** – Replaced by per-player test buttons

---

## [1.4.2]

### Added

- **Multi-order tracking** – Track multiple active orders per account; one card per order
- **Per-order sensor attributes** – `order1_driver_name`, `order2_restaurant_name`, etc. for all order fields
- **User profile polling** – `getUserV1` polled on every update; account name and picture update when they change
- **3-column card layout** – Account picture (left), info (center), map (right)
- **Media player sub-cards** – Cache, language, and options inside each media player dropdown
- **Card design doc** – Layout documented in `Agent-Files/card.md`

### Changed

- **Account profile picture** – Rounded square, larger, appended to left with full account name overlaid
- **Driver picture** – Square (not circle) with driver name overlaid below
- **Map placement** – Map appended to right side of card
- **Config flow** – Account name uses `firstName` + `lastName` from `getUserV1` instead of nickname
- **Profile pictures** – All account and driver pictures loaded from API URLs (`getUserV1`, order data)
- **Past orders & statistics** – Load from `getPastOrders` API; display and calculate with Python
- **Coordinator** – Parses `orders` array; `_parse_single_order` helper; backward-compatible flat fields from first order
- **WebSocket** – Sends `orders` array and `orders_count` to frontend

### Fixed

- **Auth error** – "Error wrong credentials" when `getUserV1` fails

### Removed

- **"Newer data" field** – Removed from main card

---

## [1.3.2]

**Released:** February 9, 2026

### Changed

- **Panel – Account name button:** Transparent background styling; direct click listener (same pattern as Edit Account) for reliable navigation to account details
- **Integration:** Manifest loading now uses async executor to avoid blocking the event loop

---

## [1.3.1]

**Released:** February 9, 2026

### Changed

- **Panel – Account card:** Account name is now a clickable button (visually unchanged) that opens account details; card clicks use event delegation for reliable navigation after auto-refresh
- **Panel – Account card:** Removed the separate "View details" button

---

## [1.2.3]

**Released:** February 1, 2026

### Changed

- **Panel – Account details page (ORDER INFORMATION):** Order Status uses conditional logic: "Preparing order" when active but no driver; "Arriving" when driver within 1000 ft; "Arrived" when within 300 ft; otherwise order stage from integration
- **Panel – Account details page driver/location:** When no driver, shows "Not assigned" and "None yet" / "—"

### Added

- **Panel – Account details page ETT:** ETT (estimated time in minutes) field added to Order Information card

---

## [1.2.2]

**Released:** February 1, 2026

### Changed

- **Panel – Dashboard card order status:** Conditional logic for Order Status (Preparing order, Arriving, Arrived, etc.)
- **Panel – Dashboard card driver/location:** Shows "Not assigned" and "None yet" when no driver

### Added

- **Panel – Dashboard card ETA and ETT:** ETA and ETT shown when order is active

---

## [1.2.1]

**Released:** February 1, 2026

### Changed

- **Panel – Order Information card:** Removed Time Zone (still in Account Details)
- **Panel – Live updates:** Main and account details pages refresh every 15 seconds without reload

### Added

- **Panel – Hamburger menu (mobile):** On viewports ≤870px, hamburger button opens HA sidebar for navigation
