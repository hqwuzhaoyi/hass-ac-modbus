import type {
  BufferStatsUpdate,
  ChangeNotification,
  DependencyStatusUpdate,
  LatencyMetricsMessage,
  WebSocketMessage,
} from './websocket-types';

function deriveLatencyMeasurement(notification: ChangeNotification): LatencyMetricsMessage['measurement'] {
  const fallback = notification.event.latency ?? {
    modbusReadAt: notification.timestamp,
    detectedAt: notification.timestamp,
    dispatchedAt: notification.timestamp,
  };

  return fallback;
}

export function createBroadcastPayloads(notification: ChangeNotification): WebSocketMessage[] {
  const payloads: WebSocketMessage[] = [notification];

  payloads.push(
    createLatencyMetricsMessage({
      type: 'latency_metrics',
      sessionId: notification.sessionId,
      measurement: deriveLatencyMeasurement(notification),
    }),
  );

  return payloads;
}

export function createBufferStatsMessage(update: BufferStatsUpdate): WebSocketMessage {
  return {
    ...update,
    stats: {
      ...update.stats,
      utilisationPercent: Math.min(100, Math.max(0, update.stats.utilisationPercent)),
    },
  };
}

export function createDependencyStatusMessage(
  update: DependencyStatusUpdate,
): WebSocketMessage {
  return {
    ...update,
    statuses: update.statuses.map((status) => ({
      ...status,
      lastCheckedAt: status.lastCheckedAt ?? new Date().toISOString(),
    })),
  };
}

export function createLatencyMetricsMessage(message: LatencyMetricsMessage): WebSocketMessage {
  return {
    ...message,
  };
}
