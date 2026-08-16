// [v3.0.6.8-90] Phase 2: 头影测量分析
// 对标: Sidexis Ceph + Dolphin Imaging + Planmeca Romexis Ceph
// [G005 Wave1B] 6 处裸 fetch → dentalApi (后端 /dental/ceph/* + /dental/ortho/arch-analysis 真实实现)
import { dentalApi } from "../../services/api/dentalApi";
import { t } from "../../i18n/appI18n";
import {
  Card,
  Space,
  Tag,
  Button,
  Select,
  Row,
  Col,
  Statistic,
  message,
  Empty,
  Badge,
  Tooltip,
  Table,
  Modal,
  Input,
  InputNumber,
} from "antd";
import {
  Crosshair,
  Eye,
  Save,
  BarChart3,
  RotateCcw,
  Target,
  TrendingUp,
} from "lucide-react";
import { Inbox } from 'lucide-react'
import React, { useState, useEffect, useRef } from "react";

const ANALYSIS_TYPES = [
  { value: "steiner", label: "Steiner 分析法 (SNA/SNB/ANB)" },
  { value: "downs", label: "Downs 分析法" },
  { value: "mcmamara", label: "McNamara 分析法 (线距)" },
  { value: "ricketts", label: "Ricketts 分析法 (面部生长)" },
  { value: "tweeds", label: "Tweed 分析法 (诊断三角)" },
  { value: "coben", label: "Coben 分析法 (颅底三角)" },
];

