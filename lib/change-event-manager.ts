import {
  BufferStats,
  ChangeBatchMetadata,
  DependencyAlert,
  RegisterChangeEvent,
  isValidRegisterAddress,
  isValidLatencyMeasurement,
} from "../types/change-events";

export interface ChangeEventValidationResult {
  event: RegisterChangeEvent;
  warnings: string[];
}

const ISO_ERROR =
  "Invalid register change event: timestamp must be ISO 8601 with milliseconds";
const ADDRESS_ERROR =
  "Invalid register change event: registerAddress must be between 1 and 65535";
const VALUE_ERROR = "Invalid register change event: newValue must be provided";
const BATCH_ERROR =
  "Invalid register change event: batch metadata is incomplete";
const LATENCY_WARNING =
  "Latency measurement missing uiRenderedAt – UI rendering latency cannot be audited";

export function validateChangeEvent(
  input: Partial<RegisterChangeEvent>
): ChangeEventValidationResult {
  if (typeof input !== "object" || input === null) {
    throw new Error("Invalid register change event: payload must be an object");
  }

  const {
    id,
    registerAddress,
    newValue,
    timestamp,
    changeType,
    source,
    batch,
    latency,
  } = input;

  if (!id || typeof id !== "string") {
    throw new Error("Invalid register change event: id is required");
  }

  if (!isValidRegisterAddress(registerAddress as number)) {
    throw new Error(ADDRESS_ERROR);
  }

  if (typeof newValue !== "number") {
    throw new Error(VALUE_ERROR);
  }

  if (
    !timestamp ||
    typeof timestamp !== "string" ||
    Number.isNaN(Date.parse(timestamp))
  ) {
    throw new Error(ISO_ERROR);
  }

  if (!changeType) {
    throw new Error("Invalid register change event: changeType is required");
  }

  if (!source) {
    throw new Error("Invalid register change event: source is required");
  }

  if (
    !batch ||
    !batch.batchId ||
    !batch.sequence ||
    !batch.size ||
    !batch.origin
  ) {
    throw new Error(BATCH_ERROR);
  }

  const warnings: string[] = [];
  if (latency && isValidLatencyMeasurement(latency)) {
    if (!latency.uiRenderedAt) {
      warnings.push(LATENCY_WARNING);
    }
  } else if (latency) {
    throw new Error(
      "Invalid register change event: latency measurement is inconsistent"
    );
  }

  return {
    event: input as RegisterChangeEvent,
    warnings,
  };
}

export function createBatchMetadata(
  partial: Partial<ChangeBatchMetadata>
): ChangeBatchMetadata {
  if (!partial.batchId) {
    throw new Error("batchId is required when creating batch metadata");
  }

  const size = partial.size ?? 1;
  const sequence = partial.sequence ?? 1;
  const origin = partial.origin ?? "real_time";

  if (size < 1) {
    throw new Error("Batch size must be at least 1");
  }

  if (sequence < 1 || sequence > size) {
    throw new Error("Batch sequence must fall within batch size bounds");
  }

  return {
    batchId: partial.batchId,
    size,
    sequence,
    origin,
  };
}

export function summariseBuffer(buffer: BufferStats): string {
  const utilisation = buffer.utilisationPercent.toFixed(1);
  const dropped = buffer.droppedEvents;
  return `Buffer utilisation ${utilisation}% (${
    buffer.size
  } events retained, ${dropped} dropped)${
    buffer.lastDropAt ? `, last drop at ${buffer.lastDropAt}` : ""
  }`;
}

export function formatDependencyAlert(alert: DependencyAlert): string {
  const resolved = alert.resolvedAt
    ? `resolved ${alert.resolvedAt}`
    : "unresolved";
  return `[${alert.dependency}] transitioned ${alert.previousStatus} → ${alert.currentStatus} at ${alert.occurredAt} (${resolved}): ${alert.message}`;
}
