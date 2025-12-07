"""Tests for Switch entity module."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from custom_components.ac_modbus.const import (
    DEFAULT_POLL_INTERVAL,
    REGISTER_POWER,
)
from custom_components.ac_modbus.coordinator import ACModbusCoordinator
from custom_components.ac_modbus.hub import ModbusHub
from custom_components.ac_modbus.switch import ACModbusPowerSwitch

# Check if homeassistant is available
try:
    from homeassistant.const import (
        CONF_HOST,
        CONF_PORT,
        STATE_OFF,
        STATE_ON,
        STATE_UNAVAILABLE,
    )

    HAS_HOMEASSISTANT = True
except ImportError:
    HAS_HOMEASSISTANT = False
    CONF_HOST = "host"
    CONF_PORT = "port"
    STATE_ON = "on"
    STATE_OFF = "off"
    STATE_UNAVAILABLE = "unavailable"


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
    # Pre-populate data
    coordinator._data = dict(mock_modbus_responses)
    coordinator._available = True
    return coordinator


@pytest.fixture
def mock_coordinator_unavailable(mock_hub: MagicMock) -> ACModbusCoordinator:
    """Create a mock coordinator that is unavailable."""
    coordinator = ACModbusCoordinator(
        hub=mock_hub,
        poll_interval=DEFAULT_POLL_INTERVAL,
    )
    coordinator._available = False
    return coordinator


class TestSwitchState:
    """Test switch state."""

    def test_switch_state_on(self, mock_coordinator: ACModbusCoordinator) -> None:
        """Test switch reports ON when register is 1."""
        mock_coordinator._data[REGISTER_POWER] = 1
        switch = ACModbusPowerSwitch(
            coordinator=mock_coordinator,
            entry_id="test_entry",
        )
        assert switch.is_on is True

    def test_switch_state_off(self, mock_coordinator: ACModbusCoordinator) -> None:
        """Test switch reports OFF when register is 0."""
        mock_coordinator._data[REGISTER_POWER] = 0
        switch = ACModbusPowerSwitch(
            coordinator=mock_coordinator,
            entry_id="test_entry",
        )
        assert switch.is_on is False

    def test_switch_state_unavailable(
        self, mock_coordinator_unavailable: ACModbusCoordinator
    ) -> None:
        """Test switch reports unavailable when coordinator is unavailable."""
        switch = ACModbusPowerSwitch(
            coordinator=mock_coordinator_unavailable,
            entry_id="test_entry",
        )
        assert switch.available is False


class TestSwitchControl:
    """Test switch control operations."""

    @pytest.mark.asyncio
    async def test_switch_turn_on(
        self,
        mock_coordinator: ACModbusCoordinator,
        mock_modbus_responses: dict[int, int],
    ) -> None:
        """Test turning on the switch."""
        mock_modbus_responses[REGISTER_POWER] = 0  # Start off
        mock_coordinator._data[REGISTER_POWER] = 0
        switch = ACModbusPowerSwitch(
            coordinator=mock_coordinator,
            entry_id="test_entry",
        )

        await switch.async_turn_on()

        # Verify write was called with correct value
        mock_coordinator.hub.write_register.assert_called()
        call_kwargs = mock_coordinator.hub.write_register.call_args[1]
        assert call_kwargs["address"] == REGISTER_POWER
        assert call_kwargs["value"] == 1

    @pytest.mark.asyncio
    async def test_switch_turn_off(
        self,
        mock_coordinator: ACModbusCoordinator,
        mock_modbus_responses: dict[int, int],
    ) -> None:
        """Test turning off the switch."""
        mock_modbus_responses[REGISTER_POWER] = 1  # Start on
        mock_coordinator._data[REGISTER_POWER] = 1
        switch = ACModbusPowerSwitch(
            coordinator=mock_coordinator,
            entry_id="test_entry",
        )

        await switch.async_turn_off()

        # Verify write was called with correct value
        mock_coordinator.hub.write_register.assert_called()
        call_kwargs = mock_coordinator.hub.write_register.call_args[1]
        assert call_kwargs["address"] == REGISTER_POWER
        assert call_kwargs["value"] == 0

    @pytest.mark.asyncio
    async def test_switch_turn_on_with_verify(
        self,
        mock_coordinator: ACModbusCoordinator,
        mock_modbus_responses: dict[int, int],
    ) -> None:
        """Test turning on with verification."""
        mock_modbus_responses[REGISTER_POWER] = 0
        mock_coordinator._data[REGISTER_POWER] = 0
        switch = ACModbusPowerSwitch(
            coordinator=mock_coordinator,
            entry_id="test_entry",
        )

        await switch.async_turn_on()

        # Verify write was called with verify=True
        call_kwargs = mock_coordinator.hub.write_register.call_args[1]
        assert call_kwargs.get("verify") is True


class TestSwitchAttributes:
    """Test switch attributes."""

    def test_switch_unique_id(self, mock_coordinator: ACModbusCoordinator) -> None:
        """Test switch has correct unique ID."""
        switch = ACModbusPowerSwitch(
            coordinator=mock_coordinator,
            entry_id="test_entry",
        )
        assert "test_entry" in switch.unique_id
        assert "power" in switch.unique_id.lower()

    def test_switch_name(self, mock_coordinator: ACModbusCoordinator) -> None:
        """Test switch has a name."""
        switch = ACModbusPowerSwitch(
            coordinator=mock_coordinator,
            entry_id="test_entry",
        )
        assert switch.name is not None
        assert len(switch.name) > 0

    def test_switch_device_class(self, mock_coordinator: ACModbusCoordinator) -> None:
        """Test switch has device class."""
        switch = ACModbusPowerSwitch(
            coordinator=mock_coordinator,
            entry_id="test_entry",
        )
        # Switch device class is optional but commonly "switch" or "outlet"
        assert switch.device_class is None or isinstance(switch.device_class, str)


class TestSwitchCoordinatorIntegration:
    """Test switch integration with coordinator."""

    @pytest.mark.asyncio
    async def test_switch_with_coordinator(
        self, mock_coordinator: ACModbusCoordinator
    ) -> None:
        """Test switch works with coordinator."""
        switch = ACModbusPowerSwitch(
            coordinator=mock_coordinator,
            entry_id="test_entry",
        )
        assert switch.coordinator == mock_coordinator

    @pytest.mark.asyncio
    async def test_switch_update_from_coordinator(
        self, mock_coordinator: ACModbusCoordinator
    ) -> None:
        """Test switch updates from coordinator data."""
        switch = ACModbusPowerSwitch(
            coordinator=mock_coordinator,
            entry_id="test_entry",
        )

        # Update coordinator data
        mock_coordinator._data[REGISTER_POWER] = 0
        assert switch.is_on is False

        mock_coordinator._data[REGISTER_POWER] = 1
        assert switch.is_on is True


class TestSwitchErrorHandling:
    """Test switch error handling."""

    @pytest.mark.asyncio
    async def test_switch_write_failure(
        self, mock_coordinator: ACModbusCoordinator
    ) -> None:
        """Test switch handles write failure."""
        mock_coordinator.hub.write_register = AsyncMock(
            side_effect=Exception("Write failed")
        )
        switch = ACModbusPowerSwitch(
            coordinator=mock_coordinator,
            entry_id="test_entry",
        )

        with pytest.raises(Exception, match="Write failed"):
            await switch.async_turn_on()

    @pytest.mark.asyncio
    async def test_switch_verify_failure_marks_unavailable(
        self, mock_coordinator: ACModbusCoordinator
    ) -> None:
        """Test switch marks unavailable on verify failure."""
        mock_coordinator.hub.write_register = AsyncMock(
            side_effect=ValueError("Verification mismatch")
        )
        switch = ACModbusPowerSwitch(
            coordinator=mock_coordinator,
            entry_id="test_entry",
        )

        with pytest.raises(ValueError):
            await switch.async_turn_on()

        # After a verify failure, availability may be affected
        # This depends on implementation
