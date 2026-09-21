import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useExamStore } from '../examStore';

const { mockList, mockCheckIn, mockStart, mockComplete, mockCancel } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockCheckIn: vi.fn(),
  mockStart: vi.fn(),
  mockComplete: vi.fn(),
  mockCancel: vi.fn(),
}));

vi.mock('@services/api', () => ({
  examApi: {
    list: mockList,
    checkIn: mockCheckIn,
    start: mockStart,
    complete: mockComplete,
    cancel: mockCancel,
  },
}));

describe('examStore', () => {
  beforeEach(() => {
    useExamStore.setState({ exams: [], loading: false, error: null });
    vi.clearAllMocks();
  });

  describe('load', () => {
    it('loads exams from API', async () => {
      const data = [{ id: 'ex-1', patientId: 'P001', status: '已申请', modality: 'CT', bodyPart: '胸部', priority: '普通', patientName: '张三', scheduledAt: '2026-01-01', patientType: '门诊', gender: '男', age: 45, examId: 'ex-1' }];
      mockList.mockResolvedValue({ success: true, data });
      await useExamStore.getState().load();
      expect(useExamStore.getState().exams).toHaveLength(1);
      expect(useExamStore.getState().loading).toBe(false);
    });

    it('handles API failure', async () => {
      mockList.mockResolvedValue({ success: false, data: null, error: { message: '加载失败' } });
      await useExamStore.getState().load();
      expect(useExamStore.getState().exams).toHaveLength(0);
      expect(useExamStore.getState().error).toBe('加载失败');
    });
  });

  describe('transition - valid cases', () => {
    it('cancel from registered succeeds', async () => {
      useExamStore.setState({
        exams: [{ id: 'ex-1', status: '已登记', patientId: 'P001', modality: 'CT', bodyPart: '胸部', priority: '普通', patientName: '张三', scheduledAt: '2026-01-01', patientType: '门诊', gender: '男', age: 45, examId: 'ex-1' }],
      });
      mockCancel.mockResolvedValue({ success: true });
      await useExamStore.getState().transition('ex-1', 'cancel');
      expect(useExamStore.getState().error).toBeNull();
      expect(mockCancel).toHaveBeenCalledWith('ex-1');
    });

    it('checkIn from scheduled succeeds (ARRIVE 报到)', async () => {
      useExamStore.setState({
        exams: [{ id: 'ex-1', status: '已排程', patientId: 'P001', modality: 'CT', bodyPart: '胸部', priority: '普通', patientName: '张三', scheduledAt: '2026-01-01', patientType: '门诊', gender: '男', age: 45, examId: 'ex-1' }],
      });
      mockCheckIn.mockResolvedValue({ success: true });
      await useExamStore.getState().transition('ex-1', 'checkIn');
      expect(useExamStore.getState().error).toBeNull();
      expect(mockCheckIn).toHaveBeenCalledWith('ex-1');
    });

    it('start from arrived succeeds', async () => {
      useExamStore.setState({
        exams: [{ id: 'ex-1', status: '已报到', patientId: 'P001', modality: 'CT', bodyPart: '胸部', priority: '普通', patientName: '张三', scheduledAt: '2026-01-01', patientType: '门诊', gender: '男', age: 45, examId: 'ex-1' }],
      });
      mockStart.mockResolvedValue({ success: true });
      await useExamStore.getState().transition('ex-1', 'start');
      expect(useExamStore.getState().error).toBeNull();
      expect(mockStart).toHaveBeenCalledWith('ex-1');
    });

    it('complete from inProgress succeeds', async () => {
      useExamStore.setState({
        exams: [{ id: 'ex-1', status: '检查中', patientId: 'P001', modality: 'CT', bodyPart: '胸部', priority: '普通', patientName: '张三', scheduledAt: '2026-01-01', patientType: '门诊', gender: '男', age: 45, examId: 'ex-1' }],
      });
      mockComplete.mockResolvedValue({ success: true });
      await useExamStore.getState().transition('ex-1', 'complete');
      expect(useExamStore.getState().error).toBeNull();
      expect(mockComplete).toHaveBeenCalledWith('ex-1');
    });
  });

  describe('transition - invalid cases rejected by guards', () => {
    it('completed rejects cancel (终态不可取消)', async () => {
      useExamStore.setState({
        exams: [{ id: 'ex-1', status: '已完成', patientId: 'P001', modality: 'CT', bodyPart: '胸部', priority: '普通', patientName: '张三', scheduledAt: '2026-01-01', patientType: '门诊', gender: '男', age: 45, examId: 'ex-1' }],
      });
      await useExamStore.getState().transition('ex-1', 'cancel');
      expect(useExamStore.getState().error).toContain('状态机拒绝');
      expect(mockCancel).not.toHaveBeenCalled();
    });

    it('arrived rejects checkIn (已报到不可重复报到)', async () => {
      useExamStore.setState({
        exams: [{ id: 'ex-1', status: '已报到', patientId: 'P001', modality: 'CT', bodyPart: '胸部', priority: '普通', patientName: '张三', scheduledAt: '2026-01-01', patientType: '门诊', gender: '男', age: 45, examId: 'ex-1' }],
      });
      await useExamStore.getState().transition('ex-1', 'checkIn');
      expect(useExamStore.getState().error).toContain('状态机拒绝');
      expect(mockCheckIn).not.toHaveBeenCalled();
    });

    it('scheduled rejects start (needs arrived first)', async () => {
      useExamStore.setState({
        exams: [{ id: 'ex-1', status: '已排程', patientId: 'P001', modality: 'CT', bodyPart: '胸部', priority: '普通', patientName: '张三', scheduledAt: '2026-01-01', patientType: '门诊', gender: '男', age: 45, examId: 'ex-1' }],
      });
      await useExamStore.getState().transition('ex-1', 'start');
      expect(useExamStore.getState().error).toContain('状态机拒绝');
      expect(mockStart).not.toHaveBeenCalled();
    });

    it('handles unknown exam id', async () => {
      await useExamStore.getState().transition('nonexistent', 'cancel');
      expect(useExamStore.getState().error).toContain('not found');
    });
  });
});
