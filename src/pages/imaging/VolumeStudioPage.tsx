/**
 * G005 RIS - [v3.0.6.11-101 Wave 3A] VolumeStudioPage 多平面重建工作室
 *
 * 能力:
 *   - MPR 三平面联动: axial/coronal/sagittal 十字线联动 (滑条定位 + 点击画布联动)
 *   - VR 体绘制: yaw/pitch 旋转控制 + 传输函数预设 (骨骼/软组织/血管) + 渲染质量
 *   - CPR 曲面重建: 轴向视图点击画点 + 拖拽移动路径控制点 → 拉直图
 *   - 切割: 法向量/偏移编辑 → 截面图像 + 裁剪统计
 *
 * 数据源: setupRealVolume → 真实 DICOM jobId; 无真实数据时后端内置合成体回退。
 */
import React, { useState, useRef, useEffect, useCallback } from "react";
import { Tabs, Slider, Tag, Spin, message, InputNumber, Button } from "antd";
import { Box, Route, Scissors, RotateCcw, Crosshair } from "lucide-react";
import { useTranslation } from "react-i18next";
import { volumeV2Api, type V2PixelPayload, type Vec3Dto, type MprLinkedResultDto, type VrPresetDto, type VrResultDto, type CprResultDto, type CutResultDto } from "../../services/api/volumeV2Api";
import { setupRealVolume, decodeInt16Base64, decodeRgbaBase64, applyWWL } from "../dicom/volumeReal";

const BLUE = "#3b82f6";
const GREEN = "#22c55e";
const CARD_BG = "#0f172a";

interface DrawGeo {
  scale: number;
  ox: number;
  oy: number;
  iw: number;
  ih: number;
}

/** 解码 Int16 payload → 画布绘制, 返回绘制几何 (供叠加十字线/路径) */
function renderInt16ToCanvas(
  canvas: HTMLCanvasElement,
  payload: V2PixelPayload | undefined,
  ww: number,
  wl: number,
): DrawGeo | null {
  const ctx = canvas.getContext("2d");
  if (!ctx || !payload || !payload.dataBase64) return null;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, rect.width);
  const h = Math.max(1, rect.height);
  canvas.width = w * devicePixelRatio;
  canvas.height = h * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  const data = decodeInt16Base64(payload.dataBase64);
  const imgData = applyWWL(data, payload.width, payload.height, ww, wl);
  const scale = Math.min(w / payload.width, h / payload.height, 1);
  const ox = (w - payload.width * scale) / 2;
  const oy = (h - payload.height * scale) / 2;
  const tmp = document.createElement("canvas");
  tmp.width = payload.width;
  tmp.height = payload.height;
  const tmpCtx = tmp.getContext("2d");
  if (!tmpCtx) return null;
  tmpCtx.putImageData(imgData, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(tmp, ox, oy, payload.width * scale, payload.height * scale);
  return { scale, ox, oy, iw: payload.width, ih: payload.height };
}

function renderRgbaToCanvas(canvas: HTMLCanvasElement, dataBase64: string, width: number, height: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx || !dataBase64) return;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, rect.width);
  const h = Math.max(1, rect.height);
  canvas.width = w * devicePixelRatio;
  canvas.height = h * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  const rgba = decodeRgbaBase64(dataBase64);
  const imgData = new ImageData(new Uint8ClampedArray(rgba), width, height);
  const scale = Math.min(w / width, h / height, 1);
  const ox = (w - width * scale) / 2;
  const oy = (h - height * scale) / 2;
  const tmp = document.createElement("canvas");
  tmp.width = width;
  tmp.height = height;
  const tmpCtx = tmp.getContext("2d");
  if (!tmpCtx) return;
  tmpCtx.putImageData(imgData, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(tmp, ox, oy, width * scale, height * scale);
}

