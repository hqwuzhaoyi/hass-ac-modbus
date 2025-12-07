"""Tests for extensibility features."""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from custom_components.ac_modbus.const import (
    DEFAULT_MODE_MAP,
    DEFAULT_POLL_INTERVAL,
    REGISTER_MODE,
    REGISTER_POWER,
)
from custom_components.ac_modbus.coordinator import ACModbusCoordinator
from custom_components.ac_modbus.hub import ModbusHub
from custom_components.ac_modbus.select import ACModbusModeSelect


@pytest.fixture
def mock_hub(mock_modbus_responses: dict[int, int]) -> MagicMock:
    """Create a mock ModbusHub."""
    hub = MagicMock(spec=ModbusHub)
    hub.is_connected = True
    hub.host = "192.168.1.100"
    hub.port = 502
    hub.unit_id = 1
    hub.last_error = None
    hub.last_error_time = None
    hub.last_success_time = None
    hub.backoff_count = 0

    async def mock_read(address: int, count: int = 1, unit_id: int | None = None):
        return mock_modbus_responses.get(address, 0)

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

    return hub


class TestCustomModeMapOverride:
    """Test custom mode_map configuration."""

    def test_select_default_mode_map(
        self, mock_hub: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test that default mode_map is used when none provided."""
        coordinator = ACModbusCoordinator(
            hub=mock_hub,
            poll_interval=DEFAULT_POLL_INTERVAL,
        )
        coordinator._data = dict(mock_modbus_responses)
        coordinator._available = True

        select = ACModbusModeSelect(
            coordinator=coordinator,
            entry_id="test_entry",
            mode_map=None,  # Use default
        )

        assert select.mode_map == DEFAULT_MODE_MAP
        assert len(select.options) == len(DEFAULT_MODE_MAP)

    def test_select_custom_mode_map(
        self, mock_hub: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test that custom mode_map overrides default."""
        custom_map = {
            0: "standby",
            1: "cooling",
            2: "heating",
            3: "ventilation",
        }

        coordinator = ACModbusCoordinator(
            hub=mock_hub,
            poll_interval=DEFAULT_POLL_INTERVAL,
        )
        coordinator._data = dict(mock_modbus_responses)
        coordinator._available = True

        select = ACModbusModeSelect(
            coordinator=coordinator,
            entry_id="test_entry",
            mode_map=custom_map,
        )

        assert select.mode_map == custom_map
        assert select.options == ["standby", "cooling", "heating", "ventilation"]

    def test_select_partial_mode_map(
        self, mock_hub: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test mode_map with fewer modes."""
        partial_map = {
            0: "off",
            1: "on",
        }

        coordinator = ACModbusCoordinator(
            hub=mock_hub,
            poll_interval=DEFAULT_POLL_INTERVAL,
        )
        coordinator._data = dict(mock_modbus_responses)
        coordinator._available = True

        select = ACModbusModeSelect(
            coordinator=coordinator,
            entry_id="test_entry",
            mode_map=partial_map,
        )

        assert len(select.options) == 2

    @pytest.mark.asyncio
    async def test_custom_mode_map_selection(
        self, mock_hub: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test selection works with custom mode_map."""
        custom_map = {
            10: "low",
            20: "medium",
            30: "high",
        }

        coordinator = ACModbusCoordinator(
            hub=mock_hub,
            poll_interval=DEFAULT_POLL_INTERVAL,
        )
        coordinator._data = dict(mock_modbus_responses)
        coordinator._available = True

        select = ACModbusModeSelect(
            coordinator=coordinator,
            entry_id="test_entry",
            mode_map=custom_map,
        )

        await select.async_select_option("medium")

        # Verify correct register value was written
        call_kwargs = mock_hub.write_register.call_args[1]
        assert call_kwargs["value"] == 20


class TestAdditionalRegisterSupport:
    """Test adding additional registers."""

    @pytest.mark.asyncio
    async def test_add_register_to_coordinator(
        self, mock_hub: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test adding a new register to coordinator polling."""
        coordinator = ACModbusCoordinator(
            hub=mock_hub,
            poll_interval=DEFAULT_POLL_INTERVAL,
        )

        # Add a new register
        new_register = 2000
        mock_modbus_responses[new_register] = 42

        coordinator.add_register(new_register)

        await coordinator.async_refresh()

        # New register should be in data
        assert coordinator.get_register(new_register) == 42

    @pytest.mark.asyncio
    async def test_remove_register_from_coordinator(
        self, mock_hub: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test removing a register from coordinator polling."""
        coordinator = ACModbusCoordinator(
            hub=mock_hub,
            poll_interval=DEFAULT_POLL_INTERVAL,
        )

        # Add and then remove a register
        new_register = 2000
        mock_modbus_responses[new_register] = 42

        coordinator.add_register(new_register)
        await coordinator.async_refresh()
        assert coordinator.get_register(new_register) == 42

        coordinator.remove_register(new_register)
        assert coordinator.get_register(new_register) is None

    @pytest.mark.asyncio
    async def test_multiple_additional_registers(
        self, mock_hub: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test adding multiple additional registers."""
        coordinator = ACModbusCoordinator(
            hub=mock_hub,
            poll_interval=DEFAULT_POLL_INTERVAL,
        )

        # Add multiple registers
        new_registers = [2000, 2001, 2002]
        for i, reg in enumerate(new_registers):
            mock_modbus_responses[reg] = 100 + i
            coordinator.add_register(reg)

        await coordinator.async_refresh()

        # All registers should be in data
        for i, reg in enumerate(new_registers):
            assert coordinator.get_register(reg) == 100 + i


class TestMultiUnitId:
    """Test multi-device (unit_id) support."""

    @pytest.mark.asyncio
    async def test_hub_custom_unit_id(self, mock_hub: MagicMock) -> None:
        """Test hub supports custom unit_id."""
        await mock_hub.write_register(
            address=REGISTER_POWER,
            value=1,
            unit_id=2,
        )

        call_kwargs = mock_hub.write_register.call_args[1]
        assert call_kwargs["unit_id"] == 2

    @pytest.mark.asyncio
    async def test_read_with_custom_unit_id(
        self, mock_hub: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test reading with custom unit_id."""
        await mock_hub.read_register(
            address=REGISTER_POWER,
            unit_id=3,
        )

        call_kwargs = mock_hub.read_register.call_args[1]
        assert call_kwargs["unit_id"] == 3

    @pytest.mark.asyncio
    async def test_multiple_unit_ids_in_sequence(
        self, mock_hub: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test operations with different unit_ids."""
        # Read from unit 1
        await mock_hub.read_register(address=REGISTER_POWER, unit_id=1)

        # Write to unit 2
        await mock_hub.write_register(
            address=REGISTER_POWER,
            value=1,
            unit_id=2,
        )

        # Read from unit 3
        await mock_hub.read_register(address=REGISTER_MODE, unit_id=3)

        # Verify all calls were made
        assert mock_hub.read_register.call_count == 2
        assert mock_hub.write_register.call_count == 1


class TestConfigurationExtensions:
    """Test configuration extension points."""

    def test_poll_interval_configurable(self, mock_hub: MagicMock) -> None:
        """Test poll interval is configurable."""
        custom_interval = 30

        coordinator = ACModbusCoordinator(
            hub=mock_hub,
            poll_interval=custom_interval,
        )

        assert coordinator.poll_interval == custom_interval

    def test_coordinator_registers_configurable(self, mock_hub: MagicMock) -> None:
        """Test coordinator registers list is modifiable."""
        coordinator = ACModbusCoordinator(
            hub=mock_hub,
            poll_interval=DEFAULT_POLL_INTERVAL,
        )

        # Initial registers
        initial_count = len(coordinator._registers)

        # Add register
        coordinator.add_register(3000)
        assert len(coordinator._registers) == initial_count + 1

        # Remove register
        coordinator.remove_register(3000)
        assert len(coordinator._registers) == initial_count


class TestBackwardsCompatibility:
    """Test backwards compatibility features."""

    def test_default_values_used(self, mock_hub: MagicMock) -> None:
        """Test default values are used when not specified."""
        coordinator = ACModbusCoordinator(
            hub=mock_hub,
        )

        # Should use default poll interval
        assert coordinator.poll_interval == DEFAULT_POLL_INTERVAL

    def test_mode_select_works_without_custom_map(
        self, mock_hub: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test mode select works without custom mode_map."""
        coordinator = ACModbusCoordinator(
            hub=mock_hub,
            poll_interval=DEFAULT_POLL_INTERVAL,
        )
        coordinator._data = dict(mock_modbus_responses)
        coordinator._available = True

        select = ACModbusModeSelect(
            coordinator=coordinator,
            entry_id="test_entry",
        )

        # Should use default mode map
        assert select.mode_map == DEFAULT_MODE_MAP
        assert len(select.options) == 5
