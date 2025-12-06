export type ChangeType = 'value_change' | 'first_read' | 'reconnect';
export type RegisterSource = 'known' | 'discovered';
export type DeliveryMode = 'real_time' | 'playback';
export type MonitoringSessionMode = 'basic' | 'enhanced' | 'demo';
export type MonitoringSessionState = 'starting' | 'active' | 'paused' | 'resuming' | 'stopped' | 'degraded';

export interface ChangeBatchMetadata {
  batchId: string;
  /** Position of this event within the batch (1-indexed). */
  sequence: number;
  /** Total number of events contained in the batch. */
  size: number;
  /** True when the batch is emitted as part of a playback replay. */
  origin: DeliveryMode;
}

export interface LatencyMeasurement {
  modbusReadAt: string;
  detectedAt: string;
  dispatchedAt: string;
  uiRenderedAt?: string;
}

export interface RegisterChangeEvent {
  id: string;
  registerAddress: number;
  oldValue: number | null;
  newValue: number;
  timestamp: string;
  changeType: ChangeType;
  source: RegisterSource;
  batch: ChangeBatchMetadata;
  latency?: LatencyMeasurement;
}

export interface RegisterMetadata {
  name?: string | null;
  unit?: string | null;
  writable: boolean;
  scaling: number;
  confidence: number;
  category: 'temperature' | 'control' | 'status' | 'unknown';
}

export interface RegisterWithHistory {
  address: number;
  currentValue: number;
  dataType: 'int16' | 'uint16' | 'int32' | 'uint32' | 'float';
  lastChanged: string | null;
  changeHistory: RegisterChangeEvent[];
  isMonitored: boolean;
  metadata: RegisterMetadata;
}

export interface BufferConfiguration {
  /** Maximum number of events retained in the circular buffer. */
  capacity: number;
  /** Maximum duration in milliseconds retained in the buffer window. */
  windowMs: number;
}

export interface AlertThresholds {
  /** Percentage (0-100) at which buffer utilisation raises a warning. */
  bufferUtilisationPercent: number;
  /** Number of consecutive dropped events that should trigger an alert. */
  consecutiveDrops: number;
  /** Maximum tolerated disconnect duration in milliseconds before escalation. */
  reconnectTimeoutMs: number;
}

export interface SessionConfiguration {
  pollingInterval: number;
  debounceDelay: number;
  maxChangeHistory: number;
  autoDiscovery: boolean;
  highlightDuration: number;
  buffer: BufferConfiguration;
  alertThresholds: AlertThresholds;
  changeThreshold: number;
}

export interface MonitoringSession {
  sessionId: string;
  startTime: string;
  endTime: string | null;
  mode: MonitoringSessionMode;
  state: MonitoringSessionState;
  registersMonitored: number[];
  totalChanges: number;
  configuration: SessionConfiguration;
  bufferStats?: BufferStats;
  dependencies?: DependencyStatus[];
  alerts?: DependencyAlert[];
  lifecycleLog?: SessionLifecycleEntry[];
}

export interface MonitoringSessionSummary {
  sessionId: string;
  mode: MonitoringSessionMode;
  state: MonitoringSessionState;
  startedAt: string;
  endedAt: string | null;
  totalChanges: number;
  droppedEvents: number;
  bufferUtilisationPercent: number;
}

export interface ChangeDetectionContext {
  previousValues: Map<number, number>;
  lastPollTime: Date;
  sessionId: string;
  debounceTimers: Map<number, NodeJS.Timeout>;
  batchSequence: number;
}

export interface SessionLifecycleEntry {
  from: MonitoringSessionState;
  to: MonitoringSessionState;
  occurredAt: string;
}

export interface ChangeDetectionOptions {
  debounceDelay: number;
  includeFirstReads: boolean;
  filterUnchanged: boolean;
  buffer: BufferConfiguration;
  minimumDelta?: number;
}

export interface BufferStats {
  /** Number of events currently retained in the circular buffer. */
  size: number;
  /** Percentage utilisation relative to configured capacity. */
  utilisationPercent: number;
  /** Number of events dropped since monitoring started. */
  droppedEvents: number;
  /** Timestamp of the most recent dropped event, if any. */
  lastDropAt?: string;
}

export interface DependencyStatus {
  name: 'modbus' | 'websocket' | 'mqtt' | 'time_sync';
  status: 'healthy' | 'degraded' | 'disconnected';
  lastCheckedAt: string;
  details?: string;
}

export interface DependencyAlert {
  dependency: DependencyStatus['name'];
  previousStatus: DependencyStatus['status'];
  currentStatus: DependencyStatus['status'];
  occurredAt: string;
  resolvedAt?: string;
  message: string;
}

export const DEFAULT_SESSION_CONFIG: SessionConfiguration = {
  pollingInterval: 200,
  debounceDelay: 100,
  maxChangeHistory: 50,
  autoDiscovery: true,
  highlightDuration: 3000,
  buffer: {
    capacity: 200,
    windowMs: 30_000,
  },
  alertThresholds: {
    bufferUtilisationPercent: 80,
    consecutiveDrops: 5,
    reconnectTimeoutMs: 3_000,
  },
  changeThreshold: 1,
};

const ISO_8601_REGEX =
  /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?Z$/;

export function isValidRegisterAddress(address: number): boolean {
  return Number.isInteger(address) && address >= 1 && address <= 65_535;
}

export function isValidTimestamp(timestamp: string): boolean {
  return ISO_8601_REGEX.test(timestamp) && !Number.isNaN(Date.parse(timestamp));
}

export function isValidConfidence(confidence: number): boolean {
  return typeof confidence === 'number' && confidence >= 0 && confidence <= 1;
}

export function isValidPollingInterval(interval: number): boolean {
  return Number.isInteger(interval) && interval >= 100;
}

export function isValidLatencyMeasurement(latency: LatencyMeasurement): boolean {
  const { modbusReadAt, detectedAt, dispatchedAt, uiRenderedAt } = latency;
  const timestamps = [modbusReadAt, detectedAt, dispatchedAt].map((value) =>
    typeof value === 'string' ? Date.parse(value) : Number.NaN,
  );
  if (timestamps.some(Number.isNaN)) {
    return false;
  }
  const parsedRendered =
    uiRenderedAt !== undefined ? (typeof uiRenderedAt === 'string' ? Date.parse(uiRenderedAt) : Number.NaN) : null;
  if (parsedRendered !== null && Number.isNaN(parsedRendered)) {
    return false;
  }
  return (
    timestamps[0] <= timestamps[1] &&
    timestamps[1] <= timestamps[2] &&
    (parsedRendered === null || timestamps[2] <= parsedRendered)
  );
}
