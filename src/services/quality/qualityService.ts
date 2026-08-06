/**
 * G005 RIS v3.0.5.1 - R3.QUALITY 质控服务 (Mock)
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

const LATENCY_MIN = 200;
const LATENCY_MAX = 1500;
const randomLatency = () => Math.floor(Math.random() * (LATENCY_MAX - LATENCY_MIN)) + LATENCY_MIN;
const wait = (ms?: number) => new Promise<void>((r) => setTimeout(r, ms ?? randomLatency()));
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

const inMemoryScores: QualityScore[] = clone(QUALITY_SCORES);
const inMemoryWeights: QualityWeightConfig = clone(QUALITY_WEIGHTS);
const inMemoryRemediations: DefectRemediation[] = clone(DEFECT_REMEDIATIONS);

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
    await wait();
    let list = inMemoryScores.slice();
    if (filter?.doctorId) list = list.filter((s) => s.doctorId === filter.doctorId);
    if (filter?.grade) list = list.filter((s) => s.grade === filter.grade);
    return list;
  },

  async getScore(id: string): Promise<QualityScore | null> {
    await wait();
    return clone(inMemoryScores.find((s) => s.id === id) ?? null);
  },

  async evaluateReport(reportId: string, patientName: string, modality: string, doctorId: string, doctorName: string, doctorTitle: string, content: { findings: string; diagnosis: string; impression: string; criticalMarked: boolean }): Promise<QualityScore> {
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
