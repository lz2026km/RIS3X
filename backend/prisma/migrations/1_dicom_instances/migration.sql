-- G005 v3.0.6.11-53: dicom_instances 表 (Phase 1.2+1.3 内置示例 DICOM 注册)
-- 与 prisma/schema.prisma 的 DicomInstance model 对应
CREATE TABLE "dicom_instances" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "study_instance_uid" TEXT NOT NULL,
    "series_instance_uid" TEXT NOT NULL,
    "sop_instance_uid" TEXT NOT NULL,
    "sop_class_uid" TEXT NOT NULL,
    "modality" TEXT NOT NULL,
    "storage_path" TEXT,
    "size_bytes" INTEGER,
    "transfer_syntax" TEXT,
    "report_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dicom_instances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dicom_instances_sop_instance_uid_key" ON "dicom_instances"("sop_instance_uid");

CREATE INDEX "dicom_instances_study_instance_uid_idx" ON "dicom_instances"("study_instance_uid");

CREATE INDEX "dicom_instances_report_id_idx" ON "dicom_instances"("report_id");

CREATE INDEX "dicom_instances_tenant_id_idx" ON "dicom_instances"("tenant_id");

ALTER TABLE "dicom_instances" ADD CONSTRAINT "dicom_instances_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
