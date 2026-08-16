/**
 * G005 RIS v3.0.6.11-103 Wave 12 — ReportFlowBar 报告流程状态条
 * 展示报告状态机 7 态: 待写 → 书写中 → 已提交 → 双签中 → 已审核 → 已发布 → 已归档
 * 当前状态高亮 + 下一步操作按钮 (一键流转, 走 reportApi transition)
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Card, Steps, Space, Tag, Button, Tooltip, message } from 'antd';
import { ArrowRight, FileEdit, PencilLine, Send, FileCheck2, ShieldCheck, Globe2, Archive, RotateCcw, CheckCircle2 } from 'lucide-react';
import { reportApi } from '@services/api/reportApi';
import { api } from '@services/api/client';
import { getCurrentUser } from '@utils/auth';
import { toEnState } from '@components/report/statusMeta';
import { t } from '@i18n/appI18n';

export interface ReportFlowBarProps {
  /** 当前报告状态 (原始值: 后端英文 / MSW 中文 / 机器态均可) */
  status?: string | null;
  reportId?: string | null;
  /** 流转成功回调 (调用方同步本地状态) */
  onTransited?: (to: string) => void;
  compact?: boolean;
}

export interface FlowStepMeta {
  key: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string; size?: number | string }>;
}

export const REPORT_FLOW_STEPS: FlowStepMeta[] = [
  { key: 'todo', labelKey: 'w12.reportFlow.stepTodo', icon: FileEdit },
  { key: 'writing', labelKey: 'w12.reportFlow.stepWriting', icon: PencilLine },
  { key: 'submitted', labelKey: 'w12.reportFlow.stepSubmitted', icon: Send },
  { key: 'cosign', labelKey: 'w12.reportFlow.stepCosign', icon: FileCheck2 },
  { key: 'reviewed', labelKey: 'w12.reportFlow.stepReviewed', icon: ShieldCheck },
  { key: 'published', labelKey: 'w12.reportFlow.stepPublished', icon: Globe2 },
  { key: 'archived', labelKey: 'w12.reportFlow.stepArchived', icon: Archive },
];

/** 原始状态 → 7 态索引 (0=待写 … 6=已归档) */
export function reportFlowIndex(status?: string | null): number {
  const en = toEnState(status);
  switch (en) {
    case 'PENDING_ASSIGNMENT':
    case 'ASSIGNED':
    case 'DRAFT':
      return 0;
    case 'WRITING':
    case 'REJECTED':
    case 'AMENDING':
    case 'SUPPLEMENTING':
    case 'RECTIFYING':
    case 'REDISTRIBUTING':
      return 1;
    case 'SUBMITTED':
      return 2;
    case 'INITIAL_REVIEW':
    case 'FINAL_REVIEW':
    case 'CO_SIGN_REVIEW':
    case 'SIGNING':
    case 'ESCALATED':
      return 3;
    case 'REVIEWED':
    case 'SIGNED':
    case 'AMENDED':
    case 'SUPPLEMENTED':
      return 4;
    case 'PUBLISHED':
      return 5;
    case 'ARCHIVED':
      return 6;
    case 'WITHDRAWN':
      return 1;
    default:
      return 0;
  }
}

interface NextAction {
  labelKey: string;
  run: (id: string) => Promise<boolean>;
}

