-- [v3.0.6.16-9] 检查工作流补齐: 侧别 / 申请科室 / 临床指征 / 机房
ALTER TABLE "exams" ADD COLUMN "laterality" TEXT;
ALTER TABLE "exams" ADD COLUMN "referring_dept" TEXT;
ALTER TABLE "exams" ADD COLUMN "clinical_indication" TEXT;
ALTER TABLE "exams" ADD COLUMN "room_id" TEXT;

CREATE INDEX "exams_room_id_idx" ON "exams"("room_id");