import { detectRegisterChanges } from '@/lib/change-detector';
import {
  DEFAULT_SESSION_CONFIG,
  ChangeDetectionContext,
  ChangeDetectionOptions,
} from '@/types/change-events';

const createContext = (): ChangeDetectionContext => ({
  previousValues: new Map<number, number>([[1001, 0]]),
  lastPollTime: new Date(Date.now() - 150),
  sessionId: 'session-001',
  debounceTimers: new Map(),
  batchSequence: 0,
});

const options: ChangeDetectionOptions = {
  debounceDelay: DEFAULT_SESSION_CONFIG.debounceDelay,
  includeFirstReads: true,
  filterUnchanged: true,
  buffer: DEFAULT_SESSION_CONFIG.buffer,
};

describe('Change detection integration', () => {
  it('produces a change event within latency budget when register values differ', () => {
    const previous = {
      timestamp: new Date(Date.now() - 200).toISOString(),
      registers: { 1001: 0 },
    };
    const current = {
      timestamp: new Date().toISOString(),
      registers: { 1001: 1 },
    };

    const result = detectRegisterChanges(previous, current, createContext(), options);

    expect(result.events).toHaveLength(1);
    expect(result.buffer.utilisationPercent).toBeLessThanOrEqual(80);
    expect(result.latency.detectedAt).toBeDefined();
  });

  it('records dropped events when buffer capacity threshold exceeded', () => {
    const context = createContext();
    const previous = {
      timestamp: new Date(Date.now() - 200).toISOString(),
      registers: { 1001: 0 },
    };
    const current = {
      timestamp: new Date().toISOString(),
      registers: { 1001: 1, 1002: 1, 1003: 1 },
    };

    const result = detectRegisterChanges(previous, current, context, {
      ...options,
      buffer: { capacity: 1, windowMs: 1000 },
    });

    expect(result.buffer.droppedEvents).toBeGreaterThan(0);
  });
});
