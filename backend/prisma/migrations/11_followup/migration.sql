-- G005 v3.0.6.11-79 W4-B: 随访计划持久化 (FollowUpPlan 模型)
-- 应用方式: `prisma migrate deploy`; 运行时若无此表则自动回退内存存储

CREATE TABLE "follow_up_plans" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT NOT NULL,
  "patient_id" TEXT NOT NULL,
  "patient_name" TEXT NOT NULL,
  "plan_date" TIMESTAMP NOT NULL,
  "interval_days" INTEGER NOT NULL DEFAULT 30,
  "next_date" TIMESTAMP NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "note" TEXT NOT NULL DEFAULT '',
  "reminder_enabled" BOOLEAN NOT NULL DEFAULT true,
  "completed_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "follow_up_plans_tenant_id_idx" ON "follow_up_plans"("tenant_id");

CREATE INDEX "follow_up_plans_patient_id_idx" ON "follow_up_plans"("patient_id");

CREATE INDEX "follow_up_plans_status_idx" ON "follow_up_plans"("status");

CREATE INDEX "follow_up_plans_next_date_idx" ON "follow_up_plans"("next_date");
