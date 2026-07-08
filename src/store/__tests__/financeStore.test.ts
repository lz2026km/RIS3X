import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFinanceStore } from '../financeStore';

const { mockFetchChargeItems, mockFetchInvoices, mockCreateInvoice, mockPayInvoice } = vi.hoisted(() => ({
  mockFetchChargeItems: vi.fn(),
  mockFetchInvoices: vi.fn(),
  mockCreateInvoice: vi.fn(),
  mockPayInvoice: vi.fn(),
}));

vi.mock('@services/api', () => ({
  financeApi: {
    fetchChargeItems: mockFetchChargeItems,
    fetchInvoices: mockFetchInvoices,
    createInvoice: mockCreateInvoice,
    payInvoice: mockPayInvoice,
  },
}));

const baseChargeItem = { id: 'ci-1', code: 'CT-CHEST', name: '胸部CT平扫', price: 580, category: 'CT', active: true };
const baseInvoice = { id: 'inv-1', invoiceNo: 'F2026001', patientName: '张三', total: 5800, status: 'unpaid', items: [baseChargeItem], createdAt: '2026-07-01T00:00:00.000Z' };

describe('financeStore', () => {
  beforeEach(() => {
    useFinanceStore.setState({ chargeItems: [], invoices: [], loading: false, error: null });
    vi.clearAllMocks();
  });

  describe('fetchChargeItems', () => {
    it('loads charge items', async () => {
      mockFetchChargeItems.mockResolvedValue({ success: true, data: [baseChargeItem] });
      await useFinanceStore.getState().fetchChargeItems();
      expect(useFinanceStore.getState().chargeItems).toHaveLength(1);
      expect(useFinanceStore.getState().loading).toBe(false);
    });

    it('handles API failure', async () => {
      mockFetchChargeItems.mockResolvedValue({ success: false, data: null, error: { message: '收费项目加载失败' } });
      await useFinanceStore.getState().fetchChargeItems();
      expect(useFinanceStore.getState().chargeItems).toHaveLength(0);
      expect(useFinanceStore.getState().error).toBe('收费项目加载失败');
    });

    it('returns correct shape', async () => {
      mockFetchChargeItems.mockResolvedValue({ success: true, data: [baseChargeItem] });
      await useFinanceStore.getState().fetchChargeItems();
      const item = useFinanceStore.getState().chargeItems[0];
      expect(item).toHaveProperty('code');
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('price');
      expect(item).toHaveProperty('category');
    });

    it('handles empty charge items', async () => {
      mockFetchChargeItems.mockResolvedValue({ success: true, data: [] });
      await useFinanceStore.getState().fetchChargeItems();
      expect(useFinanceStore.getState().chargeItems).toHaveLength(0);
    });

    it('filters by category', async () => {
      mockFetchChargeItems.mockResolvedValue({ success: true, data: [baseChargeItem] });
      await useFinanceStore.getState().fetchChargeItems({ category: 'CT' });
      expect(mockFetchChargeItems).toHaveBeenCalledWith({ category: 'CT' });
    });

    it('sets loading state', async () => {
      let resolvePromise: (v: unknown) => void;
      mockFetchChargeItems.mockReturnValue(new Promise((r) => { resolvePromise = r; }));
      const promise = useFinanceStore.getState().fetchChargeItems();
      expect(useFinanceStore.getState().loading).toBe(true);
      resolvePromise!({ success: true, data: [baseChargeItem] });
      await promise;
      expect(useFinanceStore.getState().loading).toBe(false);
    });
  });

  describe('fetchInvoices', () => {
    it('loads invoices', async () => {
      mockFetchInvoices.mockResolvedValue({ success: true, data: [baseInvoice] });
      await useFinanceStore.getState().fetchInvoices();
      expect(useFinanceStore.getState().invoices).toHaveLength(1);
      expect(useFinanceStore.getState().invoices[0].invoiceNo).toBe('F2026001');
    });

    it('handles API failure', async () => {
      mockFetchInvoices.mockResolvedValue({ success: false, data: null, error: { message: '账单加载失败' } });
      await useFinanceStore.getState().fetchInvoices();
      expect(useFinanceStore.getState().invoices).toHaveLength(0);
      expect(useFinanceStore.getState().error).toBe('账单加载失败');
    });

    it('returns correct shape', async () => {
      mockFetchInvoices.mockResolvedValue({ success: true, data: [baseInvoice] });
      await useFinanceStore.getState().fetchInvoices();
      const inv = useFinanceStore.getState().invoices[0];
      expect(inv).toHaveProperty('total');
      expect(inv).toHaveProperty('status');
      expect(inv).toHaveProperty('items');
      expect(Array.isArray(inv.items)).toBe(true);
    });

    it('handles empty invoices', async () => {
      mockFetchInvoices.mockResolvedValue({ success: true, data: [] });
      await useFinanceStore.getState().fetchInvoices();
      expect(useFinanceStore.getState().invoices).toHaveLength(0);
    });

    it('filters by status', async () => {
      mockFetchInvoices.mockResolvedValue({ success: true, data: [baseInvoice] });
      await useFinanceStore.getState().fetchInvoices({ status: 'unpaid' });
      expect(mockFetchInvoices).toHaveBeenCalledWith({ status: 'unpaid' });
    });

    it('handles network error', async () => {
      mockFetchInvoices.mockRejectedValue(new Error('网络错误'));
      await useFinanceStore.getState().fetchInvoices();
      expect(useFinanceStore.getState().error).toBe('网络错误');
    });
  });

  describe('createInvoice', () => {
    it('creates invoice and adds to list', async () => {
      const newInvoice = { ...baseInvoice, id: 'inv-2', invoiceNo: 'F2026002' };
      mockCreateInvoice.mockResolvedValue({ success: true, data: newInvoice });
      await useFinanceStore.getState().createInvoice({ patientName: '李四', items: [] });
      expect(useFinanceStore.getState().invoices).toHaveLength(1);
      expect(useFinanceStore.getState().invoices[0].invoiceNo).toBe('F2026002');
    });

    it('handles create failure', async () => {
      mockCreateInvoice.mockResolvedValue({ success: false, data: null, error: { message: '创建账单失败' } });
      await useFinanceStore.getState().createInvoice({ patientName: '李四', items: [] });
      expect(useFinanceStore.getState().error).toBe('创建账单失败');
    });

    it('handles network error', async () => {
      mockCreateInvoice.mockRejectedValue(new Error('网络异常'));
      await useFinanceStore.getState().createInvoice({ patientName: 'test' });
      expect(useFinanceStore.getState().error).toBe('网络异常');
    });
  });

  describe('payInvoice', () => {
    it('marks invoice as paid', async () => {
      useFinanceStore.setState({ invoices: [{ ...baseInvoice }] });
      mockPayInvoice.mockResolvedValue({ success: true, data: null });
      await useFinanceStore.getState().payInvoice('inv-1', 'CASH');
      expect(useFinanceStore.getState().invoices[0].status).toBe('paid');
    });

    it('handles pay failure', async () => {
      useFinanceStore.setState({ invoices: [{ ...baseInvoice }] });
      mockPayInvoice.mockResolvedValue({ success: false, data: null, error: { message: '支付失败' } });
      await useFinanceStore.getState().payInvoice('inv-1', 'CASH');
      expect(useFinanceStore.getState().invoices[0].status).toBe('unpaid');
      expect(useFinanceStore.getState().error).toBe('支付失败');
    });

    it('sets loading during pay', async () => {
      useFinanceStore.setState({ invoices: [{ ...baseInvoice }] });
      let resolvePromise: (v: unknown) => void;
      mockPayInvoice.mockReturnValue(new Promise((r) => { resolvePromise = r; }));
      const promise = useFinanceStore.getState().payInvoice('inv-1', 'CASH');
      expect(useFinanceStore.getState().loading).toBe(true);
      resolvePromise!({ success: true, data: null });
      await promise;
      expect(useFinanceStore.getState().loading).toBe(false);
    });

    it('handles pay with different payment method', async () => {
      useFinanceStore.setState({ invoices: [{ ...baseInvoice }] });
      mockPayInvoice.mockResolvedValue({ success: true, data: null });
      await useFinanceStore.getState().payInvoice('inv-1', 'WECHAT');
      expect(mockPayInvoice).toHaveBeenCalledWith('inv-1', 'WECHAT');
    });

    it('replaces invoices on reload', async () => {
      useFinanceStore.setState({ invoices: [{ ...baseInvoice }] });
      const newInvoice = { ...baseInvoice, id: 'inv-3', invoiceNo: 'F2026003' };
      mockFetchInvoices.mockResolvedValue({ success: true, data: [newInvoice] });
      await useFinanceStore.getState().fetchInvoices();
      expect(useFinanceStore.getState().invoices).toHaveLength(1);
      expect(useFinanceStore.getState().invoices[0].invoiceNo).toBe('F2026003');
    });
  });
});
