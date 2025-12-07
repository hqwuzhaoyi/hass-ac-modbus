# Tasks: Home Assistant 自定义集成 (TDD 优先)

**Input**: Design documents from `/Users/hqwuzhaoyi/workspace/opensource/hass-ac-modbus/specs/002-ha-integration-plan/`
**Spec Reference**: spec.md (FR-001~FR-019, NFR-001~NFR-005, SC-001~SC-012)
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, docs/testing-guide.md

**Organization**: 分为两大部分：
- **Part A**: 文档任务（已完成）→ FR-001~FR-009, SC-001~SC-004
- **Part B**: 代码实施任务（TDD 优先）→ FR-010~FR-019, SC-005~SC-012

**TDD 原则**: 每个功能模块遵循 Red-Green-Refactor 循环：
1. 🔴 **Red**: 先写失败的测试
2. 🟢 **Green**: 写最少的代码让测试通过
3. 🔵 **Refactor**: 重构优化代码

---

## Requirements Traceability

### Part A: FR-001 ~ FR-009 (文档需求)

| FR | Description | Tasks | Verification |
|----|-------------|-------|--------------|
| FR-001 | 文档目标 | T003 | SC-001 |
| FR-002 | 目录结构 | T005 | SC-001, SC-002 |
| FR-003 | 核心设计 | T007, T008 | SC-001, SC-002 |
| FR-004 | 服务行为 | T009 | SC-001, SC-003 |
| FR-005 | 错误/诊断 | T011 | SC-001, SC-003 |
| FR-006 | 开发步骤 | T010 | SC-001, SC-002 |
| FR-007 | 里程碑 | T012, T014 | SC-001, SC-003 |
| FR-008 | 扩展思路 | T015, T016 | SC-001, SC-004 |
| FR-009 | 文档路径 | T001 | SC-001 |

### Part B: FR-010 ~ FR-019 (实施需求)

| FR | Description | Tasks | Verification |
|----|-------------|-------|--------------|
| FR-010 | 目录结构 | T100, T110-T113 | SC-005 |
| FR-011 | ModbusHub | T200-T208 | SC-008, SC-011 |
| FR-012 | Coordinator | T210-T216 | SC-007, SC-011 |
| FR-013 | Entities | T220-T226, T230-T234 | SC-007, SC-008 |
| FR-014 | write_register | T300-T303 | SC-009, SC-011 |
| FR-015 | scan_range | T310-T314 | SC-009, SC-011 |
| FR-016 | Diagnostics | T320-T324 | SC-010 |
| FR-017 | Config Flow | T120-T124 | SC-006 |
| FR-018 | testing-guide | T019 | SC-012 |
| FR-019 | TDD 测试 | 所有 🔴 Test 任务 | SC-011 |

### NFR → Tasks Mapping

| NFR | Description | Tasks |
|-----|-------------|-------|
| NFR-001 | Poll/readback timing | T006, T212, T410 |
| NFR-002 | Async I/O | T200-T208 |
| NFR-003 | Diagnostics fields | T320-T324 |
| NFR-004 | Coverage >85% | 所有测试任务 |
| NFR-005 | HA 2024.12+ | T111 |

---

# PART A: 文档任务 (Documentation) ✅

## Phase A1: Setup (Shared Infrastructure) ✅

**Purpose**: 准备文档骨架和参考

- [x] T001 创建文档章节骨架 `docs/ha-custom-integration-plan.md`
- [x] T002 [P] 添加头部引用（branch, spec, plan, artifact links）

---

## Phase A2: Foundational (Blocking Prerequisites) ✅

**Purpose**: 所有用户故事需要的基础内容

- [x] T003 明确目标/范围段落（纯 HA 集成、无 Node 依赖、1033/1041 首发）
- [x] T004 文档化技术栈/环境前提（Python 3.12、HA 2024.12+、pymodbus）
- [x] T005 推荐目录结构和文件清单（`custom_components/ac_modbus`）
- [x] T006 全局约束与默认值（轮询 10s、回读 <5s、mode_map 等）

**Checkpoint**: Foundation ready ✅

---

## Phase A3: User Story 1 - 开发者实施指南 ✅

- [x] T007 [US1] Hub/Coordinator 设计说明
- [x] T008 [US1] 实体映射与行为描述
- [x] T009 [P] [US1] 服务契约整理
- [x] T010 [US1] 开发步骤与 quickstart
- [x] T011 [US1] 错误处理与诊断章节
- [x] T012 [US1] 里程碑 M1–M4 定义

