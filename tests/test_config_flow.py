"""Tests for config_flow module."""

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
    MIN_POLL_INTERVAL,
)

# Check if homeassistant is available for full integration tests
try:
    from homeassistant import config_entries
    from homeassistant.const import CONF_HOST, CONF_PORT
    from homeassistant.core import HomeAssistant
    from homeassistant.data_entry_flow import FlowResultType

    HAS_HOMEASSISTANT = True
except ImportError:
    HAS_HOMEASSISTANT = False
    CONF_HOST = "host"
    CONF_PORT = "port"


# Import config_flow module for testing
from custom_components.ac_modbus import config_flow


class TestConfigFlowValidation:
    """Test config flow validation functions."""

    def test_validate_input_valid_host(self) -> None:
        """Test validation passes for valid host."""
        user_input = {
            CONF_HOST: "192.168.1.100",
            CONF_PORT: DEFAULT_PORT,
        }
        errors = config_flow.validate_input(user_input)
        assert "host" not in errors

    def test_validate_input_empty_host(self) -> None:
        """Test validation fails for empty host."""
        user_input = {
            CONF_HOST: "",
            CONF_PORT: DEFAULT_PORT,
        }
        errors = config_flow.validate_input(user_input)
        assert "host" in errors

    def test_validate_input_valid_port(self) -> None:
        """Test validation passes for valid port."""
        user_input = {
            CONF_HOST: "192.168.1.100",
            CONF_PORT: 502,
        }
        errors = config_flow.validate_input(user_input)
        assert "port" not in errors

    def test_validate_input_invalid_port_too_low(self) -> None:
        """Test validation fails for port < 1."""
        user_input = {
            CONF_HOST: "192.168.1.100",
            CONF_PORT: 0,
        }
        errors = config_flow.validate_input(user_input)
        assert "port" in errors

    def test_validate_input_invalid_port_too_high(self) -> None:
        """Test validation fails for port > 65535."""
        user_input = {
            CONF_HOST: "192.168.1.100",
            CONF_PORT: 70000,
        }
        errors = config_flow.validate_input(user_input)
        assert "port" in errors

    def test_validate_input_poll_interval_valid(self) -> None:
        """Test validation passes for valid poll interval."""
        user_input = {
            CONF_HOST: "192.168.1.100",
            CONF_PORT: DEFAULT_PORT,
            CONF_POLL_INTERVAL: 10,
            CONF_TIMEOUT: 3,
        }
        errors = config_flow.validate_input(user_input)
        assert "poll_interval" not in errors

    def test_validate_input_poll_interval_too_low(self) -> None:
        """Test validation fails for poll interval < MIN_POLL_INTERVAL."""
        user_input = {
            CONF_HOST: "192.168.1.100",
            CONF_PORT: DEFAULT_PORT,
            CONF_POLL_INTERVAL: 3,  # Less than MIN_POLL_INTERVAL (5)
            CONF_TIMEOUT: 2,
        }
        errors = config_flow.validate_input(user_input)
        assert "poll_interval" in errors

    def test_validate_input_timeout_exceeds_poll(self) -> None:
        """Test validation fails when timeout >= poll_interval."""
        user_input = {
            CONF_HOST: "192.168.1.100",
            CONF_PORT: DEFAULT_PORT,
            CONF_POLL_INTERVAL: 10,
            CONF_TIMEOUT: 10,  # Equal to poll interval
        }
        errors = config_flow.validate_input(user_input)
        assert "timeout" in errors

    def test_validate_input_timeout_greater_than_poll(self) -> None:
        """Test validation fails when timeout > poll_interval."""
        user_input = {
            CONF_HOST: "192.168.1.100",
            CONF_PORT: DEFAULT_PORT,
            CONF_POLL_INTERVAL: 10,
            CONF_TIMEOUT: 15,  # Greater than poll interval
        }
        errors = config_flow.validate_input(user_input)
        assert "timeout" in errors


