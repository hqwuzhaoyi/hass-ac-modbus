"""Shared fixtures for ac_modbus tests.

Note: For full Home Assistant integration testing, install:
  pip install pytest-homeassistant-custom-component

For basic unit testing without HA dependencies, this conftest provides
mock fixtures for Modbus client testing.
"""

from __future__ import annotations

from collections.abc import Generator
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

# Import our constants
from custom_components.ac_modbus.const import (
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
    REGISTER_MODE,
    REGISTER_POWER,
)

# Check if homeassistant is available
try:
    from homeassistant.const import CONF_HOST, CONF_PORT
    from homeassistant.core import HomeAssistant

    HAS_HOMEASSISTANT = True
except ImportError:
    HAS_HOMEASSISTANT = False
    # Define minimal constants for testing without HA
    CONF_HOST = "host"
    CONF_PORT = "port"

# Use HA test plugin if available
if HAS_HOMEASSISTANT:
    pytest_plugins = "pytest_homeassistant_custom_component"


@pytest.fixture
def mock_config_entry_data() -> dict[str, Any]:
    """Return a valid config entry data dict."""
    return {
        CONF_HOST: "192.168.1.100",
        CONF_PORT: DEFAULT_PORT,
        CONF_UNIT_ID: DEFAULT_UNIT_ID,
        CONF_POLL_INTERVAL: DEFAULT_POLL_INTERVAL,
        CONF_TIMEOUT: DEFAULT_TIMEOUT,
        CONF_RECONNECT_BACKOFF: DEFAULT_RECONNECT_BACKOFF,
        CONF_MODE_MAP: DEFAULT_MODE_MAP,
    }


@pytest.fixture
def mock_modbus_responses() -> dict[int, int]:
    """Return default mock Modbus register responses."""
    return {
        REGISTER_POWER: 1,  # Power ON
        REGISTER_MODE: 1,  # Cool mode
    }


@pytest.fixture
def mock_modbus_client(
    mock_modbus_responses: dict[int, int],
) -> Generator[MagicMock, None, None]:
    """Create a mock Modbus client."""
    mock_client = MagicMock()
    mock_client.connected = True
    mock_client.close = MagicMock()

    async def mock_connect():
        mock_client.connected = True
        return True

    mock_client.connect = AsyncMock(side_effect=mock_connect)

    # Mock read_holding_registers
    async def mock_read(address: int, count: int = 1, **kwargs):
        result = MagicMock()
        if address in mock_modbus_responses:
            result.isError = MagicMock(return_value=False)
            result.registers = [mock_modbus_responses[address]]
        else:
            result.isError = MagicMock(return_value=False)
            result.registers = [0]
        return result

    mock_client.read_holding_registers = AsyncMock(side_effect=mock_read)

    # Mock write_register
    async def mock_write(address: int, value: int, **kwargs):
        result = MagicMock()
        result.isError = MagicMock(return_value=False)
        # Update the mock responses to reflect the write
        mock_modbus_responses[address] = value
        return result

    mock_client.write_register = AsyncMock(side_effect=mock_write)

    yield mock_client


@pytest.fixture
def mock_modbus_client_disconnected() -> Generator[MagicMock, None, None]:
    """Create a mock Modbus client that fails to connect."""
    mock_client = MagicMock()
    mock_client.connected = False

    async def mock_connect():
        mock_client.connected = False
        return False

    mock_client.connect = AsyncMock(side_effect=mock_connect)
    mock_client.close = MagicMock()

    yield mock_client


@pytest.fixture
def mock_modbus_client_timeout() -> Generator[MagicMock, None, None]:
    """Create a mock Modbus client that times out on operations."""
    mock_client = MagicMock()
    mock_client.connected = True

    async def mock_connect():
        mock_client.connected = True
        return True

    mock_client.connect = AsyncMock(side_effect=mock_connect)
    mock_client.close = MagicMock()

    # Mock operations that timeout
    async def mock_timeout(*args, **kwargs):
        raise TimeoutError("Modbus operation timed out")

    mock_client.read_holding_registers = AsyncMock(side_effect=mock_timeout)
    mock_client.write_register = AsyncMock(side_effect=mock_timeout)

    yield mock_client


@pytest.fixture
def mock_modbus_client_error() -> Generator[MagicMock, None, None]:
    """Create a mock Modbus client that returns errors."""
    mock_client = MagicMock()
    mock_client.connected = True

    async def mock_connect():
        mock_client.connected = True
        return True

    mock_client.connect = AsyncMock(side_effect=mock_connect)
    mock_client.close = MagicMock()

    # Mock operations that return errors
    async def mock_error_read(*args, **kwargs):
        result = MagicMock()
        result.isError = MagicMock(return_value=True)
        return result

    async def mock_error_write(*args, **kwargs):
        result = MagicMock()
        result.isError = MagicMock(return_value=True)
        return result

    mock_client.read_holding_registers = AsyncMock(side_effect=mock_error_read)
    mock_client.write_register = AsyncMock(side_effect=mock_error_write)

    yield mock_client


# HA-specific fixtures (only available when homeassistant is installed)
if HAS_HOMEASSISTANT:

    @pytest.fixture
    def auto_enable_custom_integrations(enable_custom_integrations):
        """Enable custom integrations defined in the test dir."""
        yield

    @pytest.fixture
    def expected_lingering_timers() -> bool:
        """Adjust for lingering timers."""
        return True
