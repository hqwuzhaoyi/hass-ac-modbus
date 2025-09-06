import { promises as fs } from 'fs';
import path from 'path';

export interface Pattern {
  ranges: Array<{
    min: number;
    max: number;
    scale?: number;
    unit?: string;
    values?: string[];
    confidence: number;
  }>;
}

export interface Suggestion {
  parameter: string;
  confidence: number;
  address: number;
  type: string;
  rawValue: number;
  scale: number;
  unit: string;
  values?: string[] | null;
  scaledValue?: number;
  mappedValue?: string;
}

export interface AnalysisResult {
  timestamp: string;
  suggestions: Record<string, Suggestion[]>;
  patterns: Record<string, any>;
  recommendations: Recommendation[];
}

export interface Recommendation {
  parameter: string;
  address: number;
  type: string;
  dataType: string;
  scale?: number;
  unit?: string;
  values?: string[];
  confidence: number;
}

export class DataAnalyzer {
  private patterns: Record<string, Pattern> = {
    temperature: {
      ranges: [
        { min: 150, max: 350, scale: 0.1, unit: '°C', confidence: 0.9 }, // 15.0-35.0°C
        { min: 15, max: 35, scale: 1, unit: '°C', confidence: 0.8 },     // 15-35°C
        { min: 1500, max: 3500, scale: 0.01, unit: '°C', confidence: 0.7 } // 15.00-35.00°C
      ]
    },
    mode: {
      ranges: [
        { min: 0, max: 10, values: ['off', 'cool', 'heat', 'auto', 'fan', 'dry'], confidence: 0.8 }
      ]
    },
    fanSpeed: {
      ranges: [
        { min: 0, max: 5, values: ['auto', 'low', 'medium', 'high', 'turbo'], confidence: 0.8 }
      ]
    },
    humidity: {
      ranges: [
        { min: 200, max: 900, scale: 0.1, unit: '%RH', confidence: 0.8 }, // 20.0-90.0%
        { min: 20, max: 90, scale: 1, unit: '%RH', confidence: 0.7 }      // 20-90%
      ]
    }
  };

  // 分析单个数值
  analyzeValue(value: number, address: number, type: string): Suggestion[] {
    const suggestions: Suggestion[] = [];
    
    // 检查每个模式
    Object.entries(this.patterns).forEach(([pattern, config]) => {
      config.ranges.forEach(range => {
        if (value >= range.min && value <= range.max) {
          const suggestion: Suggestion = {
            parameter: pattern,
            confidence: range.confidence,
            address,
            type,
            rawValue: value,
            scale: range.scale || 1,
            unit: range.unit || '',
            values: range.values || null
          };
          
          // 计算转换后的值
          if (range.scale) {
            suggestion.scaledValue = value * range.scale;
          } else if (range.values && range.values[value]) {
            suggestion.mappedValue = range.values[value];
          }
          
          suggestions.push(suggestion);
        }
      });
    });
    
    return suggestions;
  }

  // 分析扫描结果
  analyzeScanResults(scanResults: any): AnalysisResult {
    console.log('\n=== 智能数据分析 ===');
    
    const analysis: AnalysisResult = {
      timestamp: new Date().toISOString(),
      suggestions: {},
      patterns: {},
      recommendations: []
    };
    
    // 分析每种类型的寄存器
    Object.entries(scanResults.results).forEach(([type, registers]) => {
      if (!registers || Object.keys(registers as object).length === 0) return;
      
      console.log(`\n分析 ${type.toUpperCase()} 寄存器:`);
      
      Object.entries(registers as Record<string, number>).forEach(([address, value]) => {
        const suggestions = this.analyzeValue(value, parseInt(address), type);
        
        if (suggestions.length > 0) {
          // 按置信度排序
          suggestions.sort((a, b) => b.confidence - a.confidence);
          const bestSuggestion = suggestions[0];
          
          console.log(`  ${address}: ${value} -> 可能是 ${bestSuggestion.parameter}`);
          
          if (bestSuggestion.scaledValue !== undefined) {
            console.log(`    转换值: ${bestSuggestion.scaledValue}${bestSuggestion.unit}`);
          } else if (bestSuggestion.mappedValue) {
            console.log(`    映射值: ${bestSuggestion.mappedValue}`);
          }
          
          console.log(`    置信度: ${(bestSuggestion.confidence * 100).toFixed(0)}%`);
          
          // 保存建议
          if (!analysis.suggestions[bestSuggestion.parameter]) {
            analysis.suggestions[bestSuggestion.parameter] = [];
          }
          analysis.suggestions[bestSuggestion.parameter].push(bestSuggestion);
        }
      });
    });
    
    // 生成配置建议
    this.generateConfigRecommendations(analysis);
    
    return analysis;
  }

