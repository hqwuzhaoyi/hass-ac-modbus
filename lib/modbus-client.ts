import { WebSocket } from 'ws';

let ModbusRTU: any;

// 动态导入 modbus-serial（仅在服务器端）
if (typeof window === 'undefined') {
  try {
    ModbusRTU = require('modbus-serial');
  } catch (error) {
    console.warn('modbus-serial not available');
  }
}

export class ModbusClientManager {
  private client: any;
  private connected: boolean = false;
  private wsConnections: Set<WebSocket> = new Set();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastValues: Map<number, number> = new Map();

  // 已知寄存器配置
  private knownRegisters = new Map([
    [1033, { name: '总开关', type: 'switch', writable: true }],
    [1041, { name: '主机模式', type: 'value', writable: true }],
    [1050, { name: '未知控制', type: 'switch', writable: true }],
    [1027, { name: '当前温度', type: 'temperature', writable: false, scale: 0.1, unit: '°C' }],
    [1035, { name: '温度下限', type: 'temperature', writable: true, scale: 0.1, unit: '°C' }],
    [1036, { name: '设定温度', type: 'temperature', writable: true, scale: 0.1, unit: '°C' }],
    [1039, { name: '温度上限', type: 'temperature', writable: true, scale: 0.1, unit: '°C' }],
    [1028, { name: '传感器1', type: 'value', writable: false }],
    [1029, { name: '传感器2', type: 'temperature', writable: false, scale: 0.1, unit: '°C' }],
    [1030, { name: '运行状态', type: 'value', writable: false }],
    [1042, { name: '风速百分比', type: 'value', writable: true, unit: '%' }],
  ]);

  constructor() {
    if (!ModbusRTU) return;
    this.client = new ModbusRTU();
  }

  async connect() {
    if (!this.client) return false;

    try {
      await this.client.connectTCP('192.168.2.200', { port: 502 });
      this.client.setID(1);
      this.client.setTimeout(3000);
      this.connected = true;
      this.broadcastMessage({
        type: 'connection',
        data: { connected: true, host: '192.168.2.200', port: 502 },
        timestamp: new Date().toISOString()
      });
      console.log('✓ Modbus 连接成功');
      return true;
    } catch (error) {
      this.connected = false;
      this.broadcastMessage({
        type: 'error',
        data: { message: (error as Error).message },
        timestamp: new Date().toISOString()
      });
      console.error('Modbus 连接失败:', error);
      return false;
    }
  }

  async readRegister(address: number, count: number = 1) {
    if (!this.connected || !this.client) {
      throw new Error('Modbus 未连接');
    }

    try {
      const data = await this.client.readHoldingRegisters(address, count);
      return data.data;
    } catch (error) {
      throw new Error(`读取寄存器 ${address} 失败: ${(error as Error).message}`);
    }
  }

  async writeRegister(address: number, value: number) {
    if (!this.connected || !this.client) {
      throw new Error('Modbus 未连接');
    }

    try {
      const oldValue = this.lastValues.get(address) || 0;
      
      await this.client.writeRegister(address, value);
      
      // 验证写入
      const verifyData = await this.client.readHoldingRegisters(address, 1);
      const newValue = verifyData.data[0];
      
      // 更新缓存
      this.lastValues.set(address, newValue);
      
      // 广播变化
      const registerInfo = this.knownRegisters.get(address);
      if (registerInfo && oldValue !== newValue) {
        this.broadcastMessage({
          type: 'register_change',
          data: {
            address,
            name: registerInfo.name,
            oldValue,
            newValue,
            type: registerInfo.type
          },
          timestamp: new Date().toISOString()
        });
      }
      
      return { written: value, verified: newValue };
    } catch (error) {
      throw new Error(`写入寄存器 ${address} 失败: ${(error as Error).message}`);
    }
  }

  async getAllRegisters() {
    const results = new Map();
    
    for (const [address, config] of this.knownRegisters) {
      try {
        const values = await this.readRegister(address, 1);
        let scaledValue = values[0];
        
        if (config.scale) {
          scaledValue = values[0] * config.scale;
        }
        
        results.set(address, {
          address,
          name: config.name,
          value: scaledValue,
          rawValue: values[0],
          type: config.type,
          writable: config.writable,
          unit: config.unit,
          timestamp: new Date().toISOString()
        });
        
        // 更新缓存
        this.lastValues.set(address, values[0]);
        
      } catch (error) {
        results.set(address, {
          address,
          name: config.name,
          error: (error as Error).message,
          type: config.type,
          writable: config.writable
        });
      }
    }
    
    return results;
  }

  async scanRange(start: number, end: number) {
    const results = new Map();
    
    for (let addr = start; addr <= end; addr++) {
      try {
        const values = await this.readRegister(addr, 1);
        if (values[0] !== 0) {
          results.set(addr, values[0]);
        }
        // 小延迟避免过快请求
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        // 忽略读取错误
      }
    }
    
    return results;
  }

  startMonitoring() {
    if (this.monitoringInterval) return;
    
    this.monitoringInterval = setInterval(async () => {
      if (!this.connected) return;
      
      try {
        const registers = await this.getAllRegisters();
        
        // 检查变化
        const changes: any[] = [];
        for (const [address, data] of registers) {
          if (data.error) continue;
          
          const lastValue = this.lastValues.get(address);
          if (lastValue !== undefined && lastValue !== data.rawValue) {
            const registerInfo = this.knownRegisters.get(address);
            if (registerInfo) {
              changes.push({
                address,
                name: registerInfo.name,
                oldValue: lastValue,
                newValue: data.rawValue,
                type: registerInfo.type
              });
            }
          }
          
          this.lastValues.set(address, data.rawValue);
        }
        
        // 广播更新
        this.broadcastMessage({
          type: 'bulk_update',
          data: Array.from(registers.values()),
          timestamp: new Date().toISOString()
        });
        
        // 广播变化
        if (changes.length > 0) {
          changes.forEach(change => {
            this.broadcastMessage({
              type: 'register_change',
              data: change,
              timestamp: new Date().toISOString()
            });
          });
        }
        
      } catch (error) {
        console.error('监控错误:', error);
      }
    }, 2000); // 每2秒更新
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  addWebSocketConnection(ws: WebSocket) {
    this.wsConnections.add(ws);
    
    ws.on('close', () => {
      this.wsConnections.delete(ws);
    });
    
    // 发送当前连接状态
    ws.send(JSON.stringify({
      type: 'connection',
      data: { 
        connected: this.connected, 
        host: '192.168.2.200', 
        port: 502,
        registersCount: this.knownRegisters.size
      },
      timestamp: new Date().toISOString()
    }));
  }

  private broadcastMessage(message: any) {
    const messageStr = JSON.stringify(message);
    
    this.wsConnections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    });
  }

  disconnect() {
    this.stopMonitoring();
    
    if (this.client && this.client.isOpen) {
      this.client.close();
    }
    
    this.connected = false;
    this.broadcastMessage({
      type: 'connection',
      data: { connected: false },
      timestamp: new Date().toISOString()
    });
  }

  isConnected() {
    return this.connected;
  }
}

// 单例实例
let modbusManager: ModbusClientManager;

export function getModbusManager(): ModbusClientManager {
  if (!modbusManager) {
    modbusManager = new ModbusClientManager();
  }
  return modbusManager;
}