/** 根据当前状态推导下一步动作 (一键流转) */
export function nextFlowAction(status?: string | null): NextAction | null {
  const en = toEnState(status);
  switch (en) {
    case 'PENDING_ASSIGNMENT':
    case 'ASSIGNED':
    case 'DRAFT':
      return { labelKey: 'w12.reportFlow.actStartWriting', run: (id) => reportApi.startWriting(id, '报告流程条: 开始书写').then((r) => r.success) };
    case 'WRITING':
      return { labelKey: 'w12.reportFlow.actSubmit', run: (id) => reportApi.submitForReview(id).then((r) => r.success) };
    case 'REJECTED':
      return { labelKey: 'w12.reportFlow.actRework', run: (id) => reportApi.rework(id, '报告流程条: 退回重写').then((r) => r.success) };
    case 'SUBMITTED':
      return { labelKey: 'w12.reportFlow.actInitialReview', run: async (id) => {
        const res = await api.post(`/reports/${id}/transition`, { to: 'INITIAL_REVIEW', actorId: getCurrentUser()?.id ?? 'unknown' });
        return res.success;
      } };
    case 'INITIAL_REVIEW':
      return { labelKey: 'w12.reportFlow.actInitialReview', run: (id) => reportApi.review(id).then((r) => r.success) };
    case 'FINAL_REVIEW':
      return { labelKey: 'w12.reportFlow.actFinalReview', run: (id) => reportApi.review(id).then((r) => r.success) };
    case 'CO_SIGN_REVIEW':
      return { labelKey: 'w12.reportFlow.actCosign', run: (id) => reportApi.completeCosignReview(id).then((r) => r.success) };
    case 'REVIEWED':
    case 'SIGNING':
      return { labelKey: 'w12.reportFlow.actSign', run: (id) => reportApi.sign(id).then((r) => r.success) };
    case 'SIGNED':
      return { labelKey: 'w12.reportFlow.actPublish', run: (id) => reportApi.publish(id).then((r) => r.success) };
    case 'PUBLISHED':
      return { labelKey: 'w12.reportFlow.actArchive', run: (id) => reportApi.archiveReport(id).then((r) => r.success) };
    default:
      return null;
  }
}

const ReportFlowBar: React.FC<ReportFlowBarProps> = ({ status, reportId, onTransited, compact }) => {
  const [busy, setBusy] = useState(false);
  const current = reportFlowIndex(status);
  const action = nextFlowAction(status);
  const statusEn = toEnState(status);

  const handleNext = useCallback(async () => {
    if (!action || !reportId || busy) return;
    setBusy(true);
    try {
      const ok = await action.run(reportId);
      const nextIdx = Math.min(current + 1, REPORT_FLOW_STEPS.length - 1);
      const nextStep = REPORT_FLOW_STEPS[nextIdx] ?? REPORT_FLOW_STEPS[0];
      const toLabel = nextStep ? t(nextStep.labelKey) : statusEn;
      if (ok) {
        message.success(t('w12.reportFlow.success', { from: statusEn, to: toLabel }));
        onTransited?.(statusEn);
      } else {
        message.error(t('w12.reportFlow.fail'));
      }
    } catch {
      message.error(t('w12.reportFlow.fail'));
    } finally {
      setBusy(false);
    }
  }, [action, reportId, busy, onTransited, statusEn, current]);

  const items = useMemo(() => REPORT_FLOW_STEPS.map((s, i) => {
    const Icon = s.icon;
    return {
      title: (
        <span className="text-xs" data-testid={`report-flow-step-${s.key}`}>{t(s.labelKey)}</span>
      ),
      icon: <Icon className={i <= current ? 'text-blue-600' : 'text-slate-400'} size={14} />,
      description: i === current ? <Tag color="blue" className="m-0 text-[10px]">当前</Tag> : undefined,
    };
  }), [current]);

  return (
    <Card size="small" className="v3-card no-print" data-testid="report-flow-bar"
      title={
        <Space size={6}>
          <CheckCircle2 className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-semibold">{t('w12.reportFlow.title')}</span>
          <Tag color={current >= 5 ? 'green' : current >= 2 ? 'purple' : 'orange'} className="m-0 text-[10px]">
            {(REPORT_FLOW_STEPS[current] ?? REPORT_FLOW_STEPS[0])?.labelKey ? t((REPORT_FLOW_STEPS[current] ?? REPORT_FLOW_STEPS[0])!.labelKey) : statusEn}
          </Tag>
        </Space>
      }
      extra={
        <Space size={6}>
          {action && reportId ? (
            <Tooltip title={t('w12.reportFlow.nextAction')}>
              <Button
                type="primary"
                size="small"
                icon={<ArrowRight className="w-3 h-3" />}
                loading={busy}
                onClick={() => void handleNext()}
                data-testid="report-flow-next-action"
              >
                {t(action.labelKey)}
              </Button>
            </Tooltip>
          ) : (
            <Tooltip title={t('w12.reportFlow.noNext')}>
              <Tag icon={<RotateCcw className="w-3 h-3" />} color="default" className="m-0">{t('w12.reportFlow.noNext')}</Tag>
            </Tooltip>
          )}
        </Space>
      }
      styles={{ body: { paddingTop: compact ? 4 : 8, paddingBottom: 8 } }}
    >
      <Steps
        size="small"
        current={current}
        items={items}
        className="report-flow-steps"
      />
    </Card>
  );
};

export default ReportFlowBar;
