-- [v3.0.6.11-98 Wave2A P1] 模板按模态自动匹配推荐 + 模板审批流
-- ReportTemplate: modality / status / approvedBy / approvedAt / rejectReason
ALTER TABLE "report_templates" ADD COLUMN "modality" TEXT;
ALTER TABLE "report_templates" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE "report_templates" ADD COLUMN "approved_by" TEXT;
ALTER TABLE "report_templates" ADD COLUMN "approved_at" TIMESTAMP(3);
ALTER TABLE "report_templates" ADD COLUMN "reject_reason" TEXT;

-- 存量模板视为已批准 (书写页模板库仅展示 approved), 新模板由 Prisma 默认 draft
CREATE INDEX "report_templates_status_tenant_id_idx" ON "report_templates"("status", "tenant_id");
CREATE INDEX "report_templates_created_by_id_tenant_id_idx" ON "report_templates"("created_by_id", "tenant_id");
