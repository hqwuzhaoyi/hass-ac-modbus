# Research Findings

- Decision: Use Home Assistant integration test harness (pytest + `pytest-homeassistant-custom-component`) for automated checks and HA devcontainer/standalone Core for smoke tests.  
  Rationale: Mirrors production HA event loop and config entries; catches async pitfalls and service schemas early while keeping a fast local loop.  
  Alternatives considered: Manual HA UI-only validation (slower, lower coverage); custom mocks (misses HA lifecycle and service schema validation).

- Decision: Target Home Assistant 2024.12+ on Python 3.12 for the integration guidance.  
  Rationale: Matches current HA base image/tooling and avoids legacy Python 3.10/3.11 constraints; keeps compatibility with modern `pymodbus` async client.  
  Alternatives considered: Pin to older HA cores (adds deprecation churn); float with "latest" (risks undocumented breaking changes).

- Decision: Poll 1033/1041 via `DataUpdateCoordinator` every 10s by default with a documented minimum of 5s and jitter/backoff on failures.  
  Rationale: Modbus devices are sensitive to tight polling; 5–10s balances freshness with bus load and HA event loop utilization.  
  Alternatives considered: 1–2s aggressive polling (risks saturation/timeouts); >30s (laggy state, poor UX).

- Decision: All writes perform immediate readback; on mismatch or exception, mark entities unavailable and surface diagnostics.  
  Rationale: Ensures HA state matches device, avoids stale UI after Modbus errors, and centralizes error handling in the hub/coordinator.  
  Alternatives considered: Fire-and-forget writes (risks divergence); optimistic writes (needs manual resync logic).

- Decision: Provide a configurable `mode_map` with a sensible default `{0: "auto", 1: "cool", 2: "dry", 3: "fan_only", 4: "heat"}` and allow overrides per device.  
  Rationale: Field devices vary in mode encoding; a default map unblocks PoC while allowing config overrides without code edits.  
  Alternatives considered: Hard-coded single map (fails on device variance); free-form string parsing (invites invalid states).

- Decision: Expose services contract as HTTP-like semantics in docs: `ac_modbus.write_register` and `ac_modbus.scan_range`, returning success/readback payloads; emit `ac_modbus_scan_result` event for scan outputs.  
  Rationale: Clear request/response semantics make it testable and allow future API gateway reuse; events suit bulk scan output.  
  Alternatives considered: Logger-only scan results (hard to consume programmatically); per-register entities (overhead for large ranges).

- Decision: Diagnostics page must include connection status, last error, last successful read timestamps, poll interval, configured host/port/unit_id, and recent write/readback results.  
  Rationale: These fields are sufficient for operators to triage connectivity/state drift without attaching debuggers.  
  Alternatives considered: Minimal diagnostics (insufficient for ops); verbose raw packet dumps (too heavy for HA UI).
