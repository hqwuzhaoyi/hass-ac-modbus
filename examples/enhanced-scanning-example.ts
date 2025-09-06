#!/usr/bin/env ts-node

import { EnhancedScanner } from '../lib/enhanced-scanner';
import { promises as fs } from 'fs';
import path from 'path';

async function runEnhancedScan() {
  const scanner = new EnhancedScanner();
  
  // 监听扫描事件
  scanner.on('registerFound', (data) => {
    console.log(`🎯 发现寄存器: ${data.type}[${data.address}] = ${data.value} (连接${data.clientIndex})`);
  });
  
  scanner.on('batchSizeAdjusted', (data) => {
    console.log(`📏 批大小调整: ${data.oldSize} -> ${data.newSize}`);
    console.log(`   原因: 成功率${(data.reason.successRate * 100).toFixed(1)}%, 响应${data.reason.averageResponseTime}ms`);
  });
  
  scanner.on('rangeComplete', (data) => {
    console.log(`✅ ${data.type} 范围完成: [${data.start}-${data.end}] 发现${data.found}个 (优先级${data.priority})`);
  });
  
  try {
    // 定义扫描范围
    const ranges = [
      // 高优先级：主控制区域
      { type: 'holding' as const, start: 1030, end: 1180, priority: 10 },
      
      // 高优先级：温度传感器
      { type: 'holding' as const, start: 1000, end: 1030, priority: 9 },
      
      // 中优先级：基础控制
      { type: 'holding' as const, start: 0, end: 100, priority: 7 },
      { type: 'input' as const, start: 0, end: 50, priority: 6 },
      
      // 低优先级：扩展区域
      { type: 'holding' as const, start: 2000, end: 2100, priority: 5 },
      { type: 'coil' as const, start: 0, end: 100, priority: 4 },
      { type: 'discrete' as const, start: 0, end: 100, priority: 3 }
    ];
    
    // 尝试加载历史扫描结果
    let previousResults: Record<string, Record<number, number>> | undefined;
    
    try {
      const historyPath = path.join(process.cwd(), 'logs', 'last-scan-results.json');
      const historyData = await fs.readFile(historyPath, 'utf8');
      const history = JSON.parse(historyData);
      
      if (history.results && Object.keys(history.results).length > 0) {
        previousResults = history.results;
        console.log('📚 加载了历史扫描结果，将进行增量扫描');
      }
    } catch (error) {
      console.log('📝 未找到历史结果，将进行全量扫描');
    }
    
    console.log('🚀 开始增强扫描...');
    const startTime = Date.now();
    
    // 执行增强扫描
    const results = await scanner.enhancedScan(
      '192.168.2.200',
      ranges,
      previousResults
    );
    
    const duration = Date.now() - startTime;
    const totalFound = Object.values(results).reduce((sum, regs) => sum + Object.keys(regs).length, 0);
    
    console.log(`\n🎉 扫描完成!`);
    console.log(`⏱️  总耗时: ${duration}ms`);
    console.log(`📊 发现寄存器: ${totalFound} 个`);
    
    // 分析结果
    console.log('\n📋 扫描结果详情:');
    Object.entries(results).forEach(([type, registers]) => {
      if (Object.keys(registers).length > 0) {
        console.log(`\n${type.toUpperCase()} 寄存器 (${Object.keys(registers).length} 个):`);
        
        Object.entries(registers).forEach(([addr, value]) => {
          let analysis = analyzeRegisterValue(parseInt(addr), value);
          console.log(`  ${addr}: ${value} (0x${value.toString(16).padStart(4, '0')}) ${analysis}`);
        });
      }
    });
    
    // 保存结果
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsPath = path.join(process.cwd(), 'logs', `enhanced-scan-${timestamp}.json`);
    const lastResultsPath = path.join(process.cwd(), 'logs', 'last-scan-results.json');
    
    const output = {
      timestamp: new Date().toISOString(),
      host: '192.168.2.200',
      duration,
      totalFound,
      results,
      analysis: generateAnalysis(results),
      config: {
        ranges: ranges,
        usedIncremental: !!previousResults
      }
    };
    
    await fs.writeFile(resultsPath, JSON.stringify(output, null, 2));
    await fs.writeFile(lastResultsPath, JSON.stringify(output, null, 2)); // 保存为最新结果
    
    console.log(`\n💾 结果已保存到: ${path.basename(resultsPath)}`);
    
    // 生成建议的配置文件
    await generateSuggestedConfig(results);
    
  } catch (error) {
    console.error('❌ 扫描失败:', error);
    process.exit(1);
  }
}

