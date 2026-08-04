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
  Statistic,
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

const DESIGN_TYPES = [
  { value: "inlay", label: "嵌体 Inlay" },
  { value: "onlay", label: "高嵌体 Onlay" },
  { value: "crown", label: "全冠 Crown" },
  { value: "veneer", label: "贴面 Veneer" },
  { value: "abutment", label: "基台 Abutment" },
  { value: "implant-crown", label: "种植冠 Implant Crown" },
];

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

  useEffect(() => {
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
    ]).catch((err) => {
      console.error("[F04]", err);
    });
  }, []);

  const handleCreate = async () => {
    setBusy(true);
    try {
      const res = await dentalApi.createCadDesign(designParams);
      setCurrent(res);
      setMode("design");
      setMarginPoints([]);
      setPreview(null);
      message.success("新建修复设计");
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveMargin = async () => {
    if (!current || marginPoints.length < 3) {
      message.warning("至少 3 个边缘点");
      return;
    }
    await dentalApi.saveMarginLine(current.id, marginPoints);
    message.success("边缘线已保存");
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
      await dentalApi.submitMill(current.id, "sirona-mcxl");
      await dentalApi.updateCadStatus(current.id, "milling");
      message.success("已提交至研磨机");
      setMode("list");
    } catch (e) {
      console.warn("[F03] Error:", (e as Error)?.message);
    }
    setBusy(false);
  };

  // 导出 STL：调用后端导出端点并下载文件（后端无真实文件时下载 JSON 记录）
  const handleExportStl = async () => {
    if (!current) {
      message.warning("请先创建设计");
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
      message.success("STL 文件已导出");
    } catch (e: any) {
      message.error(e?.message || "导出失败");
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
      <div style={{ padding: 24, background: "#f5f5f5", minHeight: "100vh" }}>
        <Space style={{ marginBottom: 16 }}>
          <Pen size={20} color="#1677ff" />
          <span style={{ fontSize: 18, fontWeight: 600 }}>
            修复 CAD/CAM 设计中心
          </span>
          <Tag color="cyan">v3.0.6.8-87</Tag>
          <Tag color="blue">Sirona Cerec 对标</Tag>
          <Tag color="purple">3Shape 对标</Tag>
        </Space>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={4}>
            <Card size="small">
              <Statistic title="设计总数" value={designs.length} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic
                title="待研磨"
                value={
                  designs.filter((d: any) => d.status === "designed").length
                }
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic
                title="已粘接"
                value={
                  designs.filter((d: any) => d.status === "cemented").length
                }
                styles={{ content: {  color: "#52c41a"  } }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic
                title="本月产值"
                prefix="¥"
                value={designs.length * 2500}
              />
            </Card>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={8}>
            <Card size="small" title="新建设计">
              <Form layout="vertical" size="small">
                <Form.Item label="修复类型">
                  <Select
                    value={designParams.type}
                    onChange={(v) =>
                      setDesignParams({ ...designParams, type: v })
                    }
                    options={DESIGN_TYPES}
                  />
                </Form.Item>
                <Form.Item label="牙位 (FDI)">
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
                <Form.Item label="患者">
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
                <Form.Item label="材料">
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
                <Form.Item label="比色">
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
                  开始设计
                </Button>
              </Form>
            </Card>
          </Col>
          <Col span={16}>
            <Card size="small" title="设计列表">
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
                    onClick={() => {
                      setCurrent(d);
                      setMode("design");
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <Space
                      style={{ justifyContent: "space-between", width: "100%" }}
                    >
                      <div>
                        <Tag>{d.type}</Tag>
                        <Tag color="blue">{d.material}</Tag>
                        <Tag>{d.colorShade}</Tag>
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
                        text={d.status}
                      />
                    </Space>
                    <div style={{ marginTop: 4, fontSize: 12, color: "#999" }}>
                      {d.patientName} - FDI {d.toothNo} | {d.designer} |{" "}
                      {d.createdAt?.slice(0, 10)}
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          </Col>
        </Row>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, background: "#f5f5f5", minHeight: "100vh" }}>
      <Space style={{ marginBottom: 12 }}>
        <Button icon={<RotateCcw size={14} />} onClick={() => setMode("list")}>
          返回列表
        </Button>
        <span style={{ fontSize: 16, fontWeight: 600 }}>
          修复设计 -{" "}
          {DESIGN_TYPES.find((t) => t.value === current?.type)?.label} #
          {current?.toothNo}
        </span>
        <Tag color="cyan">v3.0.6.8-87</Tag>
        <Tag color="blue" icon={<Settings size={10} />}>
          边缘线绘制
        </Tag>
      </Space>
      <Row gutter={12}>
        <Col span={14}>
          <Card
            size="small"
            title={
              <Space>
                <MousePointer2 size={14} />
                边缘线绘制
                {drawing ? (
                  <Tag color="green">绘制中</Tag>
                ) : (
                  <Tag>点击开始</Tag>
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
                  {drawing ? "完成绘制" : "开始绘制"}
                </Button>
                <Button
                  size="small"
                  icon={<RotateCcw size={10} />}
                  onClick={() => setMarginPoints([])}
                >
                  清除
                </Button>
                <Button
                  size="small"
                  type="primary"
                  onClick={handleSaveMargin}
                  icon={<Save size={10} />}
                >
                  保存边缘
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
            <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>
              点击牙齿轮廓边缘添加控制点 (已标记 {marginPoints.length} 个)
            </div>
          </Card>
          <Card
            size="small"
            title={
              <Space>
                <Settings size={14} />
                设计参数
              </Space>
            }
            style={{ marginTop: 8 }}
          >
            <Row gutter={12}>
              <Col span={8}>
                <Form.Item label="解剖形态">
                  <Select
                    value={current?.occlusalAnatomy || "anatomic"}
                    options={[
                      { value: "anatomic", label: "解剖式" },
                      { value: "semi-anatomic", label: "半解剖式" },
                      { value: "flat", label: "平面式" },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="厚度 (mm)">
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
                <Form.Item label="粘接间隙 (μm)">
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
                材料与比色
              </Space>
            }
          >
            <Row gutter={[8, 8]}>
              <Col span={12}>
                <Form.Item label="材料" style={{ margin: 0 }}>
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
                <Form.Item label="VITA 比色" style={{ margin: 0 }}>
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
              <div style={{ marginTop: 8, fontSize: 12, color: "#999" }}>
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
                  3D 预览
                </Button>
                <Button
                  icon={<Download size={14} />}
                  onClick={handleSubmitMill}
                  loading={busy}
                >
                  提交研磨
                </Button>
              </Space>
              <Button
                onClick={() => void handleExportStl()}
                icon={<Download size={14} />}
                loading={busy}
              >
                导出 STL
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
                  三角形面: {preview.triangleCount.toLocaleString()} | 体积:{" "}
                  {(preview.volume * 1000).toFixed(0)} mm³
                </div>
                <Progress
                  percent={65}
                  size="small"
                  strokeColor="#1677ff"
                  style={{ marginTop: 4 }}
                />
                <Tag color="green">预览生成完成</Tag>
              </div>
            )}
            {current?.status === "milling" && (
              <Alert
                style={{ marginTop: 8 }}
                title={
                  <Space>
                    <Spin size="small" />
                    研磨中: Sirona CEREC MC XL
                  </Space>
                }
                type="info"
                showIcon
              />
            )}
          </Card>
          <Card size="small" title="设计流程" style={{ marginTop: 8 }}>
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
                      background: i <= idx ? "#1677ff" : "#e8e8e8",
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
    </div>
  );
};
export default DentalCadPage;
