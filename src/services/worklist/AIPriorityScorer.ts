/**
 * G005 RIS v3.0.6.6 - AI 优先级评分器
 * 80 点升级 - 特征工程 + 确定性加权评分
 */

import type {
  PriorityScore,
  PriorityScoreLevel,
  PriorityFeatureVector,
} from '../../types/workflow';

export interface ScoringStudyInput {
  id: string;
  modality: string;
  bodyPart?: string;
  priority?: string;
  patientType?: string;
  age?: number;
  waitingMinutes?: number;
  criticalFinding?: boolean;
  historyCount?: number;
  workloadRatio?: number;
  slaRemainingMinutes?: number;
  contrastAllergy?: boolean;
  isInpatient?: boolean;
  scheduledTime?: string;
}

const MODALITY_WEIGHT: Record<string, number> = {
  CT: 30,
  MR: 25,
  DSA: 35,
  PETCT: 40,
  PET: 40,
  DR: 10,
  CR: 8,
  US: 12,
  MG: 15,
  RF: 18,
};

const PRIORITY_BOOST: Record<string, number> = {
  normal: 0,
  urgent: 25,
  critical: 50,
  stat: 60,
};

const ACUITY_BODY_PARTS = new Set(['头颅', '胸部', '心脏', '血管', '腹部', '盆腔', '脊柱']);
const ACUITY_KEYWORDS = ['外伤', '脑卒中', '主动脉', '急腹症', '脑出血', '肺栓塞'];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function computeFeatures(study: ScoringStudyInput): PriorityFeatureVector {
  const modalityScore = MODALITY_WEIGHT[study.modality.toUpperCase()] ?? 15;
  const basePriority = PRIORITY_BOOST[(study.priority ?? 'normal').toLowerCase()] ?? 0;
  const waitMinutes = Math.max(0, study.waitingMinutes ?? 0);
  const waitScore = waitMinutes > 120 ? 25 : waitMinutes > 60 ? 18 : waitMinutes > 30 ? 10 : waitMinutes > 10 ? 4 : 0;
  const slaMinutes = study.slaRemainingMinutes ?? 60;
  const slaScore = slaMinutes < 0 ? 35 : slaMinutes < 15 ? 22 : slaMinutes < 30 ? 12 : slaMinutes < 60 ? 5 : 0;
  const workloadScore = clamp(((study.workloadRatio ?? 0.5) - 0.7) * 40, 0, 20);
  const ageScore = (study.age ?? 0) >= 70 ? 18 : (study.age ?? 0) >= 60 ? 10 : (study.age ?? 0) <= 5 ? 8 : 0;
  const patientTypeBoost = study.isInpatient || study.patientType === '住院' ? 8 : study.patientType === '急诊' ? 14 : 0;
  const acuityPartBoost = study.bodyPart && ACUITY_BODY_PARTS.has(study.bodyPart) ? 12 : 5;
  const criticalBoost = study.criticalFinding ? 30 : 0;
  const historyBoost = (study.historyCount ?? 0) > 0 ? Math.min(8, study.historyCount ?? 0) : 0;
  const acuityScore = basePriority + patientTypeBoost + acuityPartBoost + criticalBoost + historyBoost;

  return {
    modalityScore,
    historyScore: historyBoost,
    slaScore,
    workloadScore,
    waitScore,
    ageScore,
    acuityScore,
  };
}

function totalScore(features: PriorityFeatureVector): number {
  return (
    features.modalityScore * 0.18 +
    features.acuityScore * 0.32 +
    features.slaScore * 0.22 +
    features.waitScore * 0.12 +
    features.workloadScore * 0.08 +
    features.ageScore * 0.08
  );
}

function deriveLevel(score: number): PriorityScoreLevel {
  if (score >= 70) return 'critical';
  if (score >= 45) return 'urgent';
  if (score >= 25) return 'normal';
  return 'low';
}

function buildReasons(study: ScoringStudyInput, _features: PriorityFeatureVector): string[] {
  const reasons: string[] = [];
  if (study.criticalFinding) reasons.push('标记危急值');
  if ((study.priority ?? '').toLowerCase() === 'critical') reasons.push('优先级: 危重');
  if ((study.priority ?? '').toLowerCase() === 'urgent') reasons.push('优先级: 紧急');
  if (study.bodyPart && ACUITY_BODY_PARTS.has(study.bodyPart)) reasons.push(`检查部位 ${study.bodyPart}`);
  if ((study.age ?? 0) >= 70) reasons.push('高龄患者');
  if ((study.waitingMinutes ?? 0) > 60) reasons.push('等待超过 60 分钟');
  if ((study.slaRemainingMinutes ?? 60) < 15) reasons.push('SLA 即将超时');
  if (study.isInpatient || study.patientType === '住院') reasons.push('住院患者');
  if (study.patientType === '急诊') reasons.push('急诊患者');
  if (ACUITY_KEYWORDS.some((kw) => (study.bodyPart ?? '').includes(kw))) reasons.push('急性病征');
  if (reasons.length === 0) reasons.push('常规检查');
  return reasons;
}

export class AIPriorityScorer {
  score(study: ScoringStudyInput): PriorityScore {
    const features = computeFeatures(study);
    const rawScore = totalScore(features);
    const score = Math.round(clamp(rawScore, 0, 100) * 10) / 10;
    return {
      studyId: study.id,
      score,
      level: deriveLevel(score),
      features,
      reasons: buildReasons(study, features),
      computedAt: new Date().toISOString(),
    };
  }

  scoreMany(studies: ScoringStudyInput[]): PriorityScore[] {
    return studies.map((s) => this.score(s));
  }
}

export const aiPriorityScorer = new AIPriorityScorer();