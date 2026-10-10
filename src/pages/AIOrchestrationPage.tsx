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
import {
  Card,
  Tabs,
  Button,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Select,
  message,
  Badge,
  Drawer,
  Descriptions,
  Empty,
  Row,
  Col,
  Avatar,
  Tooltip,
  Spin,
} from "antd";
import { TableProps } from 'antd'
import { PageHeader } from '../components/common/PageHeader'
import { EmptyState } from '../components/common/EmptyState'
import { srDocumentApi, type AiSrFindingPayload } from '../services/api/srReportApi';
import { useNavigate } from 'react-router-dom';
import { t } from '../i18n/appI18n';
import {
  Cpu,
  Plus,
  Play,
  Square,
  FlaskConical,
  GitBranch,
  ListChecks,
  Boxes,
  Zap,
  Eye,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Box,
  ScanSearch,
  Wifi,
  WifiOff,
  FileText,
  Layers,
  Sparkles,
  Copy,
  Workflow,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Inbox } from 'lucide-react'

const MODEL_STATUS_META: Record<string, { color: string; label: string }> = {
  REGISTERED: { color: 'default', label: t('aiOrch.statusRegistered') },
  DEPLOYED: { color: 'success', label: t('aiOrch.statusDeployed') },
  UNDEPLOYED: { color: 'orange', label: t('aiOrch.statusUndeployed') },
  FAILED: { color: 'error', label: t('aiOrch.statusFailed') },
};
import { DataTable } from "../components/common";

const JOB_STATUS_META: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  QUEUED: { color: 'default', icon: <Clock size={13} />, label: t('aiOrch.jobQueued') },
  RUNNING: { color: 'processing', icon: <Activity size={13} />, label: t('aiOrch.jobRunning') },
  COMPLETED: { color: 'success', icon: <CheckCircle size={13} />, label: t('aiOrch.jobCompleted') },
  FAILED: { color: 'error', icon: <XCircle size={13} />, label: t('aiOrch.jobFailed') },
};

const TRIGGER_OPTIONS = [
  { label: `${t('aiOrch.triggerStudyComplete')} (ON_STUDY_COMPLETE)`, value: 'ON_STUDY_COMPLETE' },
  { label: `${t('aiOrch.triggerReportSave')} (ON_REPORT_SAVE)`, value: 'ON_REPORT_SAVE' },
  { label: `${t('aiOrch.triggerExamCreate')} (ON_EXAM_CREATE)`, value: 'ON_EXAM_CREATE' },
  { label: `${t('aiOrch.triggerManual')} (MANUAL)`, value: 'MANUAL' },
];

const TRIGGER_LABEL: Record<string, string> = {
  ON_STUDY_COMPLETE: t('aiOrch.triggerStudyComplete'),
  ON_REPORT_SAVE: t('aiOrch.triggerReportSave'),
  ON_EXAM_CREATE: t('aiOrch.triggerExamCreate'),
  MANUAL: t('aiOrch.triggerManual'),
  event: t('aiOrch.triggerEvent'),
  schedule: t('aiOrch.triggerSchedule'),
  api: t('aiOrch.triggerApi'),
};

const MODALITY_OPTIONS = ['CT', 'DR', 'MR', 'MG', 'PET', 'US', 'DSA', 'XA'].map((m) => ({ label: m, value: m }));

const WORKFLOW_OPTIONS = [
  'lung-nodule-auto',
  'fracture-screening',
  'mammo-prescreen',
  'stroke-urgent',
  'bone-density-report',
  'critical-value-escalation',
].map((w) => ({ label: w, value: w }));

const VENDOR_COLORS = ['#8b5cf6', '#0ea5e9', '#10b981', 'var(--color-warning-500)', 'var(--color-error-500)', '#ec4899', '#14b8a6', '#6366f1'];

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
      aria-label={t('aiOrch.viewerAriaLabel')}
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
              stroke={active ? 'var(--color-error-500)' : 'var(--color-warning-500)'}
              strokeWidth={active ? 2.5 : 1.5}
              strokeDasharray={active ? 'none' : '4 3'}
              rx="2"
            />
            <line x1={x} y1={y} x2={x + w * 1.8} y2={y} stroke="var(--color-warning-400)" strokeWidth="1" />
            <line x1={x} y1={y} x2={x} y2={y + h * 1.8} stroke="var(--color-warning-400)" strokeWidth="1" />
            <g transform={`translate(${Math.min(x + w, W - 8)}, ${Math.max(y - 4, 10)})`}>
              <rect x="-8" y="-16" width={8 + f.label.length * 6.5} height="18" rx="3" fill={active ? 'var(--color-error-500)' : '#0f172a'} stroke={active ? '#fca5a5' : '#475569'} strokeWidth="0.8" />
              <text x="0" y="-2" fontSize="10" fill="#f8fafc">{f.label}</text>
            </g>
          </g>
        );
      })}
      <text x="12" y="H - 10" fontSize="11" fill="#64748b">{t('aiOrch.viewerHint')}</text>
    </svg>
  );
}