**Checkpoint**: US1 完成 ✅

---

## Phase A4: User Story 2 - 测试验收指南 ✅

- [x] T013 [US2] 测试/验收用例矩阵
- [x] T014 [P] [US2] 里程碑验收清单

**Checkpoint**: US2 完成 ✅

---

## Phase A5: User Story 3 - 扩展指南 ✅

- [x] T015 [US3] 扩展路线与注意事项
- [x] T016 [P] [US3] 分发与贡献指南

**Checkpoint**: US3 完成 ✅

---

## Phase A6: Polish ✅

- [x] T017 对照 FR/SC 补齐缺口
- [x] T018 [P] 校对中文表述与交叉引用
- [x] T019 创建 `docs/testing-guide.md` 测试指南

**Checkpoint**: 文档交付完成 ✅

---

# PART B: 代码实施任务 (Implementation with TDD) 🚀

**策略**: 严格遵循 TDD，每个模块都是 Test First → Implement → Refactor

---

## Phase 0: 测试基础设施 🛠️

**Goal**: 搭建测试环境，让所有测试可运行

- [x] **T100** [Setup] 创建项目结构 `custom_components/ac_modbus/` 目录
- [x] **T101** [Setup] 创建 `tests/` 目录结构
  ```
  tests/
  ├── __init__.py
  ├── conftest.py
  ├── fixtures/
  └── (各模块测试文件待添加)
  ```
- [x] **T102** [Setup] 创建 `requirements_test.txt` 并安装依赖
  - pytest>=7.4.0
  - pytest-asyncio>=0.21.0
  - pytest-cov>=4.1.0
  - pytest-homeassistant-custom-component>=0.13.0
- [x] **T103** [Setup] 配置 `pytest.ini` 或 `pyproject.toml`
- [x] **T104** [Setup] 编写 `tests/conftest.py` 共享 fixtures
  - `mock_modbus_client` fixture
  - `mock_modbus_responses` fixture
  - `hass` fixture (from pytest-homeassistant)
- [x] **T105** [Setup] 验证测试环境：运行 `pytest --collect-only` 无错误

**Checkpoint**: 测试基础设施就绪，可以开始 TDD 🎯

---

## Phase 1 (M1): 骨架与基础 🏗️

**Goal**: 建立项目骨架，config flow 可用，能在 HA 中加载集成

### Cycle 1.1: Manifest & Constants

- [x] **T110** 🔴 [Test] 编写 `tests/test_manifest.py`
  - 测试 manifest.json 格式正确
  - 测试依赖声明完整
- [x] **T111** 🟢 [Impl] 创建 `manifest.json`
  - domain: ac_modbus
  - dependencies: homeassistant, pymodbus
  - config_flow: true
- [x] **T112** 🔴 [Test] 编写 `tests/test_const.py`
  - 测试常量定义完整（DOMAIN, 寄存器地址等）
- [x] **T113** 🟢 [Impl] 创建 `const.py` 定义所有常量
- [x] **T114** 🔵 [Refactor] 检查常量命名规范

### Cycle 1.2: Config Flow (TDD)

- [x] **T120** 🔴 [Test] 编写 `tests/test_config_flow.py` - 基础流程
  - `test_form_user_flow()` - UI 流程启动
  - `test_form_valid_input()` - 合法输入成功
  - `test_form_invalid_host()` - 无效 host 错误
  - `test_form_cannot_connect()` - 连接失败错误
- [x] **T121** 🟢 [Impl] 创建 `config_flow.py` - 让基础测试通过
  - ConfigFlow 类骨架
  - async_step_user() 基础实现
- [x] **T122** 🔴 [Test] 编写 `tests/test_config_flow.py` - 输入验证
  - `test_poll_interval_too_low()` - < 5s 拒绝
  - `test_poll_interval_equals_timeout()` - timeout >= poll 拒绝
  - `test_invalid_port()` - 端口范围验证
- [x] **T123** 🟢 [Impl] 完善 `config_flow.py` - 添加输入验证
- [x] **T124** 🔵 [Refactor] 提取验证逻辑到独立函数

### Cycle 1.3: Integration Setup

- [x] **T130** 🔴 [Test] 编写 `tests/test_init.py`
  - `test_setup_entry()` - 配置条目加载
  - `test_unload_entry()` - 清理资源
- [x] **T131** 🟢 [Impl] 创建 `__init__.py`
  - async_setup_entry() 骨架
  - async_unload_entry() 骨架
