/**
 * [G005 Wave 4B] 影像像素实验室 (EyePixelPage) — /eye/pixel-lab
 * 对标: ZEISS FORUM 像素分析 / Heidelberg HEYEX 2 / Topcon Synergy
 * 端点: eyeApi.pixel 7 方法 (instance/histogram/colormap/sharpness/mpr/detect-artifact + colormaps 目录)
 *   - 后端 /eye/pixel/* 已实现 (eye-pixel.module), MSW eyePixelRenderModule 兜底
 */
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Card, Col, Row, Tag, Space, Select, Button, Spin, Progress, Alert,
  Divider, Statistic, Tooltip, message, Empty, Switch,
} from "antd";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  ScanLine, Activity, Palette, Focus, ShieldAlert, Layers,
  Database, RefreshCw, Grid3X3, Droplets, BarChart2,
} from "lucide-react";
import { eyeApi } from "@/services/api/eyeApi";
import { t } from "../../../i18n/appI18n";

const FRAME_COUNT = 30;

const FALLBACK_STUDIES = [
  { id: "STU-DEMO-001", studyId: "STU-DEMO-001", patientName: "演示患者", modality: "Fundus", eye: "OD", acquisitionDate: "2026-07-08", deviceModel: "Topcon TRC-NW400", status: "reviewed" },
  { id: "STU-DEMO-002", studyId: "STU-DEMO-002", patientName: "演示患者", modality: "OCT", eye: "OS", acquisitionDate: "2026-07-08", deviceModel: "Optovue RTVue XR", status: "acquired" },
];

const FALLBACK_COLORMAPS = [
  { id: "fundus", name: "眼底彩照", type: "GRAY", description: "眼底彩照原色映射" },
  { id: "oct", name: "OCT 灰度", type: "GRAY", description: "OCT B-scan 灰度线性映射" },
  { id: "octa", name: "OCT-A 血管", type: "JET", description: "OCT-A 血流信号 JET 伪彩" },
  { id: "ffa", name: "FFA 荧光", type: "GRAY_INVERT", description: "荧光素眼底血管造影负片映射" },
  { id: "visualfield", name: "视野", type: "RAINBOW", description: "视野敏感度 RAINBOW 伪彩" },
  { id: "topography", name: "角膜地形", type: "SPECTRUM", description: "角膜地形图 SPECTRUM 光谱映射" },
  { id: "icg", name: "ICG 荧光", type: "PET", description: "吲哚菁绿造影 PET 热伪彩" },
  { id: "biometry", name: "生物测量", type: "BONE", description: "眼生物测量 BONE 骨密度伪彩" },
];

const ARTIFACT_LABELS: Record<string, string> = {
  motion: "运动伪影",
  eyelid: "眼睑遮挡",
  noise: "噪声",
  shadow: "阴影伪影",
  saturation: "过曝",
};

/** 绘制 256 色 LUT 色条 (canvas) */
function drawLutBar(canvas: HTMLCanvasElement | null, lut?: Array<[number, number, number]>) {
  if (!canvas || !lut || lut.length < 2) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  for (let x = 0; x < w; x += 1) {
    const idx = Math.floor((x / w) * (lut.length - 1));
    const [r, g, b] = lut[idx] ?? [0, 0, 0];
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(x, 0, 1, h);
  }
}

