import { DependencyMonitors } from '@/lib/dependency-monitors';

describe('dependency monitoring', () => {
  it('tracks status transitions and records alerts', () => {
    const monitors = new DependencyMonitors([
      { name: 'modbus', status: 'healthy', lastCheckedAt: new Date().toISOString() },
    ]);

    monitors.updateStatus('modbus', 'degraded', 'Polling timeout');
    let snapshot = monitors.snapshot();

    expect(snapshot.statuses[0].status).toBe('degraded');
    expect(snapshot.alerts.at(-1)?.currentStatus).toBe('degraded');

    monitors.updateStatus('modbus', 'healthy');
    snapshot = monitors.snapshot();
    expect(snapshot.statuses[0].status).toBe('healthy');
    expect(snapshot.alerts.at(-1)?.currentStatus).toBe('healthy');
    expect(snapshot.alerts.length).toBeGreaterThan(0);
  });

  it('caps alert history to prevent unbounded growth', () => {
    const monitors = new DependencyMonitors();
    for (let i = 0; i < 30; i += 1) {
      monitors.updateStatus('mqtt', i % 2 === 0 ? 'degraded' : 'healthy', `event ${i}`);
    }
    const snapshot = monitors.snapshot();
    expect(snapshot.alerts.length).toBeLessThanOrEqual(20);
  });
});
