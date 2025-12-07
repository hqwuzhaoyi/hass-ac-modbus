# Implementation Plan: Home Assistant 自定义集成方案与实现

**Branch**: `[002-ha-integration-plan]` | **Date**: 2025-12-07 | **Spec**: specs/002-ha-integration-plan/spec.md
**Input**: Feature specification from `/specs/002-ha-integration-plan/spec.md`

---

## Summary

交付 Home Assistant 自定义集成 `ac_modbus` 的完整方案：

- **Part A**: 中文实施指南文档（已完成）
- **Part B**: 可运行的集成代码 + 测试套件（进行中）

覆盖 1033 总开关和 1041 模式寄存器，定义服务 (`ac_modbus.write_register`, `ac_modbus.scan_range`)，实现重连/轮询/回读规则，遵循 TDD 方法论。

---

## Technical Context

| 项目 | 值 |
|------|-----|
| **Language/Version** | Python 3.12 |
| **Target Platform** | Home Assistant 2024.12+ (Core/Supervised/Container) |
| **Primary Dependencies** | pymodbus (async), DataUpdateCoordinator |
| **Storage** | Config entries + runtime cache |
| **Testing** | pytest + pytest-homeassistant-custom-component, TDD |
| **Performance Goals** | Poll 10s (min 5s), readback <5s |
| **Constraints** | Async-first I/O, reconnect/backoff, mark unavailable on failures |

---

## Constitution Check

*GATE: Must pass before implementation.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| **I. Simplicity & Documentation-First** | ✅ PASS | Part A 文档先于 Part B 代码；遵循 HA 标准模式 |
| **II. Traceability & Coverage** | ✅ PASS | spec.md 定义 FR-001~FR-019, SC-001~SC-012；tasks.md 有 FR 映射 |
| **III. Async Safety** | ✅ PASS | FR-011/NFR-002 要求 async；tasks T200-T208 覆盖 |
| **IV. Observability & Diagnostics** | ✅ PASS | FR-016/NFR-003 定义诊断字段；tasks T320-T324 覆盖 |
| **V. Testability & Gates** | ✅ PASS | FR-019/NFR-004 要求 TDD + 85% 覆盖率；tasks Part B 全程 TDD |

**Gate Status**: **PASS**

---

## Scope & Deliverables

| 阶段 | 范围 | 交付物 | 状态 | 验收标准 |
|------|------|--------|------|---------|
| **Part A** | 文档落地 | `docs/ha-custom-integration-plan.md` | ✅ 完成 | SC-001~SC-004 |
| **Part B** | 代码实施 | `custom_components/ac_modbus/` + `tests/` | 🚧 进行中 | SC-005~SC-012 |

---

## Requirements → Tasks Mapping

### Part A: Documentation (FR-001 ~ FR-009)

| FR | Description | Tasks | Status |
|----|-------------|-------|--------|
| FR-001 | 文档目标 | T003 | ✅ |
| FR-002 | 目录结构 | T005 | ✅ |
| FR-003 | 核心设计 | T007, T008 | ✅ |
| FR-004 | 服务行为 | T009 | ✅ |
| FR-005 | 错误/诊断 | T011 | ✅ |
| FR-006 | 开发步骤 | T010 | ✅ |
| FR-007 | 里程碑 | T012, T014 | ✅ |
| FR-008 | 扩展思路 | T015, T016 | ✅ |
| FR-009 | 文档路径 | T001 | ✅ |

### Part B: Implementation (FR-010 ~ FR-019)

| FR | Description | Tasks | Status |
|----|-------------|-------|--------|
| FR-010 | 目录结构 | T100, T110-T113 | ⬜ |
| FR-011 | ModbusHub | T200-T208 | ⬜ |
| FR-012 | Coordinator | T210-T216 | ⬜ |
| FR-013 | Entities | T220-T226, T230-T234 | ⬜ |
| FR-014 | write_register | T300-T303 | ⬜ |
| FR-015 | scan_range | T310-T314 | ⬜ |
| FR-016 | Diagnostics | T320-T324 | ⬜ |
| FR-017 | Config Flow | T120-T124 | ⬜ |
| FR-018 | testing-guide | T019 (已完成) | ✅ |
| FR-019 | TDD 测试 | 所有 🔴 Test 任务 | ⬜ |

### NFR → Tasks Mapping

| NFR | Description | Tasks | Status |
|-----|-------------|-------|--------|
| NFR-001 | Poll/readback timing | T006 (doc), T212, T410 | ⬜ |
| NFR-002 | Async I/O | T200-T208, T206-T207 | ⬜ |
| NFR-003 | Diagnostics fields | T320-T324 | ⬜ |
| NFR-004 | Test coverage >85% | 所有测试任务 | ⬜ |
| NFR-005 | HA 2024.12+ | T111 (manifest) | ⬜ |

