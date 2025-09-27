# Tasks: [FEATURE NAME]

**Input**: Design documents from `/specs/[###-feature-name]/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → If not found: ERROR "No implementation plan found"
   → Extract: tech stack, libraries, structure
2. Load optional design documents:
   → data-model.md: Extract entities → model tasks
   → contracts/: Each file → contract test task
   → research.md: Extract decisions → setup tasks
3. Generate tasks by category:
   → Setup: project init, dependencies, linting
   → Tests: contract tests, integration tests
   → Core: models, services, CLI commands
   → Integration: DB, middleware, logging
   → Polish: unit tests, performance, docs
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → All contracts have tests?
   → All entities have models?
   → All endpoints implemented?
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Single project**: `src/`, `tests/` at repository root
- **Web app**: `backend/src/`, `frontend/src/`
- **Mobile**: `api/src/`, `ios/src/` or `android/src/`
- Paths shown below assume single project - adjust based on plan.md structure

## Phase 3.1: Setup
- [ ] T001 Create project structure per implementation plan
- [ ] T002 Initialize [language] project with [framework] dependencies
- [ ] T003 [P] Configure linting and formatting tools

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**
- [ ] T004 [P] TypeScript contract test for Modbus register reading in tests/contract/test_modbus_read.ts
- [ ] T005 [P] TypeScript contract test for WebSocket register updates in tests/contract/test_websocket.ts
- [ ] T006 [P] Integration test for real-time monitoring in tests/integration/test_monitoring.ts
- [ ] T007 [P] Integration test for register discovery in tests/integration/test_discovery.ts
- [ ] T008 [P] Performance test for sub-100ms WebSocket response in tests/performance/test_realtime.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)
- [ ] T009 [P] TypeScript Modbus register model in src/models/register.ts
- [ ] T010 [P] TypeScript register monitoring service in src/services/register-monitor.ts
- [ ] T011 [P] WebSocket server with real-time updates in src/websocket/server.ts
- [ ] T012 TypeScript Modbus client integration in src/modbus/client.ts
- [ ] T013 TypeScript register discovery service in src/services/discovery.ts
- [ ] T014 Input validation with TypeScript types
- [ ] T015 Error handling with structured logging

## Phase 3.4: Integration
- [ ] T016 Connect register monitoring to Modbus device
- [ ] T017 MQTT bridge with Home Assistant discovery
- [ ] T018 Multi-mode operation support (demo/basic/enhanced)
- [ ] T019 Environment configuration management

## Phase 3.5: Polish
- [ ] T020 [P] TypeScript unit tests for register validation in tests/unit/test_register_validation.ts
- [ ] T021 Performance tests (sub-100ms WebSocket response)
- [ ] T022 [P] Update CLAUDE.md and README.md
- [ ] T023 Remove code duplication
- [ ] T024 Manual testing across all operation modes

## Dependencies
- Tests (T004-T008) before implementation (T009-T015)
- T009 blocks T010, T016
- T017 blocks T018
- Implementation before polish (T020-T024)

## Parallel Example
```
# Launch T004-T008 together:
Task: "TypeScript contract test for Modbus register reading in tests/contract/test_modbus_read.ts"
Task: "TypeScript contract test for WebSocket register updates in tests/contract/test_websocket.ts"
Task: "Integration test for real-time monitoring in tests/integration/test_monitoring.ts"
Task: "Integration test for register discovery in tests/integration/test_discovery.ts"
Task: "Performance test for sub-100ms WebSocket response in tests/performance/test_realtime.ts"
```

## Notes
- [P] tasks = different files, no dependencies
- Verify tests fail before implementing
- Commit after each task
- Avoid: vague tasks, same file conflicts

## Task Generation Rules
*Applied during main() execution*

1. **From Contracts**:
   - Each contract file → contract test task [P]
   - Each endpoint → implementation task
   
2. **From Data Model**:
   - Each entity → model creation task [P]
   - Relationships → service layer tasks
   
3. **From User Stories**:
   - Each story → integration test [P]
   - Quickstart scenarios → validation tasks

4. **Ordering**:
   - Setup → Tests → Models → Services → Endpoints → Polish
   - Dependencies block parallel execution

## Validation Checklist
*GATE: Checked by main() before returning*

- [ ] All contracts have corresponding tests
- [ ] All entities have model tasks
- [ ] All tests come before implementation
- [ ] Parallel tasks truly independent
- [ ] Each task specifies exact file path
- [ ] No task modifies same file as another [P] task