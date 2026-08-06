/**
 * G005 RIS v3.0.5.1 - ReviewCenterPage 综合审核中心
 */
import React, { useState } from 'react';
import { Tabs, Card, Space, Button, message, Drawer, Empty, Badge, Tag } from 'antd';
import { ClipboardCheck, ShieldCheck, Award, BarChart3, FileText, Users, Clock, ListChecks } from 'lucide-react';
import { InitialCheckList } from '../components/report/v3/R3.REVIEW/InitialCheckList';
import { FinalCheckList } from '../components/report/v3/R3.REVIEW/FinalCheckList';
import { CosignSchedule } from '../components/report/v3/R3.REVIEW/CosignSchedule';
import { ReviewCommentThread } from '../components/report/v3/R3.REVIEW/ReviewCommentThread';
import { RejectTemplateModal } from '../components/report/v3/R3.REVIEW/RejectTemplateModal';
import { ReviewWorkloadStats } from '../components/report/v3/R3.REVIEW/ReviewWorkloadStats';
import { ReviewSLA } from '../components/report/v3/R3.REVIEW/ReviewSLA';
import { ReviewAIHint } from '../components/report/v3/R3.REVIEW/ReviewAIHint';
import { ReviewerAssignment } from '../components/report/v3/R3.REVIEW/ReviewerAssignment';
import { ReviewHistory } from '../components/report/v3/R3.REVIEW/ReviewHistory';
import { reviewService } from '../services/review/reviewService';
import type { ReviewTask, RejectCategory } from '../types/R3/R3.REVIEW';
import { PageContainer, PageHeader } from '../components/common';

const ReviewCenterPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('initial');
  const [selectedTask, setSelectedTask] = useState<ReviewTask | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const handleSelect = (task: ReviewTask) => {
    setSelectedTask(task);
    setDrawerOpen(true);
  };

  const handleApprove = async () => {
    if (!selectedTask) return;
    try {
      if (selectedTask.stage === 'initial') {
        await reviewService.approveInitial(selectedTask.id, 'D001', '当前用户', 92, '同意初审');
      } else if (selectedTask.stage === 'final') {
        await reviewService.approveFinal(selectedTask.id, 'D001', '当前用户', 92, '同意终审', selectedTask.needsCosign);
      }
      message.success('审核通过');
      setDrawerOpen(false);
    } catch (e: any) {
      message.error(e?.message ?? '操作失败');
    }
  };

  const handleReject = async (taskId: string, reason: string, category: RejectCategory) => {
    try {
      await reviewService.reject(taskId, 'D001', '当前用户', reason, category);
      message.success('已驳回');
      setRejectOpen(false);
      setDrawerOpen(false);
    } catch (e: any) {
      message.error(e?.message ?? '驳回失败');
      throw e;
    }
  };

  return (
    <PageContainer background="slate" maxWidth="full" padding={16} testId="review-center-page">
      <PageHeader
        title="综合审核中心"
        subtitle="审核流 · 初核/终核/双签/工作量/SLA"
        icon={<ClipboardCheck size={20} color="#1e40af" />}
        variant="inline"
      />

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        tabBarExtraContent={
          <Badge
            count={6}
            title="审核中心模块 6 项"
            style={{ backgroundColor: '#1e40af' }}
          />
        }
        items={[
          { key: 'initial', label: <Space><ListChecks size={14} />初核清单</Space>, children: <InitialCheckList onSelect={handleSelect} selectedId={selectedTask?.id} /> },
          { key: 'final', label: <Space><ShieldCheck size={14} />终核清单</Space>, children: <FinalCheckList onSelect={handleSelect} selectedId={selectedTask?.id} /> },
          { key: 'cosign', label: <Space><Award size={14} />Cosign 排程</Space>, children: <CosignSchedule /> },
          { key: 'workload', label: <Space><BarChart3 size={14} />工作量统计</Space>, children: <ReviewWorkloadStats /> },
          { key: 'sla', label: <Space><Clock size={14} />SLA 监控</Space>, children: <ReviewSLA /> },
          { key: 'assign', label: <Space><Users size={14} />审核员指派</Space>, children: <ReviewerAssignment task={selectedTask} /> },
        ]}
      />

      <Drawer
        title={selectedTask ? `${selectedTask.patientName} · ${selectedTask.modality} ${selectedTask.bodyPart}` : '审核详情'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={720}
        extra={selectedTask && (
          <Space>
            <Button type="primary" onClick={handleApprove}>通过</Button>
            <Button danger onClick={() => setRejectOpen(true)}>驳回</Button>
          </Space>
        )}
      >
        {selectedTask ? (
          <Space orientation="vertical" style={{ width: '100%' }} size={12}>
            <Card size="small" title={<Space><FileText size={14} />报告内容</Space>}>
              <div style={{ fontSize: 12 }}>
                <p><strong>报告 ID：</strong>{selectedTask.reportId}</p>
                <p><strong>检查：</strong>{selectedTask.modality} {selectedTask.bodyPart}</p>
                <p><strong>报告医生：</strong>{selectedTask.authorTitle} {selectedTask.authorName}</p>
                <p><strong>质量评分：</strong><Tag color={selectedTask.qualityScore >= 90 ? 'green' : selectedTask.qualityScore >= 75 ? 'blue' : 'orange'}>{selectedTask.qualityScore}</Tag></p>
                <p><strong>检查所见：</strong>影像表现符合患者临床病史，请结合化验综合判断。</p>
                <p><strong>诊断意见：</strong>{selectedTask.criticalFinding ? '⚠ 危急值需紧急处理' : '考虑炎症可能，建议随访。'}</p>
                {selectedTask.criticalFinding && (
                  <p style={{ color: '#dc2626', fontWeight: 600 }}>⚠ 检测到危急值，建议双签</p>
                )}
              </div>
            </Card>

            <ReviewAIHint reportId={selectedTask.reportId} />

            <ReviewCommentThread taskId={selectedTask.id} currentUserId="D001" currentUserName="当前用户" />

            <ReviewHistory reportId={selectedTask.reportId} />
          </Space>
        ) : <Empty />}
      </Drawer>

      <RejectTemplateModal
        open={rejectOpen}
        taskId={selectedTask?.id ?? null}
        onClose={() => setRejectOpen(false)}
        onConfirm={handleReject}
        reviewerId="D001"
        reviewerName="当前用户"
      />
    </PageContainer>
  );
};

export default ReviewCenterPage;
