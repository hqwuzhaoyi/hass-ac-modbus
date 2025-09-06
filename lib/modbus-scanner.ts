import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import path from 'path';

export interface ScanConfig {
  ranges: Array<{
    type: 'holding' | 'input' | 'coil' | 'discrete';
    start: number;
    end: number;
  }>;
  batchSize: number;
  scanDelay: number;
}

export interface ScanResult {
  timestamp: string;
  host: string;
  port: number;
  unitId: number;
  results: Record<string, Record<number, number>>;
  errors: string[];
  summary: {
    totalRegisters: number;
    foundRegisters: number;
    scanDuration: number;
  };
}

export class ModbusScanner extends EventEmitter {
  private client: any;
  private config: ScanConfig;
  private scanning = false;
  private aborted = false;

  constructor() {
    super();
    
    // 默认扫描配置
    this.config = {
      ranges: [
        { type: 'holding', start: 0, end: 100 },
        { type: 'input', start: 0, end: 100 },
        { type: 'coil', start: 0, end: 100 },
        { type: 'discrete', start: 0, end: 100 }
      ],
      batchSize: 10,
      scanDelay: 100
    };

    // 动态导入 modbus-serial
    if (typeof window === 'undefined') {
      try {
        const ModbusRTU = require('modbus-serial');
        this.client = new ModbusRTU();
      } catch (error) {
        console.warn('modbus-serial 不可用');
      }
    }
  }

  async connect(host: string, port: number = 502, unitId: number = 1): Promise<boolean> {
    if (!this.client) {
      throw new Error('Modbus 客户端不可用');
    }

    try {
      await this.client.connectTCP(host, { port });
      this.client.setID(unitId);
      this.client.setTimeout(5000);
      
      console.log(`✓ 连接到 Modbus 设备: ${host}:${port} (Unit ID: ${unitId})`);
      return true;
    } catch (error) {
      console.error('连接失败:', error);
      throw error;
    }
  }

  setConfig(config: Partial<ScanConfig>): void {
    this.config = { ...this.config, ...config };
  }

  async scanAll(host: string, port: number = 502, unitId: number = 1): Promise<ScanResult> {
    if (this.scanning) {
      throw new Error('扫描已在进行中');
    }

    this.scanning = true;
    this.aborted = false;
    const startTime = Date.now();

    const result: ScanResult = {
      timestamp: new Date().toISOString(),
      host,
      port,
      unitId,
      results: {},
      errors: [],
      summary: {
        totalRegisters: 0,
        foundRegisters: 0,
        scanDuration: 0
      }
    };

    try {
      await this.connect(host, port, unitId);

      console.log('开始全面扫描...');
      this.emit('scanStart', this.config);

      for (const range of this.config.ranges) {
        if (this.aborted) break;

        console.log(`扫描 ${range.type} 寄存器 ${range.start}-${range.end}...`);
        
        const registers = await this.scanRange(range.type, range.start, range.end);
        result.results[range.type] = registers;
        
        const foundCount = Object.keys(registers).length;
        console.log(`  发现 ${foundCount} 个有效寄存器`);
        
        this.emit('rangeComplete', {
          type: range.type,
          start: range.start,
          end: range.end,
          found: foundCount,
          registers
        });
      }

    } catch (error) {
      result.errors.push((error as Error).message);
      this.emit('error', error);
    } finally {
      if (this.client && this.client.isOpen) {
        this.client.close();
      }
      
      const endTime = Date.now();
      result.summary.scanDuration = endTime - startTime;
      
      // 计算统计信息
      Object.values(result.results).forEach(registers => {
        result.summary.foundRegisters += Object.keys(registers).length;
      });
      
      result.summary.totalRegisters = this.config.ranges.reduce(
        (total, range) => total + (range.end - range.start + 1), 0
      );

      this.scanning = false;
      this.emit('scanComplete', result);
      
      console.log(`扫描完成! 发现 ${result.summary.foundRegisters}/${result.summary.totalRegisters} 个寄存器`);
      console.log(`扫描耗时: ${result.summary.scanDuration}ms`);
    }

    return result;
  }

