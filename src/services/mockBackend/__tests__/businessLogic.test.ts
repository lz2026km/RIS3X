import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  canTransitionReport,
  transitionReport,
  canTransitionWorklist,
  checkSlaBreach,
  shouldEscalate,
  determineCosignTrigger,
  getSlaMinutes,
  getEscalationTargets,
  getCosignSlaMinutes,
  getReviewSlaMinutes,
  getNextMaintenanceDate,
  isMaintenanceOverdue,
  daysUntilMaintenance,
  calculateImageGrade,
  checkRateLimit,
  resetRateLimit,
  recordWorkflowEvent,
  listWorkflowEvents,
  REPORT_STATUS_LABELS,
} from '../businessLogic';

describe('canTransitionReport', () => {
  it('draft → submitted returns true', () => {
    expect(canTransitionReport('draft', 'submitted')).toBe(true);
  });

  it('draft → published returns false', () => {
    expect(canTransitionReport('draft', 'published')).toBe(false);
  });

  it('draft → rejected returns true', () => {
    expect(canTransitionReport('draft', 'rejected')).toBe(true);
  });

  it('published → revised returns true', () => {
    expect(canTransitionReport('published', 'revised')).toBe(true);
  });

  // [v3.0.6.11-92 Wave2A P1] 补发自环: 已发布可重新发布
  it('published → published returns true (补发自环)', () => {
    expect(canTransitionReport('published', 'published')).toBe(true);
    expect(transitionReport({ id: 'rpt-1', status: 'published' as const }, 'published').status).toBe('published');
  });

  it('published → draft returns false', () => {
    expect(canTransitionReport('published', 'draft')).toBe(false);
  });

  it('cosigned → published returns true', () => {
    expect(canTransitionReport('cosigned', 'published')).toBe(true);
  });

  it('rejected → draft returns true', () => {
    expect(canTransitionReport('rejected', 'draft')).toBe(true);
  });

  it('invalid from status returns false', () => {
    expect(canTransitionReport('invalid' as never, 'draft')).toBe(false);
  });
});

describe('transitionReport', () => {
  it('returns updated report on valid transition', () => {
    const report = { id: 'rpt-1', status: 'draft' as const, content: 'test' };
    const updated = transitionReport(report, 'submitted') as typeof report & { updatedTime?: string; rejectReason?: string };
    expect(updated.status).toBe('submitted');
    expect(updated.content).toBe('test');
    expect(updated.updatedTime).toBeDefined();
  });

  it('includes rejectReason when transitioning to rejected', () => {
    const report = { id: 'rpt-1', status: 'submitted' as const };
    const updated = transitionReport(report, 'rejected', '质量不足') as typeof report & { rejectReason?: string };
    expect(updated.status).toBe('rejected');
    expect(updated.rejectReason).toBe('质量不足');
  });

  it('throws on invalid transition', () => {
    const report = { id: 'rpt-1', status: 'draft' as const };
    expect(() => transitionReport(report, 'published')).toThrow('Invalid report transition');
  });
});

describe('canTransitionWorklist', () => {
  it('pending → checkedIn returns true', () => {
    expect(canTransitionWorklist('pending', 'checkedIn')).toBe(true);
  });

  it('pending → cancelled returns true', () => {
    expect(canTransitionWorklist('pending', 'cancelled')).toBe(true);
  });

  it('completed → any returns false', () => {
    expect(canTransitionWorklist('completed', 'inProgress')).toBe(false);
    expect(canTransitionWorklist('completed', 'cancelled')).toBe(false);
  });
});

describe('checkSlaBreach', () => {
  it('life-threatening has 5 min SLA', () => {
    const recent = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const result = checkSlaBreach('life-threatening', recent);
    expect(result.slaMinutes).toBe(5);
    expect(result.breached).toBe(false);
  });

  it('life-threatening breached after 6 minutes', () => {
    const old = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    const result = checkSlaBreach('life-threatening', old);
    expect(result.breached).toBe(true);
  });

  it('info has 60 min SLA', () => {
    const recent = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const result = checkSlaBreach('info', recent);
    expect(result.slaMinutes).toBe(60);
    expect(result.breached).toBe(false);
  });
});

