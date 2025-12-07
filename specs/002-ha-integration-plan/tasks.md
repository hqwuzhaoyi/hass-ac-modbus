# Tasks: Home Assistant 自定义集成文档落地

**Input**: Design documents from `/Users/wuzhaoyi/workspace/opensource/hass-ac-modbus/specs/002-ha-integration-plan/`  
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: No dedicated test tasks requested; focus on documentation and acceptance coverage.  
**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare documentation skeleton and references

- [ ] T001 Create or align section skeleton (目标/目录结构/设计/服务/诊断/里程碑/扩展) in `/Users/wuzhaoyi/workspace/opensource/hass-ac-modbus/docs/ha-custom-integration-plan.md`.
- [ ] T002 [P] Add header references (branch, spec, plan, artifact links) to `/Users/wuzhaoyi/workspace/opensource/hass-ac-modbus/docs/ha-custom-integration-plan.md` pointing to `/Users/wuzhaoyi/workspace/opensource/hass-ac-modbus/specs/002-ha-integration-plan/`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Baseline content required by all stories

- [ ] T003 明确目标/范围段落（纯 HA 自定义集成、无 Node 依赖、首版覆盖 1033 总开关与 1041 模式寄存器）写入 `/Users/wuzhaoyi/workspace/opensource/hass-ac-modbus/docs/ha-custom-integration-plan.md`.
- [ ] T004 Document技术栈/环境前提（Python 3.12、HA 2024.12+、pymodbus、devcontainer/HA Core）在 `/Users/wuzhaoyi/workspace/opensource/hass-ac-modbus/docs/ha-custom-integration-plan.md`.
- [ ] T005 Capture推荐目录结构和文件清单（`custom_components/ac_modbus` 下各模块）在 `/Users/wuzhaoyi/workspace/opensource/hass-ac-modbus/docs/ha-custom-integration-plan.md`.
- [ ] T006 Document全局约束与默认值（默认轮询 10s，最小 5s；写后回读需在 <5s；timeout < poll；mode_map 默认映射；强制回读校验；连接重连/backoff 与抖动）在 `/Users/wuzhaoyi/workspace/opensource/hass-ac-modbus/docs/ha-custom-integration-plan.md`.

**Checkpoint**: Foundation ready - user story work can begin

---

## Phase 3: User Story 1 - 开发者按计划落地 HA 集成 (Priority: P1) 🎯 MVP

**Goal**: 提供可直接搭建 `ac_modbus` 集成的实现方案（1033/1041 首发、无 Node 依赖）。  
**Independent Test**: 仅阅读文档即可搭建骨架、读写并轮询 1033/1041，实体状态与设备一致，失败时标记不可用。

### Implementation for User Story 1

- [ ] T007 [US1] 说明 Hub/Coordinator 设计（pymodbus async 连接、重连/backoff、读写封装、缓存职责）及可配置项（host/port/unit_id/poll_interval/mode_map）在 `/Users/wuzhaoyi/workspace/opensource/hass-ac-modbus/docs/ha-custom-integration-plan.md`.
- [ ] T008 [US1] 描述实体映射与行为（1033 开关、1041 模式 select/climate、写后回读、不可用规则）在 `/Users/wuzhaoyi/workspace/opensource/hass-ac-modbus/docs/ha-custom-integration-plan.md`.
- [ ] T009 [P] [US1] 整理服务契约 `ac_modbus.write_register` 与 `ac_modbus.scan_range`（参数、回读校验、事件 `ac_modbus_scan_result`）参考 `/Users/wuzhaoyi/workspace/opensource/hass-ac-modbus/specs/002-ha-integration-plan/contracts/services-openapi.yaml` 并写入 `/Users/wuzhaoyi/workspace/opensource/hass-ac-modbus/docs/ha-custom-integration-plan.md`.
- [ ] T010 [US1] 编写开发步骤与 quickstart（依赖安装、目录搭建、轮询配置、服务调用示例、pytest 运行方式）在 `/Users/wuzhaoyi/workspace/opensource/hass-ac-modbus/docs/ha-custom-integration-plan.md`.
- [ ] T011 [US1] 填写错误处理与诊断章节（连接异常记录、实体可用性、诊断页字段：状态/错误时间/最近读写等）在 `/Users/wuzhaoyi/workspace/opensource/hass-ac-modbus/docs/ha-custom-integration-plan.md`.
- [ ] T012 [US1] 定义里程碑 M1–M4 与交付 gating（骨架、读写/轮询、服务/诊断、硬化与扩展钩子）在 `/Users/wuzhaoyi/workspace/opensource/hass-ac-modbus/docs/ha-custom-integration-plan.md`.

