import { WebSocket } from 'ws';
import {
  detectRegisterChanges,
  PollingSnapshot,
  assertLatencyWithinBudget,
} from './change-detector';
import {
  createMonitoringSession,
  transitionSession,
  recordBufferStats,
  applyDependencyStatus,
} from './monitoring-session';
import {
  createBroadcastPayloads,
  createBufferStatsMessage,
  createDependencyStatusMessage,
} from './change-websocket-handler';
import type {
  MonitoringSession,
  BufferStats,
  DependencyStatus,
  SessionConfiguration,
  RegisterChangeEvent,
  DeliveryMode,
  ChangeDetectionOptions,
  ChangeDetectionContext,
} from '../types/change-events';
import { DEFAULT_SESSION_CONFIG } from '../types/change-events';
import type { ChangeNotification } from './websocket-types';
import { DependencyMonitors } from './dependency-monitors';
import { MqttBridge, MqttConfig, DeviceInfo } from './mqtt-bridge';

interface KnownRegisterConfig {
  name: string;
  type: string;
  writable: boolean;
  scale?: number;
  unit?: string;
  category?: string;
}

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
  private session: MonitoringSession | null = null;
  private sessionConfig: SessionConfiguration = { ...DEFAULT_SESSION_CONFIG };
  private detectionOptions: ChangeDetectionOptions = {
    debounceDelay: DEFAULT_SESSION_CONFIG.debounceDelay,
    includeFirstReads: true,
    filterUnchanged: true,
    buffer: { ...DEFAULT_SESSION_CONFIG.buffer },
    minimumDelta: DEFAULT_SESSION_CONFIG.changeThreshold,
  };
  private detectionContext: ChangeDetectionContext = {
    previousValues: new Map<number, number>(),
    lastPollTime: new Date(0),
    sessionId: '',
    debounceTimers: new Map(),
    batchSequence: 0,
  };
  private lastSnapshot: PollingSnapshot | null = null;
  private latestBufferStats: BufferStats | null = null;
  private dependencyMonitors = new DependencyMonitors([
    { name: 'modbus', status: 'healthy', lastCheckedAt: new Date().toISOString() },
    { name: 'websocket', status: 'healthy', lastCheckedAt: new Date().toISOString() },
    { name: 'mqtt', status: 'degraded', lastCheckedAt: new Date().toISOString(), details: '未初始化' },
    { name: 'time_sync', status: 'healthy', lastCheckedAt: new Date().toISOString() },
  ]);
  private mqttBridge: MqttBridge | null = null;

  // 已知寄存器配置（核心控制寄存器）
  private knownRegisters = new Map<number, KnownRegisterConfig>([
    [1033, { name: '总开关', type: 'switch', writable: true }],
    [1034, { name: '居家/离家', type: 'switch', writable: true }],
    [1041, { name: '主机模式', type: 'value', writable: true }],
    [1168, { name: '加湿', type: 'switch', writable: true }],
  ]);

  // 动态发现的寄存器（当前已停用）
  private dynamicRegisters = new Map<number, KnownRegisterConfig>();
  private discoveryEnabled = false;
  private discoveryRanges: Array<{ start: number; end: number }> = [];

  constructor() {
    if (!ModbusRTU) return;
    this.client = new ModbusRTU();
  }

  configureSession(partial: Partial<SessionConfiguration>) {
    this.sessionConfig = {
      ...this.sessionConfig,
      ...partial,
      buffer: {
        ...this.sessionConfig.buffer,
        ...(partial.buffer ?? {}),
      },
      alertThresholds: {
        ...this.sessionConfig.alertThresholds,
        ...(partial.alertThresholds ?? {}),
      },
    };

    this.detectionOptions = {
      debounceDelay: this.sessionConfig.debounceDelay,
      includeFirstReads: true,
      filterUnchanged: true,
      buffer: { ...this.sessionConfig.buffer },
      minimumDelta: this.sessionConfig.changeThreshold,
    };
  }

  setSessionMode(mode: 'basic' | 'enhanced' | 'demo') {
    this.ensureSession(mode);
  }

  async configureMqtt(config: MqttConfig, deviceInfo: DeviceInfo) {
    if (this.mqttBridge) {
      return;
    }
    this.mqttBridge = new MqttBridge(config, deviceInfo);
    this.mqttBridge.on('connected', () => this.updateDependencyStatus('mqtt', 'healthy'));
    this.mqttBridge.on('disconnected', () => this.updateDependencyStatus('mqtt', 'degraded', 'MQTT 连接关闭'));
    this.mqttBridge.on('error', (error: Error) => this.updateDependencyStatus('mqtt', 'degraded', error.message));
    try {
      const connected = await this.mqttBridge.connect();
      if (!connected) {
        this.updateDependencyStatus('mqtt', 'degraded', '无法连接 MQTT 代理');
      }
    } catch (error) {
      this.updateDependencyStatus('mqtt', 'degraded', (error as Error).message);
    }
  }

  private ensureSession(mode: 'basic' | 'enhanced' | 'demo' = 'basic') {
    if (!this.session) {
      this.session = createMonitoringSession(mode, this.sessionConfig);
      this.detectionContext.sessionId = this.session.sessionId;
      this.detectionContext.lastPollTime = new Date();
    } else {
      if (this.session.mode !== mode) {
        this.session.mode = mode;
      }
      this.session = transitionSession(this.session, 'active');
    }

    this.broadcastDependencyStatus();
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
      this.ensureSession('basic');
      this.updateDependencyStatus('modbus', 'healthy');
      console.log('✓ Modbus 连接成功');
      return true;
    } catch (error) {
      this.connected = false;
      this.broadcastMessage({
        type: 'error',
        data: { message: (error as Error).message },
        timestamp: new Date().toISOString()
      });
      this.updateDependencyStatus('modbus', 'degraded', (error as Error).message);
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
      const previousValue = this.lastValues.has(address) ? this.lastValues.get(address)! : null;
      
      await this.client.writeRegister(address, value);
      
      // 验证写入
      const verifyData = await this.client.readHoldingRegisters(address, 1);
      const newValue = verifyData.data[0];
      
      // 更新缓存
      this.lastValues.set(address, newValue);

      if (previousValue === null || previousValue !== newValue) {
        this.emitManualChange(address, previousValue, newValue);
      }

      this.updateDependencyStatus('modbus', 'healthy');
      
      return { written: value, verified: newValue };
    } catch (error) {
      throw new Error(`写入寄存器 ${address} 失败: ${(error as Error).message}`);
    }
  }

  async getAllRegisters() {
    const results = new Map();

    // 读取已知寄存器
    for (const [address, config] of Array.from(this.knownRegisters.entries())) {
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
          category: 'known',
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
          writable: config.writable,
          category: 'known'
        });
      }
    }

    // 读取动态发现的寄存器
    for (const [address, config] of Array.from(this.dynamicRegisters.entries())) {
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
          category: 'dynamic',
          timestamp: new Date().toISOString()
        });

        // 更新缓存
        this.lastValues.set(address, values[0]);

      } catch (error) {
        // 忽略动态寄存器的读取错误
      }
    }

    return results;
  }

  // 启用/禁用动态发现
  enableDiscovery(enabled: boolean) {
    this.discoveryEnabled = enabled;
    console.log(`🔍 动态发现已${enabled ? '启用' : '禁用'}`);
  }

  // 快速扫描并添加有数据的寄存器
  async quickScanAndAdd() {
    if (!this.connected) return;

    console.log('🔍 开始快速扫描寄存器范围...');
    let foundCount = 0;

    for (const range of this.discoveryRanges) {
      for (let addr = range.start; addr <= range.end; addr++) {
        // 跳过已知寄存器
        if (this.knownRegisters.has(addr)) continue;

        try {
          const values = await this.readRegister(addr, 1);
          const value = values[0];

          // 如果寄存器有值且不在动态列表中，添加它
          if (value !== 0 && value !== 65535 && !this.dynamicRegisters.has(addr)) {
            this.dynamicRegisters.set(addr, {
              name: `动态-${addr}`,
              type: 'value',
              writable: false,
              category: 'dynamic'
            });
            foundCount++;
            console.log(`✅ 发现新寄存器: ${addr} = ${value}`);
          }

          // 小延迟避免过快请求
          await new Promise(resolve => setTimeout(resolve, 20));
        } catch (error) {
          // 忽略读取错误
        }
      }
    }

    console.log(`🎯 快速扫描完成，发现 ${foundCount} 个新寄存器`);
    return foundCount;
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

  private pollCount = 0;

  startMonitoring() {
    if (this.monitoringInterval) return;
    this.ensureSession('basic');
    const pollingInterval = this.sessionConfig.pollingInterval;
    this.pollCount = 0;

    if (pollingInterval <= 0) {
      console.log('⏸ 轮询已禁用（pollingInterval<=0），仅手动操作生效');
      return;
    }

    console.log(`🔁 开始轮询监控 (间隔: ${pollingInterval}ms)`);

    this.monitoringInterval = setInterval(async () => {
      if (!this.connected) return;

      this.pollCount++;
      // 每10次轮询打印一次心跳
      if (this.pollCount % 10 === 0) {
        console.log(`💓 轮询心跳 #${this.pollCount} - 监控 ${this.knownRegisters.size + this.dynamicRegisters.size} 个寄存器`);
      }

      try {
        const registers = await this.getAllRegisters();
        const timestamp = new Date().toISOString();

        const registerSnapshot: Record<number, number> = {};
        let changedCount = 0;
        for (const [address, data] of Array.from(registers.entries())) {
          if (data && typeof data.rawValue === 'number' && !Number.isNaN(data.rawValue)) {
            const oldValue = this.lastValues.get(address);
            if (oldValue !== undefined && oldValue !== data.rawValue) {
              const regInfo = this.knownRegisters.get(address) || this.dynamicRegisters.get(address);
              console.log(`📊 原始读取变化: ${address} (${regInfo?.name || '未知'}) | ${oldValue} → ${data.rawValue}`);
              changedCount++;
            }
            registerSnapshot[address] = data.rawValue;
            this.lastValues.set(address, data.rawValue);
          }
        }

        if (changedCount > 0) {
          console.log(`✨ 本轮检测到 ${changedCount} 个寄存器原始值变化`);
        }

        const currentSnapshot: PollingSnapshot = {
          timestamp,
          registers: registerSnapshot,
        };

        if (!this.lastSnapshot) {
          this.lastSnapshot = currentSnapshot;
          this.detectionContext.lastPollTime = new Date(timestamp);
        } else {
          const detection = detectRegisterChanges(
            this.lastSnapshot,
            currentSnapshot,
            this.detectionContext,
            this.detectionOptions,
          );

          this.lastSnapshot = currentSnapshot;
          this.detectionContext = detection.context;

          if (this.session) {
            this.session.totalChanges += detection.events.length;
            this.session = recordBufferStats(this.session, detection.buffer);
            this.latestBufferStats = detection.buffer;
          }

          detection.events.forEach((event) => {
            // 添加调试日志
            const registerInfo = this.knownRegisters.get(event.registerAddress);
            console.log(`🔄 检测到变化: 寄存器 ${event.registerAddress} (${registerInfo?.name || '未知'}) | 旧值: ${event.oldValue} → 新值: ${event.newValue}`);

            const notification: ChangeNotification = {
              type: 'change_notification',
              sessionId: this.session?.sessionId ?? 'basic',
              timestamp,
              event,
              deliveryMode: event.batch.origin ?? 'real_time',
              latency: detection.latency,
            };
            this.broadcastMessages(createBroadcastPayloads(notification));
            this.broadcastLegacyChange(
              event.registerAddress,
              event.oldValue ?? null,
              event.newValue,
              event.batch.origin ?? 'real_time',
            );
            void this.publishMqttChange(event);
          });

          if (this.session) {
            const bufferMessage = createBufferStatsMessage({
              type: 'buffer_stats',
              sessionId: this.session.sessionId,
              stats: detection.buffer,
            });
            this.broadcastMessage(bufferMessage);
          }

          const withinBudget = assertLatencyWithinBudget(detection.latency);
          this.updateDependencyStatus(
            'modbus',
            withinBudget ? 'healthy' : 'degraded',
            withinBudget ? undefined : 'Latency budget exceeded',
          );
        }

        this.broadcastMessage({
          type: 'bulk_update',
          data: Array.from(registers.values()),
          timestamp,
        });

        // 广播统计信息
        this.broadcastMessage({
          type: 'monitoring_stats',
          data: {
            knownRegisters: this.knownRegisters.size,
            dynamicRegisters: this.dynamicRegisters.size,
            totalMonitored: this.knownRegisters.size + this.dynamicRegisters.size,
            changeThreshold: this.sessionConfig.changeThreshold,
            scanningEnabled: this.discoveryEnabled
          },
          timestamp,
        });

        const driftMs = Math.abs(Date.now() - Date.parse(timestamp));
        if (driftMs > 5_000) {
          this.updateDependencyStatus('time_sync', 'degraded', `时间漂移 ${driftMs}ms`);
        } else {
          this.updateDependencyStatus('time_sync', 'healthy');
        }
      } catch (error) {
        console.error('监控错误:', error);
        this.updateDependencyStatus('modbus', 'degraded', (error as Error).message);
      }
    }, pollingInterval);
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  addWebSocketConnection(ws: WebSocket) {
    this.wsConnections.add(ws);
    this.updateDependencyStatus('websocket', 'healthy');
    
    ws.on('close', () => {
      this.wsConnections.delete(ws);
      if (this.wsConnections.size === 0) {
        this.updateDependencyStatus('websocket', 'degraded', 'No active WebSocket clients');
      }
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

    if (this.session) {
      const snapshot = this.dependencyMonitors.snapshot();
      const dependencyMessage = createDependencyStatusMessage({
        type: 'dependency_status',
        sessionId: this.session.sessionId,
        statuses: snapshot.statuses,
        alerts: snapshot.alerts.length ? snapshot.alerts : undefined,
      });
      ws.send(JSON.stringify(dependencyMessage));

      if (this.latestBufferStats) {
        const bufferMessage = createBufferStatsMessage({
          type: 'buffer_stats',
          sessionId: this.session.sessionId,
          stats: this.latestBufferStats,
        });
        ws.send(JSON.stringify(bufferMessage));
      }
    }
  }

  private broadcastMessage(message: any) {
    const messageStr = JSON.stringify(message);

    this.wsConnections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    });
  }

  private broadcastMessages(messages: any[]) {
    messages.forEach((message) => this.broadcastMessage(message));
  }

  private broadcastLegacyChange(
    address: number,
    oldValue: number | null,
    newValue: number,
    origin: 'real_time' | 'playback' = 'real_time',
  ) {
    const registerInfo = this.knownRegisters.get(address);
    const name = registerInfo?.name ?? `寄存器-${address}`;
    const type = registerInfo?.type ?? 'value';
    const category = origin === 'playback' ? 'dynamic' : registerInfo?.category ?? 'known';

    this.broadcastMessage({
      type: category === 'dynamic' ? 'dynamic_register_change' : 'register_change',
      data: {
        address,
        name,
        oldValue: oldValue ?? 0,
        newValue,
        type,
        category,
      },
      timestamp: new Date().toISOString(),
    });
  }

  private emitManualChange(address: number, oldValue: number | null, newValue: number, origin: DeliveryMode = 'real_time') {
    const timestamp = new Date().toISOString();

    if (this.lastSnapshot) {
      this.lastSnapshot.registers[address] = newValue;
    }
    this.detectionContext.previousValues.set(address, newValue);

    if (this.session) {
      this.session.totalChanges += 1;
    }

    const event: RegisterChangeEvent = {
      id: `manual-${address}-${Date.now()}`,
      registerAddress: address,
      oldValue,
      newValue,
      timestamp,
      changeType: 'value_change',
      source: this.knownRegisters.has(address) ? 'known' : 'discovered',
      batch: {
        batchId: `${this.session?.sessionId ?? 'session'}-manual-${Date.now()}`,
        sequence: 1,
        size: 1,
        origin,
      },
      latency: {
        modbusReadAt: timestamp,
        detectedAt: timestamp,
        dispatchedAt: timestamp,
        uiRenderedAt: undefined,
      },
    };

    if (this.session) {
      const stats: BufferStats = this.latestBufferStats ?? {
        size: 0,
        utilisationPercent: 0,
        droppedEvents: 0,
      };
      const capacity = Math.max(1, this.sessionConfig.buffer.capacity);
      const newSize = Math.min(stats.size + 1, capacity);
      const updated: BufferStats = {
        size: newSize,
        utilisationPercent: Math.min(100, (newSize / capacity) * 100),
        droppedEvents: stats.droppedEvents,
        lastDropAt: stats.lastDropAt,
      };
      this.latestBufferStats = updated;
      this.session = recordBufferStats(this.session, updated);
      const bufferMessage = createBufferStatsMessage({
        type: 'buffer_stats',
        sessionId: this.session.sessionId,
        stats: updated,
      });
      this.broadcastMessage(bufferMessage);
    }

    const notification: ChangeNotification = {
      type: 'change_notification',
      sessionId: this.session?.sessionId ?? 'basic',
      timestamp,
      event,
      deliveryMode: origin,
      latency: event.latency,
    };

    this.broadcastMessages(createBroadcastPayloads(notification));
    this.broadcastLegacyChange(address, oldValue, newValue, origin);
    void this.publishMqttChange(event);
  }

  private async publishMqttChange(event: RegisterChangeEvent) {
    if (!this.mqttBridge || !this.session) {
      return;
    }

    try {
      if (this.mqttBridge.isConnected()) {
        await this.mqttBridge.publishChangeEvent(event, this.session.sessionId);
        this.updateDependencyStatus('mqtt', 'healthy');
      } else {
        this.updateDependencyStatus('mqtt', 'degraded', 'MQTT 客户端未连接');
      }
    } catch (error) {
      this.updateDependencyStatus('mqtt', 'degraded', (error as Error).message);
    }
  }

  private broadcastDependencyStatus() {
    if (!this.session) return;
    const snapshot = this.dependencyMonitors.snapshot();
    const message = createDependencyStatusMessage({
      type: 'dependency_status',
      sessionId: this.session.sessionId,
      statuses: snapshot.statuses,
      alerts: snapshot.alerts.length ? snapshot.alerts : undefined,
    });
    this.broadcastMessage(message);
  }

  private updateDependencyStatus(
    name: DependencyStatus['name'],
    status: DependencyStatus['status'],
    details?: string,
  ) {
    this.dependencyMonitors.updateStatus(name, status, details);
    if (this.session) {
      const snapshot = this.dependencyMonitors.snapshot();
      this.session = applyDependencyStatus(this.session, snapshot.statuses);
      this.broadcastDependencyStatus();
    }
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
    this.updateDependencyStatus('modbus', 'degraded', 'Disconnected from Modbus host');
    if (this.mqttBridge && this.mqttBridge.isConnected()) {
      this.mqttBridge.disconnect().catch(() => undefined);
    }
    this.mqttBridge = null;
    if (this.session) {
      this.session = transitionSession(this.session, 'stopped');
    }
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
