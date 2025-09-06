"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Thermometer, Power, Settings, Activity, Wifi, WifiOff, Eye } from 'lucide-react';
import { RegisterData, RegisterChange, WebSocketMessage } from '@/types/modbus';

const RegisterMonitor = () => {
  const [registers, setRegisters] = useState<Map<number, RegisterData>>(new Map());
  const [changes, setChanges] = useState<RegisterChange[]>([]);
  const [connected, setConnected] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  const [manualAddress, setManualAddress] = useState('1033');
  const [manualValue, setManualValue] = useState('1');
  const [scanStart, setScanStart] = useState('1030');
  const [scanEnd, setScanEnd] = useState('1060');
  const [scanResults, setScanResults] = useState<Map<number, number>>(new Map());
  
  const wsRef = useRef<WebSocket | null>(null);
  const changesRef = useRef<HTMLDivElement>(null);

  // WebSocket连接
  const connectWebSocket = useCallback(() => {
    try {
      const ws = new WebSocket('ws://localhost:3003');
      
      ws.onopen = () => {
        console.log('WebSocket connected');
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
        console.log('WebSocket disconnected');
        wsRef.current = null;
        setConnected(false);
        setTimeout(connectWebSocket, 3000); // 重连
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
    } catch (error) {
      console.error('WebSocket connection error:', error);
      setTimeout(connectWebSocket, 3000);
    }
  }, []);

  const handleWebSocketMessage = (message: WebSocketMessage) => {
    switch (message.type) {
      case 'connection':
        setConnected(message.data.connected);
        if (message.data.connected) {
          // 连接成功后获取所有寄存器
          if (wsRef.current) {
            wsRef.current.send(JSON.stringify({ type: 'get_all_registers' }));
          }
        }
        break;
        
      case 'bulk_update':
        const newRegisters = new Map<number, RegisterData>();
        message.data.forEach((reg: RegisterData) => {
          newRegisters.set(reg.address, reg);
        });
        setRegisters(newRegisters);
        break;
        
      case 'register_change':
        const change: RegisterChange = {
          ...message.data,
          timestamp: message.timestamp
        };
        
        setChanges(prev => {
          const newChanges = [change, ...prev].slice(0, 50);
          return newChanges;
        });
        
        setTimeout(() => {
          if (changesRef.current) {
            changesRef.current.scrollTop = 0;
          }
        }, 100);
        break;

      case 'read_response':
        alert(`寄存器 ${message.address}: ${message.values?.[0] || 'N/A'}`);
        break;

      case 'write_response':
        if (message.address !== undefined && message.verified !== undefined) {
          addChange({
            address: message.address,
            name: `手动写入-${message.address}`,
            oldValue: 0,
            newValue: message.verified,
            timestamp: message.timestamp,
            type: 'manual'
          });
        }
        break;

      case 'scan_response':
        if (message.results) {
          const newResults = new Map<number, number>();
          Object.entries(message.results).forEach(([addr, value]) => {
            newResults.set(parseInt(addr), value as number);
          });
          setScanResults(newResults);
        }
        
        addChange({
          address: 0,
          name: '扫描完成',
          oldValue: 0,
          newValue: message.count || 0,
          timestamp: message.timestamp,
          type: 'scan'
        });
        break;
        
      case 'error':
        console.error('Modbus error:', message.data.message);
        alert(`错误: ${message.data.message}`);
        break;
    }
  };

  // 手动读取寄存器
  const readRegister = async () => {
    if (!wsRef.current) {
      alert('WebSocket未连接');
      return;
    }
    
    try {
      wsRef.current.send(JSON.stringify({
        type: 'read_register',
        address: parseInt(manualAddress)
      }));
    } catch (error) {
      alert(`读取失败: ${error}`);
    }
  };

  // 手动写入寄存器
  const writeRegister = async () => {
    if (!wsRef.current) {
      alert('WebSocket未连接');
      return;
    }
    
    try {
      wsRef.current.send(JSON.stringify({
        type: 'write_register',
        address: parseInt(manualAddress),
        value: parseInt(manualValue)
      }));
    } catch (error) {
      alert(`写入失败: ${error}`);
    }
  };

  // 切换寄存器开关
  const toggleRegister = async (address: number, currentValue: number) => {
    if (!wsRef.current) {
      alert('WebSocket未连接');
      return;
    }
    
    try {
      const newValue = currentValue === 0 ? 1 : 0;
      
      wsRef.current.send(JSON.stringify({
        type: 'write_register',
        address: address,
        value: newValue
      }));
    } catch (error) {
      console.error('Toggle failed:', error);
    }
  };

  // 设置寄存器数值
  const setRegisterValue = async (address: number, value: number) => {
    if (!wsRef.current) {
      alert('WebSocket未连接');
      return;
    }
    
    try {
      wsRef.current.send(JSON.stringify({
        type: 'write_register',
        address: address,
        value: value
      }));
    } catch (error) {
      console.error('Set value failed:', error);
    }
  };

  // 扫描寄存器范围
  const scanRegisters = async () => {
    if (!wsRef.current) {
      alert('WebSocket未连接');
      return;
    }
    
    try {
      wsRef.current.send(JSON.stringify({
        type: 'scan_range',
        start: parseInt(scanStart),
        end: parseInt(scanEnd)
      }));
      
      addChange({
        address: 0,
        name: '开始扫描',
        oldValue: parseInt(scanStart),
        newValue: parseInt(scanEnd),
        timestamp: new Date().toISOString(),
        type: 'scan'
      });
    } catch (error) {
      console.error('Scan failed:', error);
    }
  };

  // 添加变化记录
  const addChange = (change: RegisterChange) => {
    setChanges(prev => [change, ...prev].slice(0, 50));
  };

  // 获取寄存器图标
  const getRegisterIcon = (type: string) => {
    switch (type) {
      case 'temperature': return <Thermometer className="h-4 w-4" />;
      case 'switch': return <Power className="h-4 w-4" />;
      case 'value': return <Settings className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  // 格式化时间
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  useEffect(() => {
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 标题和状态 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">🏠 4房间空调监控台</h1>
          <p className="text-muted-foreground">实时监控寄存器变化</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <Badge variant={connected ? "default" : "destructive"} className="px-3 py-1">
            {connected ? <Wifi className="h-4 w-4 mr-1" /> : <WifiOff className="h-4 w-4 mr-1" />}
            {connected ? '已连接' : '未连接'}
          </Badge>
          
          <Button 
            variant={monitoring ? "destructive" : "default"}
            onClick={() => {
              setMonitoring(!monitoring);
              if (wsRef.current) {
                wsRef.current.send(JSON.stringify({
                  type: monitoring ? 'stop_monitoring' : 'start_monitoring'
                }));
              }
            }}
          >
            <Eye className="h-4 w-4 mr-2" />
            {monitoring ? '停止监控' : '开始监控'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 已知寄存器 */}
        <Card>
          <CardHeader>
            <CardTitle>已知寄存器控制</CardTitle>
            <CardDescription>实时显示和控制已配置的寄存器</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from(registers.values()).map((reg) => (
              <div key={reg.address} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  {getRegisterIcon(reg.type)}
                  <div>
                    <div className="font-medium">{reg.name}</div>
                    <div className="text-sm text-muted-foreground">
                      地址: {reg.address} | 原始值: {reg.rawValue}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <div className="font-mono font-bold">
                      {reg.value}{reg.unit || ''}
                    </div>
                    {reg.timestamp && (
                      <div className="text-xs text-muted-foreground">
                        {formatTime(reg.timestamp)}
                      </div>
                    )}
                  </div>
                  
                  {reg.writable && (
                    <div className="flex items-center space-x-2">
                      {reg.type === 'switch' ? (
                        <Switch
                          checked={reg.rawValue === 1}
                          onCheckedChange={() => toggleRegister(reg.address, reg.rawValue)}
                        />
                      ) : (
                        <div className="flex items-center space-x-1">
                          <Input
                            type="number"
                            className="w-20"
                            defaultValue={reg.rawValue}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                setRegisterValue(reg.address, parseInt(e.currentTarget.value));
                              }
                            }}
                          />
                          <Button
                            size="sm"
                            onClick={() => {
                              const input = document.querySelector(`input[defaultValue="${reg.rawValue}"]`) as HTMLInputElement;
                              if (input) {
                                setRegisterValue(reg.address, parseInt(input.value));
                              }
                            }}
                          >
                            设置
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 变化监控 */}
        <Card>
          <CardHeader>
            <CardTitle>实时变化监控</CardTitle>
            <CardDescription>记录所有寄存器变化</CardDescription>
          </CardHeader>
          <CardContent>
            <div 
              ref={changesRef}
              className="h-96 overflow-y-auto space-y-2 border rounded-lg p-3 bg-muted/10"
            >
              {changes.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  暂无变化记录，点击开始监控
                </div>
              ) : (
                changes.map((change, index) => (
                  <div
                    key={`${change.address}-${change.timestamp}-${index}`}
                    className="flex items-center justify-between p-2 bg-background border rounded text-sm"
                  >
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="text-xs">
                        {change.address}
                      </Badge>
                      <span className="font-medium">{change.name}</span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <span className="text-muted-foreground">
                        {change.oldValue} → {change.newValue}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(change.timestamp)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* 手动操作 */}
        <Card>
          <CardHeader>
            <CardTitle>手动操作</CardTitle>
            <CardDescription>手动读写任意寄存器</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>寄存器地址</Label>
                <Input
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  placeholder="1033"
                />
              </div>
              <div>
                <Label>写入值</Label>
                <Input
                  value={manualValue}
                  onChange={(e) => setManualValue(e.target.value)}
                  placeholder="1"
                />
              </div>
              <div className="flex items-end space-x-2">
                <Button onClick={readRegister} variant="outline" size="sm">
                  读取
                </Button>
                <Button onClick={writeRegister} size="sm">
                  写入
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 扫描功能 */}
        <Card>
          <CardHeader>
            <CardTitle>寄存器扫描</CardTitle>
            <CardDescription>扫描指定范围的寄存器</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>开始地址</Label>
                <Input
                  value={scanStart}
                  onChange={(e) => setScanStart(e.target.value)}
                  placeholder="1030"
                />
              </div>
              <div>
                <Label>结束地址</Label>
                <Input
                  value={scanEnd}
                  onChange={(e) => setScanEnd(e.target.value)}
                  placeholder="1060"
                />
              </div>
              <div className="flex items-end">
                <Button onClick={scanRegisters} className="w-full">
                  扫描
                </Button>
              </div>
            </div>
            
            {scanResults.size > 0 && (
              <div className="mt-4">
                <div className="text-sm font-medium mb-2">
                  扫描结果 ({scanResults.size} 个寄存器):
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1 text-sm font-mono">
                  {Array.from(scanResults.entries()).map(([addr, value]) => (
                    <div key={addr} className="flex justify-between">
                      <span>{addr}:</span>
                      <span>{value} (0x{value.toString(16).padStart(4, '0')})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RegisterMonitor;