// ==================== 页面 ====================
export default function AIOrchestrationPage() {
  const navigate = useNavigate();
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

  // [W2-C] 受控分页 (5 张表格)
  const [integrationPage, setIntegrationPage] = useState(1);
  const [jobPage, setJobPage] = useState(1);
  const [srPage, setSrPage] = useState(1);
  const [fusionPage, setFusionPage] = useState(1);
  const [orchPage, setOrchPage] = useState(1);

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
    else message.warning(res.error?.message ?? t('aiOrch.loadModelsFailed'));
    setModelsLoading(false);
  }, []);

  const fetchIntegrations = useCallback(async () => {
    setIntegrationsLoading(true);
    const res = await aiOrchestratorApi.listIntegrations();
    if (res.success) setIntegrations(res.data);
    else message.warning(res.error?.message ?? t('aiOrch.loadIntegrationsFailed'));
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
      setSrError(res.error?.message ?? t('aiOrch.loadSrFailed'));
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
      setOrchError(res.error?.message ?? t('aiOrch.loadOrchFailed'));
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
      setFusionError(res.error?.message ?? t('aiOrch.loadFusionFailed'));
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
      setAssistError(res.error?.message ?? t('aiOrch.loadAssistFailed'));
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
        message.error(res.error?.message ?? t('aiOrch.registerFailed'));
      }
    } catch (err) {
      if (err instanceof Error) message.error(err.message);
    }
  };

  const handleDeploy = async (id: string) => {
    const res = await aiOrchestratorApi.deployModel(id);
    if (res.success) {
      message.success(t('aiOrch.deploySuccess'));
      void fetchModels();
    } else {
      message.error(res.error?.message ?? t('aiOrch.deployFailed'));
    }
  };

  const handleUndeploy = (id: string, name: string) => {
    Modal.confirm({
      title: t('aiOrch.undeployConfirmTitle'),
      content: `下线后 ${name} 将不再接收新的推理任务，确定继续？`,
      okText: t('aiOrch.undeployOk'),
      okType: 'danger',
      cancelText: t('aiOrch.cancel'),
      onOk: async () => {
        const res = await aiOrchestratorApi.undeployModel(id);
        if (res.success) {
          message.success(t('aiOrch.undeploySuccess'));
          void fetchModels();
        } else {
          message.error(res.error?.message ?? t('aiOrch.undeployFailed'));
        }
      },
    });
  };

  const handleTest = async (id: string) => {
    const res = await aiOrchestratorApi.testModel(id);
    if (res.success && res.data) {
      setTestResult(res.data);
    } else {
      message.error(res.error?.message ?? t('aiOrch.testFailed'));
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
        message.success(t('aiOrch.integrationCreated'));
        setIntegrationOpen(false);
        integrationForm.resetFields();
        void fetchIntegrations();
        void fetchModels();
      } else {
        message.error(res.error?.message ?? t('aiOrch.createFailed'));
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
        message.error(res.error?.message ?? t('aiOrch.triggerFailed'));
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
        message.error(res.error?.message ?? t('aiOrch.eventTriggerFailed'));
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
        message.error(res.error?.message ?? t('aiOrch.generateFailed'));
      }
    } catch (err) {
      if (err instanceof Error) message.error(err.message);
    } finally {
      setSrSubmitting(false);
    }
  };

  const copyAssistText = (text: string) => {
    void navigator.clipboard?.writeText(text).then(
      () => message.success(t('aiOrch.copiedToClipboard')),
      () => message.warning(t('aiOrch.copyFailed')),
    );
  };

  // [G005 Wave4A] G-14 封装 AI 检出结果为 DICOM SR (TID 2000 CAD SR) → 跳转 SR 管理器查看
  const [encapsulating, setEncapsulating] = useState<string | null>(null);

  const handleEncapsulateSr = async (studyId: string, findings: unknown[], summary?: string) => {
    if (!studyId || findings.length === 0) {
      message.warning(t('aiOrch.selectExamWithFindings'));
      return;
    }
    setEncapsulating(studyId);
    try {
      const payloadFindings: AiSrFindingPayload[] = findings.map((f) => {
        const item = (typeof f === 'string' ? { label: f } : f) as Partial<AiSrFindingPayload>;
        return {
          label: String(item.label ?? ''),
          ...(typeof item.confidence === 'number' ? { confidence: item.confidence } : {}),
          ...(typeof item.x === 'number' ? { x: item.x } : {}),
          ...(typeof item.y === 'number' ? { y: item.y } : {}),
          ...(typeof item.width === 'number' ? { width: item.width } : {}),
          ...(typeof item.height === 'number' ? { height: item.height } : {}),
          ...(item.description ? { description: String(item.description) } : {}),
        };
      }).filter((f) => f.label);
      if (payloadFindings.length === 0) {
        message.warning(t('aiOrch.noValidFindings'));
        return;
      }
      const res = await srDocumentApi.fromAi({
        studyId,
        findings: payloadFindings,
        templateId: 'tid2000',
        modelName: 'AI Orchestration',
        summary,
      });
      if (res.success && res.data) {
        message.success(`AI 结果已封装为 DICOM SR：${res.data.sopInstanceUid}`);
        navigate('/dicom/sr-manager');
      } else {
        message.error(res.error?.message ?? t('aiOrch.encapsulateFailed'));
      }
    } catch (err) {
      if (err instanceof Error) message.error(err.message);
    } finally {
      setEncapsulating(null);
    }
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
        message.error(res.error?.message ?? t('aiOrch.createFailed'));
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
      title: t('aiOrch.colName'), dataIndex: 'name', key: 'name',
      render: (v: string) => (
        <Space>
          <GitBranch size={15} style={{ color: '#0ea5e9' }} />
          <span style={{ fontWeight: 600 }}>{v}</span>
        </Space>
      ),
    },
    {
      title: t('aiOrch.colModel'), dataIndex: 'model', key: 'model',
      render: (_v: unknown, r) => r.model ? (
        <Space size={4}>
          <Tag color="geekblue">{r.model.name} v{r.model.version}</Tag>
          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{r.model.vendor}</span>
        </Space>
      ) : <Tag>{r.modelId}</Tag>,
    },
    {
      title: t('aiOrch.colTriggerConditions'), dataIndex: 'triggerConditions', key: 'triggerConditions',
      render: (v: Record<string, unknown>) => {
        if (!v || Object.keys(v).length === 0) return <Tag>{t('aiOrch.unconditional')}</Tag>;
        const parts: string[] = [];
        if (v.trigger) parts.push(String(v.trigger));
        if (v.modality) parts.push(`模态=${v.modality}`);
        if (v.bodyPart) parts.push(`部位=${v.bodyPart}`);
        return <Space size={4} wrap>{parts.map((p) => <Tag key={p} color="purple" style={{ fontSize: 11 }}>{p}</Tag>)}</Space>;
      },
    },
    {
      title: t('aiOrch.colTargetWorkflow'), dataIndex: 'targetWorkflow', key: 'targetWorkflow',
      render: (v: string) => <Tag color="cyan">{v}</Tag>,
    },
    {
      title: t('aiOrch.colStatus'), dataIndex: 'status', key: 'status',
      render: (v: string) => v === 'ACTIVE'
        ? <Tag color="success" icon={<CheckCircle size={12} />}>{t('aiOrch.enabled')}</Tag>
        : <Tag color="default">{t('aiOrch.disabled')}</Tag>,
    },
    {
      title: t('aiOrch.colCreatedAt'), dataIndex: 'createdAt', key: 'createdAt',
      render: (v: string) => <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{v.replace('T', ' ').slice(0, 16)}</span>,
    },
  ];

  const jobColumns: TableProps<AiJob>['columns'] = [
    {
      title: t('aiOrch.colJobId'), dataIndex: 'id', key: 'id',
      render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span>,
    },
    {
      title: t('aiOrch.colModel'), dataIndex: 'model', key: 'model',
      render: (_v: unknown, r) => r.model ? (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 600 }}>{r.model.name}</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>v{r.model.version} · {r.model.vendor}</span>
        </Space>
      ) : <Tag>{r.modelId}</Tag>,
    },
    {
      title: t('aiOrch.colExam'), dataIndex: 'examId', key: 'examId',
      render: (v: string | null) => v ? <Tag color="default">{v}</Tag> : <span style={{ color: 'var(--text-secondary)' }}>--</span>,
    },
    {
      title: t('aiOrch.colTrigger'), dataIndex: 'trigger', key: 'trigger',
      render: (v: string) => <Tag color="purple" style={{ fontSize: 11 }}>{TRIGGER_LABEL[v] ?? v}</Tag>,
    },
    {
      title: t('aiOrch.colStatus'), dataIndex: 'status', key: 'status',
      render: (v: string) => {
        const meta = JOB_STATUS_META[v] ?? JOB_STATUS_META.QUEUED!;
        return <Tag icon={meta.icon} color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: t('aiOrch.colDuration'), key: 'duration',
      render: (_v: unknown, r) => {
        if (!r.startedAt) return <span style={{ color: 'var(--text-secondary)' }}>--</span>;
        const end = r.completedAt ? Date.parse(r.completedAt) : Date.now();
        const dur = end - Date.parse(r.startedAt);
        return <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{formatDuration(dur)}</span>;
      },
    },
    {
      title: t('aiOrch.colResult'), dataIndex: 'result', key: 'result',
      render: (_v: unknown, r) => {
        if (r.status === 'FAILED') return <span style={{ color: 'var(--color-error-500)', fontSize: 12 }}>{r.error ?? t('aiOrch.inferenceFailed')}</span>;
        if (r.status !== 'COMPLETED') return <span style={{ color: 'var(--text-secondary)' }}>--</span>;
        const findings = r.result?.findings?.length ?? 0;
        const priority = r.result?.structured?.priority;
        return (
          <Space size={4}>
            <Tag color={priority === 'HIGH' ? 'red' : 'green'} style={{ fontSize: 11 }}>
              {t('aiOrch.abnormalCount', { count: findings })}
            </Tag>
            {priority === 'HIGH' && <Tag color="volcano" style={{ fontSize: 11 }}>{t('aiOrch.highPriority')}</Tag>}
          </Space>
        );
      },
    },
    {
      title: t('aiOrch.colAction'), key: 'action',
      render: (_v: unknown, r) => (
        <Space>
          <Button type="link" size="small" icon={<Eye size={13} />} onClick={() => openJobDrawer(r)}>{t('aiOrch.detail')}</Button>
          {r.status === 'COMPLETED' && r.result?.findings?.length ? (
            <Button type="link" size="small" icon={<ScanSearch size={13} />} onClick={() => openJobDrawer(r)}>{t('aiOrch.reviewView')}</Button>
          ) : null}
        </Space>
      ),
    },
  ];

  // ===== [W1-D] 结构化报告表格列 =====
  const srColumns: TableProps<AiPlatformRecord>['columns'] = [
    {
      title: t('aiOrch.colRecordId'), dataIndex: 'id', key: 'id',
      render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span>,
    },
    {
      title: t('aiOrch.colExam'), key: 'studyId',
      render: (_v: unknown, r) => {
        const sid = detailOf(r, 'studyId');
        return sid ? <Tag color="default">{String(sid)}</Tag> : <span style={{ color: 'var(--text-secondary)' }}>--</span>;
      },
    },
    {
      title: t('aiOrch.colTemplate'), key: 'templateId',
      render: (_v: unknown, r) => {
        const tid = detailOf(r, 'templateId');
        return tid ? <Tag color="geekblue" style={{ fontFamily: 'monospace', fontSize: 11 }}>{String(tid)}</Tag> : <span style={{ color: 'var(--text-secondary)' }}>--</span>;
      },
    },
    {
      title: t('aiOrch.colFindings'), key: 'findings',
      render: (_v: unknown, r) => {
        const findings = detailOf(r, 'findings');
        const count = Array.isArray(findings) ? findings.length : 0;
        return count > 0 ? <Tag color="green">{t('aiOrch.entriesCount', { count })}</Tag> : <span style={{ color: 'var(--text-secondary)' }}>--</span>;
      },
    },
    {
      title: t('aiOrch.colAction'), dataIndex: 'action', key: 'action',
      render: (v: string) => <Tag color="purple" style={{ fontSize: 11 }}>{v ?? 'GENERATE'}</Tag>,
    },
    {
      title: t('aiOrch.colCreatedAt'), dataIndex: 'createdAt', key: 'createdAt',
      render: (v: string) => <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{fmtTime(v)}</span>,
    },
    {
      title: t('aiOrch.colAction'), key: 'actionView',
      render: (_v: unknown, r) => {
        const studyId = String(detailOf(r, 'studyId') ?? '');
        const findings = detailOf(r, 'findings');
        const list = Array.isArray(findings) ? findings : [];
        return (
          <Space>
            <Button
              type="link" size="small" icon={<Eye size={13} />}
              onClick={() => {
                Modal.info({
                  title: `结构化报告 ${r.id}`,
                  width: 560,
                  content: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{t('aiOrch.labelExamId')}</span>
                        <span>{studyId || '--'}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{t('aiOrch.labelTemplate')}</span>
                        <span>{String(detailOf(r, 'templateId') ?? '--')}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{t('aiOrch.labelFindingContent')}</span>
                        <div style={{ marginTop: 'var(--space-1, 4px)', whiteSpace: 'pre-wrap', lineHeight: '22px' }}>
                          {fmtList(list)}
                        </div>
                      </div>
                    </div>
                  ),
                });
              }}
            >
              {t('aiOrch.detail')}
            </Button>
            {/* [G005 Wave4A] G-14 AI 结果 → DICOM SR 封装 */}
            <Button
              type="link" size="small" icon={<FileText size={13} />}
              disabled={!studyId || list.length === 0 || encapsulating === r.id}
              loading={encapsulating === r.id}
              onClick={() => void handleEncapsulateSr(studyId, list, undefined)}
            >
              {t('aiOrch.encapsulateSr')}
            </Button>
          </Space>
        );
      },
    },
  ];

  // ===== [W1-D] 融合工作区表格列 =====
  const FUSION_STATUS_META: Record<string, { color: string; label: string }> = {
    COMPLETED: { color: 'success', label: t('aiOrch.fusionCompleted') },
    RUNNING: { color: 'processing', label: t('aiOrch.fusionRunning') },
    QUEUED: { color: 'default', label: t('aiOrch.fusionQueued') },
    FAILED: { color: 'error', label: t('aiOrch.fusionFailed') },
  };

  const fusionColumns: TableProps<AiPlatformRecord>['columns'] = [
    {
      title: t('aiOrch.colJobId'), dataIndex: 'id', key: 'id',
      render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span>,
    },
    {
      title: t('aiOrch.colPrimarySeries'), key: 'primarySeries',
      render: (_v: unknown, r) => <Tag color="cyan" style={{ fontFamily: 'monospace', fontSize: 11 }}>{String(detailOf(r, 'primarySeries') ?? '--')}</Tag>,
    },
    {
      title: t('aiOrch.colSecondarySeries'), key: 'secondarySeries',
      render: (_v: unknown, r) => <Tag color="default" style={{ fontFamily: 'monospace', fontSize: 11 }}>{String(detailOf(r, 'secondarySeries') ?? '--')}</Tag>,
    },
    {
      title: t('aiOrch.colFusionType'), key: 'type',
      render: (_v: unknown, r) => {
        const typeVal = detailOf(r, 'type');
        return typeVal ? <Tag color="geekblue">{String(typeVal)}</Tag> : <span style={{ color: 'var(--text-secondary)' }}>--</span>;
      },
    },
    {
      title: t('aiOrch.colStatus'), key: 'status',
      render: (_v: unknown, r) => {
        const st = String(detailOf(r, 'status') ?? 'QUEUED');
        const meta = FUSION_STATUS_META[st] ?? FUSION_STATUS_META.QUEUED!;
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: t('aiOrch.colResultPath'), key: 'resultPath',
      render: (_v: unknown, r) => {
        const p = detailOf(r, 'resultPath');
        return p ? <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#0ea5e9' }}>{String(p)}</span> : <span style={{ color: 'var(--text-secondary)' }}>--</span>;
      },
    },
    {
      title: t('aiOrch.colCreatedAt'), dataIndex: 'createdAt', key: 'createdAt',
      render: (v: string) => <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{fmtTime(v)}</span>,
    },
  ];

  // ===== [W1-D] AI 编排表格列 =====
  const orchestrationColumns: TableProps<AiPlatformRecord>['columns'] = [
    {
      title: t('aiOrch.colOrchId'), dataIndex: 'id', key: 'id',
      render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span>,
    },
    {
      title: t('aiOrch.colOrchName'), key: 'workflowName',
      render: (_v: unknown, r) => (
        <Space>
          <Workflow size={14} style={{ color: '#8b5cf6' }} />
          <span style={{ fontWeight: 600 }}>{String(detailOf(r, 'workflowName') ?? '--')}</span>
        </Space>
      ),
    },
    {
      title: t('aiOrch.colTrigger'), key: 'trigger',
      render: (_v: unknown, r) => {
        const trigVal = detailOf(r, 'trigger');
        return trigVal ? <Tag color="purple" style={{ fontSize: 11 }}>{TRIGGER_LABEL[String(trigVal)] ?? String(trigVal)}</Tag> : <span style={{ color: 'var(--text-secondary)' }}>--</span>;
      },
    },
    {
      title: t('aiOrch.colSteps'), key: 'steps',
      render: (_v: unknown, r) => {
        const steps = detailOf(r, 'steps');
        const count = Array.isArray(steps) ? steps.length : 0;
        return count > 0 ? <Tag color="blue">{t('aiOrch.stepsCount', { count })}</Tag> : <span style={{ color: 'var(--text-secondary)' }}>--</span>;
      },
    },
    {
      title: t('aiOrch.colCreatedAt'), dataIndex: 'createdAt', key: 'createdAt',
      render: (v: string) => <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{fmtTime(v)}</span>,
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
              styles={{ body: { display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)', height: '100%' } }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Space>
                  <Avatar size={38} style={{ background: color, fontWeight: 700, fontSize: 14 }}>
                    {(m.vendor ?? m.name).charAt(0).toUpperCase()}
                  </Avatar>
                  <div>
                    <div style={{ fontWeight: 700 }}>{m.name}</div>
                    <Space size={4}>
                      <Tag style={{ fontSize: 11 }}>v{m.version}</Tag>
                      <Tag color="blue" style={{ fontSize: 11 }}>{m.category ?? t('aiOrch.categoryGeneral')}</Tag>
                    </Space>
                  </div>
                </Space>
                <Tag color={st.color}>{st.label}</Tag>
              </div>

              <div style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)', marginBottom: 'var(--space-1, 4px)' }}>
                  {m.status === 'FAILED' ? <WifiOff size={12} /> : <Wifi size={12} />}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.endpoint ?? t('aiOrch.endpointNotConfigured')}</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Tooltip title={`${m.vendor ?? t('aiOrch.unknownVendor')}`}>
                    <span style={{ background: `${color}22`, color, padding: '2px 8px', borderRadius: 6, fontWeight: 600, fontSize: 11 }}>
                      {m.vendor ?? t('aiOrch.unknownVendor')}
                    </span>
                  </Tooltip>
                </div>
              </div>

              <Row gutter={8} style={{ textAlign: 'center' }}>
                <Col span={12}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2 }}>{t('aiOrch.inferenceCount')}</div>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>{m.deploymentCount}</div>
                </Col>
                <Col span={12}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2 }}>{t('aiOrch.workflowIntegrations')}</div>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>{m.integrationCount}</div>
                </Col>
              </Row>

              <div style={{ marginTop: 'auto', display: 'flex', gap: 'var(--space-2, 8px)', flexWrap: 'wrap' }}>
                <Button size="small" icon={<FlaskConical size={13} />} onClick={() => void handleTest(m.id)}>{t('aiOrch.test')}</Button>
                {m.status !== 'DEPLOYED' ? (
                  <Button size="small" type="primary" icon={<Play size={13} />} onClick={() => void handleDeploy(m.id)}>{t('aiOrch.deploy')}</Button>
                ) : (
                  <Button size="small" danger icon={<Square size={13} />} onClick={() => handleUndeploy(m.id, m.name)}>{t('aiOrch.undeploy')}</Button>
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
    <div style={{ padding: 'var(--space-6, 24px)', maxWidth: 1440, margin: '0 auto' }}>
      <Card variant="borderless" style={{ borderRadius: 12, marginBottom: 'var(--space-4, 16px)' }}>
        <PageHeader
          icon={
            <div style={{
              width: 42, height: 42, borderRadius: 10,
              background: 'linear-gradient(135deg, #8b5cf6, #0ea5e9)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Cpu size={22} color="#fff" />
            </div>
          }
          title={t('aiOrch.pageTitle')}
          subtitle={t('aiOrch.pageSubtitle')}
          actions={
            <Space size={12}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>{models.filter((m) => m.status === 'DEPLOYED').length}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('aiOrch.deployedModels')}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#0ea5e9' }}>{integrations.filter((i) => i.status === 'ACTIVE').length}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('aiOrch.activeIntegrations')}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#8b5cf6' }}>{completedJobs.length}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('aiOrch.completedTasks')}</div>
              </div>
            </Space>
          }
        />
      </Card>

      <Card variant="borderless" style={{ borderRadius: 12 }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'market',
              label: <Space><Boxes size={15} />{t('aiOrch.tabModelMarket')}</Space>,
              children: (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4, 16px)' }}>
                    <Space>
                      <Badge count={models.length} color="#8b5cf6" style={{ boxShadow: 'none' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{t('aiOrch.registeredModels')}</span>
                      </Badge>
                      {modelsLoading && <Spin size="small" />}
                    </Space>
                    <Button type="primary" icon={<Plus size={15} />} onClick={() => setRegisterOpen(true)}>
                      {t('aiOrch.registerModel')}
                    </Button>
                  </div>
                  {models.length === 0 && !modelsLoading ? (
                    <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('aiOrch.emptyModels')} />
                  ) : renderModelCards()}
                </div>
              ),
            },
            {
              key: 'integration',
              label: <Space><GitBranch size={15} />{t('aiOrch.tabIntegrations')}</Space>,
              children: (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4, 16px)' }}>
                    <Space>
                      <Badge count={integrations.length} color="#0ea5e9" style={{ boxShadow: 'none' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{t('aiOrch.integrationTitle')}</span>
                      </Badge>
                      {integrationsLoading && <Spin size="small" />}
                    </Space>
                    <Space>
                      <Button icon={<Zap size={14} />} onClick={() => setEventOpen(true)}>{t('aiOrch.simulateEvent')}</Button>
                      <Button type="primary" icon={<Plus size={15} />} onClick={() => setIntegrationOpen(true)}>{t('aiOrch.newIntegration')}</Button>
                    </Space>
                  </div>
                  <DataTable
                    dataSource={integrations}
                    columns={integrationColumns}
                    rowKey="id"
                    loading={integrationsLoading}
                    pagination={{ current: integrationPage, pageSize: 8, total: integrations.length, onChange: setIntegrationPage, showSizeChanger: false, showTotal: (total) => t('aiOrch.paginationTotal', { count: total }) }}
                    locale={{ emptyText: <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('aiOrch.emptyIntegrations')} /> }}
                  scroll={{ x: 'max-content' }}
                  />
                  <div style={{ marginTop: 'var(--space-5, 20px)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3, 12px)' }}>
                      <Space>
                        <span style={{ fontWeight: 600 }}><Workflow size={14} style={{ marginRight: 6, color: '#8b5cf6' }} />{t('aiOrch.orchPipeline')}</span>
                        {orchLoading && <Spin size="small" />}
                        {orchError && <span style={{ color: 'var(--color-error-500)', fontSize: 12 }}>{orchError}</span>}
                      </Space>
                      <Button size="small" type="primary" icon={<Plus size={14} />} onClick={() => setOrchOpen(true)}>
                        {t('aiOrch.newOrch')}
                      </Button>
                    </div>
                    <DataTable
                      dataSource={orchestrations}
                      columns={orchestrationColumns}
                      rowKey="id"
                      loading={orchLoading}
                      pagination={{ current: orchPage, pageSize: 8, total: orchestrations.length, onChange: setOrchPage, showSizeChanger: false, showTotal: (total) => t('aiOrch.paginationTotal', { count: total }) }}
                      locale={{ emptyText: <EmptyState description={t('aiOrch.emptyOrch')} /> }}
                    scroll={{ x: 'max-content' }}
                    />
                  </div>
                </div>
              ),
            },
            {
              key: 'jobs',
              label: <Space><ListChecks size={15} />{t('aiOrch.tabJobs')}</Space>,
              children: (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4, 16px)' }}>
                    <Space>
                      <Badge count={jobs.length} color="#10b981" style={{ boxShadow: 'none' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{t('aiOrch.jobsAutoRefresh')}</span>
                      </Badge>
                      {jobsLoading && <Spin size="small" />}
                    </Space>
                    <Button type="primary" icon={<Play size={14} />} onClick={() => setTriggerOpen(true)}>
                      {t('aiOrch.triggerInference')}
                    </Button>
                  </div>
                  <DataTable
                    dataSource={jobs}
                    columns={jobColumns}
                    rowKey="id"
                    loading={jobsLoading}
                    pagination={{ current: jobPage, pageSize: 10, total: jobs.length, onChange: setJobPage, showSizeChanger: false, showTotal: (total) => t('aiOrch.paginationTotal', { count: total }) }}
                    locale={{ emptyText: <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('aiOrch.emptyJobs')} /> }}
                  scroll={{ x: 'max-content' }}
                  />
                </div>
              ),
            },
            {
              key: 'sr',
              label: <Space><FileText size={15} />{t('aiOrch.tabSr')}</Space>,
              children: (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4, 16px)' }}>
                    <Space>
                      <Badge count={srReports.length} color="#8b5cf6" style={{ boxShadow: 'none' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{t('aiOrch.srGenerated')}</span>
                      </Badge>
                      {srLoading && <Spin size="small" />}
                      {srError && <span style={{ color: 'var(--color-error-500)', fontSize: 12 }}>{srError}</span>}
                    </Space>
                    <Button type="primary" icon={<Plus size={15} />} onClick={() => setSrOpen(true)}>
                      {t('aiOrch.generateSr')}
                    </Button>
                  </div>
                  <DataTable
                    dataSource={srReports}
                    columns={srColumns}
                    rowKey="id"
                    loading={srLoading}
                    pagination={{ current: srPage, pageSize: 8, total: srReports.length, onChange: setSrPage, showSizeChanger: false, showTotal: (total) => t('aiOrch.paginationTotal', { count: total }) }}
                    locale={{ emptyText: <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('aiOrch.emptySr')} /> }}
                  scroll={{ x: 'max-content' }}
                  />
                </div>
              ),
            },
            {
              key: 'fusion',
              label: <Space><Layers size={15} />{t('aiOrch.tabFusion')}</Space>,
              children: (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4, 16px)' }}>
                    <Space>
                      <Badge count={fusionJobs.length} color="#0ea5e9" style={{ boxShadow: 'none' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{t('aiOrch.fusionTasks')}</span>
                      </Badge>
                      {fusionLoading && <Spin size="small" />}
                      {fusionError && <span style={{ color: 'var(--color-error-500)', fontSize: 12 }}>{fusionError}</span>}
                    </Space>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{t('aiOrch.fusionSupport')}</span>
                  </div>
                  <DataTable
                    dataSource={fusionJobs}
                    columns={fusionColumns}
                    rowKey="id"
                    loading={fusionLoading}
                    pagination={{ current: fusionPage, pageSize: 8, total: fusionJobs.length, onChange: setFusionPage, showSizeChanger: false, showTotal: (total) => t('aiOrch.paginationTotal', { count: total }) }}
                    locale={{ emptyText: <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('aiOrch.emptyFusion')} /> }}
                  scroll={{ x: 'max-content' }}
                  />
                </div>
              ),
            },
            {
              key: 'assist',
              label: <Space><Sparkles size={15} />{t('aiOrch.tabAssist')}</Space>,
              children: (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4, 16px)' }}>
                    <Space>
                      <Badge count={assistItems.length} color="#10b981" style={{ boxShadow: 'none' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{t('aiOrch.assistTemplates')}</span>
                      </Badge>
                      {assistLoading && <Spin size="small" />}
                      {assistError && <span style={{ color: 'var(--color-error-500)', fontSize: 12 }}>{assistError}</span>}
                    </Space>
                    <Button icon={<Copy size={14} />} onClick={() => {
                      const all = assistItems.map((a) => String(detailOf(a, 'suggestion') ?? '')).filter(Boolean).join('\n\n');
                      if (all) copyAssistText(all);
                    }}>
                      {t('aiOrch.copyAllSuggestions')}
                    </Button>
                  </div>
                  {assistItems.length === 0 && !assistLoading ? (
                    <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('aiOrch.emptyAssist')} />
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
                          quality: t('aiOrch.assistCatQuality'), diagnosis: t('aiOrch.assistCatDiagnosis'), followup: t('aiOrch.assistCatFollowup'), critical: t('aiOrch.assistCatCritical'), general: t('aiOrch.assistCatGeneral'),
                        };
                        return (
                          <Col xs={24} md={12} xl={8} key={a.id}>
                            <Card
                              variant="borderless"
                              style={{ borderRadius: 10, height: '100%' }}
                              styles={{ body: { display: 'flex', flexDirection: 'column', gap: 10, height: '100%' } }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-2, 8px)' }}>
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
                              <div style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: '22px', flex: 1 }}>
                                {suggestion}
                              </div>
                              <Button
                                size="small"
                                icon={<Copy size={13} />}
                                style={{ alignSelf: 'flex-end' }}
                                onClick={() => copyAssistText(suggestion)}
                              >
                                {t('aiOrch.copySuggestion')}
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
        title={<Space><Plus size={16} /> {t('aiOrch.modalRegisterTitle')}</Space>}
        open={registerOpen}
        onOk={() => void handleRegister()}
        onCancel={() => { setRegisterOpen(false); registerForm.resetFields(); }}
        okText={t('aiOrch.okRegister')}
        cancelText={t('aiOrch.cancel')}
        width={520}
      >
        <Form form={registerForm} layout="vertical" style={{ marginTop: 'var(--space-3, 12px)' }}>
          <Form.Item name="name" label={t('aiOrch.fldModelName')} rules={[{ required: true, message: t('aiOrch.msgModelName') }]}>
            <Input placeholder={t('aiOrch.phModelName')} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="version" label={t('aiOrch.fldVersion')} rules={[{ required: true, message: t('aiOrch.msgVersion') }]}>
                <Input placeholder={t('aiOrch.phVersion')} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="category" label={t('aiOrch.fldCategory')}>
                <Select
                  placeholder={t('aiOrch.phSelectCategory')}
                  allowClear
                  options={['检测', '分割', '分类', '筛查', '定量分析', 'NLP'].map((c) => ({ label: c, value: c }))}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="vendor" label={t('aiOrch.fldVendor')} rules={[{ required: true, message: t('aiOrch.msgVendor') }]}>
                <Input placeholder={t('aiOrch.phVendor')} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="endpoint" label={t('aiOrch.fldEndpoint')} rules={[{ required: true, type: 'url', message: t('aiOrch.msgEndpoint') }]}>
            <Input placeholder="https://ai.example.com/model/v1" />
          </Form.Item>
          <Form.Item name="description" label={t('aiOrch.fldDescription')}>
            <Input.TextArea rows={2} placeholder={t('aiOrch.phDescription')} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ===== 新建集成 Modal ===== */}
      <Modal
        title={<Space><GitBranch size={16} /> {t('aiOrch.modalIntegrationTitle')}</Space>}
        open={integrationOpen}
        onOk={() => void handleCreateIntegration()}
        onCancel={() => { setIntegrationOpen(false); integrationForm.resetFields(); }}
        okText={t('aiOrch.okCreate')}
        cancelText={t('aiOrch.cancel')}
        width={560}
      >
        <Form form={integrationForm} layout="vertical" style={{ marginTop: 'var(--space-3, 12px)' }}>
          <Form.Item name="modelId" label={t('aiOrch.fldAiModel')} rules={[{ required: true, message: t('aiOrch.msgSelectModel') }]}>
            <Select
              placeholder={t('aiOrch.phSelectRegisteredModel')}
              options={models.map((m) => ({
                label: `${m.name} v${m.version} (${m.status === 'DEPLOYED' ? '已部署' : m.status})`,
                value: m.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="name" label={t('aiOrch.fldIntegrationName')} rules={[{ required: true, message: t('aiOrch.msgIntegrationName') }]}>
            <Input placeholder={t('aiOrch.phIntegrationName')} />
          </Form.Item>
          <Form.Item name="trigger" label={t('aiOrch.fldTriggerCondition')} initialValue="ON_STUDY_COMPLETE">
            <Select options={TRIGGER_OPTIONS} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="modality" label={t('aiOrch.fldModalityOptional')}>
                <Select allowClear placeholder={t('aiOrch.phAny')} options={MODALITY_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="bodyPart" label={t('aiOrch.fldBodyPartOptional')}>
                <Input placeholder={t('aiOrch.phBodyPart')} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="targetWorkflow" label={t('aiOrch.fldTargetWorkflow')} rules={[{ required: true, message: t('aiOrch.msgTargetWorkflow') }]}>
            <Select
              showSearch
              mode="tags"
              maxCount={1}
              placeholder={t('aiOrch.phWorkflowId')}
              options={WORKFLOW_OPTIONS}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* ===== 触发推理 Modal ===== */}
      <Modal
        title={<Space><Play size={16} /> {t('aiOrch.modalTriggerTitle')}</Space>}
        open={triggerOpen}
        onOk={() => void handleTriggerJob()}
        onCancel={() => { setTriggerOpen(false); triggerForm.resetFields(); }}
        okText={t('aiOrch.okTrigger')}
        cancelText={t('aiOrch.cancel')}
        width={480}
      >
        <Form form={triggerForm} layout="vertical" style={{ marginTop: 'var(--space-3, 12px)' }}>
          <Form.Item name="modelId" label={t('aiOrch.fldAiModelDeployed')} rules={[{ required: true, message: t('aiOrch.msgSelectModel') }]}>
            <Select
              placeholder={deployedModels.length ? t('aiOrch.phSelectDeployedModel') : t('aiOrch.phNoDeployableModel')}
              options={deployedModels.map((m) => ({
                label: `${m.name} v${m.version}`,
                value: m.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="examId" label={t('aiOrch.fldExamId')} rules={[{ required: true, message: t('aiOrch.msgExamId') }]}>
            <Input placeholder={t('aiOrch.phExamId')} />
          </Form.Item>
          <Form.Item name="trigger" label={t('aiOrch.fldTriggerType')} initialValue="MANUAL">
            <Select options={TRIGGER_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ===== 模拟事件触发 Modal ===== */}
      <Modal
        title={<Space><Zap size={16} /> {t('aiOrch.modalEventTitle')}</Space>}
        open={eventOpen}
        onOk={() => void handleTriggerEvent()}
        onCancel={() => { setEventOpen(false); eventForm.resetFields(); }}
        okText={t('aiOrch.okTriggerEvent')}
        cancelText={t('aiOrch.cancel')}
        width={480}
      >
        <Form form={eventForm} layout="vertical" style={{ marginTop: 'var(--space-3, 12px)' }}>
          <Form.Item name="trigger" label={t('aiOrch.fldEventType')} rules={[{ required: true, message: t('aiOrch.msgEventType') }]} initialValue="ON_STUDY_COMPLETE">
            <Select options={TRIGGER_OPTIONS} />
          </Form.Item>
          <Form.Item name="examId" label={t('aiOrch.fldExamId')} rules={[{ required: true, message: t('aiOrch.msgExamId') }]}>
            <Input placeholder={t('aiOrch.phExamId')} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="modality" label={t('aiOrch.fldModalityMatch')}>
                <Select allowClear placeholder={t('aiOrch.phAny')} options={MODALITY_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="bodyPart" label={t('aiOrch.fldBodyPartMatch')}>
                <Input placeholder={t('aiOrch.phBodyPart')} />
              </Form.Item>
            </Col>
          </Row>
          <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
            {t('aiOrch.eventHint')}
          </div>
        </Form>
      </Modal>

      {/* ===== [W1-D] 生成结构化报告 Modal ===== */}
      <Modal
        title={<Space><FileText size={16} /> {t('aiOrch.modalSrTitle')}</Space>}
        open={srOpen}
        onOk={() => void handleGenerateSr()}
        onCancel={() => { setSrOpen(false); srForm.resetFields(); }}
        okText={t('aiOrch.okGenerate')}
        confirmLoading={srSubmitting}
        cancelText={t('aiOrch.cancel')}
        width={520}
      >
        <Form form={srForm} layout="vertical" style={{ marginTop: 'var(--space-3, 12px)' }}>
          <Form.Item name="studyId" label={t('aiOrch.fldExamId')} rules={[{ required: true, message: t('aiOrch.msgExamId') }]}>
            <Input placeholder={t('aiOrch.phExamId5001')} />
          </Form.Item>
          <Form.Item name="templateId" label={t('aiOrch.fldReportTemplate')} rules={[{ required: true, message: t('aiOrch.msgSelectTemplate') }]}>
            <Select
              showSearch
              placeholder={t('aiOrch.phSelectSrTemplate')}
              options={[
                { label: t('aiOrch.tplChestCt'), value: 'TPL-CHEST-CT' },
                { label: t('aiOrch.tplDrFracture'), value: 'TPL-DR-FRACTURE' },
                { label: t('aiOrch.tplBrainMr'), value: 'TPL-BRAIN-MR' },
                { label: t('aiOrch.tplMgScreen'), value: 'TPL-MG-SCREEN' },
              ]}
            />
          </Form.Item>
          <Form.Item name="findings" label={t('aiOrch.fldFindingsMulti')}>
            <Select
              mode="tags"
              open={false}
              placeholder={t('aiOrch.phFindingsInput')}
              tokenSeparators={[',', '；']}
            />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="modality" label={t('aiOrch.fldModalityContext')}>
                <Select allowClear placeholder={t('aiOrch.phOptional')} options={MODALITY_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="priority" label={t('aiOrch.fldPriorityContext')}>
                <Select allowClear placeholder={t('aiOrch.phOptional')} options={[
                  { label: t('aiOrch.priorityNormal'), value: 'NORMAL' },
                  { label: t('aiOrch.priorityHigh'), value: 'HIGH' },
                  { label: t('aiOrch.priorityCritical'), value: 'CRITICAL' },
                ]} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* ===== [W1-D] 新建 AI 编排 Modal ===== */}
      <Modal
        title={<Space><Workflow size={16} /> {t('aiOrch.modalOrchTitle')}</Space>}
        open={orchOpen}
        onOk={() => void handleCreateOrchestration()}
        onCancel={() => { setOrchOpen(false); orchForm.resetFields(); }}
        okText={t('aiOrch.okCreate')}
        confirmLoading={orchSubmitting}
        cancelText={t('aiOrch.cancel')}
        width={560}
      >
        <Form form={orchForm} layout="vertical" style={{ marginTop: 'var(--space-3, 12px)' }}>
          <Form.Item name="workflowName" label={t('aiOrch.fldOrchName')} rules={[{ required: true, message: t('aiOrch.msgOrchName') }]}>
            <Input placeholder={t('aiOrch.phOrchName')} />
          </Form.Item>
          <Form.Item name="trigger" label={t('aiOrch.fldTriggerType')} initialValue="ON_STUDY_COMPLETE">
            <Select options={TRIGGER_OPTIONS} />
          </Form.Item>
          <Form.Item label={t('aiOrch.fldExecSteps')} required>
            <Form.List name="steps" initialValue={[{ action: 'ai_detection', target: 'MOD-001' }, { action: 'report_draft', target: 'TPL-CHEST-CT' }]}>
              {(fields, { add, remove }) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2, 8px)' }}>
                  {fields.map(({ key, name, ...restField }) => (
                    <Space key={key} align="baseline" style={{ display: 'flex' }}>
                      <span style={{ width: 20, color: 'var(--text-secondary)', fontSize: 12 }}>{name + 1}</span>
                      <Form.Item {...restField} name={[name, 'action']} rules={[{ required: true, message: t('aiOrch.msgStepAction') }]} style={{ marginBottom: 0, width: 180 }}>
                        <Input placeholder={t('aiOrch.phStepAction')} />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'target']} style={{ marginBottom: 0, width: 200 }}>
                        <Input placeholder={t('aiOrch.phStepTarget')} />
                      </Form.Item>
                      <Button type="text" danger size="small" icon={<XCircle size={13} />} onClick={() => remove(name)} />
                    </Space>
                  ))}
                  <Button type="dashed" size="small" icon={<Plus size={13} />} onClick={() => add({ action: '', target: '' })}>
                    {t('aiOrch.addStep')}
                  </Button>
                </div>
              )}
            </Form.List>
          </Form.Item>
          <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
            {t('aiOrch.stepExamples')}
          </div>
        </Form>
      </Modal>

      {/* ===== 测试结果 Popover ===== */}
      <Modal
        title={<Space><FlaskConical size={16} /> {t('aiOrch.testTitle')}</Space>}
        open={!!testResult}
        onCancel={() => setTestResult(null)}
        footer={<Button onClick={() => setTestResult(null)}>{t('aiOrch.close')}</Button>}
        width={440}
      >
        {testResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-3, 12px)', padding: 'var(--space-3, 12px)', borderRadius: 8,
              background: testResult.reachable ? '#f6ffed' : '#fff1f0',
            }}>
              {testResult.reachable ? <CheckCircle size={28} color="#52c41a" /> : <XCircle size={28} color="#ff4d4f" />}
              <div>
                <div style={{ fontWeight: 600, color: testResult.reachable ? '#389e0d' : '#cf1322' }}>
                  {testResult.reachable ? t('aiOrch.reachable') : t('aiOrch.unreachable')}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{testResult.message}</div>
              </div>
            </div>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label={t('aiOrch.labelLatency')}>{testResult.latencyMs}ms</Descriptions.Item>
              <Descriptions.Item label={t('aiOrch.labelTimeout')}>{testResult.timeoutMs}ms</Descriptions.Item>
              <Descriptions.Item label={t('aiOrch.labelEndpoint')} span={2}>
                <span style={{ wordBreak: 'break-all' }}>{testResult.endpoint ?? '--'}</span>
              </Descriptions.Item>
              <Descriptions.Item label={t('aiOrch.labelTestedAt')} span={2}>{testResult.testedAt.replace('T', ' ').slice(0, 19)}</Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Modal>

      {/* ===== 任务详情 Drawer + 二次检出查看器 ===== */}
      <Drawer
        title={<Space><Box size={17} /> {t('aiOrch.drawerTitle')} - {drawerJob?.id}</Space>}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        size="large"
        extra={
          drawerJob?.status === 'COMPLETED' && drawerFindings.length > 0 ? (
            <Tag color="volcano" icon={<ScanSearch size={13} />}>{t('aiOrch.reviewBadge')}</Tag>
          ) : null
        }
      >
        {drawerJob && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4, 16px)' }}>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label={t('aiOrch.labelModel')} span={2}>
                {drawerJob.model ? (
                  <Space size={4}>
                    <span style={{ fontWeight: 600 }}>{drawerJob.model.name}</span>
                    <Tag style={{ fontSize: 11 }}>v{drawerJob.model.version}</Tag>
                    <Tag color="blue" style={{ fontSize: 11 }}>{drawerJob.model.vendor}</Tag>
                  </Space>
                ) : drawerJob.modelId}
              </Descriptions.Item>
              <Descriptions.Item label={t('aiOrch.labelExamNo')}>{drawerJob.examId ?? '--'}</Descriptions.Item>
              <Descriptions.Item label={t('aiOrch.labelTriggerType')}>
                <Tag color="purple" style={{ fontSize: 11 }}>{drawerJob.trigger}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('aiOrch.labelStatus')}>
                <Tag icon={JOB_STATUS_META[drawerJob.status]?.icon} color={JOB_STATUS_META[drawerJob.status]?.color}>
                  {JOB_STATUS_META[drawerJob.status]?.label ?? drawerJob.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('aiOrch.labelDuration')}>
                {drawerJob.startedAt
                  ? formatDuration((drawerJob.completedAt ? Date.parse(drawerJob.completedAt) : Date.now()) - Date.parse(drawerJob.startedAt))
                  : '--'}
              </Descriptions.Item>
              <Descriptions.Item label={t('aiOrch.labelCreatedAt')} span={2}>
                {drawerJob.createdAt.replace('T', ' ').slice(0, 19)}
              </Descriptions.Item>
              {drawerJob.error && (
                <Descriptions.Item label={t('aiOrch.labelError')} span={2}>
                  <span style={{ color: 'var(--color-error-500)' }}>{drawerJob.error}</span>
                </Descriptions.Item>
              )}
            </Descriptions>

            {drawerJob.status === 'RUNNING' && (
              <div style={{ padding: 'var(--space-4, 16px)', borderRadius: 8, background: 'var(--color-info-bg)', textAlign: 'center' }}>
                <Spin />
                <div style={{ marginTop: 'var(--space-2, 8px)', color: '#597ef7', fontSize: 12 }}>{t('aiOrch.runningHint')}</div>
              </div>
            )}

            {drawerJob.status === 'COMPLETED' && drawerJob.result && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    <Space><ScanSearch size={16} color="#8b5cf6" /> {t('aiOrch.reviewResultTitle')}</Space>
                  </div>
                  <Space>
                    {drawerJob.result.structured?.priority === 'HIGH' && <Tag color="volcano">{t('aiOrch.highPriority')}</Tag>}
                    <Tag color="green">{drawerJob.result.summary}</Tag>
                    {/* [G005 Wave4A] G-14 AI 结果 → DICOM SR 封装 */}
                    {drawerFindings.length > 0 && (
                      <Button
                        size="small"
                        type="primary"
                        icon={<FileText size={13} />}
                        loading={encapsulating === drawerJob.examId}
                        onClick={() => void handleEncapsulateSr(drawerJob.examId ?? '', drawerFindings, drawerJob.result?.summary ?? undefined)}
                      >
                        {t('aiOrch.encapsulateSr')}
                      </Button>
                    )}
                  </Space>
                </div>

                {drawerFindings.length > 0 ? (
                  <>
                    <FindingViewer
                      findings={drawerFindings}
                      activeIndex={activeFinding}
                      onSelect={setActiveFinding}
                    />
                    <div style={{ fontWeight: 600, marginBottom: 'var(--space-1, 4px)' }}>{t('aiOrch.abnormalListTitle')}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2, 8px)' }}>
                      {drawerFindings.map((f, i) => {
                        const active = i === activeFinding;
                        return (
                          <div
                            key={`${f.label}-${i}`}
                            onClick={() => setActiveFinding(active ? null : i)}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                              border: active ? '1.5px solid var(--color-error-500)' : '1px solid #e5e7eb',
                              background: active ? '#fff1f0' : '#fafafa',
                            }}
                          >
                            <Space>
                              <span style={{
                                width: 10, height: 10, borderRadius: 3,
                                background: active ? 'var(--color-error-500)' : 'var(--color-warning-500)', display: 'inline-block',
                              }} />
                              <span style={{ fontWeight: active ? 700 : 500 }}>{f.label}</span>
                              <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                                {t('aiOrch.coordinates', { x: Math.round(f.x * 100), y: Math.round(f.y * 100) })}
                              </span>
                            </Space>
                            <Tag color={f.confidence >= 0.9 ? 'red' : 'orange'} style={{ fontSize: 11 }}>
                              {(f.confidence * 100).toFixed(0)}%
                            </Tag>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                      {t('aiOrch.abnormalListHint')}
                    </div>
                  </>
                ) : (
                  <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('aiOrch.noAbnormal')} />
                )}
              </>
            )}

            {drawerJob.status === 'QUEUED' && (
              <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('aiOrch.queuedHint')} />
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
