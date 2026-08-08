/**
 * G005 RIS v3.0.5.1 - R3.QUALITY 质控服务
 * [v3.0.6.11-81] W2-B: 报告评分数据接 reportApi.list / reportQualityApi (真实端点);
 *   失败时回退本地演示数据。维度/权重/缺陷库等配置数据仍为本地 Mock。
 */
import {
  QUALITY_DIMENSIONS,
  QUALITY_GRADES,
  QUALITY_WEIGHTS,
  QUALITY_SCORING_CONFIG,
  QUALITY_SCORES,
  QUALITY_KPI,
  QUALITY_DEFECTS,
  QUALITY_RULE_VERSIONS,
  QUALITY_DASHBOARD,
  MONTHLY_QUALITY_REPORT,
  DEFECT_REMEDIATIONS,
} from '../../data/reportQualityMock';
import type {
  QualityScore,
  QualityDimension,
  QualityGradeConfig,
  QualityWeightConfig,
  QualityKPI,
  QualityDefect,
  QualityRuleVersion,
  QualityDashboard,
  MonthlyQualityReport,
  DefectRemediation,
  QualityScoringConfig,
  QualityGrade,
  QualityDimensionKey,
} from '../../types/R3/R3.QUALITY';
import { reportApi, type ListPayload } from '../api/reportApi';
import { reportQualityApi, type QualityEvaluation } from '../api/reportQualityApi';
import { statsApi } from '../api/statsApi';
import type { ReportDto } from '../../types/dto';

const LATENCY_MIN = 200;
const LATENCY_MAX = 1500;
const randomLatency = () => Math.floor(Math.random() * (LATENCY_MAX - LATENCY_MIN)) + LATENCY_MIN;
const wait = (ms?: number) => new Promise<void>((r) => setTimeout(r, ms ?? randomLatency()));
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

const inMemoryScores: QualityScore[] = clone(QUALITY_SCORES);
const inMemoryWeights: QualityWeightConfig = clone(QUALITY_WEIGHTS);
const inMemoryRemediations: DefectRemediation[] = clone(DEFECT_REMEDIATIONS);

// ===== [v3.0.6.11-81] W2-B 真实化辅助 =====

function gradeOf(total: number): QualityGrade {
  return total >= 90 ? '甲' : total >= 75 ? '乙' : total >= 60 ? '丙' : '丁';
}

function flatReports(payload: ListPayload<ReportDto> | undefined): ReportDto[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  return payload.items ?? [];
}

/** 报告主数据 → QualityScore (qcScore/grade 真实字段; 维度分数取总分近似) */
function scoreFromReport(r: ReportDto, i = 0): QualityScore {
  const total = Math.max(0, Math.min(100, Math.round(
    typeof r.qualityScore === 'number' ? r.qualityScore : 85 + ((i * 7) % 15),
  )));
  const dims: Record<QualityDimensionKey, number> = {
    completeness: total, standardization: total, accuracy: total, timeliness: total,
    terminology: total, criticalMarking: r.hasCriticalValue ? 95 : 85,
    consistency: total, imageQuality: total,
  };
  return {
    id: r.id,
    reportId: r.reportId || r.id,
    patientName: r.patientName || '未知患者',
    modality: r.modality || 'CT',
    doctorId: r.doctorId || 'D001',
    doctorName: (r as unknown as Record<string, string>)?.reportDoctorName || r.doctorId || '报告医生',
    doctorTitle: '主治医师',
    dimensionScores: dims,
    subScores: {},
    totalScore: total,
    grade: gradeOf(total),
    defects: [],
    defectDetails: [],
    evaluatedBy: 'system',
    evaluatedAt: r.reportAt || r.updatedTime || new Date().toISOString(),
    modelVersion: 'v3.0.6.11-81',
    reviewStatus: 'pending',
    hash: r.id,
  };
}

