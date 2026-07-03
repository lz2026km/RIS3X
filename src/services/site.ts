// [ClinicalData] 多站点管理 mock service
// 阶段 1.5 修复：之前文件不存在导致 KPI 全 0
export interface Site {
  id: string;
  name: string;
  code: string;
  region: string;
  city: string;
  status: "active" | "offline" | "syncing" | "maintenance";
  studies: number;
  patients: number;
  users: number;
  storage: number; // GB
  bandwidth: number; // Mbps
  lastSync: string;
  latencyMs: number;
  uptimePct: number;
  version: string;
  primary: boolean;
}

const NOW = Date.now();

export const SITES: Site[] = [
  { id: "SITE-MAIN", name: "山东省人民医院 (总院)", code: "SDPH-MAIN", region: "华东", city: "济南", status: "active", studies: 148523, patients: 89521, users: 842, storage: 48230, bandwidth: 980, lastSync: new Date(NOW - 30000).toISOString(), latencyMs: 12, uptimePct: 99.97, version: "v3.0.6.8-52", primary: true },
  { id: "SITE-OPH", name: "山东省立眼科医院", code: "SDPH-OPH", region: "华东", city: "济南", status: "active", studies: 64218, patients: 38421, users: 312, storage: 18950, bandwidth: 520, lastSync: new Date(NOW - 60000).toISOString(), latencyMs: 18, uptimePct: 99.92, version: "v3.0.6.8-52", primary: false },
  { id: "SITE-PED", name: "山东省妇幼保健院", code: "SDPH-PED", region: "华东", city: "济南", status: "active", studies: 38412, patients: 22891, users: 218, storage: 9870, bandwidth: 380, lastSync: new Date(NOW - 45000).toISOString(), latencyMs: 22, uptimePct: 99.85, version: "v3.0.6.8-52", primary: false },
  { id: "SITE-QD", name: "青岛大学附属医院", code: "QDUH-MAIN", region: "华东", city: "青岛", status: "syncing", studies: 52891, patients: 31224, users: 412, storage: 14420, bandwidth: 450, lastSync: new Date(NOW - 120000).toISOString(), latencyMs: 45, uptimePct: 99.71, version: "v3.0.6.8-52", primary: false },
  { id: "SITE-WF", name: "潍坊市人民医院", code: "WFH-MAIN", region: "华东", city: "潍坊", status: "active", studies: 41228, patients: 24110, users: 296, storage: 11240, bandwidth: 320, lastSync: new Date(NOW - 90000).toISOString(), latencyMs: 32, uptimePct: 99.78, version: "v3.0.6.8-52", primary: false },
  { id: "SITE-JN2", name: "济南市中心医院 (二院区)", code: "JN2-MAIN", region: "华东", city: "济南", status: "offline", studies: 28934, patients: 16280, users: 184, storage: 7820, bandwidth: 0, lastSync: new Date(NOW - 1800000).toISOString(), latencyMs: 0, uptimePct: 95.42, version: "v3.0.6.8-52", primary: false },
  { id: "SITE-YT", name: "烟台毓璜顶医院", code: "YTH-MAIN", region: "华东", city: "烟台", status: "active", studies: 32145, patients: 19420, users: 242, storage: 8930, bandwidth: 280, lastSync: new Date(NOW - 70000).toISOString(), latencyMs: 38, uptimePct: 99.65, version: "v3.0.6.8-52", primary: false },
  { id: "SITE-WH", name: "威海市立医院", code: "WHH-MAIN", region: "华东", city: "威海", status: "maintenance", studies: 22110, patients: 13280, users: 158, storage: 6010, bandwidth: 0, lastSync: new Date(NOW - 3600000).toISOString(), latencyMs: 0, uptimePct: 97.83, version: "v3.0.6.8-52", primary: false },
];

export interface SyncEvent {
  id: string;
  siteId: string;
  type: "study_pushed" | "study_pulled" | "user_sync" | "config_sync";
  status: "success" | "failed" | "pending";
  count: number;
  bytes: number;
  duration: number; // ms
  timestamp: string;
  message?: string;
}

const TYPES: SyncEvent["type"][] = ["study_pushed", "study_pushed", "study_pulled", "user_sync", "config_sync", "study_pushed", "study_pulled", "study_pushed"];
const STATUSES: SyncEvent["status"][] = ["success", "success", "success", "success", "success", "success", "failed", "success"];

export const SYNC_EVENTS: SyncEvent[] = Array.from({ length: 32 }, (_, i) => {
  const site = SITES[i % SITES.length];
  const type = TYPES[i % TYPES.length];
  const status = STATUSES[i % STATUSES.length];
  return {
    id: `SYNC-${(1000 + i).toString()}`,
    siteId: site.id,
    type,
    status,
    count: 1 + Math.floor(Math.random() * 50),
    bytes: 1024 * (1 + Math.floor(Math.random() * 5000)),
    duration: 50 + Math.floor(Math.random() * 800),
    timestamp: new Date(NOW - i * 240000).toISOString(),
    message: status === "failed" ? "Network timeout after 30s" : undefined,
  };
});

export interface RoutingRule {
  id: string;
  name: string;
  sourceSite: string;
  destSite: string;
  modality: string;
  condition: string;
  active: boolean;
  matchedCount: number;
}

export const ROUTING_RULES: RoutingRule[] = [
  { id: "RR-001", name: "CT 影像 → 总院 PACS", sourceSite: "SITE-OPH", destSite: "SITE-MAIN", modality: "CT", condition: "default", active: true, matchedCount: 8421 },
  { id: "RR-002", name: "MR 影像 → 总院 PACS", sourceSite: "SITE-OPH", destSite: "SITE-MAIN", modality: "MR", condition: "default", active: true, matchedCount: 3421 },
  { id: "RR-003", name: "急诊 CT → 总院 (优先级)", sourceSite: "*", destSite: "SITE-MAIN", modality: "CT", condition: "priority=STAT", active: true, matchedCount: 248 },
  { id: "RR-004", name: "MG 钼靶 → 妇幼", sourceSite: "SITE-PED", destSite: "SITE-MAIN", modality: "MG", condition: "default", active: true, matchedCount: 1024 },
  { id: "RR-005", name: "CR 移动拍片 → 现场", sourceSite: "SITE-MAIN", destSite: "SITE-MAIN", modality: "CR", condition: "portable=true", active: true, matchedCount: 421 },
  { id: "RR-006", name: "青岛分院 CT → 总院 PACS", sourceSite: "SITE-QD", destSite: "SITE-MAIN", modality: "CT", condition: "default", active: true, matchedCount: 5128 },
  { id: "RR-007", name: "潍坊分院 → 区域影像中心", sourceSite: "SITE-WF", destSite: "SITE-MAIN", modality: "*", condition: "default", active: false, matchedCount: 0 },
];

export function getAllSites(): Site[] { return SITES; }
export function getActiveSiteCount(): number { return SITES.filter(s => s.status === "active").length; }
export function getOfflineSiteCount(): number { return SITES.filter(s => s.status === "offline").length; }
export function getTotalStudies(): number { return SITES.reduce((s, x) => s + x.studies, 0); }
export function getSyncEvents(): SyncEvent[] { return SYNC_EVENTS; }
export function getRoutingRules(): RoutingRule[] { return ROUTING_RULES; }