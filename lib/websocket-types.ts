import type {
  RegisterChangeEvent,
  MonitoringSession,
  BufferStats,
  DependencyStatus,
  DependencyAlert,
  DeliveryMode,
  LatencyMeasurement,
} from '../types/change-events';

export interface ChangeNotification {
  type: 'change_notification';
  event: RegisterChangeEvent;
  sessionId: string;
  timestamp: string;
  deliveryMode: DeliveryMode;
  latency?: LatencyMeasurement;
}

export interface ChangeHistoryRequest {
  type: 'change_history_request';
  registerAddress?: number | null;
  since?: string | null;
  limit: number;
}

export interface ChangeHistoryResponse {
  type: 'change_history_response';
  events: RegisterChangeEvent[];
  totalCount: number;
  requestId: string;
}

export interface SessionStatusUpdate {
  type: 'session_status';
  session: MonitoringSession;
  activeRegisters: number;
  changesPerMinute: number;
}

export interface ErrorMessage {
  type: 'error';
  code: string;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

export interface BufferStatsUpdate {
  type: 'buffer_stats';
  sessionId: string;
  stats: BufferStats;
}

export interface DependencyStatusUpdate {
  type: 'dependency_status';
  sessionId: string;
  statuses: DependencyStatus[];
  alerts?: DependencyAlert[];
}

export interface LatencyMetricsMessage {
  type: 'latency_metrics';
  sessionId: string;
  measurement: LatencyMeasurement;
}

export type WebSocketMessage =
  | ChangeNotification
  | ChangeHistoryRequest
  | ChangeHistoryResponse
  | SessionStatusUpdate
  | BufferStatsUpdate
  | DependencyStatusUpdate
  | LatencyMetricsMessage
  | ErrorMessage;

export function isChangeNotification(msg: WebSocketMessage): msg is ChangeNotification {
  return msg.type === 'change_notification';
}

export function isChangeHistoryRequest(msg: WebSocketMessage): msg is ChangeHistoryRequest {
  return msg.type === 'change_history_request';
}

export function isChangeHistoryResponse(msg: WebSocketMessage): msg is ChangeHistoryResponse {
  return msg.type === 'change_history_response';
}

export function isSessionStatusUpdate(msg: WebSocketMessage): msg is SessionStatusUpdate {
  return msg.type === 'session_status';
}

export function isBufferStatsUpdate(msg: WebSocketMessage): msg is BufferStatsUpdate {
  return msg.type === 'buffer_stats';
}

export function isDependencyStatusUpdate(msg: WebSocketMessage): msg is DependencyStatusUpdate {
  return msg.type === 'dependency_status';
}

export function isLatencyMetricsMessage(msg: WebSocketMessage): msg is LatencyMetricsMessage {
  return msg.type === 'latency_metrics';
}

export function isErrorMessage(msg: WebSocketMessage): msg is ErrorMessage {
  return msg.type === 'error';
}
