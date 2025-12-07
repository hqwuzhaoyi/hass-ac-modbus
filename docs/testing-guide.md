# Home Assistant 自定义集成测试指南

**项目**: ac_modbus
**参考**: [HA Developer Docs - Testing](https://developers.home-assistant.io/docs/development_testing/) | [pytest-homeassistant-custom-component](https://github.com/MatthewFlamm/pytest-homeassistant-custom-component)

---

## 🎯 测试策略概览

针对 `ac_modbus` 集成，我们需要覆盖以下层次：

| 测试类型 | 工具 | 覆盖范围 | 执行频率 |
|---------|------|----------|---------|
| 单元测试 | pytest | Hub, Coordinator 核心逻辑 | 每次提交 |
| 集成测试 | pytest + HA fixtures | Config Flow, 实体, 服务 | 每次提交 |
| 手工测试 | 真实 HA + Modbus 设备 | E2E 验证, UI 交互 | 发布前 |

---

## 📦 环境搭建

### 1. 安装测试依赖

```bash
# 创建测试依赖文件
cat > requirements_test.txt <<EOF
pytest>=7.4.0
pytest-asyncio>=0.21.0
pytest-cov>=4.1.0
pytest-homeassistant-custom-component>=0.13.0
homeassistant>=2024.12.0
pymodbus>=3.6.0
EOF

# 安装依赖
pip install -r requirements_test.txt
```

### 2. 配置 pytest

创建 `pytest.ini` 或 `pyproject.toml`:

```ini
# pytest.ini
[pytest]
asyncio_mode = auto
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
```

或在 `pyproject.toml` 中:

```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

### 3. 目录结构

```
custom_components/ac_modbus/
├── __init__.py
├── hub.py
├── coordinator.py
├── switch.py
├── select.py
├── services.yaml
└── ...

tests/
├── __init__.py
├── conftest.py              # 共享 fixtures
├── test_config_flow.py      # 配置流测试
├── test_hub.py              # Hub 单元测试
├── test_coordinator.py      # Coordinator 单元测试
├── test_switch.py           # 开关实体测试
├── test_select.py           # 模式选择测试
├── test_services.py         # 服务测试
├── test_diagnostics.py      # 诊断测试
└── fixtures/                # 测试数据
    └── modbus_responses.json
```

---

## ✅ 测试示例

### 示例 1: Hub 单元测试 (`tests/test_hub.py`)

```python
"""Test ac_modbus Hub."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from pymodbus.exceptions import ModbusException

from custom_components.ac_modbus.hub import ModbusHub
from custom_components.ac_modbus.const import DOMAIN

@pytest.fixture
async def mock_modbus_client():
    """Mock pymodbus client."""
    with patch("custom_components.ac_modbus.hub.AsyncModbusTcpClient") as mock_client:
        client_instance = AsyncMock()
        client_instance.connect = AsyncMock(return_value=True)
        client_instance.connected = True
        client_instance.read_holding_registers = AsyncMock()
        client_instance.write_register = AsyncMock()
        mock_client.return_value = client_instance
        yield client_instance


@pytest.mark.asyncio
async def test_hub_connect_success(mock_modbus_client):
    """Test successful hub connection."""
    hub = ModbusHub("192.168.1.100", 502, 1)

    result = await hub.connect()

    assert result is True
    assert hub.is_connected is True
    mock_modbus_client.connect.assert_called_once()


@pytest.mark.asyncio
async def test_read_register_success(mock_modbus_client):
    """Test successful register read."""
    # Arrange
    mock_response = MagicMock()
    mock_response.registers = [1]  # 寄存器 1033 = 1 (开启)
    mock_modbus_client.read_holding_registers.return_value = mock_response

    hub = ModbusHub("192.168.1.100", 502, 1)
    await hub.connect()

    # Act
    value = await hub.read_register(1033)

    # Assert
    assert value == 1
    mock_modbus_client.read_holding_registers.assert_called_with(1033, 1, slave=1)


@pytest.mark.asyncio
async def test_write_with_verify_success(mock_modbus_client):
    """Test write with successful verification."""
    # Arrange: write returns success, readback returns same value
    mock_modbus_client.write_register.return_value = MagicMock(isError=lambda: False)

    mock_read_response = MagicMock()
    mock_read_response.registers = [1]
    mock_modbus_client.read_holding_registers.return_value = mock_read_response

    hub = ModbusHub("192.168.1.100", 502, 1)
    await hub.connect()

    # Act
    result = await hub.write_register(1033, 1, verify=True)

    # Assert
    assert result["verified"] is True
    assert result["value"] == 1
    assert result["readback"] == 1


@pytest.mark.asyncio
async def test_write_verify_mismatch(mock_modbus_client):
    """Test write verification fails when readback doesn't match."""
    # Arrange: write succeeds but readback differs
    mock_modbus_client.write_register.return_value = MagicMock(isError=lambda: False)

    mock_read_response = MagicMock()
    mock_read_response.registers = [0]  # 期望 1 但读到 0
    mock_modbus_client.read_holding_registers.return_value = mock_read_response

    hub = ModbusHub("192.168.1.100", 502, 1)
    await hub.connect()

    # Act
    result = await hub.write_register(1033, 1, verify=True, expected=1)

    # Assert
    assert result["verified"] is False
    assert "error" in result
    assert result["readback"] == 0


@pytest.mark.asyncio
async def test_reconnect_on_failure(mock_modbus_client):
    """Test automatic reconnection on connection loss."""
    hub = ModbusHub("192.168.1.100", 502, 1)
    await hub.connect()

    # Simulate connection loss
    mock_modbus_client.connected = False
    mock_modbus_client.read_holding_registers.side_effect = ModbusException("Connection lost")

    # First read should fail and trigger reconnect
    with pytest.raises(ModbusException):
        await hub.read_register(1033)

    # Hub should attempt reconnect
    assert hub.is_connected is False
```

---

### 示例 2: Config Flow 测试 (`tests/test_config_flow.py`)

```python
"""Test ac_modbus config flow."""
import pytest
from unittest.mock import AsyncMock, patch

from homeassistant import config_entries, data_entry_flow
from homeassistant.core import HomeAssistant

from custom_components.ac_modbus.const import DOMAIN

@pytest.fixture(autouse=True)
def enable_custom_integrations(hass):
    """Enable custom integrations (required for HA >= 2021.6.0)."""
    hass.data.setdefault("custom_components", {})


async def test_form_user_flow(hass: HomeAssistant):
    """Test user-initiated config flow."""
    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )

    assert result["type"] == data_entry_flow.RESULT_TYPE_FORM
    assert result["step_id"] == "user"


