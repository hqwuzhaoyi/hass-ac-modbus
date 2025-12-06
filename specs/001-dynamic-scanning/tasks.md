# Tasks: Enhanced Real-Time Register Change Detection

**Input**: Design documents from `/specs/001-/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/, quickstart.md

## Execution Flow Summary
Based on the implementation plan, this feature extends the existing Next.js/TypeScript Modbus monitoring system to provide real-time change detection that surfaces register 变化在 1 秒内（后端检测≤250ms、WebSocket 分发≤150ms、前端呈现≤600ms，后端检测 <100ms 为拉伸目标），并新增环形缓冲、回放、会话生命周期与依赖告警能力。The implementation follows the existing three-mode architecture (basic/enhanced/demo) and maintains constitutional compliance.

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- TypeScript-first development per constitutional requirement
- All new files integrate with existing architecture

## Phase 3.1: Setup & Type System

- [x] **T001** Create TypeScript type definitions for change detection in `types/change-events.ts`
- [x] **T002** [P] Create TypeScript WebSocket message types in `lib/websocket-types.ts`
- [x] **T003** [P] Configure Jest test environment for real-time testing features

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE IMPLEMENTATION
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

- [x] **T004** [P] Contract test for RegisterChangeEvent validation in `__tests__/contracts/change-event.test.ts`
- [x] **T005** [P] Contract test for WebSocket message protocol in `__tests__/contracts/websocket-protocol.test.ts`
- [x] **T006** [P] Integration test for change detection algorithm及缓冲顺序校验 in `__tests__/integration/change-detection.test.ts`
- [x] **T007** [P] Integration test for real-time monitoring workflow（Start/Pause/Resume/Stop + 回放）in `__tests__/integration/real-time-monitoring.test.ts`
- [x] **T008** [P] Performance test validating 1s end-to-end latency budget（250/150/600ms，后端检测 <100ms 拉伸目标）in `__tests__/performance/change-latency.test.ts`
- [x] **T009** [P] Integration test for three-mode compatibility in `__tests__/integration/multi-mode.test.ts`
- [x] **T010** [P] End-to-end test for UI change highlighting（含可访问性与时间戳展示）in `__tests__/e2e/change-visualization.test.ts`

## Phase 3.3: Core Change Detection Implementation (ONLY after tests are failing)

- [x] **T011** [P] Implement change detection algorithm in `lib/change-detector.ts`
- [x] **T012** [P] Create change event data structures and validation in `lib/change-event-manager.ts`
- [x] **T013** [P] Implement WebSocket message handlers for change notifications in `lib/change-websocket-handler.ts`
- [x] **T014** Create monitoring session management with bounded history、Pause/Resume/Stop flows in `lib/monitoring-session.ts` (extends existing session logic)
- [x] **T015** Integrate change detection with existing basic WebSocket server in `server.js`
- [x] **T016** Integrate change detection with existing enhanced WebSocket server in `server-enhanced-simple.js`
- [x] **T017** Integrate change detection with existing demo WebSocket server in `server-demo.js`

## Phase 3.4: UI Components

- [x] **T018** [P] Create real-time change visualization component in `components/real-time-change-monitor.tsx`
- [x] **T019** [P] Create change history display component in `components/change-history-panel.tsx`
- [x] **T020** [P] Add CSS animations for change highlighting using Tailwind CSS in `components/ui/change-highlight.module.css`
- [x] **T021** Integrate change monitoring into existing basic dashboard in `app/page.tsx`
- [x] **T022** Integrate change monitoring into existing enhanced dashboard in `app/enhanced/page.tsx`

## Phase 3.5: Integration & Configuration

- [x] **T023** Update existing Modbus client integration to support change detection in `lib/modbus-client.ts`
- [x] **T024** Configure session parameters for different monitoring modes per constitutional requirements（含缓冲大小、时间窗口、告警阈值）
- [x] **T025** Implement debouncing逻辑与批次序列 ID 生成 for rapid register fluctuations in change detection middleware
- [x] **T026** Add change event MQTT publishing for Home Assistant integration (extends existing MQTT bridge) with降级/恢复日志
- [x] **T026a** Implement dependency monitors for Modbus/NTP/WebSocket in `lib/dependency-monitors.ts`，并输出自动重连与告警钩子

## Phase 3.6: Validation & Polish

- [x] **T027** [P] Create unit tests for change detection utilities in `__tests__/unit/change-detector.test.ts`
- [x] **T028** [P] Create unit tests for WebSocket message validation in `__tests__/unit/websocket-messages.test.ts`
- [x] **T029** [P] Create unit tests for monitoring session management in `__tests__/unit/monitoring-session.test.ts`
- [x] **T030** Validate quickstart scenarios from quickstart.md across all three server modes
- [x] **T031** [P] Update documentation in CLAUDE.md with change detection features
- [x] **T032** Performance optimization against latency budget and memory leak prevention validation
- [x] **T033** Cross-browser compatibility testing for real-time UI updates
- [x] **T034** Validate缓冲与回放场景（高频、暂停恢复、溢出告警）in `__tests__/integration/buffer-playback.test.ts`
- [x] **T035** Validate依赖告警与自动恢复（Modbus 超时、WebSocket 断连、MQTT 降级）in `__tests__/integration/dependency-monitoring.test.ts`

## Dependencies

**Phase 3.1 → 3.2**: Type definitions before contract tests
**Phase 3.2 → 3.3**: All tests MUST FAIL before implementation begins
**Phase 3.3 Core Order**:
- T011, T012, T013 (parallel - different files)
- T014 → T015, T016, T017 (session management before server integration)
**Phase 3.4**: UI components can be parallel since they're different files
**Phase 3.5**: T021, T022 depend on T018, T019 completion
**Phase 3.5**: T026a depends on T023-T026 completion
**Phase 3.6**: Validation depends on all implementation being complete；T034 依赖 T014、T018、T025，T035 依赖 T023-T026a

## Parallel Execution Examples

### Phase 3.2 - All contract tests together:
```bash
# Run these in parallel:
Task: "Contract test for RegisterChangeEvent validation in __tests__/contracts/change-event.test.ts"
Task: "Contract test for WebSocket message protocol in __tests__/contracts/websocket-protocol.test.ts"
Task: "Integration test for change detection algorithm in __tests__/integration/change-detection.test.ts"
Task: "Integration test for real-time monitoring workflow in __tests__/integration/real-time-monitoring.test.ts"
Task: "Performance test validating 1s latency budget in __tests__/performance/change-latency.test.ts"
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

