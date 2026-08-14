-- G005 v3.0.6.11-98 Wave 1A P0: 报告富文本 HTML 持久化 (书写页图片/表格/格式刷新不丢)
-- 应用方式: `prisma migrate deploy`
ALTER TABLE "reports" ADD COLUMN "html_content" TEXT NOT NULL DEFAULT '';
