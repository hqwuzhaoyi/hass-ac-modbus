<!--
Sync Impact Report:
Version change: Initial creation → v1.0.0
Modified principles: N/A (new constitution)
Added sections: Core Principles (5), Additional Constraints, Development Workflow, Governance
Removed sections: N/A
Templates requiring updates: All templates validated and compatible
Follow-up TODOs: None
-->

# Home Assistant Air Conditioning Modbus Integration Constitution

## Core Principles

### I. Real-time Data Integrity
System MUST maintain real-time accuracy of Modbus register data with timestamp tracking for all changes. WebSocket connections MUST broadcast updates within 100ms of register value changes. Data caching MUST preserve consistency between known and dynamically discovered registers.

**Rationale**: Air conditioning control requires immediate feedback for user safety and system reliability. Stale data could lead to incorrect temperature control or device malfunction.

### II. Progressive Discovery Architecture
System MUST support both predefined register monitoring and intelligent register discovery without disrupting existing functionality. Enhanced scanning MUST operate in parallel with basic monitoring. All discovery features MUST be incrementally adoptable.

**Rationale**: HVAC systems vary significantly in register layouts. The system must accommodate both well-documented and undocumented Modbus implementations while maintaining backward compatibility.

### III. TypeScript-First Development
All new code MUST be written in TypeScript with complete type definitions. Legacy JavaScript components are permitted but MUST NOT be extended without TypeScript migration. Type safety MUST cover Modbus register mappings, WebSocket messages, and API contracts.

**Rationale**: Complex industrial protocols require type safety to prevent runtime errors that could affect physical equipment. TypeScript enables better tooling and safer refactoring of critical control systems.

### IV. Multi-Mode Operation Support
System MUST support demo, basic, and enhanced operation modes without shared state conflicts. Each mode MUST be independently testable and deployable. Configuration switching between modes MUST NOT require code changes.

**Rationale**: Development, testing, and production environments have different hardware access requirements. Multiple operational modes enable safe development without physical Modbus devices.

### V. Home Assistant Integration Excellence
All device capabilities discovered through scanning MUST be automatically exposable to Home Assistant via MQTT. Register metadata (units, scaling, write permissions) MUST be preserved through the integration chain. MQTT discovery payloads MUST follow Home Assistant standards.

**Rationale**: The primary value proposition is seamless Home Assistant integration. Manual configuration overhead defeats the purpose of intelligent discovery.

## Additional Constraints

### Technology Stack Requirements
- **Frontend**: Next.js 14+ with TypeScript, Radix UI components, Tailwind CSS
- **Backend**: Node.js with Express, WebSocket servers, modbus-serial library
- **Testing**: Jest for unit testing, integration tests for Modbus communication
- **Build**: Next.js build system, concurrent execution support
- **Deployment**: Single repository, multi-process execution model

### Performance Standards
- **Register polling**: Maximum 2-second intervals for known registers
- **WebSocket response**: Sub-100ms for register change broadcasts
- **Scan performance**: Parallel batching with adaptive sizing for device capabilities
- **UI responsiveness**: Real-time updates without blocking user interactions
- **Memory usage**: Bounded register history (50 entries maximum)

### Security Requirements
- **Environment isolation**: All sensitive configuration via environment variables
- **Network security**: Modbus connections restricted to configured hosts only
- **Data validation**: All user inputs validated before Modbus operations
- **Error handling**: Graceful degradation without exposing internal errors
- **Logging**: Structured logging without sensitive data exposure

## Development Workflow

### Code Review Requirements
- All PRs MUST include TypeScript compilation without errors
- Register discovery changes MUST include demo mode validation
- WebSocket protocol changes MUST maintain backward compatibility
- MQTT integration changes MUST follow Home Assistant conventions
- Performance-critical paths MUST include benchmarking data

### Testing Requirements
- **Unit tests**: Required for all utility functions and data transformations
- **Integration tests**: Required for Modbus communication and WebSocket protocols
- **End-to-end tests**: Required for complete user workflows in demo mode
- **Performance tests**: Required for scanning algorithms and real-time monitoring
- **Manual testing**: Required for physical device validation before release

### Quality Gates
- **Type safety**: Zero TypeScript errors in strict mode
- **Linting**: ESLint compliance with Next.js configuration
- **Testing**: All tests passing with coverage for critical paths
- **Performance**: Regression testing for response times and memory usage
- **Documentation**: README and CLAUDE.md maintained for new features

## Governance

### Amendment Procedure
1. **Proposal**: Document specific constitutional violation and justification
2. **Technical review**: Validate impact on existing architecture and integrations
3. **Approval**: Consensus required among project maintainers
4. **Migration**: Update all dependent templates and documentation
5. **Version bump**: Follow semantic versioning for constitution changes

### Versioning Policy
- **MAJOR**: Backward incompatible changes to operational modes or core principles
- **MINOR**: New principles added or existing principles materially expanded
- **PATCH**: Clarifications, corrections, or non-semantic refinements

### Compliance Review
- All feature specifications MUST pass constitutional review before implementation planning
- Implementation plans MUST document any principled violations with justification
- Post-implementation review MUST verify constitutional compliance
- Constitution violations discovered in existing code MUST be tracked and prioritized

**Version**: 1.0.0 | **Ratified**: 2025-09-27 | **Last Amended**: 2025-09-27