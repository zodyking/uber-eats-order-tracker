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
DEFAULT_TTS_MESSAGE_PREFIX = "Message from Uber Eats"

ENDPOINT = "https://www.ubereats.com/api/getActiveOrdersV1"
ENDPOINT_PAST_ORDERS = "https://www.ubereats.com/api/getPastOrdersV1"
HEADERS_TEMPLATE = {
    "Content-Type": "application/json",
    "X-CSRF-Token": "x",
}
