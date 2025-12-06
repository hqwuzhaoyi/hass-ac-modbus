import {
  createBroadcastPayloads,
  createBufferStatsMessage,
  createDependencyStatusMessage,
} from '@/lib/change-websocket-handler';
import type { ChangeNotification } from '@/lib/websocket-types';

const baseTimestamp = new Date().toISOString();

const notification = (): ChangeNotification => ({
  type: 'change_notification',
  sessionId: 'session-unit',
  timestamp: baseTimestamp,
  deliveryMode: 'real_time',
  event: {
    id: 'evt-1',
    registerAddress: 1001,
    oldValue: 10,
    newValue: 12,
    timestamp: baseTimestamp,
    changeType: 'value_change',
    source: 'known',
    batch: {
      batchId: 'batch-1',
      sequence: 1,
      size: 1,
      origin: 'real_time',
    },
    latency: {
      modbusReadAt: baseTimestamp,
      detectedAt: baseTimestamp,
      dispatchedAt: baseTimestamp,
    },
  },
});

describe('change-websocket-handler', () => {
  it('creates broadcast payloads including latency metrics', () => {
    const payloads = createBroadcastPayloads(notification());
    expect(payloads).toHaveLength(2);
    expect(payloads[0].type).toBe('change_notification');
    expect(payloads[1].type).toBe('latency_metrics');
  });

  it('clamps buffer utilisation percent within bounds', () => {
    const message = createBufferStatsMessage({
      type: 'buffer_stats',
      sessionId: 'session-unit',
      stats: {
        size: 500,
        utilisationPercent: 180,
        droppedEvents: 10,
      },
    });

    expect(message.stats.utilisationPercent).toBeLessThanOrEqual(100);
  });

  it('fills missing dependency timestamps and preserves details', () => {
    const message = createDependencyStatusMessage({
      type: 'dependency_status',
      sessionId: 'session-unit',
      statuses: [{ name: 'modbus', status: 'degraded', lastCheckedAt: undefined, details: 'timeout' }],
    });

    expect(message.statuses[0].lastCheckedAt).toBeTruthy();
    expect(message.statuses[0].details).toBe('timeout');
  });
});
