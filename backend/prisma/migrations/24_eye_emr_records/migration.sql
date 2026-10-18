-- [v3.0.6.16-7] 眼科病历记录 (前端 EyeEmrPage 新建病历此前无后端端点)
CREATE TABLE "eye_emr_records" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL DEFAULT '',
    "patient_name" TEXT NOT NULL,
    "visit_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chief_complaint" TEXT NOT NULL DEFAULT '',
    "diagnosis" TEXT NOT NULL DEFAULT '',
    "plan" TEXT NOT NULL DEFAULT '',
    "notes" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eye_emr_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "eye_emr_records_patient_id_idx" ON "eye_emr_records"("patient_id");
CREATE INDEX "eye_emr_records_tenant_id_idx" ON "eye_emr_records"("tenant_id");
CREATE INDEX "eye_emr_records_visit_date_idx" ON "eye_emr_records"("visit_date");