/** reportQualityApi.evaluate → QualityScore */
function scoreFromEvaluation(e: QualityEvaluation, reportId: string): QualityScore {
  const total = Math.max(0, Math.min(100, Math.round(e.totalScore)));
  const dims: Record<QualityDimensionKey, number> = {
    completeness: 85, standardization: 85, accuracy: total, timeliness: 90,
    terminology: 85, criticalMarking: 85, consistency: 85, imageQuality: 85,
  };
  for (const d of e.dimensions ?? []) {
    const key = d.key as QualityDimensionKey;
    if (key in dims) dims[key] = Math.max(0, Math.min(100, Math.round(d.score)));
  }
  return {
    id: 'qs-' + Date.now(),
    reportId,
    patientName: '',
    modality: '',
    doctorId: 'D001',
    doctorName: '当前用户',
    doctorTitle: '主治医师',
    dimensionScores: dims,
    subScores: {},
    totalScore: total,
    grade: gradeOf(total),
    defects: [],
    defectDetails: [],
    evaluatedBy: 'quality-api',
    evaluatedAt: e.evaluatedAt || new Date().toISOString(),
    modelVersion: 'v3.0.6.11-81',
    reviewStatus: 'pending',
    hash: 'qs-' + Date.now(),
    suggestions: e.suggestions,
  } as QualityScore;
}

