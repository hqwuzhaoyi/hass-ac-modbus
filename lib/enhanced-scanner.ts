import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import path from 'path';

interface ScanRange {
  type: 'holding' | 'input' | 'coil' | 'discrete';
  start: number;
  end: number;
  priority?: number; // 0-10, 10最高
}

interface AdaptiveConfig {
  initialBatchSize: number;
  maxBatchSize: number;
  minBatchSize: number;
  timeoutThreshold: number; // ms
  errorThreshold: number; // 错误率
  scanDelay: number;
  parallelConnections: number;
}

interface ScanContext {
  totalScanned: number;
  found: number;
  errors: number;
  startTime: number;
  lastErrorTime: number;
  successRate: number;
  averageResponseTime: number;
  currentBatchSize: number;
}

export class EnhancedScanner extends EventEmitter {
  private clients: any[] = [];
  private config: AdaptiveConfig = {
    initialBatchSize: 10,
    maxBatchSize: 50,
    minBatchSize: 1,
    timeoutThreshold: 2000,
    errorThreshold: 0.3,
    scanDelay: 50,
    parallelConnections: 3
  };
  
  private context: ScanContext = {
    totalScanned: 0,
    found: 0,
    errors: 0,
    startTime: 0,
    lastErrorTime: 0,
    successRate: 1.0,
    averageResponseTime: 0,
    currentBatchSize: 10
  };

  private scanning = false;
  private aborted = false;

  constructor() {
    super();
  }

  async initializeClients(host: string, port: number = 502, unitId: number = 1): Promise<void> {
    if (typeof window !== 'undefined') {
      throw new Error('Scanner 仅在 Node.js 环境中可用');
    }

    try {
      const ModbusRTU = require('modbus-serial');
      
      // 创建多个并发连接
      for (let i = 0; i < this.config.parallelConnections; i++) {
        const client = new ModbusRTU();
        await client.connectTCP(host, { port });
        client.setID(unitId);
        client.setTimeout(5000);
        this.clients.push(client);
      }
      
      console.log(`✓ 创建了 ${this.clients.length} 个并行连接`);
    } catch (error) {
      throw new Error(`无法创建 Modbus 连接: ${error}`);
    }
  }

