-- G005 v3.0.6.11-95 Wave 1A 技师工作站: 优先级/技师注释/质控备注/评级/重拍次数/暂停时间 落库
-- 应用方式: `prisma migrate deploy`

ALTER TABLE "exams" ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'ROUTINE';
ALTER TABLE "exams" ADD COLUMN "tech_notes" TEXT;
ALTER TABLE "exams" ADD COLUMN "qc_notes" TEXT;
ALTER TABLE "exams" ADD COLUMN "quality_rating" TEXT;
ALTER TABLE "exams" ADD COLUMN "retake_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "exams" ADD COLUMN "paused_at" TIMESTAMP;
