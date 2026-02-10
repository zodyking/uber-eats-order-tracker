DOMAIN = "uber_eats"

# User input field
CONF_COOKIE = "cookie"
CONF_ACCOUNT_NAME = "account_name"
CONF_TIME_ZONE = "time_zone"

# Internal storage keys (parsed from cookie)
CONF_SID = "sid"
CONF_SESSION_ID = "session_id"

# TTS notification settings (stored in config entry options, managed via panel UI)
CONF_TTS_ENABLED = "tts_enabled"
CONF_TTS_ENTITY_ID = "tts_entity_id"
CONF_TTS_MEDIA_PLAYERS = "tts_media_players"
CONF_TTS_MESSAGE_PREFIX = "tts_message_prefix"
CONF_TTS_VOLUME = "tts_volume"
CONF_TTS_INTERVAL_ENABLED = "tts_interval_enabled"
CONF_TTS_INTERVAL_MINUTES = "tts_interval_minutes"
DEFAULT_TTS_MESSAGE_PREFIX = "Message from Uber Eats"
DEFAULT_TTS_VOLUME = 0.5
DEFAULT_TTS_INTERVAL_MINUTES = 10

# Driver nearby action: trigger automation when within distance (UI-controlled)
CONF_DRIVER_NEARBY_AUTOMATION_ENABLED = "driver_nearby_automation_enabled"
CONF_DRIVER_NEARBY_AUTOMATION_ENTITY = "driver_nearby_automation_entity"
CONF_DRIVER_NEARBY_DISTANCE_FEET = "driver_nearby_distance_feet"
DEFAULT_DRIVER_NEARBY_DISTANCE_FEET = 200

ENDPOINT = "https://www.ubereats.com/api/getActiveOrdersV1"
ENDPOINT_PAST_ORDERS = "https://www.ubereats.com/api/getPastOrdersV1"
HEADERS_TEMPLATE = {
    "Content-Type": "application/json",
    "X-CSRF-Token": "x",
}
