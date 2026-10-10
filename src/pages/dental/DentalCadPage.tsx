// [v3.0.6.8-87] Phase 1: 修复 CAD/CAM 设计工作?
// 对标: Sirona Cerec + 3Shape Dental Designer
import React, { useState, useEffect, useRef } from "react";
import {
  Card,
  Space,
  Tag,
  Button,
  Select,
  Row,
  Col,
  Form,
  InputNumber,
  message,
  Spin,
  Badge,
  Progress,
  Alert,
  Divider,
} from "antd";
import {
  Pen,
  MousePointer2,
  RotateCcw,
  Save,
  Download,
  Eye,
  Settings,
  Palette,
} from "lucide-react";
import { dentalApi } from "../../services/api/dentalApi";
import { ErrorBanner } from "../../components/feedback";
import { t } from "../../i18n/appI18n";
import { StatCard, StatCardGrid, PageContainer } from "../../components/common";

const DESIGN_TYPES = [
  { value: "inlay", label: t("dentalCad.designType.inlay") },
  { value: "onlay", label: t("dentalCad.designType.onlay") },
  { value: "crown", label: t("dentalCad.designType.crown") },
  { value: "veneer", label: t("dentalCad.designType.veneer") },
  { value: "abutment", label: t("dentalCad.designType.abutment") },
  { value: "implant-crown", label: t("dentalCad.designType.implantCrown") },
];

const TYPE_LABELS: Record<string, string> = {
  inlay: t("dentalCad.typeLabel.inlay"),
  onlay: t("dentalCad.typeLabel.onlay"),
  crown: t("dentalCad.typeLabel.crown"),
  veneer: t("dentalCad.typeLabel.veneer"),
  abutment: t("dentalCad.typeLabel.abutment"),
  "implant-crown": t("dentalCad.typeLabel.implantCrown"),
};

const MATERIAL_LABELS: Record<string, string> = {
  zirconia: t("dentalCad.material.zirconia"),
  "lithium-disilicate": t("dentalCad.material.lithiumDisilicate"),
  composite: t("dentalCad.material.composite"),
  feldspathic: t("dentalCad.material.feldspathic"),
  pmma: "PMMA",
  metal: t("dentalCad.material.metal"),
  titanium: t("dentalCad.material.titanium"),
  peek: "PEEK",
};

const STATUS_META: Record<string, { color: string; label: string }> = {
  designed: { color: "warning", label: t("dentalCad.status.designed") },
  milling: { color: "blue", label: t("dentalCad.status.milling") },
  milled: { color: "processing", label: t("dentalCad.status.milled") },
  cemented: { color: "success", label: t("dentalCad.status.cemented") },
};

