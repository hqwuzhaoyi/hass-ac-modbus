"""Modbus Hub for AC Modbus integration."""

from __future__ import annotations

import asyncio
import contextlib
import logging
from datetime import datetime
from typing import Any

from .const import (
    CONF_RECONNECT_BACKOFF,
    CONF_TIMEOUT,
    CONF_UNIT_ID,
    DEFAULT_PORT,
    DEFAULT_RECONNECT_BACKOFF,
    DEFAULT_TIMEOUT,
    DEFAULT_UNIT_ID,
)

_LOGGER = logging.getLogger(__name__)

# Check if homeassistant is available
try:
    from homeassistant.const import CONF_HOST, CONF_PORT

    HAS_HOMEASSISTANT = True
except ImportError:
    HAS_HOMEASSISTANT = False
    CONF_HOST = "host"
    CONF_PORT = "port"

# Check if pymodbus is available
try:
    from pymodbus.client import AsyncModbusTcpClient
    from pymodbus.exceptions import ConnectionException, ModbusException

    HAS_PYMODBUS = True
except ImportError:
    HAS_PYMODBUS = False
    AsyncModbusTcpClient = None  # type: ignore[misc, assignment]
    ModbusException = Exception  # type: ignore[misc, assignment]
    ConnectionException = Exception  # type: ignore[misc, assignment]


class ModbusHubError(Exception):
    """Base exception for ModbusHub errors."""


class ModbusReadError(ModbusHubError):
    """Exception raised when a Modbus read operation fails."""


class ModbusWriteError(ModbusHubError):
    """Exception raised when a Modbus write operation fails."""


class ModbusVerifyError(ModbusHubError):
    """Exception raised when readback verification fails."""


