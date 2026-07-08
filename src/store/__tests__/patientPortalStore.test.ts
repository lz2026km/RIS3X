import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePatientPortalStore } from '../patientPortalStore';

const { mockFetchPortalPatients, mockFetchClinicalData } = vi.hoisted(() => ({
  mockFetchPortalPatients: vi.fn(),
  mockFetchClinicalData: vi.fn(),
}));

vi.mock('@services/api', () => ({
  portalApi: {
    fetchPortalPatients: mockFetchPortalPatients,
    fetchClinicalData: mockFetchClinicalData,
  },
}));

const basePatient = { id: 'pt-1', name: '张三', gender: '男', age: 45, idCard: '110101199001011234', phone: '13800138000', lastVisit: '2026-07-01T00:00:00.000Z' };
const baseClinical = { id: 'cl-1', patientId: 'pt-1', patientName: '张三', diagnosis: '肺结节', modality: 'CT', examDate: '2026-07-01T00:00:00.000Z', reportStatus: '已发布' };

describe('patientPortalStore', () => {
  beforeEach(() => {
    usePatientPortalStore.setState({ portalPatients: [], clinicalData: [], loading: false, error: null });
    vi.clearAllMocks();
  });

  describe('fetchPortalPatients', () => {
    it('loads portal patients', async () => {
      mockFetchPortalPatients.mockResolvedValue({ success: true, data: [basePatient] });
      await usePatientPortalStore.getState().fetchPortalPatients();
      expect(usePatientPortalStore.getState().portalPatients).toHaveLength(1);
      expect(usePatientPortalStore.getState().loading).toBe(false);
    });

    it('handles API failure', async () => {
      mockFetchPortalPatients.mockResolvedValue({ success: false, data: null, error: { message: '患者加载失败' } });
      await usePatientPortalStore.getState().fetchPortalPatients();
      expect(usePatientPortalStore.getState().portalPatients).toHaveLength(0);
      expect(usePatientPortalStore.getState().error).toBe('患者加载失败');
    });

    it('returns correct shape', async () => {
      mockFetchPortalPatients.mockResolvedValue({ success: true, data: [basePatient] });
      await usePatientPortalStore.getState().fetchPortalPatients();
      const p = usePatientPortalStore.getState().portalPatients[0];
      expect(p).toHaveProperty('name');
      expect(p).toHaveProperty('gender');
      expect(p).toHaveProperty('age');
      expect(p).toHaveProperty('phone');
    });
  });

  describe('fetchClinicalData', () => {
    it('loads clinical data', async () => {
      mockFetchClinicalData.mockResolvedValue({ success: true, data: [baseClinical] });
      await usePatientPortalStore.getState().fetchClinicalData('pt-1');
      expect(usePatientPortalStore.getState().clinicalData).toHaveLength(1);
      expect(usePatientPortalStore.getState().clinicalData[0].diagnosis).toBe('肺结节');
    });

    it('filters patients by search term', async () => {
      mockFetchPortalPatients.mockResolvedValue({ success: true, data: [basePatient] });
      await usePatientPortalStore.getState().fetchPortalPatients({ search: '张三' });
      expect(mockFetchPortalPatients).toHaveBeenCalledWith({ search: '张三' });
    });

    it('handles network error on patient fetch', async () => {
      mockFetchPortalPatients.mockRejectedValue(new Error('网络错误'));
      await usePatientPortalStore.getState().fetchPortalPatients();
      expect(usePatientPortalStore.getState().error).toBe('网络错误');
    });

    it('sets loading on patient fetch', async () => {
      let resolvePromise: (v: unknown) => void;
      mockFetchPortalPatients.mockReturnValue(new Promise((r) => { resolvePromise = r; }));
      const promise = usePatientPortalStore.getState().fetchPortalPatients();
      expect(usePatientPortalStore.getState().loading).toBe(true);
      resolvePromise!({ success: true, data: [basePatient] });
      await promise;
      expect(usePatientPortalStore.getState().loading).toBe(false);
    });

    it('handles pagination in patient fetch', async () => {
      mockFetchPortalPatients.mockResolvedValue({ success: true, data: [basePatient] });
      await usePatientPortalStore.getState().fetchPortalPatients({ page: 1, pageSize: 20 });
      expect(mockFetchPortalPatients).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
    });

    it('handles API failure', async () => {
      mockFetchClinicalData.mockResolvedValue({ success: false, data: null, error: { message: '临床数据加载失败' } });
      await usePatientPortalStore.getState().fetchClinicalData('pt-1');
      expect(usePatientPortalStore.getState().clinicalData).toHaveLength(0);
      expect(usePatientPortalStore.getState().error).toBe('临床数据加载失败');
    });

    it('handles empty clinical data', async () => {
      mockFetchClinicalData.mockResolvedValue({ success: true, data: [] });
      await usePatientPortalStore.getState().fetchClinicalData('pt-1');
      expect(usePatientPortalStore.getState().clinicalData).toHaveLength(0);
    });

    it('returns correct shape', async () => {
      mockFetchClinicalData.mockResolvedValue({ success: true, data: [baseClinical] });
      await usePatientPortalStore.getState().fetchClinicalData('pt-1');
      const c = usePatientPortalStore.getState().clinicalData[0];
      expect(c).toHaveProperty('diagnosis');
      expect(c).toHaveProperty('modality');
      expect(c).toHaveProperty('reportStatus');
    });

    it('handles network error', async () => {
      mockFetchClinicalData.mockRejectedValue(new Error('网络错误'));
      await usePatientPortalStore.getState().fetchClinicalData('pt-1');
      expect(usePatientPortalStore.getState().error).toBe('网络错误');
    });

    it('sets loading state for clinical data', async () => {
      let resolvePromise: (v: unknown) => void;
      mockFetchClinicalData.mockReturnValue(new Promise((r) => { resolvePromise = r; }));
      const promise = usePatientPortalStore.getState().fetchClinicalData('pt-1');
      expect(usePatientPortalStore.getState().loading).toBe(true);
      resolvePromise!({ success: true, data: [baseClinical] });
      await promise;
      expect(usePatientPortalStore.getState().loading).toBe(false);
    });
  });
});