function drawCrosshair(ctx: CanvasRenderingContext2D, geo: DrawGeo, canvasW: number, canvasH: number, h: number, v: number, label: string) {
  const x = geo.ox + v * geo.scale;
  const y = geo.oy + h * geo.scale;
  ctx.strokeStyle = "rgba(59,130,246,0.9)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(canvasW, y);
  ctx.moveTo(x, 0);
  ctx.lineTo(x, canvasH);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(59,130,246,0.95)";
  ctx.beginPath();
  ctx.arc(x, y, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "10px ui-monospace, monospace";
  ctx.fillText(label, x + 6, Math.max(10, y - 5));
}

const VR_PRESETS: Array<{ key: VrPresetDto; labelKey: string }> = [
  { key: "bone", labelKey: "vsPresetBone" },
  { key: "softTissue", labelKey: "vsPresetSoftTissue" },
  { key: "vessel", labelKey: "vsPresetVessel" },
];

const VR_SIZES = [
  { value: 128, labelKey: "vsQualityLow" },
  { value: 192, labelKey: "vsQualityMedium" },
  { value: 256, labelKey: "vsQualityHigh" },
];

const btnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #334155",
  color: "#94a3b8",
  borderRadius: 4,
  padding: "4px 8px",
  fontSize: 11,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 3,
};
const activeBtnStyle: React.CSSProperties = { ...btnStyle, background: BLUE, borderColor: BLUE, color: "#fff" };

