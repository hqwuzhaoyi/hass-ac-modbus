# AC Modbus - Home Assistant Custom Integration

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://github.com/hacs/integration)
[![GitHub Release](https://img.shields.io/github/v/release/hqwuzhaoyi/hass-ac-modbus)](https://github.com/hqwuzhaoyi/hass-ac-modbus/releases)
[![License](https://img.shields.io/github/license/hqwuzhaoyi/hass-ac-modbus)](LICENSE)

English | [简体中文](README.zh-CN.md)

Home Assistant custom integration for controlling air conditioners via Modbus TCP protocol.

## Features

- Control AC power on/off via Modbus register
- Select AC operating mode (Cool, Heat, Fan Only, Dry)
- Automatic polling with configurable interval
- Diagnostic tools for debugging
- Custom services for advanced Modbus operations
- Multi-language support (English, Chinese)

## Supported Registers

| Register | Function | Values | Constraint |
|----------|----------|--------|------------|
| 1033 | Power | 0=Off, 1=On | - |
| 1034 | Home/Away | 0=Away, 1=Home | Power must be ON |
| 1041 | Mode | 1=Cool, 2=Heat, 3=Fan Only, 4=Dry | Power must be OFF |
| 1168 | Humidify | 0=Off, 1=On | Power must be ON |

## Installation

### HACS Installation (Recommended)

1. Make sure [HACS](https://hacs.xyz/) is installed in your Home Assistant instance

2. Add this repository as a custom repository in HACS:
   - Open HACS in Home Assistant
   - Click on the three dots in the top right corner
   - Select **Custom repositories**
   - Add the repository URL: `https://github.com/hqwuzhaoyi/hass-ac-modbus`
   - Select **Integration** as the category
   - Click **Add**

3. Search for "AC Modbus" in HACS and install it

4. Restart Home Assistant

5. Go to **Settings** > **Devices & Services** > **Add Integration** and search for "AC Modbus"

### Manual Installation

1. Download the latest release from the [releases page](https://github.com/hqwuzhaoyi/hass-ac-modbus/releases)

2. Extract and copy the `custom_components/ac_modbus` folder to your Home Assistant's `custom_components` directory:
   ```
   <config>/custom_components/ac_modbus/
   ```

3. Restart Home Assistant

4. Go to **Settings** > **Devices & Services** > **Add Integration** and search for "AC Modbus"

## Configuration

### Through UI (Config Flow)

1. Go to **Settings** > **Devices & Services**
2. Click **Add Integration**
3. Search for "AC Modbus"
4. Enter the configuration:
   - **Host**: IP address of your Modbus device (e.g., `192.168.1.100`)
   - **Port**: Modbus TCP port (default: `502`)
   - **Unit ID**: Modbus slave unit ID (default: `1`)
   - **Poll Interval**: Data refresh interval in seconds (default: `10`, minimum: `5`)

## Entities Created

After successful configuration, the following entities will be created:

| Entity | Type | Description | Constraint |
|--------|------|-------------|------------|
| `switch.ac_modbus_power` | Switch | Control AC power on/off | - |
| `switch.ac_modbus_home_mode` | Switch | Control Home/Away mode | Power must be ON |
| `switch.ac_modbus_humidify` | Switch | Control humidifier | Power must be ON |
| `select.ac_modbus_mode` | Select | Select AC operating mode | Power must be OFF |

## Services

### `ac_modbus.write_register`

Write a value to a specific Modbus register.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `register` | int | Yes | Register address |
| `value` | int | Yes | Value to write |

Example:
```yaml
service: ac_modbus.write_register
data:
  register: 1033
  value: 1
```

### `ac_modbus.scan_range`

Scan a range of Modbus registers for debugging.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `start` | int | Yes | Start register address |
| `end` | int | Yes | End register address |
| `step` | int | No | Step size (default: 1) |

Example:
```yaml
service: ac_modbus.scan_range
data:
  start: 1030
  end: 1050
  step: 1
```

## Diagnostics

The integration provides diagnostic information accessible through Home Assistant's diagnostics feature:
- Connection status
- Register values
- Configuration details
- Error counts

## Troubleshooting

### Connection Issues

1. Verify the Modbus device is reachable:
   ```bash
   ping <device_ip>
   ```

2. Check if port 502 is accessible:
   ```bash
   nc -zv <device_ip> 502
   ```

3. Ensure no other application is connected to the Modbus device (many devices only support single connections)

### Mode Not Updating

If the mode selector doesn't show the correct value:
1. Go to **Settings** > **Devices & Services**
2. Find the AC Modbus integration
3. Click the three dots and select **Reload**

### Enable Debug Logging

Add the following to your `configuration.yaml`:
```yaml
logger:
  default: warning
  logs:
    custom_components.ac_modbus: debug
```

## Requirements

- Home Assistant 2024.12.0 or newer
- Python package: `pymodbus>=3.6.0` (automatically installed)

## Development

### Running Tests

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements_test.txt

# Run tests
pytest
```

### Project Structure

```
custom_components/ac_modbus/
├── __init__.py          # Integration setup
├── config_flow.py       # UI configuration flow
├── const.py             # Constants and default values
├── coordinator.py       # Data update coordinator
├── diagnostics.py       # Diagnostic data provider
├── hub.py               # Modbus communication hub
├── manifest.json        # Integration manifest
├── select.py            # Mode select entity
├── services.py          # Custom services
├── services.yaml        # Service definitions
├── switch.py            # Power switch entity
└── translations/        # Localization files
    ├── en.json
    └── zh-Hans.json
```

---

# Web Control Panel (Optional)

This repository also includes a Next.js web application for direct Modbus control and debugging.

## Web Features

- Real-time WebSocket connection for monitoring
- Manual register read/write interface
- Control panels for:
  - Power on/off (1033)
  - Mode selection (1041) - requires power OFF
  - Home/Away mode (1034) - requires power ON
  - Humidify switch (1168) - requires power ON
- Smart constraint validation (disables controls based on power state)

## Quick Start (Web Panel)

```bash
# Install dependencies
npm install

# Start WebSocket server (manual read/write for 1033/1041)
npm run ws:dev

# Start Next.js frontend
npm run dev:web
```

Access the web interface at http://localhost:3002

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Home Assistant](https://www.home-assistant.io/) - The open source home automation platform
- [pymodbus](https://github.com/pymodbus-dev/pymodbus) - Modbus protocol implementation in Python
- [HACS](https://hacs.xyz/) - Home Assistant Community Store
