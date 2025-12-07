# Feature Specification: Home Assistant 自定义集成方案与实现

**Feature Branch**: `[002-ha-integration-plan]`
**Created**: 2025-12-07
**Status**: Active
**Input**: User description: "根据我的方案进行创建 docs/ha-custom-integration-plan.md"
**Scope Evolution**: 2025-12-07 扩展范围以涵盖代码实施

---

## Scope Definition

本 feature 分为两个交付阶段：

| 阶段 | 范围 | 交付物 | 状态 |
|------|------|--------|------|
| **Part A** | 文档落地 | `docs/ha-custom-integration-plan.md` | ✅ 完成 |
| **Part B** | 代码实施 | `custom_components/ac_modbus/` + 测试套件 | 🚧 进行中 |

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 开发者按计划落地 HA 集成 (Priority: P1)

一名 Home Assistant 开发者需要一份清晰的实现方案，能在不依赖现有 Node 进程的前提下，把 Modbus 空调控制封装为 `ac_modbus` 自定义集成，并优先支持 1033 总开关和 1041 模式寄存器。

**Why this priority**: 这是业务价值的核心，直接决定能否在 HA 中独立控制空调。

**Independent Test**: 只阅读文档即可搭建项目骨架，完成 1033/1041 的读写和实体注册，不需要参考其他资料。

**Acceptance Scenarios**:

1. **Given** 开发者只拥有现有方案文档，**When** 按文档搭建 `custom_components/ac_modbus` 目录和实体，**Then** 可在 HA 中看到开关和模式实体并轮询状态。
2. **Given** 开发者遵循文档的轮询与回读指引，**When** 对 1033/1041 写入后回读，**Then** 实体状态与设备一致且失败时标记不可用。

---

### User Story 2 - 测试/验收人员验证范围与里程碑 (Priority: P2)

测试或验收人员需要通过文档确认功能范围、优先级、里程碑（M1-M4）和验收口径，确保上线标准一致。

**Why this priority**: 没有明确范围和验收标准会导致测试缺口和交付延迟。

**Independent Test**: 只看文档即可列出覆盖用例（配置、读写、错误展示、诊断、服务），并对照里程碑判断是否满足发布条件。

**Acceptance Scenarios**:

1. **Given** 测试人员阅读文档，**When** 按里程碑列出必测场景，**Then** 列表涵盖配置、轮询、写回读、错误/诊断、服务调用。
2. **Given** 验收人员比对文档里的 M1-M3 目标，**When** 评估当前实现，**Then** 能明确是否达标或差距。

---

### User Story 3 - 维护者规划后续扩展 (Priority: P3)

维护者希望文档提供扩展思路（温度/风速实体、扫描服务、HACS 分发）及注意事项，以便后续迭代。

**Why this priority**: 提前规划扩展减少架构返工，方便社区贡献。

**Independent Test**: 仅依赖文档就能列出下一步可实施的扩展点和注意事项。

**Acceptance Scenarios**:

1. **Given** 维护者阅读"后续扩展思路"，**When** 规划新增寄存器或扫描能力，**Then** 能直接得到推荐切入点和约束（如 async、回读校验、轮询节流）。
2. **Given** 文档的 HACS/发布注意点，**When** 规划分发，**Then** 可识别需要补充的元数据与发布流程。

---

### User Story 4 - 基于文档实施可用的集成代码 (Priority: P1) [Part B]

开发者需要基于 Part A 文档，实施可在 HA 中实际运行的 `ac_modbus` 自定义集成，包含完整的测试覆盖。

**Why this priority**: 文档只是指南，可运行的代码才能为用户提供实际价值。

**Independent Test**: 集成可在 HA 2024.12+ 中加载，UI 配置可用，实体可见并可控制。

**Acceptance Scenarios**:

1. **Given** 开发者已完成 Part A 文档，**When** 按 TDD 流程实施代码，**Then** 所有单元测试和集成测试通过，覆盖率 > 85%。
2. **Given** 集成已安装到 HA，**When** 通过 UI 添加配置，**Then** 开关和模式实体可见，状态每 10s 轮询更新。
3. **Given** 实体可用，**When** 调用 turn_on/off 或切换模式，**Then** 写入成功后回读验证，状态同步更新。

---

### User Story 5 - 开发者可通过测试指南快速上手 TDD (Priority: P2) [Part B]

开发者需要一份测试指南，说明如何为 HA 自定义集成编写和运行测试，降低 TDD 入门门槛。

**Why this priority**: TDD 是代码质量的保障，但 HA 集成测试有特殊性，需要专门指导。

**Independent Test**: 开发者仅阅读测试指南即可配置测试环境并运行首个测试。

**Acceptance Scenarios**:

