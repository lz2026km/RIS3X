/**
 * G005 RIS v3.0.6.6 - 工作流图数据模型
 * 80 点升级 - BPMN-style graph model + serialize/deserialize + validate
 */

import type {
  WorkflowGraph,
  WorkflowNode,
  WorkflowEdge,
  WorkflowNodeKind,
  WorkflowEdgeKind,
  WorkflowCondition,
} from '../../../types/workflow';

export class WorkflowModelValidationError extends Error {
  constructor(message: string, public readonly issues: string[] = []) {
    super(message);
    this.name = 'WorkflowModelValidationError';
  }
}

export interface NodeTemplate {
  kind: WorkflowNodeKind;
  label: string;
  color: string;
  icon: string;
  defaultConfig?: Record<string, unknown>;
}

export const NODE_TEMPLATES: NodeTemplate[] = [
  { kind: 'start', label: '开始', color: '#10b981', icon: 'play' },
  { kind: 'end', label: '结束', color: '#6b7280', icon: 'square' },
  { kind: 'task', label: '任务', color: '#3b82f6', icon: 'check-square' },
  { kind: 'gateway', label: '网关', color: '#f59e0b', icon: 'git-branch' },
  { kind: 'subprocess', label: '子流程', color: '#8b5cf6', icon: 'layers' },
  { kind: 'timer', label: '定时', color: '#0ea5e9', icon: 'clock' },
  { kind: 'notify', label: '通知', color: '#ec4899', icon: 'bell' },
  { kind: 'assign', label: '分配', color: '#7c3aed', icon: 'user-check' },
  { kind: 'service', label: '服务调用', color: '#0891b2', icon: 'cloud' },
];

const NODE_KIND_SET = new Set<WorkflowNodeKind>(NODE_TEMPLATES.map((t) => t.kind));
const EDGE_KIND_SET = new Set<WorkflowEdgeKind>(['sequence', 'conditional', 'default', 'error']);

function isNodeKind(value: string): value is WorkflowNodeKind {
  return NODE_KIND_SET.has(value as WorkflowNodeKind);
}

function isEdgeKind(value: string): value is WorkflowEdgeKind {
  return EDGE_KIND_SET.has(value as WorkflowEdgeKind);
}

export function createEmptyWorkflow(name: string): WorkflowGraph {
  const now = new Date().toISOString();
  const startId = `n_${Math.random().toString(36).slice(2, 8)}`;
  const endId = `n_${Math.random().toString(36).slice(2, 8)}`;
  return {
    id: `wf_${Date.now().toString(36)}`,
    name,
    version: '1.0.0',
    description: '',
    nodes: [
      {
        id: startId,
        name: '开始',
        kind: 'start',
        position: { x: 80, y: 200 },
      },
      {
        id: endId,
        name: '结束',
        kind: 'end',
        position: { x: 720, y: 200 },
      },
    ],
    edges: [],
    variables: {},
    metadata: {},
    createdAt: now,
    updatedAt: now,
  };
}

export function cloneWorkflow(graph: WorkflowGraph): WorkflowGraph {
  return JSON.parse(JSON.stringify(graph)) as WorkflowGraph;
}

export function serializeWorkflow(graph: WorkflowGraph): string {
  return JSON.stringify(graph, null, 2);
}

export function deserializeWorkflow(payload: string | WorkflowGraph): WorkflowGraph {
  const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
  return normalizeWorkflow(parsed);
}

