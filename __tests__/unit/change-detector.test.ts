import { detectRegisterChanges, assertLatencyWithinBudget } from '@/lib/change-detector';
import type {
  ChangeDetectionContext,
  ChangeDetectionOptions,
  PollingSnapshot,
  SessionConfiguration,
} from '@/types/change-events';
import { DEFAULT_SESSION_CONFIG } from '@/types/change-events';

const baseContext = (): ChangeDetectionContext => ({
  previousValues: new Map(),
  lastPollTime: new Date(Date.now() - 200),
  sessionId: 'session-unit',
  debounceTimers: new Map(),
  batchSequence: 0,
});

const options = (config?: Partial<ChangeDetectionOptions>): ChangeDetectionOptions => ({
  debounceDelay: DEFAULT_SESSION_CONFIG.debounceDelay,
  includeFirstReads: true,
  filterUnchanged: true,
  buffer: { ...DEFAULT_SESSION_CONFIG.buffer },
  minimumDelta: DEFAULT_SESSION_CONFIG.changeThreshold,
  ...config,
});

const snapshot = (registers: Record<number, number>, offsetMs = 0): PollingSnapshot => ({
  timestamp: new Date(Date.now() + offsetMs).toISOString(),
  registers,
});

describe('detectRegisterChanges', () => {
  it('respects minimum delta threshold before emitting change events', () => {
    const previous = snapshot({ 1001: 10 });
    const current = snapshot({ 1001: 10.4 }, 200);

    const result = detectRegisterChanges(previous, current, baseContext(), options({ minimumDelta: 1 }));

    expect(result.events).toHaveLength(0);
  });

  it('emits change events when threshold is met', () => {
    const previous = snapshot({ 1001: 10 });
    const current = snapshot({ 1001: 12 }, 200);

    const result = detectRegisterChanges(previous, current, baseContext(), options({ minimumDelta: 1 }));

    expect(result.events).toHaveLength(1);
    expect(result.events[0].registerAddress).toBe(1001);
    expect(result.buffer.size).toBe(1);
  });
});

describe('assertLatencyWithinBudget', () => {
  it('returns true for latency within budget', () => {
    const now = Date.now();
    expect(
      assertLatencyWithinBudget({
        modbusReadAt: new Date(now - 200).toISOString(),
        detectedAt: new Date(now - 50).toISOString(),
        dispatchedAt: new Date(now - 20).toISOString(),
        uiRenderedAt: new Date(now).toISOString(),
      }),
    ).toBe(true);
  });

  it('returns false when any stage exceeds budget', () => {
    const now = Date.now();
    expect(
      assertLatencyWithinBudget({
        modbusReadAt: new Date(now - 600).toISOString(),
        detectedAt: new Date(now - 300).toISOString(),
        dispatchedAt: new Date(now - 100).toISOString(),
        uiRenderedAt: new Date(now).toISOString(),
      }),
    ).toBe(false);
  });
});
