"""The AC Modbus integration."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from .const import (
    CONF_POLL_INTERVAL,
    DEFAULT_POLL_INTERVAL,
    DOMAIN,
    PLATFORMS,
)

_LOGGER = logging.getLogger(__name__)

# Check if homeassistant is available
try:
    from homeassistant.config_entries import ConfigEntry
    from homeassistant.core import HomeAssistant

    HAS_HOMEASSISTANT = True
except ImportError:
    HAS_HOMEASSISTANT = False
    if TYPE_CHECKING:
        from homeassistant.config_entries import ConfigEntry
        from homeassistant.core import HomeAssistant


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up AC Modbus from a config entry.

    Args:
        hass: Home Assistant instance.
        entry: Config entry for this integration.

    Returns:
        True if setup was successful, False otherwise.
    """
    from .coordinator import FilterDataManager, HAACModbusCoordinator
    from .hub import ModbusHub

    _LOGGER.debug("Setting up AC Modbus integration for %s", entry.title)

    # Initialize domain data storage
    hass.data.setdefault(DOMAIN, {})

    # Get configuration
    poll_interval = entry.data.get(CONF_POLL_INTERVAL, DEFAULT_POLL_INTERVAL)

    # Create hub with config dict
    hub = ModbusHub(config=entry.data)

    # Connect to device
    try:
        connected = await hub.connect()
        if not connected:
            _LOGGER.error(
                "Failed to connect to Modbus device at %s:%s", hub.host, hub.port
            )
            return False
    except Exception as ex:
        _LOGGER.error("Error connecting to Modbus device: %s", ex)
        return False

    # Create coordinator
    coordinator = HAACModbusCoordinator(
        hass=hass,
        hub=hub,
        poll_interval=poll_interval,
    )

    # Fetch initial data
    await coordinator.async_config_entry_first_refresh()

    # Create filter data manager
    filter_manager = FilterDataManager(hass)
    await filter_manager.async_load()

    # Store entry data
    hass.data[DOMAIN][entry.entry_id] = {
        "entry": entry,
        "hub": hub,
        "coordinator": coordinator,
        "filter_manager": filter_manager,
    }

    # Forward entry setup to platforms (switch, select)
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    _LOGGER.info("AC Modbus integration setup complete for %s", entry.title)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry.

    Args:
        hass: Home Assistant instance.
        entry: Config entry to unload.

    Returns:
        True if unload was successful, False otherwise.
    """
    _LOGGER.debug("Unloading AC Modbus integration for %s", entry.title)

    # Unload platforms
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)

    if unload_ok:
        # Disconnect hub
        entry_data = hass.data[DOMAIN].get(entry.entry_id, {})
        hub = entry_data.get("hub")
        if hub:
            await hub.disconnect()

        # Clean up entry data
        if entry.entry_id in hass.data.get(DOMAIN, {}):
            hass.data[DOMAIN].pop(entry.entry_id)

        # Clean up domain if empty
        if DOMAIN in hass.data and not hass.data[DOMAIN]:
            hass.data.pop(DOMAIN)

    _LOGGER.info("AC Modbus integration unloaded for %s", entry.title)
    return unload_ok
