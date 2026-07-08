import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCdsStore } from '../cdsStore';

const { mockFetchGuidelines, mockFetchAlerts, mockAcknowledgeAlert } = vi.hoisted(() => ({
  mockFetchGuidelines: vi.fn(),
  mockFetchAlerts: vi.fn(),
  mockAcknowledgeAlert: vi.fn(),
}));

vi.mock('@services/api', () => ({
  cdsApi: {
    fetchGuidelines: mockFetchGuidelines,
    fetchAlerts: mockFetchAlerts,
    acknowledgeAlert: mockAcknowledgeAlert,
  },
}));

const baseGuideline = {
  id: 'gl-1', name: '肺结节Lung-RADS管理指南', category: 'oncology',
  version: '2025.v1', summary: '基于Lung-RADS分类的肺结节管理建议',
  applicableModalities: ['CT'], active: true,
};

const baseAlert = {
  id: 'alert-1', patientId: 'P001', patientName: '张三', examId: 'ex-1',
  ruleId: 'rule-1', message: '患者既往有造影剂过敏史',
  severity: 'warning', acknowledged: false, triggeredAt: '2026-07-01T00:00:00.000Z',
};

describe('cdsStore', () => {
  beforeEach(() => {
    useCdsStore.setState({ guidelines: [], alerts: [], loading: false, error: null });
    vi.clearAllMocks();
  });

  describe('fetchGuidelines', () => {
    it('loads guidelines', async () => {
      mockFetchGuidelines.mockResolvedValue({ success: true, data: [baseGuideline] });
      await useCdsStore.getState().fetchGuidelines();
      expect(useCdsStore.getState().guidelines).toHaveLength(1);
      expect(useCdsStore.getState().loading).toBe(false);
    });

    it('handles API failure', async () => {
      mockFetchGuidelines.mockResolvedValue({ success: false, data: null, error: { message: '指南加载失败' } });
      await useCdsStore.getState().fetchGuidelines();
      expect(useCdsStore.getState().guidelines).toHaveLength(0);
      expect(useCdsStore.getState().error).toBe('指南加载失败');
    });

    it('handles empty guidelines', async () => {
      mockFetchGuidelines.mockResolvedValue({ success: true, data: [] });
      await useCdsStore.getState().fetchGuidelines();
      expect(useCdsStore.getState().guidelines).toHaveLength(0);
    });

    it('returns correct shape', async () => {
      mockFetchGuidelines.mockResolvedValue({ success: true, data: [baseGuideline] });
      await useCdsStore.getState().fetchGuidelines();
      const g = useCdsStore.getState().guidelines[0];
      expect(g).toHaveProperty('name');
      expect(g).toHaveProperty('category');
      expect(g).toHaveProperty('version');
      expect(g).toHaveProperty('active');
    });

    it('sets loading state', async () => {
      let resolvePromise: (v: unknown) => void;
      mockFetchGuidelines.mockReturnValue(new Promise((r) => { resolvePromise = r; }));
      const promise = useCdsStore.getState().fetchGuidelines();
      expect(useCdsStore.getState().loading).toBe(true);
      resolvePromise!({ success: true, data: [baseGuideline] });
      await promise;
      expect(useCdsStore.getState().loading).toBe(false);
    });
  });

  describe('fetchAlerts', () => {
    it('loads alerts', async () => {
      mockFetchAlerts.mockResolvedValue({ success: true, data: [baseAlert] });
      await useCdsStore.getState().fetchAlerts();
      expect(useCdsStore.getState().alerts).toHaveLength(1);
      expect(useCdsStore.getState().alerts[0].message).toContain('造影剂过敏');
    });

    it('filters alerts by severity', async () => {
      mockFetchAlerts.mockResolvedValue({ success: true, data: [baseAlert] });
      await useCdsStore.getState().fetchAlerts({ severity: 'warning' });
      expect(mockFetchAlerts).toHaveBeenCalledWith({ severity: 'warning' });
    });

    it('filters alerts by patient ID', async () => {
      mockFetchAlerts.mockResolvedValue({ success: true, data: [baseAlert] });
      await useCdsStore.getState().fetchAlerts({ patientId: 'P001' });
      expect(mockFetchAlerts).toHaveBeenCalledWith({ patientId: 'P001' });
    });

    it('handles empty alerts', async () => {
      mockFetchAlerts.mockResolvedValue({ success: true, data: [] });
      await useCdsStore.getState().fetchAlerts();
      expect(useCdsStore.getState().alerts).toHaveLength(0);
    });

    it('sets loading during fetch alerts', async () => {
      let resolvePromise: (v: unknown) => void;
      mockFetchAlerts.mockReturnValue(new Promise((r) => { resolvePromise = r; }));
      const promise = useCdsStore.getState().fetchAlerts();
      expect(useCdsStore.getState().loading).toBe(true);
      resolvePromise!({ success: true, data: [baseAlert] });
      await promise;
      expect(useCdsStore.getState().loading).toBe(false);
    });

    it('handles API failure', async () => {
      mockFetchAlerts.mockResolvedValue({ success: false, data: null, error: { message: '告警加载失败' } });
      await useCdsStore.getState().fetchAlerts();
      expect(useCdsStore.getState().alerts).toHaveLength(0);
      expect(useCdsStore.getState().error).toBe('告警加载失败');
    });

    it('returns correct shape', async () => {
      mockFetchAlerts.mockResolvedValue({ success: true, data: [baseAlert] });
      await useCdsStore.getState().fetchAlerts();
      const a = useCdsStore.getState().alerts[0];
      expect(a).toHaveProperty('patientName');
      expect(a).toHaveProperty('severity');
      expect(a).toHaveProperty('acknowledged');
      expect(a).toHaveProperty('triggeredAt');
    });

    it('handles network error', async () => {
      mockFetchAlerts.mockRejectedValue(new Error('网络异常'));
      await useCdsStore.getState().fetchAlerts();
      expect(useCdsStore.getState().error).toBe('网络异常');
    });
  });

  describe('acknowledgeAlert', () => {
    it('acknowledges an alert', async () => {
      useCdsStore.setState({ alerts: [{ ...baseAlert }] });
      mockAcknowledgeAlert.mockResolvedValue({ success: true, data: null });
      await useCdsStore.getState().acknowledgeAlert('alert-1');
      expect(useCdsStore.getState().alerts[0].acknowledged).toBe(true);
    });

    it('handles acknowledge failure', async () => {
      useCdsStore.setState({ alerts: [{ ...baseAlert }] });
      mockAcknowledgeAlert.mockResolvedValue({ success: false, data: null, error: { message: '确认告警失败' } });
      await useCdsStore.getState().acknowledgeAlert('alert-1');
      expect(useCdsStore.getState().alerts[0].acknowledged).toBe(false);
      expect(useCdsStore.getState().error).toBe('确认告警失败');
    });

    it('handles network error on acknowledge', async () => {
      useCdsStore.setState({ alerts: [{ ...baseAlert }] });
      mockAcknowledgeAlert.mockRejectedValue(new Error('网络错误'));
      await useCdsStore.getState().acknowledgeAlert('alert-1');
      expect(useCdsStore.getState().error).toBe('网络错误');
    });

    it('sets loading during acknowledge', async () => {
      useCdsStore.setState({ alerts: [{ ...baseAlert }] });
      let resolvePromise: (v: unknown) => void;
      mockAcknowledgeAlert.mockReturnValue(new Promise((r) => { resolvePromise = r; }));
      const promise = useCdsStore.getState().acknowledgeAlert('alert-1');
      expect(useCdsStore.getState().loading).toBe(true);
      resolvePromise!({ success: true, data: null });
      await promise;
      expect(useCdsStore.getState().loading).toBe(false);
    });

    it('preserves other alerts on acknowledge', async () => {
      useCdsStore.setState({ alerts: [{ ...baseAlert, id: 'alert-1' }, { ...baseAlert, id: 'alert-2' }] });
      mockAcknowledgeAlert.mockResolvedValue({ success: true, data: null });
      await useCdsStore.getState().acknowledgeAlert('alert-1');
      expect(useCdsStore.getState().alerts).toHaveLength(2);
      expect(useCdsStore.getState().alerts[1].acknowledged).toBe(false);
    });
  });
});
