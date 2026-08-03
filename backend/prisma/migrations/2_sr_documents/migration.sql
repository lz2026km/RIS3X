-- G005 v3.0.6.11-60: sr_documents 表 (DICOM SR 结构化报告文档存储)
-- 与 prisma/schema.prisma 的 SrDocument model 对应
CREATE TABLE "sr_documents" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "tid" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "raw_content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sop_instance_uid" TEXT NOT NULL,
    "study_instance_uid" TEXT NOT NULL,
    "series_instance_uid" TEXT NOT NULL,
    "sop_class_uid" TEXT NOT NULL,
    "hl7_control_id" TEXT,
    "hl7_message" TEXT,
    "pushed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sr_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sr_documents_sop_instance_uid_key" ON "sr_documents"("sop_instance_uid");

CREATE INDEX "sr_documents_report_id_idx" ON "sr_documents"("report_id");

CREATE INDEX "sr_documents_tenant_id_idx" ON "sr_documents"("tenant_id");

CREATE INDEX "sr_documents_status_idx" ON "sr_documents"("status");

ALTER TABLE "sr_documents" ADD CONSTRAINT "sr_documents_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
