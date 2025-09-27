# Data Model: Enhanced Real-Time Register Change Detection

## Core Entities

### RegisterChangeEvent
Represents a detected change in a Modbus register value.

**Fields**:
- `id`: string - Unique identifier for the change event
- `registerAddress`: number - Modbus register address (e.g., 1001, 1045)
- `oldValue`: number | null - Previous register value (null for first reading)
- `newValue`: number - Current register value after change
- `timestamp`: string - ISO 8601 timestamp when change was detected
- `changeType`: 'value_change' | 'first_read' | 'reconnect' - Type of change detected
- `source`: 'known' | 'discovered' - Whether register was predefined or dynamically found

**Validation Rules**:
- `registerAddress` must be positive integer within valid Modbus range (1-65535)
- `oldValue` and `newValue` must be different for 'value_change' type
- `timestamp` must be valid ISO 8601 format
- `changeType` must be one of defined enum values
- `source` must be one of defined enum values

**Relationships**:
- Belongs to a Register (via registerAddress)
- Part of a MonitoringSession change history

### Register
Represents a Modbus register being monitored.

**Fields**:
- `address`: number - Modbus register address
- `currentValue`: number - Latest known value
- `dataType`: 'int16' | 'uint16' | 'int32' | 'uint32' | 'float' - Data interpretation
- `lastChanged`: string | null - ISO 8601 timestamp of last change
- `changeHistory`: RegisterChangeEvent[] - Recent change events (max 50)
- `isMonitored`: boolean - Whether actively polling this register
- `metadata`: RegisterMetadata - Additional register information

**Validation Rules**:
- `address` must be unique within monitoring session
- `changeHistory` array length must not exceed 50 (constitutional constraint)
- `lastChanged` must be valid ISO 8601 or null
- `currentValue` must match latest changeHistory entry newValue

**State Transitions**:
- Initial: `isMonitored=false, changeHistory=[], lastChanged=null`
- First read: Add first_read change event, set currentValue
- Value change: Add value_change event, update currentValue and lastChanged
- Monitoring stop: Set `isMonitored=false`

### RegisterMetadata
Additional information about a register's purpose and characteristics.

**Fields**:
- `name`: string | null - Human-readable name (e.g., "Room Temperature")
- `unit`: string | null - Unit of measurement (e.g., "°C", "kW")
- `writable`: boolean - Whether register accepts write operations
- `scaling`: number - Multiplication factor for display value
- `confidence`: number - Discovery confidence score (0.0-1.0)
- `category`: 'temperature' | 'control' | 'status' | 'unknown' - Inferred register type

**Validation Rules**:
- `confidence` must be between 0.0 and 1.0 inclusive
- `scaling` must be positive number
- `category` must be one of defined enum values

### MonitoringSession
Represents a continuous monitoring period with collected change events.

**Fields**:
- `sessionId`: string - Unique session identifier
- `startTime`: string - ISO 8601 timestamp when monitoring started
- `endTime`: string | null - ISO 8601 timestamp when monitoring stopped (null if active)
- `mode`: 'basic' | 'enhanced' | 'demo' - Monitoring mode used
- `registersMonitored`: number[] - Array of register addresses being monitored
- `totalChanges`: number - Count of all change events in this session
- `configuration`: SessionConfiguration - Monitoring parameters

**Validation Rules**:
- `startTime` must be valid ISO 8601 timestamp
- `endTime` must be after startTime if provided
- `totalChanges` must be non-negative integer
- `registersMonitored` must contain unique addresses

### SessionConfiguration
Configuration parameters for a monitoring session.

**Fields**:
- `pollingInterval`: number - Milliseconds between register reads
- `debounceDelay`: number - Milliseconds to wait before reporting rapid changes
- `maxChangeHistory`: number - Maximum change events to retain (default 50)
- `autoDiscovery`: boolean - Whether to enable dynamic register discovery
- `highlightDuration`: number - Milliseconds to highlight changes in UI

**Validation Rules**:
- `pollingInterval` must be positive integer (minimum 100ms for constitutional compliance)
- `debounceDelay` must be non-negative integer (typically 50-200ms)
- `maxChangeHistory` must be positive integer (maximum 50 per constitution)
- `highlightDuration` must be positive integer

## WebSocket Message Types

### ChangeNotification
Real-time notification of register value changes.

**Fields**:
- `type`: 'change_notification'
- `event`: RegisterChangeEvent - The change that occurred
- `sessionId`: string - Associated monitoring session
- `timestamp`: string - Server timestamp when message was sent

### ChangeHistoryRequest
Client request for historical change data.

**Fields**:
- `type`: 'change_history_request'
- `registerAddress`: number | null - Specific register (null for all)
- `since`: string | null - ISO 8601 timestamp for changes after this time
- `limit`: number - Maximum number of events to return

### ChangeHistoryResponse
Server response with historical change data.

**Fields**:
- `type`: 'change_history_response'
- `events`: RegisterChangeEvent[] - Array of change events
- `totalCount`: number - Total available events (may exceed returned count)
- `requestId`: string - Correlation ID for request

### SessionStatusUpdate
Notification about monitoring session state changes.

**Fields**:
- `type`: 'session_status'
- `session`: MonitoringSession - Current session information
- `activeRegisters`: number - Count of registers being monitored
- `changesPerMinute`: number - Recent change frequency

## Integration Points

### Existing Modbus Types
- Extends existing `ModbusRegisterValue` interface
- Compatible with `EnhancedRegisterData` structure
- Integrates with `ScanResult` for discovered registers

### WebSocket Protocol
- Adds new message types to existing WebSocket communication
- Maintains backward compatibility with current monitoring messages
- Extends existing connection lifecycle management

### UI Component State
- Provides structured data for React component state management
- Enables efficient re-rendering based on change events
- Supports filtering and sorting of change history

## Performance Considerations

### Memory Usage
- Bounded change history (50 events × ~150 bytes = ~7.5KB per register)
- Circular buffer implementation for efficient memory management
- Garbage collection friendly with object pooling for frequent allocations

### Real-time Constraints
- Change detection algorithm: O(1) per register per poll cycle
- WebSocket message serialization: <1ms for typical change events
- UI update processing: <10ms for highlighting and history updates

### Scalability Limits
- Maximum 1000 registers monitored simultaneously
- Change event processing: 100+ changes per second sustainable
- WebSocket message rate: 1000+ messages per second capacity