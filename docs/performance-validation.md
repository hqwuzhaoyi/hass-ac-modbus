# Performance Validation Guide

This document captures the checks performed to ensure the enhanced real-time register change detection feature meets the 1 s end-to-end latency budget while remaining memory safe.

## Automated Guardrails

1. **Jest Performance Test** – `__tests__/performance/change-latency.test.ts` asserts detection, dispatch, UI highlight and total latency budgets (250 ms / 150 ms / 600 ms / 1 s).
2. **Integration Buffers** – `__tests__/integration/buffer-playback.test.ts` simulates high-frequency changes with an intentionally tiny buffer to verify overflow alerts and dropped-event counters.
3. **Dependency Monitoring** – `__tests__/integration/dependency-monitoring.test.ts` validates that Modbus/WebSocket/MQTT/time-sync dependencies raise and resolve alerts without leaking history.

Run everything with:

```bash
npm test
```

## Manual Spot Checks

1. Launch a server mode (basic/enhanced/demo). Enable Chrome DevTools Performance panel and capture a session while triggering several register changes.
2. In the real-time panel, confirm the latency cards show realistic numbers and that `总延迟` stays ≤ 1000 ms.
3. Watch the server console: the instrumentation in `lib/modbus-client.ts` logs dependency transitions. Ensure no memory growth is observed when polling for 10+ minutes (check Node process RSS).
4. Optionally run `clinic doctor -- ts-node server.ts` or `node --inspect src` for extended profiling when tuning polling or buffer thresholds.

Document findings in the project log or issue tracker so the team can track regressions across hardware variants.
