-- [v3.0.6.16-9] 对比剂安全记录 (此前为后端内存 Map, 重启即丢 / 无法按批号追溯)

CREATE TABLE "contrast_injections" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "exam_id" TEXT,
    "patient_id" TEXT NOT NULL,
    "patient_name" TEXT NOT NULL DEFAULT '',
    "contrast_type" TEXT NOT NULL,
    "batch_no" TEXT,
    "route" TEXT,
    "total_volume_ml" DOUBLE PRECISION,
    "flow_rate_mls" DOUBLE PRECISION,
    "concentration" TEXT,
    "weight_kg" DOUBLE PRECISION,
    "egfr" DOUBLE PRECISION,
    "consent_signed" BOOLEAN NOT NULL DEFAULT false,
    "injected_by" TEXT,
    "injected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "contrast_injections_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "contrast_injections_tenant_id_injected_at_idx" ON "contrast_injections"("tenant_id", "injected_at");
CREATE INDEX "contrast_injections_exam_id_idx" ON "contrast_injections"("exam_id");
CREATE INDEX "contrast_injections_patient_id_idx" ON "contrast_injections"("patient_id");
CREATE INDEX "contrast_injections_tenant_id_batch_no_idx" ON "contrast_injections"("tenant_id", "batch_no");

CREATE TABLE "contrast_observations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "injection_id" TEXT,
    "patient_id" TEXT NOT NULL,
    "patient_name" TEXT NOT NULL DEFAULT '',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observation_mins" INTEGER NOT NULL DEFAULT 30,
    "status" TEXT NOT NULL DEFAULT 'observing',
    "symptoms" TEXT NOT NULL DEFAULT '',
    "actions" TEXT NOT NULL DEFAULT '',
    "recorded_by" TEXT,
    "discharged_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "contrast_observations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "contrast_observations_tenant_id_status_idx" ON "contrast_observations"("tenant_id", "status");
CREATE INDEX "contrast_observations_patient_id_idx" ON "contrast_observations"("patient_id");

CREATE TABLE "contrast_extravasations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "injection_id" TEXT,
    "exam_id" TEXT,
    "patient_id" TEXT NOT NULL,
    "patient_name" TEXT NOT NULL DEFAULT '',
    "site" TEXT NOT NULL DEFAULT '',
    "severity" TEXT NOT NULL DEFAULT 'MILD',
    "volume_ml" DOUBLE PRECISION,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'open',
    "measures" TEXT NOT NULL DEFAULT '',
    "outcome" TEXT NOT NULL DEFAULT '',
    "follow_up_dept" TEXT,
    "handled_by" TEXT,
    "handled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "contrast_extravasations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "contrast_extravasations_tenant_id_status_idx" ON "contrast_extravasations"("tenant_id", "status");
CREATE INDEX "contrast_extravasations_patient_id_idx" ON "contrast_extravasations"("patient_id");

ALTER TABLE "contrast_observations" ADD CONSTRAINT "contrast_observations_injection_id_fkey" FOREIGN KEY ("injection_id") REFERENCES "contrast_injections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contrast_extravasations" ADD CONSTRAINT "contrast_extravasations_injection_id_fkey" FOREIGN KEY ("injection_id") REFERENCES "contrast_injections"("id") ON DELETE SET NULL ON UPDATE CASCADE;