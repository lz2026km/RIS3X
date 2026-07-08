import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useQcStore } from '../qcStore';

const { mockFetchQcDashboard, mockFetchQcImages, mockReportQcDefect } = vi.hoisted(() => ({
  mockFetchQcDashboard: vi.fn(),
  mockFetchQcImages: vi.fn(),
  mockReportQcDefect: vi.fn(),
}));

vi.mock('@services/api', () => ({
  qcApi: {
    fetchQcDashboard: mockFetchQcDashboard,
    fetchQcImages: mockFetchQcImages,
    reportQcDefect: mockReportQcDefect,
  },
}));

const baseDashboard = { totalReviewed: 1280, passCount: 1180, rejectCount: 100, passRate: 92.2, pendingReview: 45 };
const baseQcImage = { id: 'img-1', examId: 'ex-1', patientName: '张三', modality: 'CT', bodyPart: '胸部', quality: 'good', reviewedBy: '王芳', reviewedAt: '2026-07-01T00:00:00.000Z' };

describe('qcStore', () => {
  beforeEach(() => {
    useQcStore.setState({ dashboard: null, qcImages: [], loading: false, error: null, defectReported: false });
    vi.clearAllMocks();
  });

  describe('fetchQcDashboard', () => {
    it('loads dashboard', async () => {
      mockFetchQcDashboard.mockResolvedValue({ success: true, data: baseDashboard });
      await useQcStore.getState().fetchQcDashboard();
      expect(useQcStore.getState().dashboard).toBeTruthy();
      expect(useQcStore.getState().dashboard!.passRate).toBe(92.2);
      expect(useQcStore.getState().loading).toBe(false);
    });

    it('handles API failure', async () => {
      mockFetchQcDashboard.mockResolvedValue({ success: false, data: null, error: { message: '质控面板加载失败' } });
      await useQcStore.getState().fetchQcDashboard();
      expect(useQcStore.getState().dashboard).toBeNull();
      expect(useQcStore.getState().error).toBe('质控面板加载失败');
    });

    it('returns correct shape', async () => {
      mockFetchQcDashboard.mockResolvedValue({ success: true, data: baseDashboard });
      await useQcStore.getState().fetchQcDashboard();
      const d = useQcStore.getState().dashboard!;
      expect(d).toHaveProperty('totalReviewed');
      expect(d).toHaveProperty('passCount');
      expect(d).toHaveProperty('rejectCount');
      expect(d).toHaveProperty('passRate');
    });

    it('sets loading state', async () => {
      let resolvePromise: (v: unknown) => void;
      mockFetchQcDashboard.mockReturnValue(new Promise((r) => { resolvePromise = r; }));
      const promise = useQcStore.getState().fetchQcDashboard();
      expect(useQcStore.getState().loading).toBe(true);
      resolvePromise!({ success: true, data: baseDashboard });
      await promise;
      expect(useQcStore.getState().loading).toBe(false);
    });
  });

  describe('fetchQcImages', () => {
    it('loads QC images', async () => {
      mockFetchQcImages.mockResolvedValue({ success: true, data: [baseQcImage] });
      await useQcStore.getState().fetchQcImages();
      expect(useQcStore.getState().qcImages).toHaveLength(1);
      expect(useQcStore.getState().qcImages[0].patientName).toBe('张三');
    });

    it('handles API failure', async () => {
      mockFetchQcImages.mockResolvedValue({ success: false, data: null, error: { message: '影像质控列表加载失败' } });
      await useQcStore.getState().fetchQcImages();
      expect(useQcStore.getState().qcImages).toHaveLength(0);
      expect(useQcStore.getState().error).toBe('影像质控列表加载失败');
    });

    it('handles empty images', async () => {
      mockFetchQcImages.mockResolvedValue({ success: true, data: [] });
      await useQcStore.getState().fetchQcImages();
      expect(useQcStore.getState().qcImages).toHaveLength(0);
    });

    it('returns correct shape', async () => {
      mockFetchQcImages.mockResolvedValue({ success: true, data: [baseQcImage] });
      await useQcStore.getState().fetchQcImages();
      const img = useQcStore.getState().qcImages[0];
      expect(img).toHaveProperty('examId');
      expect(img).toHaveProperty('quality');
      expect(img).toHaveProperty('reviewedBy');
    });
  });

  describe('reportQcDefect', () => {
    it('reports a defect', async () => {
      mockReportQcDefect.mockResolvedValue({ success: true, data: null });
      await useQcStore.getState().reportQcDefect('ex-1', '影像模糊', 'motion');
      expect(useQcStore.getState().defectReported).toBe(true);
    });

    it('handles report defect failure', async () => {
      mockReportQcDefect.mockResolvedValue({ success: false, data: null, error: { message: '缺陷上报失败' } });
      await useQcStore.getState().reportQcDefect('ex-1', '伪影', 'artifact');
      expect(useQcStore.getState().defectReported).toBe(false);
      expect(useQcStore.getState().error).toBe('缺陷上报失败');
    });

    it('handles network error', async () => {
      mockReportQcDefect.mockRejectedValue(new Error('网络异常'));
      await useQcStore.getState().reportQcDefect('ex-1', 'test', 'other');
      expect(useQcStore.getState().error).toBe('网络异常');
    });

    it('handles empty QC images', async () => {
      mockFetchQcImages.mockResolvedValue({ success: true, data: [] });
      await useQcStore.getState().fetchQcImages();
      expect(useQcStore.getState().qcImages).toHaveLength(0);
    });

    it('handles network error on QC images', async () => {
      mockFetchQcImages.mockRejectedValue(new Error('网络错误'));
      await useQcStore.getState().fetchQcImages();
      expect(useQcStore.getState().error).toBe('网络错误');
    });

    it('sets loading during QC images fetch', async () => {
      let resolvePromise: (v: unknown) => void;
      mockFetchQcImages.mockReturnValue(new Promise((r) => { resolvePromise = r; }));
      const promise = useQcStore.getState().fetchQcImages();
      expect(useQcStore.getState().loading).toBe(true);
      resolvePromise!({ success: true, data: [baseQcImage] });
      await promise;
      expect(useQcStore.getState().loading).toBe(false);
    });

    it('sets loading during defect report', async () => {
      let resolvePromise: (v: unknown) => void;
      mockReportQcDefect.mockReturnValue(new Promise((r) => { resolvePromise = r; }));
      const promise = useQcStore.getState().reportQcDefect('ex-1', 'test', 'other');
      expect(useQcStore.getState().loading).toBe(true);
      resolvePromise!({ success: true, data: null });
      await promise;
      expect(useQcStore.getState().loading).toBe(false);
    });

    it('resets defectReported on new fetch', async () => {
      useQcStore.setState({ defectReported: true });
      mockFetchQcDashboard.mockResolvedValue({ success: true, data: baseDashboard });
      await useQcStore.getState().fetchQcDashboard();
      expect(useQcStore.getState().defectReported).toBe(false);
    });
  });
});
