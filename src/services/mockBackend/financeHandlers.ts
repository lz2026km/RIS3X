// [v3.0.6.11-7] /api/v1/finance MSW handlers
import { http, HttpResponse, delay } from 'msw';
import { list, get, create } from './store';
import { parseQuery, applyQuery } from './queryBuilder';
import { v4 as uuidv4 } from 'uuid';

const API = '/api/v1/finance';

const delayMs = (min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min);

// ===== 财务聚合 (确定性: 无 Math.random) =====
// 收入来自发票流水; 成本按固定成本收入比确定性派生 (演示数据策略)
const COST_RATIO = 0.62;

function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

function guessModality(examItem: string): string | null {
  const s = String(examItem ?? '').toUpperCase();
  if (s.includes('MR') || s.includes('磁共振')) return 'MRI';
  if (s.includes('CT')) return 'CT';
  if (s.includes('DSA') || s.includes('造影')) return 'DSA';
  if (s.includes('MG') || s.includes('钼靶')) return 'MG';
  if (s.includes('DR') || s.includes('X线') || s.includes('拍片')) return 'DR';
  if (s.includes('US') || s.includes('超声')) return 'US';
  return null;
}

interface FinanceMonthlyPoint { month: string; amount: number; revenue: number; cost: number; profit: number; count: number }
interface FinanceModalityPoint { modality: string; revenue: number; cost: number; profit: number }
interface FinanceAggregate {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  profitMargin: number;
  insuranceTotal: number;
  selfPayTotal: number;
  monthly: FinanceMonthlyPoint[];
  byModality: FinanceModalityPoint[];
}

function aggregateFinance(invoices: any[]): FinanceAggregate {
  let totalRevenue = 0;
  let insuranceTotal = 0;
  let selfPayTotal = 0;
  const monthMap = new Map<string, { revenue: number; count: number }>();
  const modalityMap = new Map<string, number>();
  for (const inv of Array.isArray(invoices) ? invoices : []) {
    const rec = (inv ?? {}) as any;
    const amount = Number(rec.totalAmount) || 0;
    if (!(amount > 0)) continue;
    totalRevenue += amount;
    insuranceTotal += Number(rec.insurancePaid ?? rec.insuranceCovered) || 0;
    selfPayTotal += Number(rec.selfPaid ?? rec.selfPayAmount) || 0;
    const date = String(rec.issuedAt ?? rec.examDate ?? rec.createdAt ?? '');
    const month = date.slice(0, 7);
    if (month.length === 7) {
      const cur = monthMap.get(month) ?? { revenue: 0, count: 0 };
      cur.revenue += amount;
      cur.count += 1;
      monthMap.set(month, cur);
    }
    const itemName = Array.isArray(rec.items) && rec.items[0] ? String((rec.items[0] as any).itemName ?? '') : '';
    const mod = guessModality(String(rec.examItem ?? rec.examItemName ?? itemName));
    if (mod) modalityMap.set(mod, (modalityMap.get(mod) ?? 0) + amount);
  }
  const totalCost = Math.round(totalRevenue * COST_RATIO);
  const totalProfit = totalRevenue - totalCost;
  const profitMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 1000) / 10 : 0;
  const monthly = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, v]) => {
      const revenue = Math.round(v.revenue);
      const cost = Math.round(revenue * COST_RATIO);
      return { month, amount: revenue, revenue, cost, profit: revenue - cost, count: v.count };
    });
  const byModality = Array.from(modalityMap.entries())
    .map(([modality, revenue]) => {
      const r = Math.round(revenue);
      const cost = Math.round(r * COST_RATIO);
      return { modality, revenue: r, cost, profit: r - cost };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);
  return { totalRevenue, totalCost, totalProfit, profitMargin, insuranceTotal, selfPayTotal, monthly, byModality };
}

// 无发票数据时的确定性回退 (仍返回完整 DTO 形状)
function fallbackRevenue() {
  const totalRevenue = 980000;
  const totalCost = Math.round(totalRevenue * COST_RATIO);
  const totalProfit = totalRevenue - totalCost;
  const mk = (modality: string, revenue: number) => {
    const cost = Math.round(revenue * COST_RATIO);
    return { modality, revenue, cost, profit: revenue - cost };
  };
  return {
    period: currentPeriod(),
    totalRevenue,
    totalCost,
    totalProfit,
    profitMargin: Math.round((totalProfit / totalRevenue) * 1000) / 10,
    insuranceTotal: 720000,
    selfPayTotal: 260000,
    byModality: [mk('CT', 385000), mk('MRI', 235000), mk('DSA', 195000), mk('DR', 65000)],
    daily: [{ date: `${currentPeriod()}-01`, amount: 45000 }],
    monthly: [{ month: currentPeriod(), amount: totalRevenue, revenue: totalRevenue, cost: totalCost, profit: totalProfit, count: 320 }],
  };
}

