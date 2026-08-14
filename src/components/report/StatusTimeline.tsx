// ============================================================
// G005 放射科RIS系统 v1.0.1 - 报告状态时间线
// Phase R0：显示报告从创建到当前的状态变迁
// ============================================================

import React from 'react';
import { Clock, CheckCircle2 } from 'lucide-react';
import type { RadiologyReport } from '../../types';
import { StatusBadge } from './StatusBadge';
import { statusTransitionLog } from '../../data/reportSubsystemMock';
import { REPORT_STATUS_ORDER } from './statusMeta';

// [v3.0.6.11-95 Wave2B P1] 真实审计轨迹事件 (与 ReportAuditTrailDrawer 形状对齐)
export interface AuditTrailEvent {
  id?: string;
  timestamp?: string;
  actor?: string;
  action?: string;
  fromState?: string;
  toState?: string;
  reason?: string;
}

export interface StatusTimelineProps {
  report: RadiologyReport;
  showAuditInfo?: boolean;
  compact?: boolean;
  // [v3.0.6.11-95 Wave2B P1] 传入真实 auditTrail 时渲染真实时间节点, 否则回退 mock + "演示数据"标注
  auditTrail?: AuditTrailEvent[];
}

interface TimelineNode {
  status: string;
  timestamp: string;
  operator: string;
  operatorName: string;
  comment?: string;
  isCurrent: boolean;
  isFuture: boolean;
}

