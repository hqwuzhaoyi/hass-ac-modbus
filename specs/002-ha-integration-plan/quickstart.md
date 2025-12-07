# Quickstart

## Prerequisites
- Home Assistant 2024.12+ (Core/Supervised/Container) with Python 3.12.
- Devcontainer or local HA core development environment.
- `pymodbus` available via HA dependency resolution (declared in manifest).
- Modbus TCP endpoint reachable (host/port/unit_id known).

## Setup
1. Create `custom_components/ac_modbus/` with HA boilerplate: `__init__.py`, `manifest.json`, `config_flow.py`, `const.py`, `hub.py`, `coordinator.py`, `switch.py`, `select.py` (or `climate.py`), `services.yaml`, `diagnostics.py`, `translations/`.
2. In `manifest.json`, declare dependencies: `pymodbus` and `homeassistant>=2024.12.0`, and set `config_flow: true`.
3. Implement `hub.py` using async `pymodbus` client with reconnect/backoff; expose `read_register`, `write_register`, `verify_register`.
4. Implement `coordinator.py` polling registers 1033/1041 every 10s (min 5s) and caching results; propagate availability on failures.
5. Entities:
   - Switch entity maps 1033 (0/1) with write + readback.
   - Select/Climate maps 1041 using configurable `mode_map` (default `{0: auto, 1: cool, 2: dry, 3: fan_only, 4: heat}`).
6. Services:
   - `ac_modbus.write_register` (register, value, unit_id?, verify?, expected?, timeout?).
   - `ac_modbus.scan_range` (start, end, step?, unit_id?, timeout?) emitting `ac_modbus_scan_result`.
7. Diagnostics: expose connection status, last error/time, last success time, poll interval, host/port/unit_id, recent reads (1033/1041), last write result.

## Testing
1. Install dev requirements: `pip install pytest pytest-homeassistant-custom-component`.
2. Add HA integration tests covering:
   - Config flow happy/invalid paths.
   - Poll/readback for 1033/1041 via coordinator cache.
   - Service calls for `write_register` (success + mismatch) and `scan_range`.
   - Diagnostics data availability and entity availability on failures.
3. Run tests: `pytest -q` from repo root (ensure HA test env variables are set).

## Manual Verification
1. Drop the integration into HA `custom_components` and restart HA.
2. Add config entry via UI or YAML with host/port/unit_id, poll_interval (≥5s), mode_map (optional).
3. Confirm entities: `switch.ac_modbus_power` and mode select/climate entity appear and update every 10s.
4. Trigger services from Developer Tools → Services:
   - Write: register=1033 value=1 verify=true → observe state flips to `on`.
   - Scan: start=1000 end=1020 → observe `ac_modbus_scan_result` event in logs/events.
5. Disconnect device or force timeout to confirm entities mark unavailable and diagnostics show last error.

## Milestones Reference
- M1: Skeleton, config flow, hub/coordinator stubs, entities visible.
- M2: Functional poll/readback for 1033/1041, availability handling.
- M3: Services + diagnostics documented and working.
- M4: Hardening (backoff/jitter), localization, extension hooks (additional registers, HACS prep).
