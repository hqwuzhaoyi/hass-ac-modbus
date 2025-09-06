# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Home Assistant Air Conditioning Modbus Integration - A Node.js tool for connecting and controlling Modbus protocol air conditioners with Home Assistant integration via MQTT. The project consists of two main parts:

1. **Main Node.js application** (`src/`) - Core Modbus communication, scanning, and MQTT bridge
2. **Next.js web interface** (`ac-monitor-nextjs/`) - Modern web-based monitoring dashboard

## Common Commands

### Main Application
- `npm install` - Install dependencies for main app
- `npm start` - Start all services (monitor + MQTT bridge)
- `npm run dev` - Start WebSocket server + Next.js dev server
- `npm run ws` - Start WebSocket server only
- `npm run test` - Test Modbus connection

### Scanning Commands (Optimized)
- `npm run scan` - Basic Modbus register scan
- `npm run scan:enhanced` - Enhanced parallel scan with intelligent analysis
- `npm run scan:smart` - Smart optimized scan with adaptive algorithms
- `npm run scan:stats` - View scan history and statistics
- `npm run scan:compare` - Compare different scanning strategies
- `npm run bridge` - Start MQTT bridge to Home Assistant
- `npm run monitor` - Start web monitoring interface

### Next.js Web Interface
- `cd ac-monitor-nextjs && npm install` - Install Next.js dependencies
- `cd ac-monitor-nextjs && npm run dev` - Start Next.js dev server on port 3002
- `cd ac-monitor-nextjs && npm run build` - Build production Next.js app
- `cd ac-monitor-nextjs && npm run full` - Start both WebSocket server and Next.js dev server

## Architecture

### Core Components (src/)
- **index.js** - Main application entry point with command-line interface
- **modbus-scanner.js** - Scans Modbus registers to discover air conditioner parameters
- **modbus-client.js** - Low-level Modbus TCP communication client
- **data-analyzer.js** - AI-powered analysis of scan results to identify temperature, mode, fan speed registers
- **mqtt-bridge.js** - Publishes air conditioner state to MQTT for Home Assistant auto-discovery
- **web-monitor.js** - Express-based web monitoring interface with WebSocket support
- **packet-capture.js** - Network packet capture for protocol analysis

### Configuration System
- **config/modbus-config.json** - Main configuration with connection settings and known register mappings
- **config/modbus-config-discovered.json** - Generated after scanning with discovered registers
- **config/modbus-config-analyzed.json** - Final configuration after AI analysis
- **.env** - Environment variables (copy from .env.example)

### Next.js Frontend (ac-monitor-nextjs/)
- **app/page.tsx** - Main dashboard page with real-time monitoring
- **app/api/modbus/** - API routes for Modbus operations (connect, read, write, scan)
- **components/ui/** - Reusable UI components using Radix UI and Tailwind
- **lib/modbus-client.ts** - TypeScript Modbus client for frontend
- **server.js** - WebSocket server for real-time communication

### Data Flow
1. **Discovery Phase**: Scanner finds responsive registers → Analyzer identifies parameter types → Updated config generated
2. **Runtime Phase**: Web monitor provides real-time interface → MQTT bridge publishes to Home Assistant → Both use ModbusClient for communication

### Key Dependencies
- **modbus-serial** - Modbus TCP/RTU communication
- **mqtt** - MQTT client for Home Assistant integration  
- **express + ws** - Web interface with WebSocket support
- **winston** - Structured logging
- **pcap** (optional) - Network packet capture
- **Next.js + TypeScript** - Modern web frontend with type safety

### Enhanced Scanning System
- **lib/enhanced-scanner.ts** - Parallel scanning with adaptive batch sizing
- **lib/scan-optimizer.ts** - Intelligent scan optimization with history analysis
- **examples/enhanced-scanning-example.ts** - Complete usage examples
- **scripts/smart-scan.ts** - CLI tool for optimized scanning

## Development Notes

### Configuration Workflow
1. Copy `.env.example` to `.env` and configure MODBUS_HOST and MQTT settings
2. Run `npm run scan:smart` for optimized discovery of air conditioner registers
3. Check `config/enhanced-scan-config.json` for AI-identified parameters
4. Use `npm run scan:stats` to view scan history and optimization suggestions
5. Fine-tune register mappings if needed

### Scanning Strategy Selection
- **Basic scanning** (`npm run scan`) - Traditional sequential scanning
- **Enhanced scanning** (`npm run scan:enhanced`) - Parallel with intelligent analysis
- **Smart scanning** (`npm run scan:smart`) - Adaptive with history optimization
- **Performance comparison** (`npm run scan:compare`) - Benchmark different strategies

### Testing Modbus Connection
Use `npm run test` to verify connectivity before running other services. For performance analysis, use `npm run scan:stats` to view historical scan data.

### Optimization Tips
- First run typically takes longer for full discovery
- Subsequent runs use incremental scanning for faster results
- High-priority ranges (1030-1180) are scanned first
- Adaptive batch sizing optimizes for device response characteristics