"""Tests for constants module."""

from __future__ import annotations

import pytest

from custom_components.ac_modbus.const import (
    ATTR_END,
    ATTR_ERROR,
    ATTR_READBACK,
    ATTR_REGISTER,
    ATTR_RESULTS,
    ATTR_START,
    ATTR_STEP,
    ATTR_VALUE,
    ATTR_VERIFIED,
    CONF_MODE_MAP,
    CONF_POLL_INTERVAL,
    CONF_RECONNECT_BACKOFF,
    CONF_SCAN_END,
    CONF_SCAN_START,
    CONF_SCAN_STEP,
    CONF_TIMEOUT,
    CONF_UNIT_ID,
    DEFAULT_MODE_MAP,
    DEFAULT_POLL_INTERVAL,
    DEFAULT_PORT,
    DEFAULT_RECONNECT_BACKOFF,
    DEFAULT_SCAN_STEP,
    DEFAULT_TIMEOUT,
    DEFAULT_UNIT_ID,
    DOMAIN,
    EVENT_SCAN_RESULT,
    MAX_SCAN_RANGE,
    MIN_POLL_INTERVAL,
    PLATFORMS,
    REGISTER_MODE,
    REGISTER_POWER,
    SERVICE_SCAN_RANGE,
    SERVICE_WRITE_REGISTER,
)


class TestDomain:
    """Test domain constant."""

    def test_domain_is_string(self) -> None:
        """Test that DOMAIN is a string."""
        assert isinstance(DOMAIN, str)

    def test_domain_value(self) -> None:
        """Test that DOMAIN has correct value."""
        assert DOMAIN == "ac_modbus"


class TestConfigConstants:
    """Test configuration constants."""

    def test_unit_id_key(self) -> None:
        """Test CONF_UNIT_ID is defined."""
        assert CONF_UNIT_ID == "unit_id"

    def test_poll_interval_key(self) -> None:
        """Test CONF_POLL_INTERVAL is defined."""
        assert CONF_POLL_INTERVAL == "poll_interval"

    def test_timeout_key(self) -> None:
        """Test CONF_TIMEOUT is defined."""
        assert CONF_TIMEOUT == "timeout"

    def test_reconnect_backoff_key(self) -> None:
        """Test CONF_RECONNECT_BACKOFF is defined."""
        assert CONF_RECONNECT_BACKOFF == "reconnect_backoff"

    def test_mode_map_key(self) -> None:
        """Test CONF_MODE_MAP is defined."""
        assert CONF_MODE_MAP == "mode_map"

    def test_scan_keys(self) -> None:
        """Test scan config keys are defined."""
        assert CONF_SCAN_START == "scan_start"
        assert CONF_SCAN_END == "scan_end"
        assert CONF_SCAN_STEP == "scan_step"


class TestDefaultValues:
    """Test default value constants."""

    def test_default_port(self) -> None:
        """Test DEFAULT_PORT is standard Modbus port."""
        assert DEFAULT_PORT == 502

    def test_default_unit_id(self) -> None:
        """Test DEFAULT_UNIT_ID."""
        assert DEFAULT_UNIT_ID == 1

    def test_default_poll_interval(self) -> None:
        """Test DEFAULT_POLL_INTERVAL is 10 seconds."""
        assert DEFAULT_POLL_INTERVAL == 10

    def test_default_timeout(self) -> None:
        """Test DEFAULT_TIMEOUT is less than poll interval."""
        assert DEFAULT_TIMEOUT < DEFAULT_POLL_INTERVAL
        assert DEFAULT_TIMEOUT == 3

    def test_default_reconnect_backoff(self) -> None:
        """Test DEFAULT_RECONNECT_BACKOFF."""
        assert DEFAULT_RECONNECT_BACKOFF == 5

    def test_default_scan_step(self) -> None:
        """Test DEFAULT_SCAN_STEP."""
        assert DEFAULT_SCAN_STEP == 1


