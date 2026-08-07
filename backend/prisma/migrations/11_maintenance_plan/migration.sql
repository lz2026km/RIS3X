-- G005 v3.0.6.11-79 W4-B: 设备保养计划持久化 (MaintenancePlan 模型)
-- 应用方式: `prisma migrate deploy`; 运行时若无此表则自动回退内存存储

CREATE TABLE "maintenance_plans" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT NOT NULL,
  "device_id" TEXT NOT NULL,
  "device_name" TEXT NOT NULL,
  "maintenance_date" TIMESTAMP NOT NULL,
  "interval_days" INTEGER NOT NULL DEFAULT 90,
  "type" TEXT NOT NULL DEFAULT '定期保养',
  "content" TEXT NOT NULL DEFAULT '',
  "estimated_cost" DECIMAL(12, 2),
  "assignee" TEXT DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "next_date" TIMESTAMP,
  "completed_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "maintenance_plans_tenant_id_idx" ON "maintenance_plans"("tenant_id");

CREATE INDEX "maintenance_plans_device_id_idx" ON "maintenance_plans"("device_id");

CREATE INDEX "maintenance_plans_status_maintenance_date_idx" ON "maintenance_plans"("status", "maintenance_date");
