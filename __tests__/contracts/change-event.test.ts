import { validateChangeEvent } from '@/lib/change-event-manager';
import {
  DEFAULT_SESSION_CONFIG,
  ChangeBatchMetadata,
  RegisterChangeEvent,
} from '@/types/change-events';

const now = new Date().toISOString();

const baseBatch: ChangeBatchMetadata = {
  batchId: 'batch-001',
  sequence: 1,
  size: 1,
  origin: 'real_time',
};

const baseEvent: RegisterChangeEvent = {
  id: 'evt-001',
  registerAddress: 1001,
  oldValue: 0,
  newValue: 1,
  timestamp: now,
  changeType: 'value_change',
  source: 'known',
  batch: baseBatch,
  latency: {
    modbusReadAt: now,
    detectedAt: now,
    dispatchedAt: now,
  },
};

describe('RegisterChangeEvent contract', () => {
  it('accepts a valid change event shape without throwing', () => {
    expect(() => validateChangeEvent(baseEvent)).not.toThrow();
  });

  it('rejects events lacking ISO timestamps', () => {
    const invalidEvent = {
      ...baseEvent,
      timestamp: '2024-13-99',
    };

    expect(() => validateChangeEvent(invalidEvent)).toThrowErrorMatchingInlineSnapshot(
      `"Invalid register change event: timestamp must be ISO 8601 with milliseconds"`,
    );
  });
});

describe('Session configuration contract', () => {
  it('complies with latency budget defaults', () => {
    expect(DEFAULT_SESSION_CONFIG.pollingInterval).toBeLessThanOrEqual(250);
    expect(DEFAULT_SESSION_CONFIG.buffer.capacity).toBeGreaterThanOrEqual(200);
    expect(DEFAULT_SESSION_CONFIG.alertThresholds.bufferUtilisationPercent).toBe(80);
  });
});
