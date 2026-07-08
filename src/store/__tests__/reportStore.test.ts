import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useReportStore } from '../reportStore';

const { mockList, mockSubmit, mockSign, mockPublish, mockReject, mockRevise } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockSubmit: vi.fn(),
  mockSign: vi.fn(),
  mockPublish: vi.fn(),
  mockReject: vi.fn(),
  mockRevise: vi.fn(),
}));

vi.mock('@services/api', () => ({
  reportApi: {
    list: mockList,
    submit: mockSubmit,
    sign: mockSign,
    publish: mockPublish,
    reject: mockReject,
    revise: mockRevise,
  },
}));

const baseReport = {
  id: 'rpt-1',
  reportId: 'rpt-1',
  patientId: 'P001',
  patientName: '张三',
  examId: 'ex-1',
  modality: 'CT',
  bodyPart: '胸部',
  createdTime: '2026-01-01T00:00:00.000Z',
  updatedTime: '2026-01-01T00:00:00.000Z',
};

describe('reportStore', () => {
  beforeEach(() => {
    useReportStore.setState({ reports: [], loading: false, error: null });
    vi.clearAllMocks();
  });

  describe('load', () => {
    it('loads reports from API', async () => {
      const data = [{ ...baseReport, status: '待分配' }];
      mockList.mockResolvedValue({ success: true, data });
      await useReportStore.getState().load();
      expect(useReportStore.getState().reports).toHaveLength(1);
      expect(useReportStore.getState().loading).toBe(false);
    });

    it('handles API failure', async () => {
      mockList.mockResolvedValue({ success: false, data: null, error: { message: '加载失败' } });
      await useReportStore.getState().load();
      expect(useReportStore.getState().reports).toHaveLength(0);
      expect(useReportStore.getState().error).toBe('加载失败');
    });
  });

  describe('submit', () => {
    it('transitions from writing to submitted', async () => {
      useReportStore.setState({ reports: [{ ...baseReport, status: '书写中' }] });
      mockSubmit.mockResolvedValue({ success: true });
      await useReportStore.getState().submit('rpt-1');
      expect(useReportStore.getState().error).toBeNull();
      expect(useReportStore.getState().reports[0].status).toBe('已提交');
    });

    it('rejects submit from pendingAssignment', async () => {
      useReportStore.setState({ reports: [{ ...baseReport, status: '待分配' }] });
      await useReportStore.getState().submit('rpt-1');
      expect(useReportStore.getState().error).toContain('状态机拒绝');
      expect(mockSubmit).not.toHaveBeenCalled();
    });
  });

  describe('sign', () => {
    it('transitions from reviewed to signed', async () => {
      useReportStore.setState({ reports: [{ ...baseReport, status: '已审核' }] });
      mockSign.mockResolvedValue({ success: true });
      await useReportStore.getState().sign('rpt-1');
      expect(useReportStore.getState().error).toBeNull();
      expect(useReportStore.getState().reports[0].status).toBe('已签发');
    });

    it('rejects sign from writing', async () => {
      useReportStore.setState({ reports: [{ ...baseReport, status: '书写中' }] });
      await useReportStore.getState().sign('rpt-1');
      expect(useReportStore.getState().error).toContain('状态机拒绝');
      expect(mockSign).not.toHaveBeenCalled();
    });
  });

  describe('publish', () => {
    it('transitions from signed to published with qualityScore >= 60', async () => {
      useReportStore.setState({ reports: [{ ...baseReport, status: '已签发' }] });
      mockPublish.mockResolvedValue({ success: true });
      await useReportStore.getState().publish('rpt-1', 85);
      expect(useReportStore.getState().error).toBeNull();
      expect(useReportStore.getState().reports[0].status).toBe('已发布');
    });

    it('rejects publish with low qualityScore < 60 (guard)', async () => {
      useReportStore.setState({ reports: [{ ...baseReport, status: '已签发' }] });
      await useReportStore.getState().publish('rpt-1', 50);
      expect(useReportStore.getState().error).toContain('状态机拒绝');
      expect(mockPublish).not.toHaveBeenCalled();
    });

    it('rejects publish from writing (wrong state)', async () => {
      useReportStore.setState({ reports: [{ ...baseReport, status: '书写中' }] });
      await useReportStore.getState().publish('rpt-1', 85);
      expect(useReportStore.getState().error).toContain('状态机拒绝');
      expect(mockPublish).not.toHaveBeenCalled();
    });
  });

  describe('reject', () => {
    it('transitions from initialReview to rejected', async () => {
      useReportStore.setState({ reports: [{ ...baseReport, status: '初审中' }] });
      mockReject.mockResolvedValue({ success: true });
      await useReportStore.getState().reject('rpt-1', '影像质量不足');
      expect(useReportStore.getState().error).toBeNull();
      expect(useReportStore.getState().reports[0].status).toBe('已驳回');
    });

    it('rejects reject from pendingAssignment', async () => {
      useReportStore.setState({ reports: [{ ...baseReport, status: '待分配' }] });
      await useReportStore.getState().reject('rpt-1', '无原因');
      expect(useReportStore.getState().error).toContain('状态机拒绝');
      expect(mockReject).not.toHaveBeenCalled();
    });
  });

  describe('revise', () => {
    it('transitions from published to amending', async () => {
      useReportStore.setState({ reports: [{ ...baseReport, status: '已发布' }] });
      mockRevise.mockResolvedValue({ success: true });
      await useReportStore.getState().revise('rpt-1');
      expect(useReportStore.getState().error).toBeNull();
      expect(useReportStore.getState().reports[0].status).toBe('修订中');
    });

    it('rejects revise from pendingAssignment', async () => {
      useReportStore.setState({ reports: [{ ...baseReport, status: '待分配' }] });
      await useReportStore.getState().revise('rpt-1');
      expect(useReportStore.getState().error).toContain('状态机拒绝');
      expect(mockRevise).not.toHaveBeenCalled();
    });
  });
});
