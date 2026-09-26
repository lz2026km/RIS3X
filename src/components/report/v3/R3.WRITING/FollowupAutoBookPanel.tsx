/**
 * [v3.0.6.11-100 Wave2C (报告工作站 P3)] 报告→随访自动触发 — 书写页「建议随访」卡片
 * - 按报告 impression/findings 关键词匹配 followup-trigger-rules (客户端同种子规则)
 * - 一键创建随访计划 (POST /followups) + 跳转 /follow-up
 * - 触发开关: auto=自动创建(提交时后端触发) / hint=仅提示 (默认) — 写入 localStorage + 配置提示
 */
import { useMemo, useState, useEffect, useCallback } from 'react';
import { Card, Tag, Button, Space, Switch, Tooltip, message, Alert } from 'antd';
import { CalendarPlus, Bell, ArrowRight, RefreshCw } from 'lucide-react';
import { followupApi } from '@services/api/followupApi';
import { useNavigate } from 'react-router-dom';
import { t } from '../../../../i18n/appI18n';

// [v3.0.6.11-100 Wave2C P3] 客户端匹配规则种子 (与后端 followup-trigger-rules 同源, 前端展示+匹配)
export interface FollowUpTriggerRule {
  id: string;
  keyword: string;
  label: string;
  templateId: string;
  templateName: string;
  intervals: number[];
  hint: string;
  active: boolean;
}

export const FOLLOWUP_TRIGGER_RULES: FollowUpTriggerRule[] = [
  { id: 'FTR-001', keyword: '肺结节', label: '肺结节', templateId: 'tpl-nodule', templateName: '肺结节随访', intervals: [90, 180, 360], hint: '建议 3/6/12 个月复查薄层 CT, 对比结节大小变化', active: true },
  { id: 'FTR-002', keyword: '磨玻璃', label: '磨玻璃影', templateId: 'tpl-nodule', templateName: '肺结节随访', intervals: [90, 180, 360], hint: '磨玻璃影建议 3/6/12 个月随访复查', active: true },
  { id: 'FTR-003', keyword: '乳腺', label: '乳腺占位', templateId: 'tpl-breast-ca', templateName: '乳腺癌术后随访', intervals: [90, 180, 360], hint: '建议 6/12 个月乳腺钼靶/超声随访', active: true },
  { id: 'FTR-004', keyword: '乳腺癌', label: '乳腺癌', templateId: 'tpl-breast-ca', templateName: '乳腺癌术后随访', intervals: [90, 180, 360], hint: '乳腺癌术后建议 6/12 个月随访 (影像 + 肿瘤标志物)', active: true },
  { id: 'FTR-005', keyword: '骨折', label: '骨折', templateId: 'tpl-fracture', templateName: '骨科随访(骨折)', intervals: [30, 90], hint: '骨折建议 1/3 个月复查 X 线评估骨痂形成', active: true },
  { id: 'FTR-006', keyword: '肝癌', label: '肝癌/肝脏占位', templateId: 'tpl-onc-ct', templateName: '肿瘤术后复查(CT)', intervals: [90, 180], hint: '肝癌建议 3/6 个月影像随访复查', active: true },
  { id: 'FTR-007', keyword: '甲状腺结节', label: '甲状腺结节', templateId: 'tpl-thyroid-benign', templateName: '甲状腺良性结节随访', intervals: [180, 360], hint: '甲状腺结节建议 6/12 个月超声随访', active: true },
  { id: 'FTR-008', keyword: '冠脉支架', label: '冠脉支架术后', templateId: 'tpl-stent', templateName: '冠脉支架术后随访', intervals: [30, 90, 180, 360], hint: '冠脉支架术后建议 1/3/6/12 个月随访复查', active: true },
  { id: 'FTR-009', keyword: '椎间盘突出', label: '椎间盘突出', templateId: 'tpl-spine-fusion', templateName: '脊柱融合术后随访', intervals: [90, 180, 360], hint: '腰椎病变建议 3/6/12 个月随访复查', active: true },
  { id: 'FTR-010', keyword: '动脉瘤', label: '脑动脉瘤', templateId: 'tpl-aneurysm', templateName: '脑动脉瘤随访', intervals: [90, 180, 360], hint: '脑动脉瘤建议 3/6/12 个月随访复查', active: true },
];

export function matchFollowUpRules(text: string): FollowUpTriggerRule[] {
  if (!text || text.trim().length === 0) return [];
  return FOLLOWUP_TRIGGER_RULES.filter((r) => r.active && text.includes(r.keyword));
}

const MODE_KEY = 'ris_followup_trigger_mode';

export interface FollowupAutoBookPanelProps {
  /** 报告文本 (所见/诊断建议拼接) */
  reportText: string;
  patientId?: string;
  patientName?: string;
  reportId?: string;
  examId?: string;
  /** 折叠展示 (默认展开) */
  defaultCollapsed?: boolean;
}

