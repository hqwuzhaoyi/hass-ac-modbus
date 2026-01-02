import { WebSocketServer } from 'ws';
import { getModbusManager } from './lib/modbus-client';

const ALLOWED_REGISTERS = [1033, 1034, 1041, 1168];

const SESSION_CONFIG = {
  pollingInterval: 0,
  debounceDelay: 0,
  buffer: {
    capacity: 200,
    windowMs: 30_000,
  },
  alertThresholds: {
    bufferUtilisationPercent: 80,
    consecutiveDrops: 5,
    reconnectTimeoutMs: 3_000,
  },
  changeThreshold: 0,
};

console.log('📡 启动 Modbus WebSocket（仅 1033/1041 手动读写，支持热重载）');
console.log('⚙️ 轮询/实时查询禁用，按需手动读写');

const modbusManager = getModbusManager();
modbusManager.configureSession(SESSION_CONFIG);
modbusManager.setSessionMode('basic');

const mqttHost = process.env.MQTT_HOST;
if (mqttHost) {
  const mqttConfig = {
    host: mqttHost,
    port: Number(process.env.MQTT_PORT ?? 1883),
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    clientId: process.env.MQTT_CLIENT_ID ?? 'hass-ac-modbus',
    topicPrefix: process.env.MQTT_TOPIC_PREFIX ?? 'hass/ac',
  };

  const deviceInfo = {
    name: process.env.MQTT_DEVICE_NAME ?? 'HASS AC Modbus',
    model: process.env.MQTT_DEVICE_MODEL ?? 'Modbus Monitor',
    manufacturer: process.env.MQTT_DEVICE_MANUFACTURER ?? 'Custom',
    identifier: process.env.MQTT_DEVICE_IDENTIFIER ?? 'hass-ac-modbus',
  };

  modbusManager
    .configureMqtt(mqttConfig, deviceInfo)
    .catch((error: Error) => console.error('MQTT 初始化失败:', error.message));
}

const wss = new WebSocketServer({
  port: 3003,
  perMessageDeflate: false,
});

console.log('✅ WebSocket 服务器运行在 ws://localhost:3003');

modbusManager
  .connect()
  .then(() => {
    console.log('🔗 已连接 Modbus，仅保持手动读写，不启用轮询/扫描/实时查询');
  })
  .catch((error: Error) => {
    console.error('❌ Modbus 连接失败:', error.message);
  });

wss.on('connection', (ws) => {
  console.log('🔌 新的WebSocket连接');
  modbusManager.addWebSocketConnection(ws);

  ws.send(
    JSON.stringify({
      type: 'connection',
      data: { connected: modbusManager.isConnected() },
      timestamp: new Date().toISOString(),
    }),
  );

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('📨 收到消息:', data.type, data);

      switch (data.type) {
        case 'connect':
          ws.send(
            JSON.stringify({
              type: 'connection',
              data: { connected: modbusManager.isConnected() },
              timestamp: new Date().toISOString(),
            }),
          );
          break;

        case 'start_monitoring':
        case 'stop_monitoring':
          ws.send(
            JSON.stringify({
              type: 'response',
              data: { message: '轮询/实时监控已禁用，当前仅支持手动读写指定寄存器' },
              timestamp: new Date().toISOString(),
            }),
          );
          break;

        case 'get_all_registers':
        case 'read_all':
          try {
            const registers = await modbusManager.getAllRegisters();
            ws.send(
              JSON.stringify({
                type: 'bulk_update',
                data: Array.from(registers.values()),
                timestamp: new Date().toISOString(),
              }),
            );
          } catch (error: any) {
            ws.send(
              JSON.stringify({
                type: 'error',
                data: { message: error.message },
                timestamp: new Date().toISOString(),
              }),
            );
          }
          break;

        case 'read_register':
          try {
            if (data.address && ALLOWED_REGISTERS.includes(Number(data.address))) {
              const value = await modbusManager.readRegister(data.address);
              ws.send(
                JSON.stringify({
                  type: 'read_response',
                  address: data.address,
                  values: [value],
                  timestamp: new Date().toISOString(),
                }),
              );
            } else {
              ws.send(
                JSON.stringify({
                  type: 'error',
                  data: { message: '仅支持寄存器 1033, 1034, 1041, 1168 的读取' },
                  timestamp: new Date().toISOString(),
                }),
              );
            }
          } catch (error: any) {
            ws.send(
              JSON.stringify({
                type: 'error',
                data: { message: error.message },
                timestamp: new Date().toISOString(),
              }),
            );
          }
          break;

        case 'write_register':
          try {
            if (
              data.address &&
              data.value !== undefined &&
              ALLOWED_REGISTERS.includes(Number(data.address))
            ) {
              const result = await modbusManager.writeRegister(data.address, data.value);
              ws.send(
                JSON.stringify({
                  type: 'write_response',
                  address: data.address,
                  verified: data.value,
                  data: result,
                  timestamp: new Date().toISOString(),
                }),
              );
            } else {
              ws.send(
                JSON.stringify({
                  type: 'error',
                  data: { message: '仅支持寄存器 1033, 1034, 1041, 1168 的写入' },
                  timestamp: new Date().toISOString(),
                }),
              );
            }
          } catch (error: any) {
            ws.send(
              JSON.stringify({
                type: 'error',
                data: { message: error.message },
                timestamp: new Date().toISOString(),
              }),
            );
          }
          break;

        case 'discover_registers':
        case 'enable_discovery':
        case 'set_change_threshold':
        case 'scan_range':
          ws.send(
            JSON.stringify({
              type: 'response',
              data: { message: '扫描/动态发现/阈值配置已停用，当前仅手动操作 1033/1034/1041/1168' },
              timestamp: new Date().toISOString(),
            }),
          );
          break;

        case 'ping':
          ws.send(
            JSON.stringify({
              type: 'pong',
              timestamp: new Date().toISOString(),
            }),
          );
          break;

        default:
          ws.send(
            JSON.stringify({
              type: 'response',
              data: { message: `收到 ${data.type} 请求` },
              timestamp: new Date().toISOString(),
            }),
          );
      }
    } catch (error: any) {
      console.error('WebSocket消息处理错误:', error);
      ws.send(
        JSON.stringify({
          type: 'error',
          data: { message: error.message },
          timestamp: new Date().toISOString(),
        }),
      );
    }
  });

  ws.on('close', () => {
    console.log('🔌 WebSocket连接关闭');
  });

  ws.on('error', (error) => {
    console.error('WebSocket错误:', error);
  });
});

const gracefulShutdown = () => {
  console.log('\n🛑 正在关闭服务器...');
  modbusManager.stopMonitoring();
  modbusManager.disconnect();
  wss.close();
  console.log('👋 服务器已关闭');
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