async def test_form_valid_input(hass: HomeAssistant):
    """Test config flow with valid input."""
    with patch(
        "custom_components.ac_modbus.hub.ModbusHub.connect",
        return_value=True,
    ):
        result = await hass.config_entries.flow.async_init(
            DOMAIN, context={"source": config_entries.SOURCE_USER}
        )

        result2 = await hass.config_entries.flow.async_configure(
            result["flow_id"],
            {
                "host": "192.168.1.100",
                "port": 502,
                "unit_id": 1,
                "poll_interval": 10,
            },
        )

        assert result2["type"] == data_entry_flow.RESULT_TYPE_CREATE_ENTRY
        assert result2["title"] == "192.168.1.100"
        assert result2["data"]["host"] == "192.168.1.100"


async def test_form_invalid_host(hass: HomeAssistant):
    """Test config flow with invalid host."""
    with patch(
        "custom_components.ac_modbus.hub.ModbusHub.connect",
        side_effect=Exception("Connection failed"),
    ):
        result = await hass.config_entries.flow.async_init(
            DOMAIN, context={"source": config_entries.SOURCE_USER}
        )

        result2 = await hass.config_entries.flow.async_configure(
            result["flow_id"],
            {
                "host": "invalid.host",
                "port": 502,
                "unit_id": 1,
            },
        )

        assert result2["type"] == data_entry_flow.RESULT_TYPE_FORM
        assert result2["errors"] == {"base": "cannot_connect"}


async def test_form_poll_interval_too_low(hass: HomeAssistant):
    """Test config flow rejects poll interval < 5s."""
    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )

    result2 = await hass.config_entries.flow.async_configure(
        result["flow_id"],
        {
            "host": "192.168.1.100",
            "port": 502,
            "unit_id": 1,
            "poll_interval": 3,  # < 5s minimum
        },
    )

    assert result2["errors"] == {"poll_interval": "poll_too_fast"}
```

---

### 示例 3: 实体测试 (`tests/test_switch.py`)

```python
"""Test ac_modbus switch entity."""
import pytest
from unittest.mock import AsyncMock, MagicMock