class ModbusHub:
    """Hub for managing Modbus connection and operations."""

    def __init__(self, config: dict[str, Any]) -> None:
        """Initialize the Modbus hub.

        Args:
            config: Configuration dictionary with host, port, etc.
        """
        self._host = config.get(CONF_HOST, "")
        self._port = config.get(CONF_PORT, DEFAULT_PORT)
        self._unit_id = config.get(CONF_UNIT_ID, DEFAULT_UNIT_ID)
        self._timeout = config.get(CONF_TIMEOUT, DEFAULT_TIMEOUT)
        self._reconnect_backoff = config.get(
            CONF_RECONNECT_BACKOFF, DEFAULT_RECONNECT_BACKOFF
        )

        self._client: Any = None
        self._lock = asyncio.Lock()

        # Connection state
        self._connected = False
        self._connected_at: datetime | None = None

        # Error tracking
        self._last_error: str | None = None
        self._last_error_time: datetime | None = None
        self._backoff_count = 0

        # Success tracking
        self._last_success_time: datetime | None = None

    @property
    def host(self) -> str:
        """Return the host."""
        return self._host

    @property
    def port(self) -> int:
        """Return the port."""
        return self._port

    @property
    def unit_id(self) -> int:
        """Return the unit ID."""
        return self._unit_id

    @property
    def is_connected(self) -> bool:
        """Return True if connected."""
        if self._client is None:
            return False
        # Use our own flag - pymodbus connected property may not be reliable
        return self._connected

    @property
    def last_error(self) -> str | None:
        """Return the last error message."""
        return self._last_error

    @property
    def last_error_time(self) -> datetime | None:
        """Return the timestamp of the last error."""
        return self._last_error_time

    @property
    def last_success_time(self) -> datetime | None:
        """Return the timestamp of the last successful operation."""
        return self._last_success_time

    @property
    def backoff_count(self) -> int:
        """Return the current backoff count."""
        return self._backoff_count

    async def connect(self) -> bool:
        """Connect to the Modbus device.

        Returns:
            True if connection successful, False otherwise.
        """
        if not HAS_PYMODBUS or AsyncModbusTcpClient is None:
            _LOGGER.error("pymodbus not available")
            return False

        try:
            async with self._lock:
                # Close existing client if any
                if self._client is not None:
                    with contextlib.suppress(Exception):
                        self._client.close()
                    self._client = None

                # Create client - use only basic parameters for compatibility
                self._client = AsyncModbusTcpClient(
                    host=self._host,
                    port=self._port,
                    timeout=self._timeout,
                )

                _LOGGER.debug(
                    "Connecting to Modbus device at %s:%s (unit_id=%s)",
                    self._host,
                    self._port,
                    self._unit_id,
                )

                # Connect with timeout
                connected = await asyncio.wait_for(
                    self._client.connect(),
                    timeout=self._timeout,
                )

                if not connected:
                    self._connected = False
                    self._backoff_count += 1
                    self._record_error("connect() returned False")
                    return False

                _LOGGER.info(
                    "Connected to Modbus device at %s:%s (unit_id=%s)",
                    self._host,
                    self._port,
                    self._unit_id,
                )

                # Test connection with a simple read
                try:
                    test_result = await asyncio.wait_for(
                        self._client.read_holding_registers(
                            1033, count=1, device_id=self._unit_id
                        ),
                        timeout=self._timeout,
                    )
                    if test_result.isError():
                        _LOGGER.warning("Test read returned error: %s", test_result)
                    else:
                        _LOGGER.debug("Test read successful: %s", test_result.registers)
                except Exception as ex:
                    _LOGGER.error("Test read failed: %s", ex)
                    self._connected = False
                    self._backoff_count += 1
                    self._record_error(f"Test read failed: {ex}")
                    return False

                self._connected = True
                self._connected_at = datetime.now()
                self._backoff_count = 0
                return True

        except TimeoutError:
            self._connected = False
            self._backoff_count += 1
            self._record_error("Connection timeout")
            _LOGGER.error("Connection to %s:%s timed out", self._host, self._port)
            return False
        except Exception as ex:
            self._connected = False
            self._backoff_count += 1
            self._record_error(str(ex))
            _LOGGER.error("Failed to connect to %s:%s: %s", self._host, self._port, ex)
            return False

    async def disconnect(self) -> None:
        """Disconnect from the Modbus device."""
        async with self._lock:
            if self._client is not None:
                with contextlib.suppress(Exception):
                    self._client.close()
                self._client = None
            self._connected = False
            _LOGGER.debug("Disconnected from Modbus device")

    async def reconnect(self) -> bool:
        """Attempt to reconnect to the Modbus device.

        Returns:
            True if reconnection successful, False otherwise.
        """
        _LOGGER.debug(
            "Attempting to reconnect (backoff count: %d)", self._backoff_count
        )

        # Apply backoff delay
        if self._backoff_count > 0:
            delay = min(
                self._reconnect_backoff * (2 ** (self._backoff_count - 1)),
                60,  # Max 60 second delay
            )
            _LOGGER.debug("Backoff delay: %d seconds", delay)
            await asyncio.sleep(delay)

        return await self.connect()

    async def _ensure_connected(self) -> bool:
        """Ensure connection is active, reconnect if needed.

        Returns:
            True if connected, False otherwise.
        """
        if self._client is None or not self._connected:
            return await self.connect()
        return True

    async def _call_modbus(self, method_name: str, address: int, **kwargs) -> Any:
        """Call a modbus method with proper slave/unit handling.

        Tries multiple API formats for compatibility with different pymodbus versions.

        Args:
            method_name: Name of the method to call (e.g., 'read_holding_registers')
            address: Register address
            **kwargs: Additional arguments (count, value, etc.)

        Returns:
            The result from the modbus call.
        """
        method = getattr(self._client, method_name)
        slave = kwargs.pop("slave", self._unit_id)

        # Try different API formats for pymodbus version compatibility
        attempts = [
            # Format 1: device_id (pymodbus 3.10+)
            lambda: method(address, device_id=slave, **kwargs),
            # Format 2: slave as keyword argument (pymodbus 3.5-3.9)
            lambda: method(address, slave=slave, **kwargs),
            # Format 3: unit as keyword argument (pymodbus 2.x)
            lambda: method(address, unit=slave, **kwargs),
            # Format 4: No slave/unit, rely on client default
            lambda: method(address, **kwargs),
        ]

        last_error = None
        for i, attempt in enumerate(attempts):
            try:
                result = await asyncio.wait_for(attempt(), timeout=self._timeout)
                return result
            except TypeError as ex:
                # Wrong API format, try next
                last_error = ex
                _LOGGER.debug("API format %d failed: %s", i + 1, ex)
                continue
            except Exception:
                # Other error, don't try more formats
                raise

        # All formats failed
        raise ModbusReadError(f"All API formats failed: {last_error}")

    async def read_register(
        self,
        address: int,
        count: int = 1,
        unit_id: int | None = None,
    ) -> int:
        """Read a holding register.

        Args:
            address: Register address to read.
            count: Number of registers to read (default 1).
            unit_id: Slave/unit ID (default uses configured value).

        Returns:
            Register value.

        Raises:
            asyncio.TimeoutError: If operation times out.
            ModbusReadError: If read operation fails.
        """
        # Ensure connected
        if not await self._ensure_connected():
            raise ModbusReadError("Not connected and reconnection failed")

        slave = unit_id if unit_id is not None else self._unit_id

        try:
            async with self._lock:
                result = await self._call_modbus(
                    "read_holding_registers",
                    address,
                    count=count,
                    slave=slave,
                )

                if result.isError():
                    error_msg = f"Read error at address {address}: {result}"
                    self._record_error(error_msg)
                    raise ModbusReadError(error_msg)

                self._last_success_time = datetime.now()
                _LOGGER.debug("Read register %d = %d", address, result.registers[0])
                return result.registers[0]

        except TimeoutError:
            self._record_error(f"Read timeout at address {address}")
            self._connected = False
            raise
        except ConnectionException as ex:
            self._connected = False
            self._record_error(f"Connection lost: {ex}")
            raise ModbusReadError(f"Connection lost: {ex}") from ex
        except ModbusReadError:
            # Error already recorded, just re-raise
            raise
        except Exception as ex:
            self._record_error(str(ex))
            raise ModbusReadError(f"Read failed: {ex}") from ex

    async def write_register(
        self,
        address: int,
        value: int,
        unit_id: int | None = None,
        verify: bool = False,
        expected: int | None = None,
    ) -> bool:
        """Write a holding register.

        Args:
            address: Register address to write.
            value: Value to write.
            unit_id: Slave/unit ID (default uses configured value).
            verify: If True, read back and verify the written value.
            expected: Expected readback value (defaults to written value).

        Returns:
            True if write (and optional verify) successful.

        Raises:
            asyncio.TimeoutError: If operation times out.
            ModbusWriteError: If write operation fails.
            ValueError: If verification fails (readback mismatch).
        """
        # Ensure connected
        if not await self._ensure_connected():
            raise ModbusWriteError("Not connected and reconnection failed")

        slave = unit_id if unit_id is not None else self._unit_id

        try:
            async with self._lock:
                result = await self._call_modbus(
                    "write_register",
                    address,
                    value=value,
                    slave=slave,
                )

                if result.isError():
                    error_msg = f"Write error at address {address}: {result}"
                    self._record_error(error_msg)
                    raise ModbusWriteError(error_msg)

                self._last_success_time = datetime.now()
                _LOGGER.debug("Wrote register %d = %d", address, value)

        except TimeoutError:
            self._record_error(f"Write timeout at address {address}")
            self._connected = False
            raise
        except ConnectionException as ex:
            self._connected = False
            self._record_error(f"Connection lost: {ex}")
            raise ModbusWriteError(f"Connection lost: {ex}") from ex
        except ModbusWriteError:
            # Error already recorded, just re-raise
            raise
        except Exception as ex:
            self._record_error(str(ex))
            raise ModbusWriteError(f"Write failed: {ex}") from ex

        # Verify if requested
        if verify:
            expected_value = expected if expected is not None else value
            readback = await self.read_register(address, unit_id=unit_id)

            if readback != expected_value:
                error_msg = (
                    f"Verification mismatch at address {address}: "
                    f"wrote {value}, expected {expected_value}, got {readback}"
                )
                self._record_error(error_msg)
                raise ValueError(error_msg)

        return True

    def _record_error(self, error: str) -> None:
        """Record an error with timestamp.

        Args:
            error: Error message to record.
        """
        self._last_error = error
        self._last_error_time = datetime.now()
        _LOGGER.warning("Modbus error: %s", error)
