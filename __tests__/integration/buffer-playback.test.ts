import { detectRegisterChanges } from '@/lib/change-detector';
import { createBroadcastPayloads } from '@/lib/change-websocket-handler';
import type {
  ChangeDetectionContext,
  ChangeDetectionOptions,
  PollingSnapshot,
} from '@/types/change-events';

const makeContext = (sessionId: string): ChangeDetectionContext => ({
  previousValues: new Map(),
  lastPollTime: new Date(Date.now() - 200),
  sessionId,
  debounceTimers: new Map(),
  batchSequence: 0,
});

const makeOptions = (capacity: number): ChangeDetectionOptions => ({
  debounceDelay: 0,
  includeFirstReads: true,
  filterUnchanged: true,
  buffer: {
    capacity,
    windowMs: 500,
  },
});

const snapshot = (registers: Record<number, number>, offsetMs = 0): PollingSnapshot => ({
  timestamp: new Date(Date.now() + offsetMs).toISOString(),
  registers,
});

describe('buffer overflow and playback scenarios', () => {
  it('drops old events when buffer capacity is exceeded', () => {
    const context = makeContext('buffer-session');
    const options = makeOptions(2);

    let previous = snapshot({ 1001: 0 });
    let current = snapshot({ 1001: 1 }, 200);

    let result = detectRegisterChanges(previous, current, context, options);
    expect(result.events).toHaveLength(1);
    expect(result.buffer.size).toBe(1);

    previous = current;
    current = snapshot({ 1001: 2 }, 400);
    result = detectRegisterChanges(previous, current, context, options);
    expect(result.buffer.size).toBe(2);

    previous = current;
    current = snapshot({ 1001: 3 }, 600);
    result = detectRegisterChanges(previous, current, context, options);
    expect(result.buffer.size).toBe(2);
    expect(result.buffer.droppedEvents).toBeGreaterThan(0);
    expect(result.buffer.lastDropAt).toBeDefined();
  });

  it('marks playback events through broadcast payloads', () => {
    const notification = {
      type: 'change_notification' as const,
      sessionId: 'playback-session',
      timestamp: new Date().toISOString(),
      deliveryMode: 'playback' as const,
      event: {
        id: 'evt-playback',
        registerAddress: 2001,
        oldValue: 0,
        newValue: 1,
        timestamp: new Date().toISOString(),
        changeType: 'value_change' as const,
        source: 'discovered' as const,
        batch: {
          batchId: 'batch-playback',
          sequence: 1,
          size: 1,
          origin: 'playback' as const,
        },
      },
    };

    const payloads = createBroadcastPayloads(notification);
    expect(payloads[0]).toMatchObject({
      type: 'change_notification',
      deliveryMode: 'playback',
    });
    expect(payloads.some((message) => message.type === 'latency_metrics')).toBe(true);
  });
});
