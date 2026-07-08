import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAiPlatformStore } from '../aiPlatformStore';

const { mockFetchAiModels, mockDeployAiModel } = vi.hoisted(() => ({
  mockFetchAiModels: vi.fn(),
  mockDeployAiModel: vi.fn(),
}));

vi.mock('@services/api', () => ({
  aiPlatformApi: {
    fetchAiModels: mockFetchAiModels,
    deployAiModel: mockDeployAiModel,
  },
}));

const baseModel = {
  id: 'model-1', name: '肺结节AI检测v3', version: '3.2.1', category: 'nodule',
  status: 'deployed', accuracy: 96.5, deployedAt: '2026-06-01T00:00:00.000Z',
  modelSize: '256MB', framework: 'PyTorch',
};

describe('aiPlatformStore', () => {
  beforeEach(() => {
    useAiPlatformStore.setState({ aiModels: [], loading: false, error: null });
    vi.clearAllMocks();
  });

  describe('fetchAiModels', () => {
    it('loads AI models', async () => {
      mockFetchAiModels.mockResolvedValue({ success: true, data: [baseModel] });
      await useAiPlatformStore.getState().fetchAiModels();
      expect(useAiPlatformStore.getState().aiModels).toHaveLength(1);
      expect(useAiPlatformStore.getState().loading).toBe(false);
    });

    it('handles API failure', async () => {
      mockFetchAiModels.mockResolvedValue({ success: false, data: null, error: { message: 'AI模型加载失败' } });
      await useAiPlatformStore.getState().fetchAiModels();
      expect(useAiPlatformStore.getState().aiModels).toHaveLength(0);
      expect(useAiPlatformStore.getState().error).toBe('AI模型加载失败');
    });

    it('handles empty models', async () => {
      mockFetchAiModels.mockResolvedValue({ success: true, data: [] });
      await useAiPlatformStore.getState().fetchAiModels();
      expect(useAiPlatformStore.getState().aiModels).toHaveLength(0);
    });

    it('returns correct shape', async () => {
      mockFetchAiModels.mockResolvedValue({ success: true, data: [baseModel] });
      await useAiPlatformStore.getState().fetchAiModels();
      const m = useAiPlatformStore.getState().aiModels[0];
      expect(m).toHaveProperty('name');
      expect(m).toHaveProperty('version');
      expect(m).toHaveProperty('category');
      expect(m).toHaveProperty('status');
      expect(m).toHaveProperty('accuracy');
    });

    it('sets loading state', async () => {
      let resolvePromise: (v: unknown) => void;
      mockFetchAiModels.mockReturnValue(new Promise((r) => { resolvePromise = r; }));
      const promise = useAiPlatformStore.getState().fetchAiModels();
      expect(useAiPlatformStore.getState().loading).toBe(true);
      resolvePromise!({ success: true, data: [baseModel] });
      await promise;
      expect(useAiPlatformStore.getState().loading).toBe(false);
    });
  });

  describe('deployAiModel', () => {
    it('deploys a model and updates status', async () => {
      useAiPlatformStore.setState({ aiModels: [{ ...baseModel, status: 'pending' }] });
      mockDeployAiModel.mockResolvedValue({ success: true, data: null });
      await useAiPlatformStore.getState().deployAiModel('model-1');
      expect(useAiPlatformStore.getState().aiModels[0].status).toBe('deployed');
    });

    it('handles deploy failure', async () => {
      useAiPlatformStore.setState({ aiModels: [{ ...baseModel, status: 'pending' }] });
      mockDeployAiModel.mockResolvedValue({ success: false, data: null, error: { message: '部署失败' } });
      await useAiPlatformStore.getState().deployAiModel('model-1');
      expect(useAiPlatformStore.getState().aiModels[0].status).toBe('pending');
      expect(useAiPlatformStore.getState().error).toBe('部署失败');
    });

    it('handles network error on deploy', async () => {
      useAiPlatformStore.setState({ aiModels: [{ ...baseModel, status: 'pending' }] });
      mockDeployAiModel.mockRejectedValue(new Error('网络异常'));
      await useAiPlatformStore.getState().deployAiModel('model-1');
      expect(useAiPlatformStore.getState().error).toBe('网络异常');
    });

    it('filters models by category', async () => {
      mockFetchAiModels.mockResolvedValue({ success: true, data: [baseModel] });
      await useAiPlatformStore.getState().fetchAiModels({ category: 'nodule' });
      expect(mockFetchAiModels).toHaveBeenCalledWith({ category: 'nodule' });
    });

    it('filters models by status', async () => {
      mockFetchAiModels.mockResolvedValue({ success: true, data: [baseModel] });
      await useAiPlatformStore.getState().fetchAiModels({ status: 'deployed' });
      expect(mockFetchAiModels).toHaveBeenCalledWith({ status: 'deployed' });
    });

    it('handles network error on fetch', async () => {
      mockFetchAiModels.mockRejectedValue(new Error('网络错误'));
      await useAiPlatformStore.getState().fetchAiModels();
      expect(useAiPlatformStore.getState().error).toBe('网络错误');
    });

    it('sets loading during deploy', async () => {
      useAiPlatformStore.setState({ aiModels: [{ ...baseModel, status: 'pending' }] });
      let resolvePromise: (v: unknown) => void;
      mockDeployAiModel.mockReturnValue(new Promise((r) => { resolvePromise = r; }));
      const promise = useAiPlatformStore.getState().deployAiModel('model-1');
      expect(useAiPlatformStore.getState().loading).toBe(true);
      resolvePromise!({ success: true, data: null });
      await promise;
      expect(useAiPlatformStore.getState().loading).toBe(false);
    });

    it('replaces models on reload', async () => {
      useAiPlatformStore.setState({ aiModels: [{ ...baseModel }] });
      const newModel = { ...baseModel, id: 'model-2', name: '骨折AI检测v2' };
      mockFetchAiModels.mockResolvedValue({ success: true, data: [newModel] });
      await useAiPlatformStore.getState().fetchAiModels();
      expect(useAiPlatformStore.getState().aiModels).toHaveLength(1);
      expect(useAiPlatformStore.getState().aiModels[0].name).toBe('骨折AI检测v2');
    });

    it('handles deploy with version update', async () => {
      useAiPlatformStore.setState({ aiModels: [{ ...baseModel, status: 'pending', version: '3.2.0' }] });
      const updatedModel = { ...baseModel, status: 'deployed', version: '3.2.1' };
      mockDeployAiModel.mockResolvedValue({ success: true, data: updatedModel });
      await useAiPlatformStore.getState().deployAiModel('model-1');
      expect(useAiPlatformStore.getState().aiModels[0].status).toBe('deployed');
    });

    it('handles multiple models in response', async () => {
      const models = [baseModel, { ...baseModel, id: 'model-2', name: '骨折AI检测' }];
      mockFetchAiModels.mockResolvedValue({ success: true, data: models });
      await useAiPlatformStore.getState().fetchAiModels();
      expect(useAiPlatformStore.getState().aiModels).toHaveLength(2);
    });
  });
});
