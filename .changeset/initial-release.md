---
"ac_modbus": minor
---

Initial release of AC Modbus Home Assistant custom integration

Features:
- Power switch entity (register 1033)
- Mode select entity (register 1041: cool/heat/fan_only/dry)
- Config flow UI for easy setup
- DataUpdateCoordinator for efficient polling
- Custom services (write_register, scan_range)
- Diagnostics support
- Multi-language support (en, zh-Hans)
- HACS compatibility
