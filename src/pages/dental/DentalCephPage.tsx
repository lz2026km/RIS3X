// [v3.0.6.8-90] Phase 2: 头影测量分析
// 对标: Sidexis Ceph + Dolphin Imaging + Planmeca Romexis Ceph
// [G005 Wave1B] 6 处裸 fetch → dentalApi (后端 /dental/ceph/* + /dental/ortho/arch-analysis 真实实现)
import { dentalApi } from "../../services/api/dentalApi";
import { ErrorBanner } from "../../components/feedback";
import { t } from "../../i18n/appI18n";
import { DataTable, PageContainer, StatCard, StatCardGrid } from "../../components/common";
import {
  Card,
  Space,
  Tag,
  Button,
  Select,
  Row,
  Col,
  message,
  Empty,
  Badge,
  Tooltip,
  Modal,
  Input,
  InputNumber,
  Alert,
  Spin,
} from "antd";
import {
  Crosshair,
  Eye,
  Save,
  BarChart3,
  RotateCcw,
  Target,
  TrendingUp,
  ListTree,
} from "lucide-react";
import { Inbox } from 'lucide-react'
import React, { useState, useEffect, useRef } from "react";

const ANALYSIS_TYPES = [
  { value: "steiner", label: t("ceph.analysis.steiner") },
  { value: "downs", label: t("ceph.analysis.downs") },
  { value: "mcmamara", label: t("ceph.analysis.mcnamara") },
  { value: "ricketts", label: t("ceph.analysis.ricketts") },
  { value: "tweeds", label: t("ceph.analysis.tweed") },
  { value: "coben", label: t("ceph.analysis.coben") },
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  // [G005 W4B] 标定点定义/分析类型 (GET /dental/ceph/landmarks + /dental/ceph/:id/landmarks)
  const [lmDefOpen, setLmDefOpen] = useState(false);
  const [lmDefLoading, setLmDefLoading] = useState(false);
  const [lmDefError, setLmDefError] = useState<string | null>(null);
  const [globalLandmarks, setGlobalLandmarks] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [studyLandmarks, setStudyLandmarks] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [studyLandmarkSource, setStudyLandmarkSource] = useState<string>("default");

  const openLandmarkDefs = async (studyId?: string) => {
    setLmDefOpen(true);
    setLmDefLoading(true);
    setLmDefError(null);
    try {
      // GET /dental/ceph/landmarks — 全局默认标定点集
      const g = await dentalApi.getCephLandmarks();
      if (g.success) setGlobalLandmarks(g.data || {});
      if (studyId) {
        // GET /dental/ceph/:id/landmarks — 单检查标定点集
        const s = await dentalApi.getCephLandmarks(studyId);
        if (s.success) {
          setStudyLandmarks(s.data || {});
          setStudyLandmarkSource((s as { meta?: { source?: string } }).meta?.source ?? "default");
        }
      }
    } catch (e) {
      setLmDefError(
        (e as Error)?.message ?? t("w4b.ceph.loadFailed"),
      );
    } finally {
      setLmDefLoading(false);
    }
  };

  useEffect(() => {
    setLoadError(null);
    dentalApi
      .getCadMaterials() // just to init connection
      .catch((err) => {
        console.error("[F04]", err);
      });
    fetchStudies();
    dentalApi.getCadTemplates().catch((err) => {
      console.error("[F04]", err);
    }); // ignore
  }, [reloadTick]);

  const fetchStudies = async () => {
    try {
      const res = await dentalApi.listCephStudies();
      if (res.success) setStudies(res.data || []);
      else setLoadError(t("w9.states.error"));
    } catch (e) {
      setLoadError(t("w9.states.error"));
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
      message.warning(t("ceph.enterPatientName"));
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
        message.success(t("ceph.registered"));
        setCreateModal(false);
        setCephForm({ ...cephForm, patientName: "" });
        await fetchStudies();
      } else {
        message.error(res.error?.message ?? t("ceph.registerFailed"));
      }
    } catch (e) {
      message.error((e as Error)?.message ?? t("ceph.registerFailed"));
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
      message.success(t("ceph.analysisDone"));
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
      message.success(t("ceph.archDone"));
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
      <PageContainer padding={24}>
        <Space style={{ marginBottom: 16 }}>
          <Crosshair size={20} color="#2563eb" />
          <span style={{ fontSize: 18, fontWeight: 600 }}>
            {t("ceph.title")}
          </span>
          <Tag color="cyan">v3.0.6.8-90</Tag>
          <Tag color="blue">{t("ceph.benchSidexis")}</Tag>
          <Tag color="purple">{t("ceph.benchDolphin")}</Tag>
          {/* [G005 Wave1B] /dental/ceph/* + /dental/ortho/arch-analysis 后端真实实现, dentalApi 封装 */}
          <Tag color="green">{t("ceph.realBackend")}</Tag>
          {/* [G005 W3-B] 新建头影检查: POST /dental/ceph/studies (createCephStudy) */}
          <Button size="small" type="primary" onClick={() => setCreateModal(true)}>{t("w3b.cephCreate")}</Button>
        </Space>
        {loadError && <ErrorBanner message={loadError} onRetry={() => setReloadTick((n) => n + 1)} retryLabel={t("w9.states.retry")} />}
        <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 16 }}>
          <StatCard title={t("ceph.totalStudies")} value={studies.length} icon={<Crosshair size={16} />} />
          <StatCard title={t("ceph.analyzed")} value={studies.filter((s: any) => s.status === "analyzed").length} color="success" />
          <StatCard title={t("ceph.pending")} value={studies.filter((s: any) => s.status === "pending").length} color="warning" />
          <StatCard title={t("ceph.analysisTypes")} value={analysisTypes.length} />
        </StatCardGrid>
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
                  {s.age}{t("ceph.ageSuffix")} {s.gender === "M" ? t("ceph.male") : t("ceph.female")} |{" "}
                  {s.analysisType || t("ceph.notAnalyzed")} | {s.acquisitionDate}
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
                placeholder={t("ceph.enterPatientName")}
              />
            </Col>
            <Col span={6}>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>{t("ceph.age")}</div>
              <InputNumber min={3} max={90} style={{ width: "100%" }} value={cephForm.age}
                onChange={(v) => setCephForm({ ...cephForm, age: v ?? 12 })} />
            </Col>
            <Col span={6}>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>{t("ceph.gender")}</div>
              <Select style={{ width: "100%" }} value={cephForm.gender}
                onChange={(v) => setCephForm({ ...cephForm, gender: v })}
                options={[{ value: "M", label: t("ceph.male") }, { value: "F", label: t("ceph.female") }]} />
            </Col>
            <Col span={24} style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>{t("ceph.analysisTypes")}</div>
              <Select style={{ width: "100%" }} value={cephForm.analysisType}
                onChange={(v) => setCephForm({ ...cephForm, analysisType: v })}
                options={ANALYSIS_TYPES} />
            </Col>
          </Row>
        </Modal>
      </PageContainer>
    );
  }

  return (
    <PageContainer padding={16}>
      <Space style={{ marginBottom: 12 }}>
        <Button icon={<RotateCcw size={14} />} onClick={() => setMode("list")}>
          {t("ceph.back")}
        </Button>
        <Crosshair size={18} color="#2563eb" />
        <span style={{ fontSize: 16, fontWeight: 600 }}>
          {t("ceph.shortTitle")} - {current?.patientName}
        </span>
        <Tag color="cyan">v3.0.6.8-90</Tag>
        <Tag color="blue">{current?.age}{t("ceph.ageSuffix")}</Tag>
      </Space>
      <Row gutter={12}>
        <Col span={16}>
          <Card
            size="small"
            title={
              <Space>
                <Target size={14} />
                {t("ceph.landmarkMarking")}
              </Space>
            }
            extra={
              <Tooltip title={t("ceph.canvasHint")}>
                <Tag>{t("ceph.clickDrag")}</Tag>
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
                {t("ceph.run")}{" "}
                {ANALYSIS_TYPES.find((a) => a.value === selType)?.label ||
                  t("ceph.analysis")}
              </Button>
              <Button
                size="small"
                icon={<Save size={10} />}
                onClick={async () => {
                  try {
                    const r = await dentalApi.saveCephLandmarks(current.id, landmarks);
                    if (r.success) message.success(t("ceph.saved"));
                  } catch (e) {
                    console.warn("[F03] Error:", (e as Error)?.message);
                  }
                }}
              >
                {t("ceph.saveLandmarks")}
              </Button>
              {/* [G005 W4B] 标定点定义/分析类型 (GET /dental/ceph/landmarks + /:id/landmarks) */}
              <Button
                size="small"
                icon={<ListTree size={10} />}
                onClick={() => void openLandmarkDefs(current?.id)}
              >
                {t("w4b.ceph.landmarks")}
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
                {t("ceph.archAnalysis")}
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
                  {t("ceph.measureResults")} - {analysis.analysisType}
                </Space>
              }
            >
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>
                {t("ceph.diagnosis")}{analysis.diagnosis}
              </div>
              <DataTable
                dataSource={analysis.measurements}
                rowKey="key"
                pagination={false}
                columns={[
                  { title: t("ceph.colItem"), dataIndex: "label", width: 100 },
                  {
                    title: t("ceph.colValue"),
                    dataIndex: "value",
                    width: 60,
                    render: (v: number) => <b>{v}</b>,
                  },
                  { title: t("ceph.colUnit"), dataIndex: "unit", width: 40 },
                  {
                    title: t("ceph.colNorm"),
                    dataIndex: "norm",
                    width: 80,
                    render: (n: any) => `${n.min}-${n.max}`,
                  },
                  {
                    title: t("ceph.colStatus"),
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
            <Card size="small" title={t("ceph.analysisResult")}>
              <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t("ceph.emptyAnalysis")} />
            </Card>
          )}
          {archData && (
            <Card
              size="small"
              title={
                <Space>
                  <TrendingUp size={14} />
                  {t("ceph.archAnalysis")}
                </Space>
              }
              style={{ marginTop: 8 }}
            >
              <Space wrap>
                <Tag>{t("ceph.maxillaArch")}{archData.maxillaArch.archLength}mm</Tag>
                <Tag>{t("ceph.mandibleArch")}{archData.mandibleArch.archLength}mm</Tag>
                <Tag>{t("ceph.maxillaCrowding")}{archData.discrepancy.maxillaCrowding}mm</Tag>
                <Tag>{t("ceph.mandibleCrowding")}{archData.discrepancy.mandibleCrowding}mm</Tag>
                <Tag
                  color={archData.discrepancy.needExtraction ? "red" : "green"}
                >
                  {archData.discrepancy.needExtraction ? t("ceph.needExtraction") : t("ceph.noExtraction")}
                </Tag>
              </Space>
            </Card>
          )}
        </Col>
      </Row>

      {/* [G005 W4B] 标定点定义/分析类型弹窗 */}
      <Modal
        title={t("w4b.ceph.landmarksTitle")}
        open={lmDefOpen}
        onCancel={() => setLmDefOpen(false)}
        footer={null}
        width={720}
      >
        {lmDefError && <Alert type="error" showIcon message={lmDefError} style={{ marginBottom: 12 }} />}
        <Spin spinning={lmDefLoading}>
          <div style={{ marginBottom: 16 }}>
            <Space style={{ marginBottom: 8 }}>
              <b>{t("w4b.ceph.analysisCount")}</b>
              <Tag color="blue">{analysisTypes.length}</Tag>
            </Space>
            <DataTable
              rowKey="id"
              pagination={false}
              dataSource={analysisTypes}
              columns={[
                { title: t("ceph.colItem"), dataIndex: "name", width: 160 },
                { title: t("ceph.analysis"), dataIndex: "description", ellipsis: true },
                {
                  title: t("w4b.ceph.landmarkCount"),
                  key: "lm",
                  width: 90,
                  render: (_: unknown, r: any) => (r.landmarks?.length ?? 0),
                },
                {
                  title: t("w4b.ceph.measurements"),
                  dataIndex: "keyMeasurements",
                  render: (v: string[]) => (
                    <Space wrap size={4}>
                      {(v ?? []).map((k) => (
                        <Tag key={k} style={{ fontSize: 11 }}>{k}</Tag>
                      ))}
                    </Space>
                  ),
                },
              ]}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <Space style={{ marginBottom: 8 }}>
              <b>{t("w4b.ceph.currentLandmarks")}</b>
              <Tag color={studyLandmarkSource === "saved" ? "green" : "default"}>
                {t("w4b.ceph.source")}: {studyLandmarkSource === "saved" ? t("w4b.ceph.sourceSaved") : t("w4b.ceph.sourceDefault")}
              </Tag>
            </Space>
            <DataTable
              rowKey="key"
              pagination={false}
              dataSource={Object.entries(studyLandmarks).map(([key, v]) => ({ key, ...v }))}
              columns={[
                { title: t("w4b.ceph.landmarkKey"), dataIndex: "key", width: 100 },
                { title: t("w4b.ceph.coordX"), dataIndex: "x", width: 90 },
                { title: t("w4b.ceph.coordY"), dataIndex: "y", width: 90 },
              ]}
            />
          </div>
          <div>
            <Space style={{ marginBottom: 8 }}>
              <b>{t("w4b.ceph.landmarks")} (18)</b>
              <Tag>{Object.keys(globalLandmarks).length}</Tag>
            </Space>
            <DataTable
              rowKey="key"
              pagination={false}
              dataSource={Object.entries(globalLandmarks).map(([key, v]) => ({ key, ...v }))}
              columns={[
                { title: t("w4b.ceph.landmarkKey"), dataIndex: "key", width: 100 },
                { title: t("w4b.ceph.coordX"), dataIndex: "x", width: 90 },
                { title: t("w4b.ceph.coordY"), dataIndex: "y", width: 90 },
              ]}
            />
          </div>
        </Spin>
      </Modal>
    </PageContainer>
  );
};
export default DentalCephPage;
