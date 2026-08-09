// [v3.0.6.8-51] PR7: 眼料 (IOL 库存 + 接触镜库) API client
// v3.0.6.11: 路径已对齐 mockBackend/eyeHandlers.ts
// v3.0.6.11-21 P0: 移除冗余 `/api/v1` 前缀(由 client.ts API_BASE 在 mock 模式提供)
// [G005 Wave1B] 后端已实现全部端点 (backend/src/eye/eye.controller.ts):
//   IOL inventory (list/get/:id/in/out/transfer/adjust/low-stock/expiring) + contact-lens CRUD/fitting + ok-lens/design
import { api } from './client';

const EYE_API = '/eye';

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

// IOL 全端点后端已实现 (eye.controller: list/get/:id/in/out/transfer/adjust)
export const iolApi = {
  list: (params?: { type?: string; status?: string; supplier?: string; pageSize?: number }) =>
    api.get<IolItemDto[]>(`${EYE_API}/iol/inventory${buildQuery(params)}`),

  getById: (id: string) =>
    // [Wave1B] 后端已实现 GET /eye/iol/inventory/:id
    api.get<IolItemDto>(`${EYE_API}/iol/inventory/${id}`),

  inStock: (data: Omit<IolItemDto, 'id' | 'createdAt' | 'status'>) =>
    // [Wave1B] 后端已实现 POST /eye/iol/inventory
    api.post<IolItemDto>(`${EYE_API}/iol/inventory`, data),

  outStock: (id: string, data: { reason: string; patientId?: string; surgeon?: string }) =>
    // [Wave1B] 后端已实现 POST /eye/iol/inventory/:id/out
    api.post<IolItemDto>(`${EYE_API}/iol/inventory/${id}/out`, data),

  transfer: (id: string, data: { fromLocation: string; toLocation: string }) =>
    api.post<IolItemDto>(`${EYE_API}/iol/inventory/${id}/transfer`, data),

  adjust: (id: string, data: { deltaQty: number; reason: string }) =>
    api.post<IolItemDto>(`${EYE_API}/iol/inventory/${id}/adjust`, data),

  // [Wave1B] 后端已实现 GET /eye/iol/inventory/low-stock|expiring
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

// 接触镜全端点后端已实现 (eye.controller: inventory CRUD + fitting + optometry/ok-lens/design)
export const contactLensApi = {
  list: (params?: { type?: string; brand?: string; trialLens?: boolean; pageSize?: number }) =>
    api.get<ContactLensDto[]>(`${EYE_API}/contact-lens/inventory${buildQuery(params)}`),

  getById: (id: string) =>
    // [Wave1B] 后端已实现 GET /eye/contact-lens/inventory/:id
    api.get<ContactLensDto>(`${EYE_API}/contact-lens/inventory/${id}`),

  create: (data: Omit<ContactLensDto, 'id'>) =>
    // [Wave1B] 后端已实现 POST /eye/contact-lens/inventory
    api.post<ContactLensDto>(`${EYE_API}/contact-lens/inventory`, data),

  update: (id: string, data: Partial<ContactLensDto>) =>
    // [Wave1B] 后端已实现 PUT /eye/contact-lens/inventory/:id
    api.put<ContactLensDto>(`${EYE_API}/contact-lens/inventory/${id}`, data),

  delete: (id: string) =>
    // [Wave1B] 后端已实现 DELETE /eye/contact-lens/inventory/:id
    api.delete(`${EYE_API}/contact-lens/inventory/${id}`),

  fitting: (_id: string, data: { patientId: string; fittingData: any }) =>
    // [Wave1B] 后端 POST /eye/contact-lens/fitting 不依赖 id 参数, 保留以兼容调用方
    api.post<{ fittingId: string; result: string }>(`${EYE_API}/contact-lens/fitting`, data),

  // OK 镜/角膜塑形镜设计 (后端已实现 POST /eye/optometry/ok-lens/design)
  okLensDesign: (data: { patientId: string; k1: number; k2: number; kAxis: number; targetReduction: number; brand?: string }) =>
    // [Wave1B] 后端已实现 /eye/optometry/ok-lens/design
    api.post<{ designId: string; baseCurve: number; returnZone: number; diameter: number; brand: string }>(`${EYE_API}/optometry/ok-lens/design`, data),
};

function buildQuery(params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return '';
  const filtered = Object.entries(params).filter(([_, v]) => v !== undefined && v !== '');
  if (filtered.length === 0) return '';
  return '?' + new URLSearchParams(filtered as [string, string][]).toString();
}
