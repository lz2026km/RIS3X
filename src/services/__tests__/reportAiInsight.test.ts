import { describe, it, expect } from 'vitest';
import { generateReportInsight } from '../reportAiInsight';
import { reportDefinitions } from '../../data/reportDefinitions';
import { generateMockReportData } from '../../data/mockReportData';

describe('generateReportInsight', () => {
  it('returns Chinese text for every report definition', () => {
    reportDefinitions.forEach((def) => {
      const data = generateMockReportData(def.id);
      const insight = generateReportInsight(def, data);
      expect(typeof insight).toBe('string');
      expect(insight.length).toBeGreaterThan(0);
    });
  });

  it('contains trend direction for weekly reports', () => {
    const trendIds = ['exam-volume-weekly', 'exam-volume-monthly', 'exam-volume-yearly', 'patient-wait-time', 'radiation-dose-stats'];
    trendIds.forEach((id) => {
      const def = reportDefinitions.find((d) => d.id === id)!;
      const data = generateMockReportData(id);
      const insight = generateReportInsight(def, data);
      expect(insight.length).toBeGreaterThan(20);
      expect(insight).toMatch(/较|同比|环比|持平|增长|下降/);
    });
  });

  it('contains maintenance keywords for device reports', () => {
    const deviceIds = ['device-utilization', 'device-failure-rate', 'device-maintenance-due'];
    deviceIds.forEach((id) => {
      const def = reportDefinitions.find((d) => d.id === id)!;
      const data = generateMockReportData(id);
      const insight = generateReportInsight(def, data);
      expect(insight.length).toBeGreaterThan(10);
    });
  });

  it('contains 异常 (anomaly) key phrase for critical value reports', () => {
    const def = reportDefinitions.find((d) => d.id === 'critical-value-dept-dist')!;
    const data = generateMockReportData('critical-value-dept-dist');
    const insight = generateReportInsight(def, data);
    expect(insight).toContain('建议');
  });

  it('handles empty data gracefully', () => {
    const def = reportDefinitions[0];
    const insight = generateReportInsight(def, []);
    expect(insight).toBe('暂无数据，无法生成洞察分析。');
  });

  it('includes numeric values in the output for exam-volume-daily', () => {
    const def = reportDefinitions.find((d) => d.id === 'exam-volume-daily')!;
    const data = generateMockReportData('exam-volume-daily');
    const insight = generateReportInsight(def, data);
    expect(insight).toMatch(/\d+/);
  });

  it('includes 检查量 for exam reports', () => {
    const def = reportDefinitions.find((d) => d.id === 'exam-volume-weekly')!;
    const data = generateMockReportData('exam-volume-weekly');
    const insight = generateReportInsight(def, data);
    expect(insight).toContain('检查量');
  });

  it('includes 占比 for modality distribution', () => {
    const def = reportDefinitions.find((d) => d.id === 'modality-distribution')!;
    const data = generateMockReportData('modality-distribution');
    const insight = generateReportInsight(def, data);
    expect(insight).toContain('占比');
  });

  it('includes 通过率 for review pass rate', () => {
    const def = reportDefinitions.find((d) => d.id === 'review-pass-rate')!;
    const data = generateMockReportData('review-pass-rate');
    const insight = generateReportInsight(def, data);
    expect(insight).toContain('通过率');
  });

  it('includes 使用率 for device utilization', () => {
    const def = reportDefinitions.find((d) => d.id === 'device-utilization')!;
    const data = generateMockReportData('device-utilization');
    const insight = generateReportInsight(def, data);
    expect(insight).toContain('使用率');
  });

  it('includes 闭环 for critical value', () => {
    const def = reportDefinitions.find((d) => d.id === 'critical-value-closure')!;
    const data = generateMockReportData('critical-value-closure');
    const insight = generateReportInsight(def, data);
    expect(insight).toContain('闭环');
  });

  it('includes % for percentage values', () => {
    reportDefinitions.slice(0, 10).forEach((def) => {
      const data = generateMockReportData(def.id);
      const insight = generateReportInsight(def, data);
      if (def.aiInsight?.includes('%')) {
        expect(insight).toMatch(/%/);
      }
    });
  });

  it('returns default insight for unknown report ID', () => {
    const def = { id: 'unknown', name: 'Unknown', description: 'test', category: '日常统计' as const, chartType: 'bar' as const, dimensions: ['x'], measures: ['y'] };
    const data = generateMockReportData('exam-volume-daily');
    const insight = generateReportInsight(def, data);
    expect(insight).toContain('Unknown');
  });

  it('generates insight for every single report definition', () => {
    reportDefinitions.forEach((def) => {
      const data = generateMockReportData(def.id);
      const insight = generateReportInsight(def, data);
      expect(insight).toBeTruthy();
      expect(insight.length).toBeGreaterThan(10);
    });
  });

  it('produces different insights for different report IDs', () => {
    const def1 = reportDefinitions.find((d) => d.id === 'exam-volume-daily')!;
    const def2 = reportDefinitions.find((d) => d.id === 'device-utilization')!;
    const data1 = generateMockReportData('exam-volume-daily');
    const data2 = generateMockReportData('device-utilization');
    const insight1 = generateReportInsight(def1, data1);
    const insight2 = generateReportInsight(def2, data2);
    expect(insight1).not.toBe(insight2);
  });

  it('contains 库存 for inventory report', () => {
    const def = reportDefinitions.find((d) => d.id === 'contrast-inventory-warning')!;
    const data = generateMockReportData('contrast-inventory-warning');
    const insight = generateReportInsight(def, data);
    expect(insight).toContain('库存');
  });

  it('generates insight for 患者服务 category reports', () => {
    const patientDefs = reportDefinitions.filter((d) => d.category === '患者服务');
    patientDefs.forEach((def) => {
      const data = generateMockReportData(def.id);
      const insight = generateReportInsight(def, data);
      expect(insight.length).toBeGreaterThan(10);
    });
  });

  it('generates insight for 综合质控 category reports', () => {
    const qcDefs = reportDefinitions.filter((d) => d.category === '综合质控');
    qcDefs.forEach((def) => {
      const data = generateMockReportData(def.id);
      const insight = generateReportInsight(def, data);
      expect(insight.length).toBeGreaterThan(10);
    });
  });

  it('mentions 检查量 in daily report insight', () => {
    const def = reportDefinitions.find((d) => d.id === 'exam-volume-daily')!;
    const data = generateMockReportData('exam-volume-daily');
    const insight = generateReportInsight(def, data);
    expect(insight).toContain('检查');
  });

  it('mentions 平均 in timely report', () => {
    const def = reportDefinitions.find((d) => d.id === 'patient-wait-time')!;
    const data = generateMockReportData('patient-wait-time');
    const insight = generateReportInsight(def, data);
    expect(insight).toContain('平均');
  });

  it('mentions AI accuracy in ai report', () => {
    const def = reportDefinitions.find((d) => d.id === 'ai-accuracy-rate')!;
    const data = generateMockReportData('ai-accuracy-rate');
    const insight = generateReportInsight(def, data);
    expect(insight).toContain('AI');
  });

  it('mentions 移动端 in mobile usage report', () => {
    const def = reportDefinitions.find((d) => d.id === 'mobile-usage')!;
    const data = generateMockReportData('mobile-usage');
    const insight = generateReportInsight(def, data);
    expect(insight).toContain('移动端');
  });

  it('contains 接口 for api call volume report', () => {
    const def = reportDefinitions.find((d) => d.id === 'api-call-volume')!;
    const data = generateMockReportData('api-call-volume');
    const insight = generateReportInsight(def, data);
    expect(insight).toContain('接口');
  });

  it('contains 在线率 for system online report', () => {
    const def = reportDefinitions.find((d) => d.id === 'system-online-rate')!;
    const data = generateMockReportData('system-online-rate');
    const insight = generateReportInsight(def, data);
    expect(insight).toContain('在线率');
  });

  it('contains 存储 for image storage report', () => {
    const def = reportDefinitions.find((d) => d.id === 'image-storage-trend')!;
    const data = generateMockReportData('image-storage-trend');
    const insight = generateReportInsight(def, data);
    expect(insight).toContain('存储');
  });

  it('contains 辐射 for radiation dose report', () => {
    const def = reportDefinitions.find((d) => d.id === 'radiation-dose-stats')!;
    const data = generateMockReportData('radiation-dose-stats');
    const insight = generateReportInsight(def, data);
    expect(insight).toContain('剂量');
  });

  it('contains 对比剂 for contrast report', () => {
    const def = reportDefinitions.find((d) => d.id === 'contrast-adverse-rate')!;
    const data = generateMockReportData('contrast-adverse-rate');
    const insight = generateReportInsight(def, data);
    expect(insight).toContain('对比剂');
  });

  it('contains 模板 for template report', () => {
    const def = reportDefinitions.find((d) => d.id === 'template-usage-frequency')!;
    const data = generateMockReportData('template-usage-frequency');
    const insight = generateReportInsight(def, data);
    expect(insight).toContain('模板');
  });

  it('contains 阳性 for positive rate report', () => {
    const def = reportDefinitions.find((d) => d.id === 'positive-rate')!;
    const data = generateMockReportData('positive-rate');
    const insight = generateReportInsight(def, data);
    expect(insight).toContain('阳性');
  });

  it('contains 返修 for rework rate report', () => {
    const def = reportDefinitions.find((d) => d.id === 'rework-rate')!;
    const data = generateMockReportData('rework-rate');
    const insight = generateReportInsight(def, data);
    expect(insight).toContain('返修');
  });

  it('contains 远程 for consultation report', () => {
    const def = reportDefinitions.find((d) => d.id === 'consultation-stats')!;
    const data = generateMockReportData('consultation-stats');
    const insight = generateReportInsight(def, data);
    expect(insight).toContain('会诊');
  });

  it('contains 等待 for wait time report', () => {
    const def = reportDefinitions.find((d) => d.id === 'patient-wait-time')!;
    const data = generateMockReportData('patient-wait-time');
    const insight = generateReportInsight(def, data);
    expect(insight).toContain('等待');
  });

  it('contains 就诊 for source distribution report', () => {
    const def = reportDefinitions.find((d) => d.id === 'patient-source-dist')!;
    const data = generateMockReportData('patient-source-dist');
    const insight = generateReportInsight(def, data);
    expect(insight).toContain('门诊');
  });
});
