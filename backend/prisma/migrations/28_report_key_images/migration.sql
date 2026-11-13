-- [v3.0.6.16-9] 报告关键图 (附图必须可追溯到 SOP Instance UID)
CREATE TABLE "report_key_images" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "exam_id" TEXT,
    "study_uid" TEXT NOT NULL,
    "series_uid" TEXT NOT NULL,
    "sop_uid" TEXT NOT NULL,
    "frame" INTEGER NOT NULL DEFAULT 0,
    "caption" TEXT NOT NULL DEFAULT '',
    "thumbnail" TEXT NOT NULL DEFAULT '',
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "report_key_images_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "report_key_images_tenant_id_report_id_idx" ON "report_key_images"("tenant_id", "report_id");