const VolumeStudioPage: React.FC = () => {
  const { t } = useTranslation("v3dicom");
  const [mode, setMode] = useState<"loading" | "real" | "synthetic">("loading");
  const [jobId, setJobId] = useState<string | null>(null);
  const [seriesInfo, setSeriesInfo] = useState("");
  const [tab, setTab] = useState("mpr");

  // 共享参数
  const [ww, setWw] = useState(1200);
  const [wl, setWl] = useState(40);

  // MPR
  const [position, setPosition] = useState<Vec3Dto>({ x: 64, y: 64, z: 64 });
  const [mprResult, setMprResult] = useState<MprLinkedResultDto | null>(null);
  const [mprLoading, setMprLoading] = useState(false);
  const axialCanvasRef = useRef<HTMLCanvasElement>(null);
  const coronalCanvasRef = useRef<HTMLCanvasElement>(null);
  const sagittalCanvasRef = useRef<HTMLCanvasElement>(null);
  const mprTickRef = useRef(0);
  const mprTimerRef = useRef<number | null>(null);

  // VR
  const [yaw, setYaw] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [preset, setPreset] = useState<VrPresetDto>("softTissue");
  const [vrSize, setVrSize] = useState(192);
  const [vrResult, setVrResult] = useState<VrResultDto | null>(null);
  const [vrLoading, setVrLoading] = useState(false);
  const vrCanvasRef = useRef<HTMLCanvasElement>(null);
  const vrTickRef = useRef(0);
  const vrTimerRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // CPR
  const [cprSliceZ, setCprSliceZ] = useState(64);
  const [cprAxial, setCprAxial] = useState<V2PixelPayload | null>(null);
  const [cprPoints, setCprPoints] = useState<Vec3Dto[]>([]);
  const [cprResult, setCprResult] = useState<CprResultDto | null>(null);
  const [cprLoading, setCprLoading] = useState(false);
  const cprCanvasRef = useRef<HTMLCanvasElement>(null);
  const cprStraightRef = useRef<HTMLCanvasElement>(null);
  const dragPointRef = useRef<number | null>(null);

  // Cut
  const [cutNormal, setCutNormal] = useState<Vec3Dto>({ x: 0, y: 0, z: 1 });
  const [cutOffset, setCutOffset] = useState(0);
  const [cutResult, setCutResult] = useState<CutResultDto | null>(null);
  const [cutLoading, setCutLoading] = useState(false);
  const cutCanvasRef = useRef<HTMLCanvasElement>(null);

  // ────────────────────────────────────────────────────────────────────────────
  // 初始化: 真实 DICOM jobId (无真实数据 → 后端合成体回退)
  // ────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setupRealVolume({ modality: "CT" }).then((setup) => {
      if (cancelled) return;
      setMode(setup.mode);
      setJobId(setup.jobId);
      if (setup.series) {
        setSeriesInfo(`${setup.series.modality} #${setup.series.instanceCount} 层 ${setup.series.rows}x${setup.series.columns}`);
      }
      if (setup.dims) {
        setPosition({ x: Math.floor(setup.dims.x / 2), y: Math.floor(setup.dims.y / 2), z: Math.floor(setup.dims.z / 2) });
        setCprSliceZ(Math.floor(setup.dims.z / 2));
      }
    });
    return () => {
      cancelled = true;
      if (mprTimerRef.current !== null) window.clearTimeout(mprTimerRef.current);
      if (vrTimerRef.current !== null) window.clearTimeout(vrTimerRef.current);
    };
  }, []);

  const volRequest = useCallback(
    () => (mode === "real" && jobId ? { jobId } : {}),
    [mode, jobId],
  );

  // ────────────────────────────────────────────────────────────────────────────
  // MPR 三平面联动: position 变化 → mprLinked (防抖) → 三平面切片 + 十字线
  // ────────────────────────────────────────────────────────────────────────────
  const fetchMpr = useCallback(
    (pos: Vec3Dto) => {
      if (mode === "loading") return;
      const myId = ++mprTickRef.current;
      setMprLoading(true);
      if (mprTimerRef.current !== null) window.clearTimeout(mprTimerRef.current);
      mprTimerRef.current = window.setTimeout(() => {
        volumeV2Api.mprLinked({ ...volRequest(), position: pos }).then((res) => {
          if (myId !== mprTickRef.current) return;
          setMprLoading(false);
          if (res.success && res.data) setMprResult(res.data);
          else message.error(t("vsLoadError", "三平面切片加载失败"));
        });
      }, 80);
    },
    [mode, volRequest, t],
  );

  useEffect(() => {
    fetchMpr(position);
  }, [position, fetchMpr]);

  useEffect(() => {
    if (!mprResult) return;
    const axial = mprResult.planes[0];
    const coronal = mprResult.planes[1];
    const sagittal = mprResult.planes[2];
    if (!axial || !coronal || !sagittal) return;
    const axC = axialCanvasRef.current;
    const coC = coronalCanvasRef.current;
    const saC = sagittalCanvasRef.current;
    if (axC && axial) {
      const geo = renderInt16ToCanvas(axC, axial.pixelData, axial.windowWidth || ww, axial.windowLevel || wl);
      const ctx = axC.getContext("2d");
      if (geo && ctx) drawCrosshair(ctx, geo, axC.width / devicePixelRatio, axC.height / devicePixelRatio, axial.crosshair.h, axial.crosshair.v, "A");
    }
    if (coC && coronal) {
      const geo = renderInt16ToCanvas(coC, coronal.pixelData, coronal.windowWidth || ww, coronal.windowLevel || wl);
      const ctx = coC.getContext("2d");
      if (geo && ctx) drawCrosshair(ctx, geo, coC.width / devicePixelRatio, coC.height / devicePixelRatio, coronal.crosshair.h, coronal.crosshair.v, "C");
    }
    if (saC && sagittal) {
      const geo = renderInt16ToCanvas(saC, sagittal.pixelData, sagittal.windowWidth || ww, sagittal.windowLevel || wl);
      const ctx = saC.getContext("2d");
      if (geo && ctx) drawCrosshair(ctx, geo, saC.width / devicePixelRatio, saC.height / devicePixelRatio, sagittal.crosshair.h, sagittal.crosshair.v, "S");
    }
  }, [mprResult, ww, wl]);

  /** 点击画布 → 更新十字线位置 (联动) */
  const handleMprClick = useCallback(
    (plane: "axial" | "coronal" | "sagittal") => (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = e.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const res = mprResult;
      if (!res) return;
      const p = res.planes.find((pl) => pl.plane === plane);
      if (!p) return;
      const payload = p.pixelData;
      const scale = Math.min(rect.width / payload.width, rect.height / payload.height, 1);
      const ox = (rect.width - payload.width * scale) / 2;
      const oy = (rect.height - payload.height * scale) / 2;
      const v = Math.round((px - ox) / scale);
      const h = Math.round((py - oy) / scale);
      if (v < 0 || v >= payload.width || h < 0 || h >= payload.height) return;
      const next = { ...res.position };
      if (plane === "axial") {
        next.x = v;
        next.y = h;
      } else if (plane === "coronal") {
        next.x = v;
        next.z = Math.round((h / Math.max(1, payload.height - 1)) * (res.dims.z - 1));
      } else {
        next.y = v;
        next.z = Math.round((h / Math.max(1, payload.height - 1)) * (res.dims.z - 1));
      }
      setPosition(next);
    },
    [mprResult],
  );

  const maxPos = mprResult?.dims ?? { x: 127, y: 127, z: 127 };

  // ────────────────────────────────────────────────────────────────────────────
  // VR 体绘制: yaw/pitch/preset/质量 → vr (防抖) → RGBA 画布
  // ────────────────────────────────────────────────────────────────────────────
  const fetchVr = useCallback(() => {
    if (mode === "loading") return;
    const myId = ++vrTickRef.current;
    setVrLoading(true);
    if (vrTimerRef.current !== null) window.clearTimeout(vrTimerRef.current);
    vrTimerRef.current = window.setTimeout(() => {
      volumeV2Api.vr({ ...volRequest(), yaw, pitch, preset, size: vrSize }).then((res) => {
        if (myId !== vrTickRef.current) return;
        setVrLoading(false);
        if (res.success && res.data) setVrResult(res.data);
        else message.error(t("vsLoadError", "VR 渲染失败"));
      });
    }, 150);
  }, [mode, volRequest, yaw, pitch, preset, vrSize, t]);

  useEffect(() => {
    fetchVr();
  }, [fetchVr]);

  useEffect(() => {
    if (!vrResult) return;
    const canvas = vrCanvasRef.current;
    if (!canvas) return;
    renderRgbaToCanvas(canvas, vrResult.pixelData.dataBase64, vrResult.width, vrResult.height);
  }, [vrResult]);

  const handleVrDrag = useCallback((e: React.MouseEvent) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    setYaw((prev) => Math.round(Math.max(-180, Math.min(180, prev + dx * 0.6))));
    setPitch((prev) => Math.round(Math.max(-180, Math.min(180, prev + dy * 0.6))));
  }, []);

  // ────────────────────────────────────────────────────────────────────────────
  // CPR 曲面重建: 轴向切片画布 + 点击画点 / 拖拽移动 + 拉直图
  // ────────────────────────────────────────────────────────────────────────────
  const fetchCprAxial = useCallback(() => {
    if (mode === "loading") return;
    volumeV2Api.mprLinked({ ...volRequest(), position: { x: 64, y: 64, z: cprSliceZ } }).then((res) => {
      if (res.success && res.data) {
        const axial = res.data.planes[0];
        if (axial) setCprAxial(axial.pixelData);
      }
    });
  }, [mode, volRequest, cprSliceZ]);

  useEffect(() => {
    fetchCprAxial();
  }, [fetchCprAxial]);

  useEffect(() => {
    if (!cprAxial) return;
    const canvas = cprCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const geo = renderInt16ToCanvas(canvas, cprAxial, ww, wl);
    if (!geo) return;
    const rect = canvas.getBoundingClientRect();
    const toPx = (p: Vec3Dto) => ({ x: geo.ox + p.x * geo.scale, y: geo.oy + p.y * geo.scale });
    // 当前编辑路径
    if (cprPoints.length > 0) {
      ctx.strokeStyle = GREEN;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      cprPoints.forEach((p, i) => {
        const pt = toPx(p);
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
      ctx.fillStyle = GREEN;
      cprPoints.forEach((p) => {
        const pt = toPx(p);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    // 后端重采样投影 (拉直图来源)
    if (cprResult && cprResult.projections.axial.length > 1) {
      ctx.strokeStyle = "rgba(250,204,21,0.95)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      cprResult.projections.axial.forEach((p, i) => {
        const pt = toPx({ x: p.x, y: p.y, z: 0 });
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (rect.width > 0) {
      ctx.fillStyle = "rgba(15,23,42,0.8)";
      ctx.fillRect(4, 4, rect.width - 8 > 220 ? 220 : rect.width - 8, 18);
      ctx.fillStyle = "#facc15";
      ctx.font = "10px ui-monospace, monospace";
      ctx.fillText(`z=${cprSliceZ} | ${cprPoints.length} 点 | 点击加/拖拽移`, 8, 17);
    }
  }, [cprAxial, cprPoints, cprResult, cprSliceZ, ww, wl]);

  const handleCprPointer = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = e.currentTarget;
      const rect = canvas.getBoundingClientRect();
      if (!cprAxial) return;
      const scale = Math.min(rect.width / cprAxial.width, rect.height / cprAxial.height, 1);
      const ox = (rect.width - cprAxial.width * scale) / 2;
      const oy = (rect.height - cprAxial.height * scale) / 2;
      const x = Math.round((e.clientX - rect.left - ox) / scale);
      const y = Math.round((e.clientY - rect.top - oy) / scale);
      if (x < 0 || x >= cprAxial.width || y < 0 || y >= cprAxial.height) return;
      setCprPoints((prev) => [...prev, { x, y, z: cprSliceZ }]);
      setCprResult(null);
    },
    [cprAxial, cprSliceZ],
  );

  const handleCprDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      if (!cprAxial) return;
      const scale = Math.min(rect.width / cprAxial.width, rect.height / cprAxial.height, 1);
      const ox = (rect.width - cprAxial.width * scale) / 2;
      const oy = (rect.height - cprAxial.height * scale) / 2;
      const mx = (e.clientX - rect.left - ox) / scale;
      const my = (e.clientY - rect.top - oy) / scale;
      let nearest = -1;
      let best = 14;
      cprPoints.forEach((p, i) => {
        const d = Math.sqrt((p.x - mx) ** 2 + (p.y - my) ** 2);
        if (d < best) {
          best = d;
          nearest = i;
        }
      });
      if (nearest >= 0) {
        dragPointRef.current = nearest;
        e.preventDefault();
      } else {
        handleCprPointer(e);
      }
    },
    [cprAxial, cprPoints, handleCprPointer],
  );

  const handleCprMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const idx = dragPointRef.current;
      if (idx === null || !cprAxial) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const scale = Math.min(rect.width / cprAxial.width, rect.height / cprAxial.height, 1);
      const ox = (rect.width - cprAxial.width * scale) / 2;
      const oy = (rect.height - cprAxial.height * scale) / 2;
      const x = Math.round((e.clientX - rect.left - ox) / scale);
      const y = Math.round((e.clientY - rect.top - oy) / scale);
      if (x < 0 || x >= cprAxial.width || y < 0 || y >= cprAxial.height) return;
      setCprPoints((prev) => prev.map((p, i) => (i === idx ? { ...p, x, y } : p)));
      setCprResult(null);
    },
    [cprAxial],
  );

  const handleCprUp = useCallback(() => {
    dragPointRef.current = null;
  }, []);

  const rebuildCpr = useCallback(() => {
    if (cprPoints.length < 2) {
      message.warning(t("vsCprNeedPoints", "请至少添加 2 个路径点"));
      return;
    }
    setCprLoading(true);
    volumeV2Api
      .cpr({ ...volRequest(), points: cprPoints, spacing: 1.5, crossWidth: 31 })
      .then((res) => {
        setCprLoading(false);
        if (res.success && res.data) setCprResult(res.data);
        else message.error(t("vsLoadError", "CPR 重建失败"));
      });
  }, [cprPoints, volRequest, t]);

  useEffect(() => {
    if (!cprResult) return;
    const canvas = cprStraightRef.current;
    if (!canvas) return;
    const s = cprResult.straightened;
    const geo = renderInt16ToCanvas(canvas, s.pixelData, s.windowWidth || ww, s.windowLevel || wl);
    const ctx = canvas.getContext("2d");
    if (geo && ctx) {
      ctx.fillStyle = "rgba(15,23,42,0.8)";
      ctx.fillRect(4, 4, 190, 18);
      ctx.fillStyle = "#7dd3fc";
      ctx.font = "10px ui-monospace, monospace";
      ctx.fillText(`拉直图 ${s.width}×${s.height}`, 8, 17);
    }
  }, [cprResult, ww, wl]);

  // ────────────────────────────────────────────────────────────────────────────
  // 切割: 法向量 + 偏移 → 截面图像 + 统计
  // ────────────────────────────────────────────────────────────────────────────
  const applyCut = useCallback(() => {
    setCutLoading(true);
    volumeV2Api
      .cut({ ...volRequest(), normal: cutNormal, offset: cutOffset })
      .then((res) => {
        setCutLoading(false);
        if (res.success && res.data) setCutResult(res.data);
        else message.error(t("vsLoadError", "切割失败"));
      });
  }, [volRequest, cutNormal, cutOffset, t]);

  useEffect(() => {
    if (!cutResult) return;
    const canvas = cutCanvasRef.current;
    if (!canvas) return;
    const geo = renderInt16ToCanvas(canvas, cutResult.sectionImage, ww, wl);
    const ctx = canvas.getContext("2d");
    if (geo && ctx) {
      ctx.fillStyle = "rgba(15,23,42,0.8)";
      ctx.fillRect(4, 4, 200, 18);
      ctx.fillStyle = "#f0abfc";
      ctx.font = "10px ui-monospace, monospace";
      ctx.fillText(`截面 ${cutResult.width}×${cutResult.height}`, 8, 17);
    }
  }, [cutResult, ww, wl]);

  const numInputStyle: React.CSSProperties = { width: 72, background: "#0f172a", borderColor: "#334155" };

  const tabItems = [
    {
      key: "mpr",
      label: t("vsMpr", "MPR 三平面联动"),
      children: (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>{t("vsPosition", "定位点")}</span>
            <span style={{ fontSize: 11, color: "#64748b" }}>X</span>
            <Slider min={0} max={Math.max(1, maxPos.x - 1)} value={position.x} onChange={(v) => setPosition((p) => ({ ...p, x: v }))} style={{ width: 130 }} />
            <span style={{ fontSize: 11, color: "#64748b" }}>Y</span>
            <Slider min={0} max={Math.max(1, maxPos.y - 1)} value={position.y} onChange={(v) => setPosition((p) => ({ ...p, y: v }))} style={{ width: 130 }} />
            <span style={{ fontSize: 11, color: "#64748b" }}>Z</span>
            <Slider min={0} max={Math.max(1, maxPos.z - 1)} value={position.z} onChange={(v) => setPosition((p) => ({ ...p, z: v }))} style={{ width: 130 }} />
            <span style={{ fontSize: 11, color: "#94a3b8" }}>{(mprResult?.position.x ?? 0)}, {(mprResult?.position.y ?? 0)}, {(mprResult?.position.z ?? 0)}</span>
            <div style={{ width: 1, height: 20, background: "#334155" }} />
            <span style={{ fontSize: 12, color: "#94a3b8" }}>WW</span>
            <Slider min={1} max={4000} value={ww} onChange={setWw} style={{ width: 110 }} />
            <span style={{ fontSize: 12, color: "#94a3b8" }}>WL</span>
            <Slider min={-1000} max={3000} value={wl} onChange={setWl} style={{ width: 110 }} />
            <Tag color="blue" icon={<Crosshair size={10} />}>{t("vsCrosshairHint", "点击画布十字线联动")}</Tag>
            {mprLoading && <Spin size="small" />}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, flex: 1, minHeight: 0 }}>
            {(["axial", "coronal", "sagittal"] as const).map((plane) => (
              <div key={plane} style={{ background: CARD_BG, borderRadius: 6, border: "1px solid #1e293b", overflow: "hidden", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <canvas
                  ref={plane === "axial" ? axialCanvasRef : plane === "coronal" ? coronalCanvasRef : sagittalCanvasRef}
                  style={{ width: "100%", height: "100%", imageRendering: "pixelated", cursor: "crosshair" }}
                  onClick={handleMprClick(plane)}
                />
                <span style={{ position: "absolute", top: 6, left: 8, fontSize: 10, color: "#64748b", background: "rgba(2,6,23,0.7)", padding: "2px 6px", borderRadius: 4 }}>
                  {plane === "axial" ? "A 轴向" : plane === "coronal" ? "C 冠状" : "S 矢状"} #{mprResult?.planes.find((p) => p.plane === plane)?.sliceIndex ?? "-"}
                </span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      key: "vr",
      label: t("vsVr", "VR 体绘制"),
      children: (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>{t("vsPreset", "传输函数")}</span>
            {VR_PRESETS.map((p) => (
              <button key={p.key} style={preset === p.key ? activeBtnStyle : btnStyle} onClick={() => setPreset(p.key)}>
                {t(p.labelKey)}
              </button>
            ))}
            <div style={{ width: 1, height: 20, background: "#334155" }} />
            <span style={{ fontSize: 12, color: "#94a3b8" }}>{t("vsYaw", "Yaw")}</span>
            <Slider min={-180} max={180} value={yaw} onChange={setYaw} style={{ width: 130 }} />
            <span style={{ fontSize: 12, color: "#94a3b8" }}>{t("vsPitch", "Pitch")}</span>
            <Slider min={-180} max={180} value={pitch} onChange={setPitch} style={{ width: 130 }} />
            <span style={{ fontSize: 11, color: "#94a3b8" }}>{t("vsQuality", "质量")}</span>
            {VR_SIZES.map((s) => (
              <button key={s.value} style={vrSize === s.value ? activeBtnStyle : btnStyle} onClick={() => setVrSize(s.value)}>
                {t(s.labelKey)}
              </button>
            ))}
            <button style={btnStyle} onClick={() => { setYaw(0); setPitch(0); setPreset("softTissue"); }}>
              <RotateCcw size={12} /> {t("vsReset", "重置")}
            </button>
            {vrLoading && <Spin size="small" />}
            {vrResult && <Tag color="geekblue">steps:{vrResult.stepCount}</Tag>}
          </div>
          <div
            style={{ background: CARD_BG, borderRadius: 6, border: "1px solid #1e293b", overflow: "hidden", flex: 1, minHeight: 0, cursor: "grab", display: "flex", alignItems: "center", justifyContent: "center" }}
            onMouseDown={(e) => { draggingRef.current = true; dragStartRef.current = { x: e.clientX, y: e.clientY }; }}
            onMouseMove={handleVrDrag}
            onMouseUp={() => { draggingRef.current = false; }}
            onMouseLeave={() => { draggingRef.current = false; }}
          >
            <canvas ref={vrCanvasRef} style={{ width: "100%", height: "100%", imageRendering: "pixelated" }} />
          </div>
        </div>
      ),
    },
    {
      key: "cpr",
      label: t("vsCpr", "CPR 曲面重建"),
      children: (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>{t("vsSlice", "路径层位 Z")}</span>
            <Slider min={0} max={Math.max(1, maxPos.z - 1)} value={cprSliceZ} onChange={(v) => { setCprSliceZ(v); setCprResult(null); }} style={{ width: 160 }} />
            <span style={{ fontSize: 11, color: "#94a3b8" }}>{cprSliceZ}</span>
            <Button size="small" onClick={() => setCprPoints([])} icon={<RotateCcw size={12} />}>{t("vsClearPath", "清空路径")}</Button>
            <Button size="small" type="primary" loading={cprLoading} onClick={rebuildCpr} icon={<Route size={12} />}>{t("vsRebuild", "重建拉直图")}</Button>
            {cprResult && (
              <Tag color="green">
                {t("vsPathLength", "路径长度")}: {cprResult.totalLengthMm}mm · {t("vsSamples", "采样")}: {cprResult.sampleCount}
              </Tag>
            )}
            <span style={{ fontSize: 11, color: "#64748b" }}>{t("vsCprHint", "点击画布添加路径点, 拖动移动")}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, flex: 1, minHeight: 0 }}>
            <div style={{ background: CARD_BG, borderRadius: 6, border: "1px solid #1e293b", overflow: "hidden", position: "relative" }}>
              <canvas
                ref={cprCanvasRef}
                style={{ width: "100%", height: "100%", imageRendering: "pixelated", cursor: "crosshair" }}
                onMouseDown={handleCprDown}
                onMouseMove={handleCprMove}
                onMouseUp={handleCprUp}
                onMouseLeave={handleCprUp}
              />
              <span style={{ position: "absolute", top: 24, left: 8, fontSize: 10, color: "#64748b", background: "rgba(2,6,23,0.7)", padding: "2px 6px", borderRadius: 4 }}>
                {t("vsCprAxial", "轴向定位图")}
              </span>
            </div>
            <div style={{ background: CARD_BG, borderRadius: 6, border: "1px solid #1e293b", overflow: "hidden", position: "relative" }}>
              <canvas ref={cprStraightRef} style={{ width: "100%", height: "100%", imageRendering: "pixelated" }} />
              <span style={{ position: "absolute", top: 24, left: 8, fontSize: 10, color: "#64748b", background: "rgba(2,6,23,0.7)", padding: "2px 6px", borderRadius: 4 }}>
                {t("vsCprStraight", "拉直图")}
              </span>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "cut",
      label: t("vsCut", "切割"),
      children: (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>{t("vsNormal", "法向量")}</span>
            <InputNumber size="small" value={cutNormal.x} onChange={(v) => setCutNormal((n) => ({ ...n, x: v ?? 0 }))} style={numInputStyle} />
            <InputNumber size="small" value={cutNormal.y} onChange={(v) => setCutNormal((n) => ({ ...n, y: v ?? 0 }))} style={numInputStyle} />
            <InputNumber size="small" value={cutNormal.z} onChange={(v) => setCutNormal((n) => ({ ...n, z: v ?? 0 }))} style={numInputStyle} />
            <div style={{ width: 1, height: 20, background: "#334155" }} />
            <span style={{ fontSize: 12, color: "#94a3b8" }}>{t("vsOffset", "偏移")}</span>
            <Slider min={-128} max={128} value={cutOffset} onChange={setCutOffset} style={{ width: 160 }} />
            <span style={{ fontSize: 11, color: "#94a3b8" }}>{cutOffset}</span>
            <Button size="small" type="primary" loading={cutLoading} onClick={applyCut} icon={<Scissors size={12} />}>{t("vsApplyCut", "应用切割")}</Button>
            {cutResult && (
              <Tag color="purple">
                {t("vsKeptRatio", "保留")}: {Math.round(cutResult.stats.keptRatio * 100)}% · {t("vsClippedRatio", "裁剪")}: {Math.round(cutResult.stats.clippedRatio * 100)}%
              </Tag>
            )}
          </div>
          <div style={{ background: CARD_BG, borderRadius: 6, border: "1px solid #1e293b", overflow: "hidden", flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <canvas ref={cutCanvasRef} style={{ width: "100%", height: "100%", imageRendering: "pixelated" }} />
          </div>
        </div>
      ),
    },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#020617", color: "#cbd5e1", padding: 12, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Box size={18} color={BLUE} />
        <span style={{ fontSize: 15, fontWeight: 700 }}>{t("volumeStudioTitle", "多平面重建工作室")}</span>
        <Tag color="cyan">MPR V2</Tag>
        {mode === "real" && <Tag color="green">{t("vsReal", "真实DICOM")}</Tag>}
        {mode === "synthetic" && <Tag>{t("vsSynthetic", "合成数据")}</Tag>}
        {seriesInfo && <span style={{ fontSize: 11, color: "#64748b" }}>{seriesInfo}</span>}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={tabItems}
          style={{ height: "100%" }}
          tabBarStyle={{ marginBottom: 10 }}
        />
      </div>
      {mode === "loading" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>
          <Spin size="large" tip={t("vsInit", "初始化体数据...")} />
        </div>
      )}
    </div>
  );
};

export default VolumeStudioPage;