- [x] **T132** 🔵 [Refactor] 确保异步操作正确

**Checkpoint M1**: ✅ 集成可在 HA 中加载，config flow 可用

**M1 验收**:
```bash
# 运行测试
pytest tests/test_manifest.py tests/test_const.py tests/test_config_flow.py tests/test_init.py -v

# 覆盖率应 > 85%
pytest --cov=custom_components.ac_modbus --cov-report=term-missing
```

---

## Phase 2 (M2): 核心功能 - Hub & Coordinator 🔧

**Goal**: 实现 Modbus 通信和状态轮询，实体可用

### Cycle 2.1: Modbus Hub (TDD)

- [x] **T200** 🔴 [Test] 编写 `tests/test_hub.py` - 连接管理
  - `test_hub_connect_success()` - 成功连接
  - `test_hub_connect_failure()` - 连接失败
  - `test_hub_disconnect()` - 断开连接
  - `test_hub_is_connected()` - 状态检查
- [x] **T201** 🟢 [Impl] 创建 `hub.py` - ModbusHub 类骨架
  - `__init__()`, `connect()`, `disconnect()`, `is_connected`
- [x] **T202** 🔴 [Test] 编写 `tests/test_hub.py` - 读操作
  - `test_read_register_success()` - 成功读取
  - `test_read_register_timeout()` - 超时处理
  - `test_read_register_exception()` - 异常处理
  - `test_read_multiple_registers()` - 批量读取
- [x] **T203** 🟢 [Impl] 实现 `hub.py` - `read_register()` 方法
- [x] **T204** 🔴 [Test] 编写 `tests/test_hub.py` - 写操作
  - `test_write_register_success()` - 成功写入
  - `test_write_register_timeout()` - 超时
  - `test_write_with_verify_success()` - 回读成功
  - `test_write_verify_mismatch()` - 回读不匹配
  - `test_write_verify_expected_value()` - 自定义期望值
- [x] **T205** 🟢 [Impl] 实现 `hub.py` - `write_register()` + 回读验证
- [x] **T206** 🔴 [Test] 编写 `tests/test_hub.py` - 重连机制
  - `test_reconnect_on_connection_lost()` - 自动重连
  - `test_backoff_strategy()` - 回退策略
  - `test_reconnect_failure()` - 重连失败处理
- [x] **T207** 🟢 [Impl] 实现 `hub.py` - 重连与 backoff
- [x] **T208** 🔵 [Refactor] Hub 代码优化
  - 提取错误处理逻辑
  - 添加日志
  - 优化锁机制

### Cycle 2.2: DataUpdateCoordinator (TDD)

- [x] **T210** 🔴 [Test] 编写 `tests/test_coordinator.py` - 基础轮询
  - `test_coordinator_initialization()` - 初始化
  - `test_coordinator_first_refresh()` - 首次刷新
  - `test_coordinator_periodic_update()` - 周期更新
- [x] **T211** 🟢 [Impl] 创建 `coordinator.py` - Coordinator 类骨架
- [x] **T212** 🔴 [Test] 编写 `tests/test_coordinator.py` - 数据缓存
  - `test_data_caching_1033_1041()` - 缓存 1033/1041
  - `test_cache_invalidation()` - 缓存失效
  - `test_stale_data_handling()` - 过期数据处理
- [x] **T213** 🟢 [Impl] 实现 `coordinator.py` - 缓存逻辑
- [x] **T214** 🔴 [Test] 编写 `tests/test_coordinator.py` - 错误处理
  - `test_update_failed_marks_unavailable()` - 失败标记不可用
  - `test_update_success_restores_availability()` - 成功恢复可用
  - `test_consecutive_failures_backoff()` - 连续失败触发 backoff
- [x] **T215** 🟢 [Impl] 实现 `coordinator.py` - 错误处理与可用性
- [x] **T216** 🔵 [Refactor] Coordinator 优化
  - 性能优化（避免过度轮询）
  - 添加指标收集（last_update_time 等）

### Cycle 2.3: Switch Entity (1033) (TDD)

- [x] **T220** 🔴 [Test] 编写 `tests/test_switch.py` - 状态同步
  - `test_switch_state_on()` - 状态 ON
  - `test_switch_state_off()` - 状态 OFF
  - `test_switch_state_unavailable()` - 不可用状态
