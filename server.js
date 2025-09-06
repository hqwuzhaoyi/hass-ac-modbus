#!/usr/bin/env node

const { WebSocketServer } = require('ws');
const { getModbusManager } = require('./lib/modbus-client');

console.log('📡 启动集成的 Modbus WebSocket 服务器...');

// 获取Modbus管理器实例
const modbusManager = getModbusManager();

// 启动WebSocket服务器
const wss = new WebSocketServer({ 
  port: 3003,
  perMessageDeflate: false
});

console.log('✅ WebSocket 服务器运行在 ws://localhost:3003');

// 自动连接到Modbus设备
modbusManager.connect().then(() => {
  console.log('🔗 开始监控 Modbus 数据...');
  modbusManager.startMonitoring();
}).catch(error => {
  console.error('❌ Modbus 连接失败:', error.message);
});

wss.on('connection', (ws) => {
  console.log('🔌 新的WebSocket连接');
  
  // 将WebSocket连接添加到Modbus管理器
  modbusManager.addWebSocketConnection(ws);
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('📨 收到消息:', data.type, data);
      
      switch (data.type) {
        case 'connect':
          try {
            const success = await modbusManager.connect();
            if (success) {
              modbusManager.startMonitoring();
            }
          } catch (error) {
            console.error('连接失败:', error);
          }
          break;
          
        case 'read_all':
          try {
            const registers = await modbusManager.getAllRegisters();
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
          
        case 'write_register':
          try {
            if (data.address && data.value !== undefined) {
              const result = await modbusManager.writeRegister(data.address, data.value);
              ws.send(JSON.stringify({
                type: 'write_success',
                data: result,
                timestamp: new Date().toISOString()
              }));
            }
          } catch (error) {
            ws.send(JSON.stringify({
              type: 'error',
              data: { message: error.message },
              timestamp: new Date().toISOString()
            }));
          }
          break;
          
        case 'scan_range':
          try {
            const { start = 1000, end = 1100 } = data;
            const results = await modbusManager.scanRange(start, end);
            ws.send(JSON.stringify({
              type: 'scan_results',
              data: Object.fromEntries(results),
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
          
        case 'ping':
          ws.send(JSON.stringify({
            type: 'pong',
            timestamp: new Date().toISOString()
          }));
          break;
          
        default:
          ws.send(JSON.stringify({
            type: 'response',
            data: { message: `收到 ${data.type} 请求` },
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

// 优雅退出处理
process.on('SIGINT', () => {
  console.log('\n🛑 正在关闭服务器...');
  modbusManager.stopMonitoring();
  modbusManager.disconnect();
  wss.close();
  console.log('👋 服务器已关闭');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 正在关闭服务器...');
  modbusManager.stopMonitoring();
  modbusManager.disconnect();
  wss.close();
  process.exit(0);
});