"""Tests for services module."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from custom_components.ac_modbus.hub import ModbusHub
from custom_components.ac_modbus.services import (
    WriteRegisterResult,
    async_handle_scan_range,
    async_handle_write_register,
)


@pytest.fixture
def mock_hub(mock_modbus_responses: dict[int, int]) -> MagicMock:
    """Create a mock ModbusHub."""
    hub = MagicMock(spec=ModbusHub)
    hub.is_connected = True
    hub.host = "192.168.1.100"
    hub.port = 502
    hub.unit_id = 1

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


class TestWriteRegisterService:
    """Test write_register service."""

    @pytest.mark.asyncio
    async def test_write_register_service_basic(
        self, mock_hub: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test basic register write."""
        result = await async_handle_write_register(
            hub=mock_hub,
            register=1033,
            value=1,
        )

        assert result.register == 1033
        assert result.value == 1
        assert result.verified is True

    @pytest.mark.asyncio
    async def test_write_register_with_verify(
        self, mock_hub: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test register write with verification."""
        result = await async_handle_write_register(
            hub=mock_hub,
            register=1033,
            value=1,
            verify=True,
        )

        # Verify write was called with verify=True
        call_kwargs = mock_hub.write_register.call_args[1]
        assert call_kwargs["verify"] is True
        assert result.verified is True

    @pytest.mark.asyncio
    async def test_write_register_custom_unit_id(
        self, mock_hub: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test register write with custom unit_id."""
        await async_handle_write_register(
            hub=mock_hub,
            register=1033,
            value=1,
            unit_id=2,
        )

        # Verify unit_id was passed
        call_kwargs = mock_hub.write_register.call_args[1]
        assert call_kwargs["unit_id"] == 2

    @pytest.mark.asyncio
    async def test_write_register_expected_value(
        self, mock_hub: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test register write with custom expected value."""
        await async_handle_write_register(
            hub=mock_hub,
            register=1033,
            value=1,
            expected=1,
        )

        # Verify expected was passed
        call_kwargs = mock_hub.write_register.call_args[1]
        assert call_kwargs["expected"] == 1

    @pytest.mark.asyncio
    async def test_write_register_returns_response(
        self, mock_hub: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test that write_register returns a proper response."""
        result = await async_handle_write_register(
            hub=mock_hub,
            register=1033,
            value=1,
        )

        assert isinstance(result, WriteRegisterResult)
        assert result.register == 1033
        assert result.value == 1
        assert result.verified is True
        assert result.error is None

    @pytest.mark.asyncio
    async def test_write_register_failure(self, mock_hub: MagicMock) -> None:
        """Test register write failure handling."""
        mock_hub.write_register = AsyncMock(side_effect=Exception("Write failed"))

        result = await async_handle_write_register(
            hub=mock_hub,
            register=1033,
            value=1,
        )

        assert result.verified is False
        assert result.error is not None
        assert "Write failed" in result.error


class TestScanRangeService:
    """Test scan_range service."""

    @pytest.mark.asyncio
    async def test_scan_range_basic(
        self, mock_hub: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test basic register scan."""
        # Set up some mock values
        mock_modbus_responses[1000] = 100
        mock_modbus_responses[1001] = 101
        mock_modbus_responses[1002] = 102

        result = await async_handle_scan_range(
            hub=mock_hub,
            start=1000,
            end=1002,
        )

        assert result.start == 1000
        assert result.end == 1002
        assert len(result.results) == 3
        assert result.results[1000] == 100
        assert result.results[1001] == 101
        assert result.results[1002] == 102

    @pytest.mark.asyncio
    async def test_scan_range_step_parameter(
        self, mock_hub: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test scan with step parameter."""
        mock_modbus_responses[1000] = 100
        mock_modbus_responses[1002] = 102
        mock_modbus_responses[1004] = 104

        result = await async_handle_scan_range(
            hub=mock_hub,
            start=1000,
            end=1004,
            step=2,
        )

        assert len(result.results) == 3
        assert 1000 in result.results
        assert 1001 not in result.results
        assert 1002 in result.results
        assert 1004 in result.results

    @pytest.mark.asyncio
    async def test_scan_range_max_100_registers(self, mock_hub: MagicMock) -> None:
        """Test scan range is limited to 100 registers."""
        with pytest.raises(ValueError, match="100"):
            await async_handle_scan_range(
                hub=mock_hub,
                start=1000,
                end=1200,  # 200 registers
            )

    @pytest.mark.asyncio
    async def test_scan_range_partial_failure(
        self, mock_hub: MagicMock, mock_modbus_responses: dict[int, int]
    ) -> None:
        """Test scan handles partial read failures."""
        mock_modbus_responses[1000] = 100

        # Make some reads fail
        call_count = 0

        async def mock_read_with_failure(
            address: int, count: int = 1, unit_id: int | None = None
        ):
            nonlocal call_count
            call_count += 1
            if address == 1001:
                raise Exception("Read failed")
            return mock_modbus_responses.get(address, 0)

        mock_hub.read_register = AsyncMock(side_effect=mock_read_with_failure)

        result = await async_handle_scan_range(
            hub=mock_hub,
            start=1000,
            end=1002,
        )

        # Should have results for successful reads
        assert 1000 in result.results
        assert 1001 not in result.results  # Failed
        assert len(result.errors) == 1


class TestServiceResults:
    """Test service result data structures."""

    def test_write_register_result_to_dict(self) -> None:
        """Test WriteRegisterResult converts to dict."""
        result = WriteRegisterResult(
            register=1033,
            value=1,
            verified=True,
            readback=1,
            error=None,
            unit_id=1,
        )

        result_dict = result.to_dict()
        assert result_dict["register"] == 1033
        assert result_dict["value"] == 1
        assert result_dict["verified"] is True

    def test_write_register_result_error(self) -> None:
        """Test WriteRegisterResult with error."""
        result = WriteRegisterResult(
            register=1033,
            value=1,
            verified=False,
            readback=None,
            error="Connection failed",
            unit_id=1,
        )

        assert result.verified is False
        assert result.error == "Connection failed"