export const StatusTimeline: React.FC<StatusTimelineProps> = ({
  report,
  showAuditInfo = true,
  compact = false,
  auditTrail,
}) => {
  // [v3.0.6.11-95 Wave2B P1] 真实审计轨迹优先: 有则渲染真实节点 (操作/状态/时间/操作人)
  const realEvents = Array.isArray(auditTrail) && auditTrail.length > 0 ? auditTrail : null;
  // 从全局日志中找出当前报告的状态变迁
  const transitions = statusTransitionLog.filter(t => t.reportId === report.id);
  // transitions 暂未在节点构造中直接使用，预留给未来扩展
  void transitions;

  // 构造时间线节点（合并系统时间和操作人）
  const nodes: TimelineNode[] = [];

  // 节点 1：创建（待分配/已分配）
  if (report.status === '待分配') {
    nodes.push({
      status: '待分配',
      timestamp: report.createdTime,
      operator: 'system',
      operatorName: '系统',
      isCurrent: true,
      isFuture: false,
    });
  } else {
    nodes.push({
      status: report.assignedTime ? '已分配' : '待分配',
      timestamp: report.assignedTime || report.createdTime,
      operator: report.assignedDoctorId || 'system',
      operatorName: report.assignedDoctorName || '系统',
      comment: report.assignedTime ? `智能分诊指派给 ${report.assignedDoctorName}` : undefined,
      isCurrent: report.status === '已分配',
      isFuture: false,
    });
  }

  // 节点 2：书写中（如已分配/书写中/已提交等之后状态）
  if (report.assignedTime && report.status !== '已分配' && report.status !== '待分配') {
    const writingTime = report.draftSavedAt || report.updatedTime;
    nodes.push({
      status: '书写中',
      timestamp: writingTime,
      operator: report.assignedDoctorId || 'system',
      operatorName: report.assignedDoctorName || '系统',
      comment: `字数 ${report.wordCount || 0}`,
      isCurrent: report.status === '书写中',
      isFuture: false,
    });
  }

  // 节点 3：已提交
  if (['已提交', '初审中', '初审通过', '终审中', '已审核', '签发中', '已签发', '已发布', '修订中', '已修订', '已撤回', '已驳回', '已归档'].includes(report.status)) {
    nodes.push({
      status: '已提交',
      timestamp: report.reportDoctorId ? report.updatedTime : report.createdTime,
      operator: report.reportDoctorId || 'system',
      operatorName: report.reportDoctorName || '系统',
      isCurrent: report.status === '已提交',
      isFuture: false,
    });
  }

  // 节点 4：初审
  if (report.initialAuditTime) {
    nodes.push({
      status: report.initialAuditSuggestion ? '初审通过' : '初审中',
      timestamp: report.initialAuditTime,
      operator: report.initialAuditDoctorId || 'system',
      operatorName: report.initialAuditDoctorName || '系统',
      comment: report.initialAuditSuggestion,
      isCurrent: report.status === '初审中' || (report.status === '初审通过' && !report.finalAuditTime),
      isFuture: false,
    });
  }

  // 节点 5：终审
  if (report.finalAuditTime) {
    nodes.push({
      status: '已审核',
      timestamp: report.finalAuditTime,
      operator: report.finalAuditDoctorId || 'system',
      operatorName: report.finalAuditDoctorName || '系统',
      comment: '终审通过',
      isCurrent: report.status === '已审核',
      isFuture: false,
    });
  }

  // 节点 6：签发
  if (report.signedTime) {
    nodes.push({
      status: '已签发',
      timestamp: report.signedTime,
      operator: report.reportDoctorId || 'system',
      operatorName: report.reportDoctorName || '系统',
      comment: 'CA 签名完成',
      isCurrent: report.status === '已签发' || report.status === '签发中',
      isFuture: false,
    });
  }

  // 节点 7：发布
  if (report.publishedTime) {
    nodes.push({
      status: '已发布',
      timestamp: report.publishedTime,
      operator: report.publishedBy || 'system',
      operatorName: report.publishedBy || '系统',
      comment: '报告已发布给临床和患者',
      isCurrent: report.status === '已发布',
      isFuture: false,
    });
  }

  // 特殊状态节点
  if (report.status === '已驳回') {
    nodes.push({
      status: '已驳回',
      timestamp: report.finalAuditTime || report.initialAuditTime || report.updatedTime,
      operator: report.finalAuditDoctorId || report.initialAuditDoctorId || 'system',
      operatorName: report.finalAuditDoctorName || report.initialAuditDoctorName || '系统',
      comment: '报告驳回，等待医生修改',
      isCurrent: true,
      isFuture: false,
    });
  } else if (report.status === '修订中') {
    nodes.push({
      status: '修订中',
      timestamp: report.updatedTime,
      operator: report.reportDoctorId || 'system',
      operatorName: report.reportDoctorName || '系统',
      comment: '报告修订中（病理回报/补充发现）',
      isCurrent: true,
      isFuture: false,
    });
  } else if (report.status === '已修订') {
    nodes.push({
      status: '已修订',
      timestamp: report.updatedTime,
      operator: report.reportDoctorId || 'system',
      operatorName: report.reportDoctorName || '系统',
      comment: '报告已修订完成',
      isCurrent: true,
      isFuture: false,
    });
  } else if (report.status === '已撤回') {
    nodes.push({
      status: '已撤回',
      timestamp: report.updatedTime,
      operator: report.publishedBy || 'system',
      operatorName: report.publishedBy || '系统',
      comment: '已发布报告被撤回',
      isCurrent: true,
      isFuture: false,
    });
  } else if (report.status === '已归档') {
    nodes.push({
      status: '已归档',
      timestamp: report.updatedTime,
      operator: 'system',
      operatorName: '系统',
      comment: '报告已归档到长期存储',
      isCurrent: true,
      isFuture: false,
    });
  }

  // 计算当前节点在状态机中的位置
  const currentStatusIndex = REPORT_STATUS_ORDER.indexOf(report.status as any);

  // 添加未达成的未来节点（仅在非特殊状态下显示）
  if (!['已驳回', '已撤回', '已归档', '修订中', '已修订'].includes(report.status)) {
    // 不再追加未来节点，保持简洁
  }

  return (
    <div style={{
      background: 'var(--bg-primary)',
      border: '1px solid var(--border-color)',
      borderRadius: 8,
      padding: compact ? 12 : 16,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={14} color="#64748b" />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>状态时间线</span>
          {realEvents ? (
            <span style={{
              fontSize: 10, padding: '1px 6px', borderRadius: 3,
              background: 'var(--color-success-bg)', color: '#15803d', fontWeight: 700,
            }}>真实轨迹</span>
          ) : (
            <span style={{
              fontSize: 10, padding: '1px 6px', borderRadius: 3,
              background: 'var(--color-warning-bg)', color: '#b45309', fontWeight: 700,
            }}>演示数据</span>
          )}
        </div>
        <StatusBadge status={report.status} size="sm" />
      </div>

      <div style={{ position: 'relative' }}>
        {realEvents ? realEvents.map((ev, idx) => {
          const isLast = idx === realEvents.length - 1;
          const label = ev.action || [ev.fromState, ev.toState].filter(Boolean).join(' → ') || '状态变更';
          return (
            <div key={ev.id ?? idx} style={{ display: 'flex', gap: 12, paddingLeft: 8, paddingBottom: isLast ? 0 : 12, position: 'relative' }}>
              {!isLast && (
                <div style={{ position: 'absolute', left: 14, top: 20, bottom: -4, width: 2, background: isLast ? '#3b82f6' : '#cbd5e1' }} />
              )}
              <div style={{
                width: 12, height: 12, borderRadius: '50%',
                background: isLast ? '#3b82f6' : '#10b981',
                border: isLast ? '3px solid #dbeafe' : '2px solid #fff',
                boxShadow: isLast ? '0 0 0 2px #3b82f6' : '0 0 0 1px #cbd5e1',
                flexShrink: 0, marginTop: 4, zIndex: 1,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>{label}</span>
                  <span style={{ fontSize: 12, color: '#64748b' }}>{ev.timestamp ? new Date(ev.timestamp).toLocaleString() : ''}</span>
                </div>
                {ev.fromState && ev.toState && (
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    {ev.fromState} → {ev.toState}
                  </div>
                )}
                {showAuditInfo && ev.actor && (
                  <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>操作人: {ev.actor}</div>
                )}
                {showAuditInfo && ev.reason && (
                  <div style={{
                    fontSize: 12, color: '#64748b', background: 'var(--bg-card)',
                    padding: '4px 8px', borderRadius: 4, marginTop: 4,
                    border: '1px solid var(--border-color)',
                  }}>
                    {ev.reason}
                  </div>
                )}
              </div>
            </div>
          );
        }) : nodes.map((node, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              gap: 12,
              paddingLeft: 8,
              paddingBottom: idx < nodes.length - 1 ? 12 : 0,
              position: 'relative',
            }}
          >
            {/* 竖线 */}
            {idx < nodes.length - 1 && (
              <div style={{
                position: 'absolute',
                left: 14,
                top: 20,
                bottom: -4,
                width: 2,
                background: node.isCurrent ? '#3b82f6' : '#cbd5e1',
              }} />
            )}

            {/* 圆点 */}
            <div style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: node.isCurrent ? '#3b82f6' : node.isFuture ? '#e5e7eb' : '#10b981',
              border: node.isCurrent ? '3px solid #dbeafe' : '2px solid #fff',
              boxShadow: node.isCurrent ? '0 0 0 2px #3b82f6' : '0 0 0 1px #cbd5e1',
              flexShrink: 0,
              marginTop: 4,
              zIndex: 1,
            }} />

            {/* 内容 */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <StatusBadge status={node.status} size="sm" showIcon={false} />
                <span style={{ fontSize: 12, color: '#64748b' }}>{node.timestamp}</span>
              </div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                {node.operatorName}
              </div>
              {showAuditInfo && node.comment && (
                <div style={{
                  fontSize: 12,
                  color: '#64748b',
                  background: 'var(--bg-card)',
                  padding: '4px 8px',
                  borderRadius: 4,
                  marginTop: 4,
                  border: '1px solid var(--border-color)',
                }}>
                  {node.comment}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 当前状态机位置指示 */}
      {currentStatusIndex >= 0 && (
        <div style={{
          marginTop: 12,
          padding: '6px 10px',
          background: 'var(--color-info-bg)',
          border: '1px solid #bfdbfe',
          borderRadius: 6,
          fontSize: 12,
          color: '#1e40af',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <CheckCircle2 size={12} />
          <span>
            状态机进度：
            <strong> {currentStatusIndex + 1} / {REPORT_STATUS_ORDER.length} </strong>
            （共 {REPORT_STATUS_ORDER.length} 态）
          </span>
        </div>
      )}
    </div>
  );
};

export default StatusTimeline;
