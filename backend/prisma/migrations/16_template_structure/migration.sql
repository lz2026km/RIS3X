-- [v3.0.6.11-99 Wave2B (模板设计器 P1)] 模板结构化内容
-- ReportTemplate.structure: JSON 段落块数组 [{type:'text'|'field'|'variable'|'structured', content, fieldKey?, variable?}]
-- 供模板设计器可视化保存, 兼容现有 content/body 纯文本 (structure 为空时回退 body)
ALTER TABLE "report_templates" ADD COLUMN "structure" JSONB;
