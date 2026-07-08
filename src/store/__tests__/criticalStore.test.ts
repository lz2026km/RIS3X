import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCriticalStore } from '../criticalStore';

const { mockList, mockAcknowledge, mockResolve, mockNotify } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockAcknowledge: vi.fn(),
  mockResolve: vi.fn(),
  mockNotify: vi.fn(),
}));

vi.mock('@services/api', () => ({
  criticalApi: {
    list: mockList,
    acknowledge: mockAcknowledge,
    resolve: mockResolve,
    notify: mockNotify,
  },
}));

const createValue = (overrides: Record<string, unknown> = {}) => ({
  id: 'cv-1',
  patientName: '张三',
  finding: '血钾 6.8mmol/L',
  severity: 'critical',
  status: 'pending',
  triggeredAt: new Date().toISOString(),
  ...overrides,
});

describe('criticalStore', () => {
  beforeEach(() => {
    useCriticalStore.setState({ values: [], loading: false, error: null, actors: new Map() });
    vi.clearAllMocks();
  });

  describe('load', () => {
    it('loads critical values from API', async () => {
      const data = [createValue()];
      mockList.mockResolvedValue({ success: true, data });
      await useCriticalStore.getState().load();
      expect(useCriticalStore.getState().values).toHaveLength(1);
      expect(useCriticalStore.getState().values[0].id).toBe('cv-1');
      expect(useCriticalStore.getState().loading).toBe(false);
      expect(useCriticalStore.getState().error).toBeNull();
    });

    it('handles API failure', async () => {
      mockList.mockResolvedValue({ success: false, data: null, error: { message: '网络错误' } });
      await useCriticalStore.getState().load();
      expect(useCriticalStore.getState().values).toHaveLength(0);
      expect(useCriticalStore.getState().error).toBe('网络错误');
    });

    it('maintains existing actors on reload', async () => {
      const data = [createValue()];
      mockList.mockResolvedValue({ success: true, data });
      await useCriticalStore.getState().load();
      const actorsAfterFirstLoad = useCriticalStore.getState().actors;
      expect(actorsAfterFirstLoad.size).toBe(1);
      mockList.mockResolvedValue({ success: true, data: [createValue()] });
      await useCriticalStore.getState().load();
      expect(useCriticalStore.getState().actors.size).toBe(1);
    });
  });

  describe('notify', () => {
    it('notifies and updates status to notified', async () => {
      const data = [createValue({ status: 'pending' })];
      mockList.mockResolvedValue({ success: true, data });
      await useCriticalStore.getState().load();
      mockNotify.mockResolvedValue({ success: true, data: null as unknown as Record<string, unknown>, error: undefined });
      await useCriticalStore.getState().notify('cv-1', 'PHONE');
      expect(useCriticalStore.getState().values[0].status).toBe('notified');
    });
  });

  describe('acknowledge', () => {
    it('acknowledges and updates status', async () => {
      const data = [createValue({ status: 'notified', notificationMethod: 'PHONE' })];
      mockList.mockResolvedValue({ success: true, data });
      await useCriticalStore.getState().load();
      mockAcknowledge.mockResolvedValue({ success: true });
      await useCriticalStore.getState().acknowledge('cv-1');
      expect(useCriticalStore.getState().values[0].status).toBe('acknowledged');
    });

    it('handles acknowledge API failure', async () => {
      const data = [createValue({ status: 'notified', notificationMethod: 'PHONE' })];
      mockList.mockResolvedValue({ success: true, data });
      await useCriticalStore.getState().load();
      mockAcknowledge.mockResolvedValue({ success: false, data: null, error: { message: '确认失败' } });
      await useCriticalStore.getState().acknowledge('cv-1');
      expect(useCriticalStore.getState().values[0].status).toBe('notified');
    });
  });

  describe('resolve', () => {
    it('resolves from acknowledged status', async () => {
      const data = [createValue({ status: 'acknowledged' })];
      mockList.mockResolvedValue({ success: true, data });
      await useCriticalStore.getState().load();
      mockResolve.mockResolvedValue({ success: true });
      await useCriticalStore.getState().resolve('cv-1');
      expect(useCriticalStore.getState().values[0].status).toBe('resolved');
    });

    it('handles resolve API failure', async () => {
      const data = [createValue({ status: 'acknowledged' })];
      mockList.mockResolvedValue({ success: true, data });
      await useCriticalStore.getState().load();
      mockResolve.mockResolvedValue({ success: false, data: null, error: { message: '处理失败' } });
      await useCriticalStore.getState().resolve('cv-1');
      expect(useCriticalStore.getState().values[0].status).not.toBe('resolved');
    });
  });

  describe('escalate', () => {
    it('escalates from pending or notified', async () => {
      const data = [createValue({ status: 'pending' })];
      mockList.mockResolvedValue({ success: true, data });
      await useCriticalStore.getState().load();
      await useCriticalStore.getState().escalate('cv-1', 'chief');
      expect(useCriticalStore.getState().values[0].status).toBe('escalated');
      expect(useCriticalStore.getState().values[0].escalatedTo).toBe('chief');
    });
  });
});
