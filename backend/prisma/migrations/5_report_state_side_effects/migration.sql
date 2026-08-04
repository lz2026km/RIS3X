-- G005 v3.0.6.11-70: 报告状态机副作用字段 (P0)
-- SIGNED 记录签署人、REVIEWED 记录审核时间、PUBLISHED 记录发布时间
-- 与 prisma/schema.prisma 的 Report model 对应
ALTER TABLE "reports" ADD COLUMN "signed_by_id" TEXT;
ALTER TABLE "reports" ADD COLUMN "reviewed_at" TIMESTAMP(3);
ALTER TABLE "reports" ADD COLUMN "published_at" TIMESTAMP(3);

CREATE INDEX "reports_signed_by_id_idx" ON "reports"("signed_by_id");