  private async scanRange(
    type: 'holding' | 'input' | 'coil' | 'discrete', 
    start: number, 
    end: number
  ): Promise<Record<number, number>> {
    const results: Record<number, number> = {};
    
    for (let addr = start; addr <= end; addr += this.config.batchSize) {
      if (this.aborted) break;
      
      const batchEnd = Math.min(addr + this.config.batchSize - 1, end);
      const count = batchEnd - addr + 1;
      
      try {
        let data: number[];
        
        switch (type) {
          case 'holding':
            data = (await this.client.readHoldingRegisters(addr, count)).data;
            break;
          case 'input':
            data = (await this.client.readInputRegisters(addr, count)).data;
            break;
          case 'coil':
            data = (await this.client.readCoils(addr, count)).data;
            break;
          case 'discrete':
            data = (await this.client.readDiscreteInputs(addr, count)).data;
            break;
          default:
            throw new Error(`未知寄存器类型: ${type}`);
        }
        
        // 记录非零值
        data.forEach((value, index) => {
          const address = addr + index;
          if (value !== 0) {
            results[address] = value;
            this.emit('registerFound', {
              type,
              address,
              value
            });
          }
        });
        
      } catch (error) {
        // 批量读取失败时，尝试单个读取
        for (let singleAddr = addr; singleAddr <= batchEnd; singleAddr++) {
          try {
            let data: number[];
            
            switch (type) {
              case 'holding':
                data = (await this.client.readHoldingRegisters(singleAddr, 1)).data;
                break;
              case 'input':
                data = (await this.client.readInputRegisters(singleAddr, 1)).data;
                break;
              case 'coil':
                data = (await this.client.readCoils(singleAddr, 1)).data;
                break;
              case 'discrete':
                data = (await this.client.readDiscreteInputs(singleAddr, 1)).data;
                break;
              default:
                continue;
            }
            
            if (data[0] !== 0) {
              results[singleAddr] = data[0];
              this.emit('registerFound', {
                type,
                address: singleAddr,
                value: data[0]
              });
            }
          } catch (singleError) {
            // 忽略单个寄存器的读取错误
          }
        }
      }
      
      // 进度更新
      this.emit('progress', {
        type,
        current: Math.min(batchEnd, end),
        total: end,
        found: Object.keys(results).length
      });
      
      // 扫描延迟
      if (this.config.scanDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, this.config.scanDelay));
      }
    }
    
    return results;
  }

  async quickScan(host: string, addresses: number[], type: 'holding' | 'input' | 'coil' | 'discrete' = 'holding'): Promise<Record<number, number>> {
    if (!this.client) {
      throw new Error('Modbus 客户端不可用');
    }

    const results: Record<number, number> = {};
    
    try {
      await this.connect(host);
      
      console.log(`快速扫描 ${addresses.length} 个 ${type} 寄存器...`);
      
      for (const addr of addresses) {
        try {
          let data: number[];
          
          switch (type) {
            case 'holding':
              data = (await this.client.readHoldingRegisters(addr, 1)).data;
              break;
            case 'input':
              data = (await this.client.readInputRegisters(addr, 1)).data;
              break;
            case 'coil':
              data = (await this.client.readCoils(addr, 1)).data;
              break;
            case 'discrete':
              data = (await this.client.readDiscreteInputs(addr, 1)).data;
              break;
          }
          
          results[addr] = data[0];
          console.log(`  ${addr}: ${data[0]}`);
          
        } catch (error) {
          console.log(`  ${addr}: 读取失败`);
        }
        
        // 小延迟
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
    } finally {
      if (this.client && this.client.isOpen) {
        this.client.close();
      }
    }
    
    return results;
  }

  async saveScanResult(result: ScanResult): Promise<string> {
    const timestamp = result.timestamp.replace(/[:.]/g, '-');
    const filename = `scan-results-${timestamp}.json`;
    const filepath = path.join(process.cwd(), 'logs', filename);
    
    await fs.writeFile(filepath, JSON.stringify(result, null, 2));
    console.log(`扫描结果已保存到: ${filename}`);
    
    return filepath;
  }

  abort(): void {
    this.aborted = true;
    console.log('扫描已中止');
    this.emit('scanAborted');
  }

  isScanning(): boolean {
    return this.scanning;
  }

  disconnect(): void {
    if (this.client && this.client.isOpen) {
      this.client.close();
    }
  }
}