export default function FollowupAutoBookPanel({ reportText, patientId = '', patientName = '', reportId = '', examId = '', defaultCollapsed = false }: FollowupAutoBookPanelProps) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [mode, setMode] = useState<'auto' | 'hint'>(() => {
    try { return localStorage.getItem(MODE_KEY) === 'auto' ? 'auto' : 'hint'; } catch { return 'hint'; }
  });
  const [serverMode, setServerMode] = useState<'auto' | 'hint' | null>(null);
  const [creating, setCreating] = useState(false);
  const [createdCount, setCreatedCount] = useState<number | null>(null);

  // [v3.0.6.11-100 Wave2C P3] 读取后端 GET /followup-trigger-rules (模式配置), 失败回退本地
  useEffect(() => {
    let cancelled = false;
    followupApi.listTriggerRules().then((res) => {
      if (cancelled || !res.success) return;
      const m = res.data?.mode;
      if (m === 'auto' || m === 'hint') setServerMode(m);
    }).catch(() => { /* 静默: 后端不可用时仅用本地规则 */ });
    return () => { cancelled = true; };
  }, []);

  const matched = useMemo(() => matchFollowUpRules(reportText), [reportText]);

  const totalIntervals = useMemo(() => matched.reduce((s, r) => s + r.intervals.length, 0), [matched]);

  const handleToggleMode = useCallback((checked: boolean) => {
    const next: 'auto' | 'hint' = checked ? 'auto' : 'hint';
    setMode(next);
    try { localStorage.setItem(MODE_KEY, next); } catch { /* 忽略 */ }
    message.info(next === 'auto' ? t('w9e.followup.toggleAutoMsg') : t('w9e.followup.toggleHintMsg'));
  }, []);

  const handleCreate = useCallback(async () => {
    if (matched.length === 0 || !patientId) return;
    setCreating(true);
    setCreatedCount(null);
    try {
      let created = 0;
      const today = new Date().toISOString().slice(0, 10);
      // [v3.0.6.11-100 Wave2C P3] 按规则逐条创建计划 (后端 from-exam/模板 apply 由报告提交自动触发接管)
      for (const rule of matched) {
        for (const days of rule.intervals) {
          const res = await followupApi.create({
            patientId,
            patientName: patientName || t('w9e.followup.unknownPatient'),
            reportId: reportId || undefined,
            examId: examId || undefined,
            templateId: rule.templateId,
            planDate: today,
            intervalDays: days,
            note: t('w9e.followup.noteText', { label: rule.label, keyword: rule.keyword, days }),
            reminderEnabled: true,
          });
          if (res.success) created += 1;
        }
      }
      setCreatedCount(created);
      if (created > 0) {
        message.success(t('w9e.followup.createdMsg', { count: created }));
        navigate('/follow-up');
      } else {
        message.warning(t('w9e.followup.createFailedRetry'));
      }
    } catch {
      message.error(t('w9e.followup.createFailed'));
    } finally {
      setCreating(false);
    }
  }, [matched, patientId, patientName, reportId, examId, navigate]);

  if (matched.length === 0) return null;

  const effectiveMode = serverMode ?? mode;

  return (
    <Card
      size="small"
      className="v3-card no-print"
      title={
        <Space size={6}>
          <CalendarPlus className="w-4 h-4 text-emerald-500" />
          <span>{t('w9e.followup.title')}</span>
          <Tag color="emerald" className="m-0 text-[10px]">{t('w9e.followup.matchTag', { rules: matched.length, plans: totalIntervals })}</Tag>
          <Tooltip title={effectiveMode === 'auto' ? t('w9e.followup.autoModeTip') : t('w9e.followup.hintModeTip')}>
            <Tag color={effectiveMode === 'auto' ? 'green' : 'orange'} className="m-0 text-[10px] cursor-help">
              {effectiveMode === 'auto' ? t('w9e.followup.autoCreate') : t('w9e.followup.hintOnly')}
            </Tag>
          </Tooltip>
        </Space>
      }
      extra={
        <Space size={8}>
          <Space size={4} className="text-[11px] text-slate-500">
            <Bell className="w-3 h-3" />
            <span>{t('w9e.followup.autoCreate')}</span>
            <Switch size="small" checked={mode === 'auto'} onChange={handleToggleMode} />
          </Space>
          <Button size="small" type="text" className="p-0 h-auto text-[11px]" onClick={() => setCollapsed((c) => !c)}>
            {collapsed ? t('w9e.followup.expand') : t('w9e.followup.collapse')}
          </Button>
        </Space>
      }
    >
      {!collapsed && (
        <div className="space-y-2">
          {effectiveMode === 'hint' && (
            <Alert
              type="info"
              showIcon
              className="!text-[11px]"
              message={t('w9e.followup.hintAlert')}
            />
          )}
          <div className="space-y-1.5">
            {matched.map((r) => (
              <div key={r.id} className="flex items-start gap-2 p-2 border border-emerald-100 rounded bg-emerald-50/50">
                <Tag color="emerald" className="m-0 shrink-0 text-[10px]">「{r.keyword}」</Tag>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-700">{r.label} → <b>{r.templateName}</b>
                    <span className="text-slate-400 ml-1.5">{r.intervals.map((d) => t('w9e.followup.monthsUnit', { count: Math.round(d / 30) })).join(' / ')}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{r.hint}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-400">
              {patientId ? t('w9e.followup.patientLabel', { name: patientName || patientId }) : t('w9e.followup.missingPatient')}
              {createdCount != null && <span className="text-emerald-600 ml-2">{t('w9e.followup.createdCount', { count: createdCount })}</span>}
            </span>
            <Space>
              <Button
                size="small"
                type="primary"
                icon={creating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CalendarPlus className="w-3 h-3" />}
                loading={creating}
                disabled={!patientId}
                onClick={() => void handleCreate()}
              >
                {t('w9e.followup.createButton')}
              </Button>
              <Button size="small" icon={<ArrowRight className="w-3 h-3" />} onClick={() => navigate('/follow-up')}>
                {t('w9e.followup.manage')}
              </Button>
            </Space>
          </div>
        </div>
      )}
    </Card>
  );
}
