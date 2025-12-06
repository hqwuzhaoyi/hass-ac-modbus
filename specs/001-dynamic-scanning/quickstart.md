# Quickstart: Minimal Core Control (1033/1041 only)

## Overview
Validates the current minimal scope: manual read/write of registers 1033 (总开关) and 1041 (主机模式). Polling, real-time change detection, dynamic discovery, and scanning are disabled.

## Prerequisites
- Node.js environment
- Modbus device reachable at configured host/port

## Setup
1. Start WebSocket server with hot reload:
   ```bash
   npm run ws:dev
   ```
2. Start Next.js UI:
   ```bash
   npm run dev:web
   # Open http://localhost:3002
   ```

## Test Scenarios

### Scenario 1: Read 1033/1041
1. Ensure UI shows “已连接”状态。
2. 点击“刷新状态”或单独读取 1033、1041。
3. 预期：数值显示正常；若 Modbus 断开应提示错误。

### Scenario 2: Write 1033 (总开关)
1. 使用开关或写入按钮切换 0/1。
2. 预期：写入成功并回读确认；日志/前端显示最新值。

### Scenario 3: Write 1041 (主机模式)
1. 输入模式值（1 制冷 / 2 制热 / 3 通风 / 4 除湿等）点击“写入”。
2. 预期：写入成功并回读确认；输入非法值时给出错误提示。

### Scenario 4: Blocked Addresses
1. 通过 WS 或 UI 尝试读取/写入非 1033/1041。
2. 预期：返回错误提示“仅支持 1033/1041”。

## Notes
- 轮询/实时变化监控/动态扫描已停用；只有手动读写路径。
- 若需扩展新的寄存器或恢复监控功能，需更新 spec/plan 并重新启用相关逻辑。
| Basic | `npm run ws` | 在 `http://localhost:3002` 观察“实时寄存器变化”卡片显示 `sessionId=basic`，操作后实时计数更新。 |
| Enhanced | `npm run ws:enhanced` | 在 `http://localhost:3002/enhanced` 查看缓冲利用率、依赖状态、延迟分解数据。 |
| Demo | `npm run ws:demo` | 两个界面均可连接，演示服务会周期性推送 `playback` 事件并刷新缓冲/依赖卡片。 |

每次启动后：
1. 打开对应页面确认状态徽标为“已连接”，并记录缓冲/依赖信息。
2. 触发一次寄存器变化（或等待 Demo 自动事件），检查历史面板记录实时/回放条目与批次序号。
3. 使用“清空历史”按钮验证回放后仍能继续捕获最新变更。

## Troubleshooting

### Common Issues

**Changes not detected**:
- Verify WebSocket connection is active
- Check polling interval in session configuration
- Ensure register is in monitored set
- Test with demo mode to isolate hardware issues

**High latency**:
- Check network connectivity to Modbus device
- Verify polling interval not too aggressive
- Monitor browser performance tab for bottlenecks
- Inspect性能日志确认各阶段延迟是否超出 250/150/600ms 预算
- 检查系统时间同步（NTP）是否漂移，必要时重新同步

**Missing change history**:
- Confirm change history limit (50 events max)
- Check for WebSocket disconnection/reconnection
- Verify timestamp parsing and display
- Review缓冲区溢出告警，必要时提高容量或放缓轮询

**UI not updating**:
- Check browser console for JavaScript errors
- Verify React component state management
- Test with different browsers/devices
- 使用无障碍工具确认高亮仍被宣布；若未触发，检查 aria-live 设置

**Buffer overflow warnings**:
- 查看日志是否存在 `buffer_overflow` 或 `playback_drop` 条目
- 调整缓冲区大小或减小采样频率
- 通知运维关注监控面板的缓冲利用率

**Unexpected disconnects**:
- 检查 WebSocket 自动重连日志是否成功
- 若 Modbus 连续超时，排查硬件或网络链路，并确认系统进入降级模式
- MQTT 桥接失败时确保降级消息已记录并在恢复时回放
### Validation Checklist

- [ ] Power button changes detected within 600ms UI target，并记录完整延迟分解
- [ ] Temperature adjustments tracked accurately
- [ ] Multiple simultaneous changes handled
- [ ] Change history maintains chronological order
- [ ] WebSocket messages match contract format
- [ ] Performance meets 1s end-to-end预算（250/150/600ms）
- [ ] Buffer/playback handles pauses、溢出与回放标记
- [ ] Dependency监控对断连/降级产生告警并自动恢复
- [ ] Silent state messaging appears after inactivity and manual回放可触发
- [ ] Backward compatibility preserved
- [ ] Demo mode works for testing
- [ ] Error handling graceful and informative
- [ ] UI highlighting provides clear visual feedback

## Success Criteria
This quickstart validates successful implementation when:

1. **Real-time correlation**: Physical AC operations immediately show corresponding register changes
2. **Complete change tracking**: All register value changes are captured and displayed
3. **Performance compliance**: 后端检测≤250ms（目标 <100ms）、WebSocket 分发≤150ms、前端呈现≤600ms，且记录证据证明端到端≤1s
4. **User experience**: Clear visual feedback enables effective reverse engineering
5. **System integration**: Feature works across all monitoring modes without disruption

## Next Steps
After successful quickstart validation:

1. **Production deployment**: Configure for actual AC units
2. **Register mapping**: Use change detection to build comprehensive register database
3. **Home Assistant integration**: Export discovered register functions to MQTT
4. **Performance tuning**: Optimize polling intervals for specific AC models
5. **Documentation**: Document discovered register functions for future reference
