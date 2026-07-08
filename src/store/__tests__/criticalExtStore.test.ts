import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCriticalExtStore } from '../criticalExtStore';

const { mockFetchCriticalRules, mockFetchCriticalStats, mockAutoDetectCritical } = vi.hoisted(() => ({
  mockFetchCriticalRules: vi.fn(),
  mockFetchCriticalStats: vi.fn(),
  mockAutoDetectCritical: vi.fn(),
}));

vi.mock('@services/api', () => ({
  criticalExtApi: {
    fetchCriticalRules: mockFetchCriticalRules,
    fetchCriticalStats: mockFetchCriticalStats,
    autoDetectCritical: mockAutoDetectCritical,
  },
}));

const baseRule = {
  id: 'rule-1', name: '血钾危急值', indicator: '血钾', threshold: '>6.5mmol/L',
  severity: 'critical', enabled: true, createdAt: '2026-01-01T00:00:00.000Z',
};

const baseStats = { totalCritical: 128, closedRate: 95.3, avgClosureMinutes: 28, byDepartment: [], bySeverity: [] };

describe('criticalExtStore', () => {
  beforeEach(() => {
    useCriticalExtStore.setState({ criticalRules: [], criticalStats: null, loading: false, error: null });
    vi.clearAllMocks();
  });

  describe('fetchCriticalRules', () => {
    it('loads critical rules', async () => {
      mockFetchCriticalRules.mockResolvedValue({ success: true, data: [baseRule] });
      await useCriticalExtStore.getState().fetchCriticalRules();
      expect(useCriticalExtStore.getState().criticalRules).toHaveLength(1);
      expect(useCriticalExtStore.getState().loading).toBe(false);
    });

    it('handles API failure', async () => {
      mockFetchCriticalRules.mockResolvedValue({ success: false, data: null, error: { message: '规则加载失败' } });
      await useCriticalExtStore.getState().fetchCriticalRules();
      expect(useCriticalExtStore.getState().criticalRules).toHaveLength(0);
      expect(useCriticalExtStore.getState().error).toBe('规则加载失败');
    });

    it('handles empty rules', async () => {
      mockFetchCriticalRules.mockResolvedValue({ success: true, data: [] });
      await useCriticalExtStore.getState().fetchCriticalRules();
      expect(useCriticalExtStore.getState().criticalRules).toHaveLength(0);
    });

    it('returns correct shape', async () => {
      mockFetchCriticalRules.mockResolvedValue({ success: true, data: [baseRule] });
      await useCriticalExtStore.getState().fetchCriticalRules();
      const r = useCriticalExtStore.getState().criticalRules[0];
      expect(r).toHaveProperty('name');
      expect(r).toHaveProperty('indicator');
      expect(r).toHaveProperty('threshold');
      expect(r).toHaveProperty('severity');
    });

    it('sets loading state', async () => {
      let resolvePromise: (v: unknown) => void;
      mockFetchCriticalRules.mockReturnValue(new Promise((r) => { resolvePromise = r; }));
      const promise = useCriticalExtStore.getState().fetchCriticalRules();
      expect(useCriticalExtStore.getState().loading).toBe(true);
      resolvePromise!({ success: true, data: [baseRule] });
      await promise;
      expect(useCriticalExtStore.getState().loading).toBe(false);
    });
  });

  describe('fetchCriticalStats', () => {
    it('loads critical stats', async () => {
      mockFetchCriticalStats.mockResolvedValue({ success: true, data: baseStats });
      await useCriticalExtStore.getState().fetchCriticalStats();
      expect(useCriticalExtStore.getState().criticalStats).toBeTruthy();
      expect(useCriticalExtStore.getState().criticalStats!.totalCritical).toBe(128);
    });

    it('handles API failure', async () => {
      mockFetchCriticalStats.mockResolvedValue({ success: false, data: null, error: { message: '统计加载失败' } });
      await useCriticalExtStore.getState().fetchCriticalStats();
      expect(useCriticalExtStore.getState().criticalStats).toBeNull();
      expect(useCriticalExtStore.getState().error).toBe('统计加载失败');
    });

    it('returns correct shape', async () => {
      mockFetchCriticalStats.mockResolvedValue({ success: true, data: baseStats });
      await useCriticalExtStore.getState().fetchCriticalStats();
      const s = useCriticalExtStore.getState().criticalStats!;
      expect(s).toHaveProperty('totalCritical');
      expect(s).toHaveProperty('closedRate');
      expect(s).toHaveProperty('avgClosureMinutes');
      expect(s).toHaveProperty('byDepartment');
      expect(s).toHaveProperty('bySeverity');
    });
  });

  describe('autoDetectCritical', () => {
    it('auto-detects critical value', async () => {
      const detectionResult = { detected: true, ruleId: 'rule-1', value: '6.8', severity: 'critical' };
      mockAutoDetectCritical.mockResolvedValue({ success: true, data: detectionResult });
      await useCriticalExtStore.getState().autoDetectCritical({ patientId: 'P001', indicator: '血钾', value: '6.8' });
      expect(useCriticalExtStore.getState().error).toBeNull();
    });

    it('handles detection failure', async () => {
      mockAutoDetectCritical.mockResolvedValue({ success: false, data: null, error: { message: '自动检测失败' } });
      await useCriticalExtStore.getState().autoDetectCritical({ patientId: 'P001', indicator: '血钾', value: '6.8' });
      expect(useCriticalExtStore.getState().error).toBe('自动检测失败');
    });

    it('handles network error', async () => {
      mockAutoDetectCritical.mockRejectedValue(new Error('网络错误'));
      await useCriticalExtStore.getState().autoDetectCritical({ patientId: 'P001', indicator: '血钾', value: '6.8' });
      expect(useCriticalExtStore.getState().error).toBe('网络错误');
    });

    it('filters critical rules by severity', async () => {
      mockFetchCriticalRules.mockResolvedValue({ success: true, data: [baseRule] });
      await useCriticalExtStore.getState().fetchCriticalRules({ severity: 'critical' });
      expect(mockFetchCriticalRules).toHaveBeenCalledWith({ severity: 'critical' });
    });

    it('filters critical rules by enabled status', async () => {
      mockFetchCriticalRules.mockResolvedValue({ success: true, data: [baseRule] });
      await useCriticalExtStore.getState().fetchCriticalRules({ enabled: true });
      expect(mockFetchCriticalRules).toHaveBeenCalledWith({ enabled: true });
    });

    it('handles multiple critical rules', async () => {
      const rules = [baseRule, { ...baseRule, id: 'rule-2', name: '血钠危急值', indicator: '血钠', threshold: '<120mmol/L' }];
      mockFetchCriticalRules.mockResolvedValue({ success: true, data: rules });
      await useCriticalExtStore.getState().fetchCriticalRules();
      expect(useCriticalExtStore.getState().criticalRules).toHaveLength(2);
    });

    it('handles empty stats gracefully', async () => {
      mockFetchCriticalStats.mockResolvedValue({ success: true, data: { totalCritical: 0, closedRate: 0, avgClosureMinutes: 0, byDepartment: [], bySeverity: [] } });
      await useCriticalExtStore.getState().fetchCriticalStats();
      expect(useCriticalExtStore.getState().criticalStats?.totalCritical).toBe(0);
    });

    it('sets loading during auto detect', async () => {
      let resolvePromise: (v: unknown) => void;
      mockAutoDetectCritical.mockReturnValue(new Promise((r) => { resolvePromise = r; }));
      const promise = useCriticalExtStore.getState().autoDetectCritical({ patientId: 'P001', indicator: '血钾', value: '6.8' });
      expect(useCriticalExtStore.getState().loading).toBe(true);
      resolvePromise!({ success: true, data: { detected: true, ruleId: 'rule-1', value: '6.8', severity: 'critical' } });
      await promise;
      expect(useCriticalExtStore.getState().loading).toBe(false);
    });

    it('handles auto detect returning false', async () => {
      mockAutoDetectCritical.mockResolvedValue({ success: true, data: { detected: false } });
      await useCriticalExtStore.getState().autoDetectCritical({ patientId: 'P001', indicator: '血钾', value: '5.0' });
      expect(useCriticalExtStore.getState().error).toBeNull();
    });

    it('handles network error on critical stats', async () => {
      mockFetchCriticalStats.mockRejectedValue(new Error('网络错误'));
      await useCriticalExtStore.getState().fetchCriticalStats();
      expect(useCriticalExtStore.getState().error).toBe('网络错误');
    });
  });
});
