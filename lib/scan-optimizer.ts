import { EnhancedScanner } from './enhanced-scanner';
import { promises as fs } from 'fs';
import path from 'path';

export interface OptimizationConfig {
  // 扫描优化参数
  maxConcurrentScans: number;
  adaptiveBatching: boolean;
  priorityBasedScanning: boolean;
  incrementalScanning: boolean;
  
  // 性能参数
  responseTimeThreshold: number; // ms
  errorRateThreshold: number;    // 0-1
  minBatchSize: number;
  maxBatchSize: number;
  
  // 智能分析
  enablePatternRecognition: boolean;
  saveAnalysisHistory: boolean;
}

export class ScanOptimizer {
  private config: OptimizationConfig = {
    maxConcurrentScans: 3,
    adaptiveBatching: true,
    priorityBasedScanning: true,
    incrementalScanning: true,
    responseTimeThreshold: 1000,
    errorRateThreshold: 0.1,
    minBatchSize: 1,
    maxBatchSize: 25,
    enablePatternRecognition: true,
    saveAnalysisHistory: true
  };

  private scanHistory: Array<{
    timestamp: string;
    results: Record<string, Record<number, number>>;
    performance: {
      duration: number;
      totalRegisters: number;
      foundRegisters: number;
      errorRate: number;
      averageResponseTime: number;
    };
  }> = [];

