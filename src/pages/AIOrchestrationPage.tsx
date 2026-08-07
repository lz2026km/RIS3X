import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Card, Tabs, Table, Button, Tag, Space, Modal, Form, Input, Select, message, Badge,
  Drawer, Descriptions, Empty, Row, Col, Avatar, Tooltip, Spin,
} from 'antd';
import {
  Cpu, Plus, Play, Square, FlaskConical, GitBranch, ListChecks, Boxes, Zap, Eye,
  Activity, CheckCircle, XCircle, Clock, Box, ScanSearch, Wifi, WifiOff,
  FileText, Layers, Sparkles, Copy, Workflow,
} from 'lucide-react';
import type { TableProps } from 'antd';
import {
  aiOrchestratorApi,
  type AiOrchestrationModel,
  type AiWorkflowIntegration,
  type AiJob,
  type AiFinding,
  type AiTestResult,
} from '../services/api/aiOrchestratorApi';
import {
  aiPlatformApi,
  type AiPlatformRecord,
  type GenerateStructuredReportDto,
  type CreateAiOrchestrationDto,
} from '../services/api/aiPlatformApi';

const MODEL_STATUS_META: Record<string, { color: string; label: string }> = {
  REGISTERED: { color: 'default', label: '已注册' },
  DEPLOYED: { color: 'success', label: '已部署' },
  UNDEPLOYED: { color: 'orange', label: '已下线' },
  FAILED: { color: 'error', label: '异常' },
};

const JOB_STATUS_META: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  QUEUED: { color: 'default', icon: <Clock size={13} />, label: '排队中' },
  RUNNING: { color: 'processing', icon: <Activity size={13} />, label: '推理中' },
  COMPLETED: { color: 'success', icon: <CheckCircle size={13} />, label: '已完成' },
  FAILED: { color: 'error', icon: <XCircle size={13} />, label: '失败' },
};

const TRIGGER_OPTIONS = [
  { label: '检查完成 (ON_STUDY_COMPLETE)', value: 'ON_STUDY_COMPLETE' },
  { label: '报告保存 (ON_REPORT_SAVE)', value: 'ON_REPORT_SAVE' },
  { label: '检查登记 (ON_EXAM_CREATE)', value: 'ON_EXAM_CREATE' },
  { label: '手动 (MANUAL)', value: 'MANUAL' },
];

const MODALITY_OPTIONS = ['CT', 'DR', 'MR', 'MG', 'PET', 'US', 'DSA', 'XA'].map((m) => ({ label: m, value: m }));

const WORKFLOW_OPTIONS = [
  'lung-nodule-auto',
  'fracture-screening',
  'mammo-prescreen',
  'stroke-urgent',
  'bone-density-report',
  'critical-value-escalation',
].map((w) => ({ label: w, value: w }));

const VENDOR_COLORS = ['#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#6366f1'];

function vendorColor(vendor: string | null): string {
  if (!vendor) return '#94a3b8';
  let h = 0;
  for (let i = 0; i < vendor.length; i += 1) h = (h * 31 + vendor.charCodeAt(i)) >>> 0;
  return VENDOR_COLORS[h % VENDOR_COLORS.length] ?? '#8b5cf6';
}

function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '--';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// [W1-D] 读取 AiPlatformRecord 字段: detail 优先, 兼容顶层字段
function detailOf(r: AiPlatformRecord | null | undefined, key: string): unknown {
  if (!r) return undefined;
  const d = r.detail;
  if (d && typeof d === 'object' && key in d) return d[key];
  return (r as unknown as Record<string, unknown>)[key];
}

function fmtTime(v: unknown): string {
  const s = typeof v === 'string' ? v : '';
  return s ? s.replace('T', ' ').slice(0, 16) : '--';
}

function fmtList(v: unknown): string {
  return Array.isArray(v) ? v.join('；') : String(v ?? '--');
}

// ==================== 二次检出查看器 (SVG 异常区域标记) ====================
function FindingViewer({
  findings, activeIndex, onSelect,
}: {
  findings: AiFinding[];
  activeIndex: number | null;
  onSelect: (idx: number | null) => void;
}) {
  const W = 400;
  const H = 300;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', background: '#0b1220', borderRadius: 10, display: 'block', cursor: 'crosshair' }}
      role="img"
      aria-label="AI 异常区域查看器"
      onClick={() => onSelect(null)}
    >
      <defs>
        <radialGradient id="bodyBg" cx="50%" cy="45%" r="70%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0b1220" />
        </radialGradient>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.6" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#bodyBg)" />
      <rect width={W} height={H} fill="url(#grid)" opacity="0.5" />
      {/* 解剖占位 (胸部) */}
      <ellipse cx="200" cy="150" rx="120" ry="90" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
      <ellipse cx="158" cy="148" rx="55" ry="78" fill="#111c31" stroke="#2c3d58" strokeWidth="1" />
      <ellipse cx="242" cy="148" rx="55" ry="78" fill="#111c31" stroke="#2c3d58" strokeWidth="1" />
      <path d="M 158 70 Q 200 60 242 70" fill="none" stroke="#2c3d58" strokeWidth="1" />
      <path d="M 200 152 L 200 168" stroke="#334155" strokeWidth="1.2" />
      {/* 异常区域标记 */}
      {findings.map((f, i) => {
        const x = f.x * W;
        const y = f.y * H;
        const w = f.width * W;
        const h = f.height * H;
        const active = i === activeIndex;
        return (
          <g
            key={`${f.label}-${i}`}
            onClick={(e) => { e.stopPropagation(); onSelect(active ? null : i); }}
            style={{ cursor: 'pointer' }}
          >
            <rect
              x={x} y={y} width={w} height={h}
              fill={active ? 'rgba(239,68,68,0.25)' : 'rgba(250,204,21,0.14)'}
              stroke={active ? '#ef4444' : '#f59e0b'}
              strokeWidth={active ? 2.5 : 1.5}
              strokeDasharray={active ? 'none' : '4 3'}
              rx="2"
            />
            <line x1={x} y1={y} x2={x + w * 1.8} y2={y} stroke="#fbbf24" strokeWidth="1" />
            <line x1={x} y1={y} x2={x} y2={y + h * 1.8} stroke="#fbbf24" strokeWidth="1" />
            <g transform={`translate(${Math.min(x + w, W - 8)}, ${Math.max(y - 4, 10)})`}>
              <rect x="-8" y="-16" width={8 + f.label.length * 6.5} height="18" rx="3" fill={active ? '#ef4444' : '#0f172a'} stroke={active ? '#fca5a5' : '#475569'} strokeWidth="0.8" />
              <text x="0" y="-2" fontSize="10" fill="#f8fafc">{f.label}</text>
            </g>
          </g>
        );
      })}
      <text x="12" y="H - 10" fontSize="11" fill="#64748b">AI 推理结果 · 异常区域坐标 (点击查看器空白处取消高亮)</text>
    </svg>
  );
}

