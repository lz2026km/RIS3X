/**
 * v3.0.6.12-A4: 危急值事件 shape 适配器
 *
 * store.criticalEvents collection 现以 GENERATED_CRITICAL_VALUES (CriticalValue 形状) 为唯一来源.
 * 历史下游服务 (NhqmReporter / JciReporter / criticalValueService / ReceiverPortalPage) 仍依赖
 * R3.CRITICAL 的 CriticalEvent 形状 (带 level / sop / dualReview / escalationLevel / hash / auditChain).
 *
 * 本文件提供 mapUnifiedToCriticalEvent(), 将 CriticalValue[] 转回 R3.CRITICAL.CriticalEvent[],
 * 对缺失字段填充兜底值, 保证下游服务零修改即可继续运行.
 */
import type { CriticalValue } from '../pages/critical/types';
import type { CriticalEvent, CriticalStatus } from '../types/R3/R3.CRITICAL';

const SEVERITY_TO_LEVEL: Record<string, CriticalEvent['level']> = {
  '危及生命': 'critical',
  '危急': 'critical',
  '高危': 'urgent',
  '紧急': 'urgent',
  '警告': 'warning',
};

function mapStatus(s: string | undefined): CriticalStatus {
  const v = (s || 'pending') as CriticalStatus;
  if (['pending', 'notified', 'acknowledged', 'resolving', 'resolved', 'closed_loop', 'escalated', 'cancelled', 'overdue'].includes(v)) {
    return v;
  }
  return 'pending';
}

const DEFAULT_SOP = [
  { step: 1, title: '发现危急值', description: '影像检查发现危急值征象', action: '立即记录', deadlineMinutes: 1 },
  { step: 2, title: '复核确认', description: '上级医生复核危急值', action: '双人复核', deadlineMinutes: 5 },
  { step: 3, title: '通知临床', description: '电话/短信通知主管医生', action: '多渠道通知', deadlineMinutes: 10 },
  { step: 4, title: '记录确认', description: '记录接收医生与时间', action: '记录系统', deadlineMinutes: 10 },
  { step: 5, title: '持续追踪', description: '追踪临床处理情况', action: '持续追踪', deadlineMinutes: 30 },
  { step: 6, title: '闭环归档', description: '归档危急值处理记录', action: '闭环归档', deadlineMinutes: 60 },
];

export function mapUnifiedToCriticalEvent(cv: CriticalValue): CriticalEvent {
  const status = mapStatus(cv.status);
  const reportedAt = cv.reportedTime || cv.examTime || new Date().toISOString();
  const receivingTime = cv.receivingTime;
  const acknowledgedTime = cv.acknowledgedTime;
  const resolvedTime = cv.processingTime;
  const responseTimeMinutes = receivingTime
    ? Math.max(0, Math.round((new Date(receivingTime).getTime() - new Date(reportedAt).getTime()) / 60000))
    : undefined;
  return {
    id: cv.id,
    ruleId: '',
    ruleCode: '',
    ruleName: cv.criticalFinding,
    level: SEVERITY_TO_LEVEL[cv.severity] || 'warning',
    reportId: cv.reportId,
    examId: cv.examId,
    patientId: cv.patientId,
    patientName: cv.patientName,
    gender: (cv.gender as CriticalEvent['gender']) || '其他',
    age: cv.age,
    modality: cv.modality,
    bodyPart: cv.bodyPart || '',
    reportedById: cv.reportedBy,
    reportedByName: cv.reportedByName,
    reportedByTitle: '',
    reportedAt,
    receivingDoctorId: cv.receivingDoctorId,
    receivingDoctorName: cv.receivingDoctorName,
    receivingTime,
    acknowledgedById: cv.acknowledged ? cv.acknowledgedBy : undefined,
    acknowledgedByName: cv.acknowledged ? cv.acknowledgedBy : undefined,
    acknowledgedTime,
    resolvedTime,
    status,
    channels: cv.notificationMethod ? [cv.notificationMethod as CriticalEvent['channels'][number]] : [],
    channelAttempts: [],
    detail: cv.findingDetails,
    responseTimeMinutes,
    onTimeNotification: typeof responseTimeMinutes === 'number' && responseTimeMinutes <= 10,
    escalationLevel: status === 'escalated' ? 1 : 0,
    sop: DEFAULT_SOP,
    dualReview: undefined,
    hash: `cvh-${cv.id}`,
    auditChain: [],
  };
}

export function mapUnifiedToCriticalEvents(cvs: CriticalValue[]): CriticalEvent[] {
  return cvs.map(mapUnifiedToCriticalEvent);
}