DOMAIN = "uber_eats"

# User input field
CONF_COOKIE = "cookie"
CONF_ACCOUNT_NAME = "account_name"
CONF_TIME_ZONE = "time_zone"

# Internal storage keys (parsed from cookie)
CONF_SID = "sid"
CONF_SESSION_ID = "session_id"

ENDPOINT = "https://www.ubereats.com/api/getActiveOrdersV1"
ENDPOINT_PAST_ORDERS = "https://www.ubereats.com/api/getPastOrdersV1"
HEADERS_TEMPLATE = {
    "Content-Type": "application/json",
    "X-CSRF-Token": "x",
}
