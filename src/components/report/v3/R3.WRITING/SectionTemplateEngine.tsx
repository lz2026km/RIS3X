/**
 * [v3.0.6.11-100 Wave2C (报告工作站 P2)] 段落树模板引擎
 * 按当前检查 modality + bodyPart 自动匹配段落模板 (templateType=SECTION, structure 优先),
 * 从模板 structure 解析段落树 (text/variable/field/structured 块) + 变量插值, 一键填充编辑器。
 * 书写页工具栏「模板段落树」按钮打开, 预览后插入 (ReportWritePage 集成)。
 */
import { useMemo, useState, useEffect } from 'react';
import { Modal, Button, Tag, Spin, Empty, Tooltip, Alert } from 'antd';
import { TreePine, FileText, Sparkles, CheckCircle2 } from 'lucide-react';
import { templatesApi, type TemplateDto, type TemplateStructure } from '@services/api/templatesApi';
import { resolveTemplateVariables, describeTemplateVariables, collectTemplateVariables } from '@utils/templateVariables';

/** 段落标题 (节段标记), 命中则作为段落树分支标题 */
const SECTION_TITLE_SET = new Set([
  '影像所见', '检查所见', '诊断意见', '诊断结论', '结论', '建议', '对比', '检查技术',
]);

export interface SectionTreeNode {
  id: string;
  title: string;
  type: 'text' | 'field' | 'variable' | 'structured';
  raw: string;
  rendered: string;
  hasUnresolved: boolean;
}

/** 规范化节段标题: 去冒号/括号 */
function normalizeTitle(text: string): string {
  return String(text ?? '').replace(/[：:]\s*$/, '').replace(/^【(.+)】$/, '$1').trim();
}

/** 模板 structure/body -> 段落树 */
export function buildSectionTree(structure: TemplateStructure | null | undefined, body: string): SectionTreeNode[] {
  const blocks: TemplateStructure = Array.isArray(structure) && structure.length > 0 ? structure : [];
  if (blocks.length === 0) {
    const parts = String(body ?? '').split(/\n{2,}/).filter((p) => p.trim().length > 0);
    return parts.map((p, i) => ({
      id: `sec-${i}`,
      title: p.trim().slice(0, 12) || `段落 ${i + 1}`,
      type: 'text' as const,
      raw: p,
      rendered: p,
      hasUnresolved: false,
    }));
  }
  const nodes: SectionTreeNode[] = [];
  let sectionTitle = '';
  blocks.forEach((b, i) => {
    const content = b?.content ?? '';
    if (!content || content.trim() === '') return;
    const trimmed = content.trim();
    const clean = normalizeTitle(trimmed);
    const isTitleLike = SECTION_TITLE_SET.has(clean) || trimmed.startsWith('【');
    if (isTitleLike || b.type === 'structured') {
      sectionTitle = clean || '结构化段落';
      nodes.push({
        id: `sec-${i}`,
        title: sectionTitle,
        type: b.type,
        raw: content,
        rendered: content,
        hasUnresolved: false,
      });
      return;
    }
    const hasUnresolved = describeTemplateVariables(content, null).unresolved.length > 0;
    nodes.push({
      id: `blk-${i}`,
      title: sectionTitle || content.trim().slice(0, 12),
      type: b.type,
      raw: content,
      rendered: content,
      hasUnresolved,
    });
  });
  return nodes;
}

export interface SectionTemplateEngineProps {
  open: boolean;
  modality: string;
  bodyPart: string;
  /** 报告上下文 (变量自动填充) */
  context?: Record<string, unknown> | null;
  onClose: () => void;
  /** 填充编辑器 (整篇替换) */
  onApply: (text: string) => void;
}

const matchLevel = (t: TemplateDto, mod: string, bp: string): number => {
  const tMod = String(t?.modality ?? '').trim().toUpperCase();
  const tBp = String(t?.bodyPart ?? '').trim();
  const m = mod && tMod && (tMod === mod || tMod.includes(mod) || mod.includes(tMod));
  const b = bp && tBp && (tBp === bp || tBp.includes(bp) || bp.includes(tBp));
  if (m && b) return 0;
  if (m) return 1;
  if (b) return 2;
  return -1;
};

const LEVEL_TAG: Record<number, string> = { 0: 'volcano', 1: 'cyan', 2: 'blue' };
const LEVEL_TEXT: Record<number, string> = { 0: '精准', 1: '模态', 2: '部位' };

