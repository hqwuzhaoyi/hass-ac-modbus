---
"ac_modbus": minor
---

Add Home/Away and Humidify controls with power state constraints

Features:
- Home/Away switch entity (register 1034) - requires power ON
- Humidify switch entity (register 1168) - requires power ON
- Mode sensor entity for always-visible mode display
- Power state constraints for mode selection (requires power OFF)
- CoordinatorEntity for instant state updates
- Updated WebUI with all 4 register controls
