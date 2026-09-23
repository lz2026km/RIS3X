// [v3.0.6.8-88] Phase 1: 种植 3D 规划
// 对标: 3Shape Implant Studio + SimPlant + CoDiagnostiX
import React, { useState, useEffect, useRef } from "react";
import {
  Card,
  Space,
  Tag,
  Button,
  Select,
  Row,
  Col,
  Statistic,
  Form,
  InputNumber,
  message,
  Alert,
  Badge,
  Progress,
  Divider,
  Segmented,
  Slider,
  Modal,
  Input,
} from "antd";
import {
  Box,
  Save,
  CheckCircle2,
  Crosshair,
  AlertTriangle,
  Download,
  RotateCcw,
  BarChart3,
  Layers,
  Plus,
} from "lucide-react";
import { dentalApi } from "../../services/api/dentalApi";
import { ErrorBanner } from "../../components/feedback";
import { t } from "../../i18n/appI18n";

const STATUS_META: Record<string, { color: string; labelKey: string }> = {
  planning: { color: "default", labelKey: "dentalImplant3d.statusPlanning" },
  approved: { color: "green", labelKey: "dentalImplant3d.statusApproved" },
  guided_surgery: { color: "cyan", labelKey: "dentalImplant3d.statusGuidedSurgery" },
  implementing: { color: "blue", labelKey: "dentalImplant3d.statusImplementing" },
  completed: { color: "purple", labelKey: "dentalImplant3d.statusCompleted" },
  pending: { color: "orange", labelKey: "dentalImplant3d.statusPending" },
};

