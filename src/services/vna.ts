// [ClinicalData] VNA core engine mock service
// 阶段 1.5 修复：之前文件不存在
export interface VnaNode {
  id: string;
  hostname: string;
  ip: string;
  role: "primary" | "replica" | "cache" | "edge";
  status: "online" | "offline" | "degraded";
  storageUsed: number; // GB
  storageTotal: number; // GB
  instances: number;
  studies: number;
  cacheHitRate: number; // 0-1
  ioLoad: number; // 0-1
  uptime: number; // seconds
  version: string;
}

export interface CacheMetrics {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  evictions: number;
  hitRate: number;
  avgLatencyMs: number;
  p99LatencyMs: number;
}

export interface RoutingRuleEntry {
  id: string;
  name: string;
  sourceAe: string;
  destAe: string;
  modality: string;
  active: boolean;
  matched: number;
}

const NOW = Date.now();

export const VNA_NODES: VnaNode[] = [
  { id: "VNA-001", hostname: "vna-primary-01.sdph.local", ip: "10.1.10.21", role: "primary", status: "online", storageUsed: 8420, storageTotal: 16000, instances: 482134, studies: 148523, cacheHitRate: 0.94, ioLoad: 0.42, uptime: 86400 * 32, version: "v3.0.6.8" },
  { id: "VNA-002", hostname: "vna-replica-01.sdph.local", ip: "10.1.10.22", role: "replica", status: "online", storageUsed: 8210, storageTotal: 16000, instances: 482134, studies: 148523, cacheHitRate: 0.92, ioLoad: 0.18, uptime: 86400 * 32, version: "v3.0.6.8" },
  { id: "VNA-003", hostname: "vna-replica-02.sdph.local", ip: "10.1.10.23", role: "replica", status: "online", storageUsed: 8340, storageTotal: 16000, instances: 482134, studies: 148523, cacheHitRate: 0.91, ioLoad: 0.21, uptime: 86400 * 32, version: "v3.0.6.8" },
  { id: "VNA-004", hostname: "vna-cache-oph.sdph.local", ip: "10.2.20.11", role: "cache", status: "online", storageUsed: 320, storageTotal: 1000, instances: 12842, studies: 4128, cacheHitRate: 0.88, ioLoad: 0.35, uptime: 86400 * 18, version: "v3.0.6.8" },
  { id: "VNA-005", hostname: "vna-cache-qd.sdph.local", ip: "10.3.30.11", role: "cache", status: "degraded", storageUsed: 480, storageTotal: 1000, instances: 24820, studies: 8210, cacheHitRate: 0.78, ioLoad: 0.85, uptime: 86400 * 12, version: "v3.0.6.8" },
  { id: "VNA-006", hostname: "vna-edge-mobile.sdph.local", ip: "10.4.40.11", role: "edge", status: "online", storageUsed: 80, storageTotal: 500, instances: 4218, studies: 1284, cacheHitRate: 0.62, ioLoad: 0.18, uptime: 86400 * 6, version: "v3.0.6.8" },
];

export const CACHE_METRICS: CacheMetrics = {
  totalRequests: 1842342,
  cacheHits: 1728432,
  cacheMisses: 113910,
  evictions: 4218,
  hitRate: 0.938,
  avgLatencyMs: 12.4,
  p99LatencyMs: 84.7,
};

export const ROUTING_RULES: RoutingRuleEntry[] = [
  { id: "RT-001", name: "CT 默认路由", sourceAe: "CT01", destAe: "VNA-PRIMARY", modality: "CT", active: true, matched: 84128 },
  { id: "RT-002", name: "MR 默认路由", sourceAe: "MR01", destAe: "VNA-PRIMARY", modality: "MR", active: true, matched: 32142 },
  { id: "RT-003", name: "CR 移动 → 边缘缓存", sourceAe: "CR01", destAe: "VNA-EDGE-MOBILE", modality: "CR", active: true, matched: 8421 },
  { id: "RT-004", name: "MG 钼靶 → 妇幼 PACS", sourceAe: "MG01", destAe: "VNA-PED", modality: "MG", active: true, matched: 2841 },
  { id: "RT-005", name: "US 超声 → 边缘缓存", sourceAe: "US01", destAe: "VNA-CACHE-OPH", modality: "US", active: true, matched: 12421 },
  { id: "RT-006", name: "急诊 CT → 主库", sourceAe: "CT01", destAe: "VNA-PRIMARY", modality: "CT", active: true, matched: 421 },
  { id: "RT-007", name: "科研去标识 DICOM → 边缘", sourceAe: "ALL", destAe: "VNA-EDGE-RESEARCH", modality: "*", active: false, matched: 0 },
];

export function getVnaNodes(): VnaNode[] { return VNA_NODES; }
export function getCacheMetrics(): CacheMetrics { return CACHE_METRICS; }
export function getVnaRoutingRules(): RoutingRuleEntry[] { return ROUTING_RULES; }
export function vnaHealthCheck(): Promise<{ status: string; version: string; uptime: number; activeAssociations: number; studiesCount: number; }> {
  return Promise.resolve({
    status: "healthy",
    version: "v3.0.6.8-52",
    uptime: 86400 * 32,
    activeAssociations: 124,
    studiesCount: 148523,
  });
}
export function getVnaMetrics(): { totalCapacityGb: number; usedCapacityGb: number; instancesStored: number; } {
  const total = VNA_NODES.reduce((s, n) => s + n.storageTotal, 0);
  const used = VNA_NODES.reduce((s, n) => s + n.storageUsed, 0);
  const instances = VNA_NODES.reduce((s, n) => s + n.instances, 0);
  return { totalCapacityGb: total, usedCapacityGb: used, instancesStored: instances };
}