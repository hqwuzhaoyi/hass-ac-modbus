# Home Assistant 自定义集成方案（纯 HA 版）

**分支**：`002-ha-integration-plan`  
**参考**：`specs/002-ha-integration-plan/spec.md` | `specs/002-ha-integration-plan/plan.md` | `specs/002-ha-integration-plan/research.md` | `specs/002-ha-integration-plan/contracts/services-openapi.yaml` | `specs/002-ha-integration-plan/tasks.md`

## 目标与范围
- 纯 Home Assistant 自定义集成 `ac_modbus`，不依赖任何 Node 进程。
- 首版覆盖寄存器：1033 总开关（开关实体）、1041 模式寄存器（select 或 climate 实体）。
- 文档以中文提供，可直接指导开发、测试、验收，无需额外资料。
- 路径：`docs/ha-custom-integration-plan.md`（本文件）。

## 技术栈与环境前提
- 语言/版本：Python 3.12；Home Assistant 2024.12+（Core/Supervised/Container）。
- 依赖：Home Assistant 自定义集成框架、`pymodbus` async client、`DataUpdateCoordinator`。
- 运行：HA devcontainer 或本地 HA Core 开发环境；Modbus TCP 端可达（host/port/unit_id 已知）。
- 测试：pytest + `pytest-homeassistant-custom-component`；HA 手工验证用于冒烟。

## 目录结构（建议）
```
custom_components/ac_modbus/
├── __init__.py          # 建立连接、注册 coordinator、清理资源
├── manifest.json        # 域名、依赖、iot_class、本地轮询
├── config_flow.py       # UI 配置/选项流：host/port/unit_id/poll_interval/mode_map
├── const.py             # 常量、域名、默认值、寄存器映射
├── coordinator.py       # DataUpdateCoordinator 轮询 1033/1041
├── hub.py               # Modbus 客户端封装（连接、读写、回读验证、重连/backoff）
├── switch.py            # 1033 开关实体
├── select.py 或 climate.py # 1041 模式实体
├── services.yaml        # 自定义服务声明（write_register/scan_range）
├── diagnostics.py       # 诊断输出（状态/错误/最近读写）
└── translations/        # 本地化字符串
```

## 全局约束与默认值
- 轮询默认 10s，最小 5s；避免设备/总线压力。
- 写入后回读应在 <5s 内完成；否则标记实体不可用。
- timeout < poll_interval；推荐 timeout 3s–4s。
- 默认 mode_map：`{0: "auto", 1: "cool", 2: "dry", 3: "fan_only", 4: "heat"}`；可配置覆盖。
- 强制异步 I/O，禁止阻塞事件循环；使用重连、回退与抖动策略。
- 写入必须回读校验；回读不一致或异常时标记不可用并记录诊断。

## 核心设计
- **Hub（hub.py）**：基于 `pymodbus` async TCP；职责：连接/重连、读写、回读验证、错误聚合、可用性信号。对外暴露 `read_register`, `write_register`, `verify_register`。
- **Coordinator（coordinator.py）**：`DataUpdateCoordinator` 周期读取 1033/1041，缓存状态，传播可用性；失败触发 backoff/jitter。
- **配置项**：`host`，`port`(默认 502)，`unit_id`(默认 1)，`poll_interval`(默认 10s，最小 5s)，`timeout`(<poll，推荐 3–4s)，`mode_map`(可选自定义)。
- **实体**：
  - 1033 开关：0/1 写入并回读；失败 → `available=False`。
  - 1041 模式：使用 `mode_map` 进行编码/解码；只接受映射内值；失败/不匹配 → `available=False`。
- **服务**：见下节；所有写操作统一经过 hub 进行回读校验和错误处理。
- **诊断**：包含连接状态、last_error、last_error_at、last_success_at、poll_interval、host/port/unit_id、recent_reads(1033/1041)、recent_write(register/value/verified)。

## 服务契约（参考 contracts/services-openapi.yaml）
- `ac_modbus.write_register`
  - 参数：`register`(int, 必填)、`value`(int, 必填)、`unit_id?`、`verify?`(默认 true)、`expected?`(默认 value)、`timeout?`(秒，< poll)。
  - 行为：写入后回读；返回 `{register,value,verified,readback?,error?,unit_id}`；`verified=false` 或异常时记录诊断并关联实体不可用。
- `ac_modbus.scan_range`
  - 参数：`start`(int, 必填)、`end`(int, 必填，跨度 ≤100)、`step?`(默认 1)、`unit_id?`、`timeout?`。
  - 行为：扫描完成后发送事件 `ac_modbus_scan_result`（payload 含寄存器和值）；适合开发者工具消费。