---

## Phases Overview

### Part A: Documentation (已完成)

| Phase | Goal | Tasks | Status |
|-------|------|-------|--------|
| A1 | Setup | T001-T002 | ✅ |
| A2 | Foundational | T003-T006 | ✅ |
| A3 | US1 开发者指南 | T007-T012 | ✅ |
| A4 | US2 测试验收 | T013-T014 | ✅ |
| A5 | US3 扩展指南 | T015-T016 | ✅ |
| A6 | Polish | T017-T019 | ✅ |

### Part B: Implementation (TDD)

| Phase | Milestone | Goal | Tasks | FR Coverage |
|-------|-----------|------|-------|-------------|
| 0 | - | 测试基础设施 | T100-T105 | FR-010 (partial) |
| 1 | M1 | 骨架/Config Flow | T110-T132 | FR-010, FR-017 |
| 2 | M2 | Hub/Coordinator/Entities | T200-T234 | FR-011, FR-012, FR-013 |
| 3 | M3 | Services/Diagnostics | T300-T324 | FR-014, FR-015, FR-016 |
| 4 | M4 | 硬化/i18n/HACS | T400-T443 | NFR-001, NFR-004 |
| 5 | - | CI/CD & Release | T500-T513 | - |

---

## Project Structure

### Documentation

```text
specs/002-ha-integration-plan/
├── spec.md          # Feature specification (Part A + Part B)
├── plan.md          # Implementation plan (this file)
├── tasks.md         # Task list with FR mapping
├── data-model.md    # Entity model
├── research.md      # Technical decisions
├── quickstart.md    # Setup guide
└── contracts/       # API contracts (OpenAPI)

docs/
├── ha-custom-integration-plan.md   # Part A deliverable ✅
└── testing-guide.md                # FR-018 deliverable ✅
```

### Implementation

```text
custom_components/ac_modbus/        # Part B deliverable
├── __init__.py                     # FR-010
├── manifest.json                   # FR-010, NFR-005
├── config_flow.py                  # FR-017
├── const.py                        # FR-010
├── hub.py                          # FR-011
├── coordinator.py                  # FR-012
├── switch.py                       # FR-013
├── select.py                       # FR-013
├── services.yaml                   # FR-014, FR-015
├── diagnostics.py                  # FR-016
└── translations/                   # FR-010

tests/                              # FR-019
├── conftest.py
├── test_hub.py                     # FR-011
├── test_coordinator.py             # FR-012
├── test_switch.py                  # FR-013
├── test_select.py                  # FR-013
├── test_config_flow.py             # FR-017
├── test_services.py                # FR-014, FR-015
└── test_diagnostics.py             # FR-016
```

---

## Complexity Tracking

| Item | Complexity | Justification |
|------|------------|---------------|
| Part A (文档) | Low | 标准文档交付 |
| Part B (实施) | Medium | HA 自定义集成标准模式 |
| pymodbus async | Low | 成熟库 |
| TDD 方法论 | Medium | 前期投入，长期收益 |

**Overall**: 无超出 HA 基线模式的额外复杂性。

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| pymodbus 版本不兼容 | Low | Medium | 锁定版本 |
| HA API 变更 | Low | Medium | 目标 HA 2024.12+ |
| Modbus 设备行为差异 | Medium | Low | mode_map 可配置 |

---

## Success Metrics

### Part A (已达成)

- [x] SC-001: 文档完成
- [x] SC-002: 开发者可 PoC
- [x] SC-003: 测试人员可列用例
- [x] SC-004: 维护者可规划扩展

### Part B (待验证)

- [ ] SC-005: 目录结构完整
- [ ] SC-006: Config Flow 可用
- [ ] SC-007: 实体可见且轮询
- [ ] SC-008: 写入回读验证
- [ ] SC-009: 服务可调用
- [ ] SC-010: 诊断完整
- [ ] SC-011: 测试覆盖率 >85%
- [ ] SC-012: testing-guide 完成 ✅

---

## Next Steps

1. **Phase 0**: 测试基础设施 (T100-T105)
2. **Phase 1 (M1)**: 骨架与 Config Flow (T110-T132)
3. **Phase 2 (M2)**: 核心功能 (T200-T234)
4. **Phase 3 (M3)**: 服务与诊断 (T300-T324)
5. **Phase 4 (M4)**: 硬化与发布准备 (T400-T513)