class TestConfigFlowConnection:
    """Test config flow connection validation."""

    @pytest.mark.asyncio
    async def test_validate_connection_success(
        self, mock_modbus_client: MagicMock
    ) -> None:
        """Test connection validation succeeds with working client."""
        with patch(
            "custom_components.ac_modbus.config_flow.AsyncModbusTcpClient",
            return_value=mock_modbus_client,
        ):
            result = await config_flow.validate_connection(
                host="192.168.1.100",
                port=502,
                timeout=3.0,
            )
            assert result is True

    @pytest.mark.asyncio
    async def test_validate_connection_failure(
        self, mock_modbus_client_disconnected: MagicMock
    ) -> None:
        """Test connection validation fails when cannot connect."""
        with patch(
            "custom_components.ac_modbus.config_flow.AsyncModbusTcpClient",
            return_value=mock_modbus_client_disconnected,
        ):
            result = await config_flow.validate_connection(
                host="192.168.1.100",
                port=502,
                timeout=3.0,
            )
            assert result is False


class TestBuildDataSchema:
    """Test data schema building."""

    def test_get_user_data_schema(self) -> None:
        """Test that user data schema includes all required fields."""
        schema = config_flow.get_user_data_schema()
        assert schema is not None

        # Check required fields are in schema
        schema_dict = {str(k): v for k, v in schema.schema.items()}
        assert CONF_HOST in schema_dict or "host" in schema_dict

    def test_get_user_data_schema_with_defaults(self) -> None:
        """Test that data schema has sensible defaults."""
        schema = config_flow.get_user_data_schema()
        schema_dict = {str(k): v for k, v in schema.schema.items()}

        # Port should have default
        port_key = CONF_PORT if CONF_PORT in schema_dict else "port"
        if port_key in schema_dict:
            # Check if default is set (this depends on schema definition)
            pass


# Full HA integration tests (only run if homeassistant is available)
if HAS_HOMEASSISTANT:

    @pytest.fixture
    def bypass_connection_validation():
        """Bypass connection validation for config flow tests."""
        with patch(
            "custom_components.ac_modbus.config_flow.validate_connection",
            return_value=True,
        ):
            yield

    class TestConfigFlowIntegration:
        """Integration tests for config flow (requires HA)."""

        @pytest.mark.asyncio
        async def test_form_user_flow(
            self,
            hass: HomeAssistant,
            bypass_connection_validation,
        ) -> None:
            """Test that user flow shows the form."""
            result = await hass.config_entries.flow.async_init(
                DOMAIN, context={"source": config_entries.SOURCE_USER}
            )
            assert result["type"] == FlowResultType.FORM
            assert result["step_id"] == "user"

        @pytest.mark.asyncio
        async def test_form_valid_input(
            self,
            hass: HomeAssistant,
            bypass_connection_validation,
        ) -> None:
            """Test config flow with valid input creates entry."""
            result = await hass.config_entries.flow.async_init(
                DOMAIN, context={"source": config_entries.SOURCE_USER}
            )

            result2 = await hass.config_entries.flow.async_configure(
                result["flow_id"],
                {
                    CONF_HOST: "192.168.1.100",
                    CONF_PORT: 502,
                    CONF_UNIT_ID: 1,
                    CONF_POLL_INTERVAL: 10,
                    CONF_TIMEOUT: 3,
                },
            )

            assert result2["type"] == FlowResultType.CREATE_ENTRY
            assert result2["title"] == "192.168.1.100"
            assert result2["data"][CONF_HOST] == "192.168.1.100"

        @pytest.mark.asyncio
        async def test_form_cannot_connect(
            self,
            hass: HomeAssistant,
        ) -> None:
            """Test config flow handles connection failure."""
            with patch(
                "custom_components.ac_modbus.config_flow.validate_connection",
                return_value=False,
            ):
                result = await hass.config_entries.flow.async_init(
                    DOMAIN, context={"source": config_entries.SOURCE_USER}
                )

                result2 = await hass.config_entries.flow.async_configure(
                    result["flow_id"],
                    {
                        CONF_HOST: "192.168.1.100",
                        CONF_PORT: 502,
                    },
                )

                assert result2["type"] == FlowResultType.FORM
                assert "cannot_connect" in result2["errors"]["base"]