- [x] **T221** 🟢 [Impl] 创建 `switch.py` - PowerSwitchEntity 骨架
- [x] **T222** 🔴 [Test] 编写 `tests/test_switch.py` - 控制操作
  - `test_switch_turn_on()` - 打开
  - `test_switch_turn_off()` - 关闭
  - `test_switch_turn_on_verify_success()` - 回读成功
  - `test_switch_turn_on_verify_failure()` - 回读失败变不可用
- [x] **T223** 🟢 [Impl] 实现 `switch.py` - turn_on/turn_off + 回读
- [x] **T224** 🔴 [Test] 编写 `tests/test_switch.py` - 集成测试
  - `test_switch_with_coordinator()` - 与 coordinator 集成
  - `test_switch_update_from_coordinator()` - 从缓存更新
- [x] **T225** 🟢 [Impl] 完善 `switch.py` - coordinator 集成
- [x] **T226** 🔵 [Refactor] Switch 代码优化

### Cycle 2.4: Select/Climate Entity (1041) (TDD)

- [x] **T230** 🔴 [Test] 编写 `tests/test_select.py` - mode_map 映射
  - `test_select_default_mode_map()` - 默认映射
  - `test_select_custom_mode_map()` - 自定义映射
  - `test_select_invalid_mode_rejected()` - 无效模式拒绝
- [x] **T231** 🟢 [Impl] 创建 `select.py` - ModeSelectEntity 骨架
- [x] **T232** 🔴 [Test] 编写 `tests/test_select.py` - 模式切换
  - `test_select_option()` - 选择模式
  - `test_select_with_verify()` - 回读验证
  - `test_select_unmapped_value()` - 设备返回未映射值
- [x] **T233** 🟢 [Impl] 实现 `select.py` - 模式选择与映射
- [x] **T234** 🔵 [Refactor] Select 优化（或切换到 Climate 实体）

**Checkpoint M2**: ✅ Hub/Coordinator/Entities 可用，能读写 1033/1041

**M2 验收**:
```bash
# 运行核心模块测试
pytest tests/test_hub.py tests/test_coordinator.py tests/test_switch.py tests/test_select.py -v

# 覆盖率应 > 90%
pytest --cov=custom_components.ac_modbus.hub \
       --cov=custom_components.ac_modbus.coordinator \
       --cov=custom_components.ac_modbus.switch \
       --cov=custom_components.ac_modbus.select \
       --cov-report=term-missing --cov-fail-under=90
```

---

## Phase 3 (M3): 服务与诊断 🛠️

**Goal**: 实现自定义服务和诊断功能

### Cycle 3.1: write_register 服务 (TDD)

- [ ] **T300** 🔴 [Test] 编写 `tests/test_services.py` - write_register
  - `test_write_register_service_basic()` - 基本写入
  - `test_write_register_with_verify()` - 带验证
  - `test_write_register_custom_unit_id()` - 自定义 unit_id
  - `test_write_register_custom_timeout()` - 自定义超时
  - `test_write_register_expected_value()` - 自定义期望值
  - `test_write_register_returns_response()` - 返回结果
- [ ] **T301** 🟢 [Impl] 在 `__init__.py` 注册 write_register 服务
- [ ] **T302** 🟢 [Impl] 创建 `services.yaml` 定义服务 schema
- [ ] **T303** 🔵 [Refactor] 服务错误处理优化

### Cycle 3.2: scan_range 服务 (TDD)

- [ ] **T310** 🔴 [Test] 编写 `tests/test_services.py` - scan_range
  - `test_scan_range_basic()` - 基本扫描
  - `test_scan_range_emits_event()` - 触发事件
  - `test_scan_range_max_100_registers()` - 范围限制
  - `test_scan_range_step_parameter()` - 步长参数
  - `test_scan_range_timeout()` - 超时处理
- [ ] **T311** 🟢 [Impl] 实现 scan_range 服务
- [ ] **T312** 🔴 [Test] 编写 `tests/test_services.py` - 事件验证
  - `test_scan_result_event_payload()` - 事件内容验证
  - `test_scan_result_event_timing()` - 事件时机
- [ ] **T313** 🟢 [Impl] 实现事件发送逻辑
- [ ] **T314** 🔵 [Refactor] 扫描性能优化

### Cycle 3.3: 诊断 (TDD)

- [ ] **T320** 🔴 [Test] 编写 `tests/test_diagnostics.py` - 数据完整性
  - `test_diagnostics_connection_status()` - 连接状态
  - `test_diagnostics_error_info()` - 错误信息
  - `test_diagnostics_timing_info()` - 时间信息
  - `test_diagnostics_config_info()` - 配置信息
  - `test_diagnostics_recent_operations()` - 最近操作
