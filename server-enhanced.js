#!/usr/bin/env node

const { WebSocketServer } = require('ws');
// 动态导入 TypeScript 模块
let EnhancedModbusMonitor;
let getEnhancedMonitor;

try {
  // 尝试导入编译后的 JS
  const enhancedModule = require('./lib/enhanced-monitor.js');
  getEnhancedMonitor = enhancedModule.getEnhancedMonitor;
} catch (error) {
  // 如果没有编译文件，使用 ts-node
  require('ts-node/register');
  const enhancedModule = require('./lib/enhanced-monitor.ts');
  getEnhancedMonitor = enhancedModule.getEnhancedMonitor;
}

console.log('🚀 启动增强的 Modbus WebSocket 服务器...');

// 获取增强监控器实例
const monitor = getEnhancedMonitor();

// 启动WebSocket服务器
const wss = new WebSocketServer({ 
  port: 3003,
  perMessageDeflate: false
});

console.log('✅ 增强WebSocket服务器运行在 ws://localhost:3003');

// 自动连接到Modbus设备
monitor.connect().then(() => {
  console.log('🔗 开始增强监控 Modbus 数据...');
  
  // 启用动态发现
  monitor.enableDynamicDiscovery(true);
  
  // 启动增强监控（每2秒）
  monitor.startEnhancedMonitoring(2000);
  
}).catch(error => {
  console.error('❌ Modbus 连接失败:', error.message);
});

wss.on('connection', (ws) => {
  console.log('🔌 新的WebSocket连接');
  
  // 将WebSocket连接添加到监控器
  monitor.addWebSocketConnection(ws);
  
  // 发送监控统计信息
  const stats = monitor.getMonitoringStats();
  ws.send(JSON.stringify({
    type: 'monitoring_stats',
    data: stats,
    timestamp: new Date().toISOString()
  }));
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('📨 收到消息:', data.type, data);
      
      switch (data.type) {
        case 'connect':
          try {
            const success = await monitor.connect();
            if (success) {
              monitor.enableDynamicDiscovery(true);
              monitor.startEnhancedMonitoring(2000);
            }
          } catch (error) {
            console.error('连接失败:', error);
          }
          break;
          
        case 'get_all_registers':
          try {
            const registers = await monitor.getAllRegistersIncludingDynamic();
            ws.send(JSON.stringify({
              type: 'bulk_update',
              data: Array.from(registers.values()),
              timestamp: new Date().toISOString()
            }));
          } catch (error) {
            ws.send(JSON.stringify({
              type: 'error',
              data: { message: error.message },
              timestamp: new Date().toISOString()
            }));
          }
          break;
          
        case 'start_monitoring':
          try {
            await monitor.startEnhancedMonitoring(data.interval || 2000);
            ws.send(JSON.stringify({
              type: 'monitoring_started',
              data: { interval: data.interval || 2000, enhanced: true },
              timestamp: new Date().toISOString()
            }));
          } catch (error) {
            ws.send(JSON.stringify({
              type: 'error',
              data: { message: error.message },
              timestamp: new Date().toISOString()
            }));
          }
          break;
          
        case 'stop_monitoring':
          monitor.stopMonitoring();
          ws.send(JSON.stringify({
            type: 'monitoring_stopped',
            timestamp: new Date().toISOString()
          }));
          break;
          
        case 'enable_discovery':
          monitor.enableDynamicDiscovery(data.enabled !== false);
          ws.send(JSON.stringify({
            type: 'discovery_config',
            data: { enabled: data.enabled !== false },
            timestamp: new Date().toISOString()
          }));
          break;
          
        case 'discover_registers':
          try {
            const newRegisters = await monitor.discoverNewRegisters();
            ws.send(JSON.stringify({
              type: 'discovery_results',
              data: { 
                found: newRegisters.size,
                registers: Object.fromEntries(newRegisters)
              },
              timestamp: new Date().toISOString()
            }));
          } catch (error) {
            ws.send(JSON.stringify({
              type: 'error',
              data: { message: error.message },
              timestamp: new Date().toISOString()
            }));
          }
          break;
          
        case 'set_change_threshold':
          try {
            monitor.setChangeThreshold(data.threshold || 1);
            ws.send(JSON.stringify({
              type: 'threshold_updated',
              data: { threshold: data.threshold || 1 },
              timestamp: new Date().toISOString()
            }));
          } catch (error) {
            ws.send(JSON.stringify({
              type: 'error',
              data: { message: error.message },
              timestamp: new Date().toISOString()
            }));
          }
          break;
          
        case 'read_register':
          try {
            if (data.address !== undefined) {
              const values = await monitor.readRegister(data.address, data.count || 1);
              ws.send(JSON.stringify({
                type: 'read_response',
                address: data.address,
                values: values,
                timestamp: new Date().toISOString()
              }));
            }
          } catch (error) {
            ws.send(JSON.stringify({
              type: 'error',
              data: { message: error.message, address: data.address },
              timestamp: new Date().toISOString()
            }));
          }
          break;
          
        case 'write_register':
          try {
            if (data.address && data.value !== undefined) {
              const result = await monitor.writeRegister(data.address, data.value);
              ws.send(JSON.stringify({
                type: 'write_response',
                address: data.address,
                written: result.written,
                verified: result.verified,
                timestamp: new Date().toISOString()
              }));
            }
          } catch (error) {
            ws.send(JSON.stringify({
              type: 'error',
              data: { message: error.message, address: data.address },
              timestamp: new Date().toISOString()
            }));
          }
          break;
          
        case 'scan_range':
          try {
            const { start = 1000, end = 1100 } = data;
            const results = await monitor.scanRange(start, end);
            ws.send(JSON.stringify({
              type: 'scan_response',
              results: Object.fromEntries(results),
              count: results.size,
              range: { start, end },
              timestamp: new Date().toISOString()
            }));
          } catch (error) {
            ws.send(JSON.stringify({
              type: 'error',
              data: { message: error.message },
              timestamp: new Date().toISOString()
            }));
          }
          break;
          
        case 'get_stats':
          const currentStats = monitor.getMonitoringStats();
          ws.send(JSON.stringify({
            type: 'monitoring_stats',
            data: currentStats,
            timestamp: new Date().toISOString()
          }));
          break;
          
        case 'ping':
          ws.send(JSON.stringify({
            type: 'pong',
            timestamp: new Date().toISOString()
          }));
          break;
          
        default:
          ws.send(JSON.stringify({
            type: 'response',
            data: { message: `收到 ${data.type} 请求 (增强模式)` },
            timestamp: new Date().toISOString()
          }));
      }
      
    } catch (error) {
      console.error('WebSocket消息处理错误:', error);
      ws.send(JSON.stringify({
        type: 'error',
        data: { message: error.message },
        timestamp: new Date().toISOString()
      }));
    }
  });
  
  ws.on('close', () => {
    console.log('🔌 WebSocket连接关闭');
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket错误:', error);
  });
});

// 定期广播统计信息
setInterval(() => {
  const stats = monitor.getMonitoringStats();
  const statsMessage = JSON.stringify({
    type: 'monitoring_stats',
    data: stats,
    timestamp: new Date().toISOString()
  });
  
  wss.clients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      client.send(statsMessage);
    }
  });
}, 30000); // 每30秒

// 优雅退出处理
process.on('SIGINT', () => {
  console.log('\n🛑 正在关闭增强服务器...');
  monitor.stopMonitoring();
  monitor.disconnect();
  wss.close();
  console.log('👋 增强服务器已关闭');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 正在关闭增强服务器...');
  monitor.stopMonitoring();
  monitor.disconnect();
  wss.close();
  process.exit(0);
});