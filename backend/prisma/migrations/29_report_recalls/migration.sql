-- [v3.0.6.16-9] 报告召回台账 (此前为内存 Map, 重启即丢, 无法举证)
CREATE TABLE "report_recalls" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "patient_id" TEXT,
    "patient_name" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL DEFAULT '',
    "recalled_by_id" TEXT,
    "recalled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hl7_control_id" TEXT,
    "notify_status" TEXT NOT NULL DEFAULT 'pending',
    "clinical_receipt" TEXT,
    "restated_report_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "report_recalls_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "report_recalls_tenant_id_recalled_at_idx" ON "report_recalls"("tenant_id", "recalled_at");
CREATE INDEX "report_recalls_report_id_idx" ON "report_recalls"("report_id");