export const financeHandlers = [
  http.get(`${API}/charge-items`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('chargeItems'); } catch {}
    if (!items.length) items = [{"id":"CI001","code":"CHG-001","name":"CT平扫","category":"检查","unitPrice":300,"active":true}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.post(`${API}/charge-items`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = { id: body.id || uuidv4(), ...body, createdAt: new Date().toISOString() };
    try { create('invoices', newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.get(`${API}/invoices`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('invoices'); } catch {}
    if (!items.length) items = [
      { id: 'INV001', invoiceNo: 'INV-001', patientId: 'P000001', patientName: '张明远', examItem: '头颅CT平扫', examDate: '2026-06-02', totalAmount: 300, paidAmount: 300, balance: 0, status: 'PAID', insuranceCovered: 210, selfPayAmount: 90, createdAt: '2026-06-02 16:00' },
      { id: 'INV002', invoiceNo: 'INV-002', patientId: 'P000002', patientName: '李静', examItem: '胸部CT增强', examDate: '2026-06-05', totalAmount: 850, paidAmount: 500, balance: 350, status: 'PARTIAL', insuranceCovered: 595, selfPayAmount: 255, createdAt: '2026-06-05 10:30' },
      { id: 'INV003', invoiceNo: 'INV-003', patientId: 'P000003', patientName: '王强', examItem: '腰椎MR平扫', examDate: '2026-06-08', totalAmount: 780, paidAmount: 0, balance: 780, status: 'UNPAID', insuranceCovered: 546, selfPayAmount: 234, createdAt: '2026-06-08 09:15' },
      { id: 'INV004', invoiceNo: 'INV-004', patientId: 'P043853', patientName: '叶琳', examItem: '腹部CT平扫+增强', examDate: '2026-06-11', totalAmount: 1200, paidAmount: 1200, balance: 0, status: 'PAID', insuranceCovered: 840, selfPayAmount: 360, createdAt: '2026-06-11 14:20' },
      { id: 'INV005', invoiceNo: 'INV-005', patientId: 'P001193', patientName: '何俊', examItem: '头颅MR增强', examDate: '2026-06-12', totalAmount: 1080, paidAmount: 0, balance: 1080, status: 'UNPAID', insuranceCovered: 756, selfPayAmount: 324, createdAt: '2026-06-12 08:45' },
    ];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/invoices/:id`, async ({ params }) => {
    await delay(delayMs());
    let item: any = null;
    try { item = get<any>('invoices', params.id as string); } catch {}
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: item });
  }),
  http.post(`${API}/invoices`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = { id: body.id || uuidv4(), ...body, createdAt: new Date().toISOString() };
    try { create('invoices', newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.post(`${API}/invoices/:id/pay`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = { id: body.id || uuidv4(), ...body, createdAt: new Date().toISOString() };
    try { create('invoices', newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.get(`${API}/revenue-analysis`, async () => {
    await delay(delayMs());
    let invoices: any[] = [];
    try { invoices = list<any>('invoices'); } catch {}
    const agg = aggregateFinance(invoices);
    const data = agg.monthly.length > 0
      ? { period: currentPeriod(), ...agg }
      : fallbackRevenue();
    const total = Array.isArray((data as { monthly?: unknown[] }).monthly) ? (data as { monthly: unknown[] }).monthly.length : 2;
    return HttpResponse.json({ success: true, data, meta: { total } });
  }),
  http.get(`${API}/cost-accounting`, async () => {
    await delay(delayMs());
    let invoices: any[] = [];
    try { invoices = list<any>('invoices'); } catch {}
    const agg = aggregateFinance(invoices);
    const total = agg.totalCost > 0 ? agg.totalCost : Math.round(980000 * COST_RATIO);
    const laborCost = Math.round(total * 0.38);
    const equipmentDepreciation = Math.round(total * 0.25);
    const materialCost = Math.round(total * 0.17);
    const maintenanceCost = Math.round(total * 0.11);
    const otherCost = Math.max(0, total - laborCost - equipmentDepreciation - materialCost - maintenanceCost);
    const totalRevenue = agg.totalRevenue > 0 ? agg.totalRevenue : 980000;
    const byModality = agg.byModality.length > 0
      ? agg.byModality.map(m => ({ modality: m.modality, cost: m.cost, revenue: m.revenue }))
      : [{ modality: 'CT', cost: Math.round(total * 0.6), revenue: Math.round(totalRevenue * 0.6) }];
    return HttpResponse.json({
      success: true,
      data: {
        period: currentPeriod(),
        // 文档化 DTO 字段
        laborCost, equipmentDepreciation, materialCost, maintenanceCost, otherCost, total,
        // 兼容既有字段
        byDept: [{ dept: '放射科', cost: total, revenue: totalRevenue }],
        byModality,
        totalCost: total,
        totalRevenue,
      },
      meta: { total: byModality.length + 1 },
    });
  }),
  http.get(`${API}/financial-reports`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('invoices'); } catch {}
    if (!Array.isArray(items) || !items.length) {
      return HttpResponse.json({ success: true, data: { reports: [{ id: 'FR001', type: '月度', period: '2026-07', totalRevenue: 980000 }] }, meta: { total: 1 } });
    }
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
];
