// [ClinicalData] 数据库健康 / 故障切换 mock service
// 阶段 1.5 修复
export interface DbReplica {
  id: string;
  hostname: string;
  region: string;
  role: "primary" | "standby" | "read_replica" | "analytics";
  status: "healthy" | "lagging" | "offline" | "failed";
  lagMs: number;
  bytesUsed: number;
  bytesTotal: number;
  lastHeartbeat: string;
  rpo: number; // Recovery Point Objective, seconds
  rto: number; // Recovery Time Objective, seconds
}

const NOW = Date.now();

export const REPLICAS: DbReplica[] = [
  { id: "DB-PRIMARY", hostname: "pg-primary.sdph.local", region: "济南-主中心", role: "primary", status: "healthy", lagMs: 0, bytesUsed: 4218, bytesTotal: 8000, lastHeartbeat: new Date(NOW - 1000).toISOString(), rpo: 5, rto: 60 },
  { id: "DB-STANDBY", hostname: "pg-standby.sdph.local", region: "济南-主中心", role: "standby", status: "healthy", lagMs: 12, bytesUsed: 4218, bytesTotal: 8000, lastHeartbeat: new Date(NOW - 2000).toISOString(), rpo: 5, rto: 60 },
  { id: "DB-READ-01", hostname: "pg-read-01.sdph.local", region: "济南-主中心", role: "read_replica", status: "healthy", lagMs: 28, bytesUsed: 4218, bytesTotal: 8000, lastHeartbeat: new Date(NOW - 3000).toISOString(), rpo: 30, rto: 300 },
  { id: "DB-READ-02", hostname: "pg-read-02.sdph.local", region: "济南-主中心", role: "read_replica", status: "healthy", lagMs: 32, bytesUsed: 4218, bytesTotal: 8000, lastHeartbeat: new Date(NOW - 2500).toISOString(), rpo: 30, rto: 300 },
  { id: "DB-DR-QD", hostname: "pg-dr-qingdao.sdph.local", region: "异地-青岛", role: "standby", status: "healthy", lagMs: 84, bytesUsed: 4218, bytesTotal: 8000, lastHeartbeat: new Date(NOW - 5000).toISOString(), rpo: 60, rto: 600 },
  { id: "DB-DR-BJ", hostname: "pg-dr-beijing.sdph.local", region: "异地-北京", role: "standby", status: "lagging", lagMs: 1840, bytesUsed: 4218, bytesTotal: 8000, lastHeartbeat: new Date(NOW - 12000).toISOString(), rpo: 300, rto: 1800 },
  { id: "DB-ANALYTICS", hostname: "pg-analytics.sdph.local", region: "济南-分析库", role: "analytics", status: "healthy", lagMs: 3600, bytesUsed: 18420, bytesTotal: 32000, lastHeartbeat: new Date(NOW - 8000).toISOString(), rpo: 3600, rto: 7200 },
];

export function getDbHealth(): { primary: string; replicaCount: number; healthyReplicas: number; replicationLagMs: number; } {
  const primary = REPLICAS.find(r => r.role === "primary");
  const healthyReplicas = REPLICAS.filter(r => r.status === "healthy").length;
  return {
    primary: primary?.status === "healthy" ? "healthy" : "degraded",
    replicaCount: REPLICAS.length,
    healthyReplicas,
    replicationLagMs: REPLICAS.reduce((s, r) => s + r.lagMs, 0) / REPLICAS.length,
  };
}
export function getReplicas(): DbReplica[] { return REPLICAS; }