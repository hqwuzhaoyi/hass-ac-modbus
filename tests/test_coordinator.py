"""Tests for DataUpdateCoordinator module."""

from __future__ import annotations

import asyncio
from datetime import timedelta
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from custom_components.ac_modbus.const import (
    DEFAULT_POLL_INTERVAL,
    DEFAULT_PORT,
    REGISTER_MODE,
    REGISTER_POWER,
)

# Check if homeassistant is available
try:
    from homeassistant.const import CONF_HOST, CONF_PORT
    from homeassistant.core import HomeAssistant
    from homeassistant.helpers.update_coordinator import UpdateFailed

    HAS_HOMEASSISTANT = True
except ImportError:
    HAS_HOMEASSISTANT = False
    CONF_HOST = "host"
    CONF_PORT = "port"

from custom_components.ac_modbus.coordinator import ACModbusCoordinator
from custom_components.ac_modbus.hub import ModbusHub


@pytest.fixture
def mock_hub(mock_modbus_client: MagicMock, mock_modbus_responses: dict[int, int]) -> MagicMock:
    """Create a mock ModbusHub."""
    hub = MagicMock(spec=ModbusHub)
    hub.is_connected = True
    hub.host = "192.168.1.100"
    hub.port = 502

    async def mock_read(address: int, count: int = 1, unit_id: int | None = None):
        if address in mock_modbus_responses:
            return mock_modbus_responses[address]
        return 0

    hub.read_register = AsyncMock(side_effect=mock_read)

    async def mock_write(
        address: int,
        value: int,
        unit_id: int | None = None,
        verify: bool = False,
        expected: int | None = None,
    ):
        mock_modbus_responses[address] = value
        return True

    hub.write_register = AsyncMock(side_effect=mock_write)
    hub.connect = AsyncMock(return_value=True)
    hub.disconnect = AsyncMock()
    hub.reconnect = AsyncMock(return_value=True)

    return hub


@pytest.fixture
def mock_hub_disconnected() -> MagicMock:
    """Create a mock ModbusHub that is disconnected."""
    hub = MagicMock(spec=ModbusHub)
    hub.is_connected = False
    hub.host = "192.168.1.100"
    hub.port = 502
    hub.read_register = AsyncMock(side_effect=Exception("Not connected"))
    hub.connect = AsyncMock(return_value=False)
    hub.disconnect = AsyncMock()
    hub.reconnect = AsyncMock(return_value=False)
    return hub


class TestCoordinatorInitialization:
    """Test coordinator initialization."""

    def test_coordinator_initialization(self, mock_hub: MagicMock) -> None:
        """Test coordinator initializes correctly."""
        coordinator = ACModbusCoordinator(
            hub=mock_hub,
            poll_interval=DEFAULT_POLL_INTERVAL,
        )
        assert coordinator.hub == mock_hub
        assert coordinator.poll_interval == DEFAULT_POLL_INTERVAL

    def test_coordinator_default_data(self, mock_hub: MagicMock) -> None:
        """Test coordinator starts with empty data."""
        coordinator = ACModbusCoordinator(
            hub=mock_hub,
            poll_interval=DEFAULT_POLL_INTERVAL,
        )
        assert coordinator.data == {}


class TestCoordinatorRefresh:
    """Test coordinator data refresh."""

    @pytest.mark.asyncio
    async def test_coordinator_first_refresh(self, mock_hub: MagicMock) -> None:
        """Test first data refresh."""
        coordinator = ACModbusCoordinator(
            hub=mock_hub,
            poll_interval=DEFAULT_POLL_INTERVAL,
        )
        await coordinator.async_refresh()

        assert REGISTER_POWER in coordinator.data
        assert REGISTER_MODE in coordinator.data
        assert coordinator.data[REGISTER_POWER] == 1
        assert coordinator.data[REGISTER_MODE] == 1

    @pytest.mark.asyncio
    async def test_coordinator_periodic_update(self, mock_hub: MagicMock) -> None:
        """Test periodic data updates."""
        coordinator = ACModbusCoordinator(
            hub=mock_hub,
            poll_interval=DEFAULT_POLL_INTERVAL,
        )

        # First refresh
        await coordinator.async_refresh()
        first_data = dict(coordinator.data)

        # Second refresh
        await coordinator.async_refresh()
        second_data = dict(coordinator.data)

        # Data should be consistent
        assert first_data == second_data


