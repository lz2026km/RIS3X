-- G005 v3.0.6.11-79 W1-C: 合规文档库持久化 (ComplianceDocument 模型)
-- 状态流转: DRAFT -> CURRENT (publish) -> ARCHIVED (archive)
-- 应用方式: `prisma migrate deploy`; 运行时若无此表则自动回退内存存储

CREATE TABLE "compliance_documents" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'SOP',
  "version" TEXT NOT NULL DEFAULT '1.0',
  "content" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "author" TEXT,
  "approved_by" TEXT,
  "effective_date" TIMESTAMP,
  "published_at" TIMESTAMP,
  "archived_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "compliance_documents_tenant_id_idx" ON "compliance_documents"("tenant_id");

CREATE INDEX "compliance_documents_tenant_id_category_idx" ON "compliance_documents"("tenant_id", "category");

CREATE INDEX "compliance_documents_tenant_id_status_idx" ON "compliance_documents"("tenant_id", "status");