export default function SectionTemplateEngine({ open, modality, bodyPart, context, onClose, onApply }: SectionTemplateEngineProps) {
  const [templates, setTemplates] = useState<TemplateDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const mod = useMemo(() => String(modality ?? '').trim().toUpperCase(), [modality]);
  const bp = useMemo(() => String(bodyPart ?? '').trim(), [bodyPart]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    templatesApi.list({ status: 'approved' }).then((res: any) => {
      if (cancelled) return;
      if (res.success && Array.isArray(res.data)) {
        const all = res.data as TemplateDto[];
        const sections = all.filter((t) => (t.templateType ?? 'SECTION') === 'SECTION' || Array.isArray(t.structure) || String(t.body ?? '').length > 0);
        const scored = sections
          .map((t) => ({ t, lv: matchLevel(t, mod, bp) }))
          .filter((x) => x.lv >= 0)
          .sort((a, b) => a.lv - b.lv || String(a.t?.name ?? '').localeCompare(String(b.t?.name ?? ''), 'zh-CN'));
        setTemplates(scored.map((x) => x.t));
        if (scored.length > 0) setSelectedId(scored[0]!.t.id);
        if (scored.length === 0) setError('当前模态/部位暂无段落模板, 可在模板库创建或更换模板');
      } else {
        setError('段落模板加载失败');
      }
    }).catch(() => { if (!cancelled) setError('段落模板加载失败'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, mod, bp]);

  const selected = useMemo(() => templates.find((t) => t.id === selectedId) ?? null, [templates, selectedId]);

  const tree = useMemo(() => {
    if (!selected) return [];
    const structure = Array.isArray(selected.structure) ? selected.structure : null;
    const nodes = buildSectionTree(structure, selected.body ?? '');
    return nodes.map((n) => ({ ...n, rendered: resolveTemplateVariables(n.raw, context, { keepUnresolved: true }) }));
  }, [selected, context]);

  const fullText = useMemo(() => tree.map((n) => n.rendered).filter((t) => t.trim().length > 0).join('\n'), [tree]);

  const unresolvedCount = useMemo(() => {
    const all = tree.map((n) => n.raw).join('\n');
    return describeTemplateVariables(all, context).unresolved.length;
  }, [tree, context]);

  const handleApply = () => {
    if (!fullText.trim()) return;
    onApply(fullText);
    onClose();
  };

  const renderNode = (n: { id: string; title: string; type: string; rendered: string; hasUnresolved: boolean }) => {
    const isSection = n.type === 'structured' || SECTION_TITLE_SET.has(normalizeTitle(n.rendered));
    if (isSection) {
      return (
        <div key={n.id} className="flex items-center gap-1.5 py-1">
          <TreePine className="w-3 h-3 text-amber-500 shrink-0" />
          <span className="text-xs font-bold text-slate-800">{normalizeTitle(n.rendered) || '结构化段落'}</span>
        </div>
      );
    }
    return (
      <div key={n.id} className="pl-5 py-0.5 text-xs text-slate-600 border-l border-slate-200 ml-1.5">
        <span className="whitespace-pre-wrap leading-relaxed">{n.rendered || <span className="text-slate-300">(空段落)</span>}</span>
        {n.hasUnresolved && <Tag color="purple" className="m-0 ml-1 text-[10px]">未识别变量</Tag>}
      </div>
    );
  };

  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          <TreePine className="w-4 h-4 text-amber-500" />
          <span>模板生成段落树</span>
          <Tag color="blue" className="text-[10px] m-0">按 {mod || '—'} / {bp || '—'} 匹配</Tag>
        </span>
      }
      open={open}
      onCancel={onClose}
      width={760}
      destroyOnHidden
      footer={
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            {tree.length} 段 · 共 {fullText.length} 字
            {unresolvedCount > 0 && <span className="text-purple-600 ml-2">{unresolvedCount} 个变量未识别(保留原样可手动修改)</span>}
          </span>
          <div className="flex gap-2">
            <Button onClick={onClose}>取消</Button>
            <Button type="primary" icon={<CheckCircle2 className="w-3 h-3" />} onClick={handleApply} disabled={!fullText.trim()}>
              一键填充编辑器
            </Button>
          </div>
        </div>
      }
    >
      <div className="pt-2 space-y-3">
        {loading ? (
          <div className="text-center py-8"><Spin /> 正在匹配段落模板…</div>
        ) : error && templates.length === 0 ? (
          <Empty image={<FileText size={40} style={{ opacity: 0.4 }} />} description={error} />
        ) : (
          <>
            <div className="flex gap-1.5 flex-wrap">
              {templates.length === 0 && (
                <span className="text-xs text-slate-400">无匹配段落模板 — 可在模板库创建 (保存类型选「段落」)</span>
              )}
              {templates.map((t) => {
                const lv = matchLevel(t, mod, bp);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedId(t.id)}
                    className={`px-2 py-1 rounded border text-[11px] cursor-pointer transition-colors ${selectedId === t.id ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'}`}
                  >
                    {t.name}
                    {lv >= 0 && <Tag className="m-0 ml-1 text-[9px]" color={selectedId === t.id ? 'gold' : LEVEL_TAG[lv]}>{LEVEL_TEXT[lv]}</Tag>}
                  </button>
                );
              })}
            </div>
            <Alert type="info" showIcon className="!text-[11px]" message="预览为变量插值结果: 来自当前报告上下文的变量已自动填充, 未识别占位符保留原样" />
            <div className="border border-slate-200 rounded p-3 max-h-[360px] overflow-y-auto bg-slate-50/60">
              {tree.length === 0 ? (
                <Empty image={<FileText size={36} style={{ opacity: 0.4 }} />} description="该模板无可生成段落" />
              ) : (
                <div className="space-y-1">{tree.map((n) => renderNode(n))}</div>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

/** 变量提示: 模板含变量时展示 tooltip */
export function SectionVariableHint({ text }: { text: string }) {
  const vars = useMemo(() => collectTemplateVariables(text), [text]);
  if (vars.length === 0) return null;
  return (
    <Tooltip title={`模板变量: ${vars.map((v) => `{{${v}}}`).join(' ')} (插入时自动填充)`}>
      <Sparkles className="w-3 h-3 text-purple-500 cursor-help" />
    </Tooltip>
  );
}
