"""Tests for Select entity module."""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from custom_components.ac_modbus.const import (
    DEFAULT_MODE_MAP,
    DEFAULT_POLL_INTERVAL,
    REGISTER_MODE,
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


@pytest.fixture
def mock_coordinator(
    mock_hub: MagicMock, mock_modbus_responses: dict[int, int]
) -> ACModbusCoordinator:
    """Create a mock coordinator with data."""
    coordinator = ACModbusCoordinator(
        hub=mock_hub,
        poll_interval=DEFAULT_POLL_INTERVAL,
    )
    coordinator._data = dict(mock_modbus_responses)
    coordinator._available = True
    return coordinator


@pytest.fixture
def custom_mode_map() -> dict[int, str]:
    """Custom mode map for testing."""
    return {
        0: "off",
        1: "cooling",
        2: "heating",
        3: "auto",
    }


class TestModeMapDefaults:
    """Test mode map default configuration."""

    def test_select_default_mode_map(
        self, mock_coordinator: ACModbusCoordinator
    ) -> None:
        """Test select uses default mode map."""
        select = ACModbusModeSelect(
            coordinator=mock_coordinator,
            entry_id="test_entry",
        )
        assert select.mode_map == DEFAULT_MODE_MAP

    def test_select_custom_mode_map(
        self, mock_coordinator: ACModbusCoordinator, custom_mode_map: dict[int, str]
    ) -> None:
        """Test select accepts custom mode map."""
        select = ACModbusModeSelect(
            coordinator=mock_coordinator,
            entry_id="test_entry",
            mode_map=custom_mode_map,
        )
        assert select.mode_map == custom_mode_map

    def test_select_options_from_mode_map(
        self, mock_coordinator: ACModbusCoordinator
    ) -> None:
        """Test select options are derived from mode map."""
        select = ACModbusModeSelect(
            coordinator=mock_coordinator,
            entry_id="test_entry",
        )
        expected_options = list(DEFAULT_MODE_MAP.values())
        assert set(select.options) == set(expected_options)


class TestModeSelection:
    """Test mode selection operations."""

    @pytest.mark.asyncio
    async def test_select_option(
        self,
        mock_coordinator: ACModbusCoordinator,
        mock_modbus_responses: dict[int, int],
    ) -> None:
        """Test selecting a mode."""
        select = ACModbusModeSelect(
            coordinator=mock_coordinator,
            entry_id="test_entry",
        )

        await select.async_select_option("cool")

        # Verify write was called with correct value (1 for cool)
        mock_coordinator.hub.write_register.assert_called()
        call_kwargs = mock_coordinator.hub.write_register.call_args[1]
        assert call_kwargs["address"] == REGISTER_MODE
        assert call_kwargs["value"] == 1

    @pytest.mark.asyncio
    async def test_select_with_verify(
        self,
        mock_coordinator: ACModbusCoordinator,
        mock_modbus_responses: dict[int, int],
    ) -> None:
        """Test selecting mode with verification."""
        select = ACModbusModeSelect(
            coordinator=mock_coordinator,
            entry_id="test_entry",
        )

        await select.async_select_option("heat")

        # Verify write was called with verify=True
        call_kwargs = mock_coordinator.hub.write_register.call_args[1]
        assert call_kwargs.get("verify") is True

    def test_select_invalid_mode_rejected(
        self, mock_coordinator: ACModbusCoordinator
    ) -> None:
        """Test that invalid mode is rejected."""
        select = ACModbusModeSelect(
            coordinator=mock_coordinator,
            entry_id="test_entry",
        )

        # Invalid mode should not be in options
        assert "invalid_mode" not in select.options

    @pytest.mark.asyncio
    async def test_select_invalid_mode_raises(
        self, mock_coordinator: ACModbusCoordinator
    ) -> None:
        """Test selecting invalid mode raises error."""
        select = ACModbusModeSelect(
            coordinator=mock_coordinator,
            entry_id="test_entry",
        )

        with pytest.raises(ValueError, match="not valid"):
            await select.async_select_option("invalid_mode")


class TestCurrentMode:
    """Test current mode reading."""

    def test_current_option_cool(self, mock_coordinator: ACModbusCoordinator) -> None:
        """Test current option returns cool when register is 1."""
        mock_coordinator._data[REGISTER_MODE] = 1
        select = ACModbusModeSelect(
            coordinator=mock_coordinator,
            entry_id="test_entry",
        )
        assert select.current_option == "cool"

    def test_current_option_heat(self, mock_coordinator: ACModbusCoordinator) -> None:
        """Test current option returns heat when register is 4."""
        mock_coordinator._data[REGISTER_MODE] = 4
        select = ACModbusModeSelect(
            coordinator=mock_coordinator,
            entry_id="test_entry",
        )
        assert select.current_option == "heat"

    def test_current_option_unmapped_value(
        self, mock_coordinator: ACModbusCoordinator
    ) -> None:
        """Test current option for unmapped register value."""
        mock_coordinator._data[REGISTER_MODE] = 99  # Unmapped value
        select = ACModbusModeSelect(
            coordinator=mock_coordinator,
            entry_id="test_entry",
        )
        # Should return None or a fallback for unmapped values
        assert select.current_option is None


class TestSelectAttributes:
    """Test select attributes."""

    def test_select_unique_id(self, mock_coordinator: ACModbusCoordinator) -> None:
        """Test select has correct unique ID."""
        select = ACModbusModeSelect(
            coordinator=mock_coordinator,
            entry_id="test_entry",
        )
        assert "test_entry" in select.unique_id
        assert "mode" in select.unique_id.lower()

    def test_select_name(self, mock_coordinator: ACModbusCoordinator) -> None:
        """Test select has a name."""
        select = ACModbusModeSelect(
            coordinator=mock_coordinator,
            entry_id="test_entry",
        )
        assert select.name is not None
        assert len(select.name) > 0


class TestSelectAvailability:
    """Test select availability."""

    def test_select_available(self, mock_coordinator: ACModbusCoordinator) -> None:
        """Test select is available when coordinator is available."""
        mock_coordinator._available = True
        select = ACModbusModeSelect(
            coordinator=mock_coordinator,
            entry_id="test_entry",
        )
        assert select.available is True

    def test_select_unavailable(self, mock_coordinator: ACModbusCoordinator) -> None:
        """Test select is unavailable when coordinator is unavailable."""
        mock_coordinator._available = False
        select = ACModbusModeSelect(
            coordinator=mock_coordinator,
            entry_id="test_entry",
        )
        assert select.available is False
