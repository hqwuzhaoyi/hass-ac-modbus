#!/usr/bin/env node

const { WebSocketServer } = require('ws');
const { getModbusManager } = require('./lib/modbus-client');

console.log('🚀 启动增强的 Modbus WebSocket 服务器...');

// 获取基础Modbus管理器
const modbusManager = getModbusManager();

// 增强功能状态
let discoveryEnabled = true;
let changeThreshold = 1;
let scanRanges = [
  { start: 1000, end: 1100 },  
  { start: 1100, end: 1200 },  
  { start: 2000, end: 2050 }   
];
let dynamicRegisters = new Map();
let monitoringStats = {
  knownRegisters: 11,
  dynamicRegisters: 0,
  totalMonitored: 11,
  changeThreshold: 1,
  scanningEnabled: true
};

// 启动WebSocket服务器
const wss = new WebSocketServer({ 
  port: 3003,
  perMessageDeflate: false
});

console.log('✅ 增强WebSocket服务器运行在 ws://localhost:3003');

// 智能寄存器发现
async function discoverNewRegisters() {
  if (!modbusManager.isConnected()) {
    throw new Error('Modbus 未连接');
  }

  console.log('🔍 开始智能寄存器发现...');
  const newRegisters = new Map();
  let discovered = 0;

  for (const range of scanRanges) {
    console.log(`扫描范围 ${range.start}-${range.end}...`);
    
    for (let addr = range.start; addr <= range.end; addr += 5) {
      try {
        const count = Math.min(5, range.end - addr + 1);
        const data = await modbusManager.readRegister(addr, count);
        
        for (let i = 0; i < data.length; i++) {
          const address = addr + i;
          const value = data[i];
          
          // 跳过已知寄存器和已发现的动态寄存器
          if (value !== 0 && !isKnownRegister(address) && !dynamicRegisters.has(address)) {
            newRegisters.set(address, value);
            
            // 分析寄存器类型
            const analysis = analyzeRegisterPattern(address, value);
            dynamicRegisters.set(address, {
              address,
              name: analysis.name,
              type: analysis.type,
              confidence: 0.5,
              discoveredAt: new Date().toISOString(),
              changeCount: 0,
              values: [value]
            });
            
            discovered++;
            console.log(`🎯 发现新寄存器 ${address}: ${value} (${analysis.name})`);
            
            // 广播发现事件
            broadcastToAll({
              type: 'register_discovered',
              data: {
                address,
                name: analysis.name,
                type: analysis.type,
                value,
                confidence: 0.5
              },
              timestamp: new Date().toISOString()
            });
          }
        }
        
        // 避免过快请求
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        // 忽略读取错误
      }
    }
  }

  // 更新统计
  monitoringStats.dynamicRegisters = dynamicRegisters.size;
  monitoringStats.totalMonitored = monitoringStats.knownRegisters + dynamicRegisters.size;

  console.log(`✅ 发现完成! 新发现 ${discovered} 个寄存器`);
  
  // 广播发现完成
  broadcastToAll({
    type: 'discovery_complete',
    data: {
      newRegistersCount: discovered,
      totalDynamicRegisters: dynamicRegisters.size,
      scanRanges
    },
    timestamp: new Date().toISOString()
  });

  return newRegisters;
}

// 分析寄存器模式
function analyzeRegisterPattern(address, value) {
  let name = `未知-${address}`;
  let type = 'unknown';

  // 基于地址范围推测
  if (address >= 1000 && address <= 1030) {
    name = `传感器-${address}`;
    type = 'sensor';
  } else if (address >= 1030 && address <= 1060) {
    name = `主控制-${address}`;
    type = 'control';
  } else if (address >= 1060 && address <= 1120) {
    name = `房间控制-${address}`;
    type = 'room_control';
  } else if (address >= 1120 && address <= 1180) {
    name = `扩展控制-${address}`;
    type = 'extended_control';
  }

  // 基于数值范围推测
  if (value >= 150 && value <= 350) {
    name = `温度传感器-${address}`;
    type = 'temperature';
  } else if (value === 0 || value === 1) {
    name = `开关-${address}`;
    type = 'switch';
  } else if (value >= 0 && value <= 10) {
    name = `模式控制-${address}`;
    type = 'mode';
  } else if (value >= 0 && value <= 100) {
    name = `百分比控制-${address}`;
    type = 'percentage';
  }

  return { name, type };
}