## 开发步骤与 Quickstart
1. 创建目录 `custom_components/ac_modbus/`，填充上述文件骨架。
2. `manifest.json`：声明依赖 `homeassistant>=2024.12.0`、`pymodbus`；`config_flow: true`；设置 `iot_class: local_polling`。
3. `hub.py`：实现 async 连接/重连、读写、回读；超时、锁与 backoff/jitter；集中错误记录。
4. `coordinator.py`：每 10s 轮询 1033/1041（配置可调，≥5s），更新缓存；失败时增加 backoff，通知实体不可用。
5. 实体：`switch.py` 映射 1033，`select.py/climate.py` 映射 1041；使用 `mode_map` 进行编码/解码；写后回读。
6. 服务：在 `services.yaml` 注册；在 `__init__.py` 中注册处理函数，调用 hub 读写/扫描并发事件。
7. 诊断：`diagnostics.py` 输出连接状态、最近错误时间、最近成功读时间、poll 间隔、host/port/unit_id、最近 1033/1041 读数、最近写入结果。
8. 测试：`pip install pytest pytest-homeassistant-custom-component`；编写集成/单元测试覆盖 config_flow、轮询/回读、服务调用、诊断可用性；`pytest -q` 运行。
9. 手工验证：拷贝到 `<config>/custom_components`，HA 重启；UI 添加配置（host/port/unit_id、poll_interval≥5s）；确认实体出现且每 10s 更新；调用服务写 1033/1041 并检查状态、事件与诊断；断开设备验证不可用标记与错误可见。

## 错误处理与诊断
- 连接失败或读写异常：记录到诊断；coordinator backoff，实体 `available=False`。
- 写后回读不一致：返回 `verified=false`，记录错误，相关实体不可用。
- 诊断字段：`connected`，`last_error`，`last_error_at`，`last_success_at`，`poll_interval`，`host`，`port`，`unit_id`，`recent_reads`(1033/1041)，`recent_write`(register/value/verified)。

## 里程碑与验收（M1–M4）
- **M1 骨架**：目录/manifest/config_flow/hub/coordinator 桩；实体可见；配置保存生效。验收：HA 能加载集成并显示实体（可不可用皆可）。
- **M2 读写/轮询**：1033/1041 轮询与回读工作；失败时实体不可用；默认 poll 10s；回读 <5s。验收：写 1033/1041 后状态一致；断链后实体不可用且有诊断。
- **M3 服务/诊断**：`write_register` 与 `scan_range` 可用，事件 `ac_modbus_scan_result` 输出；诊断字段完整。验收：调用服务返回预期，事件可见，诊断展示最近读写/错误。
- **M4 硬化/扩展**：backoff/jitter 完善，mode_map 自定义、i18n、HACS/分发准备、额外寄存器钩子。验收：可配置 mode_map；新增寄存器路径明确；分发元数据草案。

## 测试/验收用例（覆盖配置、轮询、写回读、错误/诊断、服务）
- 配置：UI 添加/编辑/删除；非法 host/port/unit_id/poll_interval(<5s) 拒绝。
- 轮询：默认 10s 轮询，调低到 5s 不报错；缓存更新生效。
- 写回读：写 1033=1/0，1041=有效模式；回读匹配；错误路径标记不可用。
- 错误展示：断开设备或超时，诊断显示 last_error/时间，实体不可用。
- 服务：`write_register` 成功/失败、verify=false 情形；`scan_range` 触发事件并包含寄存器/数值。
- 里程碑对照：按 M1–M4 检查各项是否满足。

## 注意事项
- 严格异步：避免阻塞调用；I/O 包装在 hub 内，实体通过 coordinator 缓存取值。
- 轮询下限：5s；过低会增加 Modbus 设备压力。
- 回读必需：所有写操作需回读验证，保证 UI 状态一致。
- 国际化：`translations/zh-Hans.json`，可补英文。

## 后续扩展思路
- 新寄存器：温度/风速/除湿等级；通过 `mode_map` 或新增映射配置；保持回读验证。
- 扫描增强：支持可选步长、过滤；事件 payload 增强（时间戳、unit_id）。
- 节流与多设备：为多 unit_id 添加实例化策略与并发锁。
- HACS 分发：补充 `hacs.json`、版本策略、变更日志；CI 打包校验。
- 诊断扩展：增加最近 N 条错误/读写历史（注意隐私/容量）。
