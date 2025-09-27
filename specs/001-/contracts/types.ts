/**
 * TypeScript type definitions for Real-Time Register Change Detection
 * Generated from WebSocket API contract
 */

export type ChangeType = 'value_change' | 'first_read' | 'reconnect';
export type RegisterSource = 'known' | 'discovered';
export type DataType = 'int16' | 'uint16' | 'int32' | 'uint32' | 'float';
export type RegisterCategory = 'temperature' | 'control' | 'status' | 'unknown';
export type MonitoringMode = 'basic' | 'enhanced' | 'demo';

export interface RegisterChangeEvent {
  id: string;
  registerAddress: number;
  oldValue: number | null;
  newValue: number;
  timestamp: string; // ISO 8601
  changeType: ChangeType;
  source: RegisterSource;
}

export interface RegisterMetadata {
  name?: string | null;
  unit?: string | null;
  writable: boolean;
  scaling: number;
  confidence: number; // 0.0 - 1.0
  category: RegisterCategory;
}

export interface Register {
  address: number;
  currentValue: number;
  dataType: DataType;
  lastChanged: string | null; // ISO 8601
  changeHistory: RegisterChangeEvent[];
  isMonitored: boolean;
  metadata: RegisterMetadata;
}

export interface SessionConfiguration {
  pollingInterval: number; // milliseconds, minimum 100
  debounceDelay: number; // milliseconds
  maxChangeHistory: number; // maximum 50
  autoDiscovery: boolean;
  highlightDuration: number; // milliseconds
}

export interface MonitoringSession {
  sessionId: string;
  startTime: string; // ISO 8601
  endTime: string | null; // ISO 8601
  mode: MonitoringMode;
  registersMonitored: number[];
  totalChanges: number;
  configuration: SessionConfiguration;
}

// WebSocket Message Types
export interface ChangeNotification {
  type: 'change_notification';
  event: RegisterChangeEvent;
  sessionId: string;
  timestamp: string; // ISO 8601
}

export interface ChangeHistoryRequest {
  type: 'change_history_request';
  registerAddress?: number | null;
  since?: string | null; // ISO 8601
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
  timestamp: string; // ISO 8601
}

// Union type for all possible WebSocket messages
export type WebSocketMessage =
  | ChangeNotification
  | ChangeHistoryRequest
  | ChangeHistoryResponse
  | SessionStatusUpdate
  | ErrorMessage;

// Type guards for WebSocket messages
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

export function isErrorMessage(msg: WebSocketMessage): msg is ErrorMessage {
  return msg.type === 'error';
}

// Utility types for change detection
export interface ChangeDetectionContext {
  previousValues: Map<number, number>; // registerAddress -> value
  lastPollTime: Date;
  sessionId: string;
  debounceTimers: Map<number, NodeJS.Timeout>; // registerAddress -> timer
}

export interface ChangeDetectionOptions {
  debounceDelay: number;
  includeFirstReads: boolean;
  filterUnchanged: boolean;
}

// Configuration for different monitoring modes
export interface ModeConfiguration {
  basic: SessionConfiguration;
  enhanced: SessionConfiguration;
  demo: SessionConfiguration;
}

// Default configurations
export const DEFAULT_SESSION_CONFIG: SessionConfiguration = {
  pollingInterval: 2000,
  debounceDelay: 100,
  maxChangeHistory: 50,
  autoDiscovery: true,
  highlightDuration: 3000,
};

export const MODE_CONFIGS: ModeConfiguration = {
  basic: {
    ...DEFAULT_SESSION_CONFIG,
    autoDiscovery: false,
    pollingInterval: 2000,
  },
  enhanced: {
    ...DEFAULT_SESSION_CONFIG,
    autoDiscovery: true,
    pollingInterval: 1000,
  },
  demo: {
    ...DEFAULT_SESSION_CONFIG,
    autoDiscovery: true,
    pollingInterval: 500,
    debounceDelay: 50,
  },
};

// Validation helpers
export function isValidRegisterAddress(address: number): boolean {
  return Number.isInteger(address) && address >= 1 && address <= 65535;
}

export function isValidTimestamp(timestamp: string): boolean {
  return !isNaN(Date.parse(timestamp));
}

export function isValidConfidence(confidence: number): boolean {
  return typeof confidence === 'number' && confidence >= 0 && confidence <= 1;
}

export function isValidPollingInterval(interval: number): boolean {
  return Number.isInteger(interval) && interval >= 100;
}