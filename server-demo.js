#!/usr/bin/env node

const { WebSocketServer } = require('ws');

console.log('🎯 启动演示模式的 Modbus WebSocket 服务器...');

// 模拟的寄存器数据
let simulatedRegisters = new Map([
  [1027, { value: 235, name: '当前温度', type: 'temperature', scale: 0.1 }],
  [1028, { value: 1024, name: '传感器1', type: 'value' }],
  [1029, { value: 245, name: '传感器2', type: 'temperature', scale: 0.1 }],
  [1030, { value: 1, name: '运行状态', type: 'value' }],
  [1033, { value: 1, name: '总开关', type: 'switch', writable: true }],
  [1036, { value: 260, name: '设定温度', type: 'temperature', scale: 0.1, writable: true }],
  [1041, { value: 2, name: '主机模式', type: 'mode', writable: true }],
  [1042, { value: 75, name: '风速百分比', type: 'percentage', writable: true }],
  [1050, { value: 0, name: '未知控制', type: 'switch', writable: true }],
  // 一些动态发现的寄存器
  [1055, { value: 3, name: '房间1模式', type: 'mode', category: 'dynamic' }],
  [1065, { value: 1, name: '房间1开关', type: 'switch', category: 'dynamic' }],
  [1075, { value: 225, name: '房间1温度', type: 'temperature', scale: 0.1, category: 'dynamic' }],
  [1085, { value: 60, name: '房间1风速', type: 'percentage', category: 'dynamic' }],
  [1095, { value: 2, name: '房间2模式', type: 'mode', category: 'dynamic' }],
  [1105, { value: 0, name: '房间2开关', type: 'switch', category: 'dynamic' }],
]);

// 动态变化的寄存器
let changingRegisters = [1027, 1029, 1075]; // 温度传感器会变化
let lastChangeTime = Date.now();

// 增强功能状态
let monitoringStats = {
  knownRegisters: 11,
  dynamicRegisters: simulatedRegisters.size - 11,
  totalMonitored: simulatedRegisters.size,
  changeThreshold: 1,
  scanningEnabled: true
};

let discoveredDynamicRegisters = new Map();

// 启动WebSocket服务器
const wss = new WebSocketServer({ 
  port: 3003,
  perMessageDeflate: false
});

console.log('✅ 演示WebSocket服务器运行在 ws://localhost:3003');
console.log('✓ 模拟Modbus设备已准备好');
console.log('🔗 开始模拟监控数据...');

// 模拟寄存器值的随机变化
setInterval(() => {
  changingRegisters.forEach(addr => {
    const reg = simulatedRegisters.get(addr);
    if (reg && reg.type === 'temperature') {
      // 温度在±2度范围内随机变化
      const baseValue = addr === 1027 ? 235 : addr === 1029 ? 245 : 225;
      const variation = Math.floor(Math.random() * 40 - 20); // ±20 (对应±2度)
      const oldValue = reg.value;
      reg.value = Math.max(200, Math.min(280, baseValue + variation));
      
      if (Math.abs(reg.value - oldValue) >= 5) { // 变化超过0.5度
        broadcastChange(addr, reg.name, oldValue, reg.value, reg.type, reg.category);
      }
    }
  });
}, 3000);

