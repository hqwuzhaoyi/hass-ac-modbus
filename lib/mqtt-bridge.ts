import { connect, MqttClient } from 'mqtt';
import { EventEmitter } from 'events';

export interface MqttConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  clientId: string;
  topicPrefix: string;
}

export interface DeviceInfo {
  name: string;
  model: string;
  manufacturer: string;
  identifier: string;
}

export class MqttBridge extends EventEmitter {
  private client: MqttClient | null = null;
  private config: MqttConfig;
  private connected = false;
  private deviceInfo: DeviceInfo;
  private discoveryTopics: Set<string> = new Set();

  constructor(config: MqttConfig, deviceInfo: DeviceInfo) {
    super();
    this.config = config;
    this.deviceInfo = deviceInfo;
  }

  async connect(): Promise<boolean> {
    try {
      const connectUrl = `mqtt://${this.config.host}:${this.config.port}`;
      
      this.client = connect(connectUrl, {
        clientId: this.config.clientId,
        username: this.config.username,
        password: this.config.password,
        clean: true,
        reconnectPeriod: 1000,
        connectTimeout: 30 * 1000,
      });

      this.client.on('connect', () => {
        console.log('✓ MQTT 连接成功');
        this.connected = true;
        this.emit('connected');
        this.publishHomeAssistantDiscovery();
      });

      this.client.on('error', (error) => {
        console.error('MQTT 连接错误:', error);
        this.emit('error', error);
      });

      this.client.on('close', () => {
        console.log('MQTT 连接关闭');
        this.connected = false;
        this.emit('disconnected');
      });

      this.client.on('message', (topic, message) => {
        this.handleMessage(topic, message.toString());
      });

      return true;
    } catch (error) {
      console.error('MQTT 连接失败:', error);
      this.emit('error', error);
      return false;
    }
  }

  private async publishHomeAssistantDiscovery(): Promise<void> {
    if (!this.client || !this.connected) return;

    const baseConfig = {
      availability: {
        topic: `${this.config.topicPrefix}/status`,
        payload_available: 'online',
        payload_not_available: 'offline'
      },
      device: {
        identifiers: [this.deviceInfo.identifier],
        name: this.deviceInfo.name,
        model: this.deviceInfo.model,
        manufacturer: this.deviceInfo.manufacturer
      }
    };

    // 发布设备状态
    await this.publish(`${this.config.topicPrefix}/status`, 'online', true);

    // 气候控制设备发现
    const climateConfig = {
      ...baseConfig,
      name: `${this.deviceInfo.name} 空调`,
      unique_id: `${this.deviceInfo.identifier}_climate`,
      temperature_command_topic: `${this.config.topicPrefix}/climate/temperature/set`,
      temperature_state_topic: `${this.config.topicPrefix}/climate/temperature/state`,
      current_temperature_topic: `${this.config.topicPrefix}/climate/current_temperature`,
      mode_command_topic: `${this.config.topicPrefix}/climate/mode/set`,
      mode_state_topic: `${this.config.topicPrefix}/climate/mode/state`,
      power_command_topic: `${this.config.topicPrefix}/climate/power/set`,
      modes: ['off', 'cool', 'heat', 'auto', 'fan'],
      temperature_unit: 'C',
      min_temp: 16,
      max_temp: 30,
      temp_step: 1
    };

    const discoveryTopic = `homeassistant/climate/${this.deviceInfo.identifier}/config`;
    await this.publish(discoveryTopic, JSON.stringify(climateConfig), true);
    this.discoveryTopics.add(discoveryTopic);

    // 温度传感器
    const temperatureSensorConfig = {
      ...baseConfig,
      name: `${this.deviceInfo.name} 当前温度`,
      unique_id: `${this.deviceInfo.identifier}_temperature`,
      state_topic: `${this.config.topicPrefix}/sensor/temperature/state`,
      device_class: 'temperature',
      unit_of_measurement: '°C',
      value_template: '{{ value_json.temperature }}'
    };

    const tempSensorTopic = `homeassistant/sensor/${this.deviceInfo.identifier}_temperature/config`;
    await this.publish(tempSensorTopic, JSON.stringify(temperatureSensorConfig), true);
    this.discoveryTopics.add(tempSensorTopic);

    // 设置点传感器
    const setpointSensorConfig = {
      ...baseConfig,
      name: `${this.deviceInfo.name} 设定温度`,
      unique_id: `${this.deviceInfo.identifier}_setpoint`,
      state_topic: `${this.config.topicPrefix}/sensor/setpoint/state`,
      device_class: 'temperature',
      unit_of_measurement: '°C',
      value_template: '{{ value_json.setpoint }}'
    };

    const setpointTopic = `homeassistant/sensor/${this.deviceInfo.identifier}_setpoint/config`;
    await this.publish(setpointTopic, JSON.stringify(setpointSensorConfig), true);
    this.discoveryTopics.add(setpointTopic);

    // 订阅命令主题
    await this.subscribe(`${this.config.topicPrefix}/climate/+/set`);
    
    console.log('✓ Home Assistant 设备发现配置已发布');
  }

