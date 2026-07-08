import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDeviceMgmtStore } from '../deviceMgmtStore';

const { mockFetchDevices, mockFetchFaults, mockAddMaterial } = vi.hoisted(() => ({
  mockFetchDevices: vi.fn(),
  mockFetchFaults: vi.fn(),
  mockAddMaterial: vi.fn(),
}));

vi.mock('@services/api', () => ({
  deviceMgmtApi: {
    fetchDevices: mockFetchDevices,
    fetchFaults: mockFetchFaults,
    addMaterial: mockAddMaterial,
  },
}));

const baseDevice = {
  id: 'dev-1', code: 'CT-001', name: 'CT-1', modality: 'CT',
  status: 'active', manufacturer: 'Siemens', model: 'SOMATOM Force',
  roomId: 'R-01', utilization: 92, lastMaintenanceAt: '2026-06-15T00:00:00.000Z',
};

const baseFault = {
  id: 'flt-1', deviceId: 'dev-1', deviceName: 'CT-1', faultType: '球管故障',
  severity: 'high', reportedAt: '2026-07-01T00:00:00.000Z', status: 'open',
};

const baseMaterial = { id: 'mat-1', name: 'CT球管', category: 'parts', stock: 2, unit: '个', safetyStock: 1 };

describe('deviceMgmtStore', () => {
  beforeEach(() => {
    useDeviceMgmtStore.setState({ devices: [], faults: [], loading: false, error: null });
    vi.clearAllMocks();
  });

  describe('fetchDevices', () => {
    it('loads devices', async () => {
      mockFetchDevices.mockResolvedValue({ success: true, data: [baseDevice] });
      await useDeviceMgmtStore.getState().fetchDevices();
      expect(useDeviceMgmtStore.getState().devices).toHaveLength(1);
      expect(useDeviceMgmtStore.getState().loading).toBe(false);
    });

    it('handles API failure', async () => {
      mockFetchDevices.mockResolvedValue({ success: false, data: null, error: { message: '设备加载失败' } });
      await useDeviceMgmtStore.getState().fetchDevices();
      expect(useDeviceMgmtStore.getState().devices).toHaveLength(0);
      expect(useDeviceMgmtStore.getState().error).toBe('设备加载失败');
    });

    it('handles empty devices', async () => {
      mockFetchDevices.mockResolvedValue({ success: true, data: [] });
      await useDeviceMgmtStore.getState().fetchDevices();
      expect(useDeviceMgmtStore.getState().devices).toHaveLength(0);
    });

    it('returns correct shape', async () => {
      mockFetchDevices.mockResolvedValue({ success: true, data: [baseDevice] });
      await useDeviceMgmtStore.getState().fetchDevices();
      const d = useDeviceMgmtStore.getState().devices[0];
      expect(d).toHaveProperty('code');
      expect(d).toHaveProperty('name');
      expect(d).toHaveProperty('modality');
      expect(d).toHaveProperty('status');
      expect(d).toHaveProperty('utilization');
    });

    it('sets loading state', async () => {
      let resolvePromise: (v: unknown) => void;
      mockFetchDevices.mockReturnValue(new Promise((r) => { resolvePromise = r; }));
      const promise = useDeviceMgmtStore.getState().fetchDevices();
      expect(useDeviceMgmtStore.getState().loading).toBe(true);
      resolvePromise!({ success: true, data: [baseDevice] });
      await promise;
      expect(useDeviceMgmtStore.getState().loading).toBe(false);
    });
  });

  describe('fetchFaults', () => {
    it('loads faults', async () => {
      mockFetchFaults.mockResolvedValue({ success: true, data: [baseFault] });
      await useDeviceMgmtStore.getState().fetchFaults();
      expect(useDeviceMgmtStore.getState().faults).toHaveLength(1);
      expect(useDeviceMgmtStore.getState().faults[0].faultType).toBe('球管故障');
    });

    it('handles API failure', async () => {
      mockFetchFaults.mockResolvedValue({ success: false, data: null, error: { message: '故障列表加载失败' } });
      await useDeviceMgmtStore.getState().fetchFaults();
      expect(useDeviceMgmtStore.getState().faults).toHaveLength(0);
      expect(useDeviceMgmtStore.getState().error).toBe('故障列表加载失败');
    });

    it('handles empty faults', async () => {
      mockFetchFaults.mockResolvedValue({ success: true, data: [] });
      await useDeviceMgmtStore.getState().fetchFaults();
      expect(useDeviceMgmtStore.getState().faults).toHaveLength(0);
    });

    it('returns correct shape', async () => {
      mockFetchFaults.mockResolvedValue({ success: true, data: [baseFault] });
      await useDeviceMgmtStore.getState().fetchFaults();
      const f = useDeviceMgmtStore.getState().faults[0];
      expect(f).toHaveProperty('deviceId');
      expect(f).toHaveProperty('faultType');
      expect(f).toHaveProperty('severity');
      expect(f).toHaveProperty('status');
    });

    it('handles network error', async () => {
      mockFetchFaults.mockRejectedValue(new Error('网络异常'));
      await useDeviceMgmtStore.getState().fetchFaults();
      expect(useDeviceMgmtStore.getState().error).toBe('网络异常');
    });
  });

  describe('addMaterial', () => {
    it('adds material successfully and updates stock', async () => {
      useDeviceMgmtStore.setState({ devices: [baseDevice] });
      mockAddMaterial.mockResolvedValue({ success: true, data: baseMaterial });
      await useDeviceMgmtStore.getState().addMaterial({ name: 'CT球管', category: 'parts', stock: 2 });
      expect(useDeviceMgmtStore.getState().error).toBeNull();
    });

    it('handles add material failure', async () => {
      mockAddMaterial.mockResolvedValue({ success: false, data: null, error: { message: '添加耗材失败' } });
      await useDeviceMgmtStore.getState().addMaterial({ name: 'test' });
      expect(useDeviceMgmtStore.getState().error).toBe('添加耗材失败');
    });

    it('handles network error on add', async () => {
      mockAddMaterial.mockRejectedValue(new Error('网络错误'));
      await useDeviceMgmtStore.getState().addMaterial({ name: 'test' });
      expect(useDeviceMgmtStore.getState().error).toBe('网络错误');
    });

    it('sets loading during add material', async () => {
      let resolvePromise: (v: unknown) => void;
      mockAddMaterial.mockReturnValue(new Promise((r) => { resolvePromise = r; }));
      const promise = useDeviceMgmtStore.getState().addMaterial({ name: 'test', stock: 5 });
      expect(useDeviceMgmtStore.getState().loading).toBe(true);
      resolvePromise!({ success: true, data: { id: 'mat-new', name: 'test', stock: 5 } });
      await promise;
      expect(useDeviceMgmtStore.getState().loading).toBe(false);
    });

    it('filters faults by device ID', async () => {
      mockFetchFaults.mockResolvedValue({ success: true, data: [baseFault] });
      await useDeviceMgmtStore.getState().fetchFaults({ deviceId: 'dev-1' });
      expect(mockFetchFaults).toHaveBeenCalledWith({ deviceId: 'dev-1' });
    });

    it('filters faults by severity', async () => {
      mockFetchFaults.mockResolvedValue({ success: true, data: [baseFault] });
      await useDeviceMgmtStore.getState().fetchFaults({ severity: 'high' });
      expect(mockFetchFaults).toHaveBeenCalledWith({ severity: 'high' });
    });

    it('filters faults by status', async () => {
      mockFetchFaults.mockResolvedValue({ success: true, data: [baseFault] });
      await useDeviceMgmtStore.getState().fetchFaults({ status: 'open' });
      expect(mockFetchFaults).toHaveBeenCalledWith({ status: 'open' });
    });

    it('sets loading during fault fetch', async () => {
      let resolvePromise: (v: unknown) => void;
      mockFetchFaults.mockReturnValue(new Promise((r) => { resolvePromise = r; }));
      const promise = useDeviceMgmtStore.getState().fetchFaults();
      expect(useDeviceMgmtStore.getState().loading).toBe(true);
      resolvePromise!({ success: true, data: [baseFault] });
      await promise;
      expect(useDeviceMgmtStore.getState().loading).toBe(false);
    });

    it('replaces devices on reload', async () => {
      useDeviceMgmtStore.setState({ devices: [{ ...baseDevice }] });
      const newDevice = { ...baseDevice, id: 'dev-2', name: 'CT-2' };
      mockFetchDevices.mockResolvedValue({ success: true, data: [newDevice] });
      await useDeviceMgmtStore.getState().fetchDevices();
      expect(useDeviceMgmtStore.getState().devices).toHaveLength(1);
      expect(useDeviceMgmtStore.getState().devices[0].name).toBe('CT-2');
    });

    it('handles multiple faults in response', async () => {
      const faults = [baseFault, { ...baseFault, id: 'flt-2', deviceId: 'dev-2', faultType: '探测器故障' }];
      mockFetchFaults.mockResolvedValue({ success: true, data: faults });
      await useDeviceMgmtStore.getState().fetchFaults();
      expect(useDeviceMgmtStore.getState().faults).toHaveLength(2);
    });

    it('handles empty faults list', async () => {
      mockFetchFaults.mockResolvedValue({ success: true, data: [] });
      await useDeviceMgmtStore.getState().fetchFaults();
      expect(useDeviceMgmtStore.getState().faults).toHaveLength(0);
    });
  });
});
