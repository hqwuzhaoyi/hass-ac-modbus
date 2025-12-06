
# Implementation Plan: Dynamic Scanning & Change Detection (Paused/Minimal Scope)

**Branch**: `001-` | **Date**: 2025-09-27 | **Spec**: [spec.md](./spec.md)
**Status**: Paused — current product choice is to disable polling/real-time monitoring/scanning and only allow manual read/write of registers 1033/1041. This plan is retained for future reactivation.
**Input**: Updated specification from `/specs/001-/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from file system structure or context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, `GEMINI.md` for Gemini CLI, `QWEN.md` for Qwen Code or `AGENTS.md` for opencode).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Current scope is minimal: WebSocket server (ts-node) only permits manual read/write of registers 1033/1041; polling, real-time change detection, dynamic discovery, and scanning are disabled. Future reactivation will revisit end-to-end change detection goals.

## Technical Context
**Language/Version**: TypeScript/Node.js (Next.js 14 stack)
**Primary Dependencies**: modbus-serial, ws (WebSocket), Next.js, Radix UI, Tailwind CSS
**Storage**: None for change history (monitoring disabled)
**Testing**: Jest (existing test framework)
**Target Platform**: Node.js server + Next.js web interface
**Project Type**: web
**Performance Goals**: N/A for change detection (feature paused); manual read/write should succeed with clear errors on failure.
**Buffering Strategy**: Disabled
**Constraints**: Only registers 1033/1041 are allowed; monitoring/scanning commands return “disabled”.
**Scale/Scope**: Single AC unit; manual control only.

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Real-time Data Integrity Check**: ✅ PASS - Extends existing WebSocket infrastructure with 分层延迟预算（后端检测≤250ms、WebSocket 分发≤150ms、前端呈现≤600ms），在保持后端检测 <100ms 拉伸目标的同时记录全链路时间戳，确保数据一致性。

**Progressive Discovery Check**: ✅ PASS - Enhances existing monitoring without disrupting basic/enhanced/demo modes. Change detection works with both known and dynamically discovered registers.

**TypeScript-First Check**: ✅ PASS - All new components will be TypeScript with complete type definitions for change events, register metadata, and WebSocket protocols.

**Multi-Mode Operation Check**: ✅ PASS - Change detection integrates into existing server modes (basic/enhanced/demo) without shared state conflicts.

**Home Assistant Integration Check**: ✅ PASS - Register changes can trigger MQTT updates, preserving metadata and discovery payloads for newly identified capabilities.

**Operational Dependency Check**: ✅ PASS - Accounts for Modbus 设备连通性、WebSocket 长连接、MQTT 桥接与时间同步依赖，并规划自动重连、回放与告警机制。

## Project Structure

### Documentation (this feature)
```
specs/[###-feature]/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->
```
# Next.js Full-Stack Application (existing structure)
app/                    # Next.js app router
├── page.tsx           # Basic monitoring dashboard
├── enhanced/          # Enhanced monitoring features
│   └── page.tsx       # Enhanced monitoring interface
└── api/               # API routes (if needed)

components/            # React components
├── register-monitor.tsx          # Basic monitoring (existing)
├── enhanced-register-monitor.tsx # Enhanced monitoring (existing)
├── real-time-change-monitor.tsx  # NEW: Real-time change detection
└── ui/                # Radix UI components

lib/                   # Core libraries
├── modbus-client.ts   # Modbus communication (existing)
├── enhanced-monitor.ts # Enhanced monitoring (existing)
├── change-detector.ts  # NEW: Change detection logic
└── websocket-types.ts  # NEW: WebSocket message types

types/                 # TypeScript definitions
├── modbus.ts          # Existing Modbus types
└── change-events.ts   # NEW: Change event types (future if monitoring resumes)

server.ts              # WebSocket server (TS) focused on 1033/1041; monitoring disabled
```

**Structure Decision**: Extending existing Next.js full-stack architecture. New change detection functionality will integrate into current WebSocket servers and React components without disrupting the existing three-mode operation (basic/enhanced/demo). All new code follows the established TypeScript-first approach.

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:
   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]
   - Operational safeguards: 缓冲阈值、丢帧处理、依赖告警策略

**Output**: ✅ research.md completed with all technical decisions documented

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `.specify/scripts/bash/update-agent-context.sh claude`
     **IMPORTANT**: Execute it exactly as specified above. Do not add or remove any arguments.
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: ✅ data-model.md, contracts/, quickstart.md, CLAUDE.md updated with feature context

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design artifacts:
  - TypeScript type definitions → type validation tests [P]
  - WebSocket message contracts → message handling tests [P]
  - Change detection algorithm → unit tests for core logic [P]
  - UI components → component integration tests
  - Server middleware → WebSocket protocol tests
  - End-to-end scenarios → quickstart validation tests

**Implementation Task Categories**:
1. **Core Change Detection** (lib/change-detector.ts)
   - Value comparison algorithm with debouncing
   - Change event generation and ID assignment
   - Integration with existing polling infrastructure
   - Circular buffering with overflow handling and delayed-event tagging

2. **WebSocket Protocol Extension** (lib/websocket-types.ts)
   - Message type definitions and validation
   - Protocol handlers for new message types
   - Backward compatibility preservation
   - Batch/sequence identifiers for simultaneous register changes

3. **UI Enhancement** (components/real-time-change-monitor.tsx)
   - Real-time change highlighting with CSS transitions
   - Change history display and filtering
   - Integration with existing monitoring interfaces
   - Accessible highlight states, silent-mode messaging, timestamp localization

4. **Server Integration** (server.ts; monitoring paused)
   - (Deferred) Change detection/monitoring if re-enabled
   - (Current) Enforce allowed registers (1033/1041) and clear error responses
   - (Deferred) Performance tuning and dependency monitoring for real-time paths

**Ordering Strategy**:
- **Phase A**: Type definitions and contracts (parallel tasks)
- **Phase B**: Core change detection logic (depends on types)
- **Phase C**: Server integration (depends on change detection)
- **Phase D**: UI components (depends on WebSocket protocol)
- **Phase E**: Integration tests and quickstart validation

**Dependency Management**:
- All new code extends existing architecture
- No breaking changes to current WebSocket protocol
- Constitutional compliance verification at each phase
- Demo mode enables testing without hardware dependencies

**Estimated Output**: 18-22 numbered tasks in dependency order

**Critical Success Factors (current scope)**:
- 仅允许 1033/1041 手动读写，其他地址返回明确错误
- WS 服务保持稳定连接与热重载，读写失败有清晰错误提示
- 未来恢复监控/扫描前，需重新定义延迟目标、缓冲/回放策略与多模式支持

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |


## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved (technical assumptions documented in research.md)
- [x] Complexity deviations documented (none - extends existing architecture)

---
*Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`*