function analyzeRegisterValue(address: number, value: number): string {
  let suggestions: string[] = [];
  
  // 温度检测
  if (value >= 150 && value <= 350) {
    suggestions.push(`可能是温度 ${(value * 0.1).toFixed(1)}°C`);
  } else if (value >= 15 && value <= 35) {
    suggestions.push(`可能是温度 ${value}°C`);
  }
  
  // 模式/档位检测
  if (value >= 0 && value <= 10) {
    const modes = ['关闭', '制冷', '制热', '自动', '送风', '除湿'];
    if (modes[value]) {
      suggestions.push(`可能是模式: ${modes[value]}`);
    }
  }
  
  // 开关状态
  if (value === 1 || value === 0) {
    suggestions.push(`开关状态: ${value ? '开启' : '关闭'}`);
  }
  
  // 百分比值
  if (value >= 0 && value <= 100) {
    suggestions.push(`可能是百分比: ${value}%`);
  }
  
  // 基于地址的推测
  if (address >= 1000 && address <= 1030) {
    suggestions.push('温度传感器区域');
  } else if (address >= 1030 && address <= 1180) {
    suggestions.push('主控制区域');
  }
  
  return suggestions.length > 0 ? `- ${suggestions.join(', ')}` : '';
}

function generateAnalysis(results: Record<string, Record<number, number>>): any {
  const analysis = {
    temperatureRegisters: [] as number[],
    controlRegisters: [] as number[],
    switchRegisters: [] as number[],
    percentageRegisters: [] as number[],
    unknownRegisters: [] as number[]
  };
  
  Object.entries(results).forEach(([type, registers]) => {
    Object.entries(registers).forEach(([addr, value]) => {
      const address = parseInt(addr);
      
      if (value >= 150 && value <= 350) {
        analysis.temperatureRegisters.push(address);
      } else if (value >= 15 && value <= 35) {
        analysis.temperatureRegisters.push(address);
      } else if (value >= 0 && value <= 10) {
        analysis.controlRegisters.push(address);
      } else if (value === 0 || value === 1) {
        analysis.switchRegisters.push(address);
      } else if (value >= 0 && value <= 100) {
        analysis.percentageRegisters.push(address);
      } else {
        analysis.unknownRegisters.push(address);
      }
    });
  });
  
  return analysis;
}

async function generateSuggestedConfig(results: Record<string, Record<number, number>>): Promise<void> {
  const analysis = generateAnalysis(results);
  
  const config = {
    connection: {
      host: "192.168.2.200",
      port: 502,
      unitId: 1,
      timeout: 5000
    },
    knownRegisters: {} as any
  };
  
  // 生成配置建议
  if (analysis.temperatureRegisters.length > 0) {
    const addr = analysis.temperatureRegisters[0];
    const value = Object.values(results).find(regs => regs[addr])?.[addr];
    
    config.knownRegisters.temperature = {
      address: addr,
      type: "holding",
      dataType: "int16",
      scale: value && value > 100 ? 0.1 : 1,
      unit: "°C",
      description: "室内温度"
    };
  }
  
  if (analysis.controlRegisters.length > 0) {
    config.knownRegisters.mode = {
      address: analysis.controlRegisters[0],
      type: "holding", 
      dataType: "int16",
      values: {
        "0": "off",
        "1": "cool", 
        "2": "heat",
        "3": "auto",
        "4": "fan"
      },
      description: "运行模式"
    };
  }
  
  if (analysis.switchRegisters.length > 0) {
    config.knownRegisters.power = {
      address: analysis.switchRegisters[0],
      type: "holding",
      dataType: "boolean", 
      description: "电源开关"
    };
  }
  
  const configPath = path.join(process.cwd(), 'config', 'enhanced-scan-config.json');
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
  
  console.log(`\n🔧 建议配置已生成: ${path.basename(configPath)}`);
  console.log('📊 分析汇总:');
  console.log(`   温度寄存器: ${analysis.temperatureRegisters.length} 个`);
  console.log(`   控制寄存器: ${analysis.controlRegisters.length} 个`);  
  console.log(`   开关寄存器: ${analysis.switchRegisters.length} 个`);
  console.log(`   未知寄存器: ${analysis.unknownRegisters.length} 个`);
}

// 运行示例
if (require.main === module) {
  runEnhancedScan().catch(console.error);
}

export { runEnhancedScan };