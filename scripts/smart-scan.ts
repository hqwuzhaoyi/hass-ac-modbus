#!/usr/bin/env ts-node

import { ScanOptimizer } from '../lib/scan-optimizer';
import { program } from 'commander';
import chalk from 'chalk';

program
  .name('smart-scan')
  .description('智能Modbus扫描工具')
  .version('1.0.0');

program
  .command('scan')
  .description('执行智能优化扫描')
  .option('-h, --host <host>', 'Modbus主机地址', '192.168.2.200')
  .option('-p, --port <port>', 'Modbus端口', '502')
  .option('--no-incremental', '禁用增量扫描')
  .option('--no-adaptive', '禁用自适应批处理')
  .option('--parallel <count>', '并发连接数', '3')
  .action(async (options) => {
    console.log(chalk.blue.bold('🚀 启动智能Modbus扫描器\n'));
    
    const optimizer = new ScanOptimizer({
      incrementalScanning: options.incremental,
      adaptiveBatching: options.adaptive,
      maxConcurrentScans: parseInt(options.parallel)
    });
    
    try {
      const result = await optimizer.optimizedScan(options.host, parseInt(options.port));
      
      console.log(chalk.green.bold('\n✅ 扫描完成!'));
      console.log(chalk.cyan(`📊 性能统计:`));
      console.log(`   扫描时长: ${result.performance.duration}ms`);
      console.log(`   发现寄存器: ${result.performance.foundRegisters} 个`);
      console.log(`   扫描效率: ${(result.performance.efficiency * 100).toFixed(2)}%`);
      console.log(`   扫描模式: ${result.performance.scanMode}`);
      
      if (result.recommendations.length > 0) {
        console.log(chalk.yellow.bold('\n💡 优化建议:'));
        result.recommendations.forEach(rec => {
          console.log(`   • ${rec}`);
        });
      }
      
    } catch (error) {
      console.error(chalk.red.bold('❌ 扫描失败:'), error);
      process.exit(1);
    }
  });

program
  .command('stats')
  .description('显示扫描统计信息')
  .action(async () => {
    console.log(chalk.blue.bold('📈 扫描统计信息\n'));
    
    const optimizer = new ScanOptimizer();
    await optimizer.loadScanHistory();
    
    const stats = optimizer.getScanStatistics();
    
    console.log(chalk.cyan('总扫描次数:'), stats.totalScans);
    console.log(chalk.cyan('平均发现寄存器:'), stats.averageRegistersFound);
    console.log(chalk.cyan('最佳扫描效率:'), `${stats.bestScanEfficiency}%`);
    
    if (stats.recommendedRanges.length > 0) {
      console.log(chalk.cyan('推荐扫描范围:'));
      stats.recommendedRanges.forEach(range => {
        console.log(`   • ${range}`);
      });
    }
  });

program
  .command('compare')
  .description('对比不同扫描策略的性能')
  .option('-h, --host <host>', 'Modbus主机地址', '192.168.2.200')
  .action(async (options) => {
    console.log(chalk.blue.bold('🔍 对比扫描策略性能\n'));
    
    // 基础扫描
    console.log(chalk.yellow('测试1: 基础扫描策略...'));
    const basicOptimizer = new ScanOptimizer({
      adaptiveBatching: false,
      priorityBasedScanning: false,
      incrementalScanning: false,
      maxConcurrentScans: 1
    });
    
    const basicStart = Date.now();
    const basicResult = await basicOptimizer.optimizedScan(options.host);
    const basicDuration = Date.now() - basicStart;
    
    // 优化扫描
    console.log(chalk.yellow('测试2: 优化扫描策略...'));
    const enhancedOptimizer = new ScanOptimizer({
      adaptiveBatching: true,
      priorityBasedScanning: true,
      incrementalScanning: true,
      maxConcurrentScans: 3
    });
    
    const enhancedStart = Date.now();
    const enhancedResult = await enhancedOptimizer.optimizedScan(options.host);
    const enhancedDuration = Date.now() - enhancedStart;
    
    // 对比结果
    console.log(chalk.green.bold('\n📊 性能对比结果:'));
    
    console.log('\n基础扫描:');
    console.log(`   时长: ${basicDuration}ms`);
    console.log(`   发现: ${basicResult.performance.foundRegisters} 个寄存器`);
    console.log(`   效率: ${(basicResult.performance.efficiency * 100).toFixed(2)}%`);
    
    console.log('\n优化扫描:');
    console.log(`   时长: ${enhancedDuration}ms`);
    console.log(`   发现: ${enhancedResult.performance.foundRegisters} 个寄存器`);
    console.log(`   效率: ${(enhancedResult.performance.efficiency * 100).toFixed(2)}%`);
    
    const speedup = basicDuration / enhancedDuration;
    console.log(chalk.cyan.bold(`\n⚡ 性能提升: ${speedup.toFixed(2)}x`));
    
    if (speedup > 1.2) {
      console.log(chalk.green('✅ 优化扫描明显更快!'));
    } else if (speedup > 1.0) {
      console.log(chalk.yellow('⚠️  优化扫描略有提升'));
    } else {
      console.log(chalk.red('❌ 优化扫描性能未提升'));
    }
  });

if (require.main === module) {
  program.parse();
}