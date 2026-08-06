-- G005 v3.0.6.11-72 PERF1: 补缺失查询索引
-- 报表页按 (tenant, signedAt) 过滤; 检查列表按 (tenant, createdAt)/(tenant, scheduledAt);
-- DICOM 归档按 modality / (tenant, modality) 聚合 (dicom-4d / vna 查询)

CREATE INDEX "reports_tenant_id_signed_at_idx" ON "reports"("tenant_id", "signed_at");

CREATE INDEX "exams_tenant_id_created_at_idx" ON "exams"("tenant_id", "created_at");

CREATE INDEX "exams_tenant_id_scheduled_at_idx" ON "exams"("tenant_id", "scheduled_at");

CREATE INDEX "dicom_instances_modality_idx" ON "dicom_instances"("modality");

CREATE INDEX "dicom_instances_tenant_id_modality_idx" ON "dicom_instances"("tenant_id", "modality");
