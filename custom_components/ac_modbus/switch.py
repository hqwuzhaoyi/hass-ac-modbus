"""Switch entity for AC Modbus integration."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from .const import (
    DOMAIN,
    REGISTER_HOME_AWAY,
    REGISTER_HUMIDIFY,
    REGISTER_POWER,
)

if TYPE_CHECKING:
    from .coordinator import ACModbusCoordinator

_LOGGER = logging.getLogger(__name__)

# Check if homeassistant is available
try:
    from homeassistant.components.switch import SwitchEntity
    from homeassistant.config_entries import ConfigEntry
    from homeassistant.core import HomeAssistant
    from homeassistant.helpers.entity_platform import AddEntitiesCallback

    HAS_HOMEASSISTANT = True
except ImportError:
    HAS_HOMEASSISTANT = False
    SwitchEntity = object  # type: ignore[misc, assignment]


class ACModbusPowerSwitch:
    """Switch entity for AC power control (register 1033)."""

    def __init__(
        self,
        coordinator: ACModbusCoordinator,
        entry_id: str,
    ) -> None:
        """Initialize the switch.

        Args:
            coordinator: The data coordinator.
            entry_id: Config entry ID for unique identification.
        """
        self._coordinator = coordinator
        self._entry_id = entry_id
        self._attr_name = "AC Power"
        self._attr_unique_id = f"{entry_id}_power_switch"
        self._attr_device_class = None

    @property
    def coordinator(self) -> ACModbusCoordinator:
        """Return the coordinator."""
        return self._coordinator

    @property
    def unique_id(self) -> str:
        """Return the unique ID."""
        return self._attr_unique_id

    @property
    def name(self) -> str:
        """Return the name."""
        return self._attr_name

    @property
    def device_class(self) -> str | None:
        """Return the device class."""
        return self._attr_device_class

    @property
    def available(self) -> bool:
        """Return True if entity is available."""
        return self._coordinator.available

    @property
    def is_on(self) -> bool | None:
        """Return True if the switch is on."""
        if not self.available:
            return None
        value = self._coordinator.get_register(REGISTER_POWER)
        if value is None:
            return None
        return value == 1

    async def async_turn_on(self, *_kwargs: Any) -> None:
        """Turn on the switch.

        Args:
            **kwargs: Additional keyword arguments (unused).
        """
        _LOGGER.debug("Turning on AC power")
        await self._coordinator.hub.write_register(
            address=REGISTER_POWER,
            value=1,
            verify=True,
        )
        # Update coordinator data
        self._coordinator._data[REGISTER_POWER] = 1

    async def async_turn_off(self, *_kwargs: Any) -> None:
        """Turn off the switch.

        Args:
            **kwargs: Additional keyword arguments (unused).
        """
        _LOGGER.debug("Turning off AC power")
        await self._coordinator.hub.write_register(
            address=REGISTER_POWER,
            value=0,
            verify=True,
        )
        # Update coordinator data
        self._coordinator._data[REGISTER_POWER] = 0


# HA-specific entity (only available when homeassistant is installed)
if HAS_HOMEASSISTANT:

    class HAPowerSwitchEntity(SwitchEntity):
        """Home Assistant Switch entity for AC power control."""

        def __init__(
            self,
            coordinator: ACModbusCoordinator,
            entry_id: str,
        ) -> None:
            """Initialize the switch entity.

            Args:
                coordinator: The data coordinator.
                entry_id: Config entry ID for unique identification.
            """
            self._coordinator = coordinator
            self._entry_id = entry_id
            self._attr_name = "AC Power"
            self._attr_unique_id = f"{entry_id}_power_switch"
            self._attr_has_entity_name = True

        @property
        def available(self) -> bool:
            """Return True if entity is available."""
            return self._coordinator.available

        @property
        def is_on(self) -> bool | None:
            """Return True if the switch is on."""
            if not self.available:
                return None
            value = self._coordinator.get_register(REGISTER_POWER)
            if value is None:
                return None
            return value == 1

        async def async_turn_on(self, *_kwargs: Any) -> None:
            """Turn on the switch."""
            _LOGGER.debug("Turning on AC power")
            await self._coordinator.hub.write_register(
                address=REGISTER_POWER,
                value=1,
                verify=True,
            )
            # Request coordinator refresh
            await self._coordinator.async_refresh()

        async def async_turn_off(self, *_kwargs: Any) -> None:
            """Turn off the switch."""
            _LOGGER.debug("Turning off AC power")
            await self._coordinator.hub.write_register(
                address=REGISTER_POWER,
                value=0,
                verify=True,
            )
            # Request coordinator refresh
            await self._coordinator.async_refresh()

        @property
        def device_info(self) -> dict[str, Any]:
            """Return device info."""
            return {
                "identifiers": {(DOMAIN, self._entry_id)},
                "name": "AC Modbus Device",
                "manufacturer": "Unknown",
                "model": "Modbus AC",
            }

    class HAHomeAwaySwitchEntity(SwitchEntity):
        """Home Assistant Switch entity for Home/Away mode control.

        This switch controls register 1034 and requires power to be ON.
        """

        def __init__(
            self,
            coordinator: ACModbusCoordinator,
            entry_id: str,
        ) -> None:
            """Initialize the switch entity.

            Args:
                coordinator: The data coordinator.
                entry_id: Config entry ID for unique identification.
            """
            self._coordinator = coordinator
            self._entry_id = entry_id
            self._attr_name = "Home Mode"
            self._attr_unique_id = f"{entry_id}_home_away_switch"
            self._attr_has_entity_name = True
            self._attr_icon = "mdi:home-account"

        @property
        def available(self) -> bool:
            """Return True if entity is available.

            This switch is only available when power is ON.
            """
            if not self._coordinator.available:
                return False
            power_value = self._coordinator.get_register(REGISTER_POWER)
            return power_value == 1

        @property
        def is_on(self) -> bool | None:
            """Return True if the switch is on (Home mode)."""
            if not self._coordinator.available:
                return None
            value = self._coordinator.get_register(REGISTER_HOME_AWAY)
            if value is None:
                return None
            return value == 1

        async def async_turn_on(self, *_kwargs: Any) -> None:
            """Turn on the switch (set to Home mode)."""
            power_value = self._coordinator.get_register(REGISTER_POWER)
            if power_value != 1:
                _LOGGER.warning("Cannot set Home mode: power is OFF")
                return
            _LOGGER.debug("Setting Home mode")
            await self._coordinator.hub.write_register(
                address=REGISTER_HOME_AWAY,
                value=1,
                verify=True,
            )
            await self._coordinator.async_refresh()

        async def async_turn_off(self, *_kwargs: Any) -> None:
            """Turn off the switch (set to Away mode)."""
            power_value = self._coordinator.get_register(REGISTER_POWER)
            if power_value != 1:
                _LOGGER.warning("Cannot set Away mode: power is OFF")
                return
            _LOGGER.debug("Setting Away mode")
            await self._coordinator.hub.write_register(
                address=REGISTER_HOME_AWAY,
                value=0,
                verify=True,
            )
            await self._coordinator.async_refresh()

        @property
        def device_info(self) -> dict[str, Any]:
            """Return device info."""
            return {
                "identifiers": {(DOMAIN, self._entry_id)},
                "name": "AC Modbus Device",
                "manufacturer": "Unknown",
                "model": "Modbus AC",
            }

    class HAHumidifySwitchEntity(SwitchEntity):
        """Home Assistant Switch entity for Humidify control.

        This switch controls register 1168 and requires power to be ON.
        """

        def __init__(
            self,
            coordinator: ACModbusCoordinator,
            entry_id: str,
        ) -> None:
            """Initialize the switch entity.

            Args:
                coordinator: The data coordinator.
                entry_id: Config entry ID for unique identification.
            """
            self._coordinator = coordinator
            self._entry_id = entry_id
            self._attr_name = "Humidify"
            self._attr_unique_id = f"{entry_id}_humidify_switch"
            self._attr_has_entity_name = True
            self._attr_icon = "mdi:water"

        @property
        def available(self) -> bool:
            """Return True if entity is available.

            This switch is only available when power is ON.
            """
            if not self._coordinator.available:
                return False
            power_value = self._coordinator.get_register(REGISTER_POWER)
            return power_value == 1

        @property
        def is_on(self) -> bool | None:
            """Return True if the switch is on (Humidify enabled)."""
            if not self._coordinator.available:
                return None
            value = self._coordinator.get_register(REGISTER_HUMIDIFY)
            if value is None:
                return None
            return value == 1

        async def async_turn_on(self, *_kwargs: Any) -> None:
            """Turn on the humidifier."""
            power_value = self._coordinator.get_register(REGISTER_POWER)
            if power_value != 1:
                _LOGGER.warning("Cannot turn on humidifier: power is OFF")
                return
            _LOGGER.debug("Turning on humidifier")
            await self._coordinator.hub.write_register(
                address=REGISTER_HUMIDIFY,
                value=1,
                verify=True,
            )
            await self._coordinator.async_refresh()

        async def async_turn_off(self, *_kwargs: Any) -> None:
            """Turn off the humidifier."""
            power_value = self._coordinator.get_register(REGISTER_POWER)
            if power_value != 1:
                _LOGGER.warning("Cannot turn off humidifier: power is OFF")
                return
            _LOGGER.debug("Turning off humidifier")
            await self._coordinator.hub.write_register(
                address=REGISTER_HUMIDIFY,
                value=0,
                verify=True,
            )
            await self._coordinator.async_refresh()

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
        """Set up the switch platform.

        Args:
            hass: Home Assistant instance.
            entry: Config entry.
            async_add_entities: Callback to add entities.
        """
        coordinator = hass.data[DOMAIN][entry.entry_id].get("coordinator")
        if coordinator is None:
            _LOGGER.error("Coordinator not found for entry %s", entry.entry_id)
            return

        async_add_entities([
            HAPowerSwitchEntity(coordinator, entry.entry_id),
            HAHomeAwaySwitchEntity(coordinator, entry.entry_id),
            HAHumidifySwitchEntity(coordinator, entry.entry_id),
        ])