### Phase 3.5 - Operational safeguards:
```bash
# Sequence:
Task: "Update existing Modbus client integration to support change detection in lib/modbus-client.ts"
Task: "Configure session parameters（缓冲/告警阈值）"
Task: "Implement debouncing逻辑与批次序列 ID"
Task: "Add change event MQTT publishing with降级日志"
Task: "Implement dependency monitors for Modbus/NTP/WebSocket"
```

## File Path Structure
Based on existing Next.js architecture:
- **Types**: `types/change-events.ts`, `lib/websocket-types.ts`
- **Core Logic**: `lib/change-detector.ts`, `lib/change-event-manager.ts`
- **Server Integration**: `server.js`, `server-enhanced-simple.js`, `server-demo.js`
- **UI Components**: `components/real-time-change-monitor.tsx`, `components/change-history-panel.tsx`
- **Tests**: `__tests__/` with subdirectories for contracts, integration, performance, unit, e2e

## Constitutional Compliance Validation
- **Real-time Data Integrity**: 1s end-to-end 延迟预算（后端≤250ms、WebSocket≤150ms、前端≤600ms）得到验证，后端检测保持 <100ms 拉伸目标 (T008, T032, T034)
- **Progressive Discovery**: Compatible with existing discovery without breaking functionality (T009, T030)
- **TypeScript-First**: All new code in TypeScript with complete type definitions (T001, T002)
- **Multi-Mode Operation**: Works across basic/enhanced/demo modes (T015-T017, T030)
- **Home Assistant Integration**: Change events trigger MQTT updates并记录降级恢复日志 (T026)
- **Operational Dependability**: Dependency monitors与告警链路覆盖 Modbus/WebSocket/MQTT/NTP (T026a, T035)

## Success Criteria
Implementation complete when:
1. All tests pass (phases 3.2 validates functionality)
2. Quickstart scenarios work across all server modes (T030)
3. 1s end-to-end 延迟预算达成，并记录后端 <100ms 拉伸目标证据 (T008, T032, T034)
4. Visual feedback enables effective AC reverse engineering (T018-T022)
5. Buffer/playback 与依赖告警在高频与断连场景下表现稳定（T026a, T034, T035）
6. No disruption to existing monitoring functionality (T009, T030)

## Notes
- Each task specifies exact file paths for implementation
- [P] tasks work on different files and can run in parallel
- TDD approach: tests must fail before implementation
- Existing architecture preserved and extended, not replaced
- Constitutional compliance verified throughout implementation
