/**
 * G005 RIS v3.0.5.1 - ReviewCenterPage 综合审核中心
 * [v3.0.6.11-81] W2-B: 初核/终核待办接 reportApi.list (INITIAL_REVIEW/FINAL_REVIEW),
 *   Cosign 待办接 cosignApi.getPending/getStats; 失败回退演示数据
 */
import { PageContainer, PageHeader } from '../components/common';
import { CosignSchedule } from '../components/report/v3/R3.REVIEW/CosignSchedule';
import { FinalCheckList } from '../components/report/v3/R3.REVIEW/FinalCheckList';
import { InitialCheckList } from '../components/report/v3/R3.REVIEW/InitialCheckList';
import { RejectTemplateModal } from '../components/report/v3/R3.REVIEW/RejectTemplateModal';
import { ReviewAIHint } from '../components/report/v3/R3.REVIEW/ReviewAIHint';
import { ReviewCommentThread } from '../components/report/v3/R3.REVIEW/ReviewCommentThread';
import { ReviewerAssignment } from '../components/report/v3/R3.REVIEW/ReviewerAssignment';
import { ReviewHistory } from '../components/report/v3/R3.REVIEW/ReviewHistory';
import { ReviewSLA } from '../components/report/v3/R3.REVIEW/ReviewSLA';
import { ReviewWorkloadStats } from '../components/report/v3/R3.REVIEW/ReviewWorkloadStats';
import { coSignApi } from '../services/api/cosignApi';
import { reportApi } from '../services/api/reportApi';
import { reviewService } from '../services/review/reviewService';
import type { ReviewTask, RejectCategory } from '../types/R3/R3.REVIEW';
import { Tabs, Card, Space, Button, message, Drawer, Empty, Badge, Tag, Spin, Alert } from 'antd';
import { ClipboardCheck, ShieldCheck, Award, BarChart3, FileText, Users, Clock, ListChecks } from 'lucide-react';
import { Inbox } from 'lucide-react'
import React, { useState, useEffect } from 'react';
// [v3.0.6.11-104 Wave 5C] 报告审核收敛: ReviewCheckPage + DualReadPage 内嵌为 Tab (旧路由 /review-check, /dual-read redirect)
import ReviewCheckPage from './review/ReviewCheckPage';
import DualReadPage from './review/DualReadPage';
import { t } from '../i18n/appI18n';

const ReviewCenterPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('initial');
  const [selectedTask, setSelectedTask] = useState<ReviewTask | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  // [W2-B] 真实化: 审核待办计数 (reportApi 状态过滤 + cosignApi)
  const [summary, setSummary] = useState<{
    initial: number;
    final: number;
    cosign: number;
    cosignApproved: number;
    onTimeRate: number | null;
  }>({ initial: 0, final: 0, cosign: 0, cosignApproved: 0, onTimeRate: null });
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'api' | 'fallback'>('api');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setSummaryLoading(true);
      setSummaryError(null);
      try {
        const [initialRes, finalRes, cosignRes, cosignStatsRes] = await Promise.all([
          reportApi.list({ take: '1', state: 'INITIAL_REVIEW' }),
          reportApi.list({ take: '1', state: 'FINAL_REVIEW' }),
          coSignApi.getPending(),
          coSignApi.getStats(),
        ]);
        if (cancelled) return;
        const countOf = (res: { success: boolean; data?: unknown; meta?: unknown }) =>
          (res as any)?.meta?.total ?? (Array.isArray((res as any)?.data) ? (res as any).data.length : 0);
        setSummary({
          initial: countOf(initialRes as any),
          final: countOf(finalRes as any),
          cosign: Array.isArray(cosignRes.data) ? cosignRes.data.length : 0,
          cosignApproved: cosignStatsRes.success ? cosignStatsRes.data?.approved ?? 0 : 0,
          onTimeRate: cosignStatsRes.success ? (cosignStatsRes.data?.onTimeRate ?? null) : null,
        });
        setDataSource('api');
      } catch {
        if (!cancelled) {
          setDataSource('fallback');
          setSummaryError(t('reviewCenter.summaryLoadFailed'));
        }
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSelect = (task: ReviewTask) => {
    setSelectedTask(task);
    setDrawerOpen(true);
  };

  const handleApprove = async () => {
    if (!selectedTask) return;
    try {
      if (selectedTask.stage === 'initial') {
        await reviewService.approveInitial(selectedTask.id, 'D001', t('reviewCenter.currentUser'), 92, t('reviewCenter.approveInitialComment'));
      } else if (selectedTask.stage === 'final') {
        await reviewService.approveFinal(selectedTask.id, 'D001', t('reviewCenter.currentUser'), 92, t('reviewCenter.approveFinalComment'), selectedTask.needsCosign);
      }
      message.success(t('reviewCenter.approved'));
      setDrawerOpen(false);
    } catch (e: any) {
      message.error(e?.message ?? t('reviewCenter.operationFailed'));
    }
  };

  const handleReject = async (taskId: string, reason: string, category: RejectCategory) => {
    try {
      await reviewService.reject(taskId, 'D001', t('reviewCenter.currentUser'), reason, category);
      message.success(t('reviewCenter.rejected'));
      setRejectOpen(false);
      setDrawerOpen(false);
    } catch (e: any) {
      message.error(e?.message ?? t('reviewCenter.rejectFailed'));
      throw e;
    }
  };

  return (
    <PageContainer background="slate" maxWidth="full" padding={16} testId="review-center-page">
      <PageHeader
        title={t('reviewCenter.title')}
        subtitle={t('reviewCenter.subtitle')}
        icon={<ClipboardCheck size={20} color="#1e40af" />}
        variant="inline"
        actions={
          <Space size={8} wrap>
            {summaryLoading && <Spin size="small" />}
            <Tag color={dataSource === 'api' ? 'green' : 'orange'}>
              {dataSource === 'api' ? t('reviewCenter.realStats') : t('reviewCenter.demoData')}
            </Tag>
            {summaryError && <Alert type="warning" showIcon message={summaryError} style={{ maxWidth: 280 }} />}
          </Space>
        }
      />

      {/* [W2-B] 真实化: 审核待办概览 (reportApi 状态过滤 + cosignApi) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: t('reviewCenter.initialPending'), value: summary.initial, icon: <ListChecks size={16} />, color: '#2563eb', bg: '#3b82f622' },
          { label: t('reviewCenter.finalPending'), value: summary.final, icon: <ShieldCheck size={16} />, color: '#7c3aed', bg: '#8b5cf622' },
          { label: t('reviewCenter.cosignPending'), value: summary.cosign, icon: <Award size={16} />, color: '#d97706', bg: '#f59e0b22' },
          { label: t('reviewCenter.cosignOnTimeRate'), value: summary.onTimeRate != null ? `${summary.onTimeRate}%` : '-', icon: <Clock size={16} />, color: '#059669', bg: '#22c55e22' },
        ].map(c => (
          <div key={c.label} style={{ background: c.bg, borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: c.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.color }}>{c.icon}</div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>{c.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        tabBarExtraContent={
          <Badge
            count={8}
            title={t('reviewCenter.moduleCount')}
            style={{ backgroundColor: '#1e40af' }}
          />
        }
        items={[
          { key: 'initial', label: <Space><ListChecks size={14} />{t('reviewCenter.initialList')}</Space>, children: <InitialCheckList onSelect={handleSelect} selectedId={selectedTask?.id} /> },
          { key: 'final', label: <Space><ShieldCheck size={14} />{t('reviewCenter.finalList')}</Space>, children: <FinalCheckList onSelect={handleSelect} selectedId={selectedTask?.id} /> },
          { key: 'cosign', label: <Space><Award size={14} />{t('reviewCenter.cosignSchedule')}</Space>, children: <CosignSchedule /> },
          { key: 'workload', label: <Space><BarChart3 size={14} />{t('reviewCenter.workloadStats')}</Space>, children: <ReviewWorkloadStats /> },
          { key: 'sla', label: <Space><Clock size={14} />{t('reviewCenter.slaMonitor')}</Space>, children: <ReviewSLA /> },
          { key: 'assign', label: <Space><Users size={14} />{t('reviewCenter.reviewerAssignment')}</Space>, children: <ReviewerAssignment task={selectedTask} /> },
          // [v3.0.6.11-104 Wave 5C] 报告审核收敛: 初核/终核/复审 + 双阅片工作流
          { key: 'reviewCheck', label: <Space><ClipboardCheck size={14} />{t('nav.reviewCheck')}</Space>, children: <div data-testid="review-embedded-check"><ReviewCheckPage /></div> },
          { key: 'dualRead', label: <Space><BarChart3 size={14} />{t('nav.dualRead')}</Space>, children: <div data-testid="review-embedded-dual-read"><DualReadPage /></div> },
        ]}
      />

      <Drawer
        title={selectedTask ? `${selectedTask.patientName} · ${selectedTask.modality} ${selectedTask.bodyPart}` : t('reviewCenter.reviewDetail')}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={720}
        extra={selectedTask && (
          <Space>
            <Button type="primary" onClick={handleApprove}>{t('reviewCenter.approve')}</Button>
            <Button danger onClick={() => setRejectOpen(true)}>{t('reviewCenter.reject')}</Button>
          </Space>
        )}
      >
        {selectedTask ? (
          <Space orientation="vertical" style={{ width: '100%' }} size={12}>
            <Card size="small" title={<Space><FileText size={14} />{t('reviewCenter.reportContent')}</Space>}>
              <div style={{ fontSize: 12 }}>
                <p><strong>{t('reviewCenter.reportIdLabel')}</strong>{selectedTask.reportId}</p>
                <p><strong>{t('reviewCenter.examLabel')}</strong>{selectedTask.modality} {selectedTask.bodyPart}</p>
                <p><strong>{t('reviewCenter.authorLabel')}</strong>{selectedTask.authorTitle} {selectedTask.authorName}</p>
                <p><strong>{t('reviewCenter.qualityScoreLabel')}</strong><Tag color={selectedTask.qualityScore >= 90 ? 'green' : selectedTask.qualityScore >= 75 ? 'blue' : 'orange'}>{selectedTask.qualityScore}</Tag></p>
                <p><strong>{t('reviewCenter.findingsLabel')}</strong>{t('reviewCenter.findingsText')}</p>
                <p><strong>{t('reviewCenter.diagnosisLabel')}</strong>{selectedTask.criticalFinding ? t('reviewCenter.criticalFindingText') : t('reviewCenter.diagnosisText')}</p>
                {selectedTask.criticalFinding && (
                  <p style={{ color: '#dc2626', fontWeight: 600 }}>{t('reviewCenter.criticalCosignHint')}</p>
                )}
              </div>
            </Card>

            <ReviewAIHint reportId={selectedTask.reportId} />

            <ReviewCommentThread taskId={selectedTask.id} currentUserId="D001" currentUserName={t('reviewCenter.currentUser')} />

            <ReviewHistory reportId={selectedTask.reportId} />
          </Space>
        ) : <Empty description={t('reviewCenter.noData')} image={<Inbox size={48} style={{opacity:0.4}}/>} />}
      </Drawer>

      <RejectTemplateModal
        open={rejectOpen}
        taskId={selectedTask?.id ?? null}
        onClose={() => setRejectOpen(false)}
        onConfirm={handleReject}
        reviewerId="D001"
        reviewerName={t('reviewCenter.currentUser')}
      />
    </PageContainer>
  );
};

export default ReviewCenterPage;
