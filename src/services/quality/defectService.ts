/**
 * G005 RIS v3.0.5.1 - R3.DEFECT 缺陷库服务 (Mock)
 */
import { DEFECT_CATEGORIES, DEFECT_DETAILS, DEFECT_TREE, DEFECT_ANALYTICS, DEFECT_IMPORT_RECORDS } from '../../data/defectLibraryMock';
import { DEFECT_REMEDIATIONS } from '../../data/reportQualityMock';
import type { DefectCategory, DefectDetail, DefectAnalytics, DefectImportRecord, DefectTreeNode, DefectRemediation, DefectCategoryCode, DefectFilter, DefectStatus } from '../../types/R3/R3.DEFECT';


const LATENCY_MIN = 200;
const LATENCY_MAX = 1500;
const randomLatency = () => Math.floor(Math.random() * (LATENCY_MAX - LATENCY_MIN)) + LATENCY_MIN;
const wait = (ms?: number) => new Promise<void>((r) => setTimeout(r, ms ?? randomLatency()));
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

const inMemoryRemediations: DefectRemediation[] = clone(DEFECT_REMEDIATIONS);
const inMemoryImports: DefectImportRecord[] = clone(DEFECT_IMPORT_RECORDS);

export const defectService = {
  async listCategories(): Promise<DefectCategory[]> {
    await wait();
    return clone(DEFECT_CATEGORIES);
  },

  async getCategory(code: DefectCategoryCode): Promise<DefectCategory | null> {
    await wait();
    return clone(DEFECT_CATEGORIES.find((c) => c.code === code) ?? null);
  },

  async listDefects(filter?: DefectFilter): Promise<DefectDetail[]> {
    await wait();
    let list = DEFECT_DETAILS.slice();
    if (filter?.category) list = list.filter((d) => d.category === filter.category);
    if (filter?.severity) list = list.filter((d) => d.severity === filter.severity);
    if (filter?.status) {
      const map: Record<DefectStatus, boolean> = { active: true, deprecated: false, draft: true, reviewing: true };
      list = list.filter((d) => map[filter.status!] === d.isActive);
    }
    if (filter?.customOnly) list = list.filter((d) => d.customDefect);
    if (filter?.level) list = list.filter((d) => d.level === filter.level);
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter((d) => d.name.toLowerCase().includes(q) || d.code.toLowerCase().includes(q) || d.description.toLowerCase().includes(q));
    }
    if (filter?.tags && filter.tags.length > 0) {
      list = list.filter((d) => filter.tags!.some((t) => d.tags.includes(t)));
    }
    return list;
  },

  async getDefectByCode(code: string): Promise<DefectDetail | null> {
    await wait();
    return clone(DEFECT_DETAILS.find((d) => d.code === code) ?? null);
  },

  async getTree(): Promise<DefectTreeNode[]> {
    await wait();
    return clone(DEFECT_TREE);
  },

  async getAnalytics(): Promise<DefectAnalytics> {
    await wait(800);
    return clone(DEFECT_ANALYTICS);
  },

  async listRemediations(filter?: { status?: string; doctorId?: string }): Promise<DefectRemediation[]> {
    await wait();
    let list = inMemoryRemediations.slice();
    if (filter?.status) list = list.filter((r) => r.status === filter.status);
    if (filter?.doctorId) list = list.filter((r) => r.doctorId === filter.doctorId);
    return list;
  },

  async createRemediation(rem: Partial<DefectRemediation>): Promise<DefectRemediation> {
    await wait();
    const r: DefectRemediation = {
      id: 'dr-' + Date.now(),
      defectCode: rem.defectCode ?? '', defectName: rem.defectName ?? '',
      reportId: rem.reportId ?? '', patientName: rem.patientName ?? '',
      doctorId: rem.doctorId ?? '', doctorName: rem.doctorName ?? '',
      reportedBy: rem.reportedBy ?? 'system', reportedAt: new Date().toISOString(),
      deadlineAt: rem.deadlineAt ?? new Date(Date.now() + 86400000).toISOString(),
      status: 'pending', severity: rem.severity ?? 'minor',
      description: rem.description ?? '', suggestedFix: rem.suggestedFix ?? '',
      remindersSent: 0,
    };
    inMemoryRemediations.unshift(r);
    return clone(r);
  },

  async updateRemediation(id: string, patch: Partial<DefectRemediation>): Promise<DefectRemediation> {
    await wait();
    const r = inMemoryRemediations.find((x) => x.id === id);
    if (!r) throw new Error('Remediation not found');
    Object.assign(r, patch);
    return clone(r);
  },

  async sendReminder(id: string): Promise<DefectRemediation> {
    await wait();
    const r = inMemoryRemediations.find((x) => x.id === id);
    if (!r) throw new Error('Remediation not found');
    r.remindersSent += 1;
    return clone(r);
  },

  async listImportRecords(): Promise<DefectImportRecord[]> {
    await wait();
    return clone(inMemoryImports);
  },

  async importDefects(format: 'json' | 'excel' | 'csv' | 'yaml', filename: string, userId: string): Promise<DefectImportRecord> {
    await wait(2000);
    const rec: DefectImportRecord = {
      id: 'di-' + Date.now(), filename, format,
      totalRows: Math.floor(Math.random() * 20) + 5,
      successCount: 0, failedCount: 0,
      importedBy: userId, importedAt: new Date().toISOString(), status: 'processing',
    };
    inMemoryImports.unshift(rec);
    setTimeout(() => {
      rec.successCount = rec.totalRows - Math.floor(Math.random() * 3);
      rec.failedCount = rec.totalRows - rec.successCount;
      rec.status = rec.failedCount === 0 ? 'success' : 'partial';
      rec.errorLog = rec.failedCount > 0 ? rec.failedCount + ' 行格式错误' : undefined;
    }, 1500);
    return clone(rec);
  },

  async exportDefects(format: 'json' | 'excel' | 'csv'): Promise<{ data: string; mime: string; filename: string }> {
    await wait(1500);
    return {
      data: format === 'json' ? JSON.stringify(DEFECT_DETAILS, null, 2) : 'Mock export content',
      mime: format === 'json' ? 'application/json' : format === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv',
      filename: 'defect-library.' + format,
    };
  },

  async testRule(pattern: string, testContent: string): Promise<{ matches: Array<{ position: number; matched: string; suggestion: string }> }> {
    await wait(500);
    const matches: Array<{ position: number; matched: string; suggestion: string }> = [];
    if (!pattern) return { matches };
    try {
      const re = new RegExp(pattern, 'g');
      let m: RegExpExecArray | null;
      while ((m = re.exec(testContent)) !== null) {
        matches.push({ position: m.index, matched: m[0], suggestion: '请按规范修改' });
        if (matches.length > 50) break;
      }
    } catch {
      // ignore invalid regex
    }
    return { matches };
  },
};

export type DefectService = typeof defectService;
export default defectService;