/** 生成合成灰度眼底图并应用 LUT (可选) 渲染到 canvas */
function renderPreview(
  canvas: HTMLCanvasElement | null,
  lut?: Array<[number, number, number]> | null,
  frame = 1,
) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const imageData = ctx.createImageData(w, h);
  const data = imageData.data;
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) / 2 - 12;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let gray = 0;
      if (dist <= radius) {
        const discX = cx - radius * 0.35;
        const discY = cy - radius * 0.2;
        const discDist = Math.sqrt((x - discX) ** 2 + (y - discY) ** 2);
        const disc = Math.max(0, 1 - discDist / 30) * 90;
        const macDist = Math.sqrt(dx * dx + dy * dy);
        const macula = macDist < 26 ? -45 : 0;
        const angle = Math.atan2(dy, dx);
        const vessel = Math.abs(Math.sin(angle * 6)) > 0.95 && dist < radius * 0.8 ? -28 : 0;
        const gradient = (1 - dist / radius) * 85 + 62;
        const texture = Math.sin(x * 0.15 + frame) * 3 + Math.cos(y * 0.12 + frame * 0.7) * 3;
        gray = Math.max(0, Math.min(255, gradient + disc + macula + vessel + texture));
      }
      const v = Math.round(gray);
      if (lut && lut.length > 0) {
        const idx = Math.max(0, Math.min(lut.length - 1, Math.floor((v / 255) * (lut.length - 1))));
        const c = lut[idx] ?? [v, v, v];
        data[i] = c[0];
        data[i + 1] = c[1];
        data[i + 2] = c[2];
      } else {
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
      }
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