**Checkpoint**: User Story 1 fully functional and independently testable by following the doc

---

## Phase 4: User Story 2 - 测试/验收人员验证范围与里程碑 (Priority: P2)

**Goal**: 测试/验收能依据文档覆盖配置、读写、错误/诊断、服务调用并按里程碑评估达标。  
**Independent Test**: 仅阅读文档即可列出覆盖用例清单并判定当前实现是否满足 M1–M3。

### Implementation for User Story 2

- [ ] T013 [US2] 编制测试/验收用例矩阵（配置、轮询、写回读、错误展示、诊断、服务）并放入 `/Users/wuzhaoyi/workspace/opensource/hass-ac-modbus/docs/ha-custom-integration-plan.md`.
- [ ] T014 [P] [US2] 将里程碑 M1–M4 与验收口径映射为清单/检查表供测试对照，写入 `/Users/wuzhaoyi/workspace/opensource/hass-ac-modbus/docs/ha-custom-integration-plan.md`.

**Checkpoint**: User Stories 1 & 2 independently testable

---

## Phase 5: User Story 3 - 维护者规划后续扩展 (Priority: P3)

**Goal**: 维护者获取扩展思路（新寄存器、扫描能力、HACS 分发、i18n、节流）及注意事项。  
**Independent Test**: 仅阅读文档即可列出可实施的扩展点和约束，无需口头说明。

### Implementation for User Story 3

- [ ] T015 [US3] 撰写扩展路线与注意事项（温度/风速实体、扫描增强、mode_map 自定义、回读要求、轮询节流）在 `/Users/wuzhaoyi/workspace/opensource/hass-ac-modbus/docs/ha-custom-integration-plan.md`.
- [ ] T016 [P] [US3] 记录分发与贡献指南（HACS 元数据、版本策略、翻译、诊断字段扩展）在 `/Users/wuzhaoyi/workspace/opensource/hass-ac-modbus/docs/ha-custom-integration-plan.md`.

**Checkpoint**: All user stories independently functional

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Validation and cleanup across stories

- [ ] T017 逐条对照 FR-001–FR-009 与 SC-001–SC-004，补齐或标记缺口于 `/Users/wuzhaoyi/workspace/opensource/hass-ac-modbus/docs/ha-custom-integration-plan.md`.
- [ ] T018 [P] 校对中文表述、交叉引用（spec/plan/quickstart/contract 链接）并完成最终格式检查于 `/Users/wuzhaoyi/workspace/opensource/hass-ac-modbus/docs/ha-custom-integration-plan.md`.

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → User Stories (US1 → US2 → US3) → Polish.
- US2 depends on US1 content; US3 can start after foundational but should reference finalized US1 service/entity guidance.

## Parallel Execution Examples

- US1: T009 (服务契约) can run in parallel with T008 (实体行为) since they touch distinct doc sections.  
- US2: T014 (验收清单) can run in parallel with T013 (用例矩阵) once US1 is done.  
- US3: T016 (分发/贡献指南) can run in parallel with T015 (扩展路线) after foundational sections exist.

## Implementation Strategy

- MVP first: Complete Phases 1–2 then US1; validate by executing quickstart steps and service examples.  
- Incremental: After US1, layer US2 acceptance coverage; then US3 extensions; finish with polish.  
- Keep tasks independent per story; avoid cross-story edits in the same pass to reduce merge conflicts.
