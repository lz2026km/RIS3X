// [v3.0.6.8-92] Phase 2: 隐形矫治模拟
// 对标: Planmeca Align + 3Shape Trios Ortho + Invisalign
// [G005 Wave1B] 5 处裸 fetch → dentalApi (后端 /dental/ortho/aligner-plans* 真实实现)
import React, { useState, useEffect, useRef } from "react";
import { dentalApi } from "../../services/api/dentalApi";
import { ErrorBanner } from "../../components/feedback";
import { t } from "../../i18n/appI18n";
import { StatCard, StatCardGrid, PageContainer } from "../../components/common";
import {
  Card,
  Space,
  Tag,
  Button,
  Row,
  Col,
  Statistic,
  message,
  Badge,
  Progress,
  Steps,
  Slider,
  Modal,
  Form,
  Input,
  InputNumber,
} from "antd";
import {
  Activity,
  Eye,
  Save,
  CheckCircle2,
  RotateCcw,
  BarChart3,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Layers,
  Box,
  Plus,
} from "lucide-react";

export const DentalAlignerPage: React.FC = () => {
  const [plans, setPlans] = useState<any[]>([]);
  const [current, setCurrent] = useState<any>(null);
  const [stages, setStages] = useState<any[]>([]);
  const [progress, setProgress] = useState<any>(null);
  const [currentStage, setCurrentStage] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<"list" | "detail">("list");
  const animationRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    setLoadError(null);
    dentalApi
      .listAlignerPlans()
      .then((d) => {
        if (d.success) setPlans(d.data || []);
        else setLoadError(t("w9.states.error"));
      })
      .catch((err) => {
        console.error("[F04]", err);
        setLoadError(t("w9.states.error"));
      });
  }, [reloadTick]);

  const handleSelect = async (p: any) => {
    setCurrent(p);
    setCurrentStage(p.currentStage || 0);
    setMode("detail");
    try {
      // [G005 W3-B] 详情刷新: GET /dental/ortho/aligner-plans/:id (getAlignerPlan)
      const detail = await dentalApi.getAlignerPlan(p.id);
      if (detail.success && detail.data) setCurrent({ ...p, ...detail.data });
      const [sr, pr] = await Promise.all([
        dentalApi.getAlignerStages(p.id),
        dentalApi.getAlignerProgress(p.id),
      ]);
      if (sr.success) setStages(sr.data || []);
      if (pr.success) setProgress(pr.data);
    } catch (e) {
      console.warn("[F03] Error:", (e as Error)?.message);
    }
  };

  // [G005 W3-B] 新建矫治计划: POST /dental/ortho/aligner-plans (createAlignerPlan)
  const [createModal, setCreateModal] = useState(false);
  const [createForm] = Form.useForm();
  const [creating, setCreating] = useState(false);
  const handleCreatePlan = async () => {
    try {
      const values = await createForm.validateFields();
      setCreating(true);
      const res = await dentalApi.createAlignerPlan({
        ...values,
        status: "pending",
        currentStage: 0,
        totalStages: values.totalStages ?? 14,
        wearDaysPerStage: values.wearDaysPerStage ?? 7,
      });
      if (res.success && res.data) {
        message.success(t("dentalAligner.planCreated"));
        setCreateModal(false);
        createForm.resetFields();
        setPlans((prev) => [res.data, ...prev]);
      } else {
        message.error(res.error?.message ?? t("dentalAligner.createFailed"));
      }
    } catch {
      // 表单校验失败或取消
    } finally {
      setCreating(false);
    }
  };

  // [G005 W3-B] 生成阶段: POST /dental/ortho/aligner-plans/:id/stages (generateAlignerStages)
  const handleGenerateStages = async () => {
    if (!current) return;
    try {
      const res = await dentalApi.generateAlignerStages(current.id);
      if (res.success) {
        message.success(t("dentalAligner.stagesGenerated"));
        const sr = await dentalApi.getAlignerStages(current.id);
        if (sr.success) setStages(sr.data || []);
      } else {
        message.error(res.error?.message ?? t("dentalAligner.generateFailed"));
      }
    } catch (e) {
      console.warn("[F03] Error:", (e as Error)?.message);
    }
  };

  // [G005 W3-B] 更新进度: POST /dental/ortho/aligner-plans/:id/progress (updateAlignerProgress)
  const handleUpdateProgress = async () => {
    if (!current) return;
    try {
      const res = await dentalApi.updateAlignerProgress(current.id, {
        currentStage: currentStage + 1,
        patientCompliance: 0.9,
      });
      if (res.success) {
        message.success(t("dentalAligner.progressUpdated"));
        const pr = await dentalApi.getAlignerProgress(current.id);
        if (pr.success) setProgress(pr.data);
      } else {
        message.error(res.error?.message ?? t("dentalAligner.updateFailed"));
      }
    } catch (e) {
      console.warn("[F03] Error:", (e as Error)?.message);
    }
  };

  const stageData = stages.find((s: any) => s.stage === currentStage);
  const movements = stageData?.toothMovements || [];

  // Simple Canvas animation for tooth position visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || mode !== "detail") return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width,
      h = canvas.height;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#0a0a1a";
      ctx.fillRect(0, 0, w, h);

      // Draw arch wire
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = -60; i <= 60; i++) {
        const x = w / 2 + i;
        const y = h / 2 + Math.sin(i * 0.04) * 40;
        if (i === -60) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      // Lower arch
      ctx.beginPath();
      for (let i = -60; i <= 60; i++) {
        const x = w / 2 + i;
        const y = h / 2 + 80 + Math.sin(i * 0.04 + 0.5) * 35;
        if (i === -60) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Draw teeth as circles
      const toothPositions = [
        { x: -45, y: -15 },
        { x: -30, y: -5 },
        { x: -15, y: 0 },
        { x: 0, y: 2 },
        { x: 15, y: 0 },
        { x: 30, y: -5 },
        { x: 45, y: -15 },
      ];
      movements.forEach((m: any, i: number) => {
        if (i >= toothPositions.length) return;
        const base = toothPositions[i]!;
        const tx = base.x + m.dx * 3;
        const ty = base.y + m.dy * 3;
        const size = 12 + (i >= 4 ? 2 : 0);

        ctx.save();
        ctx.translate(w / 2 + tx, h / 2 + ty - 20);
        ctx.rotate(m.rotation * 0.01);
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fillStyle = [11, 21, 31, 41].includes(m.toothNo)
          ? "#52c41a"
          : "var(--color-primary-600)";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.font = "7px monospace";
        ctx.textAlign = "center";
        ctx.fillText(String(m.toothNo), 0, 3);
        ctx.restore();
      });

      ctx.fillStyle = "#666";
      ctx.font = "10px monospace";
      ctx.fillText(`Stage ${currentStage + 1}/${stages.length}`, 4, 12);
    };

    draw();

    if (playing) {
      animationRef.current = window.setTimeout(() => {
        setCurrentStage((prev) => (prev + 1) % Math.max(stages.length, 1));
      }, 800);
    }
    return () => {
      if (animationRef.current) clearTimeout(animationRef.current);
    };
  }, [currentStage, stages, movements, playing, mode]);

  if (mode === "list") {
    return (
      <PageContainer padding={24}>
        <Space style={{ marginBottom: 'var(--space-4, 16px)' }}>
          <Activity size={20} color="var(--color-primary-600)" />
          <span style={{ fontSize: 18, fontWeight: 600 }}>
            {t('dentalAligner.title')}
          </span>
          {/* [G005 Wave1B] /dental/ortho/aligner-plans 后端真实实现, dentalApi 封装 */}
          <Tag color="green">{t('dentalAligner.realBackendTag')}</Tag>
          <Tag color="cyan">v3.0.6.8-92</Tag>
          <Tag color="blue">{t('dentalAligner.planmecaTag')}</Tag>
          <Tag color="purple">{t('dentalAligner.invisalignTag')}</Tag>
          {/* [G005 W3-B] 新建矫治计划: POST /dental/ortho/aligner-plans (createAlignerPlan) */}
          <Button size="small" type="primary" icon={<Plus size={14} />} onClick={() => setCreateModal(true)}>{t("w3b.alignerCreate")}</Button>
        </Space>
        {loadError && <ErrorBanner message={loadError} onRetry={() => setReloadTick((n) => n + 1)} retryLabel={t("w9.states.retry")} />}
        <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 'var(--space-4, 16px)' }}>
          <StatCard title={t('dentalAligner.totalPlans')} value={plans.length} icon={<Layers size={16} />} />
          <StatCard title={t('dentalAligner.inTreatment')} value={plans.filter((p: any) => p.status === "in-progress").length} icon={<Activity size={16} />} color="primary" />
          <StatCard title={t('dentalAligner.completed')} value={plans.filter((p: any) => p.status === "completed").length} icon={<CheckCircle2 size={16} />} color="success" />
          <StatCard title={t('dentalAligner.notStarted')} value={plans.filter((p: any) => p.status === "pending").length} color="warning" />
        </StatCardGrid>
        <Row gutter={[12, 12]}>
          {plans.map((p: any) => (
            <Col span={8} key={p.id}>
              <Card
                size="small"
                hoverable
                onClick={() => handleSelect(p)}
                style={{
                  cursor: "pointer",
                  borderLeft: `4px solid ${p.status === "completed" ? "#52c41a" : p.status === "in-progress" ? "var(--color-primary-600)" : "#faad14"}`,
                }}
              >
                <Space
                  style={{ justifyContent: "space-between", width: "100%" }}
                >
                  <Tag color="blue">{p.patientName}</Tag>
                  <Badge
                    status={
                      p.status === "completed"
                        ? "success"
                        : p.status === "in-progress"
                          ? "processing"
                          : "default"
                    }
                    text={p.status}
                  />
                </Space>
                <div style={{ marginTop: 'var(--space-1, 4px)', fontSize: 12, color: "var(--text-secondary)" }}>
                  {p.diagnosis?.slice(0, 40)}...
                  <br />
                   {t('dentalAligner.stageProgress', { current: p.currentStage, total: p.totalStages })} | {t('dentalAligner.perStage')}{" "}
                   {t('dentalAligner.days', { count: p.wearDaysPerStage })} | {p.doctor}
                </div>
                {p.status === "in-progress" && (
                  <Progress
                    percent={Math.round((p.currentStage / p.totalStages) * 100)}
                    size="small"
                    style={{ marginTop: 'var(--space-1, 4px)' }}
                  />
                )}
              </Card>
            </Col>
          ))}
        </Row>
        {/* [G005 W3-B] 新建矫治计划 Modal: createAlignerPlan (POST /dental/ortho/aligner-plans) */}
        <Modal
          title={t("w3b.alignerCreate")}
          open={createModal}
          onCancel={() => { setCreateModal(false); createForm.resetFields(); }}
          onOk={() => void handleCreatePlan()}
          confirmLoading={creating}
          width={480}
        >
          <Form form={createForm} layout="vertical" size="small" initialValues={{ totalStages: 14, wearDaysPerStage: 7 }}>
            <Form.Item name="patientName" label={t("w3b.patientName")} rules={[{ required: true, message: t("dentalAligner.patientNameRequired") }]}>
              <Input placeholder={t("dentalAligner.patientNamePlaceholder")} />
            </Form.Item>
            <Form.Item name="diagnosis" label={t("w3b.diagnosis")}>
              <Input placeholder={t("dentalAligner.indicationPlaceholder")} />
            </Form.Item>
            <Form.Item name="totalStages" label={t("dentalAligner.totalStages")}>
              <InputNumber style={{ width: "100%" }} min={4} max={60} />
            </Form.Item>
            <Form.Item name="wearDaysPerStage" label={t("dentalAligner.wearDays")}>
              <InputNumber style={{ width: "100%" }} min={1} max={30} />
            </Form.Item>
            <Form.Item name="doctor" label={t("dentalAligner.doctor")}>
              <Input placeholder={t("dentalAligner.optional")} />
            </Form.Item>
          </Form>
        </Modal>
      </PageContainer>
    );
  }

  const progressPct = progress
    ? Math.round((progress.currentStage / progress.totalStages) * 100)
    : 0;

  return (
    <PageContainer padding={16}>
      <Space style={{ marginBottom: 'var(--space-3, 12px)' }}>
        <Button icon={<RotateCcw size={14} />} onClick={() => setMode("list")}>
           {t('dentalAligner.back')}
        </Button>
        <Layers size={18} color="var(--color-primary-600)" />
        <span style={{ fontSize: 16, fontWeight: 600 }}>
          {current?.patientName} - {t('dentalAligner.planSuffix')}
        </span>
        <Tag color="cyan">v3.0.6.8-92</Tag>
        <Tag color="blue">
          {current?.currentStage}/{current?.totalStages} {t('dentalAligner.stagesUnit')}
        </Tag>
        <Badge
          status={current?.status === "in-progress" ? "processing" : "default"}
          text={current?.status}
        />
      </Space>
      <Row gutter={12}>
        <Col span={16}>
          <Card
            size="small"
            title={
              <Space>
                <Box size={14} />
                {t('dentalAligner.simulation3d')}
              </Space>
            }
            extra={
              <Space>
                <Button aria-label="上一个"
                  size="small"
                  icon={<SkipBack size={10} />}
                  onClick={() => setCurrentStage(Math.max(0, currentStage - 1))}
                  disabled={currentStage <= 0}
                />
                <Button aria-label="播放"
                  size="small"
                  icon={playing ? <Pause size={10} /> : <Play size={10} />}
                  type={playing ? "primary" : "default"}
                  onClick={() => setPlaying(!playing)}
                />
                <Button aria-label="下一个"
                  size="small"
                  icon={<SkipForward size={10} />}
                  onClick={() =>
                    setCurrentStage(
                      Math.min(stages.length - 1, currentStage + 1),
                    )
                  }
                  disabled={currentStage >= stages.length - 1}
                />
                <Slider
                  value={currentStage}
                  min={0}
                  max={Math.max(stages.length - 1, 1)}
                  step={1}
                  onChange={(v) => setCurrentStage(v)}
                  style={{ width: 120, margin: "0 8px" }}
                />
              </Space>
            }
          >
            <canvas
              ref={canvasRef}
              width={480}
              height={320}
              style={{ width: "100%", height: 280, borderRadius: 8 }}
            />
          </Card>
          <Card
            size="small"
            title={
              <Space>
                <BarChart3 size={14} />
                {t('dentalAligner.stageDetail')}
              </Space>
            }
            style={{ marginTop: 'var(--space-2, 8px)' }}
          >
            <Row gutter={8}>
              <Col span={6}>
                <Statistic
                  title={t('dentalAligner.stageNumber')}
                  value={`${currentStage + 1}/${stages.length}`}
                />
              </Col>
              <Col span={6}>
                <Statistic title={t('dentalAligner.toothMovements')} value={movements.length} />
              </Col>
              <Col span={6}>
                <Statistic
                  title={t('dentalAligner.wearDaysTitle')}
                  value={current?.wearDaysPerStage || 7}
                  suffix={t('dentalAligner.daysUnit')}
                />
              </Col>
              <Col span={6}>
                <Statistic title={t('dentalAligner.completion')} value={progressPct} suffix="%" />
              </Col>
            </Row>
            {movements.length > 0 && (
              <div style={{ marginTop: 'var(--space-2, 8px)' }}>
                {movements.slice(0, 8).map((m: any) => (
                  <Tag key={m.toothNo} color="blue" style={{ marginBottom: 2 }}>
                    #{m.toothNo}: dx={m.dx.toFixed(1)} dy={m.dy.toFixed(1)} rot=
                    {m.rotation.toFixed(1)}°
                  </Tag>
                ))}
              </div>
            )}
          </Card>
        </Col>
        <Col span={8}>
          <Card
            size="small"
            title={
              <Space>
                <Eye size={14} />
                {t('dentalAligner.treatmentOverview')}
              </Space>
            }
          >
            {progress && (
              <>
                <div style={{ marginBottom: 'var(--space-2, 8px)' }}>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t('dentalAligner.compliance')} </span>
                  <Progress
                    percent={Math.round(progress.patientCompliance * 100)}
                    size="small"
                    strokeColor={
                      progress.patientCompliance > 0.85 ? "#52c41a" : "#faad14"
                    }
                  />
                </div>
                <Tag
                  color={
                    progress.trackingQuality === "good"
                      ? "green"
                      : progress.trackingQuality === "fair"
                        ? "orange"
                        : "red"
                  }
                >
                  {progress.trackingQuality === "good"
                    ? t('dentalAligner.trackingGood')
                    : progressPct >= 50
                      ? t('dentalAligner.trackingFair')
                      : t('dentalAligner.trackingWarning')}
                </Tag>
                <div style={{ marginTop: 'var(--space-2, 8px)', fontSize: 12, color: "var(--text-secondary)" }}>
                  {t('dentalAligner.currentStageWorn')}: {t('dentalAligner.days', { count: progress.lastStageWornDays })}<br />
                  {t('dentalAligner.nextStage')}{progress.nextStageDate}
                </div>
                {progress.refinementSuggested && (
                  <Tag color="red" style={{ marginTop: 'var(--space-1, 4px)' }}>
                     {t('dentalAligner.suggestRefinement', { count: progress.refinementCount })}
                  </Tag>
                )}
              </>
            )}
          </Card>
          <Card
            size="small"
            title={
              <Space>
                <Save size={14} />
                {t('dentalAligner.attachmentsIpr')}
              </Space>
            }
            style={{ marginTop: 'var(--space-2, 8px)' }}
          >
            <div style={{ fontSize: 12 }}>
              <b>{t('dentalAligner.attachments', { count: current?.attachments?.length || 0 })}</b>
              {current?.attachments?.map((a: any, i: number) => (
                <Tag key={i} color="purple" style={{ margin: 2 }}>
                  #{a.toothNo} {a.type}
                </Tag>
              ))}
            </div>
            <div style={{ marginTop: 6, fontSize: 12 }}>
              <b>{t('dentalAligner.ipr')}</b>
              {current?.ipr?.map((i: any, idx: number) => (
                <Tag key={idx} color="orange" style={{ margin: 2 }}>
                  #{i.toothNo} {i.amount}mm
                </Tag>
              ))}
            </div>
          </Card>
          <Card size="small" title={t('dentalAligner.actions')} style={{ marginTop: 'var(--space-2, 8px)' }}>
            <Space orientation="vertical" style={{ width: "100%" }}>
              <Button
                block
                icon={<CheckCircle2 size={14} />}
                onClick={async () => {
                  const r = await dentalApi.approveAlignerPlan(current.id);
                  if (r.success) message.success(t('dentalAligner.planApproved'));
                }}
              >
                {t('dentalAligner.approvePlan')}
              </Button>
              <Button
                block
                icon={<Save size={14} />}
                onClick={async () => {
                  const r = await dentalApi.orderAlignerLab(current.id, {
                    lab: "AlignTech",
                    quantity: 6,
                    shippingMethod: "express",
                  });
                  if (r.success) message.success(t('dentalAligner.submittedToLab'));
                }}
              >
                {t('dentalAligner.submitProcessing')}
              </Button>
              {/* [G005 W3-B] 生成阶段 + 进度更新 (generateAlignerStages / updateAlignerProgress) */}
              <Button
                block
                icon={<Layers size={14} />}
                onClick={() => void handleGenerateStages()}
                disabled={stages.length > 0}
              >
                {t("w3b.alignerGenerateStages")}
              </Button>
              <Button
                block
                icon={<CheckCircle2 size={14} />}
                onClick={() => void handleUpdateProgress()}
                disabled={currentStage >= stages.length - 1}
              >
                {t("w3b.alignerUpdateProgress")}
              </Button>
            </Space>
          </Card>
          <Steps
            orientation="vertical"
            size="small"
            current={currentStage}
            items={stages
              .slice(0, Math.min(8, stages.length))
              .map((_: any, i: number) => ({
                title: t('dentalAligner.stageTitle', { num: i + 1 }),
                description: i <= currentStage ? t('dentalAligner.worn') : t('dentalAligner.notWorn'),
              }))}
            style={{ marginTop: 'var(--space-2, 8px)' }}
          />
        </Col>
      </Row>
    </PageContainer>
  );
};
export default DentalAlignerPage;