  constructor(config?: Partial<OptimizationConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  // 加载扫描历史
  async loadScanHistory(): Promise<void> {
    try {
      const historyPath = path.join(process.cwd(), 'logs', 'scan-history.json');
      const data = await fs.readFile(historyPath, 'utf8');
      this.scanHistory = JSON.parse(data);
      console.log(`📚 加载了 ${this.scanHistory.length} 条扫描历史`);
    } catch (error) {
      console.log('📝 未找到扫描历史，将创建新的历史记录');
      this.scanHistory = [];
    }
  }

  // 智能范围推荐
  generateOptimalRanges(deviceType?: string): Array<{
    type: 'holding' | 'input' | 'coil' | 'discrete';
    start: number;
    end: number;
    priority: number;
  }> {
    // 基于历史数据和设备类型推荐扫描范围
    const baseRanges = [
      // 高优先级：常见的空调控制区域
      { type: 'holding' as const, start: 1030, end: 1060, priority: 10 },
      { type: 'holding' as const, start: 1000, end: 1030, priority: 9 },
      
      // 中高优先级：扩展控制区域  
      { type: 'holding' as const, start: 1060, end: 1120, priority: 8 },
      { type: 'holding' as const, start: 1120, end: 1180, priority: 7 },
      
      // 中优先级：基础寄存器
      { type: 'holding' as const, start: 0, end: 50, priority: 6 },
      { type: 'input' as const, start: 0, end: 50, priority: 5 },
      
      // 低优先级：其他区域
      { type: 'holding' as const, start: 2000, end: 2050, priority: 4 },
      { type: 'coil' as const, start: 0, end: 100, priority: 3 }
    ];

    // 基于历史成功率调整优先级
    if (this.scanHistory.length > 0) {
      return this.adjustRangesByHistory(baseRanges);
    }

    return baseRanges;
  }

  // 基于历史调整范围优先级
  private adjustRangesByHistory(ranges: any[]): any[] {
    const rangeStats = new Map<string, { found: number, scanned: number }>();
    
    // 分析历史数据
    this.scanHistory.forEach(scan => {
      Object.entries(scan.results).forEach(([type, registers]) => {
        Object.keys(registers).forEach(addr => {
          const address = parseInt(addr);
          
          // 找到对应的范围
          const range = ranges.find(r => 
            r.type === type && address >= r.start && address <= r.end
          );
          
          if (range) {
            const key = `${range.type}-${range.start}-${range.end}`;
            const stats = rangeStats.get(key) || { found: 0, scanned: 0 };
            stats.found++;
            rangeStats.set(key, stats);
          }
        });
      });
    });

    // 基于成功率调整优先级
    return ranges.map(range => {
      const key = `${range.type}-${range.start}-${range.end}`;
      const stats = rangeStats.get(key);
      
      if (stats && stats.found > 5) {
        // 历史中发现较多寄存器的范围，提高优先级
        range.priority = Math.min(range.priority + 2, 10);
      } else if (stats && stats.found === 0) {
        // 历史中从未发现寄存器的范围，降低优先级
        range.priority = Math.max(range.priority - 2, 1);
      }
      
      return range;
    }).sort((a, b) => b.priority - a.priority);
  }

  // 执行优化扫描
  async optimizedScan(host: string, port: number = 502): Promise<{
    results: Record<string, Record<number, number>>;
    performance: any;
    recommendations: string[];
  }> {
    console.log('🚀 启动优化扫描...');
    
    await this.loadScanHistory();
    const scanner = new EnhancedScanner();
    const startTime = Date.now();
    
    // 生成优化的扫描范围
    const ranges = this.generateOptimalRanges();
    console.log(`📋 生成了 ${ranges.length} 个优化扫描范围`);
    
    // 检查是否可以进行增量扫描
    let previousResults: Record<string, Record<number, number>> | undefined;
    
    if (this.config.incrementalScanning && this.scanHistory.length > 0) {
      const lastScan = this.scanHistory[this.scanHistory.length - 1];
      const timeSinceLastScan = Date.now() - new Date(lastScan.timestamp).getTime();
      
      // 如果最近24小时内有扫描记录，使用增量扫描
      if (timeSinceLastScan < 24 * 60 * 60 * 1000) {
        previousResults = lastScan.results;
        console.log('📈 启用增量扫描模式');
      }
    }
    
    // 执行扫描
    const results = await scanner.enhancedScan(host, ranges, previousResults);
    
    const duration = Date.now() - startTime;
    const totalFound = Object.values(results).reduce((sum, regs) => sum + Object.keys(regs).length, 0);
    const totalScanned = ranges.reduce((sum, range) => sum + (range.end - range.start + 1), 0);
    
    // 性能统计
    const performance = {
      duration,
      totalRegisters: totalScanned,
      foundRegisters: totalFound,
      efficiency: totalFound / totalScanned,
      averageTimePerRegister: duration / totalScanned,
      scanMode: previousResults ? 'incremental' : 'full'
    };
    
    // 保存扫描历史
    if (this.config.saveAnalysisHistory) {
      this.scanHistory.push({
        timestamp: new Date().toISOString(),
        results,
        performance: {
          duration,
          totalRegisters: totalScanned,
          foundRegisters: totalFound,
          errorRate: 0, // scanner会提供真实的错误率
          averageResponseTime: performance.averageTimePerRegister
        }
      });
      
      // 只保留最近20次扫描记录
      if (this.scanHistory.length > 20) {
        this.scanHistory = this.scanHistory.slice(-20);
      }
      
      await this.saveScanHistory();
    }
    
    // 生成优化建议
    const recommendations = this.generateRecommendations(results, performance);
    
    console.log(`✅ 优化扫描完成: 发现 ${totalFound} 个寄存器，耗时 ${duration}ms`);
    console.log(`📊 扫描效率: ${(performance.efficiency * 100).toFixed(2)}%`);
    
    return { results, performance, recommendations };
  }

  // 保存扫描历史
  private async saveScanHistory(): Promise<void> {
    try {
      const historyPath = path.join(process.cwd(), 'logs', 'scan-history.json');
      await fs.writeFile(historyPath, JSON.stringify(this.scanHistory, null, 2));
    } catch (error) {
      console.warn('警告: 无法保存扫描历史:', error);
    }
  }

  // 生成优化建议
  private generateRecommendations(
    results: Record<string, Record<number, number>>,
    performance: any
  ): string[] {
    const recommendations: string[] = [];
    
    // 基于效率给出建议
    if (performance.efficiency < 0.05) {
      recommendations.push('扫描效率较低，建议缩小扫描范围或调整设备配置');
    } else if (performance.efficiency > 0.2) {
      recommendations.push('扫描效率很高，可以考虑扩大扫描范围');
    }
    
    // 基于响应时间给出建议
    if (performance.averageTimePerRegister > 50) {
      recommendations.push('响应时间较慢，建议检查网络连接或减小批处理大小');
    }
    
    // 基于发现的寄存器类型给出建议
    const hasTemperature = Object.values(results).some(regs =>
      Object.values(regs).some(val => val >= 150 && val <= 350)
    );
    
    const hasControl = Object.values(results).some(regs =>
      Object.values(regs).some(val => val >= 0 && val <= 10)
    );
    
    if (hasTemperature) {
      recommendations.push('发现疑似温度寄存器，建议配置温度监控');
    }
    
    if (hasControl) {
      recommendations.push('发现疑似控制寄存器，建议进行功能测试');
    }
    
    // 基于历史趋势给出建议
    if (this.scanHistory.length >= 3) {
      const recentScans = this.scanHistory.slice(-3);
      const avgFound = recentScans.reduce((sum, scan) => 
        sum + scan.performance.foundRegisters, 0) / recentScans.length;
      
      if (performance.foundRegisters > avgFound * 1.5) {
        recommendations.push('本次扫描发现的寄存器明显增多，建议检查设备状态变化');
      } else if (performance.foundRegisters < avgFound * 0.5) {
        recommendations.push('本次扫描发现的寄存器减少，可能设备配置发生变化');
      }
    }
    
    return recommendations;
  }

  // 获取扫描统计
  getScanStatistics(): {
    totalScans: number;
    averageRegistersFound: number;
    bestScanEfficiency: number;
    recommendedRanges: string[];
  } {
    if (this.scanHistory.length === 0) {
      return {
        totalScans: 0,
        averageRegistersFound: 0,
        bestScanEfficiency: 0,
        recommendedRanges: []
      };
    }
    
    const avgFound = this.scanHistory.reduce((sum, scan) => 
      sum + scan.performance.foundRegisters, 0) / this.scanHistory.length;
    
    const bestEfficiency = Math.max(...this.scanHistory.map(scan => 
      scan.performance.foundRegisters / scan.performance.totalRegisters));
    
    // 统计最有效的地址范围
    const addressFrequency = new Map<number, number>();
    
    this.scanHistory.forEach(scan => {
      Object.values(scan.results).forEach(registers => {
        Object.keys(registers).forEach(addr => {
          const address = parseInt(addr);
          addressFrequency.set(address, (addressFrequency.get(address) || 0) + 1);
        });
      });
    });
    
    // 找出最常出现的地址范围
    const sortedAddresses = Array.from(addressFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([addr]) => addr);
    
    const recommendedRanges = this.groupConsecutiveAddresses(sortedAddresses)
      .map(group => `${group[0]}-${group[group.length - 1]}`);
    
    return {
      totalScans: this.scanHistory.length,
      averageRegistersFound: Math.round(avgFound),
      bestScanEfficiency: Math.round(bestEfficiency * 100),
      recommendedRanges
    };
  }

  private groupConsecutiveAddresses(addresses: number[]): number[][] {
    if (addresses.length === 0) return [];
    
    addresses.sort((a, b) => a - b);
    const groups: number[][] = [];
    let currentGroup: number[] = [addresses[0]];
    
    for (let i = 1; i < addresses.length; i++) {
      if (addresses[i] === addresses[i - 1] + 1) {
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
}