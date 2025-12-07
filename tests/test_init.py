"""Tests for __init__.py module."""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

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
    DOMAIN,
    PLATFORMS,
)

# Check if homeassistant is available for full integration tests
try:
    from homeassistant.config_entries import ConfigEntry
    from homeassistant.const import CONF_HOST, CONF_PORT
    from homeassistant.core import HomeAssistant

    HAS_HOMEASSISTANT = True
except ImportError:
    HAS_HOMEASSISTANT = False
    CONF_HOST = "host"
    CONF_PORT = "port"


from custom_components.ac_modbus import (
    async_setup_entry,
    async_unload_entry,
)


class TestSetupFunctions:
    """Test setup functions without full HA environment."""

    def test_async_setup_entry_exists(self) -> None:
        """Test that async_setup_entry function exists."""
        assert callable(async_setup_entry)

    def test_async_unload_entry_exists(self) -> None:
        """Test that async_unload_entry function exists."""
        assert callable(async_unload_entry)


# Full HA integration tests (only run if homeassistant is available)
if HAS_HOMEASSISTANT:

    @pytest.fixture
    def mock_config_entry(mock_config_entry_data: dict[str, Any]) -> ConfigEntry:
        """Create a mock config entry."""
        entry = MagicMock(spec=ConfigEntry)
        entry.data = mock_config_entry_data
        entry.entry_id = "test_entry_id"
        entry.domain = DOMAIN
        entry.title = mock_config_entry_data[CONF_HOST]
        return entry

    class TestIntegrationSetup:
        """Integration tests for setup (requires HA)."""

        @pytest.mark.asyncio
        async def test_setup_entry_creates_hub(
            self,
            hass: HomeAssistant,
            mock_config_entry: ConfigEntry,
            mock_modbus_client: MagicMock,
        ) -> None:
            """Test that setup_entry creates ModbusHub."""
            with patch(
                "custom_components.ac_modbus.hub.AsyncModbusTcpClient",
                return_value=mock_modbus_client,
            ):
                result = await async_setup_entry(hass, mock_config_entry)
                assert result is True
                assert DOMAIN in hass.data
                assert mock_config_entry.entry_id in hass.data[DOMAIN]

        @pytest.mark.asyncio
        async def test_unload_entry_cleans_up(
            self,
            hass: HomeAssistant,
            mock_config_entry: ConfigEntry,
            mock_modbus_client: MagicMock,
        ) -> None:
            """Test that unload_entry cleans up resources."""
            with patch(
                "custom_components.ac_modbus.hub.AsyncModbusTcpClient",
                return_value=mock_modbus_client,
            ):
                # First set up
                await async_setup_entry(hass, mock_config_entry)

                # Then unload
                result = await async_unload_entry(hass, mock_config_entry)
                assert result is True

                # Verify cleanup
                assert mock_config_entry.entry_id not in hass.data.get(DOMAIN, {})
