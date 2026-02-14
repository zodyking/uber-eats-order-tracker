# v0.9.1 - Home Assistant 2025.11 Compatibility Fix

## Fixed
- Fixed integration setup error in Home Assistant 2025.11+ by replacing `async_config_entry_first_refresh()` with direct credential validation
- Added missing timezone `America/Costa_Rica` to timezone selection dropdown
- Improved error handling during integration setup with proper exception catching and user-friendly error messages
- Enhanced error logging with full stack traces for better debugging

## Changed
- Credential validation now uses direct API calls instead of coordinator refresh during config flow
- Error messages are now more descriptive and include guidance to check logs

## Added
- Comprehensive exception handling in config flow and integration setup
- Better error logging throughout the integration
- Translation support for unknown errors

