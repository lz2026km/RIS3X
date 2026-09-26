/**
 * G005 RIS v3.0.5.1 - R3.DEFECT 缺陷库类型定义
 */
import type { DefectCategoryCode, DefectRemediation } from './R3.QUALITY';

export type { DefectRemediation, DefectCategoryCode };

export type DefectSeverityLevel = 'minor' | 'major' | 'critical';
export type DefectStatus = 'active' | 'deprecated' | 'draft' | 'reviewing';

export interface DefectCategory {
  code: DefectCategoryCode;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  color: string;
  icon: string;
  childCount: number;
  totalCount: number;
  parentCode?: DefectCategoryCode;
  level: 1 | 2;
  sortOrder: number;
}

export interface DefectCategoryNode extends DefectCategory {
  children: DefectCategoryNode[];
  defects: DefectDetail[];
}

export interface DefectDetail {
  id: string;
  code: string;
  name: string;
  nameEn: string;
  category: DefectCategoryCode;
  severity: DefectSeverityLevel;
  description: string;
  descriptionEn: string;
  examples: string[];
  solution: string;
  solutionEn: string;
  references: string[];
  count: number;
  isActive: boolean;
  customDefect: boolean;
  level: 1 | 2;
  parentCode?: string;
  tags: string[];
  triggerPattern?: string;
  exampleFix?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  sla: number;
  trainingRequired: boolean;
  trainingMaterialUrl?: string;
  pdcaStage?: 'plan' | 'do' | 'check' | 'act';
}

export interface DefectRemediationRecord extends DefectRemediation {}

export interface DefectTrend {
  code: string;
  name: string;
  category: DefectCategoryCode;
  daily: Array<{ date: string; count: number; fixedCount: number }>;
  total: number;
  fixed: number;
  changeRate: number;
  trend: 'up' | 'down' | 'stable';
}

export interface DefectStats {
  totalDefects: number;
  byCategory: Record<DefectCategoryCode, number>;
  bySeverity: Record<DefectSeverityLevel, number>;
  byStatus: Record<DefectStatus, number>;
  topDefects: Array<{ code: string; name: string; count: number; changeRate: number; severity: DefectSeverityLevel }>;
  customCount: number;
  retiredCount: number;
  trainingLinked: number;
  totalHitsThisMonth: number;
  fixRate: number;
  averageFixHours: number;
}

export interface DefectAnalytics {
  stats: DefectStats;
  trends: DefectTrend[];
  byDepartment: Array<{ department: string; count: number; avgScore: number }>;
  byDoctor: Array<{ doctorId: string; doctorName: string; count: number; avgScore: number }>;
  byModality: Array<{ modality: string; count: number; avgScore: number }>;
  byBodyPart: Array<{ bodyPart: string; count: number; avgScore: number }>;
  pcaCause: Array<{ stage: 'plan' | 'do' | 'check' | 'act'; defects: Array<{ code: string; name: string; count: number }> }>;
  caseLibrary: Array<{ id: string; type: 'good' | 'bad'; title: string; reportId: string; defectCodes: string[]; description: string; tags: string[] }>;
}

export interface DefectImportRecord {
  id: string;
  filename: string;
  format: 'json' | 'excel' | 'csv' | 'yaml';
  totalRows: number;
  successCount: number;
  failedCount: number;
  importedBy: string;
  importedAt: string;
  status: 'processing' | 'success' | 'partial' | 'failed';
  errorLog?: string;
}

export interface DefectFilter {
  category?: DefectCategoryCode;
  severity?: DefectSeverityLevel;
  status?: DefectStatus;
  customOnly?: boolean;
  search?: string;
  tags?: string[];
  level?: 1 | 2;
}

export interface DefectTreeNode {
  key: string;
  title: string;
  code: DefectCategoryCode;
  level: 1 | 2;
  count: number;
  childCount: number;
  children?: DefectTreeNode[];
}
