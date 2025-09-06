import { WebSocket } from 'ws';
import { ModbusClientManager } from './modbus-client';

export class EnhancedModbusMonitor extends ModbusClientManager {
  private dynamicRegisters: Map<number, any> = new Map();
  private scanningEnabled: boolean = false;
  private fullRangeScan: boolean = false;
  private changeThreshold: number = 1; // 变化阈值
  private scanRanges = [
    { start: 1000, end: 1100 },  // 主要控制区域
    { start: 1100, end: 1200 },  // 扩展区域
    { start: 2000, end: 2050 },  // 备用区域
  ];

  // 暴露父类的protected属性
  protected get knownRegisters() {
    return super['knownRegisters'] as Map<number, any>;
  }

  protected get lastValues() {
    return super['lastValues'] as Map<number, number>;
  }

  protected get monitoringInterval() {
    return super['monitoringInterval'] as NodeJS.Timeout | null;
  }

  protected set monitoringInterval(value: NodeJS.Timeout | null) {
    super['monitoringInterval'] = value;
  }

  constructor() {
    super();
  }

  // 暴露父类的broadcastMessage方法
  protected broadcastMessage(message: any) {
    return super['broadcastMessage'](message);
  }

  // 启用动态寄存器发现
  enableDynamicDiscovery(enabled: boolean = true) {
    this.scanningEnabled = enabled;
    this.broadcastMessage({
      type: 'monitor_config',
      data: { 
        dynamicDiscovery: enabled,
        monitoringRanges: this.scanRanges.length,
        totalKnownRegisters: this.getKnownRegistersCount()
      },
      timestamp: new Date().toISOString()
    });
  }

  // 获取已知寄存器数量
  private getKnownRegistersCount(): number {
    return this.knownRegisters.size + this.dynamicRegisters.size;
  }

  // 添加动态发现的寄存器
  addDynamicRegister(address: number, value: number, confidence: number = 0.5) {
    const existingReg = this.dynamicRegisters.get(address);
    
    if (!existingReg) {
      const registerInfo = this.analyzeRegisterPattern(address, value);
      this.dynamicRegisters.set(address, {
        address,
        name: registerInfo.name,
        type: registerInfo.type,
        confidence,
        discoveredAt: new Date().toISOString(),
        changeCount: 0,
        values: [value]
      });

      this.broadcastMessage({
        type: 'register_discovered',
        data: {
          address,
          name: registerInfo.name,
          type: registerInfo.type,
          value,
          confidence
        },
        timestamp: new Date().toISOString()
      });
    } else {
      // 更新已发现寄存器的置信度
      existingReg.values.push(value);
      if (existingReg.values.length > 10) {
        existingReg.values.shift(); // 只保留最近10个值
      }
      
      // 基于值的变化更新置信度
      const variance = this.calculateVariance(existingReg.values);
      if (variance > 1) {
        existingReg.confidence = Math.min(existingReg.confidence + 0.1, 1.0);
      }
    }
  }