1. **Given** 开发者阅读 `docs/testing-guide.md`，**When** 按指南安装依赖并运行 `pytest --collect-only`，**Then** 测试环境配置成功无错误。
2. **Given** 测试环境就绪，**When** 开发者按指南编写 Hub 测试，**Then** 可成功 Mock Modbus 客户端并验证连接逻辑。

---

### Edge Cases

**Part A (文档)**:
- 文档需说明当寄存器映射与默认值不符时的处理（例如自定义 mode_map）。
- 轮询间隔设置过低时的风险与建议下限需在文档中提示。
- 写寄存器失败或连接断开时，文档需说明实体可用性与诊断输出的处理方式。

**Part B (实施)**:
- 部分寄存器读取失败时（如 1033 成功但 1041 失败），需正确处理混合状态。
- 设备重启后的状态恢复策略需实现并测试。
- 并发写入请求需通过锁机制保证顺序执行。
- 回读超时或不一致时，实体需标记为 unavailable 并记录诊断。

---

## Requirements *(mandatory)*

### Part A: Documentation Requirements

- **FR-001**: 文档必须明确目标：提供纯 Home Assistant 自定义集成方案，不依赖 Node 进程，首版覆盖 1033 开关和 1041 模式寄存器。
- **FR-002**: 文档必须给出推荐目录结构（包含 __init__.py、manifest.json、config_flow.py、const.py、coordinator.py、hub.py、实体、services.yaml、diagnostics.py、translations）。
- **FR-003**: 文档必须描述核心设计：连接/重连策略（pymodbus async）、轮询与缓存、实体职责、写入后的回读校验、可配置项（host/port/unit_id/poll_interval/mode_map）。
- **FR-004**: 文档必须定义服务行为：`ac_modbus.write_register` 参数与回读校验；可选 `ac_modbus.scan_range` 的范围、输出方式。
- **FR-005**: 文档必须说明错误与诊断处理：连接异常记录、实体可用性规则、诊断页输出内容。
- **FR-006**: 文档必须列出开发步骤与优先级（骨架、Hub/Coordinator、实体、服务、诊断、测试、文档）。
- **FR-007**: 文档必须提供里程碑与验收标准（M1-M4），覆盖配置、实体可见性、读写同步、服务可用性、诊断可读性。
- **FR-008**: 文档必须包含注意事项与扩展思路（async 要求、轮询间隔建议、写后回读、国际化、后续寄存器与 HACS 分发等）。
- **FR-009**: 文档必须存放于 `docs/ha-custom-integration-plan.md`，内容以中文呈现，便于当前团队理解。

### Part B: Implementation Requirements

- **FR-010**: 必须创建 `custom_components/ac_modbus/` 目录，包含 FR-002 定义的所有文件。
- **FR-011**: 必须实现 ModbusHub 类，封装 pymodbus async 客户端，支持连接、断开、重连（含 backoff/jitter）、读写寄存器、回读验证。
- **FR-012**: 必须实现 DataUpdateCoordinator，周期轮询 1033/1041 寄存器（默认 10s，最小 5s），缓存结果，传播可用性状态。
- **FR-013**: 必须实现 PowerSwitchEntity (1033) 和 ModeSelectEntity (1041)，从 Coordinator 缓存读取状态，写入时调用 Hub 并回读验证。
- **FR-014**: 必须实现 `ac_modbus.write_register` 服务，支持参数 register、value、unit_id、verify、expected、timeout，返回验证结果。
- **FR-015**: 必须实现 `ac_modbus.scan_range` 服务，扫描指定范围寄存器并发送 `ac_modbus_scan_result` 事件。
- **FR-016**: 必须实现 diagnostics.py，输出连接状态、最近错误、最近成功时间、配置信息、最近读写结果。
- **FR-017**: 必须实现 config_flow.py，支持 UI 配置 host/port/unit_id/poll_interval/mode_map，验证输入（poll_interval >= 5s）。
- **FR-018**: 必须创建 `docs/testing-guide.md`，说明 HA 集成测试环境搭建、pytest fixtures、Mock 技巧、TDD 工作流。
- **FR-019**: 必须为所有核心模块编写单元测试和集成测试，采用 TDD 方法论（先测试后实现）。

### Non-Functional Requirements

- **NFR-001**: 轮询默认 10s，最小 5s；写入后回读完成应 <5s，超时与回读失败需标记实体不可用。
- **NFR-002**: 所有 Modbus 读写采用异步模式，避免阻塞 HA 事件循环；采用重连与回退/抖动策略。
- **NFR-003**: 诊断需可见连接状态、最近错误时间、最近成功读时间、配置 host/port/unit_id、最近读写结果，便于排障。
- **NFR-004** [Part B]: 测试覆盖率必须 > 85%，核心模块（Hub、Coordinator）覆盖率 > 90%。
- **NFR-005** [Part B]: 集成必须兼容 Home Assistant 2024.12+，Python 3.12。