// 检查是否为已知寄存器
function isKnownRegister(address) {
  const knownAddresses = [1033, 1041, 1050, 1027, 1035, 1036, 1039, 1028, 1029, 1030, 1042];
  return knownAddresses.includes(address);
}

// 获取所有寄存器（包括动态的）
async function getAllRegistersIncludingDynamic() {
  const basicRegisters = await modbusManager.getAllRegisters();
  
  // 添加动态寄存器
  for (const [address, regInfo] of dynamicRegisters) {
    try {
      const values = await modbusManager.readRegister(address, 1);
      basicRegisters.set(address, {
        address,
        name: regInfo.name,
        value: values[0],
        rawValue: values[0],
        type: regInfo.type,
        writable: false,
        confidence: regInfo.confidence,
        category: 'dynamic',
        discoveredAt: regInfo.discoveredAt,
        changeCount: regInfo.changeCount,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      basicRegisters.set(address, {
        address,
        name: regInfo.name,
        error: error.message,
        type: regInfo.type,
        category: 'dynamic',
        confidence: regInfo.confidence
      });
    }
  }
  
  return basicRegisters;
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

// 自动连接到Modbus设备
modbusManager.connect().then(() => {
  console.log('🔗 开始增强监控 Modbus 数据...');
  modbusManager.startMonitoring();
}).catch(error => {
  console.error('❌ Modbus 连接失败:', error.message);
});

wss.on('connection', (ws) => {
  console.log('🔌 新的WebSocket连接 (增强模式)');
  
  // 将连接添加到基础管理器
  modbusManager.addWebSocketConnection(ws);
  
  // 发送增强统计信息
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
          try {
            const registers = await getAllRegistersIncludingDynamic();
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
            modbusManager.startMonitoring();
            ws.send(JSON.stringify({
              type: 'monitoring_started',
              data: { interval: 2000, enhanced: true },
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
          modbusManager.stopMonitoring();
          ws.send(JSON.stringify({
            type: 'monitoring_stopped',
            timestamp: new Date().toISOString()
          }));
          break;
          
        case 'discover_registers':
          try {
            const newRegisters = await discoverNewRegisters();
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
          
        case 'enable_discovery':
          discoveryEnabled = data.enabled !== false;
          ws.send(JSON.stringify({
            type: 'discovery_config',
            data: { enabled: discoveryEnabled },
            timestamp: new Date().toISOString()
          }));
          break;
          
        case 'set_change_threshold':
          changeThreshold = data.threshold || 1;
          monitoringStats.changeThreshold = changeThreshold;
          ws.send(JSON.stringify({
            type: 'threshold_updated',
            data: { threshold: changeThreshold },
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
          
        // 转发其他请求到基础管理器
        case 'read_register':
        case 'write_register':
        case 'scan_range':
        case 'connect':
        case 'ping':
          // 这些请求由基础 modbusManager 处理
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
    console.log('🔌 WebSocket连接关闭 (增强模式)');
  });
});

// 定期广播统计信息
setInterval(() => {
  broadcastToAll({
    type: 'monitoring_stats',
    data: monitoringStats,
    timestamp: new Date().toISOString()
  });
}, 30000);

// 优雅退出处理
process.on('SIGINT', () => {
  console.log('\n🛑 正在关闭增强服务器...');
  modbusManager.stopMonitoring();
  modbusManager.disconnect();
  wss.close();
  console.log('👋 增强服务器已关闭');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 正在关闭增强服务器...');
  modbusManager.stopMonitoring();
  modbusManager.disconnect();
  wss.close();
  process.exit(0);
});