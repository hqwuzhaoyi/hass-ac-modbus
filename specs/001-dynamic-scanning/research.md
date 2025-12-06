# Research: Enhanced Real-Time Register Change Detection

## Research Scope
Investigate optimal approaches for real-time change detection in the existing Modbus monitoring system to enable correlation between physical AC operations and register changes.

## Key Research Areas

### 1. Change Detection Latency Requirements
**Decision**: Target sub-100ms detection and broadcast latency
**Rationale**:
- Constitutional requirement for real-time data integrity
- User needs immediate visual feedback when operating physical controls
- Existing WebSocket infrastructure supports this performance target
**Alternatives considered**:
- 1-second polling: Too slow for real-time correlation
- 5-second intervals: Inadequate for immediate feedback
- 250ms polling: Acceptable but not optimal for user experience

### 2. Timestamp Precision Strategy
**Decision**: Millisecond precision with ISO 8601 format
**Rationale**:
- Enables precise temporal correlation between physical actions and register changes
- Compatible with existing JavaScript Date objects and JSON serialization
- Sufficient granularity for human-operated controls
**Alternatives considered**:
- Second precision: Insufficient for rapid sequential operations
- Microsecond precision: Unnecessary overhead for AC controls
- Relative timestamps: Less useful for historical analysis

### 3. Change Detection Algorithm
**Decision**: Value comparison with debouncing for rapid fluctuations
**Rationale**:
- Simple and reliable for integer/float register values
- Debouncing prevents noise from unstable sensor readings
- Integrates cleanly with existing polling infrastructure
**Alternatives considered**:
- Delta thresholds: Complex and domain-specific tuning required
- Statistical change detection: Overkill for discrete control operations
- Interrupt-based detection: Not supported by Modbus TCP protocol

### 4. WebSocket Message Protocol Extension
**Decision**: Extend existing message format with change event type
**Rationale**:
- Maintains backward compatibility with current monitoring clients
- Allows selective subscription to change events vs regular updates
- Follows established patterns in codebase
**Alternatives considered**:
- Separate WebSocket channel: Increased complexity and connection overhead
- HTTP-based change notifications: Higher latency than WebSocket
- Server-sent events: One-way communication limits interactivity

### 5. Change History Storage Strategy
**Decision**: In-memory circular buffer (50 entries per constitutional constraint)
**Rationale**:
- Fast access for recent change correlation
- Memory bounded to prevent resource leaks
- Sufficient history for typical troubleshooting sessions
**Alternatives considered**:
- Persistent storage: Unnecessary complexity for temporary analysis
- Unlimited history: Risk of memory exhaustion during long sessions
- 10-entry history: Too limited for complex multi-step operations

### 6. Integration with Existing Server Modes
**Decision**: Modify existing server files with change detection middleware
**Rationale**:
- Preserves three-mode architecture (basic/enhanced/demo)
- Consistent behavior across all operational modes
- Minimal disruption to existing deployment workflows
**Alternatives considered**:
- New dedicated change-detection server: Fragmenting operational modes
- Mode-specific implementations: Code duplication and maintenance overhead
- Client-side change detection: Higher latency and unreliable results

### 7. Visual Highlighting Strategy
**Decision**: CSS-based highlighting with fade transitions
**Rationale**:
- Non-disruptive visual feedback that draws attention to changes
- Accessible across different devices and screen sizes
- Leverages existing Tailwind CSS framework
**Alternatives considered**:
- Audio notifications: May be disruptive in industrial environments
- Modal dialogs: Would interrupt workflow and hide other data
- Separate change log panel: Reduces space for register values

### 8. Performance Optimization Approach
**Decision**: Differential updates with change event batching
**Rationale**:
- Only broadcast registers that actually changed
- Batching prevents WebSocket flooding during multiple simultaneous changes
- Maintains responsiveness under high-frequency operations
**Alternatives considered**:
- Full state broadcasts: Unnecessary bandwidth and processing overhead
- Individual change messages: Risk of message ordering issues
- Throttled updates: Could miss rapid sequential changes

## Implementation Considerations

### Technical Dependencies
- **Existing**: modbus-serial, ws, Next.js, React, TypeScript
- **New**: No additional dependencies required
- **Compatibility**: All research decisions compatible with existing stack

### Performance Impact Analysis
- **Memory**: +50 change events × ~100 bytes = ~5KB per session
- **CPU**: Negligible overhead for value comparison operations
- **Network**: Minimal increase in WebSocket message frequency
- **Latency**: Target <100ms from register read to UI update achieved

### Risk Mitigation
- **Backward compatibility**: Maintained through protocol versioning
- **Resource management**: Bounded history prevents memory leaks
- **Failure handling**: Change detection failures don't affect basic monitoring
- **Testing strategy**: Demo mode enables testing without physical hardware

## Research Validation
All research decisions address the core requirement of enabling real-time correlation between physical AC operations and Modbus register changes while maintaining system performance and reliability within constitutional constraints.