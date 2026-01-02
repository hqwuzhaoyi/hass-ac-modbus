"""Sensor entities for AC Modbus integration."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from .const import DEFAULT_MODE_MAP, DOMAIN, REGISTER_MODE, REGISTER_POWER

if TYPE_CHECKING:
    from .coordinator import ACModbusCoordinator

_LOGGER = logging.getLogger(__name__)

# Check if homeassistant is available
try:
    from homeassistant.components.sensor import SensorEntity
    from homeassistant.config_entries import ConfigEntry
    from homeassistant.core import HomeAssistant
    from homeassistant.helpers.entity_platform import AddEntitiesCallback

    HAS_HOMEASSISTANT = True
except ImportError:
    HAS_HOMEASSISTANT = False
    SensorEntity = object  # type: ignore[misc, assignment]


# HA-specific entity (only available when homeassistant is installed)
if HAS_HOMEASSISTANT:

    class HAModeSensorEntity(SensorEntity):
        """Home Assistant Sensor entity for AC mode display.

        This sensor always shows the current mode value, regardless of power state.
        For changing the mode, use the select entity (only available when power is OFF).
        """

        def __init__(
            self,
            coordinator: ACModbusCoordinator,
            entry_id: str,
        ) -> None:
            """Initialize the sensor entity.

            Args:
                coordinator: The data coordinator.
                entry_id: Config entry ID for unique identification.
            """
            self._coordinator = coordinator
            self._entry_id = entry_id
            self._mode_map = DEFAULT_MODE_MAP

            self._attr_name = "AC Mode"
            self._attr_unique_id = f"{entry_id}_mode_sensor"
            self._attr_has_entity_name = True
            self._attr_icon = "mdi:air-conditioner"

        @property
        def available(self) -> bool:
            """Return True if entity is available."""
            return self._coordinator.available

        @property
        def native_value(self) -> str | None:
            """Return the current mode as a string."""
            if not self.available:
                return None

            value = self._coordinator.get_register(REGISTER_MODE)
            if value is None:
                return None

            return self._mode_map.get(value, f"unknown ({value})")

        @property
        def extra_state_attributes(self) -> dict[str, Any]:
            """Return extra state attributes."""
            power_value = self._coordinator.get_register(REGISTER_POWER)
            power_on = power_value == 1
            return {
                "register_value": self._coordinator.get_register(REGISTER_MODE),
                "editable": not power_on,
                "constraint": "Turn off power to change mode" if power_on else None,
            }

        @property
        def device_info(self) -> dict[str, Any]:
            """Return device info."""
            return {
                "identifiers": {(DOMAIN, self._entry_id)},
                "name": "AC Modbus Device",
                "manufacturer": "Unknown",
                "model": "Modbus AC",
            }

    async def async_setup_entry(
        hass: HomeAssistant,
        entry: ConfigEntry,
        async_add_entities: AddEntitiesCallback,
    ) -> None:
        """Set up the sensor platform.

        Args:
            hass: Home Assistant instance.
            entry: Config entry.
            async_add_entities: Callback to add entities.
        """
        coordinator = hass.data[DOMAIN][entry.entry_id].get("coordinator")
        if coordinator is None:
            _LOGGER.error("Coordinator not found for entry %s", entry.entry_id)
            return

        async_add_entities([HAModeSensorEntity(coordinator, entry.entry_id)])
