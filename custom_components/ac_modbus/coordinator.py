"""DataUpdateCoordinator for AC Modbus integration."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import TYPE_CHECKING, Any

from .const import (
    DEFAULT_POLL_INTERVAL,
    FILTER_CYCLE_DAYS,
    FILTER_STORAGE_KEY,
    FILTER_STORAGE_VERSION,
    REGISTER_HOME_AWAY,
    REGISTER_HUMIDIFY,
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
        self._registers = [
            REGISTER_POWER,
            REGISTER_HOME_AWAY,
            REGISTER_MODE,
            REGISTER_HUMIDIFY,
        ]

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
            self._registers = [
                REGISTER_POWER,
                REGISTER_HOME_AWAY,
                REGISTER_MODE,
                REGISTER_HUMIDIFY,
            ]

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
                    raise UpdateFailed(
                        f"Failed to read register {register}: {ex}"
                    ) from ex

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


class FilterDataManager:
    """Manager for filter replacement data persistence and calculations.

    Handles storage of filter replacement dates and calculates
    days remaining until next replacement.
    """

    def __init__(self, hass: HomeAssistant) -> None:
        """Initialize the filter data manager.

        Args:
            hass: Home Assistant instance.
        """
        from homeassistant.helpers.storage import Store
        from homeassistant.util import dt as dt_util

        self._hass = hass
        self._store: Store = Store(
            hass, FILTER_STORAGE_VERSION, FILTER_STORAGE_KEY
        )
        self._last_replacement: datetime | None = None
        self._dt_util = dt_util
        self._listeners: list[Any] = []

    @property
    def last_replacement(self) -> datetime | None:
        """Return the last replacement datetime."""
        return self._last_replacement

    @property
    def next_replacement(self) -> datetime | None:
        """Return the next replacement datetime."""
        if self._last_replacement is None:
            return None
        from datetime import timedelta

        return self._last_replacement + timedelta(days=FILTER_CYCLE_DAYS)

    @property
    def days_remaining(self) -> int:
        """Calculate days remaining until next filter replacement.

        Returns:
            Positive if not due, negative if overdue, 0 if due today.
        """
        if self._last_replacement is None:
            return FILTER_CYCLE_DAYS

        next_date = self.next_replacement
        if next_date is None:
            return FILTER_CYCLE_DAYS

        now = self._dt_util.now()
        delta = next_date - now
        return delta.days

    async def async_load(self) -> None:
        """Load filter data from storage."""
        data = await self._store.async_load()

        if data is None:
            # First install - assume filter was just replaced
            _LOGGER.info("No filter data found, initializing with current date")
            self._last_replacement = self._dt_util.now()
            await self.async_save()
        else:
            try:
                last_replacement_str = data.get("last_replacement")
                if last_replacement_str:
                    self._last_replacement = datetime.fromisoformat(
                        last_replacement_str
                    )
                    _LOGGER.debug(
                        "Loaded filter last replacement: %s",
                        self._last_replacement,
                    )
                else:
                    self._last_replacement = self._dt_util.now()
                    await self.async_save()
            except (ValueError, TypeError) as ex:
                _LOGGER.warning(
                    "Invalid filter data, resetting to current date: %s", ex
                )
                self._last_replacement = self._dt_util.now()
                await self.async_save()

    async def async_save(self) -> None:
        """Save filter data to storage."""
        if self._last_replacement is None:
            return

        data = {"last_replacement": self._last_replacement.isoformat()}
        await self._store.async_save(data)
        _LOGGER.debug("Saved filter last replacement: %s", self._last_replacement)

    async def async_reset(self) -> None:
        """Reset filter replacement date to now."""
        self._last_replacement = self._dt_util.now()
        await self.async_save()
        _LOGGER.info("Filter replacement date reset to: %s", self._last_replacement)
        # Notify listeners
        for listener in self._listeners:
            listener()

    def add_listener(self, listener: Any) -> None:
        """Add a listener to be notified on data changes."""
        self._listeners.append(listener)

    def remove_listener(self, listener: Any) -> None:
        """Remove a listener."""
        if listener in self._listeners:
            self._listeners.remove(listener)
