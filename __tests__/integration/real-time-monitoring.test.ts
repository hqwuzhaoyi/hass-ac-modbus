import { detectRegisterChanges } from '@/lib/change-detector';
import { createBroadcastPayloads } from '@/lib/change-websocket-handler';
import { ChangeNotification } from '@/lib/websocket-types';
import {
  DEFAULT_SESSION_CONFIG,
  ChangeDetectionContext,
  ChangeDetectionOptions,
} from '@/types/change-events';

const context: ChangeDetectionContext = {
  previousValues: new Map<number, number>(),
  lastPollTime: new Date(),
  sessionId: 'session-rtm',
  debounceTimers: new Map(),
  batchSequence: 0,
};

const options: ChangeDetectionOptions = {
  debounceDelay: DEFAULT_SESSION_CONFIG.debounceDelay,
  includeFirstReads: true,
  filterUnchanged: true,
  buffer: DEFAULT_SESSION_CONFIG.buffer,
};

const notification: ChangeNotification = {
  type: 'change_notification',
  sessionId: 'session-rtm',
  timestamp: new Date().toISOString(),
  deliveryMode: 'real_time',
  event: {
    id: 'evt-123',
    registerAddress: 2001,
    oldValue: 0,
    newValue: 1,
    timestamp: new Date().toISOString(),
    changeType: 'value_change',
    source: 'known',
    batch: {
      batchId: 'batch-abc',
      sequence: 1,
      size: 1,
      origin: 'real_time',
    },
  },
};

describe('Real-time monitoring workflow', () => {
  it('produces and broadcasts change notifications for state transitions', () => {
    const previous = {
      timestamp: new Date(Date.now() - 200).toISOString(),
      registers: {},
    };
    const current = {
      timestamp: new Date().toISOString(),
      registers: { 2001: 1 },
    };

    const detection = detectRegisterChanges(previous, current, context, options);
    const payloads = createBroadcastPayloads({
      ...notification,
      event: detection.events[0],
    });

    expect(payloads).toHaveLength(2);
  });

  it('marks replayed events with playback delivery mode after resume', () => {
    const payloads = createBroadcastPayloads({
      ...notification,
      deliveryMode: 'playback',
      event: {
        ...notification.event,
        batch: {
          ...notification.event.batch,
          origin: 'playback',
        },
      },
    });

    expect(payloads.some((msg) => msg.type === 'latency_metrics')).toBe(true);
  });
});
