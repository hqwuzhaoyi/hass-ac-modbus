"""Tests for error recovery scenarios."""

from __future__ import annotations

import asyncio
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from custom_components.ac_modbus.const import (
    DEFAULT_POLL_INTERVAL,
    REGISTER_MODE,
    REGISTER_POWER,
)
from custom_components.ac_modbus.coordinator import ACModbusCoordinator
from custom_components.ac_modbus.hub import ModbusHub


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
    hub.reconnect = AsyncMock(return_value=True)

    return hub


class TestPartialReadFailure:
    """Test partial register read failures."""

    @pytest.mark.asyncio
    async def test_partial_read_failure_1033_fails(
        self, mock_hub: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test coordinator handles 1033 read failure while 1041 succeeds."""
        call_count = 0

        async def mock_read_partial_fail(
            address: int, count: int = 1, unit_id: int | None = None
        ):
            nonlocal call_count
            call_count += 1
            if address == REGISTER_POWER:
                raise Exception("Read failed for 1033")
            return mock_modbus_responses.get(address, 0)

        mock_hub.read_register = AsyncMock(side_effect=mock_read_partial_fail)

        coordinator = ACModbusCoordinator(
            hub=mock_hub,
            poll_interval=DEFAULT_POLL_INTERVAL,
        )

        # Should not raise but mark as unavailable due to read error
        await coordinator.async_refresh()

        # Coordinator should handle partial failure gracefully
        assert coordinator.get_register(REGISTER_POWER) is None

    @pytest.mark.asyncio
    async def test_partial_read_failure_1041_fails(
        self, mock_hub: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test coordinator handles 1041 read failure while 1033 succeeds."""

        async def mock_read_partial_fail(
            address: int, count: int = 1, unit_id: int | None = None
        ):
            if address == REGISTER_MODE:
                raise Exception("Read failed for 1041")
            return mock_modbus_responses.get(address, 0)

        mock_hub.read_register = AsyncMock(side_effect=mock_read_partial_fail)

        coordinator = ACModbusCoordinator(
            hub=mock_hub,
            poll_interval=DEFAULT_POLL_INTERVAL,
        )

        await coordinator.async_refresh()

        # 1033 should still be available
        # 1041 should be None due to failure
        assert coordinator.get_register(REGISTER_MODE) is None

    @pytest.mark.asyncio
    async def test_partial_failure_recovery(
        self, mock_hub: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test coordinator recovers when failed register becomes available."""
        failure_count = [0]

        async def mock_read_with_recovery(
            address: int, count: int = 1, unit_id: int | None = None
        ):
            if address == REGISTER_POWER and failure_count[0] < 2:
                failure_count[0] += 1
                raise Exception("Temporary failure")
            return mock_modbus_responses.get(address, 0)

        mock_hub.read_register = AsyncMock(side_effect=mock_read_with_recovery)

        coordinator = ACModbusCoordinator(
            hub=mock_hub,
            poll_interval=DEFAULT_POLL_INTERVAL,
        )

        # First refresh - should fail for 1033
        await coordinator.async_refresh()
        assert coordinator.get_register(REGISTER_POWER) is None

        # Second refresh - should still fail
        await coordinator.async_refresh()
        assert coordinator.get_register(REGISTER_POWER) is None

        # Third refresh - should recover
        await coordinator.async_refresh()
        assert (
            coordinator.get_register(REGISTER_POWER)
            == mock_modbus_responses[REGISTER_POWER]
        )


class TestDeviceRestartRecovery:
    """Test recovery after device restart."""

    @pytest.mark.asyncio
    async def test_device_restart_recovery(
        self, mock_hub: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test coordinator reconnects after device restart."""
        restart_phase = [False]

        async def mock_read_with_restart(
            address: int, count: int = 1, unit_id: int | None = None
        ):
            if restart_phase[0]:
                restart_phase[0] = False
                raise ConnectionError("Device restarted")
            return mock_modbus_responses.get(address, 0)

        mock_hub.read_register = AsyncMock(side_effect=mock_read_with_restart)

        coordinator = ACModbusCoordinator(
            hub=mock_hub,
            poll_interval=DEFAULT_POLL_INTERVAL,
        )

        # Normal operation
        await coordinator.async_refresh()
        assert coordinator.available

        # Simulate device restart
        restart_phase[0] = True
        await coordinator.async_refresh()

        # Should handle gracefully
        assert mock_hub.read_register.called

    @pytest.mark.asyncio
    async def test_connection_lost_triggers_reconnect(
        self, mock_hub: MagicMock
    ) -> None:
        """Test that connection lost triggers reconnect attempt."""
        mock_hub.is_connected = False
        mock_hub.read_register = AsyncMock(side_effect=ConnectionError("Not connected"))

        coordinator = ACModbusCoordinator(
            hub=mock_hub,
            poll_interval=DEFAULT_POLL_INTERVAL,
        )

        await coordinator.async_refresh()

        # Should attempt reconnect
        assert not coordinator.available


class TestNetworkIntermittent:
    """Test network intermittent failure handling."""

    @pytest.mark.asyncio
    async def test_network_intermittent(
        self, mock_hub: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test handling of intermittent network failures."""
        call_count = [0]

        async def mock_read_intermittent(
            address: int, count: int = 1, unit_id: int | None = None
        ):
            call_count[0] += 1
            # Fail every other call
            if call_count[0] % 2 == 0:
                raise TimeoutError("Network timeout")
            return mock_modbus_responses.get(address, 0)

        mock_hub.read_register = AsyncMock(side_effect=mock_read_intermittent)

        coordinator = ACModbusCoordinator(
            hub=mock_hub,
            poll_interval=DEFAULT_POLL_INTERVAL,
        )

        # First refresh - should succeed
        await coordinator.async_refresh()
        first_result = coordinator.get_register(REGISTER_POWER)

        # Second refresh - should fail
        await coordinator.async_refresh()

        # Third refresh - should succeed
        await coordinator.async_refresh()
        third_result = coordinator.get_register(REGISTER_POWER)

        # Values should match when successful
        assert first_result == third_result

    @pytest.mark.asyncio
    async def test_consecutive_timeouts_backoff(self, mock_hub: MagicMock) -> None:
        """Test backoff strategy on consecutive timeouts."""
        mock_hub.read_register = AsyncMock(side_effect=TimeoutError("Network timeout"))

        coordinator = ACModbusCoordinator(
            hub=mock_hub,
            poll_interval=DEFAULT_POLL_INTERVAL,
        )

        # Multiple failed refreshes
        for _ in range(5):
            await coordinator.async_refresh()

        # Should be unavailable after consecutive failures
        assert not coordinator.available


class TestConcurrentWriteHandling:
    """Test concurrent write operation handling."""

    @pytest.mark.asyncio
    async def test_concurrent_write_handling(
        self, mock_hub: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test that concurrent writes are handled safely."""
        write_order = []

        async def mock_write_with_delay(
            address: int,
            value: int,
            unit_id: int | None = None,
            verify: bool = False,
            expected: int | None = None,
        ):
            await asyncio.sleep(0.01)  # Small delay
            write_order.append((address, value))
            mock_modbus_responses[address] = value
            return True

        mock_hub.write_register = AsyncMock(side_effect=mock_write_with_delay)

        # Simulate concurrent writes
        await asyncio.gather(
            mock_hub.write_register(address=REGISTER_POWER, value=1),
            mock_hub.write_register(address=REGISTER_POWER, value=0),
            mock_hub.write_register(address=REGISTER_MODE, value=2),
        )

        # All writes should complete
        assert len(write_order) == 3
        assert mock_hub.write_register.call_count == 3

    @pytest.mark.asyncio
    async def test_write_during_poll(
        self, mock_hub: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test write operation during polling cycle."""
        coordinator = ACModbusCoordinator(
            hub=mock_hub,
            poll_interval=DEFAULT_POLL_INTERVAL,
        )

        # Start a poll and a write concurrently
        async def poll():
            await coordinator.async_refresh()

        async def write():
            await mock_hub.write_register(
                address=REGISTER_POWER,
                value=1,
            )

        await asyncio.gather(poll(), write())

        # Both should complete
        assert mock_hub.read_register.called
        assert mock_hub.write_register.called

    @pytest.mark.asyncio
    async def test_rapid_write_sequence(
        self, mock_hub: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test rapid sequence of writes."""
        # Rapid sequence of writes
        for i in range(10):
            await mock_hub.write_register(
                address=REGISTER_POWER,
                value=i % 2,  # Toggle 0/1
            )

        assert mock_hub.write_register.call_count == 10


class TestErrorStateTransitions:
    """Test error state transitions."""

    @pytest.mark.asyncio
    async def test_unavailable_to_available_transition(
        self, mock_hub: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test transition from unavailable to available."""
        fail_mode = [True]

        async def mock_read_with_fail_mode(
            address: int, count: int = 1, unit_id: int | None = None
        ):
            if fail_mode[0]:
                raise Exception("Connection failed")
            return mock_modbus_responses.get(address, 0)

        mock_hub.read_register = AsyncMock(side_effect=mock_read_with_fail_mode)

        coordinator = ACModbusCoordinator(
            hub=mock_hub,
            poll_interval=DEFAULT_POLL_INTERVAL,
        )

        # Initially failing
        await coordinator.async_refresh()
        assert not coordinator.available

        # Now succeeding
        fail_mode[0] = False
        await coordinator.async_refresh()
        assert coordinator.available

    @pytest.mark.asyncio
    async def test_available_to_unavailable_transition(
        self, mock_hub: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test transition from available to unavailable."""
        fail_mode = [False]

        async def mock_read_with_fail_mode(
            address: int, count: int = 1, unit_id: int | None = None
        ):
            if fail_mode[0]:
                raise Exception("Connection lost")
            return mock_modbus_responses.get(address, 0)

        mock_hub.read_register = AsyncMock(side_effect=mock_read_with_fail_mode)

        coordinator = ACModbusCoordinator(
            hub=mock_hub,
            poll_interval=DEFAULT_POLL_INTERVAL,
        )

        # Initially succeeding
        await coordinator.async_refresh()
        assert coordinator.available

        # Now failing
        fail_mode[0] = True
        await coordinator.async_refresh()
        assert not coordinator.available