  // 分析寄存器模式
  private analyzeRegisterPattern(address: number, value: number) {
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

  // 计算数值方差
  private calculateVariance(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    return variance;
  }

  // 扫描并发现新寄存器
  async discoverNewRegisters(): Promise<Map<number, number>> {
    if (!this.isConnected()) {
      throw new Error('Modbus 未连接');
    }

    const newRegisters = new Map<number, number>();
    let discovered = 0;

    for (const range of this.scanRanges) {
      console.log(`🔍 扫描范围 ${range.start}-${range.end}...`);
      
      for (let addr = range.start; addr <= range.end; addr += 5) {
        try {
          const count = Math.min(5, range.end - addr + 1);
          const data = await this.readRegister(addr, count);
          
          for (let i = 0; i < data.length; i++) {
            const address = addr + i;
            const value = data[i];
            
            // 跳过已知寄存器
            if (this.knownRegisters.has(address) || this.dynamicRegisters.has(address)) {
              continue;
            }
            
            if (value !== 0) {
              newRegisters.set(address, value);
              this.addDynamicRegister(address, value, 0.3);
              discovered++;
              
              console.log(`🎯 发现新寄存器 ${address}: ${value}`);
            }
          }
          
          // 避免过快请求
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          // 忽略读取错误，继续扫描
        }
      }
    }

    this.broadcastMessage({
      type: 'discovery_complete',
      data: {
        newRegistersCount: discovered,
        totalDynamicRegisters: this.dynamicRegisters.size,
        scanRanges: this.scanRanges
      },
      timestamp: new Date().toISOString()
    });

    return newRegisters;
  }

  // 增强的监控方法
  async startEnhancedMonitoring(interval: number = 2000) {
    this.stopMonitoring();

    // 如果启用了动态发现，先进行一次扫描
    if (this.scanningEnabled) {
      console.log('🔍 启动时进行动态寄存器发现...');
      try {
        await this.discoverNewRegisters();
      } catch (error) {
        console.error('动态发现失败:', error);
      }
    }

    this.monitoringInterval = setInterval(async () => {
      if (!this.isConnected()) return;

      try {
        // 监控已知寄存器
        await this.monitorKnownRegisters();
        
        // 监控动态发现的寄存器
        await this.monitorDynamicRegisters();
        
        // 定期重新发现（每10次监控循环一次）
        if (this.scanningEnabled && Math.random() < 0.1) {
          await this.discoverNewRegisters();
        }
        
      } catch (error) {
        console.error('增强监控错误:', error);
      }
    }, interval);

    console.log('✅ 启动增强监控，扫描间隔:', interval, 'ms');
  }

  // 监控已知寄存器
  private async monitorKnownRegisters() {
    const registers = await this.getAllRegisters();
    
    // 检查变化并广播
    const changes: any[] = [];
    for (const [address, data] of registers) {
      if (data.error) continue;
      
      const lastValue = this.lastValues.get(address);
      if (lastValue !== undefined && Math.abs(lastValue - data.rawValue) >= this.changeThreshold) {
        const registerInfo = this.knownRegisters.get(address);
        if (registerInfo) {
          changes.push({
            address,
            name: registerInfo.name,
            oldValue: lastValue,
            newValue: data.rawValue,
            type: registerInfo.type,
            category: 'known'
          });
        }
      }
      
      this.lastValues.set(address, data.rawValue);
    }

    // 广播更新和变化
    this.broadcastMessage({
      type: 'bulk_update',
      data: Array.from(registers.values()),
      timestamp: new Date().toISOString()
    });

    changes.forEach(change => {
      this.broadcastMessage({
        type: 'register_change',
        data: change,
        timestamp: new Date().toISOString()
      });
    });
  }

  // 监控动态寄存器
  private async monitorDynamicRegisters() {
    const dynamicChanges: any[] = [];

    for (const [address, regInfo] of this.dynamicRegisters) {
      try {
        const data = await this.readRegister(address, 1);
        const newValue = data[0];
        const lastValue = this.lastValues.get(address);

        if (lastValue !== undefined && Math.abs(lastValue - newValue) >= this.changeThreshold) {
          regInfo.changeCount++;
          regInfo.confidence = Math.min(regInfo.confidence + 0.05, 1.0);
          
          dynamicChanges.push({
            address,
            name: regInfo.name,
            oldValue: lastValue,
            newValue: newValue,
            type: regInfo.type,
            category: 'dynamic',
            confidence: regInfo.confidence,
            changeCount: regInfo.changeCount
          });
        }

        this.lastValues.set(address, newValue);
        regInfo.values = [newValue, ...(regInfo.values || [])].slice(0, 10);
        
      } catch (error) {
        // 降低无法读取寄存器的置信度
        regInfo.confidence = Math.max(regInfo.confidence - 0.02, 0.1);
      }
    }

    // 广播动态寄存器变化
    dynamicChanges.forEach(change => {
      this.broadcastMessage({
        type: 'dynamic_register_change',
        data: change,
        timestamp: new Date().toISOString()
      });
    });

    // 清理低置信度的动态寄存器
    for (const [address, regInfo] of this.dynamicRegisters) {
      if (regInfo.confidence < 0.2) {
        this.dynamicRegisters.delete(address);
        this.lastValues.delete(address);
        
        this.broadcastMessage({
          type: 'register_removed',
          data: { address, reason: 'low_confidence', confidence: regInfo.confidence },
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  // 获取所有寄存器（包括动态的）
  async getAllRegistersIncludingDynamic() {
    const results = await this.getAllRegisters();
    
    // 添加动态寄存器
    for (const [address, regInfo] of this.dynamicRegisters) {
      try {
        const values = await this.readRegister(address, 1);
        results.set(address, {
          address,
          name: regInfo.name,
          value: values[0],
          rawValue: values[0],
          type: regInfo.type,
          writable: false, // 动态发现的寄存器默认只读
          confidence: regInfo.confidence,
          category: 'dynamic',
          discoveredAt: regInfo.discoveredAt,
          changeCount: regInfo.changeCount,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        results.set(address, {
          address,
          name: regInfo.name,
          error: (error as Error).message,
          type: regInfo.type,
          category: 'dynamic',
          confidence: regInfo.confidence
        });
      }
    }
    
    return results;
  }

  // 设置变化阈值
  setChangeThreshold(threshold: number) {
    this.changeThreshold = threshold;
    this.broadcastMessage({
      type: 'config_updated',
      data: { changeThreshold: threshold },
      timestamp: new Date().toISOString()
    });
  }

  // 获取监控统计
  getMonitoringStats() {
    return {
      knownRegisters: this.knownRegisters.size,
      dynamicRegisters: this.dynamicRegisters.size,
      totalMonitored: this.knownRegisters.size + this.dynamicRegisters.size,
      scanRanges: this.scanRanges,
      changeThreshold: this.changeThreshold,
      scanningEnabled: this.scanningEnabled
    };
  }
}

// 单例实例
let enhancedMonitor: EnhancedModbusMonitor;

export function getEnhancedMonitor(): EnhancedModbusMonitor {
  if (!enhancedMonitor) {
    enhancedMonitor = new EnhancedModbusMonitor();
  }
  return enhancedMonitor;
}