- [ ] **T321** 🟢 [Impl] 创建 `diagnostics.py`
- [ ] **T322** 🔴 [Test] 编写 `tests/test_diagnostics.py` - 隐私保护
  - `test_diagnostics_no_sensitive_data()` - 无敏感信息泄露
- [ ] **T323** 🟢 [Impl] 实现隐私过滤
- [ ] **T324** 🔵 [Refactor] 诊断输出格式优化

**Checkpoint M3**: ✅ 服务可用，诊断完整

**M3 验收**:
```bash
# 运行服务和诊断测试
pytest tests/test_services.py tests/test_diagnostics.py -v

# 集成测试：手工调用服务
# 在实际 HA 中验证服务和诊断功能
```

---

## Phase 4 (M4): 硬化、国际化与扩展 🚀

**Goal**: 生产就绪，支持扩展

### Cycle 4.1: 错误恢复增强

- [ ] **T400** 🔴 [Test] 编写 `tests/test_error_recovery.py`
  - `test_partial_read_failure()` - 部分寄存器失败
  - `test_device_restart_recovery()` - 设备重启恢复
  - `test_network_intermittent()` - 网络间歇性故障
  - `test_concurrent_write_handling()` - 并发写入
- [ ] **T401** 🟢 [Impl] 增强错误恢复逻辑
- [ ] **T402** 🔵 [Refactor] 错误处理统一化

### Cycle 4.2: 性能测试

- [ ] **T410** 🔴 [Test] 编写 `tests/test_performance.py`
  - `test_readback_time_under_5s()` - 回读时间 <5s
  - `test_poll_interval_accuracy()` - 轮询间隔准确性
  - `test_memory_leak()` - 内存泄漏检测
  - `test_concurrent_requests()` - 并发性能
- [ ] **T411** 🟢 [Impl] 性能优化（如需要）
- [ ] **T412** 🔵 [Refactor] 性能调优

### Cycle 4.3: 国际化

- [ ] **T420** 🔴 [Test] 编写 `tests/test_translations.py`
  - `test_translation_keys_complete()` - 翻译键完整
  - `test_en_translation()` - 英文翻译
  - `test_zh_translation()` - 中文翻译
- [ ] **T421** 🟢 [Impl] 创建 `translations/en.json`
- [ ] **T422** 🟢 [Impl] 创建 `translations/zh-Hans.json`

### Cycle 4.4: 扩展钩子

- [ ] **T430** 🔴 [Test] 编写 `tests/test_extensibility.py`
  - `test_custom_mode_map_override()` - mode_map 自定义
  - `test_additional_register_support()` - 新增寄存器扩展点
  - `test_multi_unit_id()` - 多设备支持
- [ ] **T431** 🟢 [Impl] 实现扩展接口
- [ ] **T432** 🔵 [Refactor] 扩展性优化

### Cycle 4.5: HACS 准备

- [ ] **T440** 创建 `hacs.json` 元数据
- [ ] **T441** 创建 `README.md`（中英文）
- [ ] **T442** 创建 `CHANGELOG.md`
- [ ] **T443** 添加 `.github/workflows/validate.yml` (HACS 校验)

**Checkpoint M4**: ✅ 生产就绪，支持 HACS 分发

**M4 验收**:
```bash
# 运行完整测试套件
pytest -v --cov=custom_components.ac_modbus --cov-report=html --cov-fail-under=85

# 性能测试
pytest tests/test_performance.py -v

# HACS 校验
hacs validate

# 手工 E2E 测试清单（docs/testing-guide.md）
```

---

## Phase 5: CI/CD 与发布 🎉

### CI/CD 设置

- [ ] **T500** 创建 `.github/workflows/test.yml` - 自动测试
  - 矩阵：Python 3.12
  - 运行完整测试套件
  - 上传覆盖率到 Codecov
- [ ] **T501** 创建 `.github/workflows/lint.yml` - 代码检查
  - ruff / pylint
  - black 格式检查
  - isort import 排序
- [ ] **T502** 创建 `.github/workflows/release.yml` - 发布流程
  - 版本标签触发
  - 打包验证
  - GitHub Release

### 发布准备

- [ ] **T510** 编写完整 README（安装、配置、使用、故障排查）
- [ ] **T511** 录制演示视频/GIF
- [ ] **T512** 准备社区发布帖（HACS、HA 论坛）
- [ ] **T513** 首次发布 v1.0.0

