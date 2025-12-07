"""DataUpdateCoordinator for AC Modbus integration."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import TYPE_CHECKING, Any

from .const import (
    DEFAULT_POLL_INTERVAL,
    REGISTER_MODE,
    REGISTER_POWER,
)

if TYPE_CHECKING:
    from .hub import ModbusHub

_LOGGER = logging.getLogger(__name__)

# Check if homeassistant is available
try:
    from homeassistant.core import HomeAssistant
    from homeassistant.helpers.update_coordinator import (
        DataUpdateCoordinator,
        UpdateFailed,
    )

    HAS_HOMEASSISTANT = True
except ImportError:
    HAS_HOMEASSISTANT = False
    # Minimal stub for testing without HA
    UpdateFailed = Exception  # type: ignore[misc, assignment]


class ACModbusCoordinator:
    """Coordinator for managing AC Modbus data updates.

    This coordinator handles periodic polling of Modbus registers
    and caches the results for entity consumption.
    """

    def __init__(
        self,
        hub: ModbusHub,
        poll_interval: int = DEFAULT_POLL_INTERVAL,
        hass: Any = None,
    ) -> None:
        """Initialize the coordinator.

        Args:
            hub: ModbusHub instance for communication.
            poll_interval: Polling interval in seconds.
            hass: Home Assistant instance (optional).
        """
        self._hub = hub
        self._poll_interval = poll_interval
        self._hass = hass

        # Data cache
        self._data: dict[int, int] = {}

        # State tracking
        self._available = True
        self._last_update_time: datetime | None = None
        self._consecutive_errors = 0

        # Registers to poll
        self._registers = [REGISTER_POWER, REGISTER_MODE]

    @property
    def hub(self) -> ModbusHub:
        """Return the hub."""
        return self._hub

    @property
    def poll_interval(self) -> int:
        """Return the poll interval."""
        return self._poll_interval

    @property
    def data(self) -> dict[int, int]:
        """Return the cached data."""
        return self._data

    @property
    def available(self) -> bool:
        """Return True if data is available."""
        return self._available

    @property
    def last_update_time(self) -> datetime | None:
        """Return the last update time."""
        return self._last_update_time

    @property
    def consecutive_errors(self) -> int:
        """Return the count of consecutive errors."""
        return self._consecutive_errors

    async def async_refresh(self) -> None:
        """Refresh data from the Modbus device.

        This method gracefully handles errors by marking the coordinator
        as unavailable rather than raising exceptions.
        """
        try:
            await self._async_update_data()
            self._available = True
            self._consecutive_errors = 0
            self._last_update_time = datetime.now()
            _LOGGER.debug("Coordinator refresh successful")
        except Exception as ex:
            self._available = False
            self._consecutive_errors += 1
            _LOGGER.error(
                "Coordinator refresh failed (consecutive errors: %d): %s",
                self._consecutive_errors,
                ex,
            )
            # Don't re-raise - mark as unavailable instead for graceful degradation

    async def _async_update_data(self) -> dict[int, int]:
        """Fetch data from the Modbus device.

        Returns:
            Dictionary of register address to value.

        Raises:
            Exception: If any read operation fails.
        """
        if not self._hub.is_connected:
            raise Exception("Hub not connected")

        new_data: dict[int, int] = {}

        for register in self._registers:
            try:
                value = await self._hub.read_register(register)
                new_data[register] = value
                _LOGGER.debug("Read register %d: %d", register, value)
            except Exception as ex:
                _LOGGER.error("Failed to read register %d: %s", register, ex)
                raise

        self._data = new_data
        return new_data

    def get_register(self, address: int) -> int | None:
        """Get a cached register value.

        Args:
            address: Register address to retrieve.

        Returns:
            Register value or None if not cached.
        """
        return self._data.get(address)

    def add_register(self, address: int) -> None:
        """Add a register to the polling list.

        Args:
            address: Register address to add.
        """
        if address not in self._registers:
            self._registers.append(address)
            _LOGGER.debug("Added register %d to polling list", address)

    def remove_register(self, address: int) -> None:
        """Remove a register from the polling list.

        Args:
            address: Register address to remove.
        """
        if address in self._registers:
            self._registers.remove(address)
            if address in self._data:
                del self._data[address]
            _LOGGER.debug("Removed register %d from polling list", address)


# HA-specific coordinator (only available when homeassistant is installed)
if HAS_HOMEASSISTANT:

    class HAACModbusCoordinator(DataUpdateCoordinator[dict[int, int]]):
        """Home Assistant DataUpdateCoordinator for AC Modbus.

        This integrates with HA's update coordinator pattern for
        automatic polling and entity updates.
        """

        def __init__(
            self,
            hass: HomeAssistant,
            hub: ModbusHub,
            poll_interval: int = DEFAULT_POLL_INTERVAL,
        ) -> None:
            """Initialize the HA coordinator.

            Args:
                hass: Home Assistant instance.
                hub: ModbusHub instance for communication.
                poll_interval: Polling interval in seconds.
            """
            from datetime import timedelta

            super().__init__(
                hass,
                _LOGGER,
                name="AC Modbus",
                update_interval=timedelta(seconds=poll_interval),
            )
            self._hub = hub
            self._registers = [REGISTER_POWER, REGISTER_MODE]

        @property
        def hub(self) -> ModbusHub:
            """Return the hub."""
            return self._hub

        @property
        def available(self) -> bool:
            """Return True if coordinator has valid data."""
            return self.last_update_success and self.data is not None

        async def _async_update_data(self) -> dict[int, int]:
            """Fetch data from the Modbus device.

            Returns:
                Dictionary of register address to value.

            Raises:
                UpdateFailed: If any read operation fails.
            """
            if not self._hub.is_connected:
                raise UpdateFailed("Hub not connected")

            data: dict[int, int] = {}

            for register in self._registers:
                try:
                    value = await self._hub.read_register(register)
                    data[register] = value
                except Exception as ex:
                    raise UpdateFailed(f"Failed to read register {register}: {ex}")

            return data

        def get_register(self, address: int) -> int | None:
            """Get a cached register value.

            Args:
                address: Register address to retrieve.

            Returns:
                Register value or None if not cached.
            """
            if self.data is None:
                return None
            return self.data.get(address)
