# Implementation Plan: Home Assistant 自定义集成文档落地

**Branch**: `[002-ha-integration-plan]` | **Date**: 2025-12-07 | **Spec**: specs/002-ha-integration-plan/spec.md  
**Input**: Feature specification from `/specs/002-ha-integration-plan/spec.md`

## Summary

Deliver a Chinese implementation guide for a pure Home Assistant custom integration `ac_modbus` (no Node dependency) that lands 1033 power switch and 1041 mode register first, defines services (`ac_modbus.write_register`, `ac_modbus.scan_range`), reconnection/polling/readback rules, milestones (M1–M4), and extension notes (extra registers, HACS).

## Technical Context

**Language/Version**: Python 3.12 (Home Assistant target)  
**Primary Dependencies**: Home Assistant custom integration framework, `pymodbus` async client, `DataUpdateCoordinator` pattern  
**Storage**: N/A (config entries + runtime cache only)  
**Testing**: Pytest with Home Assistant core integration harness; HA devcontainer/manual HA Core for smoke checks (clarified in research)  
**Target Platform**: Home Assistant Core/Supervised/Container on Linux (x86/ARM)  
**Project Type**: Home Assistant custom integration (backend)  
**Performance Goals**: Reliable polling/readback; default 10s poll, avoid bus saturation; writes complete with readback <5s  
**Constraints**: Async-first I/O; reconnect/backoff on Modbus errors; min poll interval 5s to avoid flooding; mark entities unavailable on failures  
**Scale/Scope**: Single-site HVAC over Modbus (1–5 units), small footprint integration

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Constitution now populated (simplicity & documentation-first, traceability, async safety, observability, testability/acceptance gates). Gate status: **PASS** for this plan/tasks set.
- Ongoing requirement: keep `.specify/memory/constitution.md` aligned and re-evaluate on material changes.

## Project Structure

### Documentation (this feature)

```text
specs/002-ha-integration-plan/
├── plan.md          # Implementation plan
├── spec.md          # Feature specification
├── research.md      # Phase 0 research outputs
├── data-model.md    # Phase 1 entity model
├── quickstart.md    # Phase 1 setup/usage guide
└── contracts/       # Phase 1 API/service contracts
```

### Source Code (repository root)

```text
docs/
└── ha-custom-integration-plan.md      # Deliverable document for developers/testers

custom_components/ac_modbus/           # To be created by implementers per plan
└── ... (init, manifest, config_flow, hub, coordinator, entities, services, diagnostics)

.specify/scripts/bash/                 # Automation scripts (setup-plan, update-agent-context)
```

**Structure Decision**: Documentation-led deliverable anchored in `docs/ha-custom-integration-plan.md` with feature artifacts in `specs/002-ha-integration-plan/`; future implementation will live under `custom_components/ac_modbus/` following HA conventions.

## Complexity Tracking

None; no additional complexity beyond baseline HA custom integration patterns.