// 模拟智能寄存器发现
function simulateDiscovery() {
  console.log('🔍 开始模拟寄存器发现...');
  
  // 模拟发现新寄存器的过程
  const newRegisters = new Map([
    [1115, { value: 4, name: '房间3模式', type: 'mode', category: 'dynamic' }],
    [1125, { value: 1, name: '房间3开关', type: 'switch', category: 'dynamic' }],
    [1135, { value: 250, name: '房间3温度', type: 'temperature', scale: 0.1, category: 'dynamic' }],
    [1145, { value: 80, name: '房间3风速', type: 'percentage', category: 'dynamic' }],
    [1155, { value: 1, name: '房间4模式', type: 'mode', category: 'dynamic' }],
    [1165, { value: 1, name: '房间4开关', type: 'switch', category: 'dynamic' }],
    [2010, { value: 5, name: '系统状态', type: 'value', category: 'dynamic' }],
    [2020, { value: 3600, name: '运行时间', type: 'value', category: 'dynamic' }]
  ]);
  
  let discovered = 0;
  for (const [addr, reg] of newRegisters) {
    if (!simulatedRegisters.has(addr)) {
      simulatedRegisters.set(addr, reg);
      discoveredDynamicRegisters.set(addr, reg);
      discovered++;
      
      // 广播发现事件
      broadcastToAll({
        type: 'register_discovered',
        data: {
          address: addr,
          name: reg.name,
          type: reg.type,
          value: reg.value,
          confidence: 0.7
        },
        timestamp: new Date().toISOString()
      });
      
      console.log(`🎯 发现新寄存器 ${addr}: ${reg.value} (${reg.name})`);
    }
  }
  
  // 更新统计
  monitoringStats.dynamicRegisters = discovered;
  monitoringStats.totalMonitored = monitoringStats.knownRegisters + discovered;
  
  // 广播发现完成
  broadcastToAll({
    type: 'discovery_complete',
    data: {
      newRegistersCount: discovered,
      totalDynamicRegisters: discovered,
      scanRanges: [
        { start: 1000, end: 1100 },
        { start: 1100, end: 1200 },
        { start: 2000, end: 2050 }
      ]
    },
    timestamp: new Date().toISOString()
  });
  
  return newRegisters;
}

// 获取所有寄存器
function getAllRegisters() {
  const results = [];
  
  for (const [address, reg] of simulatedRegisters) {
    const isKnown = address <= 1042;
    let scaledValue = reg.value;
    
    if (reg.scale) {
      scaledValue = reg.value * reg.scale;
    }
    
    results.push({
      address,
      name: reg.name,
      value: scaledValue,
      rawValue: reg.value,
      type: reg.type,
      writable: reg.writable || false,
      unit: reg.type === 'temperature' ? '°C' : reg.type === 'percentage' ? '%' : '',
      category: reg.category || (isKnown ? 'known' : 'dynamic'),
      confidence: reg.category === 'dynamic' ? 0.8 : undefined,
      timestamp: new Date().toISOString()
    });
  }
  
  return results;
}

// 广播变化
function broadcastChange(address, name, oldValue, newValue, type, category) {
  broadcastToAll({
    type: category === 'dynamic' ? 'dynamic_register_change' : 'register_change',
    data: {
      address,
      name,
      oldValue,
      newValue,
      type,
      category: category || 'known'
    },
    timestamp: new Date().toISOString()
  });
}

// 广播消息到所有连接
function broadcastToAll(message) {
  const messageStr = JSON.stringify(message);
  wss.clients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(messageStr);
    }
  });
}