class TestRegisterAddresses:
    """Test register address constants."""

    def test_power_register(self) -> None:
        """Test REGISTER_POWER is 1033."""
        assert REGISTER_POWER == 1033

    def test_mode_register(self) -> None:
        """Test REGISTER_MODE is 1041."""
        assert REGISTER_MODE == 1041


class TestModeMap:
    """Test mode map constant."""

    def test_default_mode_map_is_dict(self) -> None:
        """Test DEFAULT_MODE_MAP is a dictionary."""
        assert isinstance(DEFAULT_MODE_MAP, dict)

    def test_default_mode_map_has_all_modes(self) -> None:
        """Test DEFAULT_MODE_MAP has all standard modes."""
        expected_modes = {"cool", "heat", "fan_only", "dry"}
        actual_modes = set(DEFAULT_MODE_MAP.values())
        assert actual_modes == expected_modes

    def test_default_mode_map_keys_are_integers(self) -> None:
        """Test DEFAULT_MODE_MAP keys are integers."""
        for key in DEFAULT_MODE_MAP:
            assert isinstance(key, int)

    def test_default_mode_map_values_are_strings(self) -> None:
        """Test DEFAULT_MODE_MAP values are strings."""
        for value in DEFAULT_MODE_MAP.values():
            assert isinstance(value, str)

    def test_default_mode_map_entries(self) -> None:
        """Test DEFAULT_MODE_MAP specific entries."""
        assert DEFAULT_MODE_MAP[1] == "cool"
        assert DEFAULT_MODE_MAP[2] == "heat"
        assert DEFAULT_MODE_MAP[3] == "fan_only"
        assert DEFAULT_MODE_MAP[4] == "dry"


class TestConstraints:
    """Test constraint constants."""

    def test_min_poll_interval(self) -> None:
        """Test MIN_POLL_INTERVAL is 5 seconds."""
        assert MIN_POLL_INTERVAL == 5

    def test_max_scan_range(self) -> None:
        """Test MAX_SCAN_RANGE is 100 registers."""
        assert MAX_SCAN_RANGE == 100


class TestPlatforms:
    """Test platform constants."""

    def test_platforms_is_list(self) -> None:
        """Test PLATFORMS is a list."""
        assert isinstance(PLATFORMS, (list, tuple))

    def test_platforms_has_switch(self) -> None:
        """Test PLATFORMS includes switch."""
        assert "switch" in PLATFORMS

    def test_platforms_has_select(self) -> None:
        """Test PLATFORMS includes select."""
        assert "select" in PLATFORMS


class TestServices:
    """Test service name constants."""

    def test_write_register_service(self) -> None:
        """Test SERVICE_WRITE_REGISTER."""
        assert SERVICE_WRITE_REGISTER == "write_register"

    def test_scan_range_service(self) -> None:
        """Test SERVICE_SCAN_RANGE."""
        assert SERVICE_SCAN_RANGE == "scan_range"


class TestEvents:
    """Test event name constants."""

    def test_scan_result_event(self) -> None:
        """Test EVENT_SCAN_RESULT."""
        assert EVENT_SCAN_RESULT == "ac_modbus_scan_result"


class TestAttributes:
    """Test attribute name constants."""

    def test_register_attr(self) -> None:
        """Test ATTR_REGISTER."""
        assert ATTR_REGISTER == "register"

    def test_value_attr(self) -> None:
        """Test ATTR_VALUE."""
        assert ATTR_VALUE == "value"

    def test_verified_attr(self) -> None:
        """Test ATTR_VERIFIED."""
        assert ATTR_VERIFIED == "verified"

    def test_readback_attr(self) -> None:
        """Test ATTR_READBACK."""
        assert ATTR_READBACK == "readback"

    def test_error_attr(self) -> None:
        """Test ATTR_ERROR."""
        assert ATTR_ERROR == "error"

    def test_scan_attrs(self) -> None:
        """Test scan-related attributes."""
        assert ATTR_START == "start"
        assert ATTR_END == "end"
        assert ATTR_STEP == "step"
        assert ATTR_RESULTS == "results"