  // 智能优先级排序
  private prioritizeRanges(ranges: ScanRange[]): ScanRange[] {
    // 基于经验设置优先级
    const priorityMap = {
      holding: { 
        '1000-1100': 10, // 温度传感器区域
        '1030-1180': 9,  // 主控制区域
        '0-100': 7,      // 基础控制
        '2000-2100': 5   // 扩展区域
      },
      input: {
        '0-50': 6,
        '1000-1050': 8
      },
      coil: { '0-100': 4 },
      discrete: { '0-100': 3 }
    };

    return ranges.map(range => {
      const typeMap = priorityMap[range.type] || {};
      let priority = 1;
      
      for (const [rangeKey, p] of Object.entries(typeMap)) {
        const [start, end] = rangeKey.split('-').map(Number);
        if (range.start >= start && range.end <= end) {
          priority = Math.max(priority, p);
        }
      }
      
      return { ...range, priority };
    }).sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  // 自适应批大小调整
  private adjustBatchSize(): void {
    const { successRate, averageResponseTime, errors } = this.context;
    let newBatchSize = this.context.currentBatchSize;
    
    // 基于成功率调整
    if (successRate > 0.95 && averageResponseTime < this.config.timeoutThreshold) {
      // 高成功率且响应快 - 增大批大小
      newBatchSize = Math.min(newBatchSize * 1.2, this.config.maxBatchSize);
    } else if (successRate < 0.8 || averageResponseTime > this.config.timeoutThreshold) {
      // 成功率低或响应慢 - 减小批大小
      newBatchSize = Math.max(newBatchSize * 0.7, this.config.minBatchSize);
    }
    
    // 最近有错误 - 降低批大小
    if (Date.now() - this.context.lastErrorTime < 5000) {
      newBatchSize = Math.max(newBatchSize * 0.5, this.config.minBatchSize);
    }
    
    this.context.currentBatchSize = Math.round(newBatchSize);
    
    this.emit('batchSizeAdjusted', {
      oldSize: this.context.currentBatchSize,
      newSize: newBatchSize,
      reason: { successRate, averageResponseTime, recentErrors: errors }
    });
  }

  // 并行扫描实现
  private async scanRangeParallel(
    type: 'holding' | 'input' | 'coil' | 'discrete',
    start: number,
    end: number
  ): Promise<Record<number, number>> {
    const results: Record<number, number> = {};
    const chunks: Array<{start: number, end: number}> = [];
    
    // 将范围分成块，分配给不同的连接
    const totalRange = end - start + 1;
    const chunkSize = Math.ceil(totalRange / this.clients.length);
    
    for (let i = 0; i < this.clients.length && start + i * chunkSize <= end; i++) {
      const chunkStart = start + i * chunkSize;
      const chunkEnd = Math.min(chunkStart + chunkSize - 1, end);
      chunks.push({ start: chunkStart, end: chunkEnd });
    }

    // 并行处理块
    const promises = chunks.map(async (chunk, clientIndex) => {
      if (clientIndex >= this.clients.length) return {};
      
      const client = this.clients[clientIndex];
      const chunkResults: Record<number, number> = {};
      
      for (let addr = chunk.start; addr <= chunk.end; addr += this.context.currentBatchSize) {
        if (this.aborted) break;
        
        const batchEnd = Math.min(addr + this.context.currentBatchSize - 1, chunk.end);
        const count = batchEnd - addr + 1;
        
        const startTime = Date.now();
        
        try {
          let data: number[];
          
          switch (type) {
            case 'holding':
              data = (await client.readHoldingRegisters(addr, count)).data;
              break;
            case 'input':
              data = (await client.readInputRegisters(addr, count)).data;
              break;
            case 'coil':
              data = (await client.readCoils(addr, count)).data;
              break;
            case 'discrete':
              data = (await client.readDiscreteInputs(addr, count)).data;
              break;
            default:
              throw new Error(`未知类型: ${type}`);
          }
          
          // 更新统计
          const responseTime = Date.now() - startTime;
          this.updateStats(true, responseTime);
          
          // 记录非零值
          data.forEach((value, index) => {
            if (value !== 0) {
              const address = addr + index;
              chunkResults[address] = value;
              this.context.found++;
              
              this.emit('registerFound', {
                type,
                address,
                value,
                clientIndex
              });
            }
          });
          
        } catch (error) {
          this.updateStats(false, Date.now() - startTime);
          this.context.lastErrorTime = Date.now();
          
          // 批量失败时尝试单个读取
          await this.fallbackSingleRead(client, type, addr, batchEnd, chunkResults);
        }
        
        this.context.totalScanned += count;
        
        // 动态调整批大小
        if (this.context.totalScanned % 100 === 0) {
          this.adjustBatchSize();
        }
        
        // 适应性延迟
        const delay = this.calculateAdaptiveDelay();
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      return chunkResults;
    });
    
    const chunkResults = await Promise.all(promises);
    
    // 合并结果
    chunkResults.forEach(chunk => {
      Object.assign(results, chunk);
    });
    
    return results;
  }

  // 单个寄存器回退策略
  private async fallbackSingleRead(
    client: any,
    type: string,
    start: number,
    end: number,
    results: Record<number, number>
  ): Promise<void> {
    for (let addr = start; addr <= end; addr++) {
      try {
        let data: number[];
        
        switch (type) {
          case 'holding':
            data = (await client.readHoldingRegisters(addr, 1)).data;
            break;
          case 'input':
            data = (await client.readInputRegisters(addr, 1)).data;
            break;
          case 'coil':
            data = (await client.readCoils(addr, 1)).data;
            break;
          case 'discrete':
            data = (await client.readDiscreteInputs(addr, 1)).data;
            break;
          default:
            continue;
        }
        
        if (data[0] !== 0) {
          results[addr] = data[0];
          this.context.found++;
        }
        
      } catch (error) {
        // 忽略单个寄存器失败
      }
    }
  }

  // 统计更新
  private updateStats(success: boolean, responseTime: number): void {
    const total = this.context.totalScanned || 1;
    
    if (!success) {
      this.context.errors++;
    }
    
    this.context.successRate = (total - this.context.errors) / total;
    
    // 移动平均响应时间
    const alpha = 0.1;
    this.context.averageResponseTime = 
      this.context.averageResponseTime * (1 - alpha) + responseTime * alpha;
  }

  // 自适应延迟计算
  private calculateAdaptiveDelay(): number {
    const baseDelay = this.config.scanDelay;
    const errorRate = this.context.errors / (this.context.totalScanned || 1);
    
    // 高错误率时增加延迟
    if (errorRate > this.config.errorThreshold) {
      return baseDelay * 2;
    }
    
    // 响应慢时增加延迟
    if (this.context.averageResponseTime > this.config.timeoutThreshold) {
      return baseDelay * 1.5;
    }
    
    // 性能良好时减少延迟
    if (this.context.successRate > 0.98 && this.context.averageResponseTime < 500) {
      return baseDelay * 0.5;
    }
    
    return baseDelay;
  }

  // 增量扫描 - 只扫描变化的区域
  async incrementalScan(
    host: string,
    previousResults: Record<string, Record<number, number>>,
    ranges: ScanRange[]
  ): Promise<Record<string, Record<number, number>>> {
    console.log('开始增量扫描...');
    
    const results: Record<string, Record<number, number>> = {};
    
    // 首先快速检查已知有值的寄存器
    for (const [type, registers] of Object.entries(previousResults)) {
      const addresses = Object.keys(registers).map(Number);
      if (addresses.length > 0) {
        console.log(`检查 ${type} 类型的 ${addresses.length} 个已知寄存器...`);
        
        try {
          const quickResults = await this.quickScanAddresses(
            addresses, 
            type as any,
            this.clients[0]
          );
          
          results[type] = quickResults;
          
          // 检查是否有新的相邻寄存器
          await this.scanAdjacentRegisters(type as any, addresses, results[type]);
          
        } catch (error) {
          console.log(`快速扫描 ${type} 失败:`, error);
        }
      }
    }
    
    return results;
  }

  // 快速扫描指定地址
  private async quickScanAddresses(
    addresses: number[],
    type: 'holding' | 'input' | 'coil' | 'discrete',
    client: any
  ): Promise<Record<number, number>> {
    const results: Record<number, number> = {};
    
    // 按地址排序并分组连续区间
    addresses.sort((a, b) => a - b);
    const groups = this.groupConsecutiveAddresses(addresses);
    
    for (const group of groups) {
      try {
        const start = group[0];
        const count = group[group.length - 1] - start + 1;
        
        let data: number[];
        switch (type) {
          case 'holding':
            data = (await client.readHoldingRegisters(start, count)).data;
            break;
          case 'input':
            data = (await client.readInputRegisters(start, count)).data;
            break;
          case 'coil':
            data = (await client.readCoils(start, count)).data;
            break;
          case 'discrete':
            data = (await client.readDiscreteInputs(start, count)).data;
            break;
        }
        
        data.forEach((value, index) => {
          const addr = start + index;
          if (group.includes(addr) && value !== 0) {
            results[addr] = value;
          }
        });
        
      } catch (error) {
        // 组读取失败，逐个读取
        for (const addr of group) {
          try {
            let data: number[];
            switch (type) {
              case 'holding':
                data = (await client.readHoldingRegisters(addr, 1)).data;
                break;
              case 'input':
                data = (await client.readInputRegisters(addr, 1)).data;
                break;
              case 'coil':
                data = (await client.readCoils(addr, 1)).data;
                break;
              case 'discrete':
                data = (await client.readDiscreteInputs(addr, 1)).data;
                break;
            }
            
            if (data[0] !== 0) {
              results[addr] = data[0];
            }
          } catch (singleError) {
            // 忽略单个失败
          }
        }
      }
    }
    
    return results;
  }

  // 将地址分组为连续区间
  private groupConsecutiveAddresses(addresses: number[]): number[][] {
    const groups: number[][] = [];
    let currentGroup: number[] = [];
    
    for (let i = 0; i < addresses.length; i++) {
      if (currentGroup.length === 0 || addresses[i] === currentGroup[currentGroup.length - 1] + 1) {
        currentGroup.push(addresses[i]);
      } else {
        if (currentGroup.length > 0) {
          groups.push([...currentGroup]);
        }
        currentGroup = [addresses[i]];
      }
    }
    
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }
    
    return groups;
  }

  // 扫描相邻寄存器
  private async scanAdjacentRegisters(
    type: 'holding' | 'input' | 'coil' | 'discrete',
    knownAddresses: number[],
    results: Record<number, number>
  ): Promise<void> {
    const client = this.clients[0];
    const toCheck: number[] = [];
    
    // 为每个已知地址检查前后相邻的寄存器
    for (const addr of knownAddresses) {
      const candidates = [addr - 1, addr + 1];
      
      for (const candidate of candidates) {
        if (candidate >= 0 && candidate <= 65535 && !knownAddresses.includes(candidate)) {
          toCheck.push(candidate);
        }
      }
    }
    
    // 去重
    const uniqueToCheck = [...new Set(toCheck)];
    
    for (const addr of uniqueToCheck) {
      try {
        let data: number[];
        
        switch (type) {
          case 'holding':
            data = (await client.readHoldingRegisters(addr, 1)).data;
            break;
          case 'input':
            data = (await client.readInputRegisters(addr, 1)).data;
            break;
          case 'coil':
            data = (await client.readCoils(addr, 1)).data;
            break;
          case 'discrete':
            data = (await client.readDiscreteInputs(addr, 1)).data;
            break;
        }
        
        if (data[0] !== 0) {
          results[addr] = data[0];
          console.log(`发现新的相邻寄存器 ${addr}: ${data[0]}`);
        }
        
      } catch (error) {
        // 忽略相邻寄存器读取失败
      }
    }
  }

  // 主扫描方法
  async enhancedScan(
    host: string,
    ranges: ScanRange[],
    previousResults?: Record<string, Record<number, number>>
  ): Promise<Record<string, Record<number, number>>> {
    if (this.scanning) {
      throw new Error('扫描已在进行中');
    }

    this.scanning = true;
    this.aborted = false;
    this.context = {
      totalScanned: 0,
      found: 0,
      errors: 0,
      startTime: Date.now(),
      lastErrorTime: 0,
      successRate: 1.0,
      averageResponseTime: 0,
      currentBatchSize: this.config.initialBatchSize
    };

    try {
      await this.initializeClients(host);
      
      // 如果有历史结果，优先进行增量扫描
      if (previousResults && Object.keys(previousResults).length > 0) {
        console.log('执行增量扫描...');
        const incrementalResults = await this.incrementalScan(host, previousResults, ranges);
        
        // 检查是否需要全量扫描
        const foundRatio = Object.values(incrementalResults).reduce((sum, regs) => 
          sum + Object.keys(regs).length, 0) / 
          Object.values(previousResults).reduce((sum, regs) => 
            sum + Object.keys(regs).length, 0);
        
        if (foundRatio > 0.7) { // 如果找到了70%以上的历史寄存器，跳过全量扫描
          console.log('增量扫描完成，跳过全量扫描');
          return incrementalResults;
        }
      }
      
      console.log('执行智能全量扫描...');
      
      // 按优先级排序
      const prioritizedRanges = this.prioritizeRanges(ranges);
      const results: Record<string, Record<number, number>> = {};
      
      for (const range of prioritizedRanges) {
        if (this.aborted) break;
        
        console.log(`扫描 ${range.type} [${range.start}-${range.end}] (优先级: ${range.priority})...`);
        
        const rangeResults = await this.scanRangeParallel(
          range.type,
          range.start,
          range.end
        );
        
        results[range.type] = { ...(results[range.type] || {}), ...rangeResults };
        
        const foundInRange = Object.keys(rangeResults).length;
        console.log(`  发现 ${foundInRange} 个寄存器`);
        
        this.emit('rangeComplete', {
          type: range.type,
          start: range.start,
          end: range.end,
          found: foundInRange,
          priority: range.priority
        });
        
        // 如果高优先级区域找到很多寄存器，可以跳过低优先级区域
        if (range.priority >= 8 && foundInRange > 50) {
          console.log('高优先级区域发现大量寄存器，跳过低优先级区域');
          break;
        }
      }
      
      return results;
      
    } finally {
      this.cleanup();
      this.scanning = false;
      
      const duration = Date.now() - this.context.startTime;
      console.log(`扫描完成: ${this.context.found} 个寄存器，耗时 ${duration}ms`);
      console.log(`成功率: ${(this.context.successRate * 100).toFixed(1)}%`);
    }
  }

  private cleanup(): void {
    for (const client of this.clients) {
      if (client && client.isOpen) {
        client.close();
      }
    }
    this.clients = [];
  }

  abort(): void {
    this.aborted = true;
    this.cleanup();
  }
}