### Key Entities *(include if feature involves data)*

- **Modbus Hub**: 封装连接、读写、回读验证的客户端抽象，负责与设备保持可用状态。
- **DataUpdateCoordinator 缓存**: 周期性读取 1033/1041 并缓存状态，实体从缓存取值避免过度访问。
- **Power Switch 实体 (1033)**: 映射总开关寄存器，支持 turn_on/off、写后回读并同步状态。
- **Mode Select/Climate 实体 (1041)**: 映射模式寄存器，支持默认模式映射与可配置自定义映射。
- **服务接口**: `ac_modbus.write_register`（写寄存器、可选回读）、`ac_modbus.scan_range`（可选扫描，结果以事件/日志呈现）。
- **诊断输出**: 提供最近错误、连接状态、轮询周期等信息，支持排障。

### Assumptions

- 目标环境已具备 Home Assistant 运行与安装自定义集成的基本能力。
- 设备遵循当前已知的 Modbus 寄存器定义，模式映射可通过配置覆盖差异。
- 团队使用中文作为主要文档语言，后续如需英文会单独补充。
- [Part B] 开发者熟悉 Python 异步编程基础，或可通过测试指南快速上手。

---

## Success Criteria *(mandatory)*

### Part A: Documentation Success Criteria

- **SC-001**: 文档在 `docs/ha-custom-integration-plan.md` 完成并提交，包含目标、目录结构、设计、开发步骤、里程碑、注意事项与扩展思路（一次评审无缺段落）。
- **SC-002**: 2 名开发者在阅读文档后可在 1 天内搭建骨架并完成 1033/1041 实体的读写与轮询 PoC。
- **SC-003**: 测试人员基于文档可独立列出覆盖配置、读写、错误展示、诊断、服务的用例清单，缺项少于 10%。
- **SC-004**: 维护者基于文档可列出至少 3 个后续迭代方向（如新增寄存器、扫描服务、HACS 分发），并理解约束，无需额外口头说明。

### Part B: Implementation Success Criteria

- **SC-005**: `custom_components/ac_modbus/` 目录结构完整，包含所有必需文件（manifest.json、__init__.py、hub.py、coordinator.py、switch.py、select.py、config_flow.py、services.yaml、diagnostics.py）。
- **SC-006**: 集成可在 HA 2024.12+ 中通过 UI 添加，配置流程验证 host/port/unit_id/poll_interval 输入。
- **SC-007**: 开关实体 (1033) 和模式实体 (1041) 在 HA 前端可见，状态每 10s 自动更新。
- **SC-008**: 写入操作（turn_on/off、模式切换）成功后回读验证，状态同步；失败时实体标记为 unavailable。
- **SC-009**: `ac_modbus.write_register` 和 `ac_modbus.scan_range` 服务可通过开发者工具调用，返回预期结果。
- **SC-010**: 诊断页面显示完整信息：连接状态、最近错误、最近成功时间、配置、最近读写结果。
- **SC-011**: 测试套件通过，覆盖率 > 85%，`pytest -v` 无失败用例。
- **SC-012**: `docs/testing-guide.md` 完成，开发者可按指南配置测试环境并编写测试。

---

## Traceability Matrix

### Part A: FR → SC Mapping

| FR | SC | 验证方式 |
|----|----|---------|
| FR-001 | SC-001 | 文档评审 |
| FR-002 | SC-001, SC-002 | 文档评审 + PoC |
| FR-003 | SC-001, SC-002 | 文档评审 + PoC |
| FR-004 | SC-001, SC-003 | 文档评审 + 用例清单 |
| FR-005 | SC-001, SC-003 | 文档评审 + 用例清单 |
| FR-006 | SC-001, SC-002 | 文档评审 + PoC |
| FR-007 | SC-001, SC-003 | 文档评审 + 用例清单 |
| FR-008 | SC-001, SC-004 | 文档评审 + 扩展规划 |
| FR-009 | SC-001 | 文档路径检查 |

### Part B: FR → SC Mapping

| FR | SC | 验证方式 |
|----|----|---------|
| FR-010 | SC-005 | 目录结构检查 |
| FR-011 | SC-008, SC-011 | 单元测试 + 集成测试 |
| FR-012 | SC-007, SC-011 | 单元测试 + 手工验证 |
| FR-013 | SC-007, SC-008 | 集成测试 + 手工验证 |
| FR-014 | SC-009, SC-011 | 服务测试 |
| FR-015 | SC-009, SC-011 | 服务测试 + 事件验证 |
| FR-016 | SC-010 | 诊断页面检查 |
| FR-017 | SC-006 | Config Flow 测试 |
| FR-018 | SC-012 | 文档评审 |
| FR-019 | SC-011 | 测试覆盖率报告 |
