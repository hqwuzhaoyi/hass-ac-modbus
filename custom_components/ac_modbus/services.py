"""Services for AC Modbus integration."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from .const import (
    ATTR_END,
    ATTR_ERROR,
    ATTR_READBACK,
    ATTR_REGISTER,
    ATTR_RESULTS,
    ATTR_START,
    ATTR_STEP,
    ATTR_VALUE,
    ATTR_VERIFIED,
    DOMAIN,
    MAX_SCAN_RANGE,
    SERVICE_SCAN_RANGE,
    SERVICE_WRITE_REGISTER,
)

if TYPE_CHECKING:
    from .hub import ModbusHub

_LOGGER = logging.getLogger(__name__)


@dataclass
class WriteRegisterResult:
    """Result of a write_register service call."""

    register: int
    value: int
    verified: bool
    readback: int | None = None
    error: str | None = None
    unit_id: int = 1

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for service response."""
        return {
            ATTR_REGISTER: self.register,
            ATTR_VALUE: self.value,
            ATTR_VERIFIED: self.verified,
            ATTR_READBACK: self.readback,
            ATTR_ERROR: self.error,
            "unit_id": self.unit_id,
        }


@dataclass
class ScanRangeResult:
    """Result of a scan_range service call."""

    start: int
    end: int
    step: int = 1
    results: dict[int, int] = field(default_factory=dict)
    errors: list[dict[str, Any]] = field(default_factory=list)
    unit_id: int = 1

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for service response."""
        return {
            ATTR_START: self.start,
            ATTR_END: self.end,
            ATTR_STEP: self.step,
            ATTR_RESULTS: self.results,
            "errors": self.errors,
            "unit_id": self.unit_id,
        }


async def async_handle_write_register(
    hub: ModbusHub,
    register: int,
    value: int,
    unit_id: int | None = None,
    verify: bool = True,
    expected: int | None = None,
    timeout: float | None = None,
) -> WriteRegisterResult:
    """Handle write_register service call.

    Args:
        hub: The ModbusHub instance.
        register: Register address to write.
        value: Value to write.
        unit_id: Optional unit/slave ID.
        verify: Whether to verify the write with readback.
        expected: Expected readback value (defaults to written value).
        timeout: Optional timeout for the operation.

    Returns:
        WriteRegisterResult with operation status.
    """
    _LOGGER.debug(
        "write_register service: register=%d, value=%d, verify=%s",
        register,
        value,
        verify,
    )

    try:
        await hub.write_register(
            address=register,
            value=value,
            unit_id=unit_id,
            verify=verify,
            expected=expected,
        )

        # If we get here, write (and optional verify) succeeded
        readback = value if verify else None
        if verify:
            # Read the actual value to include in response
            readback = await hub.read_register(register, unit_id=unit_id)

        return WriteRegisterResult(
            register=register,
            value=value,
            verified=True,
            readback=readback,
            error=None,
            unit_id=unit_id or hub.unit_id,
        )

    except ValueError as ex:
        # Verification mismatch
        _LOGGER.warning("write_register verification failed: %s", ex)
        return WriteRegisterResult(
            register=register,
            value=value,
            verified=False,
            readback=None,
            error=str(ex),
            unit_id=unit_id or hub.unit_id,
        )

    except Exception as ex:
        # Other errors
        _LOGGER.error("write_register failed: %s", ex)
        return WriteRegisterResult(
            register=register,
            value=value,
            verified=False,
            readback=None,
            error=str(ex),
            unit_id=unit_id or hub.unit_id,
        )


async def async_handle_scan_range(
    hub: ModbusHub,
    start: int,
    end: int,
    step: int = 1,
    unit_id: int | None = None,
    timeout: float | None = None,
) -> ScanRangeResult:
    """Handle scan_range service call.

    Args:
        hub: The ModbusHub instance.
        start: Start register address (inclusive).
        end: End register address (inclusive).
        step: Step between registers (default 1).
        unit_id: Optional unit/slave ID.
        timeout: Optional timeout for each read.

    Returns:
        ScanRangeResult with register values and any errors.

    Raises:
        ValueError: If range exceeds MAX_SCAN_RANGE.
    """
    range_size = (end - start) // step + 1

    if range_size > MAX_SCAN_RANGE:
        raise ValueError(
            f"Scan range too large: {range_size} registers. "
            f"Maximum is {MAX_SCAN_RANGE}."
        )

    _LOGGER.debug(
        "scan_range service: start=%d, end=%d, step=%d",
        start,
        end,
        step,
    )

    result = ScanRangeResult(
        start=start,
        end=end,
        step=step,
        unit_id=unit_id or hub.unit_id,
    )

    for address in range(start, end + 1, step):
        try:
            value = await hub.read_register(address, unit_id=unit_id)
            result.results[address] = value
            _LOGGER.debug("Scanned register %d: %d", address, value)
        except Exception as ex:
            _LOGGER.warning("Failed to read register %d: %s", address, ex)
            result.errors.append(
                {
                    ATTR_REGISTER: address,
                    ATTR_ERROR: str(ex),
                }
            )

    _LOGGER.info(
        "scan_range completed: %d successful, %d errors",
        len(result.results),
        len(result.errors),
    )

    return result


# Check if homeassistant is available
try:
    from homeassistant.core import HomeAssistant, ServiceCall
    import voluptuous as vol
    from homeassistant.helpers import config_validation as cv

    HAS_HOMEASSISTANT = True

    # Service schemas
    WRITE_REGISTER_SCHEMA = vol.Schema(
        {
            vol.Required(ATTR_REGISTER): cv.positive_int,
            vol.Required(ATTR_VALUE): vol.Coerce(int),
            vol.Optional("unit_id"): cv.positive_int,
            vol.Optional("verify", default=True): cv.boolean,
            vol.Optional("expected"): vol.Coerce(int),
            vol.Optional("timeout"): vol.Coerce(float),
        }
    )

    SCAN_RANGE_SCHEMA = vol.Schema(
        {
            vol.Required(ATTR_START): cv.positive_int,
            vol.Required(ATTR_END): cv.positive_int,
            vol.Optional(ATTR_STEP, default=1): cv.positive_int,
            vol.Optional("unit_id"): cv.positive_int,
            vol.Optional("timeout"): vol.Coerce(float),
        }
    )

    async def async_setup_services(hass: HomeAssistant) -> None:
        """Set up services for AC Modbus integration."""

        async def handle_write_register(call: ServiceCall) -> dict[str, Any]:
            """Handle write_register service call."""
            # Get the first hub from all entries
            hub = None
            for entry_id, entry_data in hass.data.get(DOMAIN, {}).items():
                hub = entry_data.get("hub")
                if hub:
                    break

            if hub is None:
                raise ValueError("No AC Modbus hub configured")

            result = await async_handle_write_register(
                hub=hub,
                register=call.data[ATTR_REGISTER],
                value=call.data[ATTR_VALUE],
                unit_id=call.data.get("unit_id"),
                verify=call.data.get("verify", True),
                expected=call.data.get("expected"),
                timeout=call.data.get("timeout"),
            )

            return result.to_dict()

        async def handle_scan_range(call: ServiceCall) -> dict[str, Any]:
            """Handle scan_range service call."""
            # Get the first hub from all entries
            hub = None
            for entry_id, entry_data in hass.data.get(DOMAIN, {}).items():
                hub = entry_data.get("hub")
                if hub:
                    break

            if hub is None:
                raise ValueError("No AC Modbus hub configured")

            result = await async_handle_scan_range(
                hub=hub,
                start=call.data[ATTR_START],
                end=call.data[ATTR_END],
                step=call.data.get(ATTR_STEP, 1),
                unit_id=call.data.get("unit_id"),
                timeout=call.data.get("timeout"),
            )

            # Fire event with scan results
            hass.bus.async_fire(
                "ac_modbus_scan_result",
                result.to_dict(),
            )

            return result.to_dict()

        hass.services.async_register(
            DOMAIN,
            SERVICE_WRITE_REGISTER,
            handle_write_register,
            schema=WRITE_REGISTER_SCHEMA,
        )

        hass.services.async_register(
            DOMAIN,
            SERVICE_SCAN_RANGE,
            handle_scan_range,
            schema=SCAN_RANGE_SCHEMA,
        )

        _LOGGER.info("AC Modbus services registered")

    async def async_unload_services(hass: HomeAssistant) -> None:
        """Unload services."""
        hass.services.async_remove(DOMAIN, SERVICE_WRITE_REGISTER)
        hass.services.async_remove(DOMAIN, SERVICE_SCAN_RANGE)
        _LOGGER.info("AC Modbus services unloaded")

except ImportError:
    HAS_HOMEASSISTANT = False
