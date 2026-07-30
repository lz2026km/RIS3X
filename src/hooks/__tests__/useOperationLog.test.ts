import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useOperationLog } from '../useOperationLog';
import { useAuth } from '../useAuth';

vi.mock('../useAuth', () => ({
  useAuth: vi.fn(() => ({ user: { id: '1', name: '管理员', role: '管理员', department: '放射科', phone: '', username: 'admin' } })),
}));

describe('useOperationLog', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores log entry in localStorage', () => {
    const { log } = useOperationLog('report');
    log('write', 'rpt-1', { field: 'findings' });
    const stored = JSON.parse(localStorage.getItem('operation_logs') || '[]');
    expect(stored).toHaveLength(1);
  });

  it('log has correct structure with actor', () => {
    const { log } = useOperationLog('report');
    log('sign', 'rpt-1');
    const stored = JSON.parse(localStorage.getItem('operation_logs') || '[]');
    expect(stored[0]).toHaveProperty('actor');
    expect(stored[0].actor).toBe('管理员');
  });

  it('log has correct action field', () => {
    const { log } = useOperationLog('report');
    log('publish', 'rpt-1');
    const stored = JSON.parse(localStorage.getItem('operation_logs') || '[]');
    expect(stored[0].action).toBe('publish');
  });

  it('log has correct resourceType field', () => {
    const { log } = useOperationLog('exam');
    log('create', 'ex-1');
    const stored = JSON.parse(localStorage.getItem('operation_logs') || '[]');
    expect(stored[0].resourceType).toBe('exam');
  });

  it('log has timestamp field', () => {
    const { log } = useOperationLog('report');
    log('submit', 'rpt-1');
    const stored = JSON.parse(localStorage.getItem('operation_logs') || '[]');
    expect(stored[0]).toHaveProperty('timestamp');
    expect(typeof stored[0].timestamp).toBe('string');
  });

  it('log has resourceId field', () => {
    const { log } = useOperationLog('report');
    log('write', 'rpt-123');
    const stored = JSON.parse(localStorage.getItem('operation_logs') || '[]');
    expect(stored[0].resourceId).toBe('rpt-123');
  });

  it('appends multiple log entries', () => {
    const { log } = useOperationLog('report');
    log('write', 'rpt-1');
    log('submit', 'rpt-1');
    log('sign', 'rpt-1');
    const stored = JSON.parse(localStorage.getItem('operation_logs') || '[]');
    expect(stored).toHaveLength(3);
  });

  it('stores detail object when provided', () => {
    const { log } = useOperationLog('report');
    const detail = { oldStatus: 'writing', newStatus: 'submitted' };
    log('submit', 'rpt-1', detail);
    const stored = JSON.parse(localStorage.getItem('operation_logs') || '[]');
    expect(stored[0].detail).toEqual(detail);
  });

  it('does not crash when user is null', () => {
    vi.mocked(useAuth).mockReturnValueOnce({ user: null } as any);
    const { log } = useOperationLog('report');
    expect(() => log('write', 'rpt-1')).not.toThrow();
  });

  it('limits logs to 1000 entries', () => {
    const { log } = useOperationLog('report');
    for (let i = 0; i < 1500; i++) {
      log('write', `rpt-${i}`);
    }
    const stored = JSON.parse(localStorage.getItem('operation_logs') || '[]');
    expect(stored.length).toBeLessThanOrEqual(1000);
  });

  it('stores different resource types independently', () => {
    const { log: logReport } = useOperationLog('report');
    const { log: logExam } = useOperationLog('exam');
    logReport('write', 'rpt-1');
    logExam('create', 'ex-1');
    const stored = JSON.parse(localStorage.getItem('operation_logs') || '[]');
    expect(stored.length).toBe(2);
    expect(stored[0].resourceType).toBe('report');
    expect(stored[1].resourceType).toBe('exam');
  });
});