describe('shouldEscalate', () => {
  it('returns false when at max escalation level', () => {
    expect(shouldEscalate('info', 100, 1)).toBe(false);
  });

  it('returns true when elapsed exceeds SLA threshold', () => {
    expect(shouldEscalate('critical', 25, 0)).toBe(true);
  });

  it('returns false within SLA threshold', () => {
    expect(shouldEscalate('critical', 10, 0)).toBe(false);
  });

  it('returns true for warning at level 1 with high elapsed', () => {
    expect(shouldEscalate('warning', 60, 1)).toBe(true);
  });
});

describe('determineCosignTrigger', () => {
  it('returns junior_author for 住院医师', () => {
    expect(determineCosignTrigger({
      reportDoctorTitle: '住院医师',
      isCriticalValue: false,
      examItem: 'CT平扫',
      isVipPatient: false,
      qcScore: 90,
      isComplex: false,
    })).toBe('junior_author');
  });

  it('returns critical_value when critical value present', () => {
    expect(determineCosignTrigger({
      reportDoctorTitle: '主治医师',
      isCriticalValue: true,
      examItem: 'CT平扫',
      isVipPatient: false,
      qcScore: 90,
      isComplex: false,
    })).toBe('critical_value');
  });

  it('returns special_exam for enhanced/CTA/DSA exams', () => {
    expect(determineCosignTrigger({
      reportDoctorTitle: '主治医师',
      isCriticalValue: false,
      examItem: '腹部CTA',
      isVipPatient: false,
      qcScore: 90,
      isComplex: false,
    })).toBe('special_exam');
    expect(determineCosignTrigger({
      reportDoctorTitle: '主治医师',
      isCriticalValue: false,
      examItem: '头颈CTA',
      isVipPatient: false,
      qcScore: 90,
      isComplex: false,
    })).toBe('special_exam');
    expect(determineCosignTrigger({
      reportDoctorTitle: '主治医师',
      isCriticalValue: false,
      examItem: 'DSA脑血管',
      isVipPatient: false,
      qcScore: 90,
      isComplex: false,
    })).toBe('special_exam');
  });

  it('returns vip_patient for VIP patients', () => {
    expect(determineCosignTrigger({
      reportDoctorTitle: '主治医师',
      isCriticalValue: false,
      examItem: 'CT平扫',
      isVipPatient: true,
      qcScore: 90,
      isComplex: false,
    })).toBe('vip_patient');
  });

  it('returns complex_case when complex', () => {
    expect(determineCosignTrigger({
      reportDoctorTitle: '主治医师',
      isCriticalValue: false,
      examItem: 'CT平扫',
      isVipPatient: false,
      qcScore: 90,
      isComplex: true,
    })).toBe('complex_case');
  });

  it('returns low_quality when qcScore < 85', () => {
    expect(determineCosignTrigger({
      reportDoctorTitle: '主治医师',
      isCriticalValue: false,
      examItem: 'CT平扫',
      isVipPatient: false,
      qcScore: 80,
      isComplex: false,
    })).toBe('low_quality');
  });

  it('returns null when no trigger conditions met', () => {
    expect(determineCosignTrigger({
      reportDoctorTitle: '主任医师',
      isCriticalValue: false,
      examItem: 'CT平扫',
      isVipPatient: false,
      qcScore: 90,
      isComplex: false,
    })).toBeNull();
  });
});

describe('REPORT_STATUS_LABELS', () => {
  it('contains all 7 statuses', () => {
    expect(Object.keys(REPORT_STATUS_LABELS)).toHaveLength(7);
    expect(REPORT_STATUS_LABELS.draft).toBe('草稿');
    expect(REPORT_STATUS_LABELS.published).toBe('已发布');
  });
});

describe('getSlaMinutes', () => {
  it('returns correct SLA for each severity', () => {
    expect(getSlaMinutes('life-threatening')).toBe(5);
    expect(getSlaMinutes('critical')).toBe(15);
    expect(getSlaMinutes('warning')).toBe(30);
    expect(getSlaMinutes('info')).toBe(60);
  });
});