from homeassistant.core import HomeAssistant
from homeassistant.components.switch import DOMAIN as SWITCH_DOMAIN
from homeassistant.const import STATE_ON, STATE_OFF, STATE_UNAVAILABLE

from custom_components.ac_modbus.const import DOMAIN


@pytest.fixture
async def setup_integration(hass: HomeAssistant):
    """Set up ac_modbus integration."""
    entry = MockConfigEntry(
        domain=DOMAIN,
        data={
            "host": "192.168.1.100",
            "port": 502,
            "unit_id": 1,
            "poll_interval": 10,
        },
    )
    entry.add_to_hass(hass)

    with patch("custom_components.ac_modbus.hub.ModbusHub.connect", return_value=True):
        await hass.config_entries.async_setup(entry.entry_id)
        await hass.async_block_till_done()

    return entry


async def test_switch_state_on(hass: HomeAssistant, setup_integration):
    """Test switch entity reports ON when register is 1."""
    with patch(
        "custom_components.ac_modbus.hub.ModbusHub.read_register",
        return_value=1,
    ):
        # Trigger coordinator update
        await hass.helpers.entity_component.async_update_entity("switch.ac_modbus_power")

        state = hass.states.get("switch.ac_modbus_power")
        assert state.state == STATE_ON


async def test_switch_turn_on(hass: HomeAssistant, setup_integration):
    """Test turning switch on."""
    with patch(
        "custom_components.ac_modbus.hub.ModbusHub.write_register",
        return_value={"verified": True, "value": 1, "readback": 1},
    ):
        await hass.services.async_call(
            SWITCH_DOMAIN,
            "turn_on",
            {"entity_id": "switch.ac_modbus_power"},
            blocking=True,
        )

        state = hass.states.get("switch.ac_modbus_power")
        assert state.state == STATE_ON


async def test_switch_unavailable_on_error(hass: HomeAssistant, setup_integration):
    """Test switch becomes unavailable on communication error."""
    with patch(
        "custom_components.ac_modbus.hub.ModbusHub.read_register",
        side_effect=Exception("Modbus error"),
    ):
        await hass.helpers.entity_component.async_update_entity("switch.ac_modbus_power")

        state = hass.states.get("switch.ac_modbus_power")
        assert state.state == STATE_UNAVAILABLE
```

---

### 示例 4: 服务测试 (`tests/test_services.py`)

```python
"""Test ac_modbus services."""
import pytest
from unittest.mock import AsyncMock, patch

from homeassistant.core import HomeAssistant
from custom_components.ac_modbus.const import DOMAIN, SERVICE_WRITE_REGISTER


async def test_write_register_service(hass: HomeAssistant, setup_integration):
    """Test write_register service."""
    with patch(
        "custom_components.ac_modbus.hub.ModbusHub.write_register",
        return_value={"verified": True, "value": 2, "readback": 2},
    ) as mock_write:
        await hass.services.async_call(
            DOMAIN,
            SERVICE_WRITE_REGISTER,
            {
                "register": 1041,
                "value": 2,
                "verify": True,
            },
            blocking=True,
        )

        mock_write.assert_called_once_with(1041, 2, verify=True, expected=None, timeout=None)


async def test_scan_range_service_emits_event(hass: HomeAssistant, setup_integration):
    """Test scan_range service emits event."""
    events = []

    async def capture_event(event):
        events.append(event)

    hass.bus.async_listen("ac_modbus_scan_result", capture_event)

    with patch(
        "custom_components.ac_modbus.hub.ModbusHub.scan_range",
        return_value={1033: 1, 1034: 25, 1035: 0},
    ):
        await hass.services.async_call(
            DOMAIN,
            "scan_range",
            {"start": 1033, "end": 1035},
            blocking=True,
        )

        await hass.async_block_till_done()

        assert len(events) == 1
        assert events[0].data["registers"] == {1033: 1, 1034: 25, 1035: 0}
```

---

## 🏃 运行测试

### 基本命令

```bash
# 运行所有测试
pytest

# 带覆盖率报告
pytest --cov=custom_components.ac_modbus --cov-report=term-missing

# 运行特定测试文件
pytest tests/test_hub.py -v

# 运行特定测试函数
pytest tests/test_hub.py::test_hub_connect_success -v

