"""Button entities for AC Modbus integration."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from .const import DOMAIN

if TYPE_CHECKING:
    from .coordinator import FilterDataManager

_LOGGER = logging.getLogger(__name__)

# Check if homeassistant is available
try:
    from homeassistant.components.button import ButtonEntity
    from homeassistant.config_entries import ConfigEntry
    from homeassistant.core import HomeAssistant
    from homeassistant.helpers.entity_platform import AddEntitiesCallback

    HAS_HOMEASSISTANT = True
except ImportError:
    HAS_HOMEASSISTANT = False
    ButtonEntity = object  # type: ignore[misc, assignment]


# HA-specific entity (only available when homeassistant is installed)
if HAS_HOMEASSISTANT:

    class FilterResetButton(ButtonEntity):
        """Button entity to reset filter replacement date.

        When pressed, resets the last replacement date to now,
        starting a new 90-day countdown.
        """

        _attr_has_entity_name = True
        _attr_translation_key = "filter_reset"
        _attr_icon = "mdi:air-filter"

        def __init__(
            self,
            filter_manager: FilterDataManager,
            entry_id: str,
        ) -> None:
            """Initialize the button entity.

            Args:
                filter_manager: The filter data manager.
                entry_id: Config entry ID for unique identification.
            """
            self._filter_manager = filter_manager
            self._entry_id = entry_id
            self._attr_unique_id = f"{entry_id}_filter_reset"

        async def async_press(self) -> None:
            """Handle button press."""
            _LOGGER.info("Filter reset button pressed")
            await self._filter_manager.async_reset()

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
        """Set up the button platform.

        Args:
            hass: Home Assistant instance.
            entry: Config entry.
            async_add_entities: Callback to add entities.
        """
        entry_data = hass.data[DOMAIN][entry.entry_id]

        filter_manager = entry_data.get("filter_manager")
        if filter_manager is None:
            _LOGGER.error("Filter manager not found for entry %s", entry.entry_id)
            return

        async_add_entities([FilterResetButton(filter_manager, entry.entry_id)])
