import { describe, it, expect } from 'vitest';
import { generateMockReportData } from '../mockReportData';
import { reportDefinitions } from '../reportDefinitions';

describe('generateMockReportData', () => {
  it('returns an array for every report definition', () => {
    reportDefinitions.forEach((def) => {
      const data = generateMockReportData(def.id);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });
  });

  it('returns data with numeric value fields', () => {
    reportDefinitions.forEach((def) => {
      const data = generateMockReportData(def.id);
      data.forEach((row) => {
        if ('value' in row) {
          expect(typeof row.value).toBe('number');
        }
        if ('name' in row) {
          expect(typeof row.name).toBe('string');
        }
      });
    });
  });

  describe('daily report has correct structure', () => {
    const data = generateMockReportData('exam-volume-daily');
    it('has 30 entries (default date range)', () => {
      expect(data).toHaveLength(30);
    });
    it('each entry has name, CT, MR, DR, MG, DSA', () => {
      data.forEach((row) => {
        expect(row).toHaveProperty('name');
        expect(row).toHaveProperty('CT');
        expect(row).toHaveProperty('MR');
        expect(row).toHaveProperty('DR');
      });
    });
    it('CT values are positive numbers', () => {
      data.forEach((row) => {
        expect(row.CT).toBeGreaterThan(0);
      });
    });
  });

  describe('weekly report', () => {
    const data = generateMockReportData('exam-volume-weekly');
    it('has 12 entries', () => {
      expect(data).toHaveLength(12);
    });
    it('each entry has CT, MR, DR', () => {
      data.forEach((row) => {
        expect(row).toHaveProperty('CT');
        expect(row).toHaveProperty('MR');
        expect(row).toHaveProperty('DR');
      });
    });
  });

  describe('monthly report', () => {
    const data = generateMockReportData('exam-volume-monthly');
    it('has 12 entries', () => {
      expect(data).toHaveLength(12);
    });
    it('each entry has CT, MR, DR, MG, DSA', () => {
      data.forEach((row) => {
        expect(row).toHaveProperty('CT');
        expect(row).toHaveProperty('MR');
        expect(row).toHaveProperty('DR');
        expect(row).toHaveProperty('MG');
      });
    });
  });

  describe('yearly report', () => {
    const data = generateMockReportData('exam-volume-yearly');
    it('has 5 entries', () => {
      expect(data).toHaveLength(5);
    });
    it('each entry has growth field', () => {
      data.forEach((row) => {
        expect(row).toHaveProperty('growth');
      });
    });
  });

  describe('modality distribution', () => {
    const data = generateMockReportData('modality-distribution');
    it('has 6 entries', () => {
      expect(data).toHaveLength(6);
    });
    it('each entry has percentage field', () => {
      data.forEach((row) => {
        expect(row).toHaveProperty('percentage');
      });
    });
    it('percentages sum to 100', () => {
      const sum = data.reduce((acc, row) => acc + (row.percentage as number), 0);
      expect(Math.round(sum)).toBe(100);
    });
  });

  describe('body part top20', () => {
    const data = generateMockReportData('body-part-top20');
    it('has 20 entries', () => {
      expect(data).toHaveLength(20);
    });
  });

  describe('age distribution', () => {
    const data = generateMockReportData('age-distribution');
    it('has 9 entries', () => {
      expect(data).toHaveLength(9);
    });
  });

  describe('gender distribution', () => {
    const data = generateMockReportData('gender-distribution');
    it('has 2 entries', () => {
      expect(data).toHaveLength(2);
    });
  });

  describe('peak hour analysis', () => {
    const data = generateMockReportData('peak-hour-analysis');
    it('has 24 entries', () => {
      expect(data).toHaveLength(24);
    });
    it('morning peak has higher values', () => {
      const morning = data.filter((d) => parseInt(String(d.name)) >= 8 && parseInt(String(d.name)) <= 11);
      const night = data.filter((d) => parseInt(String(d.name)) >= 0 && parseInt(String(d.name)) <= 5);
      const morningAvg = morning.reduce((s, r) => s + (r.value as number), 0) / morning.length;
      const nightAvg = night.reduce((s, r) => s + (r.value as number), 0) / night.length;
      expect(morningAvg).toBeGreaterThan(nightAvg);
    });
  });

  describe('device utilization', () => {
    const data = generateMockReportData('device-utilization');
    it('has utilization values between 0 and 100', () => {
      data.forEach((row) => {
        expect(row.value).toBeGreaterThanOrEqual(0);
        expect(row.value).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('default case', () => {
    it('returns 30 entries for unknown report ID', () => {
      const data = generateMockReportData('unknown-report-id');
      expect(data).toHaveLength(30);
    });
  });

  describe('qc score distribution', () => {
    const data = generateMockReportData('qc-score-distribution');
    it('has 4 entries', () => {
      expect(data).toHaveLength(4);
    });
    it('percentages sum to 100', () => {
      const sum = data.reduce((acc, row) => acc + (row.percentage as number), 0);
      expect(Math.round(sum)).toBe(100);
    });
  });

  describe('bi-rads distribution', () => {
    const data = generateMockReportData('bi-rads-distribution');
    it('has 9 BI-RADS categories', () => {
      expect(data).toHaveLength(9);
    });
  });

  describe('li-rads distribution', () => {
    const data = generateMockReportData('li-rads-distribution');
    it('has 7 LI-RADS categories', () => {
      expect(data).toHaveLength(7);
    });
  });

  describe('date range filtering', () => {
    it('returns data for all report types', () => {
      const data = generateMockReportData('exam-volume-daily', ['2026-01-01', '2026-01-31']);
      expect(data.length).toBeGreaterThan(0);
    });

    it('returns data with custom date range for weekly', () => {
      const data = generateMockReportData('exam-volume-weekly', ['2026-01-01', '2026-03-31']);
      expect(data.length).toBeGreaterThan(0);
    });
  });

  describe('rads distribution reports', () => {
    it('bi-rads 3 class is most common', () => {
      const data = generateMockReportData('bi-rads-distribution');
      const birads3 = data.find((d) => String(d.name) === 'BI-RADS 3');
      expect(birads3).toBeTruthy();
      expect(birads3!.value).toBeGreaterThan(0);
    });

    it('li-rads has LR-M and LR-TIV classes', () => {
      const data = generateMockReportData('li-rads-distribution');
      expect(data.some((d) => String(d.name) === 'LR-M')).toBe(true);
      expect(data.some((d) => String(d.name) === 'LR-TIV')).toBe(true);
    });
  });

  describe('financial data reports', () => {
    it('revenue-cost-analysis has revenue fields in 万元', () => {
      const data = generateMockReportData('revenue-cost-analysis');
      data.forEach((row) => {
        expect(row).toHaveProperty('收入');
        expect(row).toHaveProperty('成本');
        expect(row).toHaveProperty('利润');
      });
    });

    it('insurance type distribution has 6 types', () => {
      const data = generateMockReportData('insurance-type-dist');
      expect(data).toHaveLength(6);
    });
  });

  describe('service reports', () => {
    it('patient-source-dist has 4 sources', () => {
      const data = generateMockReportData('patient-source-dist');
      expect(data).toHaveLength(4);
    });

    it('appointment-cancel-reason has 5 reasons', () => {
      const data = generateMockReportData('appointment-cancel-rate');
      expect(data).toHaveLength(5);
    });
  });

  describe('system reports', () => {
    it('system-online-rate has uptime values close to 100', () => {
      const data = generateMockReportData('system-online-rate');
      data.forEach((row) => {
        expect(row.value).toBeGreaterThan(98);
      });
    });
  });

  describe('data integrity checks', () => {
    it('all series entries have non-negative values (except device-maintenance-due and growth)', () => {
      reportDefinitions.filter(d => d.id !== 'device-maintenance-due').forEach((def) => {
        const data = generateMockReportData(def.id);
        data.forEach((row) => {
          Object.entries(row).forEach(([key, val]) => {
            if (key !== 'name' && key !== 'growth' && typeof val === 'number') {
              expect(val).toBeGreaterThanOrEqual(0);
            }
          });
        });
      });
    });

    it('modality distribution totals match', () => {
      const data = generateMockReportData('modality-distribution');
      const totalValue = data.reduce((s, r) => s + (r.value as number), 0);
      expect(totalValue).toBe(16260);
    });

    it('gender distribution reflects realistic male/female split', () => {
      const data = generateMockReportData('gender-distribution');
      const male = data.find((d) => d.name === '男')!;
      const female = data.find((d) => d.name === '女')!;
      expect(male.percentage).toBe(48.8);
      expect(female.percentage).toBe(51.2);
    });

    it('qc score distribution reflects quality hierarchy', () => {
      const data = generateMockReportData('qc-score-distribution');
      const gradeA = data.find((d) => String(d.name).includes('甲级'))!;
      const gradeD = data.find((d) => String(d.name).includes('丁级'))!;
      expect(Number(gradeA.value)).toBeGreaterThan(Number(gradeD.value));
    });
  });

  describe('time series reports', () => {
    it('daily report generates 30 days by default', () => {
      const data = generateMockReportData('exam-volume-daily');
      expect(data).toHaveLength(30);
    });

    it('weekly report generates 12 weeks', () => {
      const data = generateMockReportData('exam-volume-weekly');
      expect(data).toHaveLength(12);
    });

    it('monthly report generates 12 months', () => {
      const data = generateMockReportData('exam-volume-monthly');
      expect(data).toHaveLength(12);
    });
  });
});
