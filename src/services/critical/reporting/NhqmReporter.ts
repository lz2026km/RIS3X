/**
 * G005 RIS v3.0.6.6 - 国家医疗质量改进(NHQM)目标 - 危急值上报 (Mock)
 * 国家卫健委 2024 版 15 类目录编码上报
 *
 * v3.0.6.12-A4: 事件源改为 store.criticalEvents (unifiedCriticalValues).
 */

import { list } from '../../mockBackend/store';
import { mapUnifiedToCriticalEvents } from '../../../data/criticalValueAdapter';
import { CRITICAL_RULES } from '../../../data/criticalValueMock';
import type { CriticalEvent } from '../../../types/R3/R3.CRITICAL';

function getCriticalEvents(): CriticalEvent[] {
  const unified = list<any>('criticalEvents');
  return mapUnifiedToCriticalEvents(unified);
}

export interface NhqmCatalogEntry {
  /** 国家卫健委 15 类目录编码 */
  catalogCode: string;
  categoryName: string;
  eventCount: number;
  timelyNotificationRate: number;
  closeLoopRate: number;
}

export interface NhqmReportSnapshot {
  /** 季度(YYYYQn) */
  quarter: string;
  /** 院内编码 → NHQM 编码 映射 */
  codeMapping: Record<string, string>;
  /** 各类目统计 */
  entries: NhqmCatalogEntry[];
  /** 上报准备度(0-100) */
  readinessScore: number;
  /** 缺项 */
  missingFields: string[];
}

export interface INhqmReporter {
  compute(quarter?: string): NhqmReportSnapshot;
  trend(quarters?: number): NhqmReportSnapshot[];
  /** 输出上报 XML(Mock) */
  exportXml(snapshot: NhqmReportSnapshot): { filename: string; mime: string; data: string };
}

/** 院内 22 类 → NHQM 15 类(简版映射) */
const NHQM_MAPPING: Record<string, string> = {
  'neuro': 'NHQM-CV-01',
  'cardio': 'NHQM-CV-02',
  'pulmo': 'NHQM-CV-03',
  'abdomen': 'NHQM-CV-04',
  'trauma': 'NHQM-CV-05',
  'vascular': 'NHQM-CV-06',
  'contrast': 'NHQM-CV-07',
  'obstetric': 'NHQM-CV-08',
  'pediatric': 'NHQM-CV-09',
  'other': 'NHQM-CV-10',
};

class NhqmReporterImpl implements INhqmReporter {
  compute(quarter: string = this.currentQuarter()): NhqmReportSnapshot {
    const events = getCriticalEvents().filter((e) => this.belongsToQuarter(e.reportedAt, quarter));
    const total = events.length;
    const entries: NhqmCatalogEntry[] = Object.entries(NHQM_MAPPING).map(([category, catalogCode]) => {
      const list = events.filter((e) => {
        const rule = CRITICAL_RULES.find((r) => r.id === e.ruleId);
        return rule?.category === category;
      });
      const timely = list.filter((e) => e.onTimeNotification).length;
      const closed = list.filter((e) => e.resolvedTime).length;
      return {
        catalogCode,
        categoryName: category,
        eventCount: list.length,
        timelyNotificationRate: list.length === 0 ? 100 : Math.round((timely / list.length) * 1000) / 10,
        closeLoopRate: list.length === 0 ? 100 : Math.round((closed / list.length) * 1000) / 10,
      };
    });
    const missingFields: string[] = [];
    if (total === 0) missingFields.push('NO_EVENTS');
    const readiness = Math.max(0, 100 - missingFields.length * 10);
    return {
      quarter,
      codeMapping: NHQM_MAPPING,
      entries,
      readinessScore: readiness,
      missingFields,
    };
  }

  trend(quarters: number = 4): NhqmReportSnapshot[] {
    const out: NhqmReportSnapshot[] = [];
    const now = new Date();
    for (let i = quarters - 1; i >= 0; i--) {
      const year = now.getFullYear() - Math.floor(i / 4);
      const q = (4 - (i % 4));
      out.push(this.compute(`${year}Q${q || 4}`));
    }
    return out;
  }

  exportXml(snapshot: NhqmReportSnapshot): { filename: string; mime: string; data: string } {
    const entries = snapshot.entries
      .map(
        (e) =>
          `<Entry code="${e.catalogCode}" name="${e.categoryName}" count="${e.eventCount}" timely="${e.timelyNotificationRate}" closed="${e.closeLoopRate}"/>`,
      )
      .join('\n  ');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NhqmCriticalReport quarter="${snapshot.quarter}" readiness="${snapshot.readinessScore}">
  ${entries}
</NhqmCriticalReport>`;
    return { filename: 'nhqm-critical.xml', mime: 'application/xml', data: xml };
  }

  private currentQuarter(): string {
    const d = new Date();
    return `${d.getFullYear()}Q${Math.floor(d.getMonth() / 3) + 1}`;
  }

  private belongsToQuarter(iso: string, quarter: string): boolean {
    const m = /^(\d{4})Q([1-4])$/.exec(quarter);
    if (!m) return false;
    const year = parseInt(m[1]!, 10);
    const q = parseInt(m[2]!, 10);
    const d = new Date(iso);
    if (d.getFullYear() !== year) return false;
    return Math.floor(d.getMonth() / 3) + 1 === q;
  }
}

export const nhqmReporter: INhqmReporter = new NhqmReporterImpl();