# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Home Assistant Air Conditioning Modbus Integration - A modern TypeScript/Next.js system for real-time monitoring and control of Modbus air conditioners with intelligent register discovery. Features both basic monitoring and advanced AI-powered register analysis.

**Architecture:**
1. **Next.js Full-Stack App** - Modern web interface with core control (1033/1041)
2. **WebSocket Server** - 单一模式，聚焦核心寄存器读写（已禁用轮询/扫描）
3. **Enhanced Scanning System** -（暂不使用）AI-powered register discovery with parallel processing
4. **Real-time Change Tracking** -（已下线）此前用于寄存器变化监控

## Common Commands

### Main Application
- `npm install` - Install all dependencies
- `npm run dev` - Start complete development environment (WebSocket + Next.js)
- `npm start` - Start Next.js production server (port 3002)
- `npm run build` - Build Next.js production bundle
- `npm run lint` - Run Next.js linting
- `npm test` - Run Jest tests

### WebSocket Server
- `npm run ws` - WebSocket server (ts-node) for core registers 1033/1041
- `npm run ws:dev` - 热重载模式（nodemon + ts-node，watch server.ts/lib）
- `npm run monitor` - Alias for `npm run ws`

### Scanning Commands (已暂存)
- `npm run scan` - Basic Modbus register scan
- `npm run scan:smart` - Smart optimized scan with adaptive algorithms
- `npm run scan:stats` - View scan history and statistics
- `npm run scan:compare` - Compare different scanning strategies

### MQTT & Integration
- `npm run bridge` - Start MQTT bridge to Home Assistant

## Realtime Change Detection Overview

- **UI Components**: `components/real-time-change-monitor.tsx` streams `change_notification`, `buffer_stats`, `dependency_status`, `latency_metrics`; `components/change-history-panel.tsx` renders playback badges、缓冲利用率与依赖健康状态。
- **Server Modes**: `npm run ws`, `npm run ws:enhanced`, `npm run ws:demo` 均已集成新的 change-detector 管道，Demo 模式会模拟 `playback` 事件与依赖监控。
- **Core Libraries**: `lib/change-detector.ts`, `lib/change-event-manager.ts`, `lib/monitoring-session.ts`, `lib/dependency-monitors.ts`, `lib/change-websocket-handler.ts` 负责分层延迟计算、缓冲队列、依赖告警、批次序列号。
- **MQTT 输出**: 若配置 `MQTT_HOST` 等环境变量，`lib/modbus-client.ts` 会通过 `lib/mqtt-bridge.ts` 将 `changes` 主题推送到 Home Assistant。

## Validation Shortcuts

- `npm test` - 运行全部 Jest 套件，覆盖合约测试、集成测试、性能预算、缓冲/依赖场景。
- `__tests__/unit/` - 独立验证 change-detector、websocket handler、monitoring session 行为。
- `__tests__/integration/` - 覆盖实时工作流、三模式兼容性、缓冲回放、依赖监控等关键路径。
- Quickstart 中的 “Mode Validation Playbook” 列出三种 WebSocket 模式的人工巡检步骤。

## Architecture

### WebSocket Server Layer
- **server.ts** - WebSocket server (TS) focused on registers 1033/1041; no polling/scanning
- **lib/modbus-client.ts** - Core Modbus communication client; monitoring disabled when pollingInterval<=0
- **lib/enhanced-monitor.ts** - Advanced monitoring with dynamic register discovery（暂未启用）

### Next.js Frontend
- **app/page.tsx** - 核心控制面板（1033/1041）
- **components/register-monitor.tsx** - 核心寄存器读写组件
- **components/ui/** - Radix UI components with Tailwind CSS styling
- **types/modbus.ts** - TypeScript type definitions

### AI-Powered Scanning System（保留代码，暂不使用）
- **lib/enhanced-scanner.ts**, **lib/scan-optimizer.ts**, **examples/enhanced-scanning-example.ts**, **scripts/smart-scan.ts**

### Legacy Components (src/)
- **modbus-scanner.js** - Original sequential scanner
- **data-analyzer.js** - Pattern recognition for register types
- **mqtt-bridge.js** - Home Assistant MQTT integration
- **packet-capture.js** - Network analysis tools

### Configuration System
- **.env** - Environment variables (copy from .env.example)
- 其余扫描/发现相关配置文件暂未使用

### Data Flow Architecture

**简化控制流：**
1. WebSocket Server 连接 Modbus
2. 按需手动读写寄存器 1033/1041
3. 无轮询、无变化追踪、无动态发现

### Key Dependencies
- **Next.js 14 + TypeScript** - Modern full-stack web framework
- **modbus-serial** - Modbus TCP/RTU communication
- **ws** - WebSocket server for real-time communication
- **Radix UI + Tailwind CSS** - Modern component library and styling
- **mqtt** - Home Assistant MQTT integration  
- **winston** - Structured logging

## Development Notes

### Configuration Workflow
1. Copy `.env.example` to `.env` and configure MODBUS_HOST and MQTT settings
2. Run `npm run scan:smart` for optimized discovery of air conditioner registers
3. Check `config/enhanced-scan-config.json` for AI-identified parameters
4. Use `npm run scan:stats` to view scan history and optimization suggestions
5. Fine-tune register mappings if needed

### Scanning Strategy Selection
- **Basic scanning** (`npm run scan`) - Traditional sequential scanning
- **Enhanced scanning** (`npm run scan:enhanced`) - Parallel with intelligent analysis
- **Smart scanning** (`npm run scan:smart`) - Adaptive with history optimization
- **Performance comparison** (`npm run scan:compare`) - Benchmark different strategies

### Testing Modbus Connection
Use `npm run test` to verify connectivity before running other services. For performance analysis, use `npm run scan:stats` to view historical scan data.

### Optimization Tips
- First run typically takes longer for full discovery
- Subsequent runs use incremental scanning for faster results
- High-priority ranges (1030-1180) are scanned first
- Adaptive batch sizing optimizes for device response characteristics