export const DentalCephPage: React.FC = () => {
  const [studies, setStudies] = useState<any[]>([]);
  const [current, setCurrent] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [landmarks, setLandmarks] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [analysisTypes, setAnalysisTypes] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"list" | "analysis">("list");
  const [selType, setSelType] = useState("steiner");
  const [archData, setArchData] = useState<any>(null);
  const [dragPoint, setDragPoint] = useState<string | null>(null);
  const cephCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    dentalApi
      .getCadMaterials() // just to init connection
      .catch((err) => {
        console.error("[F04]", err);
      });
    fetchStudies();
    dentalApi.getCadTemplates().catch((err) => {
      console.error("[F04]", err);
    }); // ignore
  }, []);

  const fetchStudies = async () => {
    try {
      const res = await dentalApi.listCephStudies();
      if (res.success) setStudies(res.data || []);
    } catch (e) {
      console.warn("[F03] Error:", (e as Error)?.message);
    }
    try {
      const at = await dentalApi.getCephAnalysisTypes();
      if (at.success) setAnalysisTypes(at.data || []);
    } catch (e) {
      console.warn("[F03] Error:", (e as Error)?.message);
    }
  };

  const handleSelect = async (s: any) => {
    setCurrent(s);
    setMode("analysis");
    setBusy(true);
    try {
      // [G005 W3-B] 详情刷新: GET /dental/ceph/studies/:id (getCephStudy)
      const studyRes = await dentalApi.getCephStudy(s.id);
      if (studyRes.success && studyRes.data) setCurrent({ ...s, ...studyRes.data });
      const lm = await dentalApi.getCephLandmarks();
      const ld = lm;
      if (ld.success) setLandmarks(ld.data || {});
      if (s.analysisType) {
        const ar = await dentalApi.getCephAnalysis(s.id);
        const ad = ar;
        if (ad.success) setAnalysis(ad.data);
      }
    } catch (e) {
      console.warn("[F03] Error:", (e as Error)?.message);
    }
    setBusy(false);
  };

  // [G005 W3-B] 新建头影检查: POST /dental/ceph/studies (createCephStudy)
  const [createModal, setCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [cephForm, setCephForm] = useState({
    patientName: "",
    age: 12,
    gender: "M",
    analysisType: "steiner",
    acquisitionDate: new Date().toISOString().slice(0, 10),
  });
  const handleCreateStudy = async () => {
    if (!cephForm.patientName.trim()) {
      message.warning("请输入患者姓名");
      return;
    }
    setCreating(true);
    try {
      const res = await dentalApi.createCephStudy({
        ...cephForm,
        patientId: `C${Date.now()}`,
        status: "pending",
      });
      if (res.success && res.data) {
        message.success("头影检查已登记");
        setCreateModal(false);
        setCephForm({ ...cephForm, patientName: "" });
        await fetchStudies();
      } else {
        message.error(res.error?.message ?? "登记失败");
      }
    } catch (e) {
      message.error((e as Error)?.message ?? "登记失败");
    } finally {
      setCreating(false);
    }
  };

  const handleRunAnalysis = async () => {
    if (!current) return;
    setBusy(true);
    try {
      const r = await dentalApi.runCephAnalysis(current.id, selType);
      if (r.success && r.data) setAnalysis(r.data);
      message.success("头影测量分析完成");
    } catch (e: any) {
      message.error(e.message);
    }
    setBusy(false);
  };

  const handleArchAnalysis = async () => {
    setBusy(true);
    try {
      const r = await dentalApi.analyzeDentalArch();
      if (r.success && r.data) setArchData(r.data);
      message.success("牙弓分析完成");
    } catch (e) {
      console.warn("[F03] Error:", (e as Error)?.message);
    }
    setBusy(false);
  };

  // 头影测量 Canvas
  useEffect(() => {
    const canvas = cephCanvasRef.current;
    if (!canvas || mode !== "analysis") return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width,
      h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    // 背景
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, w, h);
    // 网格
    ctx.strokeStyle = "#1a1a3a";
    ctx.lineWidth = 0.5;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    // 颅骨轮廓 (模拟)
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(220, 150, 60, -0.5, 1.0);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(240, 250, 60, 80, 0, 0, Math.PI);
    ctx.stroke();
    // 标记?+ 连接?
    const pts = Object.entries(landmarks);
    if (pts.length > 0) {
      ctx.strokeStyle = "#555";
      ctx.lineWidth = 1;
      // 连接 SN + NA + NB + Pog-Me ?
      const lines = [
        ["N", "S"],
        ["N", "A"],
        ["A", "B"],
        ["B", "Pog"],
        ["Pog", "Me"],
        ["Go", "Me"],
        ["Go", "Ar"],
        ["Ar", "S"],
        ["ANS", "PNS"],
        ["Or", "Po"],
      ];
      lines.forEach(([a, b]) => {
        if (a && b && landmarks[a] && landmarks[b]) {
          ctx.beginPath();
          ctx.moveTo(landmarks[a].x, landmarks[a].y);
          ctx.lineTo(landmarks[b].x, landmarks[b].y);
          ctx.stroke();
        }
      });
      pts.forEach(([k, v]) => {
        ctx.beginPath();
        ctx.arc(v.x, v.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#ff4d4f";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "#94a3b8";
        ctx.font = "10px monospace";
        ctx.fillText(k, v.x + 8, v.y - 4);
      });
    }
  }, [landmarks, mode]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!current || !cephCanvasRef.current) return;
    const rect = cephCanvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left,
      y = e.clientY - rect.top;
    // 找最近的标记?
    const closest = Object.entries(landmarks).reduce(
      (best, [k, v]) => {
        const d = Math.hypot(v.x - x, v.y - y);
        return d < best.dist ? { key: k, dist: d } : best;
      },
      { key: "", dist: 100 },
    );
    if (closest.dist < 20) {
      setDragPoint(closest.key);
      return;
    }
    // 自动添加新点 (使用默认?
    const labels = ["A", "B", "C", "D", "E", "Pt", "Or", "Po", "Go", "Me"];
    const existing = Object.keys(landmarks);
    const nextLabel =
      labels.find((l) => !existing.includes(l)) || `P${existing.length + 1}`;
    setLandmarks((prev) => ({ ...prev, [nextLabel]: { x, y } }));
  };

  const handleCanvasMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragPoint || !cephCanvasRef.current) return;
    const rect = cephCanvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left,
      y = e.clientY - rect.top;
    setLandmarks((prev) => ({ ...prev, [dragPoint]: { x, y } }));
  };

  if (mode === "list") {
    return (
      <div style={{ padding: 24, background: "var(--bg-card)", minHeight: "100vh" }}>
        <Space style={{ marginBottom: 16 }}>
          <Crosshair size={20} color="#2563eb" />
          <span style={{ fontSize: 18, fontWeight: 600 }}>
            头影测量分析中心
          </span>
          <Tag color="cyan">v3.0.6.8-90</Tag>
          <Tag color="blue">Sidexis Ceph 对标</Tag>
          <Tag color="purple">Dolphin 对标</Tag>
          {/* [G005 Wave1B] /dental/ceph/* + /dental/ortho/arch-analysis 后端真实实现, dentalApi 封装 */}
          <Tag color="green">真实后端 /dental/ceph/*</Tag>
          {/* [G005 W3-B] 新建头影检查: POST /dental/ceph/studies (createCephStudy) */}
          <Button size="small" type="primary" onClick={() => setCreateModal(true)}>{t("w3b.cephCreate")}</Button>
        </Space>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={4}>
            <Card size="small">
              <Statistic title="总片数" value={studies.length} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic
                title="已分析"
                value={
                  studies.filter((s: any) => s.status === "analyzed").length
                }
                styles={{ content: {  color: "#52c41a"  } }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic
                title="待分析"
                value={
                  studies.filter((s: any) => s.status === "pending").length
                }
                styles={{ content: {  color: "#faad14"  } }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic title="分析类型" value={analysisTypes.length} />
            </Card>
          </Col>
        </Row>
        <Row gutter={12}>
          {studies.map((s: any) => (
            <Col span={6} key={s.id}>
              <Card
                size="small"
                hoverable
                onClick={() => handleSelect(s)}
                style={{
                  cursor: "pointer",
                  marginBottom: 12,
                  borderLeft: `4px solid ${s.status === "analyzed" ? "#52c41a" : "#faad14"}`,
                }}
              >
                <Space
                  style={{ justifyContent: "space-between", width: "100%" }}
                >
                  <Tag color="blue">{s.patientName}</Tag>
                  <Badge
                    status={s.status === "analyzed" ? "success" : "processing"}
                    text={s.status}
                  />
                </Space>
                <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-secondary)" }}>
                  {s.age}岁 {s.gender === "M" ? "男" : "女"} |{" "}
                  {s.analysisType || "未分析"} | {s.acquisitionDate}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
        {/* [G005 W3-B] 新建头影检查 Modal: createCephStudy (POST /dental/ceph/studies) */}
        <Modal
          title={t("w3b.cephNewStudy")}
          open={createModal}
          onCancel={() => setCreateModal(false)}
          onOk={() => void handleCreateStudy()}
          confirmLoading={creating}
          width={460}
        >
          <Row gutter={12} style={{ marginTop: 8 }}>
            <Col span={12}>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>{t("w3b.patientName")}</div>
              <Input
                value={cephForm.patientName}
                onChange={(e) => setCephForm({ ...cephForm, patientName: e.target.value })}
                placeholder="请输入患者姓名"
              />
            </Col>
            <Col span={6}>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>年龄</div>
              <InputNumber min={3} max={90} style={{ width: "100%" }} value={cephForm.age}
                onChange={(v) => setCephForm({ ...cephForm, age: v ?? 12 })} />
            </Col>
            <Col span={6}>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>性别</div>
              <Select style={{ width: "100%" }} value={cephForm.gender}
                onChange={(v) => setCephForm({ ...cephForm, gender: v })}
                options={[{ value: "M", label: "男" }, { value: "F", label: "女" }]} />
            </Col>
            <Col span={24} style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>分析类型</div>
              <Select style={{ width: "100%" }} value={cephForm.analysisType}
                onChange={(v) => setCephForm({ ...cephForm, analysisType: v })}
                options={ANALYSIS_TYPES} />
            </Col>
          </Row>
        </Modal>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, background: "var(--bg-card)", minHeight: "100vh" }}>
      <Space style={{ marginBottom: 12 }}>
        <Button icon={<RotateCcw size={14} />} onClick={() => setMode("list")}>
          返回
        </Button>
        <Crosshair size={18} color="#2563eb" />
        <span style={{ fontSize: 16, fontWeight: 600 }}>
          头影测量 - {current?.patientName}
        </span>
        <Tag color="cyan">v3.0.6.8-90</Tag>
        <Tag color="blue">{current?.age}岁</Tag>
      </Space>
      <Row gutter={12}>
        <Col span={16}>
          <Card
            size="small"
            title={
              <Space>
                <Target size={14} />
                解剖标志点标记
              </Space>
            }
            extra={
              <Tooltip title="点击添加标记点, 拖拽移动已有标记点">
                <Tag>点击/拖拽</Tag>
              </Tooltip>
            }
          >
            <canvas
              ref={cephCanvasRef}
              width={480}
              height={400}
              onClick={handleCanvasClick}
              onMouseDown={(e) => {
                if (!cephCanvasRef.current) return;
                const rect = cephCanvasRef.current.getBoundingClientRect();
                const x = e.clientX - rect.left,
                  y = e.clientY - rect.top;
                const closest = Object.entries(landmarks).reduce(
                  (best, [k, v]) => {
                    const d = Math.hypot(v.x - x, v.y - y);
                    return d < best.dist ? { key: k, dist: d } : best;
                  },
                  { key: "", dist: 100 },
                );
                if (closest.dist < 20) {
                  setDragPoint(closest.key);
                  e.preventDefault();
                }
              }}
              onMouseUp={() => setDragPoint(null)}
              onMouseMove={handleCanvasMove}
              onMouseLeave={() => setDragPoint(null)}
              style={{
                width: "100%",
                height: 360,
                borderRadius: 8,
                cursor: "crosshair",
              }}
            />
            <Space style={{ marginTop: 8 }}>
              <Button
                size="small"
                icon={<Eye size={10} />}
                onClick={handleRunAnalysis}
                type="primary"
                loading={busy}
              >
                运行{" "}
                {ANALYSIS_TYPES.find((a) => a.value === selType)?.label ||
                  "分析"}
              </Button>
              <Button
                size="small"
                icon={<Save size={10} />}
                onClick={async () => {
                  try {
                    const r = await dentalApi.saveCephLandmarks(current.id, landmarks);
                    if (r.success) message.success("已保存");
                  } catch (e) {
                    console.warn("[F03] Error:", (e as Error)?.message);
                  }
                }}
              >
                保存标记
              </Button>
              <Select
                value={selType}
                onChange={setSelType}
                size="small"
                options={ANALYSIS_TYPES}
                style={{ width: 260 }}
              />
              <Button
                size="small"
                icon={<TrendingUp size={10} />}
                onClick={handleArchAnalysis}
                loading={busy}
              >
                牙弓分析
              </Button>
            </Space>
          </Card>
        </Col>
        <Col span={8}>
          {analysis ? (
            <Card
              size="small"
              title={
                <Space>
                  <BarChart3 size={14} />
                  测量结果 - {analysis.analysisType}
                </Space>
              }
            >
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>
                诊断: {analysis.diagnosis}
              </div>
              <Table
                dataSource={analysis.measurements}
                rowKey="key"
                size="small"
                pagination={false}
                columns={[
                  { title: "测量项", dataIndex: "label", width: 100 },
                  {
                    title: "值",
                    dataIndex: "value",
                    width: 60,
                    render: (v: number) => <b>{v}</b>,
                  },
                  { title: "单位", dataIndex: "unit", width: 40 },
                  {
                    title: "正常范围",
                    dataIndex: "norm",
                    width: 80,
                    render: (n: any) => `${n.min}-${n.max}`,
                  },
                  {
                    title: "状态",
                    dataIndex: "status",
                    width: 80,
                    render: (s: string) => (
                      <Badge
                        status={s === "normal" ? "success" : "warning"}
                        text={s}
                      />
                    ),
                  },
                ]}
              scroll={{ x: 'max-content' }}
              />
            </Card>
          ) : (
            <Card size="small" title="分析结果">
              <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="点击「运行分析」生成测量结果" />
            </Card>
          )}
          {archData && (
            <Card
              size="small"
              title={
                <Space>
                  <TrendingUp size={14} />
                  牙弓分析
                </Space>
              }
              style={{ marginTop: 8 }}
            >
              <Space wrap>
                <Tag>上颌弓长 {archData.maxillaArch.archLength}mm</Tag>
                <Tag>下颌弓长 {archData.mandibleArch.archLength}mm</Tag>
                <Tag>上颌拥挤 {archData.discrepancy.maxillaCrowding}mm</Tag>
                <Tag>下颌拥挤 {archData.discrepancy.mandibleCrowding}mm</Tag>
                <Tag
                  color={archData.discrepancy.needExtraction ? "red" : "green"}
                >
                  {archData.discrepancy.needExtraction ? "需拔牙" : "非拔牙"}
                </Tag>
              </Space>
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
};
export default DentalCephPage;