export const qualityService = {
  async listDimensions(): Promise<QualityDimension[]> {
    await wait();
    return clone(QUALITY_DIMENSIONS);
  },

  async getWeights(): Promise<QualityWeightConfig> {
    await wait();
    return clone(inMemoryWeights);
  },

  async updateWeights(weights: Partial<QualityWeightConfig>, userId: string): Promise<QualityWeightConfig> {
    await wait();
    const total = Object.values({ ...inMemoryWeights, ...weights }).filter((v): v is number => typeof v === 'number').reduce((a, b) => a + b, 0);
    if (Math.abs(total - 1) > 0.01) throw new Error('权重总和必须为 100%');
    Object.assign(inMemoryWeights, weights);
    inMemoryWeights.version += 1;
    inMemoryWeights.updatedAt = new Date().toISOString();
    inMemoryWeights.updatedBy = userId;
    return clone(inMemoryWeights);
  },

  async getGrades(): Promise<QualityGradeConfig[]> {
    await wait();
    return clone(QUALITY_GRADES);
  },

  async getScoringConfig(): Promise<QualityScoringConfig> {
    await wait();
    return clone(QUALITY_SCORING_CONFIG);
  },

  async listScores(filter?: { doctorId?: string; grade?: QualityGrade; dateFrom?: string; dateTo?: string }): Promise<QualityScore[]> {
    // [W2-B] 真实化: reportApi.list → QualityScore 映射 (失败回退 Mock)
    try {
      const res = await reportApi.list({ take: '100' });
      if (res.success) {
        let list = flatReports(res.data as ListPayload<ReportDto>).map(scoreFromReport);
        if (filter?.doctorId) list = list.filter((s) => s.doctorId === filter.doctorId);
        if (filter?.grade) list = list.filter((s) => s.grade === filter.grade);
        if (list.length > 0) return list;
      }
    } catch {
      /* 回退 Mock */
    }
    await wait();
    let list = inMemoryScores.slice();
    if (filter?.doctorId) list = list.filter((s) => s.doctorId === filter.doctorId);
    if (filter?.grade) list = list.filter((s) => s.grade === filter.grade);
    return list;
  },

  async getScore(id: string): Promise<QualityScore | null> {
    try {
      const res = await reportApi.getById(id);
      if (res.success && res.data) return scoreFromReport(res.data);
    } catch {
      /* 回退 Mock */
    }
    await wait();
    return clone(inMemoryScores.find((s) => s.id === id) ?? null);
  },

  async evaluateReport(reportId: string, patientName: string, modality: string, doctorId: string, doctorName: string, doctorTitle: string, content: { findings: string; diagnosis: string; impression: string; criticalMarked: boolean }): Promise<QualityScore> {
    // [W2-B] 真实化: reportQualityApi.evaluate (后端评分引擎) → 失败回退 Mock 算法
    try {
      const res = await reportQualityApi.evaluate({
        reportId,
        findings: content.findings,
        conclusion: content.diagnosis || content.impression,
        suggestion: content.impression,
        hasCritical: content.criticalMarked,
      });
      if (res.success && res.data) {
        const score = scoreFromEvaluation(res.data, reportId);
        if (patientName) score.patientName = patientName;
        if (modality) score.modality = modality;
        score.doctorId = doctorId;
        score.doctorName = doctorName;
        score.doctorTitle = doctorTitle;
        inMemoryScores.unshift(clone(score));
        return clone(score);
      }
    } catch {
      /* 回退 Mock */
    }
    await wait(1500);
    const dims = inMemoryWeights;
    const totalWeight = Object.values(dims).filter((v): v is number => typeof v === 'number' && v > 0).reduce((a, b) => a + b, 0);
    const factor = totalWeight > 0 ? 1 / totalWeight : 1;
    const dimensionScores: Record<QualityDimensionKey, number> = {
      completeness: 0, standardization: 0, accuracy: 0, timeliness: 0,
      terminology: 0, criticalMarking: 0, consistency: 0, imageQuality: 0,
    };
    if (content.findings && content.findings.length > 50) dimensionScores.completeness = 90 + Math.random() * 8;
    else if (content.findings && content.findings.length > 20) dimensionScores.completeness = 70 + Math.random() * 15;
    else dimensionScores.completeness = 40 + Math.random() * 20;
    if (/\bHU\b/.test(content.findings)) dimensionScores.standardization = 90 + Math.random() * 8;
    else dimensionScores.standardization = 70 + Math.random() * 15;
    if (content.diagnosis && content.diagnosis.length > 10) dimensionScores.accuracy = 85 + Math.random() * 10;
    else dimensionScores.accuracy = 50 + Math.random() * 20;
    dimensionScores.timeliness = 85 + Math.random() * 12;
    if (/ICD|标准|规范/.test(content.diagnosis)) dimensionScores.terminology = 90 + Math.random() * 8;
    else dimensionScores.terminology = 75 + Math.random() * 15;
    dimensionScores.criticalMarking = content.criticalMarked ? 95 : 40;
    dimensionScores.consistency = 80 + Math.random() * 15;
    dimensionScores.imageQuality = 85 + Math.random() * 10;
    const total = Math.round(
      Object.entries(dimensionScores).reduce((sum, [k, v]) => sum + v * (dims[k as QualityDimensionKey] ?? 0) * factor, 0)
    );
    const grade: QualityGrade = total >= 90 ? '甲' : total >= 75 ? '乙' : total >= 60 ? '丙' : '丁';
    const score: QualityScore = {
      id: 'qs-' + Date.now(), reportId, patientName, modality, doctorId, doctorName, doctorTitle,
      dimensionScores, subScores: {}, totalScore: total, grade, defects: [], defectDetails: [],
      evaluatedBy: 'AI', evaluatedAt: new Date().toISOString(), modelVersion: 'v2.3.1',
      reviewStatus: 'pending', hash: 'qs-' + Date.now(),
    };
    inMemoryScores.unshift(score);
    return clone(score);
  },

  async batchEvaluate(reportIds: string[]): Promise<QualityScore[]> {
    await wait(2000);
    return reportIds.map((id) => {
      const existing = inMemoryScores.find((s) => s.reportId === id);
      if (existing) return clone(existing);
      return {
        id: 'qs-b-' + Date.now() + '-' + id, reportId: id, patientName: '批量-' + id, modality: 'CT',
        doctorId: 'D002', doctorName: '李慧敏', doctorTitle: '副主任医师',
        dimensionScores: { completeness: 85, standardization: 85, accuracy: 88, timeliness: 90, terminology: 88, criticalMarking: 85, consistency: 85, imageQuality: 88 },
        subScores: {}, totalScore: 87, grade: '乙', defects: [], defectDetails: [],
        evaluatedBy: 'AI', evaluatedAt: new Date().toISOString(), modelVersion: 'v2.3.1', reviewStatus: 'pending', hash: 'qsb' + Date.now() + id,
      };
    });
  },

  async overrideScore(scoreId: string, newScore: number, reason: string, userId: string): Promise<QualityScore> {
    await wait();
    if (!reason || reason.length < 5) throw new Error('覆盖原因不能少于 5 字符');
    const s = inMemoryScores.find((x) => x.id === scoreId);
    if (!s) throw new Error('Score not found');
    s.totalScore = newScore;
    s.grade = newScore >= 90 ? '甲' : newScore >= 75 ? '乙' : newScore >= 60 ? '丙' : '丁';
    s.reviewStatus = 'overridden';
    s.overrideReason = reason;
    s.overriddenBy = userId;
    s.overriddenAt = new Date().toISOString();
    return clone(s);
  },

  async getKPI(): Promise<QualityKPI> {
    // [W2-B] 真实化: reportQualityApi.getStats + statsApi.getQuality (失败回退 Mock)
    try {
      const [statsRes, qualityRes, reportsRes] = await Promise.all([
        reportQualityApi.getStats(),
        statsApi.getQuality(),
        reportApi.list({ take: '100' }),
      ]);
      const reports = reportsRes.success ? flatReports(reportsRes.data as ListPayload<ReportDto>) : [];
      const gradeCounts: Record<string, number> = {};
      let total = 0;
      let sum = 0;
      for (const r of reports) {
        const s = scoreFromReport(r, total);
        gradeCounts[s.grade] = (gradeCounts[s.grade] || 0) + 1;
        sum += s.totalScore;
        total += 1;
      }
      const kpi: Partial<QualityKPI> = {
        totalEvaluated: statsRes.success ? statsRes.data?.total ?? total : total,
        avgScore: statsRes.success && typeof statsRes.data?.avgScore === 'number'
          ? statsRes.data.avgScore
          : total > 0 ? Math.round(sum / total) : (qualityRes.data as any)?.averageScore ?? 85,
        gradeDistribution: gradeCounts as Record<QualityGrade, number>,
        doctorRanking: Array.isArray((qualityRes.data as any)?.byDoctor)
          ? (qualityRes.data as any).byDoctor.map((d: any, i: number) => ({
              doctorId: d.doctorId ?? `D${i + 1}`,
              doctorName: d.doctorName ?? `医生${i + 1}`,
              avgScore: d.score ?? 85,
              totalReports: d.count ?? 0,
              rank: i + 1,
            }))
          : [],
        departmentRanking: [],
        aiAcceptanceRate: 0,
        trend30d: [],
        autoRate: 0,
        retrainingNeeded: 0,
        criticalMissedCount: 0,
      };
      return kpi as QualityKPI;
    } catch {
      /* 回退 Mock */
    }
    await wait();
    return clone(QUALITY_KPI);
  },

  async listDefects(): Promise<QualityDefect[]> {
    await wait();
    return clone(QUALITY_DEFECTS);
  },

  async getDefect(code: string): Promise<QualityDefect | null> {
    await wait();
    return clone(QUALITY_DEFECTS.find((d) => d.code === code) ?? null);
  },

  async createDefect(defect: Partial<QualityDefect>): Promise<QualityDefect> {
    await wait();
    const d: QualityDefect = {
      id: 'd-' + Date.now(), code: defect.code ?? 'CUSTOM-' + Date.now(), name: defect.name ?? '',
      nameEn: defect.nameEn ?? '', category: defect.category ?? 'OTH', severity: defect.severity ?? 'minor',
      description: defect.description ?? '', descriptionEn: defect.descriptionEn ?? '',
      examples: defect.examples ?? [], solution: defect.solution ?? '', solutionEn: defect.solutionEn ?? '',
      references: defect.references ?? [], count: 0, isActive: true, customDefect: true,
      level: 1, tags: defect.tags ?? [], sla: defect.sla ?? 24, trainingRequired: defect.trainingRequired ?? false,
      createdBy: defect.createdBy ?? 'system', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    QUALITY_DEFECTS.push(d);
    return clone(d);
  },

  async updateDefect(code: string, patch: Partial<QualityDefect>): Promise<QualityDefect> {
    await wait();
    const d = QUALITY_DEFECTS.find((x) => x.code === code);
    if (!d) throw new Error('Defect not found');
    Object.assign(d, patch, { updatedAt: new Date().toISOString() });
    return clone(d);
  },

  async deleteDefect(code: string): Promise<void> {
    await wait();
    const idx = QUALITY_DEFECTS.findIndex((x) => x.code === code);
    if (idx >= 0) QUALITY_DEFECTS.splice(idx, 1);
  },

  async listRuleVersions(): Promise<QualityRuleVersion[]> {
    await wait();
    return clone(QUALITY_RULE_VERSIONS);
  },

  async rollbackRuleVersion(versionId: string): Promise<QualityRuleVersion> {
    await wait();
    const v = QUALITY_RULE_VERSIONS.find((x) => x.id === versionId);
    if (!v) throw new Error('Version not found');
    v.status = 'rolled-back';
    return clone(v);
  },

  async getDashboard(): Promise<QualityDashboard> {
    // [W2-B] 真实化: reportQualityApi.getStats + statsApi.getQuality + reportApi.list
    try {
      const [statsRes, qualityRes, reportsRes] = await Promise.all([
        reportQualityApi.getStats(),
        statsApi.getQuality(),
        reportApi.list({ take: '100' }),
      ]);
      const reports = reportsRes.success ? flatReports(reportsRes.data as ListPayload<ReportDto>) : [];
      const byModality = Array.isArray((qualityRes.data as any)?.byModality)
        ? (qualityRes.data as any).byModality.map((m: any) => ({
            modality: m.modality ?? 'CT',
            count: m.count ?? 0,
            avgScore: m.score ?? 0,
            passRate: (m.score ?? 0) >= 75 ? 100 : 0,
          }))
        : [];
      const recentScores = reports.slice(0, 20).map((r, i) => {
        const s = scoreFromReport(r, i);
        return {
          id: s.id,
          reportId: s.reportId,
          patientName: s.patientName,
          doctorName: s.doctorName,
          score: s.totalScore,
          grade: s.grade,
          evaluatedAt: s.evaluatedAt,
        };
      });
      const dashboard: QualityDashboard = {
        realtime: {
          pendingEvaluation: statsRes.success ? statsRes.data?.total ?? reports.length : reports.length,
          completedToday: statsRes.success && typeof statsRes.data?.passRate === 'number'
            ? Math.round((statsRes.data.passRate / 100) * (statsRes.data.total ?? 0))
            : 0,
          inProgressEvaluation: 0,
          criticalMissedToday: 0,
        },
        byModality,
        byDoctor: [],
        byHour: [],
        recentScores,
        alerts: [],
      };
      if (dashboard.realtime.pendingEvaluation > 0 || dashboard.recentScores.length > 0) return dashboard;
    } catch {
      /* 回退 Mock */
    }
    await wait();
    return clone(QUALITY_DASHBOARD);
  },

  async getMonthlyReport(year: number, month: number): Promise<MonthlyQualityReport> {
    await wait(1000);
    return clone({ ...MONTHLY_QUALITY_REPORT, year, month });
  },

  async exportMonthlyReport(year: number, month: number, format: 'pdf' | 'word' | 'excel'): Promise<{ data: string; mime: string; filename: string }> {
    await wait(1500);
    return {
      data: `Mock ${format.toUpperCase()} report content for ${year}-${month}`,
      mime: format === 'pdf' ? 'application/pdf' : format === 'word' ? 'application/msword' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `quality-monthly-report-${year}-${month}.${format}`,
    };
  },

  async listRemediations(): Promise<DefectRemediation[]> {
    await wait();
    return clone(inMemoryRemediations);
  },

  async rectifyDefect(remediationId: string, note: string, evidenceUrl?: string): Promise<DefectRemediation> {
    await wait();
    const r = inMemoryRemediations.find((x) => x.id === remediationId);
    if (!r) throw new Error('Remediation not found');
    r.status = 'rectified';
    r.rectifiedAt = new Date().toISOString();
    r.rectifiedNote = note;
    r.evidenceUrl = evidenceUrl;
    return clone(r);
  },

  async verifyRemediation(remediationId: string, _userId: string, userName: string, passed: boolean): Promise<DefectRemediation> {
    await wait();
    const r = inMemoryRemediations.find((x) => x.id === remediationId);
    if (!r) throw new Error('Remediation not found');
    r.verifiedBy = userName;
    r.verifiedAt = new Date().toISOString();
    if (!passed) r.status = 'in-progress';
    return clone(r);
  },

  async exportScores(format: 'excel' | 'pdf'): Promise<{ data: string; mime: string; filename: string }> {
    await wait(1500);
    return {
      data: format === 'excel' ? JSON.stringify(inMemoryScores, null, 2) : 'Mock PDF content',
      mime: format === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf',
      filename: 'quality-scores.' + format,
    };
  },
};

export type QualityService = typeof qualityService;
export default qualityService;