export function normalizeWorkflow(input: unknown): WorkflowGraph {
  if (!input || typeof input !== 'object') {
    throw new WorkflowModelValidationError('Invalid workflow payload');
  }
  const raw = input as Partial<WorkflowGraph>;
  const graph: WorkflowGraph = {
    id: raw.id ?? `wf_${Date.now().toString(36)}`,
    name: raw.name ?? 'Untitled Workflow',
    version: raw.version ?? '1.0.0',
    description: raw.description ?? '',
    nodes: Array.isArray(raw.nodes) ? raw.nodes.map(normalizeNode) : [],
    edges: Array.isArray(raw.edges) ? raw.edges.map(normalizeEdge) : [],
    variables: raw.variables ?? {},
    metadata: raw.metadata ?? {},
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
  return graph;
}

function normalizeNode(input: unknown): WorkflowNode {
  if (!input || typeof input !== 'object') {
    throw new WorkflowModelValidationError('Invalid node payload');
  }
  const n = input as Partial<WorkflowNode>;
  const kind = typeof n.kind === 'string' && isNodeKind(n.kind) ? n.kind : 'task';
  return {
    id: n.id ?? `n_${Math.random().toString(36).slice(2, 8)}`,
    name: n.name ?? '节点',
    kind,
    description: n.description,
    position: n.position ?? { x: 0, y: 0 },
    config: n.config ?? {},
    assignee: n.assignee,
    slaMinutes: n.slaMinutes,
  };
}

function normalizeEdge(input: unknown): WorkflowEdge {
  if (!input || typeof input !== 'object') {
    throw new WorkflowModelValidationError('Invalid edge payload');
  }
  const e = input as Partial<WorkflowEdge>;
  const kind = typeof e.kind === 'string' && isEdgeKind(e.kind) ? e.kind : 'sequence';
  return {
    id: e.id ?? `e_${Math.random().toString(36).slice(2, 8)}`,
    source: e.source ?? '',
    target: e.target ?? '',
    kind,
    label: e.label,
    condition: e.condition,
    priority: e.priority,
  };
}

export interface ValidationIssue {
  severity: 'error' | 'warning';
  message: string;
  nodeId?: string;
  edgeId?: string;
}

export function validateWorkflow(graph: WorkflowGraph): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!graph.id) issues.push({ severity: 'error', message: '缺少工作流 ID' });
  if (!graph.name) issues.push({ severity: 'warning', message: '工作流名称为空' });

  const nodeIds = new Set<string>();
  for (const node of graph.nodes) {
    if (!node.id) {
      issues.push({ severity: 'error', message: '节点缺少 ID' });
      continue;
    }
    if (nodeIds.has(node.id)) {
      issues.push({ severity: 'error', message: `节点 ID 重复: ${node.id}`, nodeId: node.id });
    }
    nodeIds.add(node.id);
    if (!node.name) issues.push({ severity: 'warning', message: '节点名称为空', nodeId: node.id });
  }

  const startNodes = graph.nodes.filter((n) => n.kind === 'start');
  const endNodes = graph.nodes.filter((n) => n.kind === 'end');
  if (startNodes.length === 0) issues.push({ severity: 'error', message: '缺少开始节点' });
  if (startNodes.length > 1) issues.push({ severity: 'warning', message: '多个开始节点' });
  if (endNodes.length === 0) issues.push({ severity: 'error', message: '缺少结束节点' });

  const edgeIds = new Set<string>();
  for (const edge of graph.edges) {
    if (!edge.id) {
      issues.push({ severity: 'error', message: '边缺少 ID' });
      continue;
    }
    if (edgeIds.has(edge.id)) {
      issues.push({ severity: 'error', message: `边 ID 重复: ${edge.id}`, edgeId: edge.id });
    }
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.source)) {
      issues.push({ severity: 'error', message: `边源节点不存在: ${edge.source}`, edgeId: edge.id });
    }
    if (!nodeIds.has(edge.target)) {
      issues.push({ severity: 'error', message: `边目标节点不存在: ${edge.target}`, edgeId: edge.id });
    }
    if (edge.kind === 'conditional' && !edge.condition) {
      issues.push({ severity: 'warning', message: '条件边缺少条件', edgeId: edge.id });
    }
  }

  const isolated = findIsolatedNodes(graph);
  for (const nodeId of isolated) {
    issues.push({ severity: 'warning', message: `节点孤立: ${nodeId}`, nodeId });
  }

  if (hasCycle(graph)) {
    issues.push({ severity: 'warning', message: '工作流存在循环,请确认是否需要' });
  }

  return issues;
}

