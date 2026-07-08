import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDentalStore } from '../dentalStore';

const { mockFetchStudies, mockFetchImplants, mockFetchAppointments, mockFetchInvoices, mockFetchInventory } = vi.hoisted(() => ({
  mockFetchStudies: vi.fn(),
  mockFetchImplants: vi.fn(),
  mockFetchAppointments: vi.fn(),
  mockFetchInvoices: vi.fn(),
  mockFetchInventory: vi.fn(),
}));

vi.mock('@services/api', () => ({
  dentalApi: {
    fetchStudies: mockFetchStudies,
    fetchImplants: mockFetchImplants,
    fetchAppointments: mockFetchAppointments,
    fetchInvoices: mockFetchInvoices,
    fetchInventory: mockFetchInventory,
  },
}));

const baseStudy = {
  id: 'ds-1', patientId: 'P001', patientName: '张三',
  modality: 'CBCT', region: '下颌骨', acquisitionDate: '2026-01-15T00:00:00.000Z',
  deviceModel: 'CS 9300', fieldOfView: '10x10', voxelSize: 0.2, fileSize: 2048576,
  imageCount: 384, quality: 'Diagnostic', indications: '智齿拔除前评估',
  referringDentist: '李医生', status: 'acquired',
  thumbnail: '', dicomPath: '/dental/ds-1', notes: '', tags: [], createdAt: '', updatedAt: '',
};

const baseImplant = { id: 'im-1', patientId: 'P001', toothNo: 36, brand: 'Straumann', model: 'BLT RC', status: 'planned' };

const baseAppointment = { id: 'apt-1', patientName: '张三', date: '2026-07-15', time: '09:00', type: '复诊', dentist: '李医生', status: 'scheduled' };

const baseInvoice = { id: 'inv-1', invoiceNo: 'INV2026001', patientName: '张三', amount: 5800, status: 'pending', createdAt: '2026-07-01T00:00:00.000Z' };

const baseMaterial = { id: 'mat-1', name: '锆块', category: 'cad', stock: 25, unit: '块', safetyStock: 10 };

