-- G005 P0: 预约→检查联动 (v3.0.6.11-70)
-- 1) Appointment 补齐患者/检查/优先级字段 (patientName/bodyPart/endAt/priority/createdById)
-- 2) 新增 AppointmentPriority 枚举 (ROUTINE/URGENT/STAT)

CREATE TYPE "AppointmentPriority" AS ENUM ('ROUTINE', 'URGENT', 'STAT');

ALTER TABLE "appointments"
  ADD COLUMN "patient_name" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "body_part" TEXT,
  ADD COLUMN "end_at" TIMESTAMP(3),
  ADD COLUMN "priority" "AppointmentPriority" NOT NULL DEFAULT 'ROUTINE',
  ADD COLUMN "created_by_id" TEXT;
