"""Tests for ModbusHub module."""

from __future__ import annotations

import asyncio
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from custom_components.ac_modbus.const import (
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

    HAS_HOMEASSISTANT = True
except ImportError:
    HAS_HOMEASSISTANT = False
    CONF_HOST = "host"
    CONF_PORT = "port"

from custom_components.ac_modbus.hub import ModbusHub


class TestHubConnection:
    """Test ModbusHub connection management."""

    @pytest.mark.asyncio
    async def test_hub_initialization(self) -> None:
        """Test hub initializes with correct config."""
        config = {
            CONF_HOST: "192.168.1.100",
            CONF_PORT: DEFAULT_PORT,
        }
        hub = ModbusHub(config)
        assert hub.host == "192.168.1.100"
        assert hub.port == DEFAULT_PORT
        assert hub.is_connected is False

    @pytest.mark.asyncio
    async def test_hub_connect_success(self, mock_modbus_client: MagicMock) -> None:
        """Test successful connection."""
        config = {
            CONF_HOST: "192.168.1.100",
            CONF_PORT: DEFAULT_PORT,
        }
        with patch(
            "custom_components.ac_modbus.hub.AsyncModbusTcpClient",
            return_value=mock_modbus_client,
        ):
            hub = ModbusHub(config)
            result = await hub.connect()
            assert result is True
            assert hub.is_connected is True

    @pytest.mark.asyncio
    async def test_hub_connect_failure(
        self, mock_modbus_client_disconnected: MagicMock
    ) -> None:
        """Test connection failure."""
        config = {
            CONF_HOST: "192.168.1.100",
            CONF_PORT: DEFAULT_PORT,
        }
        with patch(
            "custom_components.ac_modbus.hub.AsyncModbusTcpClient",
            return_value=mock_modbus_client_disconnected,
        ):
            hub = ModbusHub(config)
            result = await hub.connect()
            assert result is False
            assert hub.is_connected is False

    @pytest.mark.asyncio
    async def test_hub_disconnect(self, mock_modbus_client: MagicMock) -> None:
        """Test disconnection."""
        config = {
            CONF_HOST: "192.168.1.100",
            CONF_PORT: DEFAULT_PORT,
        }
        with patch(
            "custom_components.ac_modbus.hub.AsyncModbusTcpClient",
            return_value=mock_modbus_client,
        ):
            hub = ModbusHub(config)
            await hub.connect()
            await hub.disconnect()
            assert hub.is_connected is False
            mock_modbus_client.close.assert_called()

    @pytest.mark.asyncio
    async def test_hub_is_connected_property(
        self, mock_modbus_client: MagicMock
    ) -> None:
        """Test is_connected property."""
        config = {
            CONF_HOST: "192.168.1.100",
            CONF_PORT: DEFAULT_PORT,
        }
        with patch(
            "custom_components.ac_modbus.hub.AsyncModbusTcpClient",
            return_value=mock_modbus_client,
        ):
            hub = ModbusHub(config)
            assert hub.is_connected is False
            await hub.connect()
            assert hub.is_connected is True


class TestHubReadOperations:
    """Test ModbusHub read operations."""

    @pytest.mark.asyncio
    async def test_read_register_success(self, mock_modbus_client: MagicMock) -> None:
        """Test successful register read."""
        config = {
            CONF_HOST: "192.168.1.100",
            CONF_PORT: DEFAULT_PORT,
        }
        with patch(
            "custom_components.ac_modbus.hub.AsyncModbusTcpClient",
            return_value=mock_modbus_client,
        ):
            hub = ModbusHub(config)
            await hub.connect()
            value = await hub.read_register(REGISTER_POWER)
            assert value == 1  # mock returns 1 for REGISTER_POWER

    @pytest.mark.asyncio
    async def test_read_register_timeout(
        self, mock_modbus_client_timeout: MagicMock
    ) -> None:
        """Test register read timeout."""
        config = {
            CONF_HOST: "192.168.1.100",
            CONF_PORT: DEFAULT_PORT,
        }
        with patch(
            "custom_components.ac_modbus.hub.AsyncModbusTcpClient",
            return_value=mock_modbus_client_timeout,
        ):
            hub = ModbusHub(config)
            await hub.connect()
            with pytest.raises(asyncio.TimeoutError):
                await hub.read_register(REGISTER_POWER)

    @pytest.mark.asyncio
    async def test_read_register_exception(
        self, mock_modbus_client_error: MagicMock
    ) -> None:
        """Test register read with Modbus error."""
        config = {
            CONF_HOST: "192.168.1.100",
            CONF_PORT: DEFAULT_PORT,
        }
        with patch(
            "custom_components.ac_modbus.hub.AsyncModbusTcpClient",
            return_value=mock_modbus_client_error,
        ):
            hub = ModbusHub(config)
            await hub.connect()
            with pytest.raises(Exception):
                await hub.read_register(REGISTER_POWER)

    @pytest.mark.asyncio
    async def test_read_multiple_registers(self, mock_modbus_client: MagicMock) -> None:
        """Test reading multiple registers."""
        config = {
            CONF_HOST: "192.168.1.100",
            CONF_PORT: DEFAULT_PORT,
        }
        with patch(
            "custom_components.ac_modbus.hub.AsyncModbusTcpClient",
            return_value=mock_modbus_client,
        ):
            hub = ModbusHub(config)
            await hub.connect()
            power = await hub.read_register(REGISTER_POWER)
            mode = await hub.read_register(REGISTER_MODE)
            assert power == 1
            assert mode == 1


class TestHubWriteOperations:
    """Test ModbusHub write operations."""

    @pytest.mark.asyncio
    async def test_write_register_success(
        self, mock_modbus_client: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test successful register write."""
        config = {
            CONF_HOST: "192.168.1.100",
            CONF_PORT: DEFAULT_PORT,
        }
        with patch(
            "custom_components.ac_modbus.hub.AsyncModbusTcpClient",
            return_value=mock_modbus_client,
        ):
            hub = ModbusHub(config)
            await hub.connect()
            result = await hub.write_register(REGISTER_POWER, 0)
            assert result is True

    @pytest.mark.asyncio
    async def test_write_register_timeout(
        self, mock_modbus_client_timeout: MagicMock
    ) -> None:
        """Test register write timeout."""
        config = {
            CONF_HOST: "192.168.1.100",
            CONF_PORT: DEFAULT_PORT,
        }
        with patch(
            "custom_components.ac_modbus.hub.AsyncModbusTcpClient",
            return_value=mock_modbus_client_timeout,
        ):
            hub = ModbusHub(config)
            await hub.connect()
            with pytest.raises(asyncio.TimeoutError):
                await hub.write_register(REGISTER_POWER, 0)

    @pytest.mark.asyncio
    async def test_write_with_verify_success(
        self, mock_modbus_client: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test write with readback verification success."""
        config = {
            CONF_HOST: "192.168.1.100",
            CONF_PORT: DEFAULT_PORT,
        }
        with patch(
            "custom_components.ac_modbus.hub.AsyncModbusTcpClient",
            return_value=mock_modbus_client,
        ):
            hub = ModbusHub(config)
            await hub.connect()
            result = await hub.write_register(REGISTER_POWER, 0, verify=True)
            assert result is True
            # Verify the mock was updated
            readback = await hub.read_register(REGISTER_POWER)
            assert readback == 0

    @pytest.mark.asyncio
    async def test_write_verify_mismatch(self, mock_modbus_client: MagicMock) -> None:
        """Test write with readback mismatch."""
        config = {
            CONF_HOST: "192.168.1.100",
            CONF_PORT: DEFAULT_PORT,
        }
        with patch(
            "custom_components.ac_modbus.hub.AsyncModbusTcpClient",
            return_value=mock_modbus_client,
        ):
            hub = ModbusHub(config)
            await hub.connect()

            # Patch readback to return different value
            original_read = mock_modbus_client.read_holding_registers

            async def mock_read_mismatch(address: int, count: int = 1, slave: int = 1):
                result = MagicMock()
                result.isError = MagicMock(return_value=False)
                result.registers = [99]  # Different from written value
                return result

            mock_modbus_client.read_holding_registers = AsyncMock(
                side_effect=mock_read_mismatch
            )

            with pytest.raises(ValueError, match="mismatch"):
                await hub.write_register(REGISTER_POWER, 0, verify=True)

    @pytest.mark.asyncio
    async def test_write_verify_expected_value(
        self, mock_modbus_client: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test write with custom expected value for verification."""
        config = {
            CONF_HOST: "192.168.1.100",
            CONF_PORT: DEFAULT_PORT,
        }
        with patch(
            "custom_components.ac_modbus.hub.AsyncModbusTcpClient",
            return_value=mock_modbus_client,
        ):
            hub = ModbusHub(config)
            await hub.connect()
            # Write 1 but expect readback to be 1 (already set by mock)
            result = await hub.write_register(
                REGISTER_POWER, 1, verify=True, expected=1
            )
            assert result is True


class TestHubReconnection:
    """Test ModbusHub reconnection behavior."""

    @pytest.mark.asyncio
    async def test_reconnect_on_connection_lost(
        self, mock_modbus_client: MagicMock
    ) -> None:
        """Test automatic reconnection when connection is lost."""
        config = {
            CONF_HOST: "192.168.1.100",
            CONF_PORT: DEFAULT_PORT,
        }
        with patch(
            "custom_components.ac_modbus.hub.AsyncModbusTcpClient",
            return_value=mock_modbus_client,
        ):
            hub = ModbusHub(config)
            await hub.connect()

            # Simulate connection loss
            mock_modbus_client.connected = False

            # Attempt to reconnect
            result = await hub.reconnect()
            assert result is True
            assert hub.is_connected is True

    @pytest.mark.asyncio
    async def test_backoff_strategy(
        self, mock_modbus_client_disconnected: MagicMock
    ) -> None:
        """Test backoff on repeated failures."""
        config = {
            CONF_HOST: "192.168.1.100",
            CONF_PORT: DEFAULT_PORT,
        }
        with patch(
            "custom_components.ac_modbus.hub.AsyncModbusTcpClient",
            return_value=mock_modbus_client_disconnected,
        ):
            hub = ModbusHub(config)

            # First attempt fails
            result1 = await hub.connect()
            assert result1 is False

            # Backoff count should increase
            assert hub.backoff_count >= 1

    @pytest.mark.asyncio
    async def test_reconnect_failure(
        self, mock_modbus_client_disconnected: MagicMock
    ) -> None:
        """Test reconnection failure handling."""
        config = {
            CONF_HOST: "192.168.1.100",
            CONF_PORT: DEFAULT_PORT,
        }
        with patch(
            "custom_components.ac_modbus.hub.AsyncModbusTcpClient",
            return_value=mock_modbus_client_disconnected,
        ):
            hub = ModbusHub(config)
            result = await hub.reconnect()
            assert result is False
            assert hub.is_connected is False


class TestHubErrorHandling:
    """Test ModbusHub error handling."""

    @pytest.mark.asyncio
    async def test_last_error_tracking(
        self, mock_modbus_client_error: MagicMock
    ) -> None:
        """Test that last error is tracked."""
        config = {
            CONF_HOST: "192.168.1.100",
            CONF_PORT: DEFAULT_PORT,
        }
        with patch(
            "custom_components.ac_modbus.hub.AsyncModbusTcpClient",
            return_value=mock_modbus_client_error,
        ):
            hub = ModbusHub(config)
            await hub.connect()

            try:
                await hub.read_register(REGISTER_POWER)
            except Exception:
                pass

            assert hub.last_error is not None

    @pytest.mark.asyncio
    async def test_error_timestamp(self, mock_modbus_client_error: MagicMock) -> None:
        """Test that error timestamp is recorded."""
        config = {
            CONF_HOST: "192.168.1.100",
            CONF_PORT: DEFAULT_PORT,
        }
        with patch(
            "custom_components.ac_modbus.hub.AsyncModbusTcpClient",
            return_value=mock_modbus_client_error,
        ):
            hub = ModbusHub(config)
            await hub.connect()

            try:
                await hub.read_register(REGISTER_POWER)
            except Exception:
                pass

            assert hub.last_error_time is not None