class TestCoordinatorCaching:
    """Test coordinator data caching."""

    @pytest.mark.asyncio
    async def test_data_caching_1033_1041(
        self, mock_hub: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test that 1033 and 1041 are cached correctly."""
        coordinator = ACModbusCoordinator(
            hub=mock_hub,
            poll_interval=DEFAULT_POLL_INTERVAL,
        )
        await coordinator.async_refresh()

        # Verify cached values
        assert coordinator.data[REGISTER_POWER] == mock_modbus_responses[REGISTER_POWER]
        assert coordinator.data[REGISTER_MODE] == mock_modbus_responses[REGISTER_MODE]

    @pytest.mark.asyncio
    async def test_cache_update_on_write(
        self, mock_hub: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test cache updates after write operation."""
        coordinator = ACModbusCoordinator(
            hub=mock_hub,
            poll_interval=DEFAULT_POLL_INTERVAL,
        )
        await coordinator.async_refresh()

        # Simulate a write that changes the value
        mock_modbus_responses[REGISTER_POWER] = 0
        await coordinator.async_refresh()

        assert coordinator.data[REGISTER_POWER] == 0

    @pytest.mark.asyncio
    async def test_last_update_time(self, mock_hub: MagicMock) -> None:
        """Test that last update time is tracked."""
        coordinator = ACModbusCoordinator(
            hub=mock_hub,
            poll_interval=DEFAULT_POLL_INTERVAL,
        )

        assert coordinator.last_update_time is None
        await coordinator.async_refresh()
        assert coordinator.last_update_time is not None


class TestCoordinatorErrorHandling:
    """Test coordinator error handling."""

    @pytest.mark.asyncio
    async def test_update_failed_marks_unavailable(
        self, mock_hub_disconnected: MagicMock
    ) -> None:
        """Test that failed updates mark data as unavailable."""
        coordinator = ACModbusCoordinator(
            hub=mock_hub_disconnected,
            poll_interval=DEFAULT_POLL_INTERVAL,
        )

        # async_refresh handles errors gracefully without raising
        await coordinator.async_refresh()

        assert coordinator.available is False

    @pytest.mark.asyncio
    async def test_update_success_restores_availability(
        self, mock_hub: MagicMock
    ) -> None:
        """Test that successful updates restore availability."""
        coordinator = ACModbusCoordinator(
            hub=mock_hub,
            poll_interval=DEFAULT_POLL_INTERVAL,
        )

        # Force unavailable state
        coordinator._available = False

        await coordinator.async_refresh()
        assert coordinator.available is True

    @pytest.mark.asyncio
    async def test_consecutive_failures_tracking(
        self, mock_hub_disconnected: MagicMock
    ) -> None:
        """Test tracking of consecutive failures."""
        coordinator = ACModbusCoordinator(
            hub=mock_hub_disconnected,
            poll_interval=DEFAULT_POLL_INTERVAL,
        )

        for _ in range(3):
            try:
                await coordinator.async_refresh()
            except Exception:
                pass

        assert coordinator.consecutive_errors >= 3


class TestCoordinatorAvailability:
    """Test coordinator availability state."""

    def test_initial_availability(self, mock_hub: MagicMock) -> None:
        """Test initial availability state."""
        coordinator = ACModbusCoordinator(
            hub=mock_hub,
            poll_interval=DEFAULT_POLL_INTERVAL,
        )
        # Initially available (optimistic)
        assert coordinator.available is True

    @pytest.mark.asyncio
    async def test_availability_after_success(self, mock_hub: MagicMock) -> None:
        """Test availability after successful refresh."""
        coordinator = ACModbusCoordinator(
            hub=mock_hub,
            poll_interval=DEFAULT_POLL_INTERVAL,
        )
        await coordinator.async_refresh()
        assert coordinator.available is True

    @pytest.mark.asyncio
    async def test_availability_after_failure(
        self, mock_hub_disconnected: MagicMock
    ) -> None:
        """Test availability after failed refresh."""
        coordinator = ACModbusCoordinator(
            hub=mock_hub_disconnected,
            poll_interval=DEFAULT_POLL_INTERVAL,
        )

        try:
            await coordinator.async_refresh()
        except Exception:
            pass

        assert coordinator.available is False


class TestCoordinatorRegisters:
    """Test coordinator register operations."""

    @pytest.mark.asyncio
    async def test_get_register_value(self, mock_hub: MagicMock) -> None:
        """Test getting a specific register value."""
        coordinator = ACModbusCoordinator(
            hub=mock_hub,
            poll_interval=DEFAULT_POLL_INTERVAL,
        )
        await coordinator.async_refresh()

        power = coordinator.get_register(REGISTER_POWER)
        mode = coordinator.get_register(REGISTER_MODE)

        assert power == 1
        assert mode == 1

    @pytest.mark.asyncio
    async def test_get_register_not_cached(self, mock_hub: MagicMock) -> None:
        """Test getting a register that isn't cached returns None."""
        coordinator = ACModbusCoordinator(
            hub=mock_hub,
            poll_interval=DEFAULT_POLL_INTERVAL,
        )
        await coordinator.async_refresh()

        unknown = coordinator.get_register(9999)
        assert unknown is None
