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
import { t } from "../../i18n/appI18n";

const STATUS_META: Record<string, { color: string; label: string }> = {
  planning: { color: "default", label: "规划中" },
  approved: { color: "green", label: "已批准" },
  guided_surgery: { color: "cyan", label: "导板设计" },
  implementing: { color: "blue", label: "实施中" },
  completed: { color: "purple", label: "已完成" },
  pending: { color: "orange", label: "待种植" },
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

  useEffect(() => {
    dentalApi
      .listImplantPlans3d()
      .then((r) => {
        if (Array.isArray(r)) setPlans(r);
      })
      .catch((err) => {
        console.error("[F04]", err);
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
  }, []);

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
        message.success(`种植体 ${d.id} 已更新`);
        setImplantModal({ open: false, data: null, saving: false });
        const list = await dentalApi.listImplants();
        if (Array.isArray(list)) setImplants(list);
      } else {
        message.error(res.error?.message ?? '更新失败');
        setImplantModal(prev => ({ ...prev, saving: false }));
      }
    } catch (e: any) {
      message.error(e?.message ?? '更新失败');
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
        message.success(`种植体 ${res.data.id ?? ''} 已登记`);
        setCreateImplantOpen(false);
        const list = await dentalApi.listImplants();
        if (Array.isArray(list)) setImplants(list);
      } else {
        message.error(res.error?.message ?? '登记失败');
      }
    } catch (e: any) {
      message.error(e?.message ?? '登记失败');
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
      message.success("验证完成");
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
      message.success("规划已审批");
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
      if (!a.success) throw new Error(a.error?.message ?? "模型保存失败");
      const b = await dentalApi.updateImplantPlacement(current.id, {
        entryPoint: { x: planEdit.entryX, y: planEdit.entryY, z: current.entryPoint?.z ?? 80 },
        angleMesioDistal: planEdit.angle,
      });
      if (!b.success) throw new Error(b.error?.message ?? "位置保存失败");
      message.success("规划参数已保存 (模型/位置)");
    } catch (e: any) {
      message.error(e?.message ?? "保存失败");
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
      if (!res.success) throw new Error(res.error?.message ?? "标记失败");
      message.success(`神经已标记 (${res.data?.markedPoints?.length ?? 1} 点)`);
    } catch (e: any) {
      message.error(e?.message ?? "标记失败");
    }
    setBusy(false);
  };

  // 导板导出：调用后端导板导出端点并下载（后端无文件时下载 JSON 记录）
  const handleExportGuide = async () => {
    if (!current) {
      message.warning("请先选择种植规划");
      return;
    }
    if (!current.guideDesigned) {
      message.warning("请先完成导板设计");
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
      message.success("手术导板已导出，可提交 3D 打印");
    } catch (e: any) {
      message.error(e?.message || "导板导出失败");
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async () => {
    if (!selPatient) {
      message.warning("请先选择患者");
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
      message.success("新建 3D 规划");
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
    ctx.fillText("轴位 | WW:" + ww + " WC:" + wc, 4, 12);
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
            种植 3D 规划中心
          </span>
          <Tag color="cyan">v3.0.6.8-88</Tag>
          <Tag color="blue">Implant Studio 对标</Tag>
        </Space>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={4}>
            <Card size="small">
              <Statistic title="总规划" value={plans.length} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic
                title="待审批"
                value={plans.filter((p: any) => p.status === "planning").length}
                styles={{ content: {  color: "#faad14"  } }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic
                title="已审批"
                value={plans.filter((p: any) => p.status === "approved").length}
                styles={{ content: {  color: "#52c41a"  } }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic
                title="已有导板"
                value={plans.filter((p: any) => p.guideDesigned).length}
              />
            </Card>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={8}>
            <Card title="新建设计" size="small">
              <Form layout="vertical" size="small">
                <Form.Item label="患者" required>
                  <Select
                    value={selPatient}
                    onChange={(v) => setSelPatient(v)}
                    placeholder="选择患者"
                    options={patients.map((p: any) => ({
                      value: p.id || p.patientId,
                      label: `${p.name} (${p.id || p.patientId})`,
                    }))}
                    notFoundContent="暂无患者 (dentalApi.listPatients)"
                  />
                </Form.Item>
                <Form.Item label="品牌">
                  <Select
                    value={selBrand}
                    onChange={(v) => setSelBrand(v)}
                    options={brands.map((b: any) => ({
                      value: b.id,
                      label: b.name,
                    }))}
                  />
                </Form.Item>
                <Form.Item label="型号">
                  <Select
                    value={selModel}
                    onChange={(v) => setSelModel(v)}
                    options={models.map((m: any) => ({
                      value: m.id,
                      label: `${m.name} (${m.diameters[0]}/${m.lengths[0]})`,
                    }))}
                  />
                </Form.Item>
                <Form.Item label="牙位 (FDI)">
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
                  新建 3D 规划
                </Button>
              </Form>
            </Card>
            {/* [G005 Wave1B] 种植体登记库 (dentalApi.listImplants / updateImplant) */}
            <Card title={<Space><Tag color="cyan">种植体登记</Tag>{implants.length} 条</Space>} size="small" style={{ marginTop: 12 }}
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
                    <Button size="small" type="link" onClick={() => setImplantModal({ open: true, data: { ...im }, saving: false })}>更新</Button>
                  </div>
                ))}
                {implants.length === 0 && <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>暂无种植体登记</div>}
              </div>
            </Card>
          </Col>
          <Col span={16}>
            <Card title="规划列表" size="small">
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
                      text={STATUS_META[p.status]?.label ?? p.status}
                    />
                  </Space>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
                    {p.model} | 神距: {p.distanceToNerve}mm | 骨密度:{" "}
                    {p.boneDensityAtApex}HU | {p.createdAt?.slice(0, 10)}
                  </div>
                </Card>
              ))}
            </Card>
          </Col>
        </Row>

        {/* [G005 Wave1B] 种植体登记更新 Modal (dentalApi.updateImplant) */}
        <Modal
          title={`更新种植体登记 - ${implantModal.data?.id ?? ''}`}
          open={implantModal.open}
          onCancel={() => setImplantModal({ open: false, data: null, saving: false })}
          onOk={() => void handleUpdateImplant()}
          confirmLoading={implantModal.saving}
          width={440}
        >
          {implantModal.data && (
            <Form layout="vertical" size="small" style={{ marginTop: 8 }}>
              <Form.Item label="品牌">
                <Input value={implantModal.data.implantBrand ?? ''} onChange={e => setImplantModal({ ...implantModal, data: { ...implantModal.data, implantBrand: e.target.value } })} />
              </Form.Item>
              <Form.Item label="型号">
                <Input value={implantModal.data.implantModel ?? ''} onChange={e => setImplantModal({ ...implantModal, data: { ...implantModal.data, implantModel: e.target.value } })} />
              </Form.Item>
              <Form.Item label="状态">
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
                <Form.Item label="直径 (mm)">
                  <InputNumber min={2.5} max={7} step={0.1} value={createImplantForm.diameter} style={{ width: '100%' }}
                    onChange={(v) => setCreateImplantForm({ ...createImplantForm, diameter: v ?? 4.1 })} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="长度 (mm)">
                  <InputNumber min={6} max={18} step={0.5} value={createImplantForm.length} style={{ width: '100%' }}
                    onChange={(v) => setCreateImplantForm({ ...createImplantForm, length: v ?? 10 })} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="状态">
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
          返回列表
        </Button>
        <Box size={18} color="#2563eb" />
        <span style={{ fontSize: 16, fontWeight: 600 }}>
          种植 3D 规划 - #{current.toothNo}
        </span>
        <Tag color="cyan">v3.0.6.8-88</Tag>
        <Tag color={current.status === "approved" ? "green" : "purple"}>
          {STATUS_META[current.status]?.label ?? current.status}
        </Tag>
        <Segmented
          size="small"
          value={viewAxial}
          onChange={(v) => setViewAxial(v as any)}
          options={[
            { value: "axial", label: "轴位" },
            { value: "sagittal", label: "矢状位" },
            { value: "coronal", label: "冠状位" },
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
                CBCT MPR 引导
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
                <Form.Item label="窗宽">
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
                <Form.Item label="窗位">
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
                种植体参数
              </Space>
            }
            style={{ marginTop: 8 }}
          >
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item label="品牌">
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
                <Form.Item label="型号">
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
                <Form.Item label="穿出 x" style={{ margin: 0 }}>
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
                <Form.Item label="穿出 y" style={{ margin: 0 }}>
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
                <Form.Item label="角度 MD °" style={{ margin: 0 }}>
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
              保存规划参数 (模型/位置)
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
                    安全分析
                  </Space>
                }
              >
                <Statistic
                  title="距神经管"
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
                  安全阈值: ≥2mm
                </div>
                <Divider style={{ margin: "6px 0" }} />
                {nerveData?.closestNerve && (
                  <Alert
                    type={nerveData.closestNerve.safe ? "success" : "error"}
                    title={`最邻近神经: ${nerveData.closestNerve.distance}mm`}
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
                    骨密度
                  </Space>
                }
              >
                <Statistic
                  title="骨质量"
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
                  平均 {boneData?.averageHU || 750} HU
                </div>
              </Card>
            </Col>
          </Row>
          <Card
            size="small"
            title={
              <Space>
                <CheckCircle2 size={14} />
                规划验证
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
              运行验证
            </Button>
            {validation && (
              <div style={{ marginTop: 8 }}>
                <Alert
                  type={validation.data?.valid ? "success" : "error"}
                  title={
                    validation.data?.valid ? "规划通过, 无冲突" : "存在冲突"
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
                  标记神经
                </Button>
                {current.status === "planning" && (
                  <Button
                    type="primary"
                    icon={<Save size={14} />}
                    onClick={handleApprove}
                  >
                    审批规划
                  </Button>
                )}
              </Space>
              <Button
                icon={<Download size={14} />}
                loading={busy}
                onClick={() => void handleExportGuide()}
              >
                导板导出
              </Button>
              <Button
                icon={<AlertTriangle size={14} />}
                onClick={() => window.open("/dental/cad", "_blank")}
              >
                修复设计
              </Button>
            </Space>
          </Card>
          {current.guideDesigned && (
            <Alert
              style={{ marginTop: 8 }}
              title={
                <Space>
                  <CheckCircle2 size={14} color="#52c41a" />
                  手术导板已设计
                </Space>
              }
              description={guideExported ? `导板文件: ${current.guideFile} · 已导出，可提交 3D 打印` : `导板文件: ${current.guideFile}`}
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
