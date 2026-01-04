# Filter Replacement Reminder Design

## Overview

Add filter replacement tracking and reminder functionality to the ac_modbus integration. Users can track when the AC filter was last replaced and see how many days remain until the next replacement (90-day cycle).

## Requirements

- **Trigger mechanism**: Pure time-based cycle (90 days from last replacement)
- **Notification approach**: Expose sensor entity for remaining days; users configure HA automations for notifications
- **Reset mechanism**: Button entity to mark filter as replaced
- **Data persistence**: HA built-in `.storage` system

## Industry Case Study

Three existing solutions were evaluated:

| Solution | Type | Pros | Cons |
|----------|------|------|------|
| Home Maintenance (HACS) | Standalone integration | Full UI, multi-task support | Separate from device |
| Device Maintenance Monitor | Standalone integration | Usage-based tracking | Over-complex for fixed interval |
| DIY YAML | Manual config | Fully customizable | High maintenance cost |

**Decision**: Embed directly into ac_modbus integration for tighter device association and simpler user experience.

## Entity Design

### 1. Sensor: `sensor.ac_filter_days_remaining`

| Property | Value |
|----------|-------|
| State | Integer (days remaining, negative if overdue) |
| Unit | `d` (days) |
| State Class | `measurement` |
| Icon | Dynamic based on remaining days |

**Attributes:**
- `last_replacement`: ISO datetime of last filter change
- `next_replacement`: ISO datetime of next scheduled change
- `cycle_days`: 90 (hardcoded)

**Icon Logic:**
- `mdi:air-filter` - Normal (> 14 days)
- `mdi:air-filter` with warning color - Soon (1-14 days)
- `mdi:air-filter` with error color - Overdue (<= 0 days)

### 2. Button: `button.ac_filter_reset`

| Property | Value |
|----------|-------|
| Name | Filter Replaced / 滤芯已更换 |
| Action | Reset `last_replacement` to current time |

## Data Storage

**Location**: `.storage/ac_modbus.filter`

**Format:**
```json
{
  "version": 1,
  "data": {
    "last_replacement": "2024-01-04T10:30:00+08:00"
  }
}
```

**Implementation**: Use `homeassistant.helpers.storage.Store`

```python
from homeassistant.helpers.storage import Store

STORAGE_KEY = "ac_modbus.filter"
STORAGE_VERSION = 1

store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
data = await store.async_load()
await store.async_save({"last_replacement": now_iso})
```

## Code Structure

### Files to Modify/Create

```
custom_components/ac_modbus/
├── __init__.py      # Add: Initialize Store, register button platform
├── const.py         # Add: FILTER_CYCLE_DAYS = 90, STORAGE_KEY
├── sensor.py        # Add: FilterDaysRemainingSensor class
├── button.py        # NEW: FilterResetButton class
├── coordinator.py   # Add: FilterDataManager methods
└── translations/
    ├── en.json      # Add: Entity name translations
    └── zh-Hans.json # Add: Chinese translations
```

### Core Classes

| Class | File | Responsibility |
|-------|------|----------------|
| `FilterDataManager` | coordinator.py | Store read/write, calculate remaining days |
| `FilterDaysRemainingSensor` | sensor.py | Sensor entity displaying remaining days |
| `FilterResetButton` | button.py | Button entity to reset replacement date |

### Data Flow

```
Button Press → FilterDataManager.reset() → Store.async_save()
                       ↓
               Update Sensor State
                       ↓
               HA Automations can trigger notifications
```

## Edge Cases

| Case | Handling |
|------|----------|
| First install (no storage) | Set `last_replacement = now()`, show 90 days |
| Corrupted storage file | Reset to `now()`, log warning |
| Timezone issues | Always use `dt_util.now()` for HA-configured timezone |
| HA restart | Restore from Store, state persists |
| Rapid button clicks | Idempotent operation, no side effects |

## Calculation Logic

```python
from datetime import timedelta
from homeassistant.util import dt as dt_util

FILTER_CYCLE_DAYS = 90

def calculate_days_remaining(last_replacement: datetime) -> int:
    next_replacement = last_replacement + timedelta(days=FILTER_CYCLE_DAYS)
    delta = next_replacement - dt_util.now()
    return delta.days
```

## Implementation Plan

1. Add constants to `const.py`
2. Add `FilterDataManager` to `coordinator.py`
3. Add `FilterDaysRemainingSensor` to `sensor.py`
4. Create `button.py` with `FilterResetButton`
5. Update `__init__.py` to register button platform and initialize storage
6. Add translations to `en.json` and `zh-Hans.json`
7. Test functionality

## User Experience

After implementation, users will see:
- A sensor showing "X days" until filter replacement
- A button to mark filter as replaced
- Can create HA automations to send notifications when days <= 7 (or any threshold)

Example automation (user creates this):
```yaml
automation:
  - alias: "Filter replacement reminder"
    trigger:
      - platform: numeric_state
        entity_id: sensor.ac_filter_days_remaining
        below: 7
    action:
      - service: notify.mobile_app
        data:
          title: "AC Filter Reminder"
          message: "Filter needs replacement in {{ states('sensor.ac_filter_days_remaining') }} days"
```
