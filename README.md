# Home Assistant Air Conditioning Modbus Integration

基于 Next.js 的空调 Modbus 控制台，当前聚焦核心寄存器（1033 总开关 / 1041 主机模式）的手动读写。

## 🌟 特性

- **现代化 Web 界面**: 基于 Next.js + TypeScript + Tailwind CSS 
- **实时监控**: WebSocket 连接实现实时数据更新
- **Modbus 通信**: 支持 TCP 方式连接空调设备
- **Home Assistant 集成**: 自动发现和 MQTT 桥接
- **智能扫描**: 自动发现和分析寄存器
- **TypeScript 支持**: 完整的类型定义和智能提示

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
# 或
pnpm install
```

### 2. 配置环境

复制 `.env.example` 到 `.env` 并修改配置：

```bash
cp .env.example .env
```

### 3. 启动开发服务器

```bash
# 启动 WebSocket 服务器（仅 1033/1041 手动读写，热重载）
npm run ws:dev

# 启动 Next.js 前端
npm run dev:web
```

### 4. 访问应用

- Web 界面: http://localhost:3002
- WebSocket: ws://localhost:3003

## 🎛️ 界面功能

### 📋 当前功能
- **总开关 (1033)**: 读写 0/1
- **主机模式 (1041)**: 读写模式值（1 制冷 / 2 制热 / 3 通风 / 4 除湿）
- 其他寄存器的扫描/监控功能已停用，等待后续抓包分析

## 📡 技术架构

### 前端
- **Next.js 14** - React 全栈框架
- **shadcn/ui** - 现代化 UI 组件库
- **Tailwind CSS** - 样式框架
- **TypeScript** - 类型安全
- **Lucide React** - 图标库

### 后端
- **Next.js API Routes** - 服务端 API
- **WebSocket** - 实时通信
- **modbus-serial** - Modbus 协议支持
- **Node.js** - 运行环境

### 通信协议
- **Modbus TCP** - 与空调设备通信
- **WebSocket** - 前后端实时通信
- **REST API** - HTTP 接口

## 🔗 API 接口

### Modbus 操作（精简后）
- `POST /api/modbus/connect` - 连接 Modbus 设备
- `GET /api/modbus/read` - 读取已知寄存器（1033/1041）
- `POST /api/modbus/read` - 读取指定寄存器（仅 1033/1041）
- `POST /api/modbus/write` - 写入寄存器（仅 1033/1041）

### WebSocket 消息
- `connection` - 连接状态更新
- `bulk_update` - 批量寄存器更新
- `register_change` - 寄存器变化通知
- `error` - 错误信息

## ⚙️ 配置说明

### 已知寄存器配置
位于 `lib/modbus-client.ts` 的 `knownRegisters` 映射：

```typescript
[1033, { name: '总开关', type: 'switch', writable: true }],
[1027, { name: '当前温度', type: 'temperature', scale: 0.1, unit: '°C' }],
// ... 更多寄存器
```

### 连接参数
- **Modbus Host**: 192.168.2.200
- **Modbus Port**: 502
- **Unit ID**: 1
- **Web Port**: 3002
- **WebSocket Port**: 3003

## 📱 使用指南

### 1. 基础操作
1. 打开应用，等待自动连接
2. 点击 "开始监控" 启动实时监控
3. 使用开关控制设备开关
4. 通过输入框调节温度等数值

### 2. 发现新寄存器
1. 使用扫描功能扫描 1030-1180 范围
2. 观察扫描结果中的非零值
3. 手动测试读写操作
4. 记录有效的控制寄存器

### 3. 监控变化
1. 在变化监控面板查看实时变化
2. 操作物理遥控器观察数值变化
3. 根据变化模式推断寄存器功能

### 4. 房间控制测试
1. 逐一测试可写寄存器
2. 观察对应房间的响应
3. 建立房间与寄存器的映射关系

## 🐛 故障排除

### 连接问题
- 检查网络连接到 192.168.2.200
- 确认 Modbus 端口 502 可访问
- 查看浏览器控制台错误信息

### 数据异常
- 重启应用重新连接
- 检查寄存器配置是否正确
- 使用手动读取验证寄存器状态

### 性能优化
- 调整监控频率（默认 2 秒）
- 限制变化记录数量
- 使用寄存器批量读取

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

**现在就开始使用吧！** 🎉

```bash
cd ac-monitor-nextjs
npm install
node start.js
```

然后访问 http://localhost:3002 开始监控你的4房间空调系统！
