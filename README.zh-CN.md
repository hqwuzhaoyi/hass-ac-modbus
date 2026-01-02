# AC Modbus - Home Assistant 自定义集成

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://github.com/hacs/integration)
[![GitHub Release](https://img.shields.io/github/v/release/hqwuzhaoyi/hass-ac-modbus)](https://github.com/hqwuzhaoyi/hass-ac-modbus/releases)
[![License](https://img.shields.io/github/license/hqwuzhaoyi/hass-ac-modbus)](LICENSE)

[English](README.md) | 简体中文

通过 Modbus TCP 协议控制空调的 Home Assistant 自定义集成。

## 功能特性

- 通过 Modbus 寄存器控制空调电源开关
- 选择空调运行模式（制冷、制热、通风、除湿）
- 可配置轮询间隔的自动数据更新
- 诊断工具用于调试
- 自定义服务支持高级 Modbus 操作
- 多语言支持（英文、中文）

## 支持的寄存器

| 寄存器 | 功能 | 值 | 操作限制 |
|--------|------|-----|----------|
| 1033 | 电源 | 0=关闭, 1=开启 | - |
| 1034 | 居家/离家 | 0=离家, 1=居家 | 需要电源开启 |
| 1041 | 模式 | 1=制冷, 2=制热, 3=通风, 4=除湿 | 需要电源关闭 |
| 1168 | 加湿 | 0=关闭, 1=开启 | 需要电源开启 |

## 安装方法

### HACS 安装（推荐）

1. 确保你的 Home Assistant 已安装 [HACS](https://hacs.xyz/)

2. 在 HACS 中添加自定义仓库：
   - 打开 Home Assistant 中的 HACS
   - 点击右上角的三个点
   - 选择 **自定义存储库**
   - 添加仓库 URL：`https://github.com/hqwuzhaoyi/hass-ac-modbus`
   - 类别选择 **Integration**
   - 点击 **添加**

3. 在 HACS 中搜索 "AC Modbus" 并安装

4. 重启 Home Assistant

5. 前往 **设置** > **设备与服务** > **添加集成**，搜索 "AC Modbus"

### 手动安装

1. 从 [releases 页面](https://github.com/hqwuzhaoyi/hass-ac-modbus/releases) 下载最新版本

2. 解压并将 `custom_components/ac_modbus` 文件夹复制到 Home Assistant 的 `custom_components` 目录：
   ```
   <config>/custom_components/ac_modbus/
   ```

3. 重启 Home Assistant

4. 前往 **设置** > **设备与服务** > **添加集成**，搜索 "AC Modbus"

## 配置说明

### 通过 UI 配置

1. 前往 **设置** > **设备与服务**
2. 点击 **添加集成**
3. 搜索 "AC Modbus"
4. 输入配置信息：
   - **主机地址**：Modbus 设备的 IP 地址（例如 `192.168.1.100`）
   - **端口**：Modbus TCP 端口（默认：`502`）
   - **从站 ID**：Modbus 从站单元 ID（默认：`1`）
   - **轮询间隔**：数据刷新间隔，单位秒（默认：`10`，最小：`5`）

## 创建的实体

配置成功后，将创建以下实体：

| 实体 | 类型 | 描述 | 操作限制 |
|------|------|------|----------|
| `switch.ac_modbus_power` | 开关 | 控制空调电源开关 | - |
| `switch.ac_modbus_home_mode` | 开关 | 控制居家/离家模式 | 需要电源开启 |
| `switch.ac_modbus_humidify` | 开关 | 控制加湿功能 | 需要电源开启 |
| `select.ac_modbus_mode` | 选择器 | 选择空调运行模式 | 需要电源关闭 |

## 服务

### `ac_modbus.write_register`

向指定的 Modbus 寄存器写入值。

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `register` | int | 是 | 寄存器地址 |
| `value` | int | 是 | 要写入的值 |

示例：
```yaml
service: ac_modbus.write_register
data:
  register: 1033
  value: 1
```

### `ac_modbus.scan_range`

扫描指定范围的 Modbus 寄存器，用于调试。

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `start` | int | 是 | 起始寄存器地址 |
| `end` | int | 是 | 结束寄存器地址 |
| `step` | int | 否 | 步长（默认：1） |

示例：
```yaml
service: ac_modbus.scan_range
data:
  start: 1030
  end: 1050
  step: 1
```

## 诊断信息

该集成通过 Home Assistant 的诊断功能提供诊断信息：
- 连接状态
- 寄存器值
- 配置详情
- 错误计数

## 故障排除

### 连接问题

1. 验证 Modbus 设备是否可达：
   ```bash
   ping <设备IP>
   ```

2. 检查端口 502 是否可访问：
   ```bash
   nc -zv <设备IP> 502
   ```

3. 确保没有其他应用连接到 Modbus 设备（许多设备只支持单一连接）

### 模式不更新

如果模式选择器没有显示正确的值：
1. 前往 **设置** > **设备与服务**
2. 找到 AC Modbus 集成
3. 点击三个点并选择 **重新加载**

### 启用调试日志

在 `configuration.yaml` 中添加以下内容：
```yaml
logger:
  default: warning
  logs:
    custom_components.ac_modbus: debug
```

## 系统要求

- Home Assistant 2024.12.0 或更新版本
- Python 包：`pymodbus>=3.6.0`（自动安装）

## 开发

### 运行测试

```bash
# 创建虚拟环境
python -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r requirements_test.txt

# 运行测试
pytest
```

### 项目结构

```
custom_components/ac_modbus/
├── __init__.py          # 集成入口
├── config_flow.py       # UI 配置流程
├── const.py             # 常量和默认值
├── coordinator.py       # 数据更新协调器
├── diagnostics.py       # 诊断数据提供者
├── hub.py               # Modbus 通信中心
├── manifest.json        # 集成清单
├── select.py            # 模式选择实体
├── services.py          # 自定义服务
├── services.yaml        # 服务定义
├── switch.py            # 电源开关实体
└── translations/        # 本地化文件
    ├── en.json
    └── zh-Hans.json
```

---

# Web 控制面板（可选）

本仓库还包含一个 Next.js Web 应用，用于直接 Modbus 控制和调试。

## Web 功能

- 实时 WebSocket 连接监控
- 手动寄存器读写界面
- 控制面板：
  - 电源开关 (1033)
  - 模式选择 (1041) - 需要电源关闭
  - 居家/离家模式 (1034) - 需要电源开启
  - 加湿开关 (1168) - 需要电源开启
- 智能约束验证（根据电源状态禁用控件）

## 快速开始（Web 面板）

```bash
# 安装依赖
npm install

# 启动 WebSocket 服务器（1033/1041 手动读写）
npm run ws:dev

# 启动 Next.js 前端
npm run dev:web
```

访问 http://localhost:3002 打开 Web 界面

## 贡献

欢迎提交 Pull Request！

## 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 致谢

- [Home Assistant](https://www.home-assistant.io/) - 开源智能家居平台
- [pymodbus](https://github.com/pymodbus-dev/pymodbus) - Python Modbus 协议实现
- [HACS](https://hacs.xyz/) - Home Assistant 社区商店
