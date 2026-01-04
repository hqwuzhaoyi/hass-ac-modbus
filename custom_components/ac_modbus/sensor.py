"""Sensor entities for AC Modbus integration."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from .const import (
    DEFAULT_MODE_MAP,
    DOMAIN,
    FILTER_CYCLE_DAYS,
    REGISTER_MODE,
    REGISTER_POWER,
)

if TYPE_CHECKING:
    from .coordinator import ACModbusCoordinator, FilterDataManager

_LOGGER = logging.getLogger(__name__)

# Check if homeassistant is available
try:
    from homeassistant.components.sensor import SensorEntity
    from homeassistant.config_entries import ConfigEntry
    from homeassistant.core import HomeAssistant
    from homeassistant.helpers.entity_platform import AddEntitiesCallback
    from homeassistant.helpers.update_coordinator import CoordinatorEntity

    HAS_HOMEASSISTANT = True
except ImportError:
    HAS_HOMEASSISTANT = False
    SensorEntity = object  # type: ignore[misc, assignment]
    CoordinatorEntity = object  # type: ignore[misc, assignment]


# HA-specific entity (only available when homeassistant is installed)
if HAS_HOMEASSISTANT:

    class HAModeSensorEntity(CoordinatorEntity, SensorEntity):
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
            super().__init__(coordinator)
            self._entry_id = entry_id
            self._mode_map = DEFAULT_MODE_MAP

            self._attr_name = "AC Mode"
            self._attr_unique_id = f"{entry_id}_mode_sensor"
            self._attr_has_entity_name = True
            self._attr_icon = "mdi:air-conditioner"

        @property
        def available(self) -> bool:
            """Return True if entity is available."""
            return self.coordinator.available

        @property
        def native_value(self) -> str | None:
            """Return the current mode as a string."""
            if not self.available:
                return None

            value = self.coordinator.get_register(REGISTER_MODE)
            if value is None:
                return None

            return self._mode_map.get(value, f"unknown ({value})")

        @property
        def extra_state_attributes(self) -> dict[str, Any]:
            """Return extra state attributes."""
            power_value = self.coordinator.get_register(REGISTER_POWER)
            power_on = power_value == 1
            return {
                "register_value": self.coordinator.get_register(REGISTER_MODE),
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

    class FilterDaysRemainingSensor(SensorEntity):
        """Sensor entity for filter days remaining.

        Shows the number of days until the next filter replacement.
        Positive values mean days remaining, negative means overdue.
        """

        _attr_has_entity_name = True
        _attr_translation_key = "filter_days_remaining"
        _attr_native_unit_of_measurement = "d"
        _attr_state_class = "measurement"

        def __init__(
            self,
            filter_manager: FilterDataManager,
            entry_id: str,
        ) -> None:
            """Initialize the sensor entity.

            Args:
                filter_manager: The filter data manager.
                entry_id: Config entry ID for unique identification.
            """
            self._filter_manager = filter_manager
            self._entry_id = entry_id
            self._attr_unique_id = f"{entry_id}_filter_days_remaining"

        async def async_added_to_hass(self) -> None:
            """Run when entity is added to hass."""
            await super().async_added_to_hass()
            # Register listener for filter data changes
            self._filter_manager.add_listener(self._handle_filter_update)

        async def async_will_remove_from_hass(self) -> None:
            """Run when entity will be removed from hass."""
            await super().async_will_remove_from_hass()
            self._filter_manager.remove_listener(self._handle_filter_update)

        def _handle_filter_update(self) -> None:
            """Handle filter data update."""
            self.async_write_ha_state()

        @property
        def native_value(self) -> int:
            """Return the days remaining until next filter replacement."""
            return self._filter_manager.days_remaining

        @property
        def icon(self) -> str:
            """Return the icon based on days remaining."""
            days = self.native_value
            if days <= 0:
                return "mdi:air-filter"  # Overdue
            elif days <= 14:
                return "mdi:air-filter"  # Soon
            else:
                return "mdi:air-filter"  # Normal

        @property
        def extra_state_attributes(self) -> dict[str, Any]:
            """Return extra state attributes."""
            last = self._filter_manager.last_replacement
            next_date = self._filter_manager.next_replacement

            return {
                "last_replacement": last.date().isoformat() if last else None,
                "next_replacement": next_date.date().isoformat() if next_date else None,
                "cycle_days": FILTER_CYCLE_DAYS,
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
        entry_data = hass.data[DOMAIN][entry.entry_id]

        coordinator = entry_data.get("coordinator")
        if coordinator is None:
            _LOGGER.error("Coordinator not found for entry %s", entry.entry_id)
            return

        entities: list[SensorEntity] = [
            HAModeSensorEntity(coordinator, entry.entry_id)
        ]

        # Add filter sensor if filter manager is available
        filter_manager = entry_data.get("filter_manager")
        if filter_manager is not None:
            entities.append(
                FilterDaysRemainingSensor(filter_manager, entry.entry_id)
            )

        async_add_entities(entities)
