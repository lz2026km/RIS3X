// [ClinicalData] 离线同步引擎 mock service
// 阶段 1.5 修复
export interface SyncQueueItem {
  id: string;
  type: "study" | "report" | "user_action" | "config" | "image";
  operation: "create" | "update" | "delete";
  payload: string;
  priority: "critical" | "high" | "normal" | "low";
  status: "pending" | "syncing" | "completed" | "failed" | "conflict";
  attempts: number;
  maxAttempts: number;
  lastAttempt?: string;
  createdAt: string;
  bytes: number;
}

export interface ConflictResolution {
  id: string;
  type: "data_conflict" | "version_conflict" | "schema_conflict";
  status: "pending" | "auto_resolved" | "manual_resolved" | "escalated";
  localVersion: string;
  remoteVersion: string;
  resolvedAt?: string;
  strategy?: "last_write_wins" | "merge" | "manual";
  description: string;
}

const NOW = Date.now();

let _syncQueue: SyncQueueItem[] = Array.from({ length: 28 }, (_, i) => {
  const type = (["study", "report", "user_action", "config", "image"] as const)[i % 5] ?? "study";
  const op = (["create", "update", "delete"] as const)[i % 3];
  const pri = (["critical", "high", "normal", "low"] as const)[i % 4];
  const status = (["pending", "syncing", "completed", "failed", "conflict"] as const)[i % 5] ?? "pending";
  return {
    id: `Q-${(10000 + i).toString()}`,
    type,
    operation: op ?? "create",
    payload: `${type}_${op}_${1000 + i}`,
    priority: pri ?? "normal",
    status,
    attempts: Math.floor(Math.random() * 3),
    maxAttempts: 5,
    lastAttempt: status !== "pending" ? new Date(NOW - i * 60000).toISOString() : undefined,
    createdAt: new Date(NOW - i * 120000).toISOString(),
    bytes: 1024 * (10 + i * 5),
  };
});

export const CONFLICTS: ConflictResolution[] = [
  { id: "CONF-001", type: "version_conflict", status: "manual_resolved", localVersion: "v2.3", remoteVersion: "v2.4", resolvedAt: new Date(NOW - 3600000).toISOString(), strategy: "merge", description: "报告修改并发冲突，已合并" },
  { id: "CONF-002", type: "data_conflict", status: "auto_resolved", localVersion: "3.0.6.7", remoteVersion: "3.0.6.8", resolvedAt: new Date(NOW - 7200000).toISOString(), strategy: "last_write_wins", description: "配置版本冲突" },
  { id: "CONF-003", type: "schema_conflict", status: "escalated", localVersion: "v1.0", remoteVersion: "v1.1", description: "结构升级冲突，待人工介入" },
  { id: "CONF-004", type: "data_conflict", status: "pending", localVersion: "report-2024-001", remoteVersion: "report-2024-002", description: "同一报告被两个医生同时修改" },
  { id: "CONF-005", type: "version_conflict", status: "auto_resolved", localVersion: "v3.0", remoteVersion: "v3.1", resolvedAt: new Date(NOW - 14400000).toISOString(), strategy: "last_write_wins", description: "影像标注版本冲突" },
];

class MockSyncEngine {
  async getSyncStatus(): Promise<{ total: number; completed: number; failed: number; pending: number; syncing: number; conflicts: number; }> {
    const total = _syncQueue.length;
    const completed = _syncQueue.filter(q => q.status === "completed").length;
    const failed = _syncQueue.filter(q => q.status === "failed").length;
    const pending = _syncQueue.filter(q => q.status === "pending").length;
    const syncing = _syncQueue.filter(q => q.status === "syncing").length;
    const conflicts = CONFLICTS.filter(c => c.status === "pending").length;
    return { total, completed, failed, pending, syncing, conflicts };
  }
  async getQueue(): Promise<SyncQueueItem[]> { return _syncQueue; }
  async getConflicts(): Promise<ConflictResolution[]> { return CONFLICTS; }
  async retryItem(id: string): Promise<boolean> {
    const item = _syncQueue.find(q => q.id === id);
    if (!item) return false;
    item.attempts += 1;
    item.status = "syncing";
    return true;
  }
}

export const syncEngine = new MockSyncEngine();