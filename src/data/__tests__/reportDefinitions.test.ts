import { describe, it, expect } from 'vitest';
import { reportDefinitions } from '../reportDefinitions';

const VALID_CHART_TYPES = ['line', 'bar', 'pie', 'area', 'radar', 'stackedBar', 'composed', 'funnel', 'heatmap', 'radialBar'];
const VALID_CATEGORIES = ['日常统计', '设备管理', '报告质量', '危急值', '绩效分析', 'AI评估', '患者服务', '综合质控'];

describe('reportDefinitions', () => {
  it('has 44 report definitions', () => {
    expect(reportDefinitions.length).toBe(44);
  });

  it('every definition has required fields', () => {
    reportDefinitions.forEach((def) => {
      expect(def).toHaveProperty('id');
      expect(def).toHaveProperty('category');
      expect(def).toHaveProperty('name');
      expect(def).toHaveProperty('description');
      expect(def).toHaveProperty('chartType');
      expect(def).toHaveProperty('dimensions');
      expect(def).toHaveProperty('measures');
    });
  });

  it('every id is unique', () => {
    const ids = reportDefinitions.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every category is valid', () => {
    reportDefinitions.forEach((def) => {
      expect(VALID_CATEGORIES).toContain(def.category);
    });
  });

  it('every chartType is valid', () => {
    reportDefinitions.forEach((def) => {
      expect(VALID_CHART_TYPES).toContain(def.chartType);
    });
  });

  it('every name is non-empty', () => {
    reportDefinitions.forEach((def) => {
      expect(def.name.length).toBeGreaterThan(0);
    });
  });

  it('every description is non-empty', () => {
    reportDefinitions.forEach((def) => {
      expect(def.description.length).toBeGreaterThan(0);
    });
  });

  it('every dimensions array is non-empty', () => {
    reportDefinitions.forEach((def) => {
      expect(def.dimensions.length).toBeGreaterThan(0);
    });
  });

  it('every measures array is non-empty', () => {
    reportDefinitions.forEach((def) => {
      expect(def.measures.length).toBeGreaterThan(0);
    });
  });

  it('every aiInsight template is non-empty where defined', () => {
    reportDefinitions.forEach((def) => {
      if (def.aiInsight) {
        expect(def.aiInsight.length).toBeGreaterThan(0);
      }
    });
  });

  describe('categories', () => {
    const categoryGroups: Record<string, string[]> = {};
    reportDefinitions.forEach((def) => {
      if (!categoryGroups[def.category]) categoryGroups[def.category] = [];
      categoryGroups[def.category].push(def.id);
    });

    VALID_CATEGORIES.forEach((cat) => {
      it(`${cat} has at least 2 reports`, () => {
        expect(categoryGroups[cat].length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('ids follow naming convention', () => {
    it('all ids use kebab-case', () => {
      reportDefinitions.forEach((def) => {
        expect(def.id).toMatch(/^[a-z][a-z0-9-]*$/);
      });
    });
  });

  describe('chart type coverage', () => {
    it('includes bar chart type', () => {
      const barDefs = reportDefinitions.filter((d) => d.chartType === 'bar');
      expect(barDefs.length).toBeGreaterThan(0);
    });

    it('includes line chart type', () => {
      const lineDefs = reportDefinitions.filter((d) => d.chartType === 'line');
      expect(lineDefs.length).toBeGreaterThan(0);
    });

    it('includes pie chart type', () => {
      const pieDefs = reportDefinitions.filter((d) => d.chartType === 'pie');
      expect(pieDefs.length).toBeGreaterThan(0);
    });

    it('includes composed chart type', () => {
      const composedDefs = reportDefinitions.filter((d) => d.chartType === 'composed');
      expect(composedDefs.length).toBeGreaterThan(0);
    });
  });

  describe('每个分类都有对应的AI洞察模板', () => {
    it('AI评估 category has aiInsight defined', () => {
      const aiDefs = reportDefinitions.filter((d) => d.category === 'AI评估');
      aiDefs.forEach((d) => {
        expect(d.aiInsight).toBeTruthy();
      });
    });

    it('所有日常统计报告都有aiInsight', () => {
      const dailyDefs = reportDefinitions.filter((d) => d.category === '日常统计');
      dailyDefs.forEach((d) => {
        expect(d.aiInsight).toBeTruthy();
      });
    });

    it('所有设备管理报告都有aiInsight', () => {
      const deviceDefs = reportDefinitions.filter((d) => d.category === '设备管理');
      deviceDefs.forEach((d) => {
        expect(d.aiInsight).toBeTruthy();
      });
    });

    it('所有报告质量报告都有aiInsight', () => {
      const qualityDefs = reportDefinitions.filter((d) => d.category === '报告质量');
      qualityDefs.forEach((d) => {
        expect(d.aiInsight).toBeTruthy();
      });
    });
  });

  describe('measures coverage', () => {
    it('every definition has at least one measure', () => {
      reportDefinitions.forEach((def) => {
        expect(def.measures.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('检查量 measure appears in many reports', () => {
      const withExamCount = reportDefinitions.filter((d) => d.measures.includes('检查量'));
      expect(withExamCount.length).toBeGreaterThan(5);
    });
  });

  describe('dimensions coverage', () => {
    it('设备类型 dimension appears in multiple reports', () => {
      const withModality = reportDefinitions.filter((d) => d.dimensions.includes('设备类型'));
      expect(withModality.length).toBeGreaterThan(3);
    });

    it('月份 dimension appears in trend reports', () => {
      const withMonth = reportDefinitions.filter((d) => d.dimensions.includes('月份'));
      expect(withMonth.length).toBeGreaterThan(3);
    });
  });

  describe('descriptions are meaningful', () => {
    it('every description is at least 4 characters', () => {
      reportDefinitions.forEach((def) => {
        expect(def.description.length).toBeGreaterThanOrEqual(4);
      });
    });
  });

  describe('每类报告数量', () => {
    it('日常统计 has at least 5 reports', () => {
      const count = reportDefinitions.filter((d) => d.category === '日常统计').length;
      expect(count).toBeGreaterThanOrEqual(5);
    });

    it('报告质量 has at least 5 reports', () => {
      const count = reportDefinitions.filter((d) => d.category === '报告质量').length;
      expect(count).toBeGreaterThanOrEqual(5);
    });

    it('绩效分析 has at least 4 reports', () => {
      const count = reportDefinitions.filter((d) => d.category === '绩效分析').length;
      expect(count).toBeGreaterThanOrEqual(4);
    });

    it('患者服务 has at least 2 reports', () => {
      const count = reportDefinitions.filter((d) => d.category === '患者服务').length;
      expect(count).toBeGreaterThanOrEqual(2);
    });

    it('AI评估 has at least 2 reports', () => {
      const count = reportDefinitions.filter((d) => d.category === 'AI评估').length;
      expect(count).toBeGreaterThanOrEqual(2);
    });

    it('危急值 has at least 2 reports', () => {
      const count = reportDefinitions.filter((d) => d.category === '危急值').length;
      expect(count).toBeGreaterThanOrEqual(2);
    });

    it('综合质控 has at least 2 reports', () => {
      const count = reportDefinitions.filter((d) => d.category === '综合质控').length;
      expect(count).toBeGreaterThanOrEqual(2);
    });
  });
});
