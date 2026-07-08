import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWorkflowStore } from '../workflowStore';

const { mockFetchDefinitions, mockFetchSlaPolicies, mockFetchRoutingRules, mockCreateDefinition, mockActivateDefinition } = vi.hoisted(() => ({
  mockFetchDefinitions: vi.fn(),
  mockFetchSlaPolicies: vi.fn(),
  mockFetchRoutingRules: vi.fn(),
  mockCreateDefinition: vi.fn(),
  mockActivateDefinition: vi.fn(),
}));

vi.mock('@services/api', () => ({
  workflowApi: {
    fetchDefinitions: mockFetchDefinitions,
    fetchSlaPolicies: mockFetchSlaPolicies,
    fetchRoutingRules: mockFetchRoutingRules,
    createDefinition: mockCreateDefinition,
    activateDefinition: mockActivateDefinition,
  },
}));

const baseDefinition = {
  id: 'wf-1', name: '急诊报告流程', version: '1.0', status: 'active',
  steps: [{ name: '书写', assignee: ['doctor'] }, { name: '审核', assignee: ['senior'] }],
  createdAt: '2026-01-01T00:00:00.000Z',
};

const baseSla = { id: 'sla-1', name: '急诊报告SLA', modality: 'CT', targetMinutes: 30, priority: 'high' };

const baseRule = { id: 'rr-1', name: '急诊自动分配', condition: 'priority=high', action: 'assign_to_senior', enabled: true };

