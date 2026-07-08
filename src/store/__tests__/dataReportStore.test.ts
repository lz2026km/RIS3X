import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDataReportStore } from '../dataReportStore';

const { mockFetchNationalReports, mockFetchDataReports } = vi.hoisted(() => ({
  mockFetchNationalReports: vi.fn(),
  mockFetchDataReports: vi.fn(),
}));

vi.mock('@services/api', () => ({
  dataReportApi: {
    fetchNationalReports: mockFetchNationalReports,
    fetchDataReports: mockFetchDataReports,
  },
}));

const baseNationalReport = { id: 'nr-1', name: '国家卫健委月报', period: '2026-06', category: 'national', status: 'generated', generatedAt: '2026-07-01T00:00:00.000Z' };
const baseDataReport = { id: 'dr-1', name: '放射诊疗工作量统计', category: 'workload', metrics: { totalExams: 12580, totalReports: 11200, ctCount: 4200 }, period: '2026-06' };

describe('dataReportStore', () => {
  beforeEach(() => {
    useDataReportStore.setState({ nationalReports: [], dataReports: [], loading: false, error: null });
    vi.clearAllMocks();
  });

  describe('fetchNationalReports', () => {
    it('loads national reports', async () => {
      mockFetchNationalReports.mockResolvedValue({ success: true, data: [baseNationalReport] });
      await useDataReportStore.getState().fetchNationalReports();
      expect(useDataReportStore.getState().nationalReports).toHaveLength(1);
      expect(useDataReportStore.getState().loading).toBe(false);
    });

    it('handles API failure', async () => {
      mockFetchNationalReports.mockResolvedValue({ success: false, data: null, error: { message: '上报数据加载失败' } });
      await useDataReportStore.getState().fetchNationalReports();
      expect(useDataReportStore.getState().nationalReports).toHaveLength(0);
      expect(useDataReportStore.getState().error).toBe('上报数据加载失败');
    });

    it('handles empty data', async () => {
      mockFetchNationalReports.mockResolvedValue({ success: true, data: [] });
      await useDataReportStore.getState().fetchNationalReports();
      expect(useDataReportStore.getState().nationalReports).toHaveLength(0);
    });

    it('returns correct shape', async () => {
      mockFetchNationalReports.mockResolvedValue({ success: true, data: [baseNationalReport] });
      await useDataReportStore.getState().fetchNationalReports();
      const nr = useDataReportStore.getState().nationalReports[0];
      expect(nr).toHaveProperty('name');
      expect(nr).toHaveProperty('period');
      expect(nr).toHaveProperty('category');
      expect(nr).toHaveProperty('status');
    });

    it('sets loading state', async () => {
      let resolvePromise: (v: unknown) => void;
      mockFetchNationalReports.mockReturnValue(new Promise((r) => { resolvePromise = r; }));
      const promise = useDataReportStore.getState().fetchNationalReports();
      expect(useDataReportStore.getState().loading).toBe(true);
      resolvePromise!({ success: true, data: [baseNationalReport] });
      await promise;
      expect(useDataReportStore.getState().loading).toBe(false);
    });
  });

  describe('fetchDataReports', () => {
    it('loads data reports', async () => {
      mockFetchDataReports.mockResolvedValue({ success: true, data: [baseDataReport] });
      await useDataReportStore.getState().fetchDataReports();
      expect(useDataReportStore.getState().dataReports).toHaveLength(1);
      expect(useDataReportStore.getState().dataReports[0].name).toBe('放射诊疗工作量统计');
    });

    it('handles API failure', async () => {
      mockFetchDataReports.mockResolvedValue({ success: false, data: null, error: { message: '数据报告加载失败' } });
      await useDataReportStore.getState().fetchDataReports();
      expect(useDataReportStore.getState().dataReports).toHaveLength(0);
      expect(useDataReportStore.getState().error).toBe('数据报告加载失败');
    });

    it('handles empty data', async () => {
      mockFetchDataReports.mockResolvedValue({ success: true, data: [] });
      await useDataReportStore.getState().fetchDataReports();
      expect(useDataReportStore.getState().dataReports).toHaveLength(0);
    });

    it('returns correct shape', async () => {
      mockFetchDataReports.mockResolvedValue({ success: true, data: [baseDataReport] });
      await useDataReportStore.getState().fetchDataReports();
      const dr = useDataReportStore.getState().dataReports[0];
      expect(dr).toHaveProperty('name');
      expect(dr).toHaveProperty('category');
      expect(dr).toHaveProperty('metrics');
      expect(dr).toHaveProperty('period');
    });

    it('handles network error', async () => {
      mockFetchDataReports.mockRejectedValue(new Error('网络异常'));
      await useDataReportStore.getState().fetchDataReports();
      expect(useDataReportStore.getState().error).toBe('网络异常');
    });

    it('filters by category', async () => {
      mockFetchDataReports.mockResolvedValue({ success: true, data: [baseDataReport] });
      await useDataReportStore.getState().fetchDataReports({ category: 'workload' });
      expect(mockFetchDataReports).toHaveBeenCalledWith({ category: 'workload' });
    });

    it('filters national reports by period', async () => {
      mockFetchNationalReports.mockResolvedValue({ success: true, data: [baseNationalReport] });
      await useDataReportStore.getState().fetchNationalReports({ period: '2026-06' });
      expect(mockFetchNationalReports).toHaveBeenCalledWith({ period: '2026-06' });
    });

    it('handles multiple national reports', async () => {
      const reports = [baseNationalReport, { ...baseNationalReport, id: 'nr-2', period: '2026-05' }];
      mockFetchNationalReports.mockResolvedValue({ success: true, data: reports });
      await useDataReportStore.getState().fetchNationalReports();
      expect(useDataReportStore.getState().nationalReports).toHaveLength(2);
    });

    it('handles multiple data reports', async () => {
      const reports = [baseDataReport, { ...baseDataReport, id: 'dr-2', name: '放射设备使用统计' }];
      mockFetchDataReports.mockResolvedValue({ success: true, data: reports });
      await useDataReportStore.getState().fetchDataReports();
      expect(useDataReportStore.getState().dataReports).toHaveLength(2);
    });

    it('handles network error on data reports', async () => {
      mockFetchDataReports.mockRejectedValue(new Error('网络异常'));
      await useDataReportStore.getState().fetchDataReports();
      expect(useDataReportStore.getState().error).toBe('网络异常');
    });

    it('filters by period', async () => {
      mockFetchDataReports.mockResolvedValue({ success: true, data: [baseDataReport] });
      await useDataReportStore.getState().fetchDataReports({ period: '2026-06' });
      expect(mockFetchDataReports).toHaveBeenCalledWith({ period: '2026-06' });
    });

    it('handles national reports with generated status', async () => {
      mockFetchNationalReports.mockResolvedValue({ success: true, data: [{ ...baseNationalReport, status: 'pending' }] });
      await useDataReportStore.getState().fetchNationalReports();
      expect(useDataReportStore.getState().nationalReports[0].status).toBe('pending');
    });

    it('preserves existing data on reload', async () => {
      mockFetchNationalReports.mockResolvedValue({ success: true, data: [baseNationalReport] });
      await useDataReportStore.getState().fetchNationalReports();
      mockFetchNationalReports.mockResolvedValue({ success: true, data: [{ ...baseNationalReport, id: 'nr-2' }] });
      await useDataReportStore.getState().fetchNationalReports();
      expect(useDataReportStore.getState().nationalReports).toHaveLength(1);
      expect(useDataReportStore.getState().nationalReports[0].id).toBe('nr-2');
    });

    it('handles network error on national reports', async () => {
      mockFetchNationalReports.mockRejectedValue(new Error('网络错误'));
      await useDataReportStore.getState().fetchNationalReports();
      expect(useDataReportStore.getState().error).toBe('网络错误');
    });

    it('sets loading state', async () => {
      let resolvePromise: (v: unknown) => void;
      mockFetchDataReports.mockReturnValue(new Promise((r) => { resolvePromise = r; }));
      const promise = useDataReportStore.getState().fetchDataReports();
      expect(useDataReportStore.getState().loading).toBe(true);
      resolvePromise!({ success: true, data: [baseDataReport] });
      await promise;
      expect(useDataReportStore.getState().loading).toBe(false);
    });
  });
});
