"""Tests for diagnostics module."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from custom_components.ac_modbus.const import (
    DEFAULT_POLL_INTERVAL,
    DEFAULT_PORT,
    REGISTER_MODE,
    REGISTER_POWER,
)
from custom_components.ac_modbus.coordinator import ACModbusCoordinator
from custom_components.ac_modbus.diagnostics import async_get_diagnostics
from custom_components.ac_modbus.hub import ModbusHub


@pytest.fixture
def mock_hub(mock_modbus_responses: dict[int, int]) -> MagicMock:
    """Create a mock ModbusHub with diagnostic info."""
    hub = MagicMock(spec=ModbusHub)
    hub.is_connected = True
    hub.host = "192.168.1.100"
    hub.port = 502
    hub.unit_id = 1
    hub.last_error = None
    hub.last_error_time = None
    hub.last_success_time = datetime.now()
    hub.backoff_count = 0

    async def mock_read(address: int, count: int = 1, unit_id: int | None = None):
        return mock_modbus_responses.get(address, 0)

    hub.read_register = AsyncMock(side_effect=mock_read)

    return hub


@pytest.fixture
def mock_hub_with_error() -> MagicMock:
    """Create a mock ModbusHub with error state."""
    hub = MagicMock(spec=ModbusHub)
    hub.is_connected = False
    hub.host = "192.168.1.100"
    hub.port = 502
    hub.unit_id = 1
    hub.last_error = "Connection refused"
    hub.last_error_time = datetime.now()
    hub.last_success_time = None
    hub.backoff_count = 3

    return hub


@pytest.fixture
def mock_coordinator(mock_hub: MagicMock, mock_modbus_responses: dict[int, int]) -> ACModbusCoordinator:
    """Create a mock coordinator with data."""
    coordinator = ACModbusCoordinator(
        hub=mock_hub,
        poll_interval=DEFAULT_POLL_INTERVAL,
    )
    coordinator._data = dict(mock_modbus_responses)
    coordinator._available = True
    coordinator._last_update_time = datetime.now()
    return coordinator


class TestDiagnosticsData:
    """Test diagnostics data collection."""

    @pytest.mark.asyncio
    async def test_diagnostics_connection_status(
        self, mock_hub: MagicMock, mock_coordinator: ACModbusCoordinator
    ) -> None:
        """Test diagnostics includes connection status."""
        diagnostics = await async_get_diagnostics(
            hub=mock_hub,
            coordinator=mock_coordinator,
        )

        assert "connection" in diagnostics
        assert diagnostics["connection"]["connected"] is True

    @pytest.mark.asyncio
    async def test_diagnostics_error_info(
        self, mock_hub_with_error: MagicMock
    ) -> None:
        """Test diagnostics includes error information."""
        coordinator = ACModbusCoordinator(
            hub=mock_hub_with_error,
            poll_interval=DEFAULT_POLL_INTERVAL,
        )
        coordinator._available = False

        diagnostics = await async_get_diagnostics(
            hub=mock_hub_with_error,
            coordinator=coordinator,
        )

        assert "connection" in diagnostics
        assert diagnostics["connection"]["connected"] is False
        assert diagnostics["connection"]["last_error"] == "Connection refused"
        assert diagnostics["connection"]["backoff_count"] == 3

    @pytest.mark.asyncio
    async def test_diagnostics_timing_info(
        self, mock_hub: MagicMock, mock_coordinator: ACModbusCoordinator
    ) -> None:
        """Test diagnostics includes timing information."""
        diagnostics = await async_get_diagnostics(
            hub=mock_hub,
            coordinator=mock_coordinator,
        )

        assert "timing" in diagnostics
        assert "last_update" in diagnostics["timing"]
        assert "poll_interval" in diagnostics["timing"]

    @pytest.mark.asyncio
    async def test_diagnostics_config_info(
        self, mock_hub: MagicMock, mock_coordinator: ACModbusCoordinator
    ) -> None:
        """Test diagnostics includes configuration information."""
        diagnostics = await async_get_diagnostics(
            hub=mock_hub,
            coordinator=mock_coordinator,
        )

        assert "config" in diagnostics
        assert diagnostics["config"]["host"] == "192.168.1.100"
        assert diagnostics["config"]["port"] == 502
        assert diagnostics["config"]["unit_id"] == 1

    @pytest.mark.asyncio
    async def test_diagnostics_recent_operations(
        self, mock_hub: MagicMock, mock_coordinator: ACModbusCoordinator
    ) -> None:
        """Test diagnostics includes recent operations."""
        diagnostics = await async_get_diagnostics(
            hub=mock_hub,
            coordinator=mock_coordinator,
        )

        assert "registers" in diagnostics
        assert REGISTER_POWER in diagnostics["registers"]
        assert REGISTER_MODE in diagnostics["registers"]


class TestDiagnosticsPrivacy:
    """Test diagnostics privacy protection."""

    @pytest.mark.asyncio
    async def test_diagnostics_no_sensitive_data(
        self, mock_hub: MagicMock, mock_coordinator: ACModbusCoordinator
    ) -> None:
        """Test diagnostics does not leak sensitive information."""
        diagnostics = await async_get_diagnostics(
            hub=mock_hub,
            coordinator=mock_coordinator,
        )

        # Convert to string and check for sensitive patterns
        diag_str = str(diagnostics).lower()

        # Should not contain password-like fields
        assert "password" not in diag_str
        assert "secret" not in diag_str
        assert "token" not in diag_str
        assert "credential" not in diag_str

    @pytest.mark.asyncio
    async def test_diagnostics_host_redaction_option(
        self, mock_hub: MagicMock, mock_coordinator: ACModbusCoordinator
    ) -> None:
        """Test diagnostics can redact host for privacy."""
        diagnostics = await async_get_diagnostics(
            hub=mock_hub,
            coordinator=mock_coordinator,
            redact_host=True,
        )

        # Host should be redacted
        assert diagnostics["config"]["host"] == "**REDACTED**"


class TestDiagnosticsFormat:
    """Test diagnostics output format."""

    @pytest.mark.asyncio
    async def test_diagnostics_is_dict(
        self, mock_hub: MagicMock, mock_coordinator: ACModbusCoordinator
    ) -> None:
        """Test diagnostics returns a dictionary."""
        diagnostics = await async_get_diagnostics(
            hub=mock_hub,
            coordinator=mock_coordinator,
        )

        assert isinstance(diagnostics, dict)

    @pytest.mark.asyncio
    async def test_diagnostics_serializable(
        self, mock_hub: MagicMock, mock_coordinator: ACModbusCoordinator
    ) -> None:
        """Test diagnostics is JSON serializable."""
        import json

        diagnostics = await async_get_diagnostics(
            hub=mock_hub,
            coordinator=mock_coordinator,
        )

        # Should not raise
        json_str = json.dumps(diagnostics, default=str)
        assert len(json_str) > 0
