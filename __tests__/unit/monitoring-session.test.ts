import {
  createMonitoringSession,
  recordBufferStats,
  transitionSession,
  applyDependencyStatus,
} from '@/lib/monitoring-session';
import { DEFAULT_SESSION_CONFIG } from '@/types/change-events';

describe('monitoring-session utilities', () => {
  it('initialises session in starting state with zero totals', () => {
    const session = createMonitoringSession('basic', DEFAULT_SESSION_CONFIG);
    expect(session.state).toBe('starting');
    expect(session.totalChanges).toBe(0);
    expect(session.configuration.pollingInterval).toBe(DEFAULT_SESSION_CONFIG.pollingInterval);
  });

  it('transitions session state and records lifecycle events', () => {
    let session = createMonitoringSession('basic', DEFAULT_SESSION_CONFIG);
    session = transitionSession(session, 'active');
    expect(session.state).toBe('active');
    session = transitionSession(session, 'paused');
    expect(session.state).toBe('paused');
  });

  it('records buffer stats and raises utilisation alerts when exceeding threshold', () => {
    let session = createMonitoringSession('basic', DEFAULT_SESSION_CONFIG);
    session = recordBufferStats(session, {
      size: 160,
      utilisationPercent: 95,
      droppedEvents: 2,
      lastDropAt: new Date().toISOString(),
    });

    expect(session.bufferStats?.utilisationPercent).toBe(95);
    expect(session.alerts?.length).toBeGreaterThan(0);
  });

  it('applies dependency statuses and logs alerts for degraded services', () => {
    let session = createMonitoringSession('basic', DEFAULT_SESSION_CONFIG);
    session = applyDependencyStatus(session, [
      { name: 'modbus', status: 'degraded', lastCheckedAt: new Date().toISOString(), details: 'timeout' },
    ]);

    expect(session.dependencies?.[0].status).toBe('degraded');
    expect(session.alerts?.some((alert) => alert.dependency === 'modbus')).toBe(true);
  });
});
