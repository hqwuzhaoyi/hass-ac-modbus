import {
  BufferStats,
  ChangeDetectionOptions,
  ChangeDetectionContext,
  LatencyMeasurement,
  RegisterChangeEvent,
  isValidTimestamp,
} from '../types/change-events';
import { createBatchMetadata } from './change-event-manager';

export interface PollingSnapshot {
  timestamp: string;
  registers: Record<number, number>;
}

export interface ChangeDetectionResult {
  events: RegisterChangeEvent[];
  context: ChangeDetectionContext;
  buffer: BufferStats;
  latency: LatencyMeasurement;
}

const DEFAULT_LATENCY: LatencyMeasurement = {
  modbusReadAt: new Date().toISOString(),
  detectedAt: new Date().toISOString(),
  dispatchedAt: new Date().toISOString(),
};

interface InternalBufferState {
  queue: RegisterChangeEvent[];
  dropped: number;
  lastDropAt?: string;
}

const BUFFER_STATE_KEY = Symbol('bufferState');

function getBufferState(context: ChangeDetectionContext): InternalBufferState {
  const state = (context as unknown as Record<string | symbol, InternalBufferState>)[BUFFER_STATE_KEY as unknown as string];
  if (state) {
    return state;
  }

  const initial: InternalBufferState = {
    queue: [],
    dropped: 0,
  };

  (context as unknown as Record<string | symbol, InternalBufferState>)[BUFFER_STATE_KEY as unknown as string] = initial;
  return initial;
}

function calculateLatency(previous: PollingSnapshot, current: PollingSnapshot): LatencyMeasurement {
  const modbusReadAt = isValidTimestamp(previous.timestamp)
    ? previous.timestamp
    : DEFAULT_LATENCY.modbusReadAt;
  const detectedAt = isValidTimestamp(current.timestamp)
    ? current.timestamp
    : DEFAULT_LATENCY.detectedAt;

  const dispatchedAt = new Date().toISOString();

  return {
    modbusReadAt,
    detectedAt,
    dispatchedAt,
  };
}

function createChangeEvent(
  registerAddress: number,
  oldValue: number | null,
  newValue: number,
  batch: ReturnType<typeof createBatchMetadata>,
  timestamp: string,
): RegisterChangeEvent {
  return {
    id: `evt-${registerAddress}-${timestamp}`,
    registerAddress,
    oldValue,
    newValue,
    timestamp,
    changeType: oldValue === null ? 'first_read' : 'value_change',
    source: 'known',
    batch,
  };
}

export function detectRegisterChanges(
  previous: PollingSnapshot,
  current: PollingSnapshot,
  context: ChangeDetectionContext,
  options: ChangeDetectionOptions,
): ChangeDetectionResult {
  const bufferState = getBufferState(context);
  const latency = calculateLatency(previous, current);

  const changedRegisters: Array<{
    register: number;
    oldValue: number | null;
    newValue: number;
  }> = [];

  const allRegisters = new Set(Object.keys(current.registers).map(Number));
  for (const register of allRegisters) {
    const prevValue =
      previous.registers[register] ?? context.previousValues.get(register) ?? null;
    const nextValue = current.registers[register];

    if (typeof nextValue !== 'number' || Number.isNaN(nextValue)) {
      continue;
    }

    const hasChanged = prevValue === null ? true : prevValue !== nextValue;
    if (!hasChanged && options.filterUnchanged) {
      continue;
    }

    if (
      prevValue !== null &&
      typeof options.minimumDelta === 'number' &&
      Math.abs(nextValue - prevValue) < options.minimumDelta
    ) {
      continue;
    }

    const timeSinceLastPoll = Date.now() - context.lastPollTime.getTime();
    if (
      options.debounceDelay > 0 &&
      timeSinceLastPoll < options.debounceDelay &&
      prevValue !== null &&
      prevValue === nextValue
    ) {
      continue;
    }

    changedRegisters.push({
      register,
      oldValue: prevValue,
      newValue: nextValue,
    });

    context.previousValues.set(register, nextValue);
  }

  const changedEvents: RegisterChangeEvent[] = [];
  context.batchSequence += 1;

  const batchTemplate =
    changedRegisters.length > 0
      ? createBatchMetadata({
          batchId: `${context.sessionId}-${context.batchSequence}`,
          size: changedRegisters.length,
          sequence: 1,
          origin: 'real_time',
        })
      : undefined;

  changedRegisters.forEach((entry, idx) => {
    if (!batchTemplate) {
      return;
    }

    const event = createChangeEvent(
      entry.register,
      entry.oldValue,
      entry.newValue,
      {
        ...batchTemplate,
        sequence: idx + 1,
      },
      current.timestamp,
    );

    event.latency = latency;
    changedEvents.push(event);
  });

  const now = Date.parse(current.timestamp);
  bufferState.queue.push(...changedEvents);

  while (bufferState.queue.length > options.buffer.capacity) {
    bufferState.queue.shift();
    bufferState.dropped += 1;
    bufferState.lastDropAt = new Date(now).toISOString();
  }

  bufferState.queue = bufferState.queue.filter((event) => {
    const age = now - Date.parse(event.timestamp);
    if (age > options.buffer.windowMs) {
      bufferState.dropped += 1;
      bufferState.lastDropAt = new Date(now).toISOString();
      return false;
    }
    return true;
  });

  const buffer: BufferStats = {
    size: bufferState.queue.length,
    utilisationPercent: Math.min(
      100,
      (bufferState.queue.length / options.buffer.capacity) * 100,
    ),
    droppedEvents: bufferState.dropped,
    lastDropAt: bufferState.lastDropAt,
  };

  context.lastPollTime = new Date(current.timestamp);

  return {
    events: changedEvents,
    context,
    buffer,
    latency,
  };
}

const DETECTION_BUDGET_MS = 250;
const DISPATCH_BUDGET_MS = 150;
const UI_BUDGET_MS = 600;
const END_TO_END_BUDGET_MS = 1_000;

export function assertLatencyWithinBudget(latency: LatencyMeasurement): boolean {
  const modbus = Date.parse(latency.modbusReadAt);
  const detected = Date.parse(latency.detectedAt);
  const dispatched = Date.parse(latency.dispatchedAt);
  const uiRendered = latency.uiRenderedAt ? Date.parse(latency.uiRenderedAt) : null;

  if ([modbus, detected, dispatched].some((value) => Number.isNaN(value))) {
    return false;
  }

  const detectDuration = detected - modbus;
  const dispatchDuration = dispatched - detected;
  const uiDuration = uiRendered ? uiRendered - dispatched : 0;
  const totalDuration = (uiRendered ?? dispatched) - modbus;

  if (detectDuration > DETECTION_BUDGET_MS) {
    return false;
  }

  if (dispatchDuration > DISPATCH_BUDGET_MS) {
    return false;
  }

  if (uiDuration > UI_BUDGET_MS) {
    return false;
  }

  return totalDuration <= END_TO_END_BUDGET_MS;
}
