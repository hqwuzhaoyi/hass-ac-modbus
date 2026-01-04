"""Constants for the AC Modbus integration."""

from typing import Final

# Domain
DOMAIN: Final = "ac_modbus"

# Config keys
CONF_UNIT_ID: Final = "unit_id"
CONF_POLL_INTERVAL: Final = "poll_interval"
CONF_TIMEOUT: Final = "timeout"
CONF_RECONNECT_BACKOFF: Final = "reconnect_backoff"
CONF_MODE_MAP: Final = "mode_map"
CONF_SCAN_START: Final = "scan_start"
CONF_SCAN_END: Final = "scan_end"
CONF_SCAN_STEP: Final = "scan_step"

# Default values
DEFAULT_PORT: Final = 502
DEFAULT_UNIT_ID: Final = 1
DEFAULT_POLL_INTERVAL: Final = 10  # seconds
DEFAULT_TIMEOUT: Final = 3  # seconds
DEFAULT_RECONNECT_BACKOFF: Final = 5  # seconds
DEFAULT_SCAN_STEP: Final = 1

# Register addresses
REGISTER_POWER: Final = 1033  # Power on/off (0=off, 1=on)
REGISTER_HOME_AWAY: Final = 1034  # Home/Away (0=away, 1=home) - requires power ON
REGISTER_MODE: Final = 1041  # Operating mode - requires power OFF
REGISTER_HUMIDIFY: Final = 1168  # Humidify on/off (0=off, 1=on) - requires power ON

# Mode map: register value -> mode name
DEFAULT_MODE_MAP: Final = {
    1: "cool",  # 制冷
    2: "heat",  # 制热
    3: "fan_only",  # 通风
    4: "dry",  # 除湿
}

# Constraints
MIN_POLL_INTERVAL: Final = 5  # seconds
MAX_SCAN_RANGE: Final = 100  # registers

# Platforms
PLATFORMS: Final = ["switch", "select", "sensor", "button"]

# Filter replacement tracking
FILTER_CYCLE_DAYS: Final = 90  # Days between filter replacements
FILTER_STORAGE_KEY: Final = "ac_modbus.filter"
FILTER_STORAGE_VERSION: Final = 1

# Services
SERVICE_WRITE_REGISTER: Final = "write_register"
SERVICE_SCAN_RANGE: Final = "scan_range"

# Events
EVENT_SCAN_RESULT: Final = "ac_modbus_scan_result"

# Attributes
ATTR_REGISTER: Final = "register"
ATTR_VALUE: Final = "value"
ATTR_VERIFIED: Final = "verified"
ATTR_READBACK: Final = "readback"
ATTR_ERROR: Final = "error"
ATTR_START: Final = "start"
ATTR_END: Final = "end"
ATTR_STEP: Final = "step"
ATTR_RESULTS: Final = "results"
