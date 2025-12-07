import type { DependencyStatus, DependencyAlert } from '../types/change-events';

type DependencyName = DependencyStatus['name'];

const MAX_ALERT_HISTORY = 20;

export class DependencyMonitors {
  private statuses: Map<DependencyName, DependencyStatus> = new Map();
  private alerts: DependencyAlert[] = [];

  constructor(initialStatuses: DependencyStatus[] = []) {
    initialStatuses.forEach((status) => {
      this.statuses.set(status.name, status);
    });
  }

  updateStatus(name: DependencyName, status: DependencyStatus['status'], details?: string) {
    const timestamp = new Date().toISOString();
    const previous = this.statuses.get(name);
    const next: DependencyStatus = {
      name,
      status,
      details,
      lastCheckedAt: timestamp,
    };

    this.statuses.set(name, next);

    if (!previous || previous.status !== status) {
      const alert: DependencyAlert = {
        dependency: name,
        previousStatus: previous ? previous.status : 'healthy',
        currentStatus: status,
        occurredAt: timestamp,
        message: details ?? `${name} 状态变化为 ${status}`,
      };

      if (status === 'healthy') {
        alert.resolvedAt = timestamp;
      }

      this.alerts.push(alert);
      if (this.alerts.length > MAX_ALERT_HISTORY) {
        this.alerts.shift();
      }
    }
  }

  snapshot() {
    return {
      statuses: Array.from(this.statuses.values()),
      alerts: [...this.alerts],
    };
  }

  setStatuses(statuses: DependencyStatus[]) {
    this.statuses.clear();
    statuses.forEach((status) => this.statuses.set(status.name, status));
  }
}