export function findIsolatedNodes(graph: WorkflowGraph): string[] {
  const referenced = new Set<string>();
  for (const edge of graph.edges) {
    referenced.add(edge.source);
    referenced.add(edge.target);
  }
  return graph.nodes.filter((n) => !referenced.has(n.id) && n.kind !== 'start' && n.kind !== 'end').map((n) => n.id);
}

export function hasCycle(graph: WorkflowGraph): boolean {
  const adjacency = new Map<string, string[]>();
  for (const node of graph.nodes) adjacency.set(node.id, []);
  for (const edge of graph.edges) {
    const list = adjacency.get(edge.source);
    if (list) list.push(edge.target);
  }
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const node of graph.nodes) color.set(node.id, WHITE);

  const dfs = (id: string): boolean => {
    color.set(id, GRAY);
    for (const next of adjacency.get(id) ?? []) {
      const c = color.get(next) ?? WHITE;
      if (c === GRAY) return true;
      if (c === WHITE && dfs(next)) return true;
    }
    color.set(id, BLACK);
    return false;
  };

  for (const node of graph.nodes) {
    if ((color.get(node.id) ?? WHITE) === WHITE && dfs(node.id)) return true;
  }
  return false;
}

export interface TraversalStep {
  nodeId: string;
  viaEdgeId?: string;
  depth: number;
}

export function traverseBFS(graph: WorkflowGraph): TraversalStep[] {
  const startNode = graph.nodes.find((n) => n.kind === 'start');
  if (!startNode) return [];
  const out: TraversalStep[] = [];
  const visited = new Set<string>();
  const queue: TraversalStep[] = [{ nodeId: startNode.id, depth: 0 }];
  while (queue.length > 0) {
    const step = queue.shift()!;
    if (visited.has(step.nodeId)) continue;
    visited.add(step.nodeId);
    out.push(step);
    const outgoing = graph.edges
      .filter((e) => e.source === step.nodeId)
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    for (const edge of outgoing) {
      if (!visited.has(edge.target)) {
        queue.push({ nodeId: edge.target, viaEdgeId: edge.id, depth: step.depth + 1 });
      }
    }
  }
  return out;
}

export interface NodeStatistics {
  total: number;
  byKind: Record<WorkflowNodeKind, number>;
  edges: number;
  maxDepth: number;
  hasCycle: boolean;
}

export function computeStatistics(graph: WorkflowGraph): NodeStatistics {
  const byKind: Record<string, number> = {};
  for (const node of graph.nodes) {
    byKind[node.kind] = (byKind[node.kind] ?? 0) + 1;
  }
  const bfs = traverseBFS(graph);
  return {
    total: graph.nodes.length,
    byKind: byKind as Record<WorkflowNodeKind, number>,
    edges: graph.edges.length,
    maxDepth: bfs.reduce((max, s) => Math.max(max, s.depth), 0),
    hasCycle: hasCycle(graph),
  };
}

export function evaluateCondition(condition: WorkflowCondition | undefined, facts: Record<string, unknown>): boolean {
  if (!condition) return true;
  const lhs = facts[condition.field];
  const rhs = condition.value;
  switch (condition.operator) {
    case 'eq':
      return lhs === rhs;
    case 'neq':
      return lhs !== rhs;
    case 'gt':
      return typeof lhs === 'number' && typeof rhs === 'number' && lhs > rhs;
    case 'gte':
      return typeof lhs === 'number' && typeof rhs === 'number' && lhs >= rhs;
    case 'lt':
      return typeof lhs === 'number' && typeof rhs === 'number' && lhs < rhs;
    case 'lte':
      return typeof lhs === 'number' && typeof rhs === 'number' && lhs <= rhs;
    case 'in':
      return Array.isArray(rhs) && (rhs as unknown[]).includes(lhs);
    case 'nin':
      return Array.isArray(rhs) && !(rhs as unknown[]).includes(lhs);
    case 'contains':
      return typeof lhs === 'string' && typeof rhs === 'string' && lhs.includes(rhs);
    case 'regex':
      return typeof lhs === 'string' && typeof rhs === 'string' && (() => { try { return new RegExp(rhs).test(lhs); } catch { return false; } })();
    default:
      return false;
  }
}