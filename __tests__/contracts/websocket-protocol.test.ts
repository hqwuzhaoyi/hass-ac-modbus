import {
  isBufferStatsUpdate,
  isChangeNotification,
  isDependencyStatusUpdate,
  isLatencyMetricsMessage,
} from '@/lib/websocket-types';
import {
  createBufferStatsMessage,
  createDependencyStatusMessage,
  createLatencyMetricsMessage,
} from '@/lib/change-websocket-handler';
import type {
  BufferStatsUpdate,
  ChangeNotification,
  DependencyStatusUpdate,
  LatencyMetricsMessage,
} from '@/lib/websocket-types';

const baseChangeNotification: ChangeNotification = {
  type: 'change_notification',
  sessionId: 'session-001',
  timestamp: new Date().toISOString(),
  deliveryMode: 'real_time',
  event: {
    id: 'evt-001',
    registerAddress: 1001,
    oldValue: 0,
    newValue: 1,
    timestamp: new Date().toISOString(),
    changeType: 'value_change',
    source: 'known',
    batch: {
      batchId: 'batch-001',
      sequence: 1,
      size: 1,
      origin: 'real_time',
    },
  },
};

const bufferStatsMessage: BufferStatsUpdate = {
  type: 'buffer_stats',
  sessionId: 'session-001',
  stats: {
    size: 5,
    utilisationPercent: 42,
    droppedEvents: 0,
  },
};

const dependencyStatusMessage: DependencyStatusUpdate = {
  type: 'dependency_status',
  sessionId: 'session-001',
  statuses: [
    { name: 'modbus', status: 'healthy', lastCheckedAt: new Date().toISOString() },
    { name: 'websocket', status: 'healthy', lastCheckedAt: new Date().toISOString() },
  ],
};

const latencyMetrics: LatencyMetricsMessage = {
  type: 'latency_metrics',
  sessionId: 'session-001',
  measurement: {
    modbusReadAt: new Date().toISOString(),
    detectedAt: new Date().toISOString(),
    dispatchedAt: new Date().toISOString(),
  },
};

describe('WebSocket protocol contracts', () => {
  it('guards change notification messages', () => {
    expect(isChangeNotification(baseChangeNotification)).toBe(true);
  });

  it('guards buffer stats updates', () => {
    expect(isBufferStatsUpdate(bufferStatsMessage)).toBe(true);
  });

  it('guards dependency status updates', () => {
    expect(isDependencyStatusUpdate(dependencyStatusMessage)).toBe(true);
  });

  it('guards latency metrics messages', () => {
    expect(isLatencyMetricsMessage(latencyMetrics)).toBe(true);
  });

  it('creates buffer stats payload without throwing', () => {
    expect(() => createBufferStatsMessage(bufferStatsMessage)).not.toThrow();
  });

  it('creates dependency status payload without throwing', () => {
    expect(() => createDependencyStatusMessage(dependencyStatusMessage)).not.toThrow();
  });

  it('creates latency metrics payload without throwing', () => {
    expect(() => createLatencyMetricsMessage(latencyMetrics)).not.toThrow();
  });
});
