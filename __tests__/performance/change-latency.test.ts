import { assertLatencyWithinBudget } from '@/lib/change-detector';

describe('Latency budget compliance', () => {
  it('enforces the 1s end-to-end latency budget with sub-budgets', () => {
    const measurement = {
      modbusReadAt: new Date(Date.now() - 180).toISOString(),
      detectedAt: new Date(Date.now() - 80).toISOString(),
      dispatchedAt: new Date(Date.now() - 20).toISOString(),
      uiRenderedAt: new Date().toISOString(),
    };

    expect(assertLatencyWithinBudget(measurement)).toBe(true);
  });

  it('flags latency breaches when any stage exceeds its threshold', () => {
    const measurement = {
      modbusReadAt: new Date(Date.now() - 800).toISOString(),
      detectedAt: new Date(Date.now() - 400).toISOString(),
      dispatchedAt: new Date(Date.now() - 100).toISOString(),
      uiRenderedAt: new Date().toISOString(),
    };

    expect(assertLatencyWithinBudget(measurement)).toBe(false);
  });
});
