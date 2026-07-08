// [v3.0.6.8-51] PR7: 眼料 (IOL 库存 + 接触镜库) API client
// v3.0.6.11: 路径已对齐 mockBackend/eyeHandlers.ts
// eyeHandlers 只暴露 IOL inventory 的 GET, 其它写操作暂保留端点占位 (返回 404, 由前端 UI 屏蔽)
import { api } from './client';

const EYE_API = '/api/v1/eye';

// ============= IOL 库存 =============
export interface IolItemDto {
  id: string;
  barcode: string;
  model: string;        // SA60AT / SN6AT5 / PanOptix / TECNIS Symfony
  type: 'monofocal' | 'toric' | 'multifocal' | 'edof';
  power: number;        // D
  cylinder?: number;    // Toric 用
  batchNumber: string;
  expiryDate: string;
  stockLocation: string;
  status: 'in_stock' | 'reserved' | 'implanted' | 'expired' | 'recalled';
  supplier: string;
  unitPrice: number;
  createdAt: string;
}

// IOL 在 eyeHandlers.ts 只注册了 GET /api/v1/eye/iol/inventory
// 之前 materialsApi 使用的 /eye/materials/iol/* 全都不存在 → 404
// 这里只保留与现有 handler 对齐的 API,其余保留为本地存根 (返回 success/false)
export const iolApi = {
  list: (params?: { type?: string; status?: string; supplier?: string; pageSize?: number }) =>
    api.get<IolItemDto[]>(`${EYE_API}/iol/inventory${buildQuery(params)}`),

  // eyeHandlers 当前未提供以下写接口;保留前端 API 但提示
  getById: (id: string) =>
    // TODO: eyeHandlers 暂无 /eye/iol/inventory/:id
    api.get<IolItemDto>(`${EYE_API}/iol/inventory/${id}`),

  inStock: (data: Omit<IolItemDto, 'id' | 'createdAt' | 'status'>) =>
    // TODO: eyeHandlers 暂无 /eye/iol/inventory (POST)
    api.post<IolItemDto>(`${EYE_API}/iol/inventory`, data),

  outStock: (id: string, data: { reason: string; patientId?: string; surgeon?: string }) =>
    // TODO: eyeHandlers 暂无 /eye/iol/inventory/:id/out
    api.post<IolItemDto>(`${EYE_API}/iol/inventory/${id}/out`, data),

  transfer: (id: string, data: { fromLocation: string; toLocation: string }) =>
    api.post<IolItemDto>(`${EYE_API}/iol/inventory/${id}/transfer`, data),

  adjust: (id: string, data: { deltaQty: number; reason: string }) =>
    api.post<IolItemDto>(`${EYE_API}/iol/inventory/${id}/adjust`, data),

  // eyeHandlers 没有 low-stock/expiring 路径,但保留供未来对接
  getLowStock: () =>
    api.get<IolItemDto[]>(`${EYE_API}/iol/inventory/low-stock`),

  getExpiring: (days?: number) =>
    api.get<IolItemDto[]>(`${EYE_API}/iol/inventory/expiring?days=${days || 90}`),
};

// ============= 接触镜库 =============
export interface ContactLensDto {
  id: string;
  brand: string;        // 'Bausch + Lomb' / 'Johnson & Johnson' / 'Alcon'
  type: 'RGP' | 'Scleral' | 'Soft' | 'OK' | 'Hybrid';
  series: string;        // e.g. 'Boston XO' / 'Acuvue Oasys'
  bc: number;            // 基弧 (mm)
  dia: number;           // 直径 (mm)
  power: number;         // 度数 (D)
  cylinder?: number;     // 散光 (D)
  axis?: number;         // 轴位
  stock: number;
  trialLens: boolean;    // 试戴片
  unitPrice: number;
  supplier: string;
}

// 接触镜 handler 当前只暴露:
//   GET  /api/v1/eye/contact-lens/inventory
//   POST /api/v1/eye/contact-lens/fitting
// 单条 CRUD 没有 handler,以下方法保留以编译通过,实际使用会被后端 404
export const contactLensApi = {
  list: (params?: { type?: string; brand?: string; trialLens?: boolean; pageSize?: number }) =>
    api.get<ContactLensDto[]>(`${EYE_API}/contact-lens/inventory${buildQuery(params)}`),

  getById: (id: string) =>
    // TODO: handler 未注册单条读取
    api.get<ContactLensDto>(`${EYE_API}/contact-lens/inventory/${id}`),

  create: (data: Omit<ContactLensDto, 'id'>) =>
    // TODO: handler 未注册 POST /contact-lens/inventory (只有 POST /fitting)
    api.post<ContactLensDto>(`${EYE_API}/contact-lens/inventory`, data),

  update: (id: string, data: Partial<ContactLensDto>) =>
    // TODO
    api.put<ContactLensDto>(`${EYE_API}/contact-lens/inventory/${id}`, data),

  delete: (id: string) =>
    // TODO
    api.delete(`${EYE_API}/contact-lens/inventory/${id}`),

  fitting: (_id: string, data: { patientId: string; fittingData: any }) =>
    // eyeHandlers 的 /contact-lens/fitting 不需要 id 参数,但保留以兼容调用方
    api.post<{ fittingId: string; result: string }>(`${EYE_API}/contact-lens/fitting`, data),

  // OK 镜/角膜塑形镜特殊接口 (eyeHandlers 无 optometry 路由,这里做兼容保留)
  okLensDesign: (data: { patientId: string; k1: number; k2: number; kAxis: number; targetReduction: number; brand?: string }) =>
    // TODO: eyeHandlers 未提供 /eye/optometry/ok-lens/design,可考虑 POST /eye/contact-lens/fitting
    api.post<{ designId: string; baseCurve: number; returnZone: number; diameter: number; brand: string }>(`${EYE_API}/optometry/ok-lens/design`, data),
};

function buildQuery(params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return '';
  const filtered = Object.entries(params).filter(([_, v]) => v !== undefined && v !== '');
  if (filtered.length === 0) return '';
  return '?' + new URLSearchParams(filtered as [string, string][]).toString();
}
