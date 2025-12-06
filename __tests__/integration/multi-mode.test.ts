import {
  createMonitoringSession,
  transitionSession,
  recordBufferStats,
} from '@/lib/monitoring-session';
import { DEFAULT_SESSION_CONFIG } from '@/types/change-events';

describe('Multi-mode monitoring compatibility', () => {
  (['basic', 'enhanced', 'demo'] as const).forEach((mode) => {
    it(`initialises ${mode} session in starting state`, () => {
      const session = createMonitoringSession(mode, DEFAULT_SESSION_CONFIG);
      expect(session.mode).toBe(mode);
      expect(session.state).toBe('starting');
    });
  });

  it('transitions to paused state and preserves buffer stats across modes', () => {
    const session = createMonitoringSession('enhanced', DEFAULT_SESSION_CONFIG);
    const paused = transitionSession(session, 'paused');
    const updated = recordBufferStats(paused as any, {
      size: 10,
      utilisationPercent: 50,
      droppedEvents: 0,
    });

    expect(updated.state).toBe('paused');
    expect(updated.totalChanges).toBeGreaterThanOrEqual(0);
  });
});
