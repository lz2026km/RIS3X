// [ClinicalData] 云存 / 归档 mock service
// 阶段 1.5 修复
export interface StorageNode {
  id: string;
  name: string;
  type: "primary" | "tier2" | "archive" | "backup";
  tier: "hot" | "warm" | "cold";
  vendor: string;
  capacityGb: number;
  usedGb: number;
  objectsCount: number;
  readLatencyMs: number;
  writeLatencyMs: number;
  status: "online" | "syncing" | "offline" | "readonly";
  lastSync: string;
  region: string;
}

export interface TierMetrics {
  tier: "hot" | "warm" | "cold";
  objects: number;
  sizeGb: number;
  pctOfTotal: number;
  retentionDays: number;
  monthlyCostUsd: number;
}

export interface ArchiveJob {
  id: string;
  type: "auto_archive" | "manual_archive" | "restore" | "purge";
  status: "running" | "success" | "failed" | "queued";
  source: string;
  target: string;
  objects: number;
  bytes: number;
  startedAt: string;
  duration: number;
  progress: number; // 0-100
}

export interface CompressionStats {
  rawBytes: number;
  compressedBytes: number;
  ratio: number;
  savedGb: number;
}

const NOW = Date.now();

export const STORAGE_NODES: StorageNode[] = [
  { id: "STR-001", name: "Primary PACS Storage", type: "primary", tier: "hot", vendor: "NetApp AFF A800", capacityGb: 51200, usedGb: 38420, objectsCount: 482134, readLatencyMs: 1.2, writeLatencyMs: 2.8, status: "online", lastSync: new Date(NOW - 5000).toISOString(), region: "济南-主中心" },
  { id: "STR-002", name: "Tier-2 Warm Storage", type: "tier2", tier: "warm", vendor: "Scality RING", capacityGb: 204800, usedGb: 142800, objectsCount: 1842312, readLatencyMs: 12.4, writeLatencyMs: 18.6, status: "online", lastSync: new Date(NOW - 30000).toISOString(), region: "济南-主中心" },
  { id: "STR-003", name: "Cold Archive #1", type: "archive", tier: "cold", vendor: "AWS S3 Glacier", capacityGb: 1024000, usedGb: 728420, objectsCount: 8421234, readLatencyMs: 420, writeLatencyMs: 840, status: "online", lastSync: new Date(NOW - 120000).toISOString(), region: "异地-青岛" },
  { id: "STR-004", name: "Cold Archive #2 (异地)", type: "archive", tier: "cold", vendor: "Azure Blob Archive", capacityGb: 1024000, usedGb: 612480, objectsCount: 7214321, readLatencyMs: 380, writeLatencyMs: 760, status: "online", lastSync: new Date(NOW - 180000).toISOString(), region: "异地-北京" },
  { id: "STR-005", name: "Backup Tape Library", type: "backup", tier: "cold", vendor: "IBM TS4500", capacityGb: 2048000, usedGb: 1482420, objectsCount: 12842000, readLatencyMs: 2400, writeLatencyMs: 1800, status: "online", lastSync: new Date(NOW - 86400000).toISOString(), region: "济南-灾备" },
  { id: "STR-006", name: "PACS-NAS (眼科)", type: "primary", tier: "hot", vendor: "Dell PowerScale", capacityGb: 25600, usedGb: 18920, objectsCount: 64218, readLatencyMs: 1.8, writeLatencyMs: 3.4, status: "online", lastSync: new Date(NOW - 10000).toISOString(), region: "济南-眼科" },
  { id: "STR-007", name: "Edge Cache - 移动拍片", type: "backup", tier: "hot", vendor: "Synology FS6400", capacityGb: 5120, usedGb: 3840, objectsCount: 8421, readLatencyMs: 2.4, writeLatencyMs: 4.1, status: "syncing", lastSync: new Date(NOW - 60000).toISOString(), region: "边缘-移动" },
];

export const TIER_METRICS: TierMetrics[] = [
  { tier: "hot", objects: 554773, sizeGb: 61380, pctOfTotal: 2.1, retentionDays: 90, monthlyCostUsd: 18420 },
  { tier: "warm", objects: 1842312, sizeGb: 142800, pctOfTotal: 4.8, retentionDays: 365, monthlyCostUsd: 12840 },
  { tier: "cold", objects: 15635555, sizeGb: 1340900, pctOfTotal: 45.3, retentionDays: 2555, monthlyCostUsd: 4820 },
];

export const ARCHIVE_JOBS: ArchiveJob[] = Array.from({ length: 12 }, (_, i) => ({
  id: `JOB-${(1000 + i).toString()}`,
  type: (["auto_archive", "manual_archive", "restore", "purge"] as const)[i % 4] ?? "auto_archive",
  status: (["success", "running", "success", "success", "failed", "success"] as const)[i % 6] ?? "success",
  source: ["STR-001", "STR-002", "STR-003", "STR-004"][i % 4] ?? "STR-001",
  target: ["STR-002", "STR-003", "STR-003", "STR-005"][i % 4] ?? "STR-002",
  objects: 100 + i * 42,
  bytes: 1024 * 1024 * (100 + i * 50),
  startedAt: new Date(NOW - i * 3600000).toISOString(),
  duration: 120 + i * 30,
  progress: i === 1 ? 64 : 100,
}));

export const COMPRESSION: CompressionStats = {
  rawBytes: 1842349120342,
  compressedBytes: 982348120000,
  ratio: 0.533,
  savedGb: 802,
};

export function getStorageNodes(): StorageNode[] { return STORAGE_NODES; }
export function getStorageMetrics(): { totalObjects: number; totalSizeBytes: number; bytesWritten24h: number; bytesRead24h: number; } {
  const totalObjects = STORAGE_NODES.reduce((s, n) => s + n.objectsCount, 0);
  const totalSizeBytes = STORAGE_NODES.reduce((s, n) => s + n.usedGb, 0) * 1024 * 1024 * 1024;
  return { totalObjects, totalSizeBytes, bytesWritten24h: 42.8 * 1024 * 1024, bytesRead24h: 124.2 * 1024 * 1024 };
}
export function getTierMetrics(): TierMetrics[] { return TIER_METRICS; }
export function getArchiveJobs(): ArchiveJob[] { return ARCHIVE_JOBS; }
export function getCompressionStats(): CompressionStats { return COMPRESSION; }