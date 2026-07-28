/**
 * G005 RIS v3.0.6.6 - 工作流子系统类型定义
 * 支持: 工作流图模型、路由规则、SLA 策略、值守、负载均衡
 */

export type WorkflowNodeKind =
  | 'start'
  | 'end'
  | 'task'
  | 'gateway'
  | 'subprocess'
  | 'timer'
  | 'notify'
  | 'assign'
  | 'service';

export interface WorkflowNode {
  id: string;
  name: string;
  kind: WorkflowNodeKind;
  description?: string;
  position: { x: number; y: number };
  config?: Record<string, unknown>;
  assignee?: string;
  slaMinutes?: number;
}

export type WorkflowEdgeKind = 'sequence' | 'conditional' | 'default' | 'error';

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  kind: WorkflowEdgeKind;
  label?: string;
  condition?: WorkflowCondition;
  priority?: number;
}

export interface WorkflowCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains' | 'regex';
  value: string | number | boolean | string[];
  combinator?: 'AND' | 'OR';
}

export interface WorkflowGraph {
  id: string;
  name: string;
  version: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables?: Record<string, unknown>;
  metadata?: Record<string, string>;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkflowExecutionContext {
  workflowId: string;
  instanceId: string;
  currentNodeId: string;
  variables: Record<string, unknown>;
  history: WorkflowExecutionStep[];
  status: 'running' | 'completed' | 'failed' | 'paused';
  startedAt: string;
  completedAt?: string;
}

export interface WorkflowExecutionStep {
  nodeId: string;
  enteredAt: string;
  exitedAt?: string;
  outcome?: 'success' | 'failure' | 'skipped';
  note?: string;
}

export type RuleOperator =
  | 'equal'
  | 'notEqual'
  | 'lessThan'
  | 'lessThanInclusive'
  | 'greaterThan'
  | 'greaterThanInclusive'
  | 'in'
  | 'notIn'
  | 'contains'
  | 'doesNotContain';

export interface RuleCondition {
  fact: string;
  operator: RuleOperator;
  value: unknown;
  path?: string;
}

export interface RuleAllCondition {
  all: RuleCondition[];
}

export interface RuleAnyCondition {
  any: RuleCondition[];
}

export type RuleConditionGroup = RuleAllCondition | RuleAnyCondition | RuleCondition;

export interface RoutingRule {
  id: string;
  name: string;
  description?: string;
  priority: number;
  active: boolean;
  conditions: RuleConditionGroup;
  event: {
    type: string;
    params?: Record<string, unknown>;
  };
  target?: {
    doctorId?: string;
    modality?: string;
    department?: string;
    siteId?: string;
  };
  explanation?: string;
}

export interface RoutingDecision {
  matchedRules: Array<{ rule: RoutingRule; ruleResult: Record<string, unknown> }>;
  finalTarget?: RoutingRule['target'];
  triggeredEvents: Array<{ type: string; params?: Record<string, unknown> }>;
}

export type SLASeverity = 'normal' | 'warning' | 'critical' | 'breached';

export interface SLAPolicyConfig {
  modality: string;
  priority: 'normal' | 'urgent' | 'critical';
  minutesToReport: number;
  minutesToReview: number;
  minutesToPublish: number;
  escalationMinutes?: number;
}

export interface SLACheckResult {
  studyId: string;
  modality: string;
  priority: string;
  elapsedMinutes: number;
  remainingMinutes: number;
  severity: SLASeverity;
  configuredLimit: number;
  breachedStages: string[];
}

export type OnCallSpecialty = 'CT' | 'MR' | 'DR' | 'DSA' | 'MG' | 'US' | 'PET-CT' | 'GENERAL';

export interface OnCallEntry {
  id: string;
  doctorId: string;
  doctorName: string;
  specialty: OnCallSpecialty;
  shiftStart: string;
  shiftEnd: string;
  contact: string;
  backupId?: string;
  backupName?: string;
  priority: number;
}

export interface WorkloadSite {
  siteId: string;
  siteName: string;
  doctors: number;
  activeStudies: number;
  pendingReports: number;
  completedToday: number;
  averageReportMinutes: number;
  utilizationPct: number;
  capacityScore: number;
  lastUpdated: string;
}

export interface WorkloadRedistributionPlan {
  fromSiteId: string;
  toSiteId: string;
  studyIds: string[];
  reason: string;
  estimatedImpactMinutes: number;
  generatedAt: string;
}

export interface WorkloadHeatmapCell {
  siteId: string;
  hour: number;
  load: number;
  intensity: number;
}

export type PriorityScoreLevel = 'low' | 'normal' | 'urgent' | 'critical';

export interface PriorityFeatureVector {
  modalityScore: number;
  historyScore: number;
  slaScore: number;
  workloadScore: number;
  waitScore: number;
  ageScore: number;
  acuityScore: number;
}

export interface PriorityScore {
  studyId: string;
  score: number;
  level: PriorityScoreLevel;
  features: PriorityFeatureVector;
  reasons: string[];
  computedAt: string;
}