// ==================== 页面 ====================
export default function AIOrchestrationPage() {
  const [models, setModels] = useState<AiOrchestrationModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [integrations, setIntegrations] = useState<AiWorkflowIntegration[]>([]);
  const [integrationsLoading, setIntegrationsLoading] = useState(false);
  const [jobs, setJobs] = useState<AiJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);

  // [W1-D] AI 平台补全: 结构化报告 / 编排 / 融合 / 辅助
  const [srReports, setSrReports] = useState<AiPlatformRecord[]>([]);
  const [srLoading, setSrLoading] = useState(false);
  const [orchestrations, setOrchestrations] = useState<AiPlatformRecord[]>([]);
  const [orchLoading, setOrchLoading] = useState(false);
  const [fusionJobs, setFusionJobs] = useState<AiPlatformRecord[]>([]);
  const [fusionLoading, setFusionLoading] = useState(false);
  const [assistItems, setAssistItems] = useState<AiPlatformRecord[]>([]);
  const [assistLoading, setAssistLoading] = useState(false);
  const [srError, setSrError] = useState<string | null>(null);
  const [fusionError, setFusionError] = useState<string | null>(null);
  const [assistError, setAssistError] = useState<string | null>(null);
  const [orchError, setOrchError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState('market');
  const [registerOpen, setRegisterOpen] = useState(false);
  const [integrationOpen, setIntegrationOpen] = useState(false);
  const [triggerOpen, setTriggerOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);
  const [srOpen, setSrOpen] = useState(false);
  const [orchOpen, setOrchOpen] = useState(false);
  const [srSubmitting, setSrSubmitting] = useState(false);
  const [orchSubmitting, setOrchSubmitting] = useState(false);

  const [drawerJob, setDrawerJob] = useState<AiJob | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeFinding, setActiveFinding] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<AiTestResult | null>(null);

  const [registerForm] = Form.useForm();
  const [integrationForm] = Form.useForm();
  const [triggerForm] = Form.useForm();
  const [eventForm] = Form.useForm();
  const [srForm] = Form.useForm();
  const [orchForm] = Form.useForm();

  const drawerJobRef = useRef<AiJob | null>(null);
  drawerJobRef.current = drawerJob;

  // ===== 数据加载 =====
  const fetchModels = useCallback(async () => {
    setModelsLoading(true);
    const res = await aiOrchestratorApi.listModels();
    if (res.success) setModels(res.data);
    else message.warning(res.error?.message ?? '模型列表加载失败');
    setModelsLoading(false);
  }, []);

  const fetchIntegrations = useCallback(async () => {
    setIntegrationsLoading(true);
    const res = await aiOrchestratorApi.listIntegrations();
    if (res.success) setIntegrations(res.data);
    else message.warning(res.error?.message ?? '集成列表加载失败');
    setIntegrationsLoading(false);
  }, []);

  const fetchJobs = useCallback(async () => {
    setJobsLoading(true);
    const res = await aiOrchestratorApi.listJobs();
    if (res.success) setJobs(res.data);
    setJobsLoading(false);
  }, []);

  // ===== [W1-D] AI 平台补全数据加载 =====
  const fetchStructuredReports = useCallback(async () => {
    setSrLoading(true);
    const res = await aiPlatformApi.listStructuredReports();
    if (res.success) {
      setSrReports(res.data);
      setSrError(null);
    } else {
      setSrError(res.error?.message ?? '结构化报告列表加载失败');
    }
    setSrLoading(false);
  }, []);

  const fetchOrchestrations = useCallback(async () => {
    setOrchLoading(true);
    const res = await aiPlatformApi.listOrchestration();
    if (res.success) {
      setOrchestrations(res.data);
      setOrchError(null);
    } else {
      setOrchError(res.error?.message ?? 'AI 编排列表加载失败');
    }
    setOrchLoading(false);
  }, []);

  const fetchFusion = useCallback(async () => {
    setFusionLoading(true);
    const res = await aiPlatformApi.listFusion();
    if (res.success) {
      setFusionJobs(res.data);
      setFusionError(null);
    } else {
      setFusionError(res.error?.message ?? '融合工作区加载失败');
    }
    setFusionLoading(false);
  }, []);

  const fetchAssist = useCallback(async () => {
    setAssistLoading(true);
    const res = await aiPlatformApi.listAssist();
    if (res.success) {
      setAssistItems(res.data);
      setAssistError(null);
    } else {
      setAssistError(res.error?.message ?? 'AI 辅助加载失败');
    }
    setAssistLoading(false);
  }, []);

  useEffect(() => {
    void fetchModels();
    void fetchIntegrations();
    void fetchStructuredReports();
    void fetchOrchestrations();
    void fetchFusion();
    void fetchAssist();
  }, [fetchModels, fetchIntegrations, fetchStructuredReports, fetchOrchestrations, fetchFusion, fetchAssist]);

  // 任务 Tab 轮询 (队列模拟推进)
  useEffect(() => {
    if (activeTab !== 'jobs') return;
    void fetchJobs();
    const timer = setInterval(() => { void fetchJobs(); }, 4000);
    return () => clearInterval(timer);
  }, [activeTab, fetchJobs]);

  // 抽屉打开期间同步最新任务状态
  useEffect(() => {
    if (!drawerOpen || !drawerJobRef.current) return;
    const timer = setInterval(() => {
      void aiOrchestratorApi.getJob(drawerJobRef.current!.id).then((res) => {
        if (res.success && res.data) setDrawerJob(res.data);
      });
    }, 4000);
    return () => clearInterval(timer);
  }, [drawerOpen]);

  const deployedModels = useMemo(() => models.filter((m) => m.status === 'DEPLOYED'), [models]);
  const completedJobs = useMemo(() => jobs.filter((j) => j.status === 'COMPLETED'), [jobs]);

  // ===== 模型操作 =====
  const handleRegister = async () => {
    try {
      const values = await registerForm.validateFields();
      const res = await aiOrchestratorApi.registerModel({
        name: values.name,
        version: values.version,
        vendor: values.vendor,
        category: values.category,
        endpoint: values.endpoint,
        description: values.description,
      });
      if (res.success) {
        message.success(`模型 ${res.data?.name} 注册成功`);
        setRegisterOpen(false);
        registerForm.resetFields();
        void fetchModels();
      } else {
        message.error(res.error?.message ?? '注册失败');
      }
    } catch (err) {
      if (err instanceof Error) message.error(err.message);
    }
  };

  const handleDeploy = async (id: string) => {
    const res = await aiOrchestratorApi.deployModel(id);
    if (res.success) {
      message.success('模型部署成功');
      void fetchModels();
    } else {
      message.error(res.error?.message ?? '部署失败');
    }
  };

  const handleUndeploy = (id: string, name: string) => {
    Modal.confirm({
      title: '确认下线模型',
      content: `下线后 ${name} 将不再接收新的推理任务，确定继续？`,
      okText: '下线',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        const res = await aiOrchestratorApi.undeployModel(id);
        if (res.success) {
          message.success('模型已下线');
          void fetchModels();
        } else {
          message.error(res.error?.message ?? '下线失败');
        }
      },
    });
  };

  const handleTest = async (id: string) => {
    const res = await aiOrchestratorApi.testModel(id);
    if (res.success && res.data) {
      setTestResult(res.data);
    } else {
      message.error(res.error?.message ?? '测试请求失败');
    }
  };

  // ===== 集成操作 =====
  const handleCreateIntegration = async () => {
    try {
      const values = await integrationForm.validateFields();
      const res = await aiOrchestratorApi.createIntegration({
        modelId: values.modelId,
        name: values.name,
        targetWorkflow: values.targetWorkflow,
        triggerConditions: {
          trigger: values.trigger ?? 'MANUAL',
          ...(values.modality ? { modality: values.modality } : {}),
          ...(values.bodyPart ? { bodyPart: values.bodyPart } : {}),
        },
      });
      if (res.success) {
        message.success('工作流集成创建成功');
        setIntegrationOpen(false);
        integrationForm.resetFields();
        void fetchIntegrations();
        void fetchModels();
      } else {
        message.error(res.error?.message ?? '创建失败');
      }
    } catch (err) {
      if (err instanceof Error) message.error(err.message);
    }
  };

  // ===== 任务操作 =====
  const handleTriggerJob = async () => {
    try {
      const values = await triggerForm.validateFields();
      const res = await aiOrchestratorApi.triggerJob({
        modelId: values.modelId,
        examId: values.examId,
        trigger: values.trigger ?? 'MANUAL',
      });
      if (res.success && res.data) {
        message.success(`推理任务 ${res.data.id} 已进入队列`);
        setTriggerOpen(false);
        triggerForm.resetFields();
        void fetchJobs();
      } else {
        message.error(res.error?.message ?? '触发失败');
      }
    } catch (err) {
      if (err instanceof Error) message.error(err.message);
    }
  };

  const handleTriggerEvent = async () => {
    try {
      const values = await eventForm.validateFields();
      const res = await aiOrchestratorApi.triggerWorkflowEvent({
        trigger: values.trigger,
        examId: values.examId,
        modality: values.modality,
        bodyPart: values.bodyPart,
      });
      if (res.success) {
        const matched = (res.data as { matchedCount?: number } | null)?.matchedCount ?? 0;
        message.success(`事件触发完成：${matched} 条工作流匹配并已创建任务`);
        setEventOpen(false);
        eventForm.resetFields();
        void fetchJobs();
      } else {
        message.error(res.error?.message ?? '事件触发失败');
      }
    } catch (err) {
      if (err instanceof Error) message.error(err.message);
    }
  };

  const openJobDrawer = (job: AiJob) => {
    setDrawerJob(job);
    setActiveFinding(null);
    setDrawerOpen(true);
    void aiOrchestratorApi.getJob(job.id).then((res) => {
      if (res.success && res.data) setDrawerJob(res.data);
    });
  };

  // ===== [W1-D] 结构化报告 =====
  const handleGenerateSr = async () => {
    try {
      const values = await srForm.validateFields();
      setSrSubmitting(true);
      const payload: GenerateStructuredReportDto = {
        studyId: values.studyId,
        templateId: values.templateId,
        ...(Array.isArray(values.findings) && values.findings.length > 0 ? { findings: values.findings } : {}),
        ...(values.additionalContext ? { additionalContext: { modality: values.modality, priority: values.priority } } : {}),
      };
      const res = await aiPlatformApi.createStructuredReport(payload);
      if (res.success && res.data) {
        message.success(`结构化报告已生成：${res.data.id}`);
        setSrOpen(false);
        srForm.resetFields();
        void fetchStructuredReports();
      } else {
        message.error(res.error?.message ?? '生成失败');
      }
    } catch (err) {
      if (err instanceof Error) message.error(err.message);
    } finally {
      setSrSubmitting(false);
    }
  };

  const copyAssistText = (text: string) => {
    void navigator.clipboard?.writeText(text).then(
      () => message.success('建议已复制到剪贴板'),
      () => message.warning('复制失败，请手动选择文本'),
    );
  };

  // ===== [W1-D] AI 编排 =====
  const handleCreateOrchestration = async () => {
    try {
      const values = await orchForm.validateFields();
      setOrchSubmitting(true);
      const steps: Array<{ order: number; action: string; params: Record<string, unknown> }> = (
        values.steps as Array<{ action: string; target: string }>
      ).map((s, i) => ({
        order: i + 1,
        action: s.action,
        params: s.target ? { target: s.target } : {},
      }));
      const payload: CreateAiOrchestrationDto = {
        workflowName: values.workflowName,
        steps,
        trigger: values.trigger ?? 'MANUAL',
      };
      const res = await aiPlatformApi.createOrchestration(payload);
      if (res.success && res.data) {
        message.success(`编排已创建：${res.data.id}`);
        setOrchOpen(false);
        orchForm.resetFields();
        void fetchOrchestrations();
      } else {
        message.error(res.error?.message ?? '创建失败');
      }
    } catch (err) {
      if (err instanceof Error) message.error(err.message);
    } finally {
      setOrchSubmitting(false);
    }
  };

  // ===== 表格列 =====
  const integrationColumns: TableProps<AiWorkflowIntegration>['columns'] = [
    {
      title: '集成名称', dataIndex: 'name', key: 'name',
      render: (v: string) => (
        <Space>
          <GitBranch size={15} style={{ color: '#0ea5e9' }} />
          <span style={{ fontWeight: 600 }}>{v}</span>
        </Space>
      ),
    },
    {
      title: 'AI 模型', dataIndex: 'model', key: 'model',
      render: (_v: unknown, r) => r.model ? (
        <Space size={4}>
          <Tag color="geekblue">{r.model.name} v{r.model.version}</Tag>
          <span style={{ color: '#94a3b8', fontSize: 12 }}>{r.model.vendor}</span>
        </Space>
      ) : <Tag>{r.modelId}</Tag>,
    },
    {
      title: '触发条件', dataIndex: 'triggerConditions', key: 'triggerConditions',
      render: (v: Record<string, unknown>) => {
        if (!v || Object.keys(v).length === 0) return <Tag>无条件</Tag>;
        const parts: string[] = [];
        if (v.trigger) parts.push(String(v.trigger));
        if (v.modality) parts.push(`模态=${v.modality}`);
        if (v.bodyPart) parts.push(`部位=${v.bodyPart}`);
        return <Space size={4} wrap>{parts.map((p) => <Tag key={p} color="purple" style={{ fontSize: 11 }}>{p}</Tag>)}</Space>;
      },
    },
    {
      title: '目标工作流', dataIndex: 'targetWorkflow', key: 'targetWorkflow',
      render: (v: string) => <Tag color="cyan">{v}</Tag>,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (v: string) => v === 'ACTIVE'
        ? <Tag color="success" icon={<CheckCircle size={12} />}>启用</Tag>
        : <Tag color="default">停用</Tag>,
    },
    {
      title: '创建时间', dataIndex: 'createdAt', key: 'createdAt',
      render: (v: string) => <span style={{ color: '#94a3b8', fontSize: 12 }}>{v.replace('T', ' ').slice(0, 16)}</span>,
    },
  ];

  const jobColumns: TableProps<AiJob>['columns'] = [
    {
      title: '任务ID', dataIndex: 'id', key: 'id',
      render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span>,
    },
    {
      title: 'AI 模型', dataIndex: 'model', key: 'model',
      render: (_v: unknown, r) => r.model ? (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 600 }}>{r.model.name}</span>
          <span style={{ color: '#94a3b8', fontSize: 12 }}>v{r.model.version} · {r.model.vendor}</span>
        </Space>
      ) : <Tag>{r.modelId}</Tag>,
    },
    {
      title: '检查', dataIndex: 'examId', key: 'examId',
      render: (v: string | null) => v ? <Tag color="default">{v}</Tag> : <span style={{ color: '#999' }}>--</span>,
    },
    {
      title: '触发', dataIndex: 'trigger', key: 'trigger',
      render: (v: string) => <Tag color="purple" style={{ fontSize: 11 }}>{v}</Tag>,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (v: string) => {
        const meta = JOB_STATUS_META[v] ?? JOB_STATUS_META.QUEUED!;
        return <Tag icon={meta.icon} color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '耗时', key: 'duration',
      render: (_v: unknown, r) => {
        if (!r.startedAt) return <span style={{ color: '#999' }}>--</span>;
        const end = r.completedAt ? Date.parse(r.completedAt) : Date.now();
        const dur = end - Date.parse(r.startedAt);
        return <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{formatDuration(dur)}</span>;
      },
    },
    {
      title: '结果', dataIndex: 'result', key: 'result',
      render: (_v: unknown, r) => {
        if (r.status === 'FAILED') return <span style={{ color: '#ef4444', fontSize: 12 }}>{r.error ?? '推理失败'}</span>;
        if (r.status !== 'COMPLETED') return <span style={{ color: '#999' }}>--</span>;
        const findings = r.result?.findings?.length ?? 0;
        const priority = r.result?.structured?.priority;
        return (
          <Space size={4}>
            <Tag color={priority === 'HIGH' ? 'red' : 'green'} style={{ fontSize: 11 }}>
              {findings} 处异常
            </Tag>
            {priority === 'HIGH' && <Tag color="volcano" style={{ fontSize: 11 }}>高优先级</Tag>}
          </Space>
        );
      },
    },
    {
      title: '操作', key: 'action',
      render: (_v: unknown, r) => (
        <Space>
          <Button type="link" size="small" icon={<Eye size={13} />} onClick={() => openJobDrawer(r)}>详情</Button>
          {r.status === 'COMPLETED' && r.result?.findings?.length ? (
            <Button type="link" size="small" icon={<ScanSearch size={13} />} onClick={() => openJobDrawer(r)}>二次检出查看</Button>
          ) : null}
        </Space>
      ),
    },
  ];

  // ===== [W1-D] 结构化报告表格列 =====
  const srColumns: TableProps<AiPlatformRecord>['columns'] = [
    {
      title: '记录ID', dataIndex: 'id', key: 'id',
      render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span>,
    },
    {
      title: '检查', key: 'studyId',
      render: (_v: unknown, r) => {
        const sid = detailOf(r, 'studyId');
        return sid ? <Tag color="default">{String(sid)}</Tag> : <span style={{ color: '#999' }}>--</span>;
      },
    },
    {
      title: '模板', key: 'templateId',
      render: (_v: unknown, r) => {
        const tid = detailOf(r, 'templateId');
        return tid ? <Tag color="geekblue" style={{ fontFamily: 'monospace', fontSize: 11 }}>{String(tid)}</Tag> : <span style={{ color: '#999' }}>--</span>;
      },
    },
    {
      title: '发现条目', key: 'findings',
      render: (_v: unknown, r) => {
        const findings = detailOf(r, 'findings');
        const count = Array.isArray(findings) ? findings.length : 0;
        return count > 0 ? <Tag color="green">{count} 条</Tag> : <span style={{ color: '#999' }}>--</span>;
      },
    },
    {
      title: '动作', dataIndex: 'action', key: 'action',
      render: (v: string) => <Tag color="purple" style={{ fontSize: 11 }}>{v ?? 'GENERATE'}</Tag>,
    },
    {
      title: '创建时间', dataIndex: 'createdAt', key: 'createdAt',
      render: (v: string) => <span style={{ color: '#94a3b8', fontSize: 12 }}>{fmtTime(v)}</span>,
    },
    {
      title: '操作', key: 'actionView',
      render: (_v: unknown, r) => (
        <Button
          type="link" size="small" icon={<Eye size={13} />}
          onClick={() => {
            const findings = detailOf(r, 'findings');
            Modal.info({
              title: `结构化报告 ${r.id}`,
              width: 560,
              content: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <span style={{ color: '#64748b', fontSize: 12 }}>检查号：</span>
                    <span>{String(detailOf(r, 'studyId') ?? '--')}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: 12 }}>模板：</span>
                    <span>{String(detailOf(r, 'templateId') ?? '--')}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: 12 }}>发现内容：</span>
                    <div style={{ marginTop: 4, whiteSpace: 'pre-wrap', lineHeight: '22px' }}>
                      {fmtList(findings)}
                    </div>
                  </div>
                </div>
              ),
            });
          }}
        >
          详情
        </Button>
      ),
    },
  ];

  // ===== [W1-D] 融合工作区表格列 =====
  const FUSION_STATUS_META: Record<string, { color: string; label: string }> = {
    COMPLETED: { color: 'success', label: '已完成' },
    RUNNING: { color: 'processing', label: '融合中' },
    QUEUED: { color: 'default', label: '排队中' },
    FAILED: { color: 'error', label: '失败' },
  };

  const fusionColumns: TableProps<AiPlatformRecord>['columns'] = [
    {
      title: '任务ID', dataIndex: 'id', key: 'id',
      render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span>,
    },
    {
      title: '主序列', key: 'primarySeries',
      render: (_v: unknown, r) => <Tag color="cyan" style={{ fontFamily: 'monospace', fontSize: 11 }}>{String(detailOf(r, 'primarySeries') ?? '--')}</Tag>,
    },
    {
      title: '副序列', key: 'secondarySeries',
      render: (_v: unknown, r) => <Tag color="default" style={{ fontFamily: 'monospace', fontSize: 11 }}>{String(detailOf(r, 'secondarySeries') ?? '--')}</Tag>,
    },
    {
      title: '融合类型', key: 'type',
      render: (_v: unknown, r) => {
        const t = detailOf(r, 'type');
        return t ? <Tag color="geekblue">{String(t)}</Tag> : <span style={{ color: '#999' }}>--</span>;
      },
    },
    {
      title: '状态', key: 'status',
      render: (_v: unknown, r) => {
        const st = String(detailOf(r, 'status') ?? 'QUEUED');
        const meta = FUSION_STATUS_META[st] ?? FUSION_STATUS_META.QUEUED!;
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '结果路径', key: 'resultPath',
      render: (_v: unknown, r) => {
        const p = detailOf(r, 'resultPath');
        return p ? <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#0ea5e9' }}>{String(p)}</span> : <span style={{ color: '#999' }}>--</span>;
      },
    },
    {
      title: '创建时间', dataIndex: 'createdAt', key: 'createdAt',
      render: (v: string) => <span style={{ color: '#94a3b8', fontSize: 12 }}>{fmtTime(v)}</span>,
    },
  ];

  // ===== [W1-D] AI 编排表格列 =====
  const orchestrationColumns: TableProps<AiPlatformRecord>['columns'] = [
    {
      title: '编排ID', dataIndex: 'id', key: 'id',
      render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span>,
    },
    {
      title: '编排名称', key: 'workflowName',
      render: (_v: unknown, r) => (
        <Space>
          <Workflow size={14} style={{ color: '#8b5cf6' }} />
          <span style={{ fontWeight: 600 }}>{String(detailOf(r, 'workflowName') ?? '--')}</span>
        </Space>
      ),
    },
    {
      title: '触发', key: 'trigger',
      render: (_v: unknown, r) => {
        const t = detailOf(r, 'trigger');
        return t ? <Tag color="purple" style={{ fontSize: 11 }}>{String(t)}</Tag> : <span style={{ color: '#999' }}>--</span>;
      },
    },
    {
      title: '步骤数', key: 'steps',
      render: (_v: unknown, r) => {
        const steps = detailOf(r, 'steps');
        const count = Array.isArray(steps) ? steps.length : 0;
        return count > 0 ? <Tag color="blue">{count} 步</Tag> : <span style={{ color: '#999' }}>--</span>;
      },
    },
    {
      title: '创建时间', dataIndex: 'createdAt', key: 'createdAt',
      render: (v: string) => <span style={{ color: '#94a3b8', fontSize: 12 }}>{fmtTime(v)}</span>,
    },
  ];

  // ===== 模型卡片 =====
  const renderModelCards = () => (
    <Row gutter={[16, 16]}>
      {models.map((m) => {
        const st = MODEL_STATUS_META[m.status] ?? MODEL_STATUS_META.REGISTERED!;
        const color = vendorColor(m.vendor);
        return (
          <Col xs={24} sm={12} lg={8} xl={6} key={m.id}>
            <Card
              variant="borderless"
              style={{ borderRadius: 12, height: '100%' }}
              styles={{ body: { display: 'flex', flexDirection: 'column', gap: 12, height: '100%' } }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Space>
                  <Avatar size={38} style={{ background: color, fontWeight: 700, fontSize: 15 }}>
                    {(m.vendor ?? m.name).charAt(0).toUpperCase()}
                  </Avatar>
                  <div>
                    <div style={{ fontWeight: 700 }}>{m.name}</div>
                    <Space size={4}>
                      <Tag style={{ fontSize: 11 }}>v{m.version}</Tag>
                      <Tag color="blue" style={{ fontSize: 11 }}>{m.category ?? '通用'}</Tag>
                    </Space>
                  </div>
                </Space>
                <Tag color={st.color}>{st.label}</Tag>
              </div>

              <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                  {m.status === 'FAILED' ? <WifiOff size={12} /> : <Wifi size={12} />}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.endpoint ?? '未配置端点'}</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Tooltip title={`${m.vendor ?? '未知厂商'}`}>
                    <span style={{ background: `${color}22`, color, padding: '2px 8px', borderRadius: 6, fontWeight: 600, fontSize: 11 }}>
                      {m.vendor ?? '未知厂商'}
                    </span>
                  </Tooltip>
                </div>
              </div>

              <Row gutter={8} style={{ textAlign: 'center' }}>
                <Col span={12}>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 2 }}>推理次数</div>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>{m.deploymentCount}</div>
                </Col>
                <Col span={12}>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 2 }}>工作流集成</div>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>{m.integrationCount}</div>
                </Col>
              </Row>

              <div style={{ marginTop: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button size="small" icon={<FlaskConical size={13} />} onClick={() => void handleTest(m.id)}>测试</Button>
                {m.status !== 'DEPLOYED' ? (
                  <Button size="small" type="primary" icon={<Play size={13} />} onClick={() => void handleDeploy(m.id)}>部署</Button>
                ) : (
                  <Button size="small" danger icon={<Square size={13} />} onClick={() => handleUndeploy(m.id, m.name)}>下线</Button>
                )}
              </div>
            </Card>
          </Col>
        );
      })}
    </Row>
  );

  const drawerFindings = drawerJob?.result?.findings ?? [];

  return (
    <div style={{ padding: 24, maxWidth: 1440, margin: '0 auto' }}>
      <Card variant="borderless" style={{ borderRadius: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Space>
            <div style={{
              width: 42, height: 42, borderRadius: 10,
              background: 'linear-gradient(135deg, #8b5cf6, #0ea5e9)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Cpu size={22} color="#fff" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>AI 编排平台</h2>
              <span style={{ color: '#94a3b8', fontSize: 13 }}>模型注册 → 部署 → 工作流集成 → 推理任务 → 二次检出</span>
            </div>
          </Space>
          <Space size={12}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>{models.filter((m) => m.status === 'DEPLOYED').length}</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>已部署模型</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#0ea5e9' }}>{integrations.filter((i) => i.status === 'ACTIVE').length}</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>活跃集成</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#8b5cf6' }}>{completedJobs.length}</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>完成任务</div>
            </div>
          </Space>
        </div>
      </Card>

      <Card variant="borderless" style={{ borderRadius: 12 }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'market',
              label: <Space><Boxes size={15} />模型市场</Space>,
              children: (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Space>
                      <Badge count={models.length} color="#8b5cf6" style={{ boxShadow: 'none' }}>
                        <span style={{ color: '#64748b' }}>已注册模型</span>
                      </Badge>
                      {modelsLoading && <Spin size="small" />}
                    </Space>
                    <Button type="primary" icon={<Plus size={15} />} onClick={() => setRegisterOpen(true)}>
                      注册模型
                    </Button>
                  </div>
                  {models.length === 0 && !modelsLoading ? (
                    <Empty description="暂无模型，点击右上角注册" />
                  ) : renderModelCards()}
                </div>
              ),
            },
            {
              key: 'integration',
              label: <Space><GitBranch size={15} />工作流集成</Space>,
              children: (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Space>
                      <Badge count={integrations.length} color="#0ea5e9" style={{ boxShadow: 'none' }}>
                        <span style={{ color: '#64748b' }}>AI → 工作流集成</span>
                      </Badge>
                      {integrationsLoading && <Spin size="small" />}
                    </Space>
                    <Space>
                      <Button icon={<Zap size={14} />} onClick={() => setEventOpen(true)}>模拟事件触发</Button>
                      <Button type="primary" icon={<Plus size={15} />} onClick={() => setIntegrationOpen(true)}>新建集成</Button>
                    </Space>
                  </div>
                  <Table
                    dataSource={integrations}
                    columns={integrationColumns}
                    rowKey="id"
                    loading={integrationsLoading}
                    pagination={{ pageSize: 8, showTotal: (t) => `共 ${t} 条` }}
                    locale={{ emptyText: <Empty description="暂无集成，点击右上角新建" /> }}
                  />
                  <div style={{ marginTop: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <Space>
                        <span style={{ fontWeight: 600 }}><Workflow size={14} style={{ marginRight: 6, color: '#8b5cf6' }} />AI 编排流水线</span>
                        {orchLoading && <Spin size="small" />}
                        {orchError && <span style={{ color: '#ef4444', fontSize: 12 }}>{orchError}</span>}
                      </Space>
                      <Button size="small" type="primary" icon={<Plus size={14} />} onClick={() => setOrchOpen(true)}>
                        新建编排
                      </Button>
                    </div>
                    <Table
                      dataSource={orchestrations}
                      columns={orchestrationColumns}
                      rowKey="id"
                      loading={orchLoading}
                      pagination={false}
                      size="small"
                      locale={{ emptyText: <Empty description="暂无编排流水线" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                    />
                  </div>
                </div>
              ),
            },
            {
              key: 'jobs',
              label: <Space><ListChecks size={15} />推理任务</Space>,
              children: (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Space>
                      <Badge count={jobs.length} color="#10b981" style={{ boxShadow: 'none' }}>
                        <span style={{ color: '#64748b' }}>推理任务（每 4s 自动刷新）</span>
                      </Badge>
                      {jobsLoading && <Spin size="small" />}
                    </Space>
                    <Button type="primary" icon={<Play size={14} />} onClick={() => setTriggerOpen(true)}>
                      触发推理
                    </Button>
                  </div>
                  <Table
                    dataSource={jobs}
                    columns={jobColumns}
                    rowKey="id"
                    loading={jobsLoading}
                    pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
                    locale={{ emptyText: <Empty description="暂无推理任务" /> }}
                  />
                </div>
              ),
            },
            {
              key: 'sr',
              label: <Space><FileText size={15} />结构化报告</Space>,
              children: (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Space>
                      <Badge count={srReports.length} color="#8b5cf6" style={{ boxShadow: 'none' }}>
                        <span style={{ color: '#64748b' }}>结构化报告（由检查生成）</span>
                      </Badge>
                      {srLoading && <Spin size="small" />}
                      {srError && <span style={{ color: '#ef4444', fontSize: 12 }}>{srError}</span>}
                    </Space>
                    <Button type="primary" icon={<Plus size={15} />} onClick={() => setSrOpen(true)}>
                      生成结构化报告
                    </Button>
                  </div>
                  <Table
                    dataSource={srReports}
                    columns={srColumns}
                    rowKey="id"
                    loading={srLoading}
                    pagination={{ pageSize: 8, showTotal: (t) => `共 ${t} 条` }}
                    locale={{ emptyText: <Empty description="暂无结构化报告，点击右上角生成" /> }}
                  />
                </div>
              ),
            },
            {
              key: 'fusion',
              label: <Space><Layers size={15} />融合工作区</Space>,
              children: (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Space>
                      <Badge count={fusionJobs.length} color="#0ea5e9" style={{ boxShadow: 'none' }}>
                        <span style={{ color: '#64748b' }}>多模态融合任务（FusionJob）</span>
                      </Badge>
                      {fusionLoading && <Spin size="small" />}
                      {fusionError && <span style={{ color: '#ef4444', fontSize: 12 }}>{fusionError}</span>}
                    </Space>
                    <span style={{ color: '#94a3b8', fontSize: 12 }}>支持 PET/CT、MR/PET、CT/CTA 等序列融合</span>
                  </div>
                  <Table
                    dataSource={fusionJobs}
                    columns={fusionColumns}
                    rowKey="id"
                    loading={fusionLoading}
                    pagination={{ pageSize: 8, showTotal: (t) => `共 ${t} 条` }}
                    locale={{ emptyText: <Empty description="暂无融合任务" /> }}
                  />
                </div>
              ),
            },
            {
              key: 'assist',
              label: <Space><Sparkles size={15} />AI 辅助</Space>,
              children: (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Space>
                      <Badge count={assistItems.length} color="#10b981" style={{ boxShadow: 'none' }}>
                        <span style={{ color: '#64748b' }}>报告书写辅助建议模板</span>
                      </Badge>
                      {assistLoading && <Spin size="small" />}
                      {assistError && <span style={{ color: '#ef4444', fontSize: 12 }}>{assistError}</span>}
                    </Space>
                    <Button icon={<Copy size={14} />} onClick={() => {
                      const all = assistItems.map((a) => String(detailOf(a, 'suggestion') ?? '')).filter(Boolean).join('\n\n');
                      if (all) copyAssistText(all);
                    }}>
                      复制全部建议
                    </Button>
                  </div>
                  {assistItems.length === 0 && !assistLoading ? (
                    <Empty description="暂无 AI 辅助建议" />
                  ) : (
                    <Row gutter={[16, 16]}>
                      {assistItems.map((a) => {
                        const title = String(detailOf(a, 'title') ?? a.id);
                        const category = String(detailOf(a, 'category') ?? 'general');
                        const level = String(detailOf(a, 'level') ?? 'INFO');
                        const suggestion = String(detailOf(a, 'suggestion') ?? '');
                        const applicable = String(detailOf(a, 'applicableTo') ?? '');
                        const levelColor: Record<string, string> = { CRITICAL: 'red', WARN: 'orange', INFO: 'blue' };
                        const categoryLabel: Record<string, string> = {
                          quality: '报告质量', diagnosis: '鉴别诊断', followup: '随访建议', critical: '危急值', general: '通用',
                        };
                        return (
                          <Col xs={24} md={12} xl={8} key={a.id}>
                            <Card
                              variant="borderless"
                              style={{ borderRadius: 10, height: '100%' }}
                              styles={{ body: { display: 'flex', flexDirection: 'column', gap: 10, height: '100%' } }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                                <Space>
                                  <Sparkles size={15} style={{ color: '#10b981' }} />
                                  <span style={{ fontWeight: 600 }}>{title}</span>
                                </Space>
                                <Tag color={levelColor[level] ?? 'default'} style={{ fontSize: 11 }}>{level}</Tag>
                              </div>
                              <div>
                                <Space size={4} wrap>
                                  <Tag color="geekblue" style={{ fontSize: 11 }}>{categoryLabel[category] ?? category}</Tag>
                                  {applicable && <Tag style={{ fontSize: 11 }}>{applicable}</Tag>}
                                </Space>
                              </div>
                              <div style={{ color: '#475569', fontSize: 13, lineHeight: '22px', flex: 1 }}>
                                {suggestion}
                              </div>
                              <Button
                                size="small"
                                icon={<Copy size={13} />}
                                style={{ alignSelf: 'flex-end' }}
                                onClick={() => copyAssistText(suggestion)}
                              >
                                复制建议
                              </Button>
                            </Card>
                          </Col>
                        );
                      })}
                    </Row>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* ===== 注册模型 Modal ===== */}
      <Modal
        title={<Space><Plus size={16} /> 注册 AI 模型</Space>}
        open={registerOpen}
        onOk={() => void handleRegister()}
        onCancel={() => { setRegisterOpen(false); registerForm.resetFields(); }}
        okText="注册"
        cancelText="取消"
        width={520}
      >
        <Form form={registerForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="name" label="模型名称" rules={[{ required: true, message: '请输入模型名称' }]}>
            <Input placeholder="如：肺结节检测" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="version" label="版本" rules={[{ required: true, message: '请输入版本号' }]}>
                <Input placeholder="如：2.3.1" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="category" label="类别">
                <Select
                  placeholder="选择类别"
                  allowClear
                  options={['检测', '分割', '分类', '筛查', '定量分析', 'NLP'].map((c) => ({ label: c, value: c }))}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="vendor" label="厂商" rules={[{ required: true, message: '请输入厂商' }]}>
                <Input placeholder="如：DeepHealth" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="endpoint" label="推理端点 URL" rules={[{ required: true, type: 'url', message: '请输入合法 URL' }]}>
            <Input placeholder="https://ai.example.com/model/v1" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="模型能力简介（可选）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ===== 新建集成 Modal ===== */}
      <Modal
        title={<Space><GitBranch size={16} /> 新建 AI → 工作流集成</Space>}
        open={integrationOpen}
        onOk={() => void handleCreateIntegration()}
        onCancel={() => { setIntegrationOpen(false); integrationForm.resetFields(); }}
        okText="创建"
        cancelText="取消"
        width={560}
      >
        <Form form={integrationForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="modelId" label="AI 模型" rules={[{ required: true, message: '请选择模型' }]}>
            <Select
              placeholder="选择已注册模型"
              options={models.map((m) => ({
                label: `${m.name} v${m.version} (${m.status === 'DEPLOYED' ? '已部署' : m.status})`,
                value: m.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="name" label="集成名称" rules={[{ required: true, message: '请输入集成名称' }]}>
            <Input placeholder="如：胸部CT结节检测自动工作流" />
          </Form.Item>
          <Form.Item name="trigger" label="触发条件" initialValue="ON_STUDY_COMPLETE">
            <Select options={TRIGGER_OPTIONS} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="modality" label="设备模态（可选，匹配条件）">
                <Select allowClear placeholder="不限" options={MODALITY_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="bodyPart" label="检查部位（可选，匹配条件）">
                <Input placeholder="如：CHEST" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="targetWorkflow" label="目标工作流" rules={[{ required: true, message: '请选择目标工作流' }]}>
            <Select
              showSearch
              mode="tags"
              maxCount={1}
              placeholder="选择或输入工作流标识"
              options={WORKFLOW_OPTIONS}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* ===== 触发推理 Modal ===== */}
      <Modal
        title={<Space><Play size={16} /> 触发 AI 推理</Space>}
        open={triggerOpen}
        onOk={() => void handleTriggerJob()}
        onCancel={() => { setTriggerOpen(false); triggerForm.resetFields(); }}
        okText="触发"
        cancelText="取消"
        width={480}
      >
        <Form form={triggerForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="modelId" label="AI 模型（仅已部署）" rules={[{ required: true, message: '请选择模型' }]}>
            <Select
              placeholder={deployedModels.length ? '选择已部署模型' : '暂无可部署模型'}
              options={deployedModels.map((m) => ({
                label: `${m.name} v${m.version}`,
                value: m.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="examId" label="检查号 (Exam ID)" rules={[{ required: true, message: '请输入检查号' }]}>
            <Input placeholder="如：EX-5123" />
          </Form.Item>
          <Form.Item name="trigger" label="触发方式" initialValue="MANUAL">
            <Select options={TRIGGER_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ===== 模拟事件触发 Modal ===== */}
      <Modal
        title={<Space><Zap size={16} /> 模拟工作流事件（按条件匹配）</Space>}
        open={eventOpen}
        onOk={() => void handleTriggerEvent()}
        onCancel={() => { setEventOpen(false); eventForm.resetFields(); }}
        okText="触发事件"
        cancelText="取消"
        width={480}
      >
        <Form form={eventForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="trigger" label="事件类型" rules={[{ required: true, message: '请选择事件类型' }]} initialValue="ON_STUDY_COMPLETE">
            <Select options={TRIGGER_OPTIONS} />
          </Form.Item>
          <Form.Item name="examId" label="检查号 (Exam ID)" rules={[{ required: true, message: '请输入检查号' }]}>
            <Input placeholder="如：EX-5123" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="modality" label="设备模态（匹配条件）">
                <Select allowClear placeholder="不限" options={MODALITY_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="bodyPart" label="检查部位（匹配条件）">
                <Input placeholder="如：CHEST" />
              </Form.Item>
            </Col>
          </Row>
          <div style={{ color: '#94a3b8', fontSize: 12 }}>
            系统将根据集成触发条件自动匹配并创建对应推理任务（队列模拟）
          </div>
        </Form>
      </Modal>

      {/* ===== [W1-D] 生成结构化报告 Modal ===== */}
      <Modal
        title={<Space><FileText size={16} /> 生成结构化报告</Space>}
        open={srOpen}
        onOk={() => void handleGenerateSr()}
        onCancel={() => { setSrOpen(false); srForm.resetFields(); }}
        okText="生成"
        confirmLoading={srSubmitting}
        cancelText="取消"
        width={520}
      >
        <Form form={srForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="studyId" label="检查号 (Study/Exam ID)" rules={[{ required: true, message: '请输入检查号' }]}>
            <Input placeholder="如：EX-5001" />
          </Form.Item>
          <Form.Item name="templateId" label="报告模板" rules={[{ required: true, message: '请选择模板' }]}>
            <Select
              showSearch
              placeholder="选择结构化报告模板"
              options={[
                { label: '胸部 CT 平扫结构化模板 (TPL-CHEST-CT)', value: 'TPL-CHEST-CT' },
                { label: 'DR 骨折结构化模板 (TPL-DR-FRACTURE)', value: 'TPL-DR-FRACTURE' },
                { label: '头颅 MR 结构化模板 (TPL-BRAIN-MR)', value: 'TPL-BRAIN-MR' },
                { label: '钼靶筛查结构化模板 (TPL-MG-SCREEN)', value: 'TPL-MG-SCREEN' },
              ]}
            />
          </Form.Item>
          <Form.Item name="findings" label="发现条目（可多选，AI 将据此生成结构化内容）">
            <Select
              mode="tags"
              open={false}
              placeholder="输入发现内容后回车，如：右肺上叶磨玻璃结节"
              tokenSeparators={[',', '；']}
            />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="modality" label="模态（附加上下文）">
                <Select allowClear placeholder="可选" options={MODALITY_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="priority" label="优先级（附加上下文）">
                <Select allowClear placeholder="可选" options={[
                  { label: '常规', value: 'NORMAL' },
                  { label: '高优先级', value: 'HIGH' },
                  { label: '危急', value: 'CRITICAL' },
                ]} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* ===== [W1-D] 新建 AI 编排 Modal ===== */}
      <Modal
        title={<Space><Workflow size={16} /> 新建 AI 编排流水线</Space>}
        open={orchOpen}
        onOk={() => void handleCreateOrchestration()}
        onCancel={() => { setOrchOpen(false); orchForm.resetFields(); }}
        okText="创建"
        confirmLoading={orchSubmitting}
        cancelText="取消"
        width={560}
      >
        <Form form={orchForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="workflowName" label="编排名称" rules={[{ required: true, message: '请输入编排名称' }]}>
            <Input placeholder="如：胸部CT结节智能闭环" />
          </Form.Item>
          <Form.Item name="trigger" label="触发方式" initialValue="ON_STUDY_COMPLETE">
            <Select options={TRIGGER_OPTIONS} />
          </Form.Item>
          <Form.Item label="执行步骤" required>
            <Form.List name="steps" initialValue={[{ action: 'ai_detection', target: 'MOD-001' }, { action: 'report_draft', target: 'TPL-CHEST-CT' }]}>
              {(fields, { add, remove }) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {fields.map(({ key, name, ...restField }) => (
                    <Space key={key} align="baseline" style={{ display: 'flex' }}>
                      <span style={{ width: 20, color: '#94a3b8', fontSize: 12 }}>{name + 1}</span>
                      <Form.Item {...restField} name={[name, 'action']} rules={[{ required: true, message: '请输入动作' }]} style={{ marginBottom: 0, width: 180 }}>
                        <Input placeholder="如：ai_detection" />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'target']} style={{ marginBottom: 0, width: 200 }}>
                        <Input placeholder="目标（模型/模板，可选）" />
                      </Form.Item>
                      <Button type="text" danger size="small" icon={<XCircle size={13} />} onClick={() => remove(name)} />
                    </Space>
                  ))}
                  <Button type="dashed" size="small" icon={<Plus size={13} />} onClick={() => add({ action: '', target: '' })}>
                    添加步骤
                  </Button>
                </div>
              )}
            </Form.List>
          </Form.Item>
          <div style={{ color: '#94a3b8', fontSize: 12 }}>
            步骤动作示例：ai_detection（AI 检测）、report_draft（报告起草）、human_review（医生复核）、critical_escalation（危急值升级）
          </div>
        </Form>
      </Modal>

      {/* ===== 测试结果 Popover ===== */}
      <Modal
        title={<Space><FlaskConical size={16} /> 模型连通性测试</Space>}
        open={!!testResult}
        onCancel={() => setTestResult(null)}
        footer={<Button onClick={() => setTestResult(null)}>关闭</Button>}
        width={440}
      >
        {testResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 8,
              background: testResult.reachable ? '#f6ffed' : '#fff1f0',
            }}>
              {testResult.reachable ? <CheckCircle size={28} color="#52c41a" /> : <XCircle size={28} color="#ff4d4f" />}
              <div>
                <div style={{ fontWeight: 600, color: testResult.reachable ? '#389e0d' : '#cf1322' }}>
                  {testResult.reachable ? '连通正常' : '连接异常'}
                </div>
                <div style={{ fontSize: 12, color: '#666' }}>{testResult.message}</div>
              </div>
            </div>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="延迟">{testResult.latencyMs}ms</Descriptions.Item>
              <Descriptions.Item label="超时上限">{testResult.timeoutMs}ms</Descriptions.Item>
              <Descriptions.Item label="端点" span={2}>
                <span style={{ wordBreak: 'break-all' }}>{testResult.endpoint ?? '--'}</span>
              </Descriptions.Item>
              <Descriptions.Item label="测试时间" span={2}>{testResult.testedAt.replace('T', ' ').slice(0, 19)}</Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Modal>

      {/* ===== 任务详情 Drawer + 二次检出查看器 ===== */}
      <Drawer
        title={<Space><Box size={17} /> 推理任务详情 - {drawerJob?.id}</Space>}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        size="large"
        extra={
          drawerJob?.status === 'COMPLETED' && drawerFindings.length > 0 ? (
            <Tag color="volcano" icon={<ScanSearch size={13} />}>二次检出</Tag>
          ) : null
        }
      >
        {drawerJob && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="模型" span={2}>
                {drawerJob.model ? (
                  <Space size={4}>
                    <span style={{ fontWeight: 600 }}>{drawerJob.model.name}</span>
                    <Tag style={{ fontSize: 11 }}>v{drawerJob.model.version}</Tag>
                    <Tag color="blue" style={{ fontSize: 11 }}>{drawerJob.model.vendor}</Tag>
                  </Space>
                ) : drawerJob.modelId}
              </Descriptions.Item>
              <Descriptions.Item label="检查号">{drawerJob.examId ?? '--'}</Descriptions.Item>
              <Descriptions.Item label="触发方式">
                <Tag color="purple" style={{ fontSize: 11 }}>{drawerJob.trigger}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag icon={JOB_STATUS_META[drawerJob.status]?.icon} color={JOB_STATUS_META[drawerJob.status]?.color}>
                  {JOB_STATUS_META[drawerJob.status]?.label ?? drawerJob.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="耗时">
                {drawerJob.startedAt
                  ? formatDuration((drawerJob.completedAt ? Date.parse(drawerJob.completedAt) : Date.now()) - Date.parse(drawerJob.startedAt))
                  : '--'}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间" span={2}>
                {drawerJob.createdAt.replace('T', ' ').slice(0, 19)}
              </Descriptions.Item>
              {drawerJob.error && (
                <Descriptions.Item label="错误信息" span={2}>
                  <span style={{ color: '#ef4444' }}>{drawerJob.error}</span>
                </Descriptions.Item>
              )}
            </Descriptions>

            {drawerJob.status === 'RUNNING' && (
              <div style={{ padding: 16, borderRadius: 8, background: '#f0f5ff', textAlign: 'center' }}>
                <Spin />
                <div style={{ marginTop: 8, color: '#597ef7', fontSize: 13 }}>模型推理执行中，结果生成后自动展示异常区域...</div>
              </div>
            )}

            {drawerJob.status === 'COMPLETED' && drawerJob.result && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>
                    <Space><ScanSearch size={16} color="#8b5cf6" /> AI 二次检出结果</Space>
                  </div>
                  <Space>
                    {drawerJob.result.structured?.priority === 'HIGH' && <Tag color="volcano">高优先级</Tag>}
                    <Tag color="green">{drawerJob.result.summary}</Tag>
                  </Space>
                </div>

                {drawerFindings.length > 0 ? (
                  <>
                    <FindingViewer
                      findings={drawerFindings}
                      activeIndex={activeFinding}
                      onSelect={setActiveFinding}
                    />
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>异常区域列表（点击可在查看器中高亮）</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {drawerFindings.map((f, i) => {
                        const active = i === activeFinding;
                        return (
                          <div
                            key={`${f.label}-${i}`}
                            onClick={() => setActiveFinding(active ? null : i)}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                              border: active ? '1.5px solid #ef4444' : '1px solid #e5e7eb',
                              background: active ? '#fff1f0' : '#fafafa',
                            }}
                          >
                            <Space>
                              <span style={{
                                width: 10, height: 10, borderRadius: 3,
                                background: active ? '#ef4444' : '#f59e0b', display: 'inline-block',
                              }} />
                              <span style={{ fontWeight: active ? 700 : 500 }}>{f.label}</span>
                              <span style={{ color: '#94a3b8', fontSize: 12 }}>
                                坐标 ({Math.round(f.x * 100)}, {Math.round(f.y * 100)})
                              </span>
                            </Space>
                            <Tag color={f.confidence >= 0.9 ? 'red' : 'orange'} style={{ fontSize: 11 }}>
                              {(f.confidence * 100).toFixed(0)}%
                            </Tag>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: 12 }}>
                      提示：点击异常区域列表项，查看器内对应坐标框将高亮显示，便于二次核对。
                    </div>
                  </>
                ) : (
                  <Empty description="本次推理未检出异常区域" />
                )}
              </>
            )}

            {drawerJob.status === 'QUEUED' && (
              <Empty description="任务排队中，稍后自动开始推理..." />
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
