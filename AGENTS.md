# hass-ac-modbus Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-12-07

## Active Technologies

- Python 3.12 (Home Assistant target) + Home Assistant custom integration framework, `pymodbus` async client, `DataUpdateCoordinator` pattern (002-ha-integration-plan)

## Project Structure

```text
docs/
├── ha-custom-integration-plan.md

specs/002-ha-integration-plan/
├── plan.md
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/

custom_components/ac_modbus/   # planned HA integration location (not yet scaffolded)
tests/                         # add HA tests alongside integration when implemented
```

## Commands

- Edit docs plan: `docs/ha-custom-integration-plan.md`
- Run HA tests (when added): `pytest -q`
- Update agent context after plan changes: `.specify/scripts/bash/update-agent-context.sh codex`

## Code Style

Python 3.12 (Home Assistant target): Follow standard conventions

## Recent Changes

- 002-ha-integration-plan: Added Python 3.12 (Home Assistant target) + Home Assistant custom integration framework, `pymodbus` async client, `DataUpdateCoordinator` pattern

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