describe('workflowStore', () => {
  beforeEach(() => {
    useWorkflowStore.setState({ definitions: [], slaPolicies: [], routingRules: [], loading: false, error: null });
    vi.clearAllMocks();
  });

  describe('fetchDefinitions', () => {
    it('loads workflow definitions', async () => {
      mockFetchDefinitions.mockResolvedValue({ success: true, data: [baseDefinition] });
      await useWorkflowStore.getState().fetchDefinitions();
      expect(useWorkflowStore.getState().definitions).toHaveLength(1);
      expect(useWorkflowStore.getState().loading).toBe(false);
    });

    it('handles API failure', async () => {
      mockFetchDefinitions.mockResolvedValue({ success: false, data: null, error: { message: '加载失败' } });
      await useWorkflowStore.getState().fetchDefinitions();
      expect(useWorkflowStore.getState().definitions).toHaveLength(0);
      expect(useWorkflowStore.getState().error).toBe('加载失败');
    });

    it('handles empty data', async () => {
      mockFetchDefinitions.mockResolvedValue({ success: true, data: [] });
      await useWorkflowStore.getState().fetchDefinitions();
      expect(useWorkflowStore.getState().definitions).toHaveLength(0);
    });

    it('sets loading state', async () => {
      let resolvePromise: (v: unknown) => void;
      mockFetchDefinitions.mockReturnValue(new Promise((r) => { resolvePromise = r; }));
      const promise = useWorkflowStore.getState().fetchDefinitions();
      expect(useWorkflowStore.getState().loading).toBe(true);
      resolvePromise!({ success: true, data: [baseDefinition] });
      await promise;
      expect(useWorkflowStore.getState().loading).toBe(false);
    });

    it('returns correct shape', async () => {
      mockFetchDefinitions.mockResolvedValue({ success: true, data: [baseDefinition] });
      await useWorkflowStore.getState().fetchDefinitions();
      const def = useWorkflowStore.getState().definitions[0];
      expect(def).toHaveProperty('id');
      expect(def).toHaveProperty('name');
      expect(def).toHaveProperty('version');
      expect(def).toHaveProperty('status');
      expect(def).toHaveProperty('steps');
    });
  });

  describe('fetchSlaPolicies', () => {
    it('loads SLA policies', async () => {
      mockFetchSlaPolicies.mockResolvedValue({ success: true, data: [baseSla] });
      await useWorkflowStore.getState().fetchSlaPolicies();
      expect(useWorkflowStore.getState().slaPolicies).toHaveLength(1);
      expect(useWorkflowStore.getState().slaPolicies[0].id).toBe('sla-1');
    });

    it('handles API failure', async () => {
      mockFetchSlaPolicies.mockResolvedValue({ success: false, data: null, error: { message: 'SLA加载失败' } });
      await useWorkflowStore.getState().fetchSlaPolicies();
      expect(useWorkflowStore.getState().slaPolicies).toHaveLength(0);
      expect(useWorkflowStore.getState().error).toBe('SLA加载失败');
    });

    it('handles empty data', async () => {
      mockFetchSlaPolicies.mockResolvedValue({ success: true, data: [] });
      await useWorkflowStore.getState().fetchSlaPolicies();
      expect(useWorkflowStore.getState().slaPolicies).toHaveLength(0);
    });

    it('returns correct shape', async () => {
      mockFetchSlaPolicies.mockResolvedValue({ success: true, data: [baseSla] });
      await useWorkflowStore.getState().fetchSlaPolicies();
      const sla = useWorkflowStore.getState().slaPolicies[0];
      expect(sla).toHaveProperty('modality');
      expect(sla).toHaveProperty('targetMinutes');
      expect(sla).toHaveProperty('priority');
    });

    it('filters SLA by modality', async () => {
      mockFetchSlaPolicies.mockResolvedValue({ success: true, data: [baseSla] });
      await useWorkflowStore.getState().fetchSlaPolicies({ modality: 'CT' });
      expect(mockFetchSlaPolicies).toHaveBeenCalledWith({ modality: 'CT' });
    });

    it('handles network error on SLA fetch', async () => {
      mockFetchSlaPolicies.mockRejectedValue(new Error('网络异常'));
      await useWorkflowStore.getState().fetchSlaPolicies();
      expect(useWorkflowStore.getState().error).toBe('网络异常');
    });

    it('sets loading state for SLA fetch', async () => {
      let resolvePromise: (v: unknown) => void;
      mockFetchSlaPolicies.mockReturnValue(new Promise((r) => { resolvePromise = r; }));
      const promise = useWorkflowStore.getState().fetchSlaPolicies();
      expect(useWorkflowStore.getState().loading).toBe(true);
      resolvePromise!({ success: true, data: [baseSla] });
      await promise;
      expect(useWorkflowStore.getState().loading).toBe(false);
    });
  });

  describe('fetchRoutingRules', () => {
    it('loads routing rules', async () => {
      mockFetchRoutingRules.mockResolvedValue({ success: true, data: [baseRule] });
      await useWorkflowStore.getState().fetchRoutingRules();
      expect(useWorkflowStore.getState().routingRules).toHaveLength(1);
      expect(useWorkflowStore.getState().routingRules[0].name).toBe('急诊自动分配');
    });

    it('handles API failure', async () => {
      mockFetchRoutingRules.mockResolvedValue({ success: false, data: null, error: { message: '规则加载失败' } });
      await useWorkflowStore.getState().fetchRoutingRules();
      expect(useWorkflowStore.getState().routingRules).toHaveLength(0);
      expect(useWorkflowStore.getState().error).toBe('规则加载失败');
    });

    it('handles empty rules', async () => {
      mockFetchRoutingRules.mockResolvedValue({ success: true, data: [] });
      await useWorkflowStore.getState().fetchRoutingRules();
      expect(useWorkflowStore.getState().routingRules).toHaveLength(0);
    });

    it('returns correct shape', async () => {
      mockFetchRoutingRules.mockResolvedValue({ success: true, data: [baseRule] });
      await useWorkflowStore.getState().fetchRoutingRules();
      const rule = useWorkflowStore.getState().routingRules[0];
      expect(rule).toHaveProperty('condition');
      expect(rule).toHaveProperty('action');
      expect(rule).toHaveProperty('enabled');
    });

    it('filters routing rules by enabled status', async () => {
      mockFetchRoutingRules.mockResolvedValue({ success: true, data: [baseRule] });
      await useWorkflowStore.getState().fetchRoutingRules({ enabled: true });
      expect(mockFetchRoutingRules).toHaveBeenCalledWith({ enabled: true });
    });

    it('handles network error on rules fetch', async () => {
      mockFetchRoutingRules.mockRejectedValue(new Error('网络异常'));
      await useWorkflowStore.getState().fetchRoutingRules();
      expect(useWorkflowStore.getState().error).toBe('网络异常');
    });

    it('sets loading state for rules fetch', async () => {
      let resolvePromise: (v: unknown) => void;
      mockFetchRoutingRules.mockReturnValue(new Promise((r) => { resolvePromise = r; }));
      const promise = useWorkflowStore.getState().fetchRoutingRules();
      expect(useWorkflowStore.getState().loading).toBe(true);
      resolvePromise!({ success: true, data: [baseRule] });
      await promise;
      expect(useWorkflowStore.getState().loading).toBe(false);
    });
  });

  describe('createDefinition', () => {
    it('creates a new definition', async () => {
      const newDef = { ...baseDefinition, id: 'wf-2', name: '常规报告流程' };
      mockCreateDefinition.mockResolvedValue({ success: true, data: newDef });
      await useWorkflowStore.getState().createDefinition({ name: '常规报告流程', steps: [] });
      expect(useWorkflowStore.getState().definitions).toContainEqual(expect.objectContaining({ name: '常规报告流程' }));
    });

    it('handles create failure', async () => {
      mockCreateDefinition.mockResolvedValue({ success: false, data: null, error: { message: '创建失败' } });
      await useWorkflowStore.getState().createDefinition({ name: 'test' });
      expect(useWorkflowStore.getState().error).toBe('创建失败');
    });
  });

  describe('activateDefinition', () => {
    it('activates a definition', async () => {
      useWorkflowStore.setState({ definitions: [{ ...baseDefinition, status: 'draft' }] });
      mockActivateDefinition.mockResolvedValue({ success: true, data: null });
      await useWorkflowStore.getState().activateDefinition('wf-1');
      expect(useWorkflowStore.getState().definitions[0].status).toBe('active');
    });

    it('handles activate failure', async () => {
      useWorkflowStore.setState({ definitions: [{ ...baseDefinition, status: 'draft' }] });
      mockActivateDefinition.mockResolvedValue({ success: false, data: null, error: { message: '激活失败' } });
      await useWorkflowStore.getState().activateDefinition('wf-1');
      expect(useWorkflowStore.getState().definitions[0].status).toBe('draft');
      expect(useWorkflowStore.getState().error).toBe('激活失败');
    });

    it('handles network error on activate', async () => {
      useWorkflowStore.setState({ definitions: [{ ...baseDefinition, status: 'draft' }] });
      mockActivateDefinition.mockRejectedValue(new Error('网络异常'));
      await useWorkflowStore.getState().activateDefinition('wf-1');
      expect(useWorkflowStore.getState().error).toBe('网络异常');
    });

    it('sets loading during activate', async () => {
      useWorkflowStore.setState({ definitions: [{ ...baseDefinition, status: 'draft' }] });
      let resolvePromise: (v: unknown) => void;
      mockActivateDefinition.mockReturnValue(new Promise((r) => { resolvePromise = r; }));
      const promise = useWorkflowStore.getState().activateDefinition('wf-1');
      expect(useWorkflowStore.getState().loading).toBe(true);
      resolvePromise!({ success: true, data: null });
      await promise;
      expect(useWorkflowStore.getState().loading).toBe(false);
    });

    it('sets loading during create', async () => {
      let resolvePromise: (v: unknown) => void;
      mockCreateDefinition.mockReturnValue(new Promise((r) => { resolvePromise = r; }));
      const promise = useWorkflowStore.getState().createDefinition({ name: 'test', steps: [] });
      expect(useWorkflowStore.getState().loading).toBe(true);
      resolvePromise!({ success: true, data: { ...baseDefinition, id: 'wf-new' } });
      await promise;
      expect(useWorkflowStore.getState().loading).toBe(false);
    });

    it('handles network error on create', async () => {
      mockCreateDefinition.mockRejectedValue(new Error('网络错误'));
      await useWorkflowStore.getState().createDefinition({ name: 'test' });
      expect(useWorkflowStore.getState().error).toBe('网络错误');
    });

    it('handles empty SLA policies', async () => {
      mockFetchSlaPolicies.mockResolvedValue({ success: true, data: [] });
      await useWorkflowStore.getState().fetchSlaPolicies();
      expect(useWorkflowStore.getState().slaPolicies).toHaveLength(0);
    });

    it('handles empty routing rules', async () => {
      mockFetchRoutingRules.mockResolvedValue({ success: true, data: [] });
      await useWorkflowStore.getState().fetchRoutingRules();
      expect(useWorkflowStore.getState().routingRules).toHaveLength(0);
    });

    it('replaces definitions on reload', async () => {
      useWorkflowStore.setState({ definitions: [{ ...baseDefinition }] });
      const newDef = { ...baseDefinition, id: 'wf-3', name: '新流程' };
      mockFetchDefinitions.mockResolvedValue({ success: true, data: [newDef] });
      await useWorkflowStore.getState().fetchDefinitions();
      expect(useWorkflowStore.getState().definitions).toHaveLength(1);
      expect(useWorkflowStore.getState().definitions[0].name).toBe('新流程');
    });
  });
});
