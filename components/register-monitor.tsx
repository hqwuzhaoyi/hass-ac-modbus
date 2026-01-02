"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Power, Settings, Wifi, WifiOff, RefreshCw, Home, Droplets } from 'lucide-react';
import { RegisterData, WebSocketMessage } from '@/types/modbus';

type RegisterState = {
  value: number | null;
  rawValue: number | null;
  lastUpdated?: string;
};

const CONTROL_REGISTERS: Array<{ address: number; name: string; type: 'switch' | 'mode' }> = [
  { address: 1033, name: '总开关', type: 'switch' },
  { address: 1034, name: '居家/离家', type: 'switch' },
  { address: 1041, name: '主机模式', type: 'mode' },
  { address: 1168, name: '加湿', type: 'switch' },
];

const RegisterMonitor = () => {
  const [connected, setConnected] = useState(false);
  const [powerState, setPowerState] = useState<RegisterState>({ value: null, rawValue: null });
  const [homeAwayState, setHomeAwayState] = useState<RegisterState>({ value: null, rawValue: null });
  const [modeState, setModeState] = useState<RegisterState>({ value: null, rawValue: null });
  const [humidifyState, setHumidifyState] = useState<RegisterState>({ value: null, rawValue: null });
  const [modeInput, setModeInput] = useState('1');
  const wsRef = useRef<WebSocket | null>(null);

  const updateRegisterState = (reg: RegisterData) => {
    const state = {
      value: reg.value ?? reg.rawValue ?? null,
      rawValue: reg.rawValue ?? reg.value ?? null,
      lastUpdated: reg.timestamp,
    };

    if (reg.address === 1033) {
      setPowerState(state);
    } else if (reg.address === 1034) {
      setHomeAwayState(state);
    } else if (reg.address === 1041) {
      setModeState(state);
      if (reg.rawValue !== undefined) {
        setModeInput(String(reg.rawValue));
      }
    } else if (reg.address === 1168) {
      setHumidifyState(state);
    }
  };

  const requestAll = () => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'get_all_registers' }));
    }
  };

  const handleWebSocketMessage = (message: WebSocketMessage) => {
    switch (message.type) {
      case 'connection':
        setConnected(Boolean(message.data?.connected));
        if (message.data?.connected) {
          requestAll();
        }
        break;
      case 'bulk_update':
        (message.data as RegisterData[]).forEach((reg) => {
          if (CONTROL_REGISTERS.some((r) => r.address === reg.address)) {
            updateRegisterState(reg);
          }
        });
        break;
      case 'read_response':
        if (message.address && message.values) {
          updateRegisterState({
            address: message.address,
            name: '',
            value: message.values[0],
            rawValue: message.values[0],
            type: 'value',
            writable: true,
            timestamp: message.timestamp,
          });
        }
        break;
      case 'write_response':
        if (message.address !== undefined && message.verified !== undefined) {
          updateRegisterState({
            address: message.address,
            name: '',
            value: message.verified,
            rawValue: message.verified,
            type: 'value',
            writable: true,
            timestamp: message.timestamp,
          });
        }
        break;
      case 'error':
        console.error('Modbus error:', message.data?.message ?? '未知错误');
        alert(message.data?.message ?? '操作失败');
        break;
    }
  };

  const connectWebSocket = useCallback(() => {
    try {
      const ws = new WebSocket('ws://localhost:3003');

      ws.onopen = () => {
        wsRef.current = ws;
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (error) {
          console.error('WebSocket message parse error:', error);
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        setConnected(false);
        setTimeout(connectWebSocket, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('WebSocket connection error:', error);
      setTimeout(connectWebSocket, 3000);
    }
  }, []);

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

  const readRegister = (address: number) => {
    if (!wsRef.current) {
      alert('WebSocket未连接');
      return;
    }
    wsRef.current.send(JSON.stringify({ type: 'read_register', address }));
  };

  const writeRegister = (address: number, value: number) => {
    if (!wsRef.current) {
      alert('WebSocket未连接');
      return;
    }
    wsRef.current.send(JSON.stringify({ type: 'write_register', address, value }));
  };

  const formatTime = (timestamp?: string) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">空调 Modbus 控制台</h1>
          <p className="text-muted-foreground">仅保留核心寄存器（1033 总开关 / 1041 主机模式）的读写</p>
        </div>
        <div className="flex items-center space-x-3">
          <Badge variant={connected ? 'default' : 'destructive'} className="px-3 py-1">
            {connected ? <Wifi className="h-4 w-4 mr-1" /> : <WifiOff className="h-4 w-4 mr-1" />}
            {connected ? '已连接' : '未连接'}
          </Badge>
          <Button variant="outline" size="sm" onClick={requestAll} disabled={!connected}>
            <RefreshCw className="h-4 w-4 mr-1" />
            刷新状态
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Power className="h-5 w-5" />
              <span>总开关 (1033)</span>
            </CardTitle>
            <CardDescription>写入 1=开，0=关</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">当前值</div>
                <div className="text-2xl font-mono">
                  {powerState.rawValue === null ? '--' : powerState.rawValue}
                </div>
                {powerState.lastUpdated && (
                  <div className="text-xs text-muted-foreground">
                    更新时间 {formatTime(powerState.lastUpdated)}
                  </div>
                )}
              </div>
              <Switch
                checked={powerState.rawValue === 1}
                onCheckedChange={(checked) => writeRegister(1033, checked ? 1 : 0)}
                disabled={!connected}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" onClick={() => readRegister(1033)} disabled={!connected}>
                读取
              </Button>
              <Button onClick={() => writeRegister(1033, powerState.rawValue === 1 ? 0 : 1)} disabled={!connected}>
                {powerState.rawValue === 1 ? '关闭' : '开启'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className={powerState.rawValue === 1 ? 'opacity-50' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="h-5 w-5" />
              <span>主机模式 (1041)</span>
            </CardTitle>
            <CardDescription>
              {powerState.rawValue === 1 ? '⚠️ 需要先关闭总开关' : '1 制冷 / 2 制热 / 3 通风 / 4 除湿'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">当前值</div>
                <div className="text-2xl font-mono">
                  {modeState.rawValue === null ? '--' : modeState.rawValue}
                </div>
                {modeState.lastUpdated && (
                  <div className="text-xs text-muted-foreground">
                    更新时间 {formatTime(modeState.lastUpdated)}
                  </div>
                )}
              </div>
              <Button variant="outline" onClick={() => readRegister(1041)} disabled={!connected}>
                读取
              </Button>
            </div>
            <div className="space-y-2">
              <Label>写入值</Label>
              <div className="flex space-x-2">
                <Input
                  value={modeInput}
                  onChange={(e) => setModeInput(e.target.value)}
                  type="number"
                  inputMode="numeric"
                  className="w-24"
                  disabled={!connected || powerState.rawValue === 1}
                />
                <Button
                  onClick={() => writeRegister(1041, parseInt(modeInput, 10))}
                  disabled={!connected || powerState.rawValue === 1 || Number.isNaN(parseInt(modeInput, 10))}
                >
                  写入
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={powerState.rawValue !== 1 ? 'opacity-50' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Home className="h-5 w-5" />
              <span>居家/离家 (1034)</span>
            </CardTitle>
            <CardDescription>
              {powerState.rawValue !== 1 ? '⚠️ 需要先打开总开关' : '1=居家，0=离家'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">当前状态</div>
                <div className="text-2xl font-mono">
                  {homeAwayState.rawValue === null
                    ? '--'
                    : homeAwayState.rawValue === 1
                      ? '居家'
                      : '离家'}
                </div>
                {homeAwayState.lastUpdated && (
                  <div className="text-xs text-muted-foreground">
                    更新时间 {formatTime(homeAwayState.lastUpdated)}
                  </div>
                )}
              </div>
              <Switch
                checked={homeAwayState.rawValue === 1}
                onCheckedChange={(checked) => writeRegister(1034, checked ? 1 : 0)}
                disabled={!connected || powerState.rawValue !== 1}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" onClick={() => readRegister(1034)} disabled={!connected}>
                读取
              </Button>
              <Button
                variant={homeAwayState.rawValue === 1 ? 'outline' : 'default'}
                onClick={() => writeRegister(1034, 1)}
                disabled={!connected || powerState.rawValue !== 1}
              >
                居家
              </Button>
              <Button
                variant={homeAwayState.rawValue === 0 ? 'outline' : 'default'}
                onClick={() => writeRegister(1034, 0)}
                disabled={!connected || powerState.rawValue !== 1}
              >
                离家
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className={powerState.rawValue !== 1 ? 'opacity-50' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Droplets className="h-5 w-5" />
              <span>加湿 (1168)</span>
            </CardTitle>
            <CardDescription>
              {powerState.rawValue !== 1 ? '⚠️ 需要先打开总开关' : '1=开启，0=关闭'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">当前状态</div>
                <div className="text-2xl font-mono">
                  {humidifyState.rawValue === null
                    ? '--'
                    : humidifyState.rawValue === 1
                      ? '开启'
                      : '关闭'}
                </div>
                {humidifyState.lastUpdated && (
                  <div className="text-xs text-muted-foreground">
                    更新时间 {formatTime(humidifyState.lastUpdated)}
                  </div>
                )}
              </div>
              <Switch
                checked={humidifyState.rawValue === 1}
                onCheckedChange={(checked) => writeRegister(1168, checked ? 1 : 0)}
                disabled={!connected || powerState.rawValue !== 1}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" onClick={() => readRegister(1168)} disabled={!connected}>
                读取
              </Button>
              <Button
                onClick={() => writeRegister(1168, humidifyState.rawValue === 1 ? 0 : 1)}
                disabled={!connected || powerState.rawValue !== 1}
              >
                {humidifyState.rawValue === 1 ? '关闭' : '开启'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RegisterMonitor;