---

## 依赖关系图

```
Phase 0 (基础设施)
    ↓
Phase 1 (M1: 骨架)
    ↓
Phase 2 (M2: 核心功能)
    ├─→ Cycle 2.1 (Hub) ────────┐
    ├─→ Cycle 2.2 (Coordinator) ─┤
    ├─→ Cycle 2.3 (Switch)       ├─→ Phase 3 (M3: 服务/诊断)
    └─→ Cycle 2.4 (Select)  ─────┘         ↓
                                     Phase 4 (M4: 硬化)
                                            ↓
                                     Phase 5 (发布)
```

---

## TDD 执行示例

### 示例：实现 Hub.read_register()

```bash
# 🔴 RED: 先写测试
vim tests/test_hub.py
# 编写 test_read_register_success()
pytest tests/test_hub.py::test_read_register_success  # 失败 ❌

# 🟢 GREEN: 最小实现
vim custom_components/ac_modbus/hub.py
# 实现 read_register() 基本功能
pytest tests/test_hub.py::test_read_register_success  # 通过 ✅

# 继续添加测试
vim tests/test_hub.py
# 编写 test_read_register_timeout()
pytest tests/test_hub.py::test_read_register_timeout  # 失败 ❌

# 🟢 GREEN: 添加超时处理
vim custom_components/ac_modbus/hub.py
pytest tests/test_hub.py::test_read_register_timeout  # 通过 ✅

# 🔵 REFACTOR: 重构
vim custom_components/ac_modbus/hub.py
# 提取错误处理、优化日志
pytest tests/test_hub.py -v  # 所有测试仍通过 ✅
```

---

## 测试覆盖目标

| 模块 | 目标覆盖率 | 当前状态 |
|------|-----------|---------|
| hub.py | 90%+ | - |
| coordinator.py | 90%+ | - |
| config_flow.py | 95%+ | - |
| switch.py | 85%+ | - |
| select.py | 85%+ | - |
| services (in __init__.py) | 90%+ | - |
| diagnostics.py | 75%+ | - |
| **整体** | **85%+** | - |

---

## 快速命令参考

```bash
# 运行所有测试
pytest -v

# 运行特定阶段测试
pytest tests/test_hub.py tests/test_coordinator.py -v

# 带覆盖率
pytest --cov=custom_components.ac_modbus --cov-report=term-missing

# 只运行失败的
pytest --lf

# 监听模式（需要 pytest-watch）
ptw

# 并行运行（需要 pytest-xdist）
pytest -n auto

# 生成 HTML 覆盖率报告
pytest --cov=custom_components.ac_modbus --cov-report=html
open htmlcov/index.html
```

---

## 注意事项

1. **严格遵守 TDD**：不写测试前不写实现代码
2. **小步快跑**：每次只让一个测试通过，避免过度实现
3. **频繁提交**：每完成一个 cycle 就提交（保持绿色状态）
4. **持续集成**：每次提交触发 CI，确保测试通过
5. **代码审查**：每个 Phase 完成后进行 review
6. **文档同步**：代码变更后及时更新文档

---

## 里程碑验收标准

### M1 验收 ✅
- [ ] 所有 Phase 1 测试通过（覆盖率 > 85%）
- [ ] 集成可在 HA 中通过 UI 添加
- [ ] Config flow 输入验证正确
- [ ] 无明显错误日志

### M2 验收 ✅
- [ ] 所有 Phase 2 测试通过（覆盖率 > 90%）
- [ ] 开关实体可见且可控制
- [ ] 模式选择实体可见且可切换
- [ ] 轮询正常工作（10s 间隔）
- [ ] 写操作后回读验证生效
- [ ] 连接失败时实体标记不可用

### M3 验收 ✅
- [ ] 所有 Phase 3 测试通过（覆盖率 > 85%）
- [ ] write_register 服务可调用
- [ ] scan_range 服务触发事件
- [ ] 诊断页面显示完整信息
- [ ] 服务返回正确结果

### M4 验收 ✅
- [ ] 所有 Phase 4 测试通过（覆盖率 > 85%）
- [ ] 性能测试达标（回读 <5s）
- [ ] 国际化完整（中英文）
- [ ] 无内存泄漏
- [ ] HACS 校验通过
- [ ] README 和文档完整

---

**开始 TDD 之旅！每一个测试都是对质量的承诺。** 🎯
