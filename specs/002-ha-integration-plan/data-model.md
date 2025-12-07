# Data Model

## Entities & Fields

- **ConfigEntry (domain: `ac_modbus`)**
  - Fields: `host`, `port`, `unit_id`, `poll_interval`, `timeout`, `reconnect_backoff`, `mode_map`, `scan_start`, `scan_end`, `scan_step`
  - Rules: `poll_interval` ≥ 5s; `timeout` < `poll_interval`; `mode_map` must cover all emitted mode values; `scan_end - scan_start` ≤ 100 registers.

- **ModbusHub**
  - Fields: `client` (async pymodbus), `connected_at`, `last_error`, `backoff_state`, `lock`
  - Responsibilities: connect/reconnect, read/write helpers, readback verification, emit availability signals.

- **DataUpdateCoordinator (Status Coordinator)**
  - Fields: `poll_interval`, `last_read_at`, `cache` `{1033: value, 1041: value}`, `errors`
  - Responsibilities: periodic read of 1033/1041, cache results, propagate availability to entities.

- **PowerSwitchEntity (1033)**
  - State: `on`/`off`/`unavailable`
  - Derived from: coordinator cache; writes go through hub with readback.
  - Validation: write accepts only 0/1; marks unavailable on mismatch or Modbus error.

- **ModeSelectEntity or ClimateEntity (1041)**
  - State: one of `mode_map` values or `unavailable`
  - Derived from: coordinator cache mapped via `mode_map`.
  - Validation: only values present in `mode_map` are accepted; readback must match mapped code.

- **Service Requests**
  - `ac_modbus.write_register`: {`register` (int), `value` (int), `unit_id?`, `verify?`, `expected?`, `timeout?`}
  - `ac_modbus.scan_range`: {`start` (int), `end` (int), `unit_id?`, `step?`, `timeout?`}

- **Diagnostics Snapshot**
  - Fields: `connected` (bool), `last_error`, `last_error_at`, `last_success_at`, `poll_interval`, `host`, `port`, `unit_id`, `recent_reads` (1033/1041), `recent_write` (register/value/verified)

## Relationships

- ConfigEntry -> ModbusHub (one-to-one per entry)
- ModbusHub -> DataUpdateCoordinator (one-to-one)
- Coordinator -> Entities (one-to-many; entities subscribe to coordinator cache)
- Services -> ModbusHub (direct read/write) and emit events/diagnostics
- Diagnostics pulls from Hub + Coordinator state

## State Transitions

- **PowerSwitchEntity**
  - `off` → `on`: write 1 to 1033; if readback == 1 → `on`, else `unavailable`.
  - `on` → `off`: write 0 to 1033; if readback == 0 → `off`, else `unavailable`.
  - Any state → `unavailable`: Modbus error, connection lost, or readback mismatch.

- **ModeSelect/ClimateEntity**
  - `mode_a` → `mode_b`: write mapped code to 1041; on readback success update state; on mismatch/error → `unavailable`.
  - Any state → `unavailable`: connection loss or failed readback.

- **Coordinator**
  - `connected` → `degraded`: consecutive read failures trigger backoff; entities marked unavailable.
  - `degraded` → `healthy`: successful read resets backoff and availability.

- **Services**
  - Write success: returns `{verified: true, value, register, unit_id}`.
  - Write mismatch/error: returns `{verified: false, error}` and marks related entities unavailable.
  - Scan success: emits `ac_modbus_scan_result` event payload with registers/values; log info.
