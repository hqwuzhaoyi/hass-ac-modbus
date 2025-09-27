# Quickstart: Enhanced Real-Time Register Change Detection

## Overview
This quickstart validates the enhanced real-time register change detection feature by testing the core user scenario: correlating physical AC operations with Modbus register changes.

## Prerequisites
- Node.js development environment
- Access to Modbus AC device (or demo mode for testing)
- Basic and enhanced monitoring systems running

## Test Scenario Validation

### Scenario 1: Power Button Operation Detection
**User Story**: When I press the power button on my AC remote, I should immediately see which register(s) changed value and their new values.

**Setup Steps**:
1. Start enhanced monitoring server:
   ```bash
   npm run ws:enhanced
   ```
2. Open enhanced monitoring interface:
   ```bash
   npm run dev
   # Navigate to http://localhost:3002/enhanced
   ```
3. Verify WebSocket connection shows "Connected" status
4. Confirm register monitoring is active (green indicators)

**Test Steps**:
1. Note current register values displayed in the interface
2. Press power button on AC remote control
3. Observe interface for highlighted changes within 100ms
4. Verify change history shows new entry with:
   - Register address that changed
   - Previous value (before power press)
   - New value (after power press)
   - Accurate timestamp
   - Change type: "value_change"

**Expected Results**:
- One or more registers highlight immediately (≤100ms)
- Change history updates with timestamped event
- Previous/new values clearly displayed
- Visual highlighting fades after ~3 seconds

### Scenario 2: Temperature Adjustment Tracking
**User Story**: When I adjust the temperature setting on the physical AC unit, the corresponding temperature control registers should be highlighted as changed with timestamps.

**Test Steps**:
1. Ensure monitoring interface is active from Scenario 1
2. Use physical AC controls to change temperature setpoint
3. Watch for register changes during adjustment
4. Verify temperature-related registers are identified

**Expected Results**:
- Temperature control registers change values
- Register metadata indicates "temperature" category
- Value changes reflect temperature adjustment direction
- Change timestamps correspond to physical action timing

### Scenario 3: Multiple Simultaneous Changes
**User Story**: When I operate a multi-function control, all affected registers should be clearly displayed with their before/after values.

**Test Steps**:
1. Continue from previous scenarios
2. Use a complex AC function (e.g., auto mode, timer setting)
3. Observe multiple register changes
4. Review change history for complete event sequence

**Expected Results**:
- Multiple registers highlight simultaneously
- All changes appear in chronological order
- No changes are missed during rapid updates
- UI remains responsive during multiple updates

## Demo Mode Testing
**Alternative for environments without physical AC access**:

1. Start demo server:
   ```bash
   npm run ws:demo
   ```
2. Demo server simulates register changes automatically
3. Verify change detection works with simulated data
4. Test UI responsiveness with artificial change patterns

## Integration Testing

### WebSocket Protocol Validation
**Test WebSocket message handling**:

1. Open browser developer tools (Network → WS tab)
2. Monitor WebSocket messages during register changes
3. Verify message format matches contract specification:
   ```json
   {
     "type": "change_notification",
     "event": {
       "id": "change_20231027_143052_1001",
       "registerAddress": 1001,
       "oldValue": 23,
       "newValue": 24,
       "timestamp": "2023-10-27T14:30:52.123Z",
       "changeType": "value_change",
       "source": "known"
     },
     "sessionId": "session_20231027_140000",
     "timestamp": "2023-10-27T14:30:52.456Z"
   }
   ```

### Performance Validation
**Verify constitutional compliance**:

1. Monitor change detection latency using browser dev tools
2. Measure time from register change to UI update
3. Confirm <100ms response time requirement
4. Test with high-frequency changes (rapid button presses)

**Performance Metrics**:
- Change detection: <50ms per register
- WebSocket broadcast: <10ms message delivery
- UI update: <40ms for highlighting and history

### Backward Compatibility Testing
**Ensure existing functionality preserved**:

1. Test basic monitoring mode still works:
   ```bash
   npm run ws  # Basic server
   # Navigate to http://localhost:3002 (basic interface)
   ```
2. Verify enhanced mode without change detection works
3. Confirm MQTT bridge integration remains functional:
   ```bash
   npm run bridge
   ```

## Troubleshooting

### Common Issues

**Changes not detected**:
- Verify WebSocket connection is active
- Check polling interval in session configuration
- Ensure register is in monitored set
- Test with demo mode to isolate hardware issues

**High latency**:
- Check network connectivity to Modbus device
- Verify polling interval not too aggressive
- Monitor browser performance tab for bottlenecks

**Missing change history**:
- Confirm change history limit (50 events max)
- Check for WebSocket disconnection/reconnection
- Verify timestamp parsing and display

**UI not updating**:
- Check browser console for JavaScript errors
- Verify React component state management
- Test with different browsers/devices

### Validation Checklist

- [ ] Power button changes detected <100ms
- [ ] Temperature adjustments tracked accurately
- [ ] Multiple simultaneous changes handled
- [ ] Change history maintains chronological order
- [ ] WebSocket messages match contract format
- [ ] Performance meets constitutional requirements
- [ ] Backward compatibility preserved
- [ ] Demo mode works for testing
- [ ] Error handling graceful and informative
- [ ] UI highlighting provides clear visual feedback

## Success Criteria
This quickstart validates successful implementation when:

1. **Real-time correlation**: Physical AC operations immediately show corresponding register changes
2. **Complete change tracking**: All register value changes are captured and displayed
3. **Performance compliance**: Sub-100ms detection and display latency
4. **User experience**: Clear visual feedback enables effective reverse engineering
5. **System integration**: Feature works across all monitoring modes without disruption

## Next Steps
After successful quickstart validation:

1. **Production deployment**: Configure for actual AC units
2. **Register mapping**: Use change detection to build comprehensive register database
3. **Home Assistant integration**: Export discovered register functions to MQTT
4. **Performance tuning**: Optimize polling intervals for specific AC models
5. **Documentation**: Document discovered register functions for future reference