// [v3.0.6.11-95 Wave2A P0] 状态中英文映射层单元测试
// 双兼容验证: MSW 中文 (草稿/已提交/初审中...) + 真实后端英文 (WRITING/INITIAL_REVIEW/REJECTED...) + reportMachine camelCase
import { describe, it, expect } from 'vitest';
import {
  normalizeReportStatus,
  displayStatus,
  toEnState,
  EN_STATE_TO_CN,
  REPORT_STATUS_META,
} from '../statusMeta';

describe('statusMeta 中英文映射层 (Wave2A P0)', () => {
  it('EN_STATE_TO_CN 覆盖 21+ 态 (后端英文 → 中文)', () => {
    expect(EN_STATE_TO_CN.REJECTED).toBe('已驳回');
    expect(EN_STATE_TO_CN.WRITING).toBe('书写中');
    expect(EN_STATE_TO_CN.INITIAL_REVIEW).toBe('初审中');
    expect(EN_STATE_TO_CN.PUBLISHED).toBe('已发布');
    expect(EN_STATE_TO_CN.REDISTRIBUTING).toBe('跨院区重分配');
    expect(EN_STATE_TO_CN.SUPPLEMENTED).toBe('已补充');
    // 全部 EN 态在展示元数据中都有条目 (StatusBadge 不会回退到 待分配)
    for (const cn of Object.values(EN_STATE_TO_CN)) {
      expect(REPORT_STATUS_META[cn as keyof typeof REPORT_STATUS_META]).toBeDefined();
    }
  });

  it('normalizeReportStatus: 后端英文 → 中文', () => {
    expect(normalizeReportStatus('REJECTED')).toBe('已驳回');
    expect(normalizeReportStatus('INITIAL_REVIEW')).toBe('初审中');
    expect(normalizeReportStatus('WRITING')).toBe('书写中');
    expect(normalizeReportStatus('DRAFT')).toBe('草稿');
    expect(normalizeReportStatus('CO_SIGN_REVIEW')).toBe('CoSign双签');
  });

  it('normalizeReportStatus: MSW 中文 / 小写 / camelCase 兼容', () => {
    expect(normalizeReportStatus('已驳回')).toBe('已驳回');
    expect(normalizeReportStatus('草稿')).toBe('草稿');
    expect(normalizeReportStatus('已提交')).toBe('已提交');
    expect(normalizeReportStatus('draft')).toBe('草稿');
    expect(normalizeReportStatus('submitted')).toBe('已提交');
    expect(normalizeReportStatus('rejected')).toBe('已驳回');
    expect(normalizeReportStatus('inReview')).toBe('初审中');
    expect(normalizeReportStatus('initialReview')).toBe('初审中');
    expect(normalizeReportStatus('rejected')).toBe('已驳回');
    // 中文别名
    expect(normalizeReportStatus('已退回')).toBe('已驳回');
    expect(normalizeReportStatus('待审核')).toBe('已提交');
    expect(normalizeReportStatus('已签署')).toBe('已签发');
    expect(normalizeReportStatus('初核')).toBe('初审中');
  });

  it('toEnState: 任一输入 → 大写英文枚举 (CAN_* 逻辑判断用)', () => {
    expect(toEnState('REJECTED')).toBe('REJECTED');
    expect(toEnState('已驳回')).toBe('REJECTED');
    expect(toEnState('rejected')).toBe('REJECTED');
    expect(toEnState('WRITING')).toBe('WRITING');
    expect(toEnState('草稿')).toBe('DRAFT');
    expect(toEnState('draft')).toBe('DRAFT');
    expect(toEnState('初审中')).toBe('INITIAL_REVIEW');
    expect(toEnState('inReview')).toBe('INITIAL_REVIEW');
    expect(toEnState('initialReview')).toBe('INITIAL_REVIEW');
    expect(toEnState('已发布')).toBe('PUBLISHED');
    expect(toEnState('')).toBe('PENDING_ASSIGNMENT');
  });

  it('displayStatus: 展示层统一中文', () => {
    expect(displayStatus('REJECTED')).toBe('已驳回');
    expect(displayStatus('INITIAL_REVIEW')).toBe('初审中');
    expect(displayStatus('已驳回')).toBe('已驳回');
    expect(displayStatus('draft')).toBe('草稿');
  });
});
