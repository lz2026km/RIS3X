-- [v3.0.6.11-100 Wave2C (报告工作站 P2)] 模板类型字段
-- ReportTemplate.templateType: FULL=全文模板 / SECTION=段落模板 / PHRASE=短语模板 (默认 SECTION)
-- 模板库分类 Tab / 模板设计器保存类型 / 段落树生成引擎按此区分
ALTER TABLE "report_templates" ADD COLUMN "template_type" TEXT NOT NULL DEFAULT 'SECTION';