const EyePixelPage: React.FC = () => {
  const [studies, setStudies] = useState<any[]>([]);
  const [studyId, setStudyId] = useState<string>("STU-DEMO-001");
  const [frameIdx, setFrameIdx] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const [pixelInfo, setPixelInfo] = useState<any>(null);
  const [histogram, setHistogram] = useState<any>(null);
  const [histLoading, setHistLoading] = useState(false);
  const [colormaps, setColormaps] = useState<any[]>(FALLBACK_COLORMAPS);
  const [colormapId, setColormapId] = useState<string>("octa");
  const [colormap, setColormap] = useState<any>(null);
  const [colormapLoading, setColormapLoading] = useState(false);
  const [applyLut, setApplyLut] = useState(false);
  const [sharpness, setSharpness] = useState<any>(null);
  const [sharpLoading, setSharpLoading] = useState(false);
  const [artifacts, setArtifacts] = useState<any>(null);
  const [artifactLoading, setArtifactLoading] = useState(false);
  const [mprAxis, setMprAxis] = useState<"axial" | "sagittal" | "coronal">("axial");
  const [mpr, setMpr] = useState<any>(null);
  const [mprLoading, setMprLoading] = useState(false);
  const [source, setSource] = useState<"api" | "demo">("api");

  const lutBarRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);

  const instanceId = useMemo(() => `frame-${frameIdx + 1}`, [frameIdx]);

  // 检查列表
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await eyeApi.getStudies({});
        if (!cancelled && res.success && Array.isArray(res.data) && res.data.length > 0) {
          const list = res.data.map((s: any) => ({ id: s.id ?? s.studyId, studyId: s.studyId ?? s.id, ...s }));
          setStudies(list);
          setStudyId(list[0].id);
          setSource("api");
        } else {
          setStudies(FALLBACK_STUDIES);
          setStudyId(FALLBACK_STUDIES[0]!.id);
          setSource("demo");
        }
      } catch {
        if (!cancelled) {
          setStudies(FALLBACK_STUDIES);
          setStudyId(FALLBACK_STUDIES[0]!.id);
          setSource("demo");
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // 实例元数据
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await eyeApi.getPixelInstance(instanceId);
        if (!cancelled && res.success) {
          setPixelInfo(res.data);
          setSource("api");
        }
      } catch {
        /* 保留上次元数据 */
      }
    })();
    return () => { cancelled = true; };
  }, [instanceId]);

  // 伪彩目录 (8 种)
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await eyeApi.listPixelColormaps();
        if (!cancelled && res.success && Array.isArray(res.data)) {
          setColormaps(res.data);
          setColormapId(res.data[0]?.id ?? "octa");
        }
      } catch {
        /* 使用内置目录 */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 伪彩 LUT 加载
  const loadColormap = useCallback(async (id: string) => {
    setColormapLoading(true);
    try {
      const res = await eyeApi.getPixelColormap(id);
      if (res.success && res.data) {
        const data = res.data;
        if (!Array.isArray(data.lut) || data.lut.length < 2) {
          const typeStr = String(data.type ?? "").toUpperCase();
          const mode = typeStr === "JET" ? "jet" : typeStr === "HOT" ? "hot" : typeStr === "GRAY_INVERT" ? "linear" : typeStr === "RAINBOW" || typeStr === "SPECTRUM" ? "rainbow" : typeStr === "PET" ? "pet" : typeStr === "BONE" ? "bone" : "linear";
          data.lut = Array.from({ length: 256 }, (_, i) => {
            const c = i / 255;
            let r = 0, g = 0, b = 0;
            if (mode === "linear") { r = c * 255; g = c * 255; b = c * 255; }
            else if (mode === "hot") { r = Math.min(1, c * 1.5) * 255; g = Math.min(1, Math.max(0, (c - 0.333) * 1.5)) * 255; b = Math.min(1, Math.max(0, (c - 0.667) * 3)) * 255; }
            else if (mode === "jet") { r = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * c - 3))) * 255; g = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * c - 2))) * 255; b = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * c - 1))) * 255; }
            else if (mode === "rainbow") { const hue = (1 - c) * 270; const k = (hue / 60) % 6; const x = 1 - Math.abs((k % 2) - 1); const rgb = k < 1 ? [1, x, 0] : k < 2 ? [x, 1, 0] : k < 3 ? [0, 1, x] : k < 4 ? [0, x, 1] : k < 5 ? [x, 0, 1] : [1, 0, x]; r = (rgb[0] ?? 0) * 255; g = (rgb[1] ?? 0) * 255; b = (rgb[2] ?? 0) * 255; }
            else if (mode === "pet") { r = Math.min(1, c * 1.4) * 255; g = Math.max(0, Math.min(1, (c - 0.25) * 1.6)) * 255; b = Math.max(0, Math.min(1, (c - 0.6) * 2.5)) * 255; }
            else { r = Math.min(1, c * 0.9 + 0.1) * 255; g = Math.min(1, c * 1.05) * 255; b = Math.max(0, Math.min(1, c * 1.2 - 0.2)) * 255; }
            return [Math.round(r), Math.round(g), Math.round(b)];
          });
        }
        setColormap(data);
        setSource("api");
      } else {
        throw new Error("colormap 不可达");
      }
    } catch {
      message.warning(t('eyePixel.errColormapFallback'));
      setColormap({ id, name: id, lut: Array.from({ length: 256 }, (_, i) => [i, i, i]) });
      setSource("demo");
    } finally {
      setColormapLoading(false);
    }
  }, []);

  useEffect(() => { void loadColormap(colormapId); }, [colormapId, loadColormap]);

  // LUT 色条 + 预览渲染
  useEffect(() => {
    drawLutBar(lutBarRef.current, colormap?.lut);
  }, [colormap]);

  useEffect(() => {
    renderPreview(previewRef.current, applyLut ? colormap?.lut : null, frameIdx);
  }, [colormap, applyLut, frameIdx]);

  // 直方图
  const handleHistogram = async () => {
    setHistLoading(true);
    try {
      // [v3.0.6.11-103 Wave 3A] 透传 frame 查询参数 (后端 GET /eye/pixel/histogram/:instanceId?frame=)
      const res = await eyeApi.getPixelHistogram(instanceId, frameIdx + 1);
      if (res.success && res.data) {
        setHistogram(res.data);
        setSource("api");
        message.success(t('eyePixel.histogramLoaded'));
      } else {
        throw new Error("histogram 不可达");
      }
    } catch {
      message.warning(t('eyePixel.errHistogramFallback'));
      const bins = Array.from({ length: 256 }, (_, i) => {
        const x = i - 128;
        return { intensity: i, count: Math.round(9000 * Math.exp(-x * x / 5000)) };
      });
      setHistogram({ instanceId, bins, mean: 128, stdDev: 50, min: 10, max: 246, mode: 128, median: 128, p25: 98, p75: 158, totalPixels: 262144, source: "local-fallback" });
      setSource("demo");
    } finally {
      setHistLoading(false);
    }
  };

  // 锐度
  const handleSharpness = async () => {
    setSharpLoading(true);
    try {
      const res = await eyeApi.analyzePixelSharpness({ instanceId });
      if (res.success && res.data) {
        setSharpness(res.data);
        setSource("api");
      } else {
        throw new Error("sharpness 不可达");
      }
    } catch {
      message.warning(t('eyePixel.errSharpnessFallback'));
      setSharpness({ instanceId, sharpness: { laplacian: 24.6, tenengrad: 38.2, variance: 1580, overall: 82.4 }, grade: "B (良)", passed: true, measuredAt: new Date().toISOString(), source: "local-fallback" });
      setSource("demo");
    } finally {
      setSharpLoading(false);
    }
  };

  // 伪影检测
  const handleArtifact = async () => {
    setArtifactLoading(true);
    try {
      const res = await eyeApi.detectPixelArtifact({ instanceId });
      if (res.success && res.data) {
        setArtifacts(res.data);
        setSource("api");
      } else {
        throw new Error("artifact 不可达");
      }
    } catch {
      message.warning(t('eyePixel.errArtifactFallback'));
      setArtifacts({ instanceId, artifacts: [{ type: "motion", severity: 0.08, location: { x: 256, y: 200, w: 80, h: 60 } }], qualityScore: 86.2, passed: true, recommendations: ["图像质量良好, 可进入阅片流程"], detectedAt: new Date().toISOString(), source: "local-fallback" });
      setSource("demo");
    } finally {
      setArtifactLoading(false);
    }
  };

  // MPR 重建
  const handleMpr = async () => {
    setMprLoading(true);
    try {
      const res = await eyeApi.reconstructPixelMpr({ studyId, axis: mprAxis, seriesIds: Array.from({ length: 30 }, (_, i) => `frame-${i + 1}`) });
      if (res.success && res.data) {
        setMpr(res.data);
        setSource("api");
        message.success(`MPR ${mprAxis} 重建完成`);
      } else {
        throw new Error("mpr 不可达");
      }
    } catch {
      message.warning(t('eyePixel.errMprFallback'));
      setMpr({ mprId: `MPR-${Date.now()}`, studyId, axis: mprAxis, sliceCount: 30, resolution: "512x512", format: "WebGL Texture Array", renderedAt: new Date().toISOString(), source: "local-fallback" });
      setSource("demo");
    } finally {
      setMprLoading(false);
    }
  };

  const histogramData = useMemo(() => {
    if (!histogram?.bins) return [];
    return histogram.bins.filter((_: any, i: number) => i % 4 === 0);
  }, [histogram]);

  const stats = useMemo(() => {
    if (!histogram) return [];
    const items: Array<[string, number | string]> = [
      [t('eyePixel.statMean'), histogram.mean],
      [t('eyePixel.statStd'), histogram.stdDev],
      [t('eyePixel.statMin'), histogram.min],
      [t('eyePixel.statMax'), histogram.max],
      [t('eyePixel.statMode'), histogram.mode],
      [t('eyePixel.statMedian'), histogram.median],
      ["P25", histogram.p25],
      ["P75", histogram.p75],
      [t('eyePixel.statTotalPixels'), histogram.totalPixels ?? 262144],
    ];
    return items;
  }, [histogram]);

  const currentStudy = studies.find((s) => s.id === studyId);

  return (
    <div style={{ padding: 16, background: "var(--bg-card)", minHeight: "calc(100vh - 56px)" }}>
      {/* 页头 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <ScanLine size={18} color="#7c3aed" />
        <span style={{ fontSize: 16, fontWeight: 700 }}>{t('eyePixel.title')}</span>
        <Tag color="purple">G005 Wave 4B</Tag>
        <Tag color="geekblue">Eye Pixel Lab</Tag>
        <Tag color="cyan">{t('eyePixel.tagBenchmark')}</Tag>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-secondary)" }}>
          {t('eyePixel.instance')} {instanceId} · {pixelInfo ? `${pixelInfo.rows}×${pixelInfo.columns} ${pixelInfo.bitsAllocated}bit ${pixelInfo.modality}` : t('eyePixel.loadingMeta')}
        </span>
      </div>

      {/* 数据源徽标 */}
      <div
        data-testid="eye-pixel-data-source-badge"
        style={{
          display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 12,
          padding: "6px 12px", borderRadius: 8,
          background: source === "api" ? "var(--color-success-bg)" : "var(--color-warning-bg)",
          color: source === "api" ? "#059669" : "#d97706",
          border: `1px solid ${source === "api" ? "#bbf7d0" : "#fde68a"}`,
        }}
      >
        <Database size={12} />
        {source === "api"
          ? t('eyePixel.sourceApi')
          : t('eyePixel.sourceDemo')}
      </div>

      {/* 检查 / 实例选择 */}
      <Card size="small" title={<Space><Activity size={15} />{t('eyePixel.studyInstanceSelect')}</Space>} style={{ marginBottom: 12 }}>
        <Space wrap>
          <span style={{ fontSize: 12 }}>{t('eyePixel.studyLabel')}</span>
          <Select
            data-testid="eye-pixel-study-select"
            style={{ width: 320 }}
            value={studyId}
            onChange={setStudyId}
            options={studies.map((s) => ({
              value: s.id,
              label: `${s.patientName} · ${s.modality} · ${s.eye ?? ""} · ${(s.acquisitionDate ?? s.studyDate ?? "").slice(0, 10)}`,
            }))}
          />
          <span style={{ fontSize: 12 }}>{t('eyePixel.instanceLabel')}</span>
          <Select
            data-testid="eye-pixel-instance-select"
            style={{ width: 140 }}
            value={frameIdx}
            onChange={setFrameIdx}
            options={Array.from({ length: FRAME_COUNT }, (_, i) => ({ value: i, label: `frame-${i + 1}` }))}
          />
          {currentStudy && (
            <Tag color="blue">{currentStudy.patientName} {currentStudy.modality} {currentStudy.eye ?? ""}</Tag>
          )}
          <Button size="small" icon={<RefreshCw size={13} />} onClick={() => { void handleHistogram(); void loadColormap(colormapId); }}>{t('eyePixel.refreshAnalysis')}</Button>
        </Space>
      </Card>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 80 }}><Spin description={t('eyePixel.loading')} /></div>
      ) : (
        <>
          <Row gutter={12}>
            {/* 像素直方图 */}
            <Col xs={24} lg={14}>
              <Card
                size="small"
                title={<Space><BarChart2 size={15} color="#2563eb" />{t('eyePixel.histogram')} <Tag color="blue">256 bins</Tag></Space>}
                extra={<Button size="small" type="primary" data-testid="eye-pixel-histogram-btn" loading={histLoading} onClick={() => void handleHistogram()}>{t('eyePixel.loadHistogram')}</Button>}
                style={{ marginBottom: 12 }}
              >
                {!histogram ? (
                  <Empty description={t('eyePixel.histogramHint')} style={{ padding: 24 }} />
                ) : (
                  <>
                    <div style={{ height: 240 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={histogramData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="intensity" tick={{ fontSize: 10 }} interval={15} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <ReTooltip
                            formatter={(value: any, _name: any, item: any) => [`${value}`, `灰阶 ${item?.payload?.intensity}`]}
                          />
                          <ReferenceLine x={histogram.mean} stroke="#ef4444" strokeDasharray="4 4" />
                          <Bar dataKey="count" fill="#3b82f6" isAnimationActive={false} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>
                        <span style={{ color: "#ef4444" }}>{t('eyePixel.meanLine')} {histogram.mean}</span>
                        {histogram.source && <Tag style={{ marginLeft: 8 }} color="orange">{t('eyePixel.localFallback')}</Tag>}
                      </div>
                      <Row gutter={[8, 8]}>
                        {stats.map(([label, value]) => (
                          <Col span={6} key={label}>
                            <Statistic title={label} value={value as number} valueStyle={{ fontSize: 14 }} />
                          </Col>
                        ))}
                      </Row>
                    </div>
                  </>
                )}
              </Card>
            </Col>

            {/* 伪彩色 */}
            <Col xs={24} lg={10}>
              <Card
                size="small"
                title={<Space><Palette size={15} color="#7c3aed" />{t('eyePixel.colormap')}</Space>}
                extra={colormapLoading ? <Spin size="small" /> : <Tag color="purple">{colormap?.type ?? "-"}</Tag>}
                style={{ marginBottom: 12 }}
              >
                <Space direction="vertical" style={{ width: "100%" }} size={8}>
                  <Space wrap>
                    <span style={{ fontSize: 12 }}>{t('eyePixel.mapping')}</span>
                    <Select
                      data-testid="eye-pixel-colormap-select"
                      style={{ width: 200 }}
                      value={colormapId}
                      onChange={setColormapId}
                      options={colormaps.map((m) => ({ value: m.id, label: m.name }))}
                    />
                    <Tooltip title={t('eyePixel.applyLutTip')}>
                      <Switch
                        size="small"
                        checked={applyLut}
                        onChange={setApplyLut}
                        checkedChildren={t('eyePixel.pseudoColor')}
                        unCheckedChildren={t('eyePixel.grayscale')}
                        data-testid="eye-pixel-apply-lut"
                      />
                    </Tooltip>
                  </Space>
                  <canvas
                    data-testid="eye-pixel-lut-bar"
                    ref={lutBarRef}
                    width={256}
                    height={18}
                    style={{ width: "100%", height: 18, borderRadius: 4, border: "1px solid var(--border-color)" }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-secondary)" }}>
                    <span>0</span>
                    <span>{colormap?.name} · {colormap?.description ?? ""}</span>
                    <span>255</span>
                  </div>
                  <canvas
                    data-testid="eye-pixel-preview"
                    ref={previewRef}
                    width={256}
                    height={256}
                    style={{ width: "100%", height: 220, borderRadius: 6, border: "1px solid var(--border-color)", background: "#0f172a" }}
                  />
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    {applyLut ? `已应用 ${colormap?.name ?? colormapId} 伪彩 · 预览帧 frame-${frameIdx + 1}` : t('eyePixel.grayscalePreview')}
                  </div>
                </Space>
              </Card>
            </Col>
          </Row>

          <Row gutter={12}>
            {/* 锐度分析 */}
            <Col xs={24} lg={8}>
              <Card
                size="small"
                title={<Space><Focus size={15} color="#059669" />{t('eyePixel.sharpness')}</Space>}
                extra={<Button size="small" data-testid="eye-pixel-sharpness-btn" loading={sharpLoading} onClick={() => void handleSharpness()}>{t('eyePixel.analyze')}</Button>}
                style={{ marginBottom: 12 }}
              >
                {!sharpness ? (
                  <Empty description={t('eyePixel.sharpnessHint')} style={{ padding: 16 }} />
                ) : (
                  <Space direction="vertical" style={{ width: "100%" }} size={8}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <Progress
                        type="circle"
                        size={64}
                        percent={Number(sharpness.sharpness?.overall ?? 0)}
                        strokeColor={sharpness.passed ? "#10b981" : "#f59e0b"}
                        format={(p) => <span style={{ fontSize: 13, fontWeight: 700 }}>{p}</span>}
                      />
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700 }}>
                          <Tag color={sharpness.passed ? "green" : "orange"}>{sharpness.grade}</Tag>
                          {sharpness.passed ? t('eyePixel.qualityPass') : t('eyePixel.rescanSuggested')}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                          {t('eyePixel.measuredAt')} {String(sharpness.measuredAt ?? "").slice(0, 19).replace("T", " ")}
                          {sharpness.source && <Tag style={{ marginLeft: 6 }} color="orange">{t('eyePixel.fallback')}</Tag>}
                        </div>
                      </div>
                    </div>
                    <Divider style={{ margin: "4px 0" }} />
                    <Row gutter={8}>
                      <Col span={8}><Statistic title="Laplacian" value={sharpness.sharpness?.laplacian} valueStyle={{ fontSize: 14 }} /></Col>
                      <Col span={8}><Statistic title="Tenengrad" value={sharpness.sharpness?.tenengrad} valueStyle={{ fontSize: 14 }} /></Col>
                      <Col span={8}><Statistic title="Variance" value={sharpness.sharpness?.variance} valueStyle={{ fontSize: 14 }} /></Col>
                    </Row>
                  </Space>
                )}
              </Card>
            </Col>

            {/* 伪影检测 */}
            <Col xs={24} lg={8}>
              <Card
                size="small"
                title={<Space><ShieldAlert size={15} color="#dc2626" />{t('eyePixel.artifactDetection')}</Space>}
                extra={<Button size="small" data-testid="eye-pixel-artifact-btn" loading={artifactLoading} onClick={() => void handleArtifact()}>{t('eyePixel.detect')}</Button>}
                style={{ marginBottom: 12 }}
              >
                {!artifacts ? (
                  <Empty description={t('eyePixel.artifactHint')} style={{ padding: 16 }} />
                ) : (
                  <Space direction="vertical" style={{ width: "100%" }} size={8}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <Progress
                        type="circle"
                        size={64}
                        percent={Number(artifacts.qualityScore ?? 0)}
                        strokeColor={artifacts.passed ? "#10b981" : "#f59e0b"}
                        format={(p) => <span style={{ fontSize: 13, fontWeight: 700 }}>{p}</span>}
                      />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{t('eyePixel.imageQualityScore')}</div>
                        <Tag color={artifacts.passed ? "green" : "orange"}>{artifacts.passed ? t('eyePixel.passed') : t('eyePixel.needsAttention')}</Tag>
                        {artifacts.source && <Tag color="orange">{t('eyePixel.fallback')}</Tag>}
                      </div>
                    </div>
                    <Divider style={{ margin: "4px 0" }} />
                    {Array.isArray(artifacts.artifacts) && artifacts.artifacts.map((a: any, i: number) => (
                      <div key={`art-${i}`} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, padding: "4px 0" }}>
                        <Droplets size={13} color="#dc2626" />
                        <span>{ARTIFACT_LABELS[a.type] ?? a.type}</span>
                        <span style={{ color: "var(--text-secondary)" }}>{t('eyePixel.severity')} {(Number(a.severity) * 100).toFixed(1)}%</span>
                        {a.location && <Tag>{t('eyePixel.location')} x:{a.location.x} y:{a.location.y}</Tag>}
                      </div>
                    ))}
                    {Array.isArray(artifacts.recommendations) && artifacts.recommendations.map((r: string, i: number) => (
                      <Alert key={`rec-${i}`} type={artifacts.passed ? "success" : "warning"} showIcon message={r} style={{ padding: "4px 10px", fontSize: 12 }} />
                    ))}
                  </Space>
                )}
              </Card>
            </Col>

            {/* MPR 重建 */}
            <Col xs={24} lg={8}>
              <Card
                size="small"
                title={<Space><Layers size={15} color="#0891b2" />{t('eyePixel.mpr')}</Space>}
                extra={<Button size="small" data-testid="eye-pixel-mpr-btn" loading={mprLoading} onClick={() => void handleMpr()}>{t('eyePixel.reconstruct')}</Button>}
                style={{ marginBottom: 12 }}
              >
                <Space direction="vertical" style={{ width: "100%" }} size={8}>
                  <Space wrap>
                    <span style={{ fontSize: 12 }}>{t('eyePixel.axis')}</span>
                    <Select
                      data-testid="eye-pixel-mpr-axis"
                      size="small"
                      style={{ width: 130 }}
                      value={mprAxis}
                      onChange={setMprAxis}
                      options={[
                        { value: "axial", label: t('eyePixel.axisAxial') },
                        { value: "sagittal", label: t('eyePixel.axisSagittal') },
                        { value: "coronal", label: t('eyePixel.axisCoronal') },
                      ]}
                    />
                  </Space>
                  {!mpr ? (
                    <Empty description={t('eyePixel.mprHint')} style={{ padding: 12 }} />
                  ) : (
                    <>
                      <div
                        style={{
                          background: "#0f172a", borderRadius: 6, display: "flex", flexDirection: "column",
                          alignItems: "center", justifyContent: "center", height: 170, color: "var(--text-secondary)", fontSize: 12,
                        }}
                      >
                        <Grid3X3 size={30} color="#0891b2" style={{ marginBottom: 8 }} />
                        <div>MPR {mpr.axis} {t('eyePixel.reconstructPreview')}</div>
                        <div style={{ marginTop: 4, opacity: 0.8 }}>
                          {mpr.sliceCount} {t('eyePixel.slices')} · {mpr.resolution} · {mpr.format}
                        </div>
                      </div>
                      <Space wrap size={6} style={{ fontSize: 12 }}>
                        <Tag color="cyan">{mpr.mprId}</Tag>
                        <Tag color="blue">{mpr.axis}</Tag>
                        <span style={{ color: "var(--text-secondary)" }}>
                          {t('eyePixel.renderedAt')} {String(mpr.renderedAt ?? "").slice(0, 19).replace("T", " ")}
                        </span>
                        {mpr.source && <Tag color="orange">{t('eyePixel.fallback')}</Tag>}
                      </Space>
                    </>
                  )}
                  <Alert
                    type="info" showIcon style={{ fontSize: 11, padding: "4px 10px" }}
                    message={t('eyePixel.webglNote')}
                  />
                </Space>
              </Card>
            </Col>
          </Row>

          {/* 实例元数据 */}
          {pixelInfo && (
            <Card
              size="small"
              title={<Space><Grid3X3 size={14} />{t('eyePixel.dicomMeta')}</Space>}
              extra={<span style={{ fontSize: 11, color: "var(--text-secondary)" }}>SOP: {pixelInfo.sopInstanceUID}</span>}
            >
              <Row gutter={[12, 8]} style={{ fontSize: 12 }}>
                {[
                  [t('eyePixel.metaRowsCols'), `${pixelInfo.rows}×${pixelInfo.columns}`],
                  [t('eyePixel.metaBitAlloc'), `${pixelInfo.bitsAllocated} bit (存储 ${pixelInfo.bitsStored})`],
                  [t('eyePixel.metaPhotometric'), pixelInfo.photometricInterpretation],
                  [t('eyePixel.metaTransferSyntax'), String(pixelInfo.transferSyntaxUID).slice(0, 26) + "…"],
                  [t('eyePixel.metaWindow'), `${pixelInfo.windowCenter} / ${pixelInfo.windowWidth}`],
                  [t('eyePixel.metaRescale'), `斜率 ${pixelInfo.rescaleSlope} · 截距 ${pixelInfo.rescaleIntercept}`],
                  [t('eyePixel.metaSamples'), pixelInfo.samplesPerPixel],
                  [t('eyePixel.metaPixelData'), pixelInfo.pixelDataRef],
                  [t('eyePixel.metaSize'), `${(Number(pixelInfo.size) / 1024 / 1024).toFixed(2)} MB`],
                ].map(([k, v]) => (
                  <Col span={8} key={String(k)}>
                    <span style={{ color: "var(--text-secondary)" }}>{k}: </span>
                    <span style={{ fontWeight: 500 }}>{v}</span>
                  </Col>
                ))}
              </Row>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default EyePixelPage;
