/**
 * G005 RIS v3.0.6.6 - JCI 危急值周转 KPI 报表 (Mock)
 * 关注点:通知及时率 / 关闭及时率 / 双审完成率
 *
 * v3.0.6.12-A4: 事件源改为 store.criticalEvents (unifiedCriticalValues).
 */

import { list } from '../../mockBackend/store';
import { mapUnifiedToCriticalEvents } from '../../../data/criticalValueAdapter';
import { CRITICAL_KPI } from '../../../data/criticalValueMock';
import type { CriticalEvent } from '../../../types/R3/R3.CRITICAL';

function getCriticalEvents(): CriticalEvent[] {
  const unified = list<any>('criticalEvents');
  return mapUnifiedToCriticalEvents(unified);
}

export interface JciKpiSnapshot {
  /** 月份(YYYY-MM) */
  month: string;
  /** 通知及时率 % */
  notifyWithinTarget: number;
  /** 关闭及时率 % (从发现到关闭 <= 60 分钟) */
  closeWithinTarget: number;
  /** 双审完成率 % */
  dualReviewCompletion: number;
  /** 中位通知时长(min) */
  medianNotifyMinutes: number;
  /** P95 通知时长(min) */
  p95NotifyMinutes: number;
  /** 漏报数 */
  missedReports: number;
  /** 总数 */
  totalEvents: number;
  /** JCI 目标 */
  targets: {
    notifyWithinTarget: number;     // >= 95
    closeWithinTarget: number;      // >= 90
    dualReviewCompletion: number;   // >= 95
  };
}

export interface IJciReporter {
  compute(month?: string): JciKpiSnapshot;
  trend(months?: number): JciKpiSnapshot[];
  exportCsv(rows: JciKpiSnapshot[]): { filename: string; mime: string; data: string };
}

class JciReporterImpl implements IJciReporter {
  compute(month: string = this.currentMonth()): JciKpiSnapshot {
    const events = getCriticalEvents().filter((e) => e.reportedAt.startsWith(month));
    const total = events.length;
    const notifyTimely = events.filter((e) => e.onTimeNotification).length;
    const closed = events.filter((e) => e.resolvedTime).length;
    const closedTimely = events.filter((e) => {
      if (!e.resolvedTime) return false;
      const minutes = (new Date(e.resolvedTime).getTime() - new Date(e.reportedAt).getTime()) / 60_000;
      return minutes <= 60;
    }).length;
    const dualReviewed = events.filter((e) => e.dualReview?.firstReviewerId && e.dualReview?.secondReviewerId).length;
    const minutes = events
      .filter((e) => typeof e.responseTimeMinutes === 'number')
      .map((e) => e.responseTimeMinutes!)
      .sort((a, b) => a - b);
    const median = minutes.length === 0 ? 0 : minutes[Math.floor(minutes.length / 2)]!;
    const p95 = minutes.length === 0 ? 0 : minutes[Math.min(minutes.length - 1, Math.floor(minutes.length * 0.95))]!;
    const kpi = CRITICAL_KPI;
    return {
      month,
      totalEvents: total,
      notifyWithinTarget: total === 0 ? 100 : Math.round((notifyTimely / total) * 1000) / 10,
      closeWithinTarget: closed === 0 ? 100 : Math.round((closedTimely / closed) * 1000) / 10,
      dualReviewCompletion: kpi.dualReviewCompletion,
      medianNotifyMinutes: median,
      p95NotifyMinutes: p95,
      missedReports: kpi.missedReports,
      targets: {
        notifyWithinTarget: 95,
        closeWithinTarget: 90,
        dualReviewCompletion: 95,
      },
    };
  }

  trend(months: number = 6): JciKpiSnapshot[] {
    const list: JciKpiSnapshot[] = [];
    const today = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      list.push(this.compute(m));
    }
    return list;
  }

  exportCsv(rows: JciKpiSnapshot[]): { filename: string; mime: string; data: string } {
    const header = ['月份', '总数', '通知及时率', '关闭及时率', '双审完成率', '中位(min)', 'P95(min)', '漏报'];
    const lines = [header.join(',')];
    rows.forEach((r) => {
      lines.push([
        r.month,
        r.totalEvents,
        r.notifyWithinTarget,
        r.closeWithinTarget,
        r.dualReviewCompletion,
        r.medianNotifyMinutes,
        r.p95NotifyMinutes,
        r.missedReports,
      ].join(','));
    });
    return {
      filename: 'jci-critical-kpi.csv',
      mime: 'text/csv',
      data: lines.join('\n'),
    };
  }

  private currentMonth(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
}

export const jciReporter: IJciReporter = new JciReporterImpl();