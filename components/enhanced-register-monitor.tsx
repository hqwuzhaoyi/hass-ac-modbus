"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Thermometer, Power, Settings, Activity, Wifi, WifiOff, Eye, 
  Search, Zap, TrendingUp, Filter, Sparkles, Target, AlertCircle 
} from 'lucide-react';

interface RegisterData {
  address: number;
  name: string;
  value: number;
  rawValue: number;
  type: string;
  writable: boolean;
  unit?: string;
  category?: string;
  confidence?: number;
  changeCount?: number;
  timestamp: string;
}

interface RegisterChange {
  address: number;
  name: string;
  oldValue: number;
  newValue: number;
  type: string;
  category?: string;
  confidence?: number;
  changeCount?: number;
  timestamp: string;
}

interface MonitoringStats {
  knownRegisters: number;
  dynamicRegisters: number;
  totalMonitored: number;
  changeThreshold: number;
  scanningEnabled: boolean;
}

const EnhancedRegisterMonitor = () => {
  const [registers, setRegisters] = useState<Map<number, RegisterData>>(new Map());
  const [changes, setChanges] = useState<RegisterChange[]>([]);
  const [dynamicChanges, setDynamicChanges] = useState<RegisterChange[]>([]);
  const [connected, setConnected] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [stats, setStats] = useState<MonitoringStats>({
    knownRegisters: 0,
    dynamicRegisters: 0,
    totalMonitored: 0,
    changeThreshold: 1,
    scanningEnabled: false
  });
  
  const [activeTab, setActiveTab] = useState('monitor');
  const [changeThreshold, setChangeThreshold] = useState(1);
  const [discoveryEnabled, setDiscoveryEnabled] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [manualAddress, setManualAddress] = useState('1033');
  const [manualValue, setManualValue] = useState('1');
  
  const wsRef = useRef<WebSocket | null>(null);
  const changesRef = useRef<HTMLDivElement>(null);

  // WebSocket连接
  const connectWebSocket = useCallback(() => {
    try {
      const ws = new WebSocket('ws://localhost:3003');
      
      ws.onopen = () => {
        console.log('WebSocket connected (Enhanced)');
        wsRef.current = ws;
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (error) {
          console.error('WebSocket message parse error:', error);
        }
      };
      
      ws.onclose = () => {
        console.log('WebSocket disconnected');
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

  const handleWebSocketMessage = (message: any) => {
    switch (message.type) {
      case 'connection':
        setConnected(message.data.connected);
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
        
        setChanges(prev => [change, ...prev].slice(0, 50));
        scrollToTop();
        break;

      case 'dynamic_register_change':
        const dynamicChange: RegisterChange = {
          ...message.data,
          timestamp: message.timestamp
        };
        
        setDynamicChanges(prev => [dynamicChange, ...prev].slice(0, 50));
        scrollToTop();
        break;
        
      case 'register_discovered':
        console.log('🎯 发现新寄存器:', message.data);
        // 动态寄存器会在下次 bulk_update 中更新
        break;
        
      case 'register_removed':
        console.log('🗑️ 移除低置信度寄存器:', message.data);
        break;
        
      case 'monitoring_stats':
        setStats(message.data);
        break;
        
      case 'discovery_complete':
        setDiscovering(false);
        console.log('🔍 发现完成:', message.data);
        break;
        
      case 'monitoring_started':
        setMonitoring(true);
        break;
        
      case 'monitoring_stopped':
        setMonitoring(false);
        break;
        
      case 'read_response':
        alert(`寄存器 ${message.address}: ${message.values[0]}`);
        break;

      case 'write_response':
        addChange({
          address: message.address,
          name: `手动写入-${message.address}`,
          oldValue: 0,
          newValue: message.verified,
          timestamp: message.timestamp,
          type: 'manual',
          category: 'manual'
        });
        break;
        
      case 'error':
        console.error('Modbus error:', message.data.message);
        alert(`错误: ${message.data.message}`);
        break;
    }
  };

  const scrollToTop = () => {
    setTimeout(() => {
      if (changesRef.current) {
        changesRef.current.scrollTop = 0;
      }
    }, 100);
  };

  // 启动/停止监控
  const toggleMonitoring = () => {
    if (!wsRef.current) return;
    
    const action = monitoring ? 'stop_monitoring' : 'start_monitoring';
    wsRef.current.send(JSON.stringify({
      type: action,
      interval: 2000
    }));
  };

  // 启动寄存器发现
  const startDiscovery = () => {
    if (!wsRef.current) return;
    
    setDiscovering(true);
    wsRef.current.send(JSON.stringify({
      type: 'discover_registers'
    }));
  };

  // 启用/禁用动态发现
  const toggleDiscovery = (enabled: boolean) => {
    if (!wsRef.current) return;
    
    setDiscoveryEnabled(enabled);
    wsRef.current.send(JSON.stringify({
      type: 'enable_discovery',
      enabled
    }));
  };

  // 设置变化阈值
  const updateChangeThreshold = () => {
    if (!wsRef.current) return;
    
    wsRef.current.send(JSON.stringify({
      type: 'set_change_threshold',
      threshold: changeThreshold
    }));
  };

  // 手动读取寄存器
  const readRegister = async () => {
    if (!wsRef.current) return;
    
    wsRef.current.send(JSON.stringify({
      type: 'read_register',
      address: parseInt(manualAddress)
    }));
  };

  // 手动写入寄存器
  const writeRegister = async () => {
    if (!wsRef.current) return;
    
    wsRef.current.send(JSON.stringify({
      type: 'write_register',
      address: parseInt(manualAddress),
      value: parseInt(manualValue)
    }));
  };

  const addChange = (change: RegisterChange) => {
    setChanges(prev => [change, ...prev].slice(0, 50));
  };

  const getRegisterIcon = (type: string) => {
    switch (type) {
      case 'temperature': return <Thermometer className="h-4 w-4" />;
      case 'switch': return <Power className="h-4 w-4" />;
      case 'control': return <Settings className="h-4 w-4" />;
      case 'sensor': return <Activity className="h-4 w-4" />;
      case 'mode': return <Target className="h-4 w-4" />;
      case 'percentage': return <TrendingUp className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getConfidenceBadge = (confidence?: number) => {
    if (confidence === undefined) return null;
    
    const percentage = Math.round(confidence * 100);
    const variant = percentage > 80 ? 'default' : percentage > 50 ? 'secondary' : 'outline';
    
    return (
      <Badge variant={variant} className="text-xs">
        {percentage}%
      </Badge>
    );
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const filteredRegisters = Array.from(registers.values()).filter(reg => {
    if (filterType === 'all') return true;
    if (filterType === 'known') return reg.category !== 'dynamic';
    if (filterType === 'dynamic') return reg.category === 'dynamic';
    if (filterType === 'writable') return reg.writable;
    return true;
  });

  const allChanges = [...changes, ...dynamicChanges]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 50);

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
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-8 w-8" />
            增强型空调监控台
          </h1>
          <p className="text-muted-foreground">智能寄存器发现与实时变化监控</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <Badge variant={connected ? "default" : "destructive"} className="px-3 py-1">
            {connected ? <Wifi className="h-4 w-4 mr-1" /> : <WifiOff className="h-4 w-4 mr-1" />}
            {connected ? '已连接' : '未连接'}
          </Badge>
          
          <Button 
            variant={monitoring ? "destructive" : "default"}
            onClick={toggleMonitoring}
            disabled={!connected}
          >
            <Eye className="h-4 w-4 mr-2" />
            {monitoring ? '停止监控' : '开始监控'}
          </Button>
        </div>
      </div>

      {/* 统计信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            监控统计
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.knownRegisters}</div>
              <div className="text-sm text-muted-foreground">已知寄存器</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.dynamicRegisters}</div>
              <div className="text-sm text-muted-foreground">动态发现</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{stats.totalMonitored}</div>
              <div className="text-sm text-muted-foreground">总计监控</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.changeThreshold}</div>
              <div className="text-sm text-muted-foreground">变化阈值</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="monitor">实时监控</TabsTrigger>
          <TabsTrigger value="discovery">智能发现</TabsTrigger>
          <TabsTrigger value="changes">变化追踪</TabsTrigger>
          <TabsTrigger value="settings">高级设置</TabsTrigger>
        </TabsList>

        {/* 实时监控标签页 */}
        <TabsContent value="monitor" className="space-y-4">
          <div className="flex items-center gap-4 mb-4">
            <Label>筛选类型:</Label>
            <select 
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-1 border rounded"
            >
              <option value="all">全部</option>
              <option value="known">已知寄存器</option>
              <option value="dynamic">动态发现</option>
              <option value="writable">可写入</option>
            </select>
            
            <Badge variant="outline">{filteredRegisters.length} 个寄存器</Badge>
          </div>
          
          <div className="grid gap-4">
            {filteredRegisters.map((reg) => (
              <Card key={reg.address} className={reg.category === 'dynamic' ? 'border-green-200' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getRegisterIcon(reg.type)}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{reg.name}</span>
                          {reg.category === 'dynamic' && (
                            <Badge variant="secondary" className="text-xs">动态</Badge>
                          )}
                          {getConfidenceBadge(reg.confidence)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          地址: {reg.address} | 原始值: {reg.rawValue} | 类型: {reg.type}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <div className="font-mono font-bold">
                          {reg.value}{reg.unit || ''}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatTime(reg.timestamp)}
                        </div>
                      </div>
                      
                      {reg.writable && (
                        <Switch
                          checked={reg.rawValue === 1}
                          onCheckedChange={(checked) => {
                            if (wsRef.current) {
                              wsRef.current.send(JSON.stringify({
                                type: 'write_register',
                                address: reg.address,
                                value: checked ? 1 : 0
                              }));
                            }
                          }}
                        />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* 智能发现标签页 */}
        <TabsContent value="discovery" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                智能寄存器发现
              </CardTitle>
              <CardDescription>
                自动扫描和发现新的控制寄存器，基于数值模式智能识别功能
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={discoveryEnabled}
                    onCheckedChange={toggleDiscovery}
                  />
                  <Label>启用自动发现</Label>
                </div>
                
                <Button
                  onClick={startDiscovery}
                  disabled={discovering || !connected}
                  className="flex items-center gap-2"
                >
                  <Search className="h-4 w-4" />
                  {discovering ? '发现中...' : '开始发现'}
                </Button>
              </div>
              
              {discovering && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 animate-spin" />
                    <span>正在扫描寄存器范围...</span>
                  </div>
                  <Progress value={65} className="h-2" />
                </div>
              )}
              
              <div className="text-sm text-muted-foreground">
                <p>发现范围:</p>
                <ul className="list-disc list-inside mt-2">
                  <li>1000-1100: 主要控制区域</li>
                  <li>1100-1200: 扩展区域</li>
                  <li>2000-2050: 备用区域</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 变化追踪标签页 */}
        <TabsContent value="changes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                寄存器变化追踪
              </CardTitle>
              <CardDescription>实时记录所有寄存器数值变化</CardDescription>
            </CardHeader>
            <CardContent>
              <div 
                ref={changesRef}
                className="h-96 overflow-y-auto space-y-2 border rounded-lg p-3 bg-muted/10"
              >
                {allChanges.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                    暂无变化记录，请启动监控
                  </div>
                ) : (
                  allChanges.map((change, index) => (
                    <div
                      key={`${change.address}-${change.timestamp}-${index}`}
                      className={`flex items-center justify-between p-3 border rounded text-sm ${
                        change.category === 'dynamic' ? 'bg-green-50 border-green-200' : 'bg-background'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="text-xs">
                          {change.address}
                        </Badge>
                        <span className="font-medium">{change.name}</span>
                        {change.category === 'dynamic' && (
                          <Badge variant="secondary" className="text-xs">动态</Badge>
                        )}
                        {getConfidenceBadge(change.confidence)}
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
        </TabsContent>

        {/* 高级设置标签页 */}
        <TabsContent value="settings" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>监控设置</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>变化阈值</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="number"
                      value={changeThreshold}
                      onChange={(e) => setChangeThreshold(parseInt(e.target.value))}
                      min="1"
                      max="100"
                      className="w-20"
                    />
                    <Button onClick={updateChangeThreshold} size="sm">
                      更新
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    只记录变化量大于此值的寄存器
                  </p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>手动操作</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label>地址</Label>
                    <Input
                      value={manualAddress}
                      onChange={(e) => setManualAddress(e.target.value)}
                      placeholder="1033"
                    />
                  </div>
                  <div>
                    <Label>值</Label>
                    <Input
                      value={manualValue}
                      onChange={(e) => setManualValue(e.target.value)}
                      placeholder="1"
                    />
                  </div>
                  <div className="flex items-end gap-1">
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
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EnhancedRegisterMonitor;