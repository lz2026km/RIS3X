import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCosignStore } from '../cosignStore';

const { mockFetchPendingCosigns, mockApproveCosign, mockRejectCosign } = vi.hoisted(() => ({
  mockFetchPendingCosigns: vi.fn(),
  mockApproveCosign: vi.fn(),
  mockRejectCosign: vi.fn(),
}));

vi.mock('@services/api', () => ({
  cosignApi: {
    fetchPendingCosigns: mockFetchPendingCosigns,
    approveCosign: mockApproveCosign,
    rejectCosign: mockRejectCosign,
  },
}));

const baseCosign = {
  id: 'cs-1', reportId: 'rpt-1', patientName: '张三', examId: 'ex-1',
  modality: 'CT', bodyPart: '胸部', writer: '李明', writerId: 'doc-1',
  status: 'pending', createdAt: '2026-07-01T00:00:00.000Z',
};

describe('cosignStore', () => {
  beforeEach(() => {
    useCosignStore.setState({ pendingCosigns: [], loading: false, error: null });
    vi.clearAllMocks();
  });

  describe('fetchPendingCosigns', () => {
    it('loads pending cosigns', async () => {
      mockFetchPendingCosigns.mockResolvedValue({ success: true, data: [baseCosign] });
      await useCosignStore.getState().fetchPendingCosigns();
      expect(useCosignStore.getState().pendingCosigns).toHaveLength(1);
      expect(useCosignStore.getState().pendingCosigns[0].id).toBe('cs-1');
      expect(useCosignStore.getState().loading).toBe(false);
    });

    it('filters cosigns by modality', async () => {
      mockFetchPendingCosigns.mockResolvedValue({ success: true, data: [baseCosign] });
      await useCosignStore.getState().fetchPendingCosigns({ modality: 'CT' });
      expect(mockFetchPendingCosigns).toHaveBeenCalledWith({ modality: 'CT' });
    });

    it('filters cosigns by writer', async () => {
      mockFetchPendingCosigns.mockResolvedValue({ success: true, data: [baseCosign] });
      await useCosignStore.getState().fetchPendingCosigns({ writer: '李明' });
      expect(mockFetchPendingCosigns).toHaveBeenCalledWith({ writer: '李明' });
    });

    it('handles API failure', async () => {
      mockFetchPendingCosigns.mockResolvedValue({ success: false, data: null, error: { message: '双签列表加载失败' } });
      await useCosignStore.getState().fetchPendingCosigns();
      expect(useCosignStore.getState().pendingCosigns).toHaveLength(0);
      expect(useCosignStore.getState().error).toBe('双签列表加载失败');
    });

    it('handles empty data', async () => {
      mockFetchPendingCosigns.mockResolvedValue({ success: true, data: [] });
      await useCosignStore.getState().fetchPendingCosigns();
      expect(useCosignStore.getState().pendingCosigns).toHaveLength(0);
    });

    it('returns correct shape', async () => {
      mockFetchPendingCosigns.mockResolvedValue({ success: true, data: [baseCosign] });
      await useCosignStore.getState().fetchPendingCosigns();
      const c = useCosignStore.getState().pendingCosigns[0];
      expect(c).toHaveProperty('reportId');
      expect(c).toHaveProperty('patientName');
      expect(c).toHaveProperty('modality');
      expect(c).toHaveProperty('status');
    });

    it('sets loading state', async () => {
      let resolvePromise: (v: unknown) => void;
      mockFetchPendingCosigns.mockReturnValue(new Promise((r) => { resolvePromise = r; }));
      const promise = useCosignStore.getState().fetchPendingCosigns();
      expect(useCosignStore.getState().loading).toBe(true);
      resolvePromise!({ success: true, data: [baseCosign] });
      await promise;
      expect(useCosignStore.getState().loading).toBe(false);
    });

    it('handles network error', async () => {
      mockFetchPendingCosigns.mockRejectedValue(new Error('网络异常'));
      await useCosignStore.getState().fetchPendingCosigns();
      expect(useCosignStore.getState().error).toContain('网络');
    });
  });

  describe('approveCosign', () => {
    it('approves and updates status', async () => {
      useCosignStore.setState({ pendingCosigns: [{ ...baseCosign }] });
      mockApproveCosign.mockResolvedValue({ success: true, data: null });
      await useCosignStore.getState().approveCosign('cs-1', 'approve comment');
      expect(useCosignStore.getState().pendingCosigns[0].status).toBe('approved');
      expect(useCosignStore.getState().error).toBeNull();
    });

    it('handles approve failure', async () => {
      useCosignStore.setState({ pendingCosigns: [{ ...baseCosign }] });
      mockApproveCosign.mockResolvedValue({ success: false, data: null, error: { message: '双签通过失败' } });
      await useCosignStore.getState().approveCosign('cs-1', 'ok');
      expect(useCosignStore.getState().error).toBe('双签通过失败');
    });

    it('handles network error on approve', async () => {
      useCosignStore.setState({ pendingCosigns: [{ ...baseCosign }] });
      mockApproveCosign.mockRejectedValue(new Error('网络错误'));
      await useCosignStore.getState().approveCosign('cs-1', 'ok');
      expect(useCosignStore.getState().error).toBe('网络错误');
    });
  });

  describe('rejectCosign', () => {
    it('rejects and updates status', async () => {
      useCosignStore.setState({ pendingCosigns: [{ ...baseCosign }] });
      mockRejectCosign.mockResolvedValue({ success: true, data: null });
      await useCosignStore.getState().rejectCosign('cs-1', '影像质量不足');
      expect(useCosignStore.getState().pendingCosigns[0].status).toBe('rejected');
      expect(useCosignStore.getState().error).toBeNull();
    });

    it('handles reject failure', async () => {
      useCosignStore.setState({ pendingCosigns: [{ ...baseCosign }] });
      mockRejectCosign.mockResolvedValue({ success: false, data: null, error: { message: '双签驳回失败' } });
      await useCosignStore.getState().rejectCosign('cs-1', '原因');
      expect(useCosignStore.getState().error).toBe('双签驳回失败');
    });

    it('handles network error on reject', async () => {
      useCosignStore.setState({ pendingCosigns: [{ ...baseCosign }] });
      mockRejectCosign.mockRejectedValue(new Error('网络异常'));
      await useCosignStore.getState().rejectCosign('cs-1', '原因');
      expect(useCosignStore.getState().error).toBe('网络异常');
    });

    it('sets loading during reject', async () => {
      useCosignStore.setState({ pendingCosigns: [{ ...baseCosign }] });
      let resolvePromise: (v: unknown) => void;
      mockRejectCosign.mockReturnValue(new Promise((r) => { resolvePromise = r; }));
      const promise = useCosignStore.getState().rejectCosign('cs-1', '原因');
      expect(useCosignStore.getState().loading).toBe(true);
      resolvePromise!({ success: true, data: null });
      await promise;
      expect(useCosignStore.getState().loading).toBe(false);
    });

    it('preserves other cosigns on reject', async () => {
      useCosignStore.setState({ pendingCosigns: [{ ...baseCosign, id: 'cs-1' }, { ...baseCosign, id: 'cs-2' }] });
      mockRejectCosign.mockResolvedValue({ success: true, data: null });
      await useCosignStore.getState().rejectCosign('cs-1', '原因');
      expect(useCosignStore.getState().pendingCosigns).toHaveLength(2);
    });

    it('sets loading during approve', async () => {
      useCosignStore.setState({ pendingCosigns: [{ ...baseCosign }] });
      let resolvePromise: (v: unknown) => void;
      mockApproveCosign.mockReturnValue(new Promise((r) => { resolvePromise = r; }));
      const promise = useCosignStore.getState().approveCosign('cs-1', 'ok');
      expect(useCosignStore.getState().loading).toBe(true);
      resolvePromise!({ success: true, data: null });
      await promise;
      expect(useCosignStore.getState().loading).toBe(false);
    });

    it('preserves other cosigns on approve', async () => {
      useCosignStore.setState({ pendingCosigns: [{ ...baseCosign, id: 'cs-1' }, { ...baseCosign, id: 'cs-2' }] });
      mockApproveCosign.mockResolvedValue({ success: true, data: null });
      await useCosignStore.getState().approveCosign('cs-1', 'ok');
      expect(useCosignStore.getState().pendingCosigns).toHaveLength(2);
    });
  });
});
