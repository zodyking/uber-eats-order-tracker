# Changelog

All notable changes to this project will be documented here.

---

## Version 1.2.0

**Released:** January 31, 2025

### What's New

#### Sidebar Panel
A dedicated Uber Eats panel has been added to your Home Assistant sidebar. From here you can:
- View all your accounts and their current order status
- See a real-time map showing driver location (or your home when no order is active)
- Follow step-by-step instructions for adding new accounts
- Edit or delete accounts without leaving the panel
- Monitor connection status for each account

The panel features an Uber Eats-inspired dark theme for a familiar look and feel.

#### Device Tracker
A new device tracker entity makes it easy to display your driver's location on any Home Assistant Map card. The tracker:
- Shows the driver's real-time position when you have an active order
- Automatically switches to your home location when there's no delivery in progress
- Includes helpful attributes like driver name, ETA, and street address

#### Simplified Authentication
Setting up the integration is now much easier:
- Just paste your full cookie string from the browser — no need to hunt for specific values
- The integration automatically extracts what it needs (`sid` and `uev2.id.session`)
- Clear error messages guide you if something's missing

#### Easy Cookie Updates
When your session expires (typically every 4-6 weeks), you no longer need to delete and re-add the integration:
- Use the **Reconfigure** option to update your cookie
- All your entities, automations, and settings stay intact
- The integration will prompt you automatically when reauthentication is needed

#### Better Reliability
- Authentication now uses the updated `uev2.id.session` cookie (replacing the deprecated `uuid`)
- Credentials are validated against two API endpoints during setup for more reliable verification
- Improved error handling with clearer messages when things go wrong
- Fixed compatibility issues with Home Assistant 2025.11 and later

#### All the Sensors You Need
Track every detail of your order with sensors for:
- Order stage and status
- Driver name and ETA (with minutes remaining)
- Restaurant name
- Driver location (latitude, longitude, street, suburb, full address)
- Order history

Plus a binary sensor that tells you when an order is active.

#### Multi-Account Support
Add multiple Uber Eats accounts with unique nicknames. Each account is tracked independently with its own set of sensors.

---

## Previous Versions

Initial beta releases focused on core order tracking functionality, real-time updates, and reverse geocoding using OpenStreetMap.
