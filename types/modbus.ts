export interface RegisterData {
  address: number;
  name: string;
  value: number;
  rawValue: number;
  type: 'switch' | 'temperature' | 'value' | 'mode';
  writable: boolean;
  unit?: string;
  scale?: number;
  timestamp?: string;
}

export interface RegisterChange {
  address: number;
  name: string;
  oldValue: number;
  newValue: number;
  timestamp: string;
  type: string;
}

export interface ModbusConnection {
  connected: boolean;
  host: string;
  port: number;
  lastUpdate?: string;
}

export interface WebSocketMessage {
  type: 'connection' | 'register_update' | 'register_change' | 'bulk_update' | 'error' | 'read_response' | 'write_response' | 'scan_response';
  data?: any;
  timestamp: string;
  address?: number;
  values?: number[];
  verified?: number;
  results?: any;
  count?: number;
}