  // 生成配置建议
  generateConfigRecommendations(analysis: AnalysisResult): void {
    console.log('\n=== 配置建议 ===');
    
    Object.entries(analysis.suggestions).forEach(([parameter, suggestions]) => {
      if (suggestions.length === 0) return;
      
      // 选择置信度最高的建议
      const bestSuggestion = suggestions.reduce((best, current) => 
        current.confidence > best.confidence ? current : best
      );
      
      const recommendation: Recommendation = {
        parameter,
        address: bestSuggestion.address,
        type: bestSuggestion.type,
        dataType: this.inferDataType(bestSuggestion),
        scale: bestSuggestion.scale !== 1 ? bestSuggestion.scale : undefined,
        unit: bestSuggestion.unit || undefined,
        values: bestSuggestion.values || undefined,
        confidence: bestSuggestion.confidence
      };
      
      analysis.recommendations.push(recommendation);
      
      console.log(`${parameter}:`);
      console.log(`  地址: ${bestSuggestion.type}[${bestSuggestion.address}]`);
      console.log(`  数据类型: ${recommendation.dataType}`);
      if (recommendation.scale) {
        console.log(`  缩放: ${recommendation.scale}`);
      }
      if (recommendation.unit) {
        console.log(`  单位: ${recommendation.unit}`);
      }
      if (recommendation.values) {
        console.log(`  值映射: ${JSON.stringify(recommendation.values)}`);
      }
      console.log(`  置信度: ${(recommendation.confidence * 100).toFixed(0)}%`);
      console.log('');
    });
  }

  // 推断数据类型
  inferDataType(suggestion: Suggestion): string {
    if (suggestion.type === 'coil' || suggestion.type === 'discrete') {
      return 'boolean';
    }
    
    if (suggestion.rawValue < 0) {
      return 'int16';
    } else if (suggestion.rawValue <= 65535) {
      return 'uint16';
    } else {
      return 'uint32';
    }
  }

  // 生成更新后的配置文件
  async generateUpdatedConfig(analysis: AnalysisResult, originalConfig: any): Promise<any> {
    const updatedConfig = JSON.parse(JSON.stringify(originalConfig));
    
    // 更新已知寄存器配置
    analysis.recommendations.forEach(rec => {
      if (updatedConfig.knownRegisters[rec.parameter]) {
        updatedConfig.knownRegisters[rec.parameter].address = rec.address;
        updatedConfig.knownRegisters[rec.parameter].type = rec.type;
        
        if (rec.dataType) {
          updatedConfig.knownRegisters[rec.parameter].dataType = rec.dataType;
        }
        if (rec.scale) {
          updatedConfig.knownRegisters[rec.parameter].scale = rec.scale;
        }
        if (rec.unit) {
          updatedConfig.knownRegisters[rec.parameter].unit = rec.unit;
        }
        if (rec.values) {
          // 创建值映射对象
          const valueMap: Record<string, string> = {};
          rec.values.forEach((value, index) => {
            valueMap[index.toString()] = value;
          });
          updatedConfig.knownRegisters[rec.parameter].values = valueMap;
        }
      }
    });
    
    // 保存更新后的配置
    const configPath = path.join(process.cwd(), 'config/modbus-config-updated.json');
    await fs.writeFile(configPath, JSON.stringify(updatedConfig, null, 2));
    
    console.log('已生成更新的配置文件: config/modbus-config-updated.json');
    console.log('请检查配置后，手动替换原配置文件。');
    
    return updatedConfig;
  }

  // 分析时间序列数据
  analyzeTimeSeries(dataPoints: any[]): any {
    if (dataPoints.length < 2) return null;
    
    const analysis = {
      count: dataPoints.length,
      timeSpan: dataPoints[dataPoints.length - 1].timestamp - dataPoints[0].timestamp,
      changes: 0,
      stability: 0,
      trends: {} as Record<string, any>
    };
    
    // 分析每个参数的变化
    const parameters = Object.keys(dataPoints[0].data || {});
    
    parameters.forEach(param => {
      const values = dataPoints.map(dp => dp.data[param]?.value).filter(v => v !== undefined);
      
      if (values.length < 2) return;
      
      const trend = {
        values: values,
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((sum: number, val: number) => sum + val, 0) / values.length,
        changes: 0
      };
      
      // 计算变化次数
      for (let i = 1; i < values.length; i++) {
        if (values[i] !== values[i - 1]) {
          trend.changes++;
        }
      }
      
      (trend as any).stability = 1 - (trend.changes / (values.length - 1));
      analysis.trends[param] = trend;
    });
    
    return analysis;
  }

  // 保存分析结果
  async saveAnalysis(analysis: AnalysisResult): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `analysis-${timestamp}.json`;
    const filepath = path.join(process.cwd(), 'logs', filename);
    
    await fs.writeFile(filepath, JSON.stringify(analysis, null, 2));
    console.log(`\n分析结果已保存到: ${filename}`);
    
    return filepath;
  }
}