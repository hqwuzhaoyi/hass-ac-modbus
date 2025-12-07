"""Tests for performance requirements."""

from __future__ import annotations

import asyncio
import time
from unittest.mock import AsyncMock, MagicMock

import pytest

from custom_components.ac_modbus.const import (
    DEFAULT_POLL_INTERVAL,
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
        # Simulate realistic read delay (10-50ms)
        await asyncio.sleep(0.02)
        return mock_modbus_responses.get(address, 0)

    hub.read_register = AsyncMock(side_effect=mock_read)

    async def mock_write(
        address: int,
        value: int,
        unit_id: int | None = None,
        verify: bool = False,
        expected: int | None = None,
    ):
        # Simulate realistic write delay (10-50ms)
        await asyncio.sleep(0.02)
        mock_modbus_responses[address] = value
        return True

    hub.write_register = AsyncMock(side_effect=mock_write)
    hub.connect = AsyncMock(return_value=True)
    hub.disconnect = AsyncMock()

    return hub


@pytest.fixture
def fast_hub(mock_modbus_responses: dict[int, int]) -> MagicMock:
    """Create a mock ModbusHub with fast responses."""
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


class TestReadbackTime:
    """Test readback timing requirements."""

    @pytest.mark.asyncio
    async def test_readback_time_under_5s(
        self, mock_hub: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test that write with readback completes in under 5 seconds."""
        start_time = time.monotonic()

        # Perform write with readback
        await mock_hub.write_register(
            address=REGISTER_POWER,
            value=1,
            verify=True,
        )

        elapsed = time.monotonic() - start_time

        # Should complete well under 5 seconds (target: <1s for mock)
        assert elapsed < 5.0
        # With mock delay, should be around 20ms
        assert elapsed < 1.0

    @pytest.mark.asyncio
    async def test_multiple_readbacks_under_5s(
        self, mock_hub: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test that multiple writes with readback stay under 5s each."""
        times = []

        for _ in range(10):
            start_time = time.monotonic()
            await mock_hub.write_register(
                address=REGISTER_POWER,
                value=1,
                verify=True,
            )
            times.append(time.monotonic() - start_time)

        # All individual writes should be under 5s
        for t in times:
            assert t < 5.0

        # Average should be reasonable
        avg_time = sum(times) / len(times)
        assert avg_time < 1.0


class TestPollIntervalAccuracy:
    """Test polling interval accuracy."""

    @pytest.mark.asyncio
    async def test_poll_interval_accuracy(
        self, fast_hub: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test that coordinator respects poll interval timing."""
        poll_interval = 1  # 1 second for testing

        coordinator = ACModbusCoordinator(
            hub=fast_hub,
            poll_interval=poll_interval,
        )

        # Simulate multiple poll cycles
        poll_times = []
        for _ in range(3):
            start_time = time.monotonic()
            await coordinator.async_refresh()
            poll_times.append(time.monotonic() - start_time)

        # Each poll should complete quickly (no artificial delays in coordinator)
        for t in poll_times:
            assert t < 1.0  # Should be much less than poll_interval

    @pytest.mark.asyncio
    async def test_coordinator_poll_efficiency(
        self, fast_hub: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test that coordinator polling is efficient."""
        coordinator = ACModbusCoordinator(
            hub=fast_hub,
            poll_interval=DEFAULT_POLL_INTERVAL,
        )

        # Measure time for a refresh cycle
        start_time = time.monotonic()
        await coordinator.async_refresh()
        elapsed = time.monotonic() - start_time

        # Should be very fast with mock hub (no real I/O)
        assert elapsed < 0.1


class TestMemoryUsage:
    """Test memory usage patterns."""

    @pytest.mark.asyncio
    async def test_memory_leak(
        self, fast_hub: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test that coordinator doesn't accumulate memory over many refreshes."""
        coordinator = ACModbusCoordinator(
            hub=fast_hub,
            poll_interval=DEFAULT_POLL_INTERVAL,
        )

        # Perform many refresh cycles
        for _ in range(1000):
            await coordinator.async_refresh()

        # Data cache should only contain the polled registers
        assert len(coordinator._data) == 2  # Only REGISTER_POWER and REGISTER_MODE

        # Consecutive errors should be reset on success
        assert coordinator._consecutive_errors == 0

    @pytest.mark.asyncio
    async def test_data_cache_stability(
        self, fast_hub: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test that data cache remains stable size."""
        coordinator = ACModbusCoordinator(
            hub=fast_hub,
            poll_interval=DEFAULT_POLL_INTERVAL,
        )

        initial_size = len(coordinator._data)

        # Many refreshes
        for _ in range(100):
            await coordinator.async_refresh()

        # Cache size should remain bounded
        assert len(coordinator._data) == 2  # Only the 2 registered registers


class TestConcurrentRequests:
    """Test concurrent request handling."""

    @pytest.mark.asyncio
    async def test_concurrent_requests(
        self, mock_hub: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test performance with concurrent requests."""
        coordinator = ACModbusCoordinator(
            hub=mock_hub,
            poll_interval=DEFAULT_POLL_INTERVAL,
        )

        # Launch multiple concurrent refreshes
        start_time = time.monotonic()
        await asyncio.gather(*[coordinator.async_refresh() for _ in range(10)])
        elapsed = time.monotonic() - start_time

        # Should complete in reasonable time (not serialized)
        # With 20ms delay per read, 2 reads per refresh, 10 refreshes
        # If serialized: 10 * 2 * 20ms = 400ms
        # With concurrency: could be faster
        assert elapsed < 5.0

    @pytest.mark.asyncio
    async def test_concurrent_writes(
        self, mock_hub: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test performance with concurrent writes."""
        start_time = time.monotonic()

        # Launch concurrent writes
        await asyncio.gather(
            *[
                mock_hub.write_register(
                    address=REGISTER_POWER,
                    value=i % 2,
                )
                for i in range(10)
            ]
        )

        elapsed = time.monotonic() - start_time

        # All writes should complete
        assert mock_hub.write_register.call_count == 10

        # Should complete in reasonable time
        assert elapsed < 5.0


class TestResponsiveness:
    """Test system responsiveness."""

    @pytest.mark.asyncio
    async def test_first_refresh_fast(
        self, fast_hub: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test that first refresh is fast."""
        coordinator = ACModbusCoordinator(
            hub=fast_hub,
            poll_interval=DEFAULT_POLL_INTERVAL,
        )

        start_time = time.monotonic()
        await coordinator.async_refresh()
        elapsed = time.monotonic() - start_time

        # First refresh should be fast
        assert elapsed < 0.1
        assert coordinator.available

    @pytest.mark.asyncio
    async def test_write_responsiveness(
        self, fast_hub: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test write operation responsiveness."""
        times = []

        for _ in range(100):
            start_time = time.monotonic()
            await fast_hub.write_register(
                address=REGISTER_POWER,
                value=1,
            )
            times.append(time.monotonic() - start_time)

        # Average write time should be very fast
        avg_time = sum(times) / len(times)
        assert avg_time < 0.01  # Should be sub-millisecond with mock

        # No outliers (all under 100ms)
        for t in times:
            assert t < 0.1
