import { useState, useCallback, useEffect } from "react";
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragEndEvent,
} from "@dnd-kit/core";
import { Layers, Save, Play, List, History, GripVertical, Plus, CheckCircle2, X, Clock, GitBranch, Zap, Settings, Trash2 } from 'lucide-react';
import { Table, Button, Tag, message, Modal, Input, Select, Card, Statistic, Row, Col, Tabs, Tooltip, Badge, Popconfirm, Space, Switch, InputNumber } from 'antd';
import type { ColumnsType } from "antd/es/table";
import { useTranslation } from "react-i18next";
import { t as appT } from '../../i18n/appI18n';
import { orchestratorApi, type OrchestratorFlow, type FlowExecution, type FlowStepDefinition, type SlaConfigDto, type SlaStats } from '../../services/api/orchestratorApi';
import { usePagination } from '../../hooks/usePagination';

type StepTypeColor = { key: string; color: string };

const STEP_TYPES: StepTypeColor[] = [
  { key: "write", color: "#22c55e" },
  { key: "review", color: "#3b82f6" },
  { key: "cosign", color: "#f59e0b" },
  { key: "qc", color: "#ef4444" },
  { key: "notify", color: "#8b5cf6" },
  { key: "auto", color: "#06b6d4" },
];

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#9ca3af",
  RUNNING: "#3b82f6",
  COMPLETED: "#22c55e",
  FAILED: "#ef4444",
  TIMEOUT: "#f59e0b",
  SKIPPED: "#8b5cf6",
};

function PaletteItem({ type }: { type: string; label: string }) {
  const t = useTranslation("orchestrator").t;
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `palette-${type}`,
      data: { type },
    });
  const color = STEP_TYPES.find((s) => s.key === type)?.color ?? "#6b7280";
  const style: React.CSSProperties = {
    padding: "8px 12px",
    marginBottom: 6,
    borderRadius: 6,
    border: `1px solid ${color}40`,
    background: isDragging ? `${color}20` : "#fff",
    cursor: "grab",
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    color,
    fontWeight: 500,
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    opacity: isDragging ? 0.6 : 1,
    boxShadow: isDragging ? "0 4px 12px rgba(0,0,0,0.15)" : "none",
  };
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <GripVertical size={14} />
      {t(`stepTypes.${type}`)}
    </div>
  );
}