# 显示详细输出
pytest -vv -s

# 只运行失败的测试
pytest --lf

# 并行运行（需要 pytest-xdist）
pytest -n auto
```

### 持续集成 (GitHub Actions)

创建 `.github/workflows/test.yml`:

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ["3.12"]

    steps:
    - uses: actions/checkout@v4

    - name: Set up Python ${{ matrix.python-version }}
      uses: actions/setup-python@v5
      with:
        python-version: ${{ matrix.python-version }}

    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -r requirements_test.txt

    - name: Run tests with coverage
      run: |
        pytest --cov=custom_components.ac_modbus \
               --cov-report=xml \
               --cov-report=term-missing

    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        files: ./coverage.xml
```

---

## 🖥️ 手工测试

### 1. 使用 HA Devcontainer

```bash
# 克隆 HA Core
git clone https://github.com/home-assistant/core.git
cd core

# 在 VS Code 中打开并启动 Devcontainer
# 或手动使用 Docker:
docker run -it --rm \
  -v $(pwd):/workspaces/core \
  -v /path/to/your/ac_modbus:/workspaces/core/config/custom_components/ac_modbus \
  ghcr.io/home-assistant/devcontainer:dev
```

### 2. 本地 HA 实例测试

```bash
# 安装 HA
pip install homeassistant

# 创建配置目录
mkdir -p ~/.homeassistant/custom_components
ln -s /path/to/ac_modbus ~/.homeassistant/custom_components/

# 启动 HA
hass
```

### 3. 手工验证清单

- [ ] UI 配置流程能正常添加集成
- [ ] 实体在前端正确显示
- [ ] 开关/模式切换实时生效
- [ ] 服务调用返回预期结果
- [ ] 诊断页面显示正确信息
- [ ] 断开 Modbus 连接后实体变为不可用
- [ ] 重连后实体恢复可用
- [ ] 日志中无异常错误

---

## 📊 测试覆盖目标

| 模块 | 目标覆盖率 | 关键测试点 |
|------|-----------|-----------|
| hub.py | 90%+ | 连接、读写、验证、重连 |
| coordinator.py | 85%+ | 轮询、缓存、错误处理 |
| config_flow.py | 95%+ | 所有输入验证、错误分支 |
| switch.py | 80%+ | 状态同步、可用性 |
| select.py | 80%+ | mode_map 映射、验证 |
| services.py | 90%+ | 所有服务场景 |
| diagnostics.py | 70%+ | 数据完整性 |

---

## 🐛 测试 Modbus 通信的技巧

### 使用 Mock Modbus 服务器

```bash
# 安装 pymodbus 模拟器
pip install pymodbus[simulator]

# 运行模拟服务器
pymodbus.simulator --http_port 8080 --modbus_server tcp --modbus_port 5020
```

### 在测试中使用 Fixtures

```python
# tests/conftest.py
import pytest
from unittest.mock import MagicMock

@pytest.fixture
def mock_modbus_responses():
    """Provide realistic Modbus responses."""
    return {
        1033: 1,  # Power ON
        1041: 2,  # Mode: Dry
        1050: 25, # Temperature
    }

@pytest.fixture
async def mock_hub(mock_modbus_responses):
    """Provide a mocked hub with canned responses."""
    hub = MagicMock()

    async def read_register(register):
        return mock_modbus_responses.get(register, 0)

    hub.read_register = read_register
    return hub
```

---

## 📚 参考资源

- [Home Assistant Developer Docs - Testing](https://developers.home-assistant.io/docs/development_testing/)
- [pytest-homeassistant-custom-component](https://github.com/MatthewFlamm/pytest-homeassistant-custom-component)
- [Building a Home Assistant Custom Component Part 2: Unit Testing](https://aarongodfrey.dev/home%20automation/building_a_home_assistant_custom_component_part_2/)
- [Home Assistant Community - Testing Discussion](https://community.home-assistant.io/t/pytest-homeassistant-custom-component/227477)

---

## 🎯 下一步行动

1. **立即开始**: 创建 `tests/conftest.py` 和第一个测试文件
2. **增量添加**: 每实现一个模块就添加对应测试
3. **CI 集成**: 设置 GitHub Actions 自动运行测试
4. **覆盖率监控**: 使用 Codecov 或类似工具追踪覆盖率

测试不是负担，而是让你自信发布的保障！🚀