describe('dentalStore', () => {
  beforeEach(() => {
    useDentalStore.setState({ studies: [], implants: [], appointments: [], invoices: [], inventory: [], loading: false, error: null });
    vi.clearAllMocks();
  });

  describe('fetchStudies', () => {
    it('loads studies from API', async () => {
      const data = [baseStudy];
      mockFetchStudies.mockResolvedValue({ success: true, data });
      await useDentalStore.getState().fetchStudies();
      expect(useDentalStore.getState().studies).toHaveLength(1);
      expect(useDentalStore.getState().studies[0].id).toBe('ds-1');
      expect(useDentalStore.getState().loading).toBe(false);
    });

    it('filters by modality when param provided', async () => {
      const data = [baseStudy];
      mockFetchStudies.mockResolvedValue({ success: true, data });
      await useDentalStore.getState().fetchStudies({ modality: 'CBCT' });
      expect(mockFetchStudies).toHaveBeenCalledWith({ modality: 'CBCT' });
    });

    it('filters by patientId when param provided', async () => {
      const data = [baseStudy];
      mockFetchStudies.mockResolvedValue({ success: true, data });
      await useDentalStore.getState().fetchStudies({ patientId: 'P001' });
      expect(mockFetchStudies).toHaveBeenCalledWith({ patientId: 'P001' });
    });

    it('limits results with pageSize param', async () => {
      const data = [baseStudy];
      mockFetchStudies.mockResolvedValue({ success: true, data });
      await useDentalStore.getState().fetchStudies({ pageSize: 10 });
      expect(mockFetchStudies).toHaveBeenCalledWith({ pageSize: 10 });
    });

    it('handles API failure', async () => {
      mockFetchStudies.mockResolvedValue({ success: false, data: null, error: { message: '影像加载失败' } });
      await useDentalStore.getState().fetchStudies();
      expect(useDentalStore.getState().studies).toHaveLength(0);
      expect(useDentalStore.getState().error).toBe('影像加载失败');
    });

    it('handles empty data', async () => {
      mockFetchStudies.mockResolvedValue({ success: true, data: [] });
      await useDentalStore.getState().fetchStudies();
      expect(useDentalStore.getState().studies).toHaveLength(0);
      expect(useDentalStore.getState().loading).toBe(false);
    });

    it('returns correct data shape', async () => {
      const data = [baseStudy];
      mockFetchStudies.mockResolvedValue({ success: true, data });
      await useDentalStore.getState().fetchStudies();
      const study = useDentalStore.getState().studies[0];
      expect(study).toHaveProperty('id');
      expect(study).toHaveProperty('patientName');
      expect(study).toHaveProperty('modality');
      expect(study).toHaveProperty('status');
      expect(study).toHaveProperty('acquisitionDate');
    });

    it('sets loading state before fetch', async () => {
      let resolvePromise: (v: unknown) => void;
      mockFetchStudies.mockReturnValue(new Promise((r) => { resolvePromise = r; }));
      const promise = useDentalStore.getState().fetchStudies();
      expect(useDentalStore.getState().loading).toBe(true);
      resolvePromise!({ success: true, data: [baseStudy] });
      await promise;
      expect(useDentalStore.getState().loading).toBe(false);
    });
  });

  describe('fetchImplants', () => {
    it('loads implants from API', async () => {
      const data = [baseImplant];
      mockFetchImplants.mockResolvedValue({ success: true, data });
      await useDentalStore.getState().fetchImplants();
      expect(useDentalStore.getState().implants).toHaveLength(1);
      expect(useDentalStore.getState().implants[0].id).toBe('im-1');
    });

    it('handles API failure', async () => {
      mockFetchImplants.mockResolvedValue({ success: false, data: null, error: { message: '种植体数据加载失败' } });
      await useDentalStore.getState().fetchImplants();
      expect(useDentalStore.getState().implants).toHaveLength(0);
      expect(useDentalStore.getState().error).toBe('种植体数据加载失败');
    });

    it('handles empty data', async () => {
      mockFetchImplants.mockResolvedValue({ success: true, data: [] });
      await useDentalStore.getState().fetchImplants();
      expect(useDentalStore.getState().implants).toHaveLength(0);
    });

    it('returns correct data shape', async () => {
      const data = [baseImplant];
      mockFetchImplants.mockResolvedValue({ success: true, data });
      await useDentalStore.getState().fetchImplants();
      const implant = useDentalStore.getState().implants[0];
      expect(implant).toHaveProperty('id');
      expect(implant).toHaveProperty('toothNo');
      expect(implant).toHaveProperty('brand');
      expect(implant).toHaveProperty('status');
    });

    it('handles network error', async () => {
      mockFetchImplants.mockRejectedValue(new Error('网络异常'));
      await useDentalStore.getState().fetchImplants();
      expect(useDentalStore.getState().error).toContain('网络');
    });

    it('filters by tooth number when param provided', async () => {
      const data = [baseImplant];
      mockFetchImplants.mockResolvedValue({ success: true, data });
      await useDentalStore.getState().fetchImplants({ toothNo: 36 });
      expect(mockFetchImplants).toHaveBeenCalledWith({ toothNo: 36 });
    });
  });

  describe('fetchAppointments', () => {
    it('loads appointments from API', async () => {
      const data = [baseAppointment];
      mockFetchAppointments.mockResolvedValue({ success: true, data });
      await useDentalStore.getState().fetchAppointments();
      expect(useDentalStore.getState().appointments).toHaveLength(1);
      expect(useDentalStore.getState().appointments[0].id).toBe('apt-1');
    });

    it('handles API failure', async () => {
      mockFetchAppointments.mockResolvedValue({ success: false, data: null, error: { message: '预约加载失败' } });
      await useDentalStore.getState().fetchAppointments();
      expect(useDentalStore.getState().appointments).toHaveLength(0);
      expect(useDentalStore.getState().error).toBe('预约加载失败');
    });

    it('handles empty appointments', async () => {
      mockFetchAppointments.mockResolvedValue({ success: true, data: [] });
      await useDentalStore.getState().fetchAppointments();
      expect(useDentalStore.getState().appointments).toHaveLength(0);
    });

    it('returns correct data shape', async () => {
      const data = [baseAppointment];
      mockFetchAppointments.mockResolvedValue({ success: true, data });
      await useDentalStore.getState().fetchAppointments();
      const apt = useDentalStore.getState().appointments[0];
      expect(apt).toHaveProperty('patientName');
      expect(apt).toHaveProperty('date');
      expect(apt).toHaveProperty('time');
      expect(apt).toHaveProperty('dentist');
      expect(apt).toHaveProperty('status');
    });

    it('filters by date range when params provided', async () => {
      mockFetchAppointments.mockResolvedValue({ success: true, data: [baseAppointment] });
      await useDentalStore.getState().fetchAppointments({ startDate: '2026-07-01', endDate: '2026-07-31' });
      expect(mockFetchAppointments).toHaveBeenCalledWith({ startDate: '2026-07-01', endDate: '2026-07-31' });
    });

    it('handles appointments with different statuses', async () => {
      mockFetchAppointments.mockResolvedValue({ success: true, data: [{ ...baseAppointment, status: 'completed' }] });
      await useDentalStore.getState().fetchAppointments();
      expect(useDentalStore.getState().appointments[0].status).toBe('completed');
    });

    it('filters by dentist when param provided', async () => {
      mockFetchAppointments.mockResolvedValue({ success: true, data: [baseAppointment] });
      await useDentalStore.getState().fetchAppointments({ dentist: '李医生' });
      expect(mockFetchAppointments).toHaveBeenCalledWith({ dentist: '李医生' });
    });

    it('handles network error', async () => {
      mockFetchAppointments.mockRejectedValue(new Error('网络异常'));
      await useDentalStore.getState().fetchAppointments();
      expect(useDentalStore.getState().error).toContain('网络');
    });
  });

  describe('fetchInvoices', () => {
    it('loads invoices from API', async () => {
      const data = [baseInvoice];
      mockFetchInvoices.mockResolvedValue({ success: true, data });
      await useDentalStore.getState().fetchInvoices();
      expect(useDentalStore.getState().invoices).toHaveLength(1);
      expect(useDentalStore.getState().invoices[0].invoiceNo).toBe('INV2026001');
    });

    it('handles API failure', async () => {
      mockFetchInvoices.mockResolvedValue({ success: false, data: null, error: { message: '账单加载失败' } });
      await useDentalStore.getState().fetchInvoices();
      expect(useDentalStore.getState().invoices).toHaveLength(0);
      expect(useDentalStore.getState().error).toBe('账单加载失败');
    });

    it('handles empty invoices', async () => {
      mockFetchInvoices.mockResolvedValue({ success: true, data: [] });
      await useDentalStore.getState().fetchInvoices();
      expect(useDentalStore.getState().invoices).toHaveLength(0);
    });

    it('returns correct data shape', async () => {
      const data = [baseInvoice];
      mockFetchInvoices.mockResolvedValue({ success: true, data });
      await useDentalStore.getState().fetchInvoices();
      const inv = useDentalStore.getState().invoices[0];
      expect(inv).toHaveProperty('invoiceNo');
      expect(inv).toHaveProperty('amount');
      expect(inv).toHaveProperty('status');
      expect(inv).toHaveProperty('createdAt');
    });

    it('handles network error', async () => {
      mockFetchInvoices.mockRejectedValue(new Error('网络错误'));
      await useDentalStore.getState().fetchInvoices();
      expect(useDentalStore.getState().error).toContain('网络');
    });

    it('filters by status when param provided', async () => {
      mockFetchInvoices.mockResolvedValue({ success: true, data: [baseInvoice] });
      await useDentalStore.getState().fetchInvoices({ status: 'pending' });
      expect(mockFetchInvoices).toHaveBeenCalledWith({ status: 'pending' });
    });

    it('filters by date range for invoices', async () => {
      mockFetchInvoices.mockResolvedValue({ success: true, data: [baseInvoice] });
      await useDentalStore.getState().fetchInvoices({ startDate: '2026-07-01', endDate: '2026-07-31' });
      expect(mockFetchInvoices).toHaveBeenCalledWith({ startDate: '2026-07-01', endDate: '2026-07-31' });
    });
  });

  describe('fetchInventory', () => {
    it('loads inventory from API', async () => {
      const data = [baseMaterial];
      mockFetchInventory.mockResolvedValue({ success: true, data });
      await useDentalStore.getState().fetchInventory();
      expect(useDentalStore.getState().inventory).toHaveLength(1);
      expect(useDentalStore.getState().inventory[0].name).toBe('锆块');
    });

    it('handles API failure', async () => {
      mockFetchInventory.mockResolvedValue({ success: false, data: null, error: { message: '库存加载失败' } });
      await useDentalStore.getState().fetchInventory();
      expect(useDentalStore.getState().inventory).toHaveLength(0);
      expect(useDentalStore.getState().error).toBe('库存加载失败');
    });

    it('handles empty inventory', async () => {
      mockFetchInventory.mockResolvedValue({ success: true, data: [] });
      await useDentalStore.getState().fetchInventory();
      expect(useDentalStore.getState().inventory).toHaveLength(0);
    });

    it('returns correct data shape', async () => {
      const data = [{ ...baseMaterial, stock: 25, safetyStock: 10 }];
      mockFetchInventory.mockResolvedValue({ success: true, data });
      await useDentalStore.getState().fetchInventory();
      const mat = useDentalStore.getState().inventory[0];
      expect(mat).toHaveProperty('name');
      expect(mat).toHaveProperty('category');
      expect(mat).toHaveProperty('stock');
      expect(mat).toHaveProperty('safetyStock');
    });

    it('filters by category when param provided', async () => {
      mockFetchInventory.mockResolvedValue({ success: true, data: [baseMaterial] });
      await useDentalStore.getState().fetchInventory({ category: 'cad' });
      expect(mockFetchInventory).toHaveBeenCalledWith({ category: 'cad' });
    });

    it('handles network error on inventory fetch', async () => {
      mockFetchInventory.mockRejectedValue(new Error('网络错误'));
      await useDentalStore.getState().fetchInventory();
      expect(useDentalStore.getState().error).toBe('网络错误');
    });

    it('sets loading before fetch', async () => {
      let resolvePromise: (v: unknown) => void;
      mockFetchInventory.mockReturnValue(new Promise((r) => { resolvePromise = r; }));
      const promise = useDentalStore.getState().fetchInventory();
      expect(useDentalStore.getState().loading).toBe(true);
      resolvePromise!({ success: true, data: [baseMaterial] });
      await promise;
      expect(useDentalStore.getState().loading).toBe(false);
    });

    it('handles studies with segments', async () => {
      const studyWithSegments = { ...baseStudy, segments: [{ id: 'seg-1', type: 'nerve', label: '下牙槽神经', volume: 0.5, color: '#ff0000' }] };
      mockFetchStudies.mockResolvedValue({ success: true, data: [studyWithSegments] });
      await useDentalStore.getState().fetchStudies();
      const study = useDentalStore.getState().studies[0];
      expect(study.segments).toHaveLength(1);
      expect(study.segments![0].type).toBe('nerve');
    });

    it('handles studies with AI analysis', async () => {
      const studyWithAi = { ...baseStudy, aiAnalysis: { cariesDetected: 2, boneLossLevel: 'moderate', periapicalLesions: 1, confidence: 0.92, modelVersion: 'v3.2' } };
      mockFetchStudies.mockResolvedValue({ success: true, data: [studyWithAi] });
      await useDentalStore.getState().fetchStudies();
      const study = useDentalStore.getState().studies[0];
      expect(study.aiAnalysis).toBeTruthy();
      expect(study.aiAnalysis!.cariesDetected).toBe(2);
    });

    it('handles studies with measurements', async () => {
      const studyWithMeas = { ...baseStudy, measurements: [{ id: 'm-1', type: 'distance', label: '牙槽嵴高度', value: 12.5, unit: 'mm' }] };
      mockFetchStudies.mockResolvedValue({ success: true, data: [studyWithMeas] });
      await useDentalStore.getState().fetchStudies();
      const study = useDentalStore.getState().studies[0];
      expect(study.measurements).toHaveLength(1);
      expect(study.measurements![0].value).toBe(12.5);
    });

    it('handles multiple studies in response', async () => {
      const data = [baseStudy, { ...baseStudy, id: 'ds-2', patientName: '李四' }];
      mockFetchStudies.mockResolvedValue({ success: true, data });
      await useDentalStore.getState().fetchStudies();
      expect(useDentalStore.getState().studies).toHaveLength(2);
    });

    it('handles studies with all statuses', async () => {
      const statuses = ['acquired', 'reviewed', 'reported', 'archived'];
      for (const status of statuses) {
        mockFetchStudies.mockResolvedValue({ success: true, data: [{ ...baseStudy, status }] });
        await useDentalStore.getState().fetchStudies();
        expect(useDentalStore.getState().studies[0].status).toBe(status);
      }
    });

  });
});
