import {
  MonitoringSession,
  MonitoringSessionMode,
  MonitoringSessionState,
  SessionConfiguration,
  BufferStats,
  DependencyStatus,
  DependencyAlert,
  SessionLifecycleEntry,
} from '../types/change-events';

export interface SessionLifecycleEvent extends SessionLifecycleEntry {
  sessionId: string;
}

function cloneConfiguration(config: SessionConfiguration): SessionConfiguration {
  return {
    ...config,
    buffer: { ...config.buffer },
    alertThresholds: { ...config.alertThresholds },
  };
}

export function createMonitoringSession(
  mode: MonitoringSessionMode,
  config: SessionConfiguration,
): MonitoringSession {
  const now = new Date().toISOString();
  return {
    sessionId: `${mode}-${now}`,
    startTime: now,
    endTime: null,
    mode,
    state: 'starting',
    registersMonitored: [],
    totalChanges: 0,
    configuration: cloneConfiguration(config),
    bufferStats: {
      size: 0,
      utilisationPercent: 0,
      droppedEvents: 0,
    },
    dependencies: [
      { name: 'modbus', status: 'healthy', lastCheckedAt: now },
      { name: 'websocket', status: 'healthy', lastCheckedAt: now },
    ],
    alerts: [],
    lifecycleLog: [],
  };
}

export function transitionSession(
  session: MonitoringSession,
  nextState: MonitoringSessionState,
): MonitoringSession {
  const occurredAt = new Date().toISOString();
  const lifecycleEvent: SessionLifecycleEvent = {
    sessionId: session.sessionId,
    from: session.state,
    to: nextState,
    occurredAt,
  };

  const resolvedState = nextState === 'resuming' ? 'active' : nextState;
  session.state = resolvedState;

  if (resolvedState === 'stopped') {
    session.endTime = occurredAt;
  }

  session.lifecycleLog = [...(session.lifecycleLog ?? []), lifecycleEvent];

  return session;
}

export function recordBufferStats(
  session: MonitoringSession,
  stats: BufferStats,
): MonitoringSession {
  const utilisation = Math.min(100, Math.max(0, stats.utilisationPercent));
  session.bufferStats = {
    ...stats,
    utilisationPercent: utilisation,
  };

  if (session.configuration.alertThresholds) {
    const { bufferUtilisationPercent } = session.configuration.alertThresholds;
    if (utilisation >= bufferUtilisationPercent) {
      const alert: DependencyAlert = {
        dependency: 'modbus',
        previousStatus: 'healthy',
        currentStatus: 'degraded',
        occurredAt: new Date().toISOString(),
        message: `Buffer utilisation exceeded ${bufferUtilisationPercent}%`,
      };
      session.alerts = [...(session.alerts ?? []), alert];
    }
  }

  return session;
}

export function applyDependencyStatus(
  session: MonitoringSession,
  statuses: DependencyStatus[],
): MonitoringSession {
  const now = new Date().toISOString();
  const updates = statuses.map((status) => ({
    ...status,
    lastCheckedAt: status.lastCheckedAt ?? now,
  }));

  session.dependencies = updates;

  const alerts = updates
    .filter((status) => status.status !== 'healthy')
    .map<DependencyAlert>((status) => ({
      dependency: status.name,
      previousStatus: 'healthy',
      currentStatus: status.status,
      occurredAt: now,
      message: `${status.name} reported ${status.status}`,
    }));

  if (alerts.length > 0) {
    session.alerts = [...(session.alerts ?? []), ...alerts];
  }

  return session;
}