function CanvasStep({
  step,
  index,
  onEdit,
  onDelete,
}: {
  step: FlowStepDefinition;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `canvas-${index}` });
  const color =
    STEP_TYPES.find((s) => s.key === step.stepType)?.color ?? "#6b7280";
  return (
    <div
      ref={setNodeRef}
      style={{
        padding: "10px 14px",
        marginBottom: 8,
        borderRadius: 8,
        border: `2px solid ${isOver ? color : `${color}30`}`,
        background: isOver ? `${color}10` : "#fafafa",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        transition: "border-color 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Badge
          count={index + 1}
          style={{ backgroundColor: color, fontSize: 11 }}
        />
        <div>
          <strong style={{ fontSize: 14 }}>{step.name}</strong>
          <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
            <Tag color={color} style={{ fontSize: 11 }}>
              {step.stepType}
            </Tag>
            {step.slaMinutes && (
              <Tag icon={<Clock size={12} />} color="orange">
                {step.slaMinutes}m SLA
              </Tag>
            )}
            {step.autoDispatch && (
              <Tag icon={<Zap size={12} />} color="cyan">
                Auto
              </Tag>
            )}
            {step.assigneeRole && <Tag>{step.assigneeRole}</Tag>}
          </div>
        </div>
      </div>
      <Space>
        <Tooltip title={appT("orchestratorPage.edit")}>
          <Button
            type="text"
            size="small"
            icon={<Settings size={14} />}
            onClick={onEdit}
          />
        </Tooltip>
        <Popconfirm title={appT("orchestratorPage.confirmDeleteFlow")} onConfirm={onDelete}>
          <Button type="text" size="small" danger icon={<Trash2 size={14} />} />
        </Popconfirm>
      </Space>
    </div>
  );
}

export default function OrchestratorPage() {
  const { t } = useTranslation("orchestrator");
  const [activeTab, setActiveTab] = useState("designer");
  const [flows, setFlows] = useState<OrchestratorFlow[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<OrchestratorFlow | null>(
    null,
  );
  const [flowName, setFlowName] = useState("");
  const [flowDesc, setFlowDesc] = useState("");
  const [steps, setSteps] = useState<FlowStepDefinition[]>([]);
  const [editingStep, setEditingStep] = useState<{ index: number } | null>(
    null,
  );
  const [modalVisible, setModalVisible] = useState(false);
  const [stepForm, setStepForm] = useState<FlowStepDefinition>({
    name: "",
    stepType: "review",
  });
  const [executions, setExecutions] = useState<{
    items: FlowExecution[];
    total: number;
  }>({ items: [], total: 0 });
  const [execPage, setExecPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [slaModalVisible, setSlaModalVisible] = useState(false);
  const [slaForm, setSlaForm] = useState<SlaConfigDto>({
    name: "",
    targetMinutes: 30,
    warningMinutes: 20,
  });
  const [slaConfigs, setSlaConfigs] = useState<SlaConfigDto[]>([]);
  const [slaStats, setSlaStats] = useState<SlaStats | null>(null);
  // [v3.0.6.11-95] W4-B P2: 受控分页 (SLA 配置表)
  const slaPagination = usePagination(slaConfigs, 10);

  const loadFlows = useCallback(async () => {
    setLoading(true);
    try {
      const data = await orchestratorApi.getFlows();
      setFlows(data);
    } catch (err) {
      console.warn("[Orchestrator] loadFlows failed", err);
    }
    setLoading(false);
  }, []);

  const loadExecutions = useCallback(async (page: number) => {
    try {
      const data = await orchestratorApi.getExecutions(page, 20);
      setExecutions(data);
    } catch (err) {
      console.warn("[Orchestrator] loadExecutions failed", err);
    }
  }, []);

  const loadSlaStats = useCallback(async () => {
    try {
      const data = await orchestratorApi.getSlaStats();
      setSlaStats(data);
    } catch (err) {
      console.warn("[Orchestrator] loadSlaStats failed", err);
    }
  }, []);

  const loadSlaConfigs = useCallback(async () => {
    try {
      const data = await orchestratorApi.getSlaConfigs();
      setSlaConfigs(data);
    } catch (err) {
      console.warn("[Orchestrator] loadSlaConfigs failed", err);
    }
  }, []);

  useEffect(() => {
    loadFlows();
    loadExecutions(1);
    loadSlaStats();
    loadSlaConfigs();
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!event.over) return;
      const overId = String(event.over.id);
      if (!overId.startsWith("canvas-")) return;
      const typeData = event.active.data.current;
      if (!typeData) return;
      const newStep: FlowStepDefinition = {
        name: t(`stepTypes.${typeData.type as string}`),
        stepType: typeData.type as string,
        autoDispatch: false,
      };
      setSteps((prev) => [...prev, newStep]);
    },
    [t],
  );

  const handleSaveFlow = async () => {
    if (!flowName.trim()) {
      message.warning(t("flowName"));
      return;
    }
    if (steps.length === 0) {
      message.warning(t("addStep"));
      return;
    }
    setSaving(true);
    try {
      if (selectedFlow) {
        await orchestratorApi.createFlow({
          name: flowName,
          description: flowDesc,
          steps,
        });
        message.success(t("saveSuccess"));
      } else {
        await orchestratorApi.createFlow({
          name: flowName,
          description: flowDesc,
          steps,
        });
        message.success(t("saveSuccess"));
      }
      loadFlows();
    } catch {
      message.error(appT("orchestratorPage.saveFailed"));
    }
    setSaving(false);
  };

  const handleTriggerFlow = async (flowId: string) => {
    try {
      await orchestratorApi.triggerFlow(flowId);
      message.success(t("triggerSuccess"));
      loadExecutions(1);
      loadSlaStats();
    } catch {
      message.error(appT("orchestratorPage.triggerFailed"));
    }
  };

  const handleNextStep = async (executionId: string) => {
    try {
      await orchestratorApi.triggerNextStep(executionId);
      message.success(appT("orchestratorPage.nextStepTriggered"));
      loadExecutions(execPage);
    } catch {
      message.error(appT("orchestratorPage.nextStepFailed"));
    }
  };

  const handleRerunFlow = async (execution: FlowExecution) => {
    if (!execution.flowId) return;
    try {
      await orchestratorApi.triggerFlow(execution.flowId, {
        rerunOf: execution.id,
        reason: `rerun after ${execution.status}`,
      });
      message.success(appT("orchestratorPage.flowRerun"));
      loadExecutions(execPage);
      loadSlaStats();
    } catch {
      message.error(appT("orchestratorPage.rerunFailed"));
    }
  };

  const handleSaveSla = async () => {
    try {
      await orchestratorApi.upsertSla(slaForm);
      message.success(t("slaSaved"));
      setSlaModalVisible(false);
      loadSlaConfigs();
    } catch {
      message.error(appT("orchestratorPage.slaSaveFailed"));
    }
  };

  const selectFlow = async (flow: OrchestratorFlow) => {
    setSelectedFlow(flow);
    setFlowName(flow.name);
    setFlowDesc(flow.description);
    setSteps(flow.steps as FlowStepDefinition[]);
    setActiveTab("designer");
  };

  const executionColumns: ColumnsType<FlowExecution> = [
    {
      title: t("executionId"),
      dataIndex: "id",
      key: "id",
      width: 120,
      render: (id: string) => (
        <span style={{ fontFamily: "monospace", fontSize: 12 }}>
          {id.slice(0, 8)}...
        </span>
      ),
    },
    {
      title: t("flowName"),
      key: "flow",
      render: (_, r) => r.flow?.name ?? "-",
    },
    {
      title: t("executionStatus"),
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (s: string) => (
        <Tag color={STATUS_COLORS[s]}>
          {t(`flowStatus_${s.toLowerCase()}`)}
        </Tag>
      ),
    },
    {
      title: t("slaMinutes"),
      key: "sla",
      width: 100,
      render: (_, r) =>
        r.slaBreached ? (
          <Tag color="red">{appT("orchestratorPage.slaBreached")}</Tag>
        ) : r.slaDeadline ? (
          <Tag color="green">{appT("orchestratorPage.onTrack")}</Tag>
        ) : (
          "-"
        ),
    },
    {
      title: t("executionTime"),
      dataIndex: "createdAt",
      key: "createdAt",
      width: 170,
      render: (d: string) => new Date(d).toLocaleString(),
    },
    {
      title: appT("orchestratorPage.steps"),
      key: "steps",
      render: (_, r) => (
        <Space size={4} wrap>
          {r.stepExecutions.map((se) => (
            <Tooltip key={se.id} title={`${se.stepName}: ${se.status}`}>
              <Tag
                color={STATUS_COLORS[se.status]}
                style={{ fontSize: 11, cursor: "pointer" }}
              >
                {se.stepName}
              </Tag>
            </Tooltip>
          ))}
        </Space>
      ),
    },
    {
      title: appT("orchestratorPage.actions"),
      key: "action",
      width: 130,
      render: (_, r) => {
        if (r.status === "RUNNING")
          return (
            <Button size="small" onClick={() => handleNextStep(r.id)}>
              {t("triggerNext")}
            </Button>
          );
        // 已完成/失败/超时:重新触发执行(等价于重新部署激活流程)
        return (
          <Button size="small" onClick={() => handleRerunFlow(r)}>
            {appT("orchestratorPage.rerun")}
          </Button>
        );
      },
    },
  ];

  const slaConfigColumns: ColumnsType<SlaConfigDto> = [
    { title: t("slaName"), dataIndex: "name", key: "name" },
    {
      title: t("slaTargetMinutes"),
      dataIndex: "targetMinutes",
      key: "targetMinutes",
      render: (v) => `${v}m`,
    },
    {
      title: t("slaWarningMinutes"),
      dataIndex: "warningMinutes",
      key: "warningMinutes",
      render: (v) => `${v}m`,
    },
    {
      title: t("slaAutoEscalate"),
      dataIndex: "autoEscalate",
      key: "autoEscalate",
      render: (v) =>
        v ? (
          <CheckCircle2 size={16} color="green" />
        ) : (
          <X size={16} color="red" />
        ),
    },
    {
      title: t("slaEscalateRole"),
      dataIndex: "escalateRole",
      key: "escalateRole",
      render: (v) => v ?? "-",
    },
  ];

  const renderDesigner = () => (
    <div style={{ display: "flex", gap: 16, height: "calc(100vh - 280px)" }}>
      <div style={{ width: 200, flexShrink: 0 }}>
        <Card
          size="small"
          title={t("steps")}
          styles={{ body: { padding: 12 } }}
        >
          {STEP_TYPES.map((st) => (
            <PaletteItem
              key={st.key}
              type={st.key}
              label={t(`stepTypes.${st.key}`)}
            />
          ))}
        </Card>
      </div>
      <div
        style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}
      >
        <Card size="small" styles={{ body: { padding: 16 } }}>
          <Space orientation="vertical" style={{ width: "100%" }}>
            <Input
              placeholder={t("flowName")}
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              style={{ fontWeight: 600 }}
            />
            <Input
              placeholder={t("flowDescription")}
              value={flowDesc}
              onChange={(e) => setFlowDesc(e.target.value)}
            />
          </Space>
        </Card>
        <Card
          size="small"
          title={
            <Space>
              <Layers size={16} /> {t("designer")}{" "}
              <Badge
                count={steps.length}
                style={{ backgroundColor: "#3b82f6" }}
              />
            </Space>
          }
          styles={{ body: { padding: 12, minHeight: 200 } }}
          extra={
            <Space>
              <Button
                type="primary"
                icon={<Save size={14} />}
                onClick={handleSaveFlow}
                loading={saving}
              >
                {t("saveFlow")}
              </Button>
            </Space>
          }
        >
          <DndContext onDragEnd={handleDragEnd}>
            {steps.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#999" }}>
                <Layers size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                <div>{t("noFlows")}</div>
              </div>
            ) : (
              steps.map((step, idx) => (
                <CanvasStep
                  key={idx}
                  step={step}
                  index={idx}
                  onEdit={() => {
                    setStepForm(step);
                    setEditingStep({ index: idx });
                    setModalVisible(true);
                  }}
                  onDelete={() => {
                    setSteps((prev) => prev.filter((_, i) => i !== idx));
                  }}
                />
              ))
            )}
          </DndContext>
        </Card>
      </div>
      <div style={{ width: 260, flexShrink: 0 }}>
        <Card
          size="small"
          title={t("slaConfig")}
          styles={{ body: { padding: 12 } }}
        >
          <Space orientation="vertical" style={{ width: "100%" }}>
            {slaConfigs.map((sc) => (
              <div
                key={sc.id}
                style={{
                  padding: "6px 8px",
                  background: "#f5f5f5",
                  borderRadius: 4,
                  fontSize: 12,
                }}
              >
                <strong>{sc.name}</strong>
                <div>
                  {sc.targetMinutes}m target, {sc.warningMinutes}m warning
                </div>
              </div>
            ))}
            <Button
              size="small"
              icon={<Plus size={12} />}
              onClick={() => {
                setSlaForm({ name: "", targetMinutes: 30, warningMinutes: 20 });
                setSlaModalVisible(true);
              }}
            >
              {t("slaConfig")}
            </Button>
          </Space>
        </Card>
        {slaStats && (
          <Card
            size="small"
            title={t("slaStats")}
            style={{ marginTop: 8 }}
            styles={{ body: { padding: 12 } }}
          >
            <Statistic
              title={t("slaComplianceRate")}
              value={slaStats.slaComplianceRate}
              suffix="%"
              styles={{ content: { 
                color: slaStats.slaComplianceRate >= 90 ? "#22c55e" : "#f59e0b",
               } }}
            />
            <Statistic
              title={t("avgCompletionMin")}
              value={slaStats.avgCompletionMin.toFixed(1)}
              suffix="min"
              style={{ marginTop: 8 }}
            />
          </Card>
        )}
      </div>
    </div>
  );

  const renderStepEditModal = () => (
    <Modal
      title={t("editFlow")}
      open={modalVisible}
      onCancel={() => setModalVisible(false)}
      onOk={() => {
        if (editingStep) {
          setSteps((prev) =>
            prev.map((s, i) => (i === editingStep.index ? stepForm : s)),
          );
        } else {
          setSteps((prev) => [...prev, stepForm]);
        }
        setModalVisible(false);
      }}
    >
      <Space orientation="vertical" style={{ width: "100%" }}>
        <div>
          <div style={{ marginBottom: 4, fontWeight: 500, fontSize: 13 }}>
            {t("stepName")}
          </div>
          <Input
            value={stepForm.name}
            onChange={(e) =>
              setStepForm((p) => ({ ...p, name: e.target.value }))
            }
          />
        </div>
        <div>
          <div style={{ marginBottom: 4, fontWeight: 500, fontSize: 13 }}>
            {t("stepType")}
          </div>
          <Select
            style={{ width: "100%" }}
            value={stepForm.stepType}
            onChange={(v) => setStepForm((p) => ({ ...p, stepType: v }))}
            options={STEP_TYPES.map((st) => ({
              value: st.key,
              label: t(`stepTypes.${st.key}`),
            }))}
          />
        </div>
        <div>
          <div style={{ marginBottom: 4, fontWeight: 500, fontSize: 13 }}>
            {t("assigneeRole")}
          </div>
          <Input
            value={stepForm.assigneeRole ?? ""}
            onChange={(e) =>
              setStepForm((p) => ({ ...p, assigneeRole: e.target.value }))
            }
            placeholder={appT("orchestratorPage.rolePlaceholder")}
          />
        </div>
        <Row gutter={12}>
          <Col span={12}>
            <div style={{ marginBottom: 4, fontWeight: 500, fontSize: 13 }}>
              {t("timeoutMinutes")}
            </div>
            <InputNumber
              style={{ width: "100%" }}
              value={stepForm.timeoutMinutes}
              onChange={(v) =>
                setStepForm((p) => ({ ...p, timeoutMinutes: v ?? undefined }))
              }
              min={1}
            />
          </Col>
          <Col span={12}>
            <div style={{ marginBottom: 4, fontWeight: 500, fontSize: 13 }}>
              {t("slaMinutes")}
            </div>
            <InputNumber
              style={{ width: "100%" }}
              value={stepForm.slaMinutes}
              onChange={(v) =>
                setStepForm((p) => ({ ...p, slaMinutes: v ?? undefined }))
              }
              min={1}
            />
          </Col>
        </Row>
        <div>
          <div style={{ marginBottom: 4, fontWeight: 500, fontSize: 13 }}>
            {t("condition")}
          </div>
          <Input
            value={stepForm.condition ?? ""}
            onChange={(e) =>
              setStepForm((p) => ({ ...p, condition: e.target.value }))
            }
            placeholder="例如: ${priority} == 'URGENT'"
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Switch
            checked={stepForm.autoDispatch}
            onChange={(v) => setStepForm((p) => ({ ...p, autoDispatch: v }))}
          />
          <span style={{ fontSize: 13 }}>{t("autoDispatch")}</span>
        </div>
      </Space>
    </Modal>
  );

  const renderSlaModal = () => (
    <Modal
      title={t("slaConfig")}
      open={slaModalVisible}
      onCancel={() => setSlaModalVisible(false)}
      onOk={handleSaveSla}
    >
      <Space orientation="vertical" style={{ width: "100%" }}>
        <div>
          <div style={{ marginBottom: 4, fontWeight: 500, fontSize: 13 }}>
            {t("slaName")}
          </div>
          <Input
            value={slaForm.name}
            onChange={(e) =>
              setSlaForm((p) => ({ ...p, name: e.target.value }))
            }
          />
        </div>
        <Row gutter={12}>
          <Col span={12}>
            <div style={{ marginBottom: 4, fontWeight: 500, fontSize: 13 }}>
              {t("slaTargetMinutes")}
            </div>
            <InputNumber
              style={{ width: "100%" }}
              value={slaForm.targetMinutes}
              onChange={(v) =>
                setSlaForm((p) => ({ ...p, targetMinutes: v ?? 30 }))
              }
              min={1}
            />
          </Col>
          <Col span={12}>
            <div style={{ marginBottom: 4, fontWeight: 500, fontSize: 13 }}>
              {t("slaWarningMinutes")}
            </div>
            <InputNumber
              style={{ width: "100%" }}
              value={slaForm.warningMinutes}
              onChange={(v) =>
                setSlaForm((p) => ({ ...p, warningMinutes: v ?? 20 }))
              }
              min={1}
            />
          </Col>
        </Row>
        <div>
          <div style={{ marginBottom: 4, fontWeight: 500, fontSize: 13 }}>
            {t("slaEscalateRole")}
          </div>
          <Input
            value={slaForm.escalateRole ?? ""}
            onChange={(e) =>
              setSlaForm((p) => ({ ...p, escalateRole: e.target.value }))
            }
            placeholder={appT("orchestratorPage.escalateRolePlaceholder")}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Switch
            checked={slaForm.autoEscalate}
            onChange={(v) => setSlaForm((p) => ({ ...p, autoEscalate: v }))}
          />
          <span style={{ fontSize: 13 }}>
            {t("slaAutoEscalate")}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Switch
            checked={slaForm.notifyOnBreach ?? true}
            onChange={(v) => setSlaForm((p) => ({ ...p, notifyOnBreach: v }))}
          />
          <span style={{ fontSize: 13 }}>
            {t("slaNotifyOnBreach")}
          </span>
        </div>
      </Space>
    </Modal>
  );

  const renderExecutions = () => (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title={t("totalExecutions")}
              value={slaStats?.totalExecutions ?? 0}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title={t("slaComplianceRate")}
              value={slaStats?.slaComplianceRate ?? 100}
              suffix="%"
              styles={{ content: { 
                color:
                  (slaStats?.slaComplianceRate ?? 100) >= 90
                    ? "#22c55e"
                    : "#f59e0b",
               } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title={t("avgCompletionMin")}
              value={slaStats?.avgCompletionMin != null ? slaStats.avgCompletionMin.toFixed(1) : "-"}
              suffix="min"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title={t("breachedExecutions")}
              value={slaStats?.breachedExecutions ?? 0}
              styles={{ content: { 
                color:
                  (slaStats?.breachedExecutions ?? 0) > 0
                    ? "#ef4444"
                    : undefined,
               } }}
            />
          </Card>
        </Col>
      </Row>
      <Card
        size="small"
        title={t("executions")}
        styles={{ body: { padding: 0 } }}
      >
        <Table
          dataSource={executions.items}
          columns={executionColumns}
          rowKey="id"
          loading={loading}
          pagination={{
            current: execPage,
            total: executions.total,
            pageSize: 10,
            onChange: (p) => {
              setExecPage(p);
              loadExecutions(p);
            },
          }}
          size="small"
        scroll={{ x: 'max-content' }}
        />
      </Card>
      <Card
        size="small"
        title={t("executionHistory")}
        style={{ marginTop: 16 }}
        styles={{ body: { padding: 0 } }}
      >
        <Table
          dataSource={slaPagination.pageData}
          columns={slaConfigColumns}
          rowKey={(r) => r.id ?? ""}
          pagination={slaPagination.pagination}
          size="small"
        scroll={{ x: 'max-content' }}
        />
      </Card>
    </div>
  );

  const renderFlowsList = () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 12,
      }}
    >
      {flows.map((flow) => (
        <Card
          key={flow.id}
          hoverable
          size="small"
          title={
            <Space>
              <GitBranch size={14} /> {flow.name}
            </Space>
          }
          extra={<Badge count={flow._count?.executions ?? 0} showZero />}
          actions={[
            <Tooltip title={t("triggerFlow")}>
              <Button
                type="text"
                icon={<Play size={14} />}
                onClick={() => handleTriggerFlow(flow.id)}
              />
            </Tooltip>,
            <Tooltip title={appT("orchestratorPage.view")}>
              <Button
                type="text"
                icon={<List size={14} />}
                onClick={() => selectFlow(flow)}
              />
            </Tooltip>,
          ]}
        >
          <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
            {flow.description || t("flowDescription")}
          </div>
          <Space size={4} wrap>
            {(flow.steps as FlowStepDefinition[]).map((s, i) => (
              <Tag
                key={i}
                color={STEP_TYPES.find((st) => st.key === s.stepType)?.color}
                style={{ fontSize: 11 }}
              >
                {s.name}
              </Tag>
            ))}
          </Space>
          <div style={{ marginTop: 8, fontSize: 11, color: "#999" }}>
            v{flow.version} · {new Date(flow.updatedAt).toLocaleDateString()}
          </div>
        </Card>
      ))}
    </div>
  );

  const tabItems = [
    {
      key: "designer",
      label: (
        <Space>
          <Layers size={14} /> {t("designer")}
        </Space>
      ),
      children: (
        <>
          {renderDesigner()}
          {renderStepEditModal()}
          {renderSlaModal()}
        </>
      ),
    },
    {
      key: "flows",
      label: (
        <Space>
          <List size={14} /> {t("executions")}
        </Space>
      ),
      children: renderFlowsList(),
    },
    {
      key: "executions",
      label: (
        <Space>
          <History size={14} /> {t("executionHistory")}
        </Space>
      ),
      children: renderExecutions(),
    },
  ];

  return (
    <div
      style={{
        padding: 16,
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <h2
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <GitBranch size={20} /> {t("title")}
          <span
            style={{
              fontSize: 13,
              fontWeight: 400,
              color: "#666",
              marginLeft: 8,
            }}
          >
            {t("subtitle")}
          </span>
        </h2>
      </div>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        style={{ flex: 1 }}
      />
    </div>
  );
}
