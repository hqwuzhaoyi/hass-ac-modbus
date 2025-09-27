# Tasks: Enhanced Real-Time Register Change Detection

**Input**: Design documents from `/specs/001-/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/, quickstart.md

## Execution Flow Summary
Based on the implementation plan, this feature extends the existing Next.js/TypeScript Modbus monitoring system to provide real-time change detection with sub-100ms latency. The implementation follows the existing three-mode architecture (basic/enhanced/demo) and maintains constitutional compliance.

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- TypeScript-first development per constitutional requirement
- All new files integrate with existing architecture

## Phase 3.1: Setup & Type System

- [ ] **T001** Create TypeScript type definitions for change detection in `types/change-events.ts`
- [ ] **T002** [P] Create TypeScript WebSocket message types in `lib/websocket-types.ts`
- [ ] **T003** [P] Configure Jest test environment for real-time testing features

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE IMPLEMENTATION
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

- [ ] **T004** [P] Contract test for RegisterChangeEvent validation in `__tests__/contracts/change-event.test.ts`
- [ ] **T005** [P] Contract test for WebSocket message protocol in `__tests__/contracts/websocket-protocol.test.ts`
- [ ] **T006** [P] Integration test for change detection algorithm in `__tests__/integration/change-detection.test.ts`
- [ ] **T007** [P] Integration test for real-time monitoring workflow in `__tests__/integration/real-time-monitoring.test.ts`
- [ ] **T008** [P] Performance test for sub-100ms change notification in `__tests__/performance/change-latency.test.ts`
- [ ] **T009** [P] Integration test for three-mode compatibility in `__tests__/integration/multi-mode.test.ts`
- [ ] **T010** [P] End-to-end test for UI change highlighting in `__tests__/e2e/change-visualization.test.ts`

## Phase 3.3: Core Change Detection Implementation (ONLY after tests are failing)

- [ ] **T011** [P] Implement change detection algorithm in `lib/change-detector.ts`
- [ ] **T012** [P] Create change event data structures and validation in `lib/change-event-manager.ts`
- [ ] **T013** [P] Implement WebSocket message handlers for change notifications in `lib/change-websocket-handler.ts`
- [ ] **T014** Create monitoring session management with bounded history in `lib/monitoring-session.ts` (extends existing session logic)
- [ ] **T015** Integrate change detection with existing basic WebSocket server in `server.js`
- [ ] **T016** Integrate change detection with existing enhanced WebSocket server in `server-enhanced-simple.js`
- [ ] **T017** Integrate change detection with existing demo WebSocket server in `server-demo.js`

## Phase 3.4: UI Components

- [ ] **T018** [P] Create real-time change visualization component in `components/real-time-change-monitor.tsx`
- [ ] **T019** [P] Create change history display component in `components/change-history-panel.tsx`
- [ ] **T020** [P] Add CSS animations for change highlighting using Tailwind CSS in `components/ui/change-highlight.module.css`
- [ ] **T021** Integrate change monitoring into existing basic dashboard in `app/page.tsx`
- [ ] **T022** Integrate change monitoring into existing enhanced dashboard in `app/enhanced/page.tsx`

## Phase 3.5: Integration & Configuration

- [ ] **T023** Update existing Modbus client integration to support change detection in `lib/modbus-client.ts`
- [ ] **T024** Configure session parameters for different monitoring modes per constitutional requirements
- [ ] **T025** Implement debouncing logic for rapid register fluctuations in change detection middleware
- [ ] **T026** Add change event MQTT publishing for Home Assistant integration (extends existing MQTT bridge)

## Phase 3.6: Validation & Polish

- [ ] **T027** [P] Create unit tests for change detection utilities in `__tests__/unit/change-detector.test.ts`
- [ ] **T028** [P] Create unit tests for WebSocket message validation in `__tests__/unit/websocket-messages.test.ts`
- [ ] **T029** [P] Create unit tests for monitoring session management in `__tests__/unit/monitoring-session.test.ts`
- [ ] **T030** Validate quickstart scenarios from quickstart.md across all three server modes
- [ ] **T031** [P] Update documentation in CLAUDE.md with change detection features
- [ ] **T032** Performance optimization and memory leak prevention validation
- [ ] **T033** Cross-browser compatibility testing for real-time UI updates

## Dependencies

**Phase 3.1 → 3.2**: Type definitions before contract tests
**Phase 3.2 → 3.3**: All tests MUST FAIL before implementation begins
**Phase 3.3 Core Order**:
- T011, T012, T013 (parallel - different files)
- T014 → T015, T016, T017 (session management before server integration)
**Phase 3.4**: UI components can be parallel since they're different files
**Phase 3.5**: T021, T022 depend on T018, T019 completion
**Phase 3.6**: Validation depends on all implementation being complete

## Parallel Execution Examples

### Phase 3.2 - All contract tests together:
```bash
# Run these in parallel:
Task: "Contract test for RegisterChangeEvent validation in __tests__/contracts/change-event.test.ts"
Task: "Contract test for WebSocket message protocol in __tests__/contracts/websocket-protocol.test.ts"
Task: "Integration test for change detection algorithm in __tests__/integration/change-detection.test.ts"
Task: "Integration test for real-time monitoring workflow in __tests__/integration/real-time-monitoring.test.ts"
Task: "Performance test for sub-100ms change notification in __tests__/performance/change-latency.test.ts"
```

### Phase 3.3 - Core implementation components:
```bash
# Run these in parallel:
Task: "Implement change detection algorithm in lib/change-detector.ts"
Task: "Create change event data structures and validation in lib/change-event-manager.ts"
Task: "Implement WebSocket message handlers for change notifications in lib/change-websocket-handler.ts"
```

### Phase 3.4 - UI components:
```bash
# Run these in parallel:
Task: "Create real-time change visualization component in components/real-time-change-monitor.tsx"
Task: "Create change history display component in components/change-history-panel.tsx"
Task: "Add CSS animations for change highlighting using Tailwind CSS in components/ui/change-highlight.module.css"
```

## File Path Structure
Based on existing Next.js architecture:
- **Types**: `types/change-events.ts`, `lib/websocket-types.ts`
- **Core Logic**: `lib/change-detector.ts`, `lib/change-event-manager.ts`
- **Server Integration**: `server.js`, `server-enhanced-simple.js`, `server-demo.js`
- **UI Components**: `components/real-time-change-monitor.tsx`, `components/change-history-panel.tsx`
- **Tests**: `__tests__/` with subdirectories for contracts, integration, performance, unit, e2e

## Constitutional Compliance Validation
- **Real-time Data Integrity**: Sub-100ms change detection and WebSocket broadcast (T008, T032)
- **Progressive Discovery**: Compatible with existing discovery without breaking functionality (T009, T030)
- **TypeScript-First**: All new code in TypeScript with complete type definitions (T001, T002)
- **Multi-Mode Operation**: Works across basic/enhanced/demo modes (T015-T017, T030)
- **Home Assistant Integration**: Change events trigger MQTT updates (T026)

## Success Criteria
Implementation complete when:
1. All tests pass (phases 3.2 validates functionality)
2. Quickstart scenarios work across all server modes (T030)
3. Sub-100ms change detection latency achieved (T008, T032)
4. Visual feedback enables effective AC reverse engineering (T018-T022)
5. No disruption to existing monitoring functionality (T009, T030)

## Notes
- Each task specifies exact file paths for implementation
- [P] tasks work on different files and can run in parallel
- TDD approach: tests must fail before implementation
- Existing architecture preserved and extended, not replaced
- Constitutional compliance verified throughout implementation