-- G005 v3.0.6.11-96 Wave 2B (B): MPPS 检查进度记录落库
-- MPPS (N-CREATE/N-SET) 从内存 Map 迁移到 DB (MppsRecord 模型)
-- 通过 `prisma migrate deploy` 应用; 运行时若无此表则服务层自动回退内存 Map

CREATE TABLE "mpps_records" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT NOT NULL,
  "study_uid" TEXT NOT NULL UNIQUE,
  "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  "patient_name" TEXT,
  "patient_id" TEXT,
  "modality" TEXT,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "steps" JSONB NOT NULL DEFAULT '[]',
  "source" TEXT NOT NULL DEFAULT 'mpps',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "mpps_records_status_idx" ON "mpps_records"("status");
CREATE INDEX "mpps_records_tenant_id_idx" ON "mpps_records"("tenant_id");
CREATE INDEX "mpps_records_updated_at_idx" ON "mpps_records"("updated_at");