export const DentalImplant3DPage: React.FC = () => {
  const [plans, setPlans] = useState<any[]>([]);
  const [current, setCurrent] = useState<any>(null);
  const [brands, setBrands] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [nerveData, setNerveData] = useState<any>(null);
  const [boneData, setBoneData] = useState<any>(null);
  const [validation, setValidation] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [guideExported, setGuideExported] = useState(false);
  const [mode, setMode] = useState<"list" | "plan">("list");
  // [G005 Wave1B] 种植体登记库: dentalApi.listImplants / updateImplant (GET/PUT /dental/implants)
  const [implants, setImplants] = useState<any[]>([]);
  const [implantModal, setImplantModal] = useState<{ open: boolean; data: any; saving: boolean }>({ open: false, data: null, saving: false });
  // [G005 W3-B] 种植体登记: POST /dental/implants (createImplant)
  const [createImplantOpen, setCreateImplantOpen] = useState(false);
  const [createImplantForm, setCreateImplantForm] = useState({ toothNumber: 36, implantBrand: "Straumann", implantModel: "BLT-RC-4.1x10", diameter: 4.1, length: 10, status: "PLANNED" });
  const [createImplantSaving, setCreateImplantSaving] = useState(false);
  const [selBrand, setSelBrand] = useState("straumann");
  const [selModel, setSelModel] = useState("BLT-RC-4.1x10");
  // [G005 Wave1A P1] 规划编辑 (updateImplantModel / updateImplantPlacement)
  const [planEdit, setPlanEdit] = useState<any>({ entryX: 150, entryY: 120, angle: 0 });
  // [G005 2B] 写死患者真实化: dentalApi.listPatients + 新建规划患者/牙位受控
  const [patients, setPatients] = useState<any[]>([]);
  const [selPatient, setSelPatient] = useState("");
  const [fdiTooth, setFdiTooth] = useState(36);
  const canvas3dRef = useRef<HTMLCanvasElement>(null);
  const [activeSlice, setActiveSlice] = useState(50);
  // MPR view state
  const [viewAxial, setViewAxial] = useState<"axial" | "sagittal" | "coronal">(
    "axial",
  );
  const [ww, setWw] = useState(1500);
  const [wc, setWc] = useState(500);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    setLoadError(null);
    dentalApi
      .listImplantPlans3d()
      .then((r) => {
        if (Array.isArray(r)) setPlans(r);
        else setLoadError(t("w9.states.error"));
      })
      .catch((err) => {
        console.error("[F04]", err);
        setLoadError(t("w9.states.error"));
      });
    dentalApi
      .getImplantBrands()
      .then((r) => {
        if (Array.isArray(r)) setBrands(r);
      })
      .catch((err) => {
        console.error("[F04]", err);
      });
    // [G005 Wave1B] 种植体登记库
    dentalApi
      .listImplants()
      .then((r) => {
        if (Array.isArray(r)) setImplants(r);
      })
      .catch((err) => {
        console.error("[F04]", err);
      });
    // [G005 2B] 患者列表 (写死 P100001 真实化)
    dentalApi
      .listPatients()
      .then((r: any) => {
        if (Array.isArray(r?.data)) {
          setPatients(r.data);
          if (r.data.length > 0) setSelPatient(r.data[0].id || r.data[0].patientId);
        }
      })
      .catch((err) => {
        console.error("[F04]", err);
      });
  }, [reloadTick]);

  // [G005 Wave1B] 更新种植体登记: PUT /dental/implants/:id (updateImplant)
  const handleUpdateImplant = async () => {    const d = implantModal.data;
    if (!d?.id) return;
    setImplantModal(prev => ({ ...prev, saving: true }));
    try {
      const res = await dentalApi.updateImplant(d.id, {
        implantBrand: d.implantBrand,
        implantModel: d.implantModel,
        status: d.status,
      });
      if (res.success) {
        message.success(t('dentalImplant3d.implantUpdated', { id: d.id }));
        setImplantModal({ open: false, data: null, saving: false });
        const list = await dentalApi.listImplants();
        if (Array.isArray(list)) setImplants(list);
      } else {
        message.error(res.error?.message ?? t('dentalImplant3d.updateFailed'));
        setImplantModal(prev => ({ ...prev, saving: false }));
      }
    } catch (e: any) {
      message.error(e?.message ?? t('dentalImplant3d.updateFailed'));
      setImplantModal(prev => ({ ...prev, saving: false }));
    }
  };

  // [G005 W3-B] 种植体登记: POST /dental/implants (createImplant)
  const handleCreateImplant = async () => {
    setCreateImplantSaving(true);
    try {
      const res = await dentalApi.createImplant({
        ...createImplantForm,
        patientId: selPatient || `P${Date.now()}`,
      });
      if (res.success && res.data) {
        message.success(t('dentalImplant3d.implantRegistered', { id: res.data.id ?? '' }));
        setCreateImplantOpen(false);
        const list = await dentalApi.listImplants();
        if (Array.isArray(list)) setImplants(list);
      } else {
        message.error(res.error?.message ?? t('dentalImplant3d.registerFailed'));
      }
    } catch (e: any) {
      message.error(e?.message ?? t('dentalImplant3d.registerFailed'));
    } finally {
      setCreateImplantSaving(false);
    }
  };

  useEffect(() => {
    dentalApi
      .getImplantModels(selBrand)
      .then((r) => {
        if (Array.isArray(r)) setModels(r);
        if (Array.isArray(r) && r.length > 0) setSelModel(r[0].id);
      })
      .catch((err) => {
        console.error("[F04]", err);
      });
  }, [selBrand]);

  const handleSelectPlan = async (plan: any) => {
    setCurrent(plan);
    setMode("plan");
    // [v3.0.6.8-105] 修复: ?set selBrand, 加载 models, 然后?plan ?model 覆盖
    setSelBrand(plan.brand);
    setPlanEdit({ entryX: plan.entryPoint?.x ?? 150, entryY: plan.entryPoint?.y ?? 120, angle: plan.angleMesioDistal ?? 0 });
    try {
      // [G005 W3-B] 规划详情刷新: GET /dental/implant/plan-3d/:id (getImplantPlan3d)
      const detail = await dentalApi.getImplantPlan3d(plan.id);
      if (detail.success && detail.data) {
        const merged = { ...plan, ...detail.data };
        setCurrent(merged);
        setSelBrand(merged.brand);
        setPlanEdit({ entryX: merged.entryPoint?.x ?? 150, entryY: merged.entryPoint?.y ?? 120, angle: merged.angleMesioDistal ?? 0 });
      }
      const ms = await dentalApi.getImplantModels(plan.brand);
      if (Array.isArray(ms)) {
        setModels(ms);
        setSelModel(plan.model); // 直接使用 plan ?model, 不被 useEffect 覆盖
      }
      const nd = (await dentalApi.getImplantNerveDistance(plan.id)) as any;
      if (nd && nd.distances) setNerveData(nd);
      const bd = await dentalApi.getImplantBoneDensityRoi(plan.id);
      if (bd) setBoneData(bd);
    } catch (e) {
      console.warn("[F03] Error:", (e as Error)?.message);
    }
  };

  const handleValidate = async () => {
    if (!current) return;
    setBusy(true);
    try {
      const v = await dentalApi.validateImplantPlan(current.id);
      setValidation(v);
      message.success(t('dentalImplant3d.validateDone'));
    } catch (e: any) {
      message.error(e.message);
    }
    setBusy(false);
  };

  const handleApprove = async () => {
    if (!current) return;
    setBusy(true);
    try {
      await dentalApi.approveImplantPlan(current.id);
      message.success(t('dentalImplant3d.planApproved'));
      setMode("list");
    } catch (e: any) {
      message.error(e.message);
    }
    setBusy(false);
  };

  // [G005 Wave1A P1] 保存规划参数: updateImplantModel + updateImplantPlacement
  const handleSavePlanEdit = async () => {
    if (!current) return;
    setBusy(true);
    try {
      const a = await dentalApi.updateImplantModel(current.id, selBrand, selModel);
      if (!a.success) throw new Error(a.error?.message ?? t('dentalImplant3d.modelSaveFailed'));
      const b = await dentalApi.updateImplantPlacement(current.id, {
        entryPoint: { x: planEdit.entryX, y: planEdit.entryY, z: current.entryPoint?.z ?? 80 },
        angleMesioDistal: planEdit.angle,
      });
      if (!b.success) throw new Error(b.error?.message ?? t('dentalImplant3d.positionSaveFailed'));
      message.success(t('dentalImplant3d.planSaved'));
    } catch (e: any) {
      message.error(e?.message ?? t('dentalImplant3d.saveFailed'));
    }
    setBusy(false);
  };

  // [G005 Wave1A P1] 神经标记: markImplantNerve
  const handleMarkNerve = async () => {
    if (!current) return;
    setBusy(true);
    try {
      const res = await dentalApi.markImplantNerve(current.id, [
        { x: 150, y: 115, z: 35, label: "下牙槽神经" },
      ]);
      if (!res.success) throw new Error(res.error?.message ?? t('dentalImplant3d.markFailed'));
      message.success(t('dentalImplant3d.nerveMarked', { count: res.data?.markedPoints?.length ?? 1 }));
    } catch (e: any) {
      message.error(e?.message ?? t('dentalImplant3d.markFailed'));
    }
    setBusy(false);
  };

  // 导板导出：调用后端导板导出端点并下载（后端无文件时下载 JSON 记录）
  const handleExportGuide = async () => {
    if (!current) {
      message.warning(t('dentalImplant3d.selectPlanFirst'));
      return;
    }
    if (!current.guideDesigned) {
      message.warning(t('dentalImplant3d.designGuideFirst'));
      return;
    }
    setBusy(true);
    try {
      const r: any = await dentalApi.exportSurgicalGuide(current.id);
      const payload = r?.url
        ? { planId: current.id, url: r.url, format: r.format, size: r.size, estimatedPrintTime: r.estimatedPrintTime }
        : { planId: current.id, patientId: current.patientId, guideFile: current.guideFile, exportedAt: new Date().toISOString() };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `surgical-guide-${current.id}.stl`;
      a.click();
      URL.revokeObjectURL(url);
      setGuideExported(true);
      message.success(t('dentalImplant3d.guideExported'));
    } catch (e: any) {
      message.error(e?.message || t('dentalImplant3d.guideExportFailed'));
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async () => {
    if (!selPatient) {
      message.warning(t('dentalImplant3d.selectPatientFirst'));
      return;
    }
    setBusy(true);
    try {
      const plan = await dentalApi.createImplantPlan3d({
        patientId: selPatient,
        toothNo: fdiTooth,
        brand: selBrand,
        model: selModel,
      });
      setCurrent(plan);
      setMode("plan");
      setPlanEdit({ entryX: 150, entryY: 120, angle: 0 });
      message.success(t('dentalImplant3d.planCreated'));
    } catch (e: any) {
      message.error(e.message);
    }
    setBusy(false);
  };

  // 简化的 MPR Canvas
  const drawMprCanvas = () => {
    const canvas = canvas3dRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width,
      h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, w, h);
    // 模拟 CBCT 切片
    ctx.fillStyle = "#1a1a3a";
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, w / 3, h / 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // 牙弓轮廓
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -60; i <= 60; i++) {
      const px = w / 2 + i;
      const py = h / 2 + Math.sin(i * 0.05) * 30;
      if (i === -60) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
    // 植入?
    if (current) {
      const ex = w / 2 + 30,
        ey = h / 2 - 10;
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(0.1);
      ctx.fillStyle = "#2563eb";
      ctx.fillRect(-4, -30, 8, 60);
      ctx.strokeStyle = "#69b1ff";
      ctx.lineWidth = 1;
      ctx.strokeRect(-4, -30, 8, 60);
      ctx.beginPath();
      ctx.arc(0, -30, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#52c41a";
      ctx.fill();
      ctx.restore();
      // 神经?
      ctx.strokeStyle = "#ff4d4f";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(w / 2 - 80, h / 2 + 30);
      ctx.lineTo(w / 2 + 20, h / 2 + 10);
      ctx.lineTo(w / 2 + 60, h / 2 + 20);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // 十字准心
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "10px monospace";
    ctx.fillText(t('dentalImplant3d.mprOverlay', { ww, wc }), 4, 12);
  };

  useEffect(() => {
    if (mode === "plan") drawMprCanvas();
  }, [mode, current, activeSlice, ww, wc]);

  const safeDist = current?.distanceToNerve || 3.2;
  const safe = safeDist >= 2;

  if (mode === "list") {
    return (
      <div style={{ padding: 24, background: "var(--bg-card)", minHeight: "100vh" }}>
        <Space style={{ marginBottom: 16 }}>
          <Box size={20} color="#2563eb" />
          <span style={{ fontSize: 18, fontWeight: 600 }}>
            {t('dentalImplant3d.title')}
          </span>
          <Tag color="cyan">v3.0.6.8-88</Tag>
          <Tag color="blue">{t('dentalImplant3d.benchmark')}</Tag>
        </Space>
        {loadError && <ErrorBanner message={loadError} onRetry={() => setReloadTick((n) => n + 1)} retryLabel={t("w9.states.retry")} />}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={4}>
            <Card size="small">
              <Statistic title={t('dentalImplant3d.statTotalPlans')} value={plans.length} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic
                title={t('dentalImplant3d.statPendingApproval')}
                value={plans.filter((p: any) => p.status === "planning").length}
                styles={{ content: {  color: "#faad14"  } }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic
                title={t('dentalImplant3d.statApproved')}
                value={plans.filter((p: any) => p.status === "approved").length}
                styles={{ content: {  color: "#52c41a"  } }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic
                title={t('dentalImplant3d.statHasGuide')}
                value={plans.filter((p: any) => p.guideDesigned).length}
              />
            </Card>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={8}>
            <Card title={t('dentalImplant3d.newDesign')} size="small">
              <Form layout="vertical" size="small">
                <Form.Item label={t('dentalImplant3d.patient')} required>
                  <Select
                    value={selPatient}
                    onChange={(v) => setSelPatient(v)}
                    placeholder={t('dentalImplant3d.selectPatient')}
                    options={patients.map((p: any) => ({
                      value: p.id || p.patientId,
                      label: `${p.name} (${p.id || p.patientId})`,
                    }))}
                    notFoundContent={t('dentalImplant3d.noPatients')}
                  />
                </Form.Item>
                <Form.Item label={t('dentalImplant3d.brand')}>
                  <Select
                    value={selBrand}
                    onChange={(v) => setSelBrand(v)}
                    options={brands.map((b: any) => ({
                      value: b.id,
                      label: b.name,
                    }))}
                  />
                </Form.Item>
                <Form.Item label={t('dentalImplant3d.model')}>
                  <Select
                    value={selModel}
                    onChange={(v) => setSelModel(v)}
                    options={models.map((m: any) => ({
                      value: m.id,
                      label: `${m.name} (${m.diameters[0]}/${m.lengths[0]})`,
                    }))}
                  />
                </Form.Item>
                <Form.Item label={t('dentalImplant3d.toothFdi')}>
                  <InputNumber
                    min={11}
                    max={48}
                    step={1}
                    value={fdiTooth}
                    onChange={(v) => setFdiTooth(v || 36)}
                    style={{ width: "100%" }}
                  />
                </Form.Item>
                <Button
                  type="primary"
                  block
                  icon={<Box size={14} />}
                  onClick={handleCreate}
                  loading={busy}
                >
                  {t('dentalImplant3d.createPlanBtn')}
                </Button>
              </Form>
            </Card>
            {/* [G005 Wave1B] 种植体登记库 (dentalApi.listImplants / updateImplant) */}
            <Card title={<Space><Tag color="cyan">{t('dentalImplant3d.implantRegister')}</Tag>{t('dentalImplant3d.recordsCount', { count: implants.length })}</Space>} size="small" style={{ marginTop: 12 }}
              extra={<Button size="small" type="primary" icon={<Plus size={12} />} onClick={() => setCreateImplantOpen(true)}>{t("w3b.implantRegister")}</Button>}>
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {implants.map((im: any) => (
                  <div key={im.id} style={{ padding: '8px 4px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                    <div style={{ minWidth: 0 }}>
                      <Space size={4}>
                        <Tag color="purple">#{im.toothNumber ?? im.toothNo ?? '-'}</Tag>
                        <b style={{ fontSize: 12 }}>{im.implantBrand ?? '—'}</b>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{im.implantModel ?? ''}</span>
                      </Space>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        {im.diameter}×{im.length}mm · <Tag style={{ fontSize: 10, margin: 0 }}>{im.status ?? 'PLANNED'}</Tag>
                      </div>
                    </div>
                    <Button size="small" type="link" onClick={() => setImplantModal({ open: true, data: { ...im }, saving: false })}>{t('dentalImplant3d.update')}</Button>
                  </div>
                ))}
                {implants.length === 0 && <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>{t('dentalImplant3d.noImplants')}</div>}
              </div>
            </Card>
          </Col>
          <Col span={16}>
            <Card title={t('dentalImplant3d.planList')} size="small">
              {plans.map((p: any) => (
                <Card
                  key={p.id}
                  size="small"
                  hoverable
                  onClick={() => handleSelectPlan(p)}
                  style={{
                    marginBottom: 8,
                    cursor: "pointer",
                    borderColor:
                      p.status === "approved"
                        ? "#52c41a"
                        : p.status === "planning"
                          ? "#faad14"
                          : "#d9d9d9",
                  }}
                >
                  <Space
                    style={{ justifyContent: "space-between", width: "100%" }}
                  >
                    <div>
                      <Tag color="purple">FDI #{p.toothNo}</Tag>
                      <Tag color="blue">{p.brandName || p.brand}</Tag>
                      <span style={{ fontSize: 13 }}>
                        {p.patientName} - {p.assignedDentist}
                      </span>
                    </div>
                    <Badge
                      status={
                        p.status === "approved"
                          ? "success"
                          : p.status === "planning"
                            ? "processing"
                            : "default"
                      }
                      text={t(STATUS_META[p.status]?.labelKey ?? p.status)}
                    />
                  </Space>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
                    {p.model} | {t('dentalImplant3d.nerveDistance')} {p.distanceToNerve}mm | {t('dentalImplant3d.boneDensity')}{" "}
                    {p.boneDensityAtApex}HU | {p.createdAt?.slice(0, 10)}
                  </div>
                </Card>
              ))}
            </Card>
          </Col>
        </Row>

        {/* [G005 Wave1B] 种植体登记更新 Modal (dentalApi.updateImplant) */}
        <Modal
          title={t('dentalImplant3d.updateImplantTitle', { id: implantModal.data?.id ?? '' })}
          open={implantModal.open}
          onCancel={() => setImplantModal({ open: false, data: null, saving: false })}
          onOk={() => void handleUpdateImplant()}
          confirmLoading={implantModal.saving}
          width={440}
        >
          {implantModal.data && (
            <Form layout="vertical" size="small" style={{ marginTop: 8 }}>
              <Form.Item label={t('dentalImplant3d.brand')}>
                <Input value={implantModal.data.implantBrand ?? ''} onChange={e => setImplantModal({ ...implantModal, data: { ...implantModal.data, implantBrand: e.target.value } })} />
              </Form.Item>
              <Form.Item label={t('dentalImplant3d.model')}>
                <Input value={implantModal.data.implantModel ?? ''} onChange={e => setImplantModal({ ...implantModal, data: { ...implantModal.data, implantModel: e.target.value } })} />
              </Form.Item>
              <Form.Item label={t('dentalImplant3d.status')}>
                <Select value={implantModal.data.status ?? 'PLANNED'} onChange={v => setImplantModal({ ...implantModal, data: { ...implantModal.data, status: v } })} options={['PLANNED', 'SURGERY_DONE', 'FINALIZED', 'REMOVED'].map(s => ({ value: s, label: s }))} />
              </Form.Item>
            </Form>
          )}
        </Modal>

        {/* [G005 W3-B] 种植体登记 Modal: createImplant (POST /dental/implants) */}
        <Modal
          title={t("w3b.implantRegisterTitle")}
          open={createImplantOpen}
          onCancel={() => setCreateImplantOpen(false)}
          onOk={() => void handleCreateImplant()}
          confirmLoading={createImplantSaving}
          width={440}
        >
          <Form layout="vertical" size="small" style={{ marginTop: 8 }}>
            <Form.Item label={t("w3b.implantTooth")}> <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>(FDI)</span>
              <InputNumber min={11} max={48} value={createImplantForm.toothNumber} style={{ width: '100%' }}
                onChange={(v) => setCreateImplantForm({ ...createImplantForm, toothNumber: v ?? 36 })} />
            </Form.Item>
            <Form.Item label={t("w3b.implantBrand")}>
              <Input value={createImplantForm.implantBrand} onChange={(e) => setCreateImplantForm({ ...createImplantForm, implantBrand: e.target.value })} />
            </Form.Item>
            <Form.Item label={t("w3b.implantModel")}>
              <Input value={createImplantForm.implantModel} onChange={(e) => setCreateImplantForm({ ...createImplantForm, implantModel: e.target.value })} />
            </Form.Item>
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item label={t('dentalImplant3d.diameter')}>
                  <InputNumber min={2.5} max={7} step={0.1} value={createImplantForm.diameter} style={{ width: '100%' }}
                    onChange={(v) => setCreateImplantForm({ ...createImplantForm, diameter: v ?? 4.1 })} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label={t('dentalImplant3d.length')}>
                  <InputNumber min={6} max={18} step={0.5} value={createImplantForm.length} style={{ width: '100%' }}
                    onChange={(v) => setCreateImplantForm({ ...createImplantForm, length: v ?? 10 })} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label={t('dentalImplant3d.status')}>
              <Select value={createImplantForm.status} style={{ width: '100%' }}
                onChange={(v) => setCreateImplantForm({ ...createImplantForm, status: v })}
                options={['PLANNED', 'SURGERY_DONE', 'FINALIZED', 'REMOVED'].map(s => ({ value: s, label: s }))} />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, background: "var(--bg-card)", minHeight: "100vh" }}>
      <Space style={{ marginBottom: 12 }}>
        <Button icon={<RotateCcw size={14} />} onClick={() => setMode("list")}>
          {t('dentalImplant3d.backToList')}
        </Button>
        <Box size={18} color="#2563eb" />
        <span style={{ fontSize: 16, fontWeight: 600 }}>
          {t('dentalImplant3d.planTitle', { toothNo: current.toothNo })}
        </span>
        <Tag color="cyan">v3.0.6.8-88</Tag>
        <Tag color={current.status === "approved" ? "green" : "purple"}>
          {t(STATUS_META[current.status]?.labelKey ?? current.status)}
        </Tag>
        <Segmented
          size="small"
          value={viewAxial}
          onChange={(v) => setViewAxial(v as any)}
          options={[
            { value: "axial", label: t('dentalImplant3d.viewAxial') },
            { value: "sagittal", label: t('dentalImplant3d.viewSagittal') },
            { value: "coronal", label: t('dentalImplant3d.viewCoronal') },
          ]}
        />
      </Space>
      <Row gutter={12}>
        <Col span={12}>
          <Card
            size="small"
            title={
              <Space>
                <Crosshair size={14} />
                {t('dentalImplant3d.mprGuide')}
              </Space>
            }
            extra={
              <Space>
                <Button
                  size="small"
                  onClick={() => setActiveSlice(Math.max(1, activeSlice - 1))}
                >
                  -
                </Button>
                <InputNumber
                  value={activeSlice}
                  onChange={(v) => setActiveSlice(v || 50)}
                  min={1}
                  max={200}
                  size="small"
                  style={{ width: 60 }}
                />
                <Button
                  size="small"
                  onClick={() => setActiveSlice(Math.min(200, activeSlice + 1))}
                >
                  +
                </Button>
                <Slider
                  value={activeSlice}
                  min={0}
                  max={200}
                  onChange={setActiveSlice}
                  style={{ width: 100 }}
                />
              </Space>
            }
          >
            <canvas
              ref={canvas3dRef}
              width={480}
              height={360}
              style={{ width: "100%", height: 300, borderRadius: 8 }}
            />
            <Row gutter={8} style={{ marginTop: 8 }}>
              <Col span={12}>
                <Form.Item label={t('dentalImplant3d.windowWidth')}>
                  <InputNumber
                    value={ww}
                    onChange={(v) => setWw(v || 1500)}
                    min={100}
                    max={4000}
                    step={100}
                    style={{ width: "100%" }}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label={t('dentalImplant3d.windowCenter')}>
                  <InputNumber
                    value={wc}
                    onChange={(v) => setWc(v || 500)}
                    min={-1000}
                    max={2000}
                    step={100}
                    style={{ width: "100%" }}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>
          <Card
            size="small"
            title={
              <Space>
                <Layers size={14} />
                {t('dentalImplant3d.implantParams')}
              </Space>
            }
            style={{ marginTop: 8 }}
          >
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item label={t('dentalImplant3d.brand')}>
                  <Select
                    value={selBrand}
                    onChange={(v) => {
                      setSelBrand(v);
                    }}
                    options={brands.map((b: any) => ({
                      value: b.id,
                      label: b.name,
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label={t('dentalImplant3d.model')}>
                  <Select
                    value={selModel}
                    onChange={(v) => setSelModel(v)}
                    options={models.map((m: any) => ({
                      value: m.id,
                      label: m.name,
                    }))}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={8}>
              <Col span={8}>
                <Form.Item label={t('dentalImplant3d.entryX')} style={{ margin: 0 }}>
                  <InputNumber
                    value={planEdit.entryX}
                    min={0}
                    max={300}
                    step={0.5}
                    onChange={(v) => setPlanEdit({ ...planEdit, entryX: v ?? 0 })}
                    style={{ width: "100%" }}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('dentalImplant3d.entryY')} style={{ margin: 0 }}>
                  <InputNumber
                    value={planEdit.entryY}
                    min={0}
                    max={300}
                    step={0.5}
                    onChange={(v) => setPlanEdit({ ...planEdit, entryY: v ?? 0 })}
                    style={{ width: "100%" }}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('dentalImplant3d.angleMd')} style={{ margin: 0 }}>
                  <InputNumber
                    value={planEdit.angle}
                    min={-30}
                    max={30}
                    step={0.5}
                    onChange={(v) => setPlanEdit({ ...planEdit, angle: v ?? 0 })}
                    style={{ width: "100%" }}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Button
              type="primary"
              block
              icon={<Save size={14} />}
              style={{ marginTop: 8 }}
              loading={busy}
              onClick={() => void handleSavePlanEdit()}
            >
              {t('dentalImplant3d.savePlanParams')}
            </Button>
          </Card>
        </Col>
        <Col span={12}>
          <Row gutter={12}>
            <Col span={12}>
              <Card
                size="small"
                title={
                  <Space>
                    <AlertTriangle size={14} />
                    {t('dentalImplant3d.safetyAnalysis')}
                  </Space>
                }
              >
                <Statistic
                  title={t('dentalImplant3d.distanceToNerve')}
                  value={`${safeDist} mm`}
                  styles={{ content: {  color: safe ? "#52c41a" : "#ff4d4f"  } }}
                  prefix={safe ? null : <AlertTriangle size={14} />}
                />
                <Progress
                  percent={Math.min(100, (safeDist / 4) * 100)}
                  size="small"
                  strokeColor={safe ? "#52c41a" : "#ff4d4f"}
                  style={{ marginTop: 8 }}
                />
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                  {t('dentalImplant3d.safetyThreshold')}
                </div>
                <Divider style={{ margin: "6px 0" }} />
                {nerveData?.closestNerve && (
                  <Alert
                    type={nerveData.closestNerve.safe ? "success" : "error"}
                    title={t('dentalImplant3d.closestNerve', { distance: nerveData.closestNerve.distance })}
                    showIcon
                  />
                )}
              </Card>
            </Col>
            <Col span={12}>
              <Card
                size="small"
                title={
                  <Space>
                    <BarChart3 size={14} />
                    {t('dentalImplant3d.boneDensityTitle')}
                  </Space>
                }
              >
                <Statistic
                  title={t('dentalImplant3d.boneQuality')}
                  value={boneData?.overallQuality || "D2/D3"}
                  styles={{ content: {  color: "#2563eb", fontSize: 13  } }}
                />
                <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                  {boneData?.measurements
                    ?.slice(0, 3)
                    .map((m: any, i: number) => (
                      <div
                        key={i}
                        style={{
                          flex: 1,
                          textAlign: "center",
                          padding: 4,
                          background: "var(--color-info-bg)",
                          borderRadius: 4,
                        }}
                      >
                        <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>
                          {m.region}
                        </div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>
                          {m.hu}HU
                        </div>
                      </div>
                    ))}
                </div>
                <Progress
                  percent={Math.min(
                    100,
                    ((boneData?.averageHU || 750) / 1500) * 100,
                  )}
                  size="small"
                  strokeColor="#722ed1"
                  style={{ marginTop: 4 }}
                />
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                  {t('dentalImplant3d.averageHu', { hu: boneData?.averageHU || 750 })}
                </div>
              </Card>
            </Col>
          </Row>
          <Card
            size="small"
            title={
              <Space>
                <CheckCircle2 size={14} />
                {t('dentalImplant3d.planValidation')}
              </Space>
            }
            style={{ marginTop: 8 }}
          >
            <Button
              type="primary"
              onClick={handleValidate}
              loading={busy}
              icon={<CheckCircle2 size={14} />}
            >
              {t('dentalImplant3d.runValidation')}
            </Button>
            {validation && (
              <div style={{ marginTop: 8 }}>
                <Alert
                  type={validation.data?.valid ? "success" : "error"}
                  title={
                    validation.data?.valid ? t('dentalImplant3d.validationPass') : t('dentalImplant3d.validationConflict')
                  }
                  showIcon
                />
                {validation.data?.decisions?.map((d: any, i: number) => (
                  <Tag
                    key={i}
                    color={
                      d.severity === "info"
                        ? "blue"
                        : d.severity === "critical"
                          ? "red"
                          : "orange"
                    }
                    style={{ marginTop: 4 }}
                  >
                    {d.action}
                  </Tag>
                ))}
              </div>
            )}
            <Divider style={{ margin: "8px 0" }} />
            <Space style={{ width: "100%", justifyContent: "space-between" }}>
              <Space wrap>
                <Button
                  size="small"
                  icon={<Crosshair size={14} />}
                  loading={busy}
                  onClick={() => void handleMarkNerve()}
                >
                  {t('dentalImplant3d.markNerve')}
                </Button>
                {current.status === "planning" && (
                  <Button
                    type="primary"
                    icon={<Save size={14} />}
                    onClick={handleApprove}
                  >
                    {t('dentalImplant3d.approvePlan')}
                  </Button>
                )}
              </Space>
              <Button
                icon={<Download size={14} />}
                loading={busy}
                onClick={() => void handleExportGuide()}
              >
                {t('dentalImplant3d.exportGuide')}
              </Button>
              <Button
                icon={<AlertTriangle size={14} />}
                onClick={() => window.open("/dental/cad", "_blank")}
              >
                {t('dentalImplant3d.restorationDesign')}
              </Button>
            </Space>
          </Card>
          {current.guideDesigned && (
            <Alert
              style={{ marginTop: 8 }}
              title={
                <Space>
                  <CheckCircle2 size={14} color="#52c41a" />
                  {t('dentalImplant3d.guideDesigned')}
                </Space>
              }
              description={guideExported ? t('dentalImplant3d.guideFileExported', { file: current.guideFile }) : t('dentalImplant3d.guideFile', { file: current.guideFile })}
              type={guideExported ? "success" : "info"}
              showIcon
            />
          )}
        </Col>
      </Row>
    </div>
  );
};
export default DentalImplant3DPage;
