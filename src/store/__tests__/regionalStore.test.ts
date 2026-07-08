import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRegionalStore } from '../regionalStore';

const { mockFetchRegionalImaging, mockFetchSchedule, mockFetchDepartments } = vi.hoisted(() => ({
  mockFetchRegionalImaging: vi.fn(),
  mockFetchSchedule: vi.fn(),
  mockFetchDepartments: vi.fn(),
}));

vi.mock('@services/api', () => ({
  regionalApi: {
    fetchRegionalImaging: mockFetchRegionalImaging,
    fetchSchedule: mockFetchSchedule,
    fetchDepartments: mockFetchDepartments,
  },
}));

const baseImaging = { id: 'img-1', patientName: '张三', modality: 'CT', bodyPart: '胸部', sourceHospital: '分院A', status: 'completed', completedAt: '2026-07-01T00:00:00.000Z' };
const baseSchedule = { id: 'sch-1', doctorName: '李明', hospital: '总院', roomId: 'R-01', date: '2026-07-15', shift: 'morning' };
const baseDept = { id: 'dept-1', name: '放射科', hospital: '总院', phone: '010-1234', headDoctor: '王主任' };

describe('regionalStore', () => {
  beforeEach(() => {
    useRegionalStore.setState({ regionalImages: [], schedules: [], departments: [], loading: false, error: null });
    vi.clearAllMocks();
  });

  describe('fetchRegionalImaging', () => {
    it('loads regional imaging data', async () => {
      mockFetchRegionalImaging.mockResolvedValue({ success: true, data: [baseImaging] });
      await useRegionalStore.getState().fetchRegionalImaging();
      expect(useRegionalStore.getState().regionalImages).toHaveLength(1);
      expect(useRegionalStore.getState().loading).toBe(false);
    });

    it('handles API failure', async () => {
      mockFetchRegionalImaging.mockResolvedValue({ success: false, data: null, error: { message: '跨院影像加载失败' } });
      await useRegionalStore.getState().fetchRegionalImaging();
      expect(useRegionalStore.getState().regionalImages).toHaveLength(0);
      expect(useRegionalStore.getState().error).toBe('跨院影像加载失败');
    });

    it('returns correct shape', async () => {
      mockFetchRegionalImaging.mockResolvedValue({ success: true, data: [baseImaging] });
      await useRegionalStore.getState().fetchRegionalImaging();
      const img = useRegionalStore.getState().regionalImages[0];
      expect(img).toHaveProperty('patientName');
      expect(img).toHaveProperty('sourceHospital');
      expect(img).toHaveProperty('status');
    });

    it('filters regional images by hospital', async () => {
      mockFetchRegionalImaging.mockResolvedValue({ success: true, data: [baseImaging] });
      await useRegionalStore.getState().fetchRegionalImaging({ hospital: '分院A' });
      expect(mockFetchRegionalImaging).toHaveBeenCalledWith({ hospital: '分院A' });
    });

    it('handles empty regional images', async () => {
      mockFetchRegionalImaging.mockResolvedValue({ success: true, data: [] });
      await useRegionalStore.getState().fetchRegionalImaging();
      expect(useRegionalStore.getState().regionalImages).toHaveLength(0);
    });

    it('sets loading state for regional fetch', async () => {
      let resolvePromise: (v: unknown) => void;
      mockFetchRegionalImaging.mockReturnValue(new Promise((r) => { resolvePromise = r; }));
      const promise = useRegionalStore.getState().fetchRegionalImaging();
      expect(useRegionalStore.getState().loading).toBe(true);
      resolvePromise!({ success: true, data: [baseImaging] });
      await promise;
      expect(useRegionalStore.getState().loading).toBe(false);
    });
  });

  describe('fetchSchedule', () => {
    it('loads schedules', async () => {
      mockFetchSchedule.mockResolvedValue({ success: true, data: [baseSchedule] });
      await useRegionalStore.getState().fetchSchedule();
      expect(useRegionalStore.getState().schedules).toHaveLength(1);
      expect(useRegionalStore.getState().schedules[0].doctorName).toBe('李明');
    });

    it('handles API failure', async () => {
      mockFetchSchedule.mockResolvedValue({ success: false, data: null, error: { message: '排班加载失败' } });
      await useRegionalStore.getState().fetchSchedule();
      expect(useRegionalStore.getState().schedules).toHaveLength(0);
      expect(useRegionalStore.getState().error).toBe('排班加载失败');
    });

    it('returns correct shape', async () => {
      mockFetchSchedule.mockResolvedValue({ success: true, data: [baseSchedule] });
      await useRegionalStore.getState().fetchSchedule();
      const s = useRegionalStore.getState().schedules[0];
      expect(s).toHaveProperty('hospital');
      expect(s).toHaveProperty('shift');
      expect(s).toHaveProperty('date');
    });
  });

  describe('fetchDepartments', () => {
    it('loads departments', async () => {
      mockFetchDepartments.mockResolvedValue({ success: true, data: [baseDept] });
      await useRegionalStore.getState().fetchDepartments();
      expect(useRegionalStore.getState().departments).toHaveLength(1);
      expect(useRegionalStore.getState().departments[0].name).toBe('放射科');
    });

    it('handles API failure', async () => {
      mockFetchDepartments.mockResolvedValue({ success: false, data: null, error: { message: '科室加载失败' } });
      await useRegionalStore.getState().fetchDepartments();
      expect(useRegionalStore.getState().departments).toHaveLength(0);
      expect(useRegionalStore.getState().error).toBe('科室加载失败');
    });

    it('returns correct shape', async () => {
      mockFetchDepartments.mockResolvedValue({ success: true, data: [baseDept] });
      await useRegionalStore.getState().fetchDepartments();
      const d = useRegionalStore.getState().departments[0];
      expect(d).toHaveProperty('hospital');
      expect(d).toHaveProperty('phone');
      expect(d).toHaveProperty('headDoctor');
    });

    it('filters by hospital', async () => {
      mockFetchDepartments.mockResolvedValue({ success: true, data: [baseDept] });
      await useRegionalStore.getState().fetchDepartments({ hospital: '总院' });
      expect(mockFetchDepartments).toHaveBeenCalledWith({ hospital: '总院' });
    });

    it('handles empty departments', async () => {
      mockFetchDepartments.mockResolvedValue({ success: true, data: [] });
      await useRegionalStore.getState().fetchDepartments();
      expect(useRegionalStore.getState().departments).toHaveLength(0);
    });

    it('sets loading for each fetch', async () => {
      let resolvePromise: (v: unknown) => void;
      mockFetchDepartments.mockReturnValue(new Promise((r) => { resolvePromise = r; }));
      const promise = useRegionalStore.getState().fetchDepartments();
      expect(useRegionalStore.getState().loading).toBe(true);
      resolvePromise!({ success: true, data: [baseDept] });
      await promise;
      expect(useRegionalStore.getState().loading).toBe(false);
    });
  });
});