wss.on('connection', (ws) => {
  console.log('🔌 新的WebSocket连接 (演示模式)');
  
  // 发送连接状态
  ws.send(JSON.stringify({
    type: 'connection',
    data: { 
      connected: true, 
      host: '192.168.2.200 (模拟)', 
      port: 502,
      registersCount: simulatedRegisters.size,
      mode: 'demo'
    },
    timestamp: new Date().toISOString()
  }));
  
  // 发送统计信息
  ws.send(JSON.stringify({
    type: 'monitoring_stats',
    data: monitoringStats,
    timestamp: new Date().toISOString()
  }));
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('📨 收到消息:', data.type);
      
      switch (data.type) {
        case 'get_all_registers':
          const registers = getAllRegisters();
          ws.send(JSON.stringify({
            type: 'bulk_update',
            data: registers,
            timestamp: new Date().toISOString()
          }));
          break;
          
        case 'start_monitoring':
          ws.send(JSON.stringify({
            type: 'monitoring_started',
            data: { interval: 2000, enhanced: true, mode: 'demo' },
            timestamp: new Date().toISOString()
          }));
          break;
          
        case 'stop_monitoring':
          ws.send(JSON.stringify({
            type: 'monitoring_stopped',
            timestamp: new Date().toISOString()
          }));
          break;
          
        case 'discover_registers':
          setTimeout(() => {
            const newRegisters = simulateDiscovery();
            ws.send(JSON.stringify({
              type: 'discovery_results',
              data: { 
                found: newRegisters.size,
                registers: Object.fromEntries(newRegisters)
              },
              timestamp: new Date().toISOString()
            }));
          }, 2000); // 模拟2秒发现时间
          break;
          
        case 'enable_discovery':
          const enabled = data.enabled !== false;
          monitoringStats.scanningEnabled = enabled;
          ws.send(JSON.stringify({
            type: 'discovery_config',
            data: { enabled },
            timestamp: new Date().toISOString()
          }));
          break;
          
        case 'set_change_threshold':
          monitoringStats.changeThreshold = data.threshold || 1;
          ws.send(JSON.stringify({
            type: 'threshold_updated',
            data: { threshold: monitoringStats.changeThreshold },
            timestamp: new Date().toISOString()
          }));
          break;
          
        case 'read_register':
          if (data.address !== undefined) {
            const reg = simulatedRegisters.get(data.address);
            const values = reg ? [reg.value] : [0];
            ws.send(JSON.stringify({
              type: 'read_response',
              address: data.address,
              values: values,
              timestamp: new Date().toISOString()
            }));
          }
          break;
          
        case 'write_register':
          if (data.address !== undefined && data.value !== undefined) {
            const reg = simulatedRegisters.get(data.address);
            if (reg && reg.writable) {
              const oldValue = reg.value;
              reg.value = data.value;
              
              ws.send(JSON.stringify({
                type: 'write_response',
                address: data.address,
                written: data.value,
                verified: data.value,
                timestamp: new Date().toISOString()
              }));
              
              // 广播变化
              broadcastChange(data.address, reg.name, oldValue, data.value, reg.type, reg.category);
            }
          }
          break;
          
        case 'scan_range':
          const { start = 1000, end = 1100 } = data;
          const scanResults = {};
          
          for (const [addr, reg] of simulatedRegisters) {
            if (addr >= start && addr <= end) {
              scanResults[addr] = reg.value;
            }
          }
          
          ws.send(JSON.stringify({
            type: 'scan_response',
            results: scanResults,
            count: Object.keys(scanResults).length,
            range: { start, end },
            timestamp: new Date().toISOString()
          }));
          break;
          
        case 'get_stats':
          ws.send(JSON.stringify({
            type: 'monitoring_stats',
            data: monitoringStats,
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
            data: { message: `收到 ${data.type} 请求 (演示模式)` },
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
    console.log('🔌 WebSocket连接关闭 (演示模式)');
  });
});

// 定期广播数据更新
setInterval(() => {
  const registers = getAllRegisters();
  broadcastToAll({
    type: 'bulk_update',
    data: registers,
    timestamp: new Date().toISOString()
  });
}, 2000);

// 定期广播统计信息
setInterval(() => {
  broadcastToAll({
    type: 'monitoring_stats',
    data: monitoringStats,
    timestamp: new Date().toISOString()
  });
}, 30000);

console.log('🎮 演示模式功能:');
console.log('  📊 模拟11个已知寄存器');
console.log('  🔍 支持智能发现8个新寄存器');
console.log('  📈 温度传感器会自动变化');
console.log('  🎛️ 支持可写寄存器控制');
console.log('  🌐 Web界面: http://localhost:3002/enhanced');

// 优雅退出处理
process.on('SIGINT', () => {
  console.log('\n🛑 正在关闭演示服务器...');
  wss.close();
  console.log('👋 演示服务器已关闭');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 正在关闭演示服务器...');
  wss.close();
  process.exit(0);
});