describe('getEscalationTargets', () => {
  it('returns chain for life-threatening', () => {
    expect(getEscalationTargets('life-threatening')).toEqual(['discoverDoctor', 'chief', 'director', 'medicalAffairs']);
  });

  it('returns chain for info', () => {
    expect(getEscalationTargets('info')).toEqual(['discoverDoctor']);
  });
});

describe('getCosignSlaMinutes', () => {
  it('returns correct SLA for each priority', () => {
    expect(getCosignSlaMinutes('急诊')).toBe(30);
    expect(getCosignSlaMinutes('加急')).toBe(60);
    expect(getCosignSlaMinutes('普通')).toBe(240);
    expect(getCosignSlaMinutes('体检')).toBe(480);
  });
});

describe('getReviewSlaMinutes', () => {
  it('returns correct SLA for each priority', () => {
    expect(getReviewSlaMinutes('急诊')).toBe(30);
    expect(getReviewSlaMinutes('加急')).toBe(60);
    expect(getReviewSlaMinutes('普通')).toBe(120);
    expect(getReviewSlaMinutes('体检')).toBe(240);
  });
});

describe('getNextMaintenanceDate', () => {
  it('returns next date for quarterly cycle', () => {
    const result = getNextMaintenanceDate('2026-01-15', '季度');
    expect(result).toBe('2026-04-15');
  });

  it('returns next date for annual cycle', () => {
    const result = getNextMaintenanceDate('2025-06-01', '年度');
    expect(result).toBe('2026-06-01');
  });
});

describe('isMaintenanceOverdue', () => {
  it('returns true for past date', () => {
    expect(isMaintenanceOverdue('2020-01-01')).toBe(true);
  });
});

describe('daysUntilMaintenance', () => {
  it('returns positive number for future date', () => {
    const far = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]!;
    expect(daysUntilMaintenance(far)).toBeGreaterThan(0);
  });
});

describe('calculateImageGrade', () => {
  it('returns A for high quality', () => {
    expect(calculateImageGrade({ snrDb: 55, cnr: 6, uniformityPct: 90, artifactScore: 1 })).toBe('A');
  });

  it('returns B for moderate quality', () => {
    expect(calculateImageGrade({ snrDb: 48, cnr: 4, uniformityPct: 88, artifactScore: 2 })).toBe('B');
  });

  it('returns C for low quality', () => {
    expect(calculateImageGrade({ snrDb: 38, cnr: 4, uniformityPct: 80, artifactScore: 2 })).toBe('C');
  });

  it('returns D for very low quality', () => {
    expect(calculateImageGrade({ snrDb: 30, cnr: 2, uniformityPct: 60, artifactScore: 6 })).toBe('D');
  });
});

describe('checkRateLimit', () => {
  beforeEach(() => resetRateLimit());
  afterEach(() => resetRateLimit());

  it('allows first request', () => {
    const result = checkRateLimit('test-key', { maxPerMinute: 5 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('blocks after exceeding limit', () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit('limit-key', { maxPerMinute: 5 });
    }
    const result = checkRateLimit('limit-key', { maxPerMinute: 5 });
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});

describe('recordWorkflowEvent / listWorkflowEvents', () => {
  it('records and retrieves events', () => {
    const event = recordWorkflowEvent({
      actorId: 'D001',
      actorName: '张三',
      action: 'SUBMIT',
      entityType: 'report',
      entityId: 'rpt-1',
      fromState: 'draft',
      toState: 'submitted',
    });
    expect(event.id).toBeDefined();
    expect(event.timestamp).toBeDefined();
    const events = listWorkflowEvents({ entityType: 'report', entityId: 'rpt-1' });
    expect(events).toHaveLength(1);
    expect(events[0]!.action).toBe('SUBMIT');
  });

  it('filters by entity type', () => {
    recordWorkflowEvent({ actorId: 'D001', actorName: '张三', action: 'SIGN', entityType: 'report', entityId: 'rpt-2' });
    recordWorkflowEvent({ actorId: 'T001', actorName: '李四', action: 'START_EXAM', entityType: 'exam', entityId: 'ex-1' });
    const exams = listWorkflowEvents({ entityType: 'exam' });
    expect(exams).toHaveLength(1);
    expect(exams[0]!.entityId).toBe('ex-1');
  });
});
