"""Diagnostics support for AC Modbus integration."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from .const import DOMAIN

if TYPE_CHECKING:
    from .coordinator import ACModbusCoordinator
    from .hub import ModbusHub


async def async_get_diagnostics(
    hub: ModbusHub,
    coordinator: ACModbusCoordinator,
    redact_host: bool = False,
) -> dict[str, Any]:
    """Return diagnostics data for the integration.

    Args:
        hub: The ModbusHub instance.
        coordinator: The data coordinator.
        redact_host: Whether to redact the host IP for privacy.

    Returns:
        Dictionary containing diagnostics information.
    """
    # Connection information
    connection_info: dict[str, Any] = {
        "connected": hub.is_connected,
        "last_error": hub.last_error,
        "backoff_count": getattr(hub, "backoff_count", 0),
    }

    if hub.last_error_time is not None:
        connection_info["last_error_time"] = _format_datetime(hub.last_error_time)

    if hub.last_success_time is not None:
        connection_info["last_success_time"] = _format_datetime(hub.last_success_time)

    # Configuration information
    config_info: dict[str, Any] = {
        "host": "**REDACTED**" if redact_host else hub.host,
        "port": hub.port,
        "unit_id": hub.unit_id,
    }

    # Timing information
    timing_info: dict[str, Any] = {
        "poll_interval": coordinator.poll_interval,
    }

    last_update = getattr(coordinator, "_last_update_time", None)
    if last_update is not None:
        timing_info["last_update"] = _format_datetime(last_update)

    # Register data
    registers: dict[int, int] = {}
    if hasattr(coordinator, "_data") and coordinator._data:
        registers = dict(coordinator._data)

    return {
        "connection": connection_info,
        "config": config_info,
        "timing": timing_info,
        "registers": registers,
    }


def _format_datetime(dt: datetime) -> str:
    """Format datetime for JSON serialization.

    Args:
        dt: Datetime object to format.

    Returns:
        ISO format string.
    """
    return dt.isoformat()


# Check if homeassistant is available for HA-specific diagnostics
try:
    from homeassistant.config_entries import ConfigEntry
    from homeassistant.core import HomeAssistant

    HAS_HOMEASSISTANT = True

    async def async_get_config_entry_diagnostics(
        hass: HomeAssistant,
        entry: ConfigEntry,
    ) -> dict[str, Any]:
        """Return diagnostics for a config entry.

        Args:
            hass: Home Assistant instance.
            entry: Config entry to get diagnostics for.

        Returns:
            Dictionary containing diagnostics information.
        """
        data = hass.data.get(DOMAIN, {}).get(entry.entry_id, {})
        hub = data.get("hub")
        coordinator = data.get("coordinator")

        if hub is None or coordinator is None:
            return {"error": "Integration not fully loaded"}

        # By default, redact host in HA diagnostics for privacy
        return await async_get_diagnostics(
            hub=hub,
            coordinator=coordinator,
            redact_host=True,
        )

except ImportError:
    HAS_HOMEASSISTANT = False
