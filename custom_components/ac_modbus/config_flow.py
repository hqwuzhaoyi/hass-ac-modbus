"""Config flow for AC Modbus integration."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import voluptuous as vol

from .const import (
    CONF_MODE_MAP,
    CONF_POLL_INTERVAL,
    CONF_RECONNECT_BACKOFF,
    CONF_TIMEOUT,
    CONF_UNIT_ID,
    DEFAULT_MODE_MAP,
    DEFAULT_POLL_INTERVAL,
    DEFAULT_PORT,
    DEFAULT_RECONNECT_BACKOFF,
    DEFAULT_TIMEOUT,
    DEFAULT_UNIT_ID,
    DOMAIN,
    MIN_POLL_INTERVAL,
)

_LOGGER = logging.getLogger(__name__)

# Check if homeassistant is available
try:
    from homeassistant import config_entries
    from homeassistant.const import CONF_HOST, CONF_PORT
    from homeassistant.core import HomeAssistant
    from homeassistant.data_entry_flow import FlowResult

    HAS_HOMEASSISTANT = True
except ImportError:
    HAS_HOMEASSISTANT = False
    CONF_HOST = "host"
    CONF_PORT = "port"

# Check if pymodbus is available
try:
    from pymodbus.client import AsyncModbusTcpClient

    HAS_PYMODBUS = True
except ImportError:
    HAS_PYMODBUS = False
    AsyncModbusTcpClient = None  # type: ignore[misc, assignment]


def validate_input(user_input: dict[str, Any]) -> dict[str, str]:
    """Validate user input and return errors dict.

    Args:
        user_input: Dictionary containing user configuration input.

    Returns:
        Dictionary of field names to error codes. Empty if all valid.
    """
    errors: dict[str, str] = {}

    # Validate host
    host = user_input.get(CONF_HOST, "")
    if not host or not isinstance(host, str) or len(host.strip()) == 0:
        errors["host"] = "invalid_host"

    # Validate port
    port = user_input.get(CONF_PORT, DEFAULT_PORT)
    if not isinstance(port, int) or port < 1 or port > 65535:
        errors["port"] = "invalid_port"

    # Validate poll interval (if provided)
    poll_interval = user_input.get(CONF_POLL_INTERVAL)
    if poll_interval is not None:
        if not isinstance(poll_interval, (int, float)) or poll_interval < MIN_POLL_INTERVAL:
            errors["poll_interval"] = "poll_interval_too_low"

    # Validate timeout vs poll interval
    timeout = user_input.get(CONF_TIMEOUT)
    if timeout is not None and poll_interval is not None:
        if timeout >= poll_interval:
            errors["timeout"] = "timeout_exceeds_poll"

    return errors


async def validate_connection(
    host: str,
    port: int,
    timeout: float = DEFAULT_TIMEOUT,
) -> bool:
    """Test connection to Modbus device.

    Args:
        host: Modbus device host/IP.
        port: Modbus device port.
        timeout: Connection timeout in seconds.

    Returns:
        True if connection successful, False otherwise.
    """
    if not HAS_PYMODBUS or AsyncModbusTcpClient is None:
        _LOGGER.warning("pymodbus not available, skipping connection validation")
        return True

    try:
        client = AsyncModbusTcpClient(host=host, port=port, timeout=timeout)
        connected = await asyncio.wait_for(client.connect(), timeout=timeout)
        if connected:
            client.close()
            return True
        return False
    except asyncio.TimeoutError:
        _LOGGER.error("Connection to %s:%s timed out", host, port)
        return False
    except Exception as ex:
        _LOGGER.error("Failed to connect to %s:%s: %s", host, port, ex)
        return False


def get_user_data_schema(
    defaults: dict[str, Any] | None = None,
) -> vol.Schema:
    """Build the data schema for user configuration.

    Args:
        defaults: Optional dictionary of default values.

    Returns:
        Voluptuous schema for config flow form.
    """
    defaults = defaults or {}

    return vol.Schema(
        {
            vol.Required(
                CONF_HOST,
                default=defaults.get(CONF_HOST, ""),
            ): str,
            vol.Required(
                CONF_PORT,
                default=defaults.get(CONF_PORT, DEFAULT_PORT),
            ): vol.Coerce(int),
            vol.Optional(
                CONF_UNIT_ID,
                default=defaults.get(CONF_UNIT_ID, DEFAULT_UNIT_ID),
            ): vol.Coerce(int),
            vol.Optional(
                CONF_POLL_INTERVAL,
                default=defaults.get(CONF_POLL_INTERVAL, DEFAULT_POLL_INTERVAL),
            ): vol.Coerce(int),
            vol.Optional(
                CONF_TIMEOUT,
                default=defaults.get(CONF_TIMEOUT, DEFAULT_TIMEOUT),
            ): vol.Coerce(int),
            vol.Optional(
                CONF_RECONNECT_BACKOFF,
                default=defaults.get(CONF_RECONNECT_BACKOFF, DEFAULT_RECONNECT_BACKOFF),
            ): vol.Coerce(int),
        }
    )


# Only define ConfigFlow class if homeassistant is available
if HAS_HOMEASSISTANT:

    class ACModbusConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
        """Handle a config flow for AC Modbus."""

        VERSION = 1

        async def async_step_user(
            self,
            user_input: dict[str, Any] | None = None,
        ) -> FlowResult:
            """Handle the initial step.

            Args:
                user_input: User input from form, None if form not submitted.

            Returns:
                FlowResult for form display or entry creation.
            """
            errors: dict[str, str] = {}

            if user_input is not None:
                # Validate input
                errors = validate_input(user_input)

                if not errors:
                    # Test connection
                    can_connect = await validate_connection(
                        host=user_input[CONF_HOST],
                        port=user_input[CONF_PORT],
                        timeout=user_input.get(CONF_TIMEOUT, DEFAULT_TIMEOUT),
                    )

                    if not can_connect:
                        errors["base"] = "cannot_connect"

                if not errors:
                    # Set unique ID based on host:port
                    unique_id = f"{user_input[CONF_HOST]}:{user_input[CONF_PORT]}"
                    await self.async_set_unique_id(unique_id)
                    self._abort_if_unique_id_configured()

                    # Add default mode_map if not provided
                    data = dict(user_input)
                    if CONF_MODE_MAP not in data:
                        data[CONF_MODE_MAP] = DEFAULT_MODE_MAP

                    return self.async_create_entry(
                        title=user_input[CONF_HOST],
                        data=data,
                    )

            return self.async_show_form(
                step_id="user",
                data_schema=get_user_data_schema(user_input),
                errors=errors,
            )