  private handleMessage(topic: string, message: string): void {
    try {
      const topicParts = topic.split('/');
      const command = topicParts[topicParts.length - 2]; // 倒数第二个部分
      
      console.log(`收到 MQTT 命令: ${topic} = ${message}`);
      
      switch (command) {
        case 'temperature':
          this.emit('temperature_command', parseFloat(message));
          break;
        case 'mode':
          this.emit('mode_command', message);
          break;
        case 'power':
          this.emit('power_command', message === 'ON');
          break;
        default:
          console.log(`未知命令: ${command}`);
      }
    } catch (error) {
      console.error('处理 MQTT 消息错误:', error);
    }
  }

  async publishRegistersData(registers: Map<number, any>): Promise<void> {
    if (!this.client || !this.connected) return;

    const data: Record<string, any> = {};
    
    // 转换寄存器数据为 Home Assistant 格式
    registers.forEach((regData, address) => {
      if (regData.error) return;
      
      // 根据寄存器名称映射到 Home Assistant 实体
      switch (regData.name) {
        case '当前温度':
          data.temperature = regData.value;
          break;
        case '设定温度':
          data.setpoint = regData.value;
          break;
        case '主机模式':
          data.mode = this.mapModeToHA(regData.rawValue);
          break;
        case '总开关':
          data.power = regData.rawValue === 1 ? 'ON' : 'OFF';
          break;
      }
    });

    // 发布状态数据
    if (data.temperature !== undefined) {
      await this.publish(
        `${this.config.topicPrefix}/climate/current_temperature`,
        data.temperature.toString()
      );
      await this.publish(
        `${this.config.topicPrefix}/sensor/temperature/state`,
        JSON.stringify({ temperature: data.temperature })
      );
    }

    if (data.setpoint !== undefined) {
      await this.publish(
        `${this.config.topicPrefix}/climate/temperature/state`,
        data.setpoint.toString()
      );
      await this.publish(
        `${this.config.topicPrefix}/sensor/setpoint/state`,
        JSON.stringify({ setpoint: data.setpoint })
      );
    }

    if (data.mode !== undefined) {
      await this.publish(
        `${this.config.topicPrefix}/climate/mode/state`,
        data.mode
      );
    }

    if (data.power !== undefined) {
      await this.publish(
        `${this.config.topicPrefix}/climate/power/state`,
        data.power
      );
    }
  }

  private mapModeToHA(modeValue: number): string {
    const modeMap: Record<number, string> = {
      0: 'off',
      1: 'cool',
      2: 'heat',
      3: 'auto',
      4: 'fan'
    };
    return modeMap[modeValue] || 'off';
  }

  private mapHAToMode(haMode: string): number {
    const modeMap: Record<string, number> = {
      'off': 0,
      'cool': 1,
      'heat': 2,
      'auto': 3,
      'fan': 4
    };
    return modeMap[haMode] || 0;
  }

  private async publish(topic: string, message: string, retain = false): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('MQTT 客户端未连接'));
        return;
      }

      this.client.publish(topic, message, { retain }, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  private async subscribe(topic: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('MQTT 客户端未连接'));
        return;
      }

      this.client.subscribe(topic, (error) => {
        if (error) {
          reject(error);
        } else {
          console.log(`订阅主题: ${topic}`);
          resolve();
        }
      });
    });
  }

  async disconnect(): Promise<void> {
    if (!this.client) return;

    // 发布离线状态
    await this.publish(`${this.config.topicPrefix}/status`, 'offline', true);

    // 清理发现主题
    for (const topic of this.discoveryTopics) {
      await this.publish(topic, '', true);
    }

    this.client.end();
    this.connected = false;
    console.log('MQTT 连接已关闭');
  }

  isConnected(): boolean {
    return this.connected;
  }
}