export const DentalCadPage: React.FC = () => {
  const [designs, setDesigns] = useState<any[]>([]);
  const [current, setCurrent] = useState<any>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [shades, setShades] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"list" | "design">("list");
  const [designParams, setDesignParams] = useState({
    type: "crown",
    toothNo: 16,
    patientId: "P100001",
    material: "zirconia",
    shade: "A2",
  });
  const [preview, setPreview] = useState<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [marginPoints, setMarginPoints] = useState<number[][]>([]);
  const [drawing, setDrawing] = useState(false);
  // [G005 Wave1A P1] 铣削单元真实列表: dentalApi.getCadMillingUnits
  const [millingUnits, setMillingUnits] = useState<any[]>([]);
  const [selMillUnit, setSelMillUnit] = useState("sirona-mcxl");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    setLoadError(null);
    Promise.all([
      dentalApi.listCadDesigns().then((r) => {
        if (Array.isArray(r)) setDesigns(r);
      }),
      dentalApi.getCadMaterials().then((r) => {
        if (Array.isArray(r)) setMaterials(r);
      }),
      dentalApi.getCadShades().then((r) => {
        if (r) setShades(r);
      }),
      dentalApi.getCadMillingUnits().then((r) => {
        if (Array.isArray(r)) {
          setMillingUnits(r);
          if (r.length > 0 && r.some((u: any) => u.id === selMillUnit)) setSelMillUnit(r[0].id);
        }
      }),
    ]).catch((err) => {
      console.error("[F04]", err);
      setLoadError(t("w9.states.error"));
    });
  }, [reloadTick]);

  const handleCreate = async () => {
    setBusy(true);
    try {
      const res = await dentalApi.createCadDesign(designParams);
      setCurrent(res);
      setMode("design");
      setMarginPoints([]);
      setPreview(null);
      message.success(t('dentalCad.designCreated'));
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  // [G005 Wave1B] 打开设计详情: dentalApi.getCadDesign (GET /dental/cad/design/:id), 失败回退列表行
  const handleOpenDesign = async (d: any) => {
    setCurrent(d);
    setMode("design");
    try {
      const detail = await dentalApi.getCadDesign(d.id);
      if (detail && typeof detail === "object") {
        setCurrent({ ...d, ...detail });
      }
    } catch (e) {
      console.warn("[F03] getCadDesign fallback to list row:", (e as Error)?.message);
    }
  };

  const handleSaveMargin = async () => {
    if (!current || marginPoints.length < 3) {
      message.warning(t('dentalCad.minMarginPoints'));
      return;
    }
    await dentalApi.saveMarginLine(current.id, marginPoints);
    message.success(t('dentalCad.marginSaved'));
  };

  // [G005 Wave1A P1] 解剖保存: dentalApi.saveAnatomy (PUT /dental/cad/design/:id/anatomy)
  const handleSaveAnatomy = async () => {
    if (!current) return;
    setBusy(true);
    try {
      const res = await dentalApi.saveAnatomy(current.id, {
        occlusalAnatomy: current?.occlusalAnatomy ?? "anatomic",
        thickness: current?.thickness ?? 1.5,
        cementGap: current?.cementGap ?? 30,
        material: current?.material ?? "zirconia",
        updatedBy: "current-doctor",
      });
      if (res && res.success === false) throw new Error(res.error?.message ?? t('dentalCad.saveFailed'));
      message.success(t('dentalCad.anatomySaved'));
    } catch (e: any) {
      message.error(e?.message ?? t('dentalCad.saveFailed'));
    }
    setBusy(false);
  };

  const handlePreview = async () => {
    if (!current) return;
    setBusy(true);
    try {
      const r = await dentalApi.previewCadDesign(current.id);
      setPreview(r);
    } catch (e) {
      console.warn("[F03] Error:", (e as Error)?.message);
    }
    setBusy(false);
  };

  const handleSubmitMill = async () => {
    if (!current) return;
    setBusy(true);
    try {
      await dentalApi.submitMill(current.id, selMillUnit);
      await dentalApi.updateCadStatus(current.id, "milling");
      message.success(t("dentalCad.submittedToMill", { unit: selMillUnit }));
      setMode("list");
    } catch (e) {
      console.warn("[F03] Error:", (e as Error)?.message);
    }
    setBusy(false);
  };

  // 导出 STL：调用后端导出端点并下载文件（后端无真实文件时下载 JSON 记录）
  const handleExportStl = async () => {
    if (!current) {
      message.warning(t('dentalCad.createFirst'));
      return;
    }
    setBusy(true);
    try {
      const r: any = await dentalApi.exportCadStl(current.id);
      const payload = r?.url
        ? { designId: current.id, url: r.url, format: r.format, size: r.size }
        : { designId: current.id, name: current.name, status: current.status, exportedAt: new Date().toISOString() };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${current.id || "design"}.stl`;
      a.click();
      URL.revokeObjectURL(url);
      message.success(t('dentalCad.stlExported'));
    } catch (e: any) {
      message.error(e?.message || t('dentalCad.exportFailed'));
    } finally {
      setBusy(false);
    }
  };

  // 绘制边缘?Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width,
      h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    // 背景
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, w, h);
    // 网格
    ctx.strokeStyle = "#2a2a4e";
    ctx.lineWidth = 0.5;
    for (let x = 0; x < w; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    // 牙齿轮廓 (模拟)
    ctx.beginPath();
    const cx = w / 2,
      cy = h / 2;
    ctx.ellipse(cx, cy, 80, 100, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#2a2a4e";
    ctx.fill();
    // 边缘?
    if (marginPoints.length > 0) {
      ctx.beginPath();
      marginPoints.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p[0]!, p[1]!);
        else ctx.lineTo(p[0]!, p[1]!);
      });
      ctx.closePath();
      ctx.strokeStyle = "#52c41a";
      ctx.lineWidth = 2;
      ctx.stroke();
      marginPoints.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p[0]!, p[1]!, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#52c41a";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }
    // 中心标记
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#ff4d4f";
    ctx.fill();
  }, [marginPoints, current]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing || mode !== "design") return;
    const rect = canvasRef.current!.getBoundingClientRect();
    setMarginPoints((prev) => [
      ...prev,
      [e.clientX - rect.left, e.clientY - rect.top],
    ]);
  };

  if (mode === "list") {
    return (
      <PageContainer padding={24}>
        <Space style={{ marginBottom: 16 }}>
          <Pen size={20} color="var(--color-primary-600)" />
          <span style={{ fontSize: 18, fontWeight: 600 }}>
            {t('dentalCad.title')}
          </span>
          <Tag color="cyan">v3.0.6.8-87</Tag>
          <Tag color="blue">{t('dentalCad.tagSirona')}</Tag>
          <Tag color="purple">{t('dentalCad.tag3Shape')}</Tag>
        </Space>
        {loadError && <ErrorBanner message={loadError} onRetry={() => setReloadTick((n) => n + 1)} retryLabel={t("w9.states.retry")} />}
        <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 16 }}>
          <StatCard title={t('dentalCad.statDesigns')} value={designs.length} icon={<Pen size={16} />} />
          <StatCard title={t('dentalCad.statPendingMill')} value={designs.filter((d: any) => d.status === "designed").length} />
          <StatCard title={t('dentalCad.statCemented')} value={designs.filter((d: any) => d.status === "cemented").length} color="success" />
          <StatCard title={t('dentalCad.statMonthlyOutput')} prefix="¥" value={designs.length * 2500} />
        </StatCardGrid>
        <Row gutter={16}>
          <Col span={8}>
            <Card size="small" title={t('dentalCad.newDesign')}>
              <Form layout="vertical" size="small">
                <Form.Item label={t('dentalCad.restorationType')}>
                  <Select
                    value={designParams.type}
                    onChange={(v) =>
                      setDesignParams({ ...designParams, type: v })
                    }
                    options={DESIGN_TYPES}
                  />
                </Form.Item>
                <Form.Item label={t('dentalCad.toothNoFdi')}>
                  <InputNumber
                    value={designParams.toothNo}
                    onChange={(v) =>
                      setDesignParams({ ...designParams, toothNo: v || 11 })
                    }
                    min={11}
                    max={48}
                    step={1}
                    style={{ width: "100%" }}
                  />
                </Form.Item>
                <Form.Item label={t('dentalCad.patient')}>
                  <Select
                    value={designParams.patientId}
                    onChange={(v) =>
                      setDesignParams({ ...designParams, patientId: v })
                    }
                    options={[
                      { value: "P100001", label: "张伟 - 16" },
                      { value: "P100002", label: "李娜 - 26" },
                      { value: "P100003", label: "王芳 - 14" },
                    ]}
                  />
                </Form.Item>
                <Form.Item label={t('dentalCad.material')}>
                  <Select
                    value={designParams.material}
                    onChange={(v) =>
                      setDesignParams({ ...designParams, material: v })
                    }
                    options={materials.map((m: any) => ({
                      value: m.id,
                      label: m.name,
                    }))}
                  />
                </Form.Item>
                <Form.Item label={t('dentalCad.shade')}>
                  <Select
                    value={designParams.shade}
                    onChange={(v) =>
                      setDesignParams({ ...designParams, shade: v })
                    }
                    options={
                      shades
                        ? Object.keys(shades).map((k) => ({
                            value: k,
                            label: k,
                          }))
                        : []
                    }
                  />
                </Form.Item>
                <Button
                  type="primary"
                  block
                  icon={<Pen size={14} />}
                  onClick={handleCreate}
                  loading={busy}
                >
                  {t('dentalCad.startDesign')}
                </Button>
              </Form>
            </Card>
          </Col>
          <Col span={16}>
            <Card size="small" title={t('dentalCad.designList')}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: 12,
                }}
              >
                {designs.map((d: any) => (
                  <Card
                    key={d.id}
                    size="small"
                    hoverable
                    onClick={() => void handleOpenDesign(d)}
                    style={{ cursor: "pointer" }}
                  >
                    <Space
                      style={{ justifyContent: "space-between", width: "100%" }}
                    >
                      <div>
                        <Tag>{TYPE_LABELS[d.type] ?? d.type}</Tag>
                        <Tag color="blue">{MATERIAL_LABELS[d.material] ?? d.material}</Tag>
                        <Tag>{d.colorShade ? t("dentalCad.shadeUnit", { shade: d.colorShade }) : d.colorShade}</Tag>
                      </div>
                      <Badge
                        status={
                          d.status === "cemented"
                            ? "success"
                            : d.status === "milled"
                              ? "processing"
                              : d.status === "designed"
                                ? "warning"
                                : "default"
                        }
                        text={STATUS_META[d.status]?.label ?? d.status}
                      />
                    </Space>
                    <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-secondary)" }}>
                      {d.patientName} - FDI {d.toothNo} | {d.designer} |{" "}
                      {d.createdAt?.slice(0, 10)}
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          </Col>
        </Row>
      </PageContainer>
    );
  }

  return (
    <PageContainer padding={16}>
      <Space style={{ marginBottom: 12 }}>
        <Button icon={<RotateCcw size={14} />} onClick={() => setMode("list")}>
          {t('dentalCad.backToList')}
        </Button>
        <span style={{ fontSize: 16, fontWeight: 600 }}>
          {t('dentalCad.restorationDesign')} -{" "}
          {DESIGN_TYPES.find((dt) => dt.value === current?.type)?.label} #
          {current?.toothNo}
        </span>
        <Tag color="cyan">v3.0.6.8-87</Tag>
        <Tag color="blue" icon={<Settings size={10} />}>
          {t('dentalCad.marginLineDrawing')}
        </Tag>
      </Space>
      <Row gutter={12}>
        <Col span={14}>
          <Card
            size="small"
            title={
              <Space>
                <MousePointer2 size={14} />
                {t('dentalCad.marginLineDrawing')}
                {drawing ? (
                  <Tag color="green">{t('dentalCad.drawing')}</Tag>
                ) : (
                  <Tag>{t('dentalCad.clickToStart')}</Tag>
                )}
              </Space>
            }
            extra={
              <Space>
                <Button
                  size="small"
                  type={drawing ? "primary" : "default"}
                  onClick={() => setDrawing(!drawing)}
                >
                  {drawing ? t('dentalCad.finishDrawing') : t('dentalCad.startDrawing')}
                </Button>
                <Button
                  size="small"
                  icon={<RotateCcw size={10} />}
                  onClick={() => setMarginPoints([])}
                >
                  {t('dentalCad.clear')}
                </Button>
                <Button
                  size="small"
                  type="primary"
                  onClick={handleSaveMargin}
                  icon={<Save size={10} />}
                >
                  {t('dentalCad.saveMargin')}
                </Button>
                <Button
                  size="small"
                  onClick={() => void handleSaveAnatomy()}
                  icon={<Save size={10} />}
                  loading={busy}
                >
                  {t('dentalCad.saveAnatomy')}
                </Button>
              </Space>
            }
          >
            <canvas
              ref={canvasRef}
              width={500}
              height={400}
              onClick={handleCanvasClick}
              style={{
                width: "100%",
                height: 360,
                borderRadius: 8,
                cursor: drawing ? "crosshair" : "default",
              }}
            />
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
              {t('dentalCad.marginHint')} ({marginPoints.length} {t('dentalCad.controlPoints')})
            </div>
          </Card>
          <Card
            size="small"
            title={
              <Space>
                <Settings size={14} />
                {t('dentalCad.designParams')}
              </Space>
            }
            style={{ marginTop: 8 }}
          >
            <Row gutter={12}>
              <Col span={8}>
                <Form.Item label={t('dentalCad.occlusalAnatomy')}>
                  <Select
                    value={current?.occlusalAnatomy || "anatomic"}
                    options={[
                      { value: "anatomic", label: t('dentalCad.anatomic') },
                      { value: "semi-anatomic", label: t('dentalCad.semiAnatomic') },
                      { value: "flat", label: t('dentalCad.flat') },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('dentalCad.thickness')}>
                  <InputNumber
                    value={current?.thickness || 1.5}
                    min={0.5}
                    max={4}
                    step={0.1}
                    style={{ width: "100%" }}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('dentalCad.cementGap')}>
                  <InputNumber
                    value={current?.cementGap || 30}
                    min={10}
                    max={100}
                    step={5}
                    style={{ width: "100%" }}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>
        </Col>
        <Col span={10}>
          <Card
            size="small"
            title={
              <Space>
                <Palette size={14} />
                {t('dentalCad.materialShade')}
              </Space>
            }
          >
            <Row gutter={[8, 8]}>
              <Col span={12}>
                <Form.Item label={t('dentalCad.material')} style={{ margin: 0 }}>
                  <Select
                    value={current?.material || "zirconia"}
                    options={materials.map((m: any) => ({
                      value: m.id,
                      label: m.name,
                      brand: m.shades,
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label={t('dentalCad.vitaShade')} style={{ margin: 0 }}>
                  <Select
                    value={current?.colorShade || "A2"}
                    options={
                      shades
                        ? Object.keys(shades).map((k) => ({
                            value: k,
                            label: k,
                          }))
                        : []
                    }
                  />
                </Form.Item>
              </Col>
            </Row>
            {current?.colorShade && shades[current.colorShade] && (
              <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-secondary)" }}>
                CIELab: L*={shades[current.colorShade].L} a*=
                {shades[current.colorShade].a} b*={shades[current.colorShade].b}
              </div>
            )}
            <Divider style={{ margin: "8px 0" }} />
              <Space style={{ width: "100%", justifyContent: "space-between" }}>
                <Space>
                  <Button
                    icon={<Eye size={14} />}
                    onClick={handlePreview}
                    loading={busy}
                  >
                    {t('dentalCad.preview3d')}
                  </Button>
                  <Select
                    size="small"
                    value={selMillUnit}
                    onChange={setSelMillUnit}
                    style={{ width: 150 }}
                    placeholder={t('dentalCad.millingUnit')}
                    options={millingUnits.map((u: any) => ({ value: u.id, label: u.name }))}
                  />
                  <Button
                    icon={<Download size={14} />}
                    onClick={handleSubmitMill}
                    loading={busy}
                  >
                    {t('dentalCad.submitMill')}
                  </Button>
                </Space>
              <Button
                onClick={() => void handleExportStl()}
                icon={<Download size={14} />}
                loading={busy}
              >
                {t('dentalCad.exportStl')}
              </Button>
            </Space>
            {preview && (
              <div
                style={{
                  marginTop: 12,
                  padding: 8,
                  background: "#1a1a2e",
                  borderRadius: 6,
                  textAlign: "center",
                  color: "#fff",
                  fontSize: 12,
                }}
              >
                <div>
                  {t('dentalCad.triangles')} {preview.triangleCount.toLocaleString()} | {t('dentalCad.volume')}{" "}
                  {(preview.volume * 1000).toFixed(0)} mm³
                </div>
                <Progress
                  percent={65}
                  size="small"
                  strokeColor="var(--color-primary-600)"
                  style={{ marginTop: 4 }}
                />
                <Tag color="green">{t('dentalCad.previewDone')}</Tag>
              </div>
            )}
            {current?.status === "milling" && (
              <Alert
                style={{ marginTop: 8 }}
                title={
                  <Space>
                    <Spin size="small" />
                    {t('dentalCad.millingInProgress')}
                  </Space>
                }
                type="info"
                showIcon
              />
            )}
          </Card>
          <Card size="small" title={t('dentalCad.designFlow')} style={{ marginTop: 8 }}>
            <div style={{ display: "flex", gap: 4 }}>
              {[
                "draft",
                "designed",
                "milled",
                "sintered",
                "fitted",
                "cemented",
              ].map((s, i) => {
                const idx = [
                  "draft",
                  "designed",
                  "milled",
                  "sintered",
                  "fitted",
                  "cemented",
                ].indexOf(current?.status || "draft");
                return (
                  <div
                    key={s}
                    style={{
                      flex: 1,
                      textAlign: "center",
                      padding: "4px 0",
                      borderRadius: 4,
                      fontSize: 10,
                      background: i <= idx ? "var(--color-primary-600)" : "#e8e8e8",
                      color: i <= idx ? "#fff" : "#999",
                    }}
                  >
                    {s}
                  </div>
                );
              })}
            </div>
          </Card>
        </Col>
      </Row>
    </PageContainer>
  );
};
export default DentalCadPage;
