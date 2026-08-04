-- G005 v3.0.6.11-70: 双人阅片分配表 (DualReadAssignment)
-- 对应 prisma/schema.prisma 的 DualReadAssignment model
CREATE TABLE "dual_read_assignments" (
    "id" TEXT NOT NULL,
    "report_id" TEXT,
    "study_id" TEXT,
    "patient_id" TEXT NOT NULL,
    "patient_name" TEXT NOT NULL,
    "modality" TEXT NOT NULL,
    "reader1_id" TEXT NOT NULL,
    "reader1_name" TEXT NOT NULL,
    "reader2_id" TEXT NOT NULL,
    "reader2_name" TEXT NOT NULL,
    "report1" TEXT,
    "report2" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "discrepancy_score" DOUBLE PRECISION,
    "arbitration_report" TEXT,
    "arbitrator_id" TEXT,
    "arbitrator_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dual_read_assignments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "dual_read_assignments_report_id_idx" ON "dual_read_assignments"("report_id");

CREATE INDEX "dual_read_assignments_patient_id_idx" ON "dual_read_assignments"("patient_id");

CREATE INDEX "dual_read_assignments_status_idx" ON "dual_read_assignments"("status");
