"""Select entity for AC Modbus integration."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from .const import DEFAULT_MODE_MAP, DOMAIN, REGISTER_MODE

if TYPE_CHECKING:
    from .coordinator import ACModbusCoordinator

_LOGGER = logging.getLogger(__name__)

# Check if homeassistant is available
try:
    from homeassistant.components.select import SelectEntity
    from homeassistant.config_entries import ConfigEntry
    from homeassistant.core import HomeAssistant
    from homeassistant.helpers.entity_platform import AddEntitiesCallback

    HAS_HOMEASSISTANT = True
except ImportError:
    HAS_HOMEASSISTANT = False
    SelectEntity = object  # type: ignore[misc, assignment]


class ACModbusModeSelect:
    """Select entity for AC mode control (register 1041)."""

    def __init__(
        self,
        coordinator: ACModbusCoordinator,
        entry_id: str,
        mode_map: dict[int, str] | None = None,
    ) -> None:
        """Initialize the select entity.

        Args:
            coordinator: The data coordinator.
            entry_id: Config entry ID for unique identification.
            mode_map: Optional custom mode mapping (register value -> mode name).
        """
        self._coordinator = coordinator
        self._entry_id = entry_id
        self._mode_map = mode_map if mode_map is not None else DEFAULT_MODE_MAP
        self._reverse_map = {v: k for k, v in self._mode_map.items()}

        self._attr_name = "AC Mode"
        self._attr_unique_id = f"{entry_id}_mode_select"

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
    def mode_map(self) -> dict[int, str]:
        """Return the mode map."""
        return self._mode_map

    @property
    def options(self) -> list[str]:
        """Return the list of available options."""
        return list(self._mode_map.values())

    @property
    def available(self) -> bool:
        """Return True if entity is available."""
        return self._coordinator.available

    @property
    def current_option(self) -> str | None:
        """Return the current selected option."""
        if not self.available:
            return None

        value = self._coordinator.get_register(REGISTER_MODE)
        if value is None:
            return None

        return self._mode_map.get(value)

    async def async_select_option(self, option: str) -> None:
        """Change the selected option.

        Args:
            option: The option to select.

        Raises:
            ValueError: If the option is not valid.
        """
        if option not in self._reverse_map:
            raise ValueError(f"Option '{option}' is not valid. Valid options: {self.options}")

        register_value = self._reverse_map[option]
        _LOGGER.debug("Setting AC mode to '%s' (register value: %d)", option, register_value)

        await self._coordinator.hub.write_register(
            address=REGISTER_MODE,
            value=register_value,
            verify=True,
        )

        # Update coordinator data
        self._coordinator._data[REGISTER_MODE] = register_value


# HA-specific entity (only available when homeassistant is installed)
if HAS_HOMEASSISTANT:

    class HAModeSelectEntity(SelectEntity):
        """Home Assistant Select entity for AC mode control."""

        def __init__(
            self,
            coordinator: ACModbusCoordinator,
            entry_id: str,
            mode_map: dict[int, str] | None = None,
        ) -> None:
            """Initialize the select entity.

            Args:
                coordinator: The data coordinator.
                entry_id: Config entry ID for unique identification.
                mode_map: Optional custom mode mapping.
            """
            self._coordinator = coordinator
            self._entry_id = entry_id
            self._mode_map = mode_map if mode_map is not None else DEFAULT_MODE_MAP
            self._reverse_map = {v: k for k, v in self._mode_map.items()}

            self._attr_name = "AC Mode"
            self._attr_unique_id = f"{entry_id}_mode_select"
            self._attr_has_entity_name = True
            self._attr_options = list(self._mode_map.values())

        @property
        def available(self) -> bool:
            """Return True if entity is available."""
            return self._coordinator.available

        @property
        def current_option(self) -> str | None:
            """Return the current selected option."""
            if not self.available:
                return None

            value = self._coordinator.get_register(REGISTER_MODE)
            if value is None:
                return None

            return self._mode_map.get(value)

        async def async_select_option(self, option: str) -> None:
            """Change the selected option."""
            if option not in self._reverse_map:
                raise ValueError(f"Option '{option}' is not valid")

            register_value = self._reverse_map[option]
            _LOGGER.debug("Setting AC mode to '%s' (register value: %d)", option, register_value)

            await self._coordinator.hub.write_register(
                address=REGISTER_MODE,
                value=register_value,
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

    async def async_setup_entry(
        hass: HomeAssistant,
        entry: ConfigEntry,
        async_add_entities: AddEntitiesCallback,
    ) -> None:
        """Set up the select platform.

        Args:
            hass: Home Assistant instance.
            entry: Config entry.
            async_add_entities: Callback to add entities.
        """
        from .const import CONF_MODE_MAP

        coordinator = hass.data[DOMAIN][entry.entry_id].get("coordinator")
        if coordinator is None:
            _LOGGER.error("Coordinator not found for entry %s", entry.entry_id)
            return

        # Get custom mode map from config if present
        mode_map = entry.data.get(CONF_MODE_MAP)

        async_add_entities([HAModeSelectEntity(coordinator, entry.entry_id, mode_map)])
