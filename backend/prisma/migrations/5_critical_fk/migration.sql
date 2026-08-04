-- G005 P0: CriticalValue 外键 + Patient 软删除 (v3.0.6.11-70)
-- 1) critical_values.exam_id 补 FK (ON DELETE SET NULL),先清理历史孤儿数据避免约束失败
-- 2) critical_values 新增 patient_id 列 + FK (ON DELETE SET NULL)
-- 3) patients 新增 deleted_at 支持软删除 (删除患者不再物理删除,P2003 消除)

UPDATE "critical_values" SET "exam_id" = NULL
WHERE "exam_id" IS NOT NULL AND "exam_id" NOT IN (SELECT "id" FROM "exams");

ALTER TABLE "critical_values"
  ADD COLUMN "patient_id" TEXT;

ALTER TABLE "critical_values"
  ADD CONSTRAINT "critical_values_exam_id_fkey"
  FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "critical_values"
  ADD CONSTRAINT "critical_values_patient_id_fkey"
  FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "critical_values_patient_id_idx" ON "critical_values"("patient_id");

ALTER TABLE "patients"
  ADD COLUMN "deleted_at" TIMESTAMP(3);
