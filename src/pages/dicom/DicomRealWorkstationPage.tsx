// ============================================================
// [W1] 真实 DICOM 阅片工作站 (Real DICOM Workstation)
// Cornerstone3D + 本地真实 DICOM 样本 (public/dicom-samples/**)
// 布局: 左序列列表 / 中央多视口 (1x1|2x2) / 底部缩略图 / 顶部工具栏
// ============================================================
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Activity,
  Box,
  Circle,
  Crosshair,
  Grid3X3,
  Layers,
  LayoutGrid,
  Move,
  Pause,
  Play,
  RotateCcw,
  Ruler,
  SlidersHorizontal,
  Square,
  Sun,
  Trash2,
  Triangle,
  ZoomIn,
} from "lucide-react";
import { t } from "../../i18n/appI18n";
import {
  activateTool,
  activateWindowLevel,
  clearAllAnnotations,
  useCornerstone3D,
  useViewport,
  type LogicalTool,
} from "../../hooks/useCornerstone";
import {
  useVolumeViewports,
  type MprPaneId,
  type MprTool,
  type PaneInfo,
  type VolumePresetKey,
} from "../../hooks/useVolumeViewport";
import {
  getSampleSeries,
  getSeriesImageIds,
  getSeriesWindow,
  listSampleSeries,
} from "../../data/dicomSamples";

const DEFAULT_SERIES = "CT_CHEST";

interface CellState {
  currentIndex: number;
  total: number;
  annotationCount: number;
}

interface ProbeViewport {
  canvasToWorld?: (canvasPos: number[]) => number[];
  worldToIndex?: (worldPos: number[]) => number[];
  getImageData?: () => unknown;
  setProperties?: (props: Record<string, unknown>) => void;
  render?: () => void;
}

interface PresetDef {
  key: string;
  labelKey: string;
  ww: number;
  wc: number;
}

const PRESETS: PresetDef[] = [
  { key: "abdomen", labelKey: "dicomWs.presetAbdomen", ww: 400, wc: 50 },
  { key: "lung", labelKey: "dicomWs.presetLung", ww: 1500, wc: -600 },
  { key: "brain", labelKey: "dicomWs.presetBrain", ww: 80, wc: 40 },
  { key: "bone", labelKey: "dicomWs.presetBone", ww: 2000, wc: 400 },
];

interface MeasureDef {
  id: LogicalTool;
  labelKey: string;
  icon: React.ReactNode;
}

const MEASURE_TOOLS: MeasureDef[] = [
  { id: "Length", labelKey: "dicomWs.toolLength", icon: <Ruler size={14} /> },
  { id: "Angle", labelKey: "dicomWs.toolAngle", icon: <Triangle size={14} /> },
  { id: "Ellipse", labelKey: "dicomWs.toolEllipse", icon: <Circle size={14} /> },
  { id: "Rectangle", labelKey: "dicomWs.toolRect", icon: <Square size={14} /> },
  { id: "Probe", labelKey: "dicomWs.toolProbe", icon: <Crosshair size={14} /> },
];

// ------------------------------------------------------------
// [W2] MPR / VR 布局与体积预设
// ------------------------------------------------------------
type WorkstationLayout = "1x1" | "mpr" | "vr";

/** 逻辑测量工具 -> MPR ToolGroup 工具 (名称漂移见 useVolumeViewport) */
const MPR_TOOL_MAP: Partial<Record<LogicalTool, MprTool>> = {
  WindowLevel: "WindowLevel",
  Pan: "Pan",
  Zoom: "Zoom",
  Length: "Length",
  Angle: "Angle",
  Ellipse: "Ellipse",
  Rectangle: "Rectangle",
  Probe: "Probe",
};

interface VolumePresetOption {
  key: VolumePresetKey;
  labelKey: string;
}

const VOLUME_PRESET_OPTIONS: VolumePresetOption[] = [
  { key: "bone", labelKey: "dicomWs.vrPresetBone" },
  { key: "lung", labelKey: "dicomWs.vrPresetLung" },
  { key: "soft-tissue", labelKey: "dicomWs.vrPresetSoft" },
];

/** 窗宽窗位预设 -> 体积传输函数预设映射 (MPR 模式下同步) */
const WINDOW_TO_VOLUME_PRESET: Record<string, VolumePresetKey> = {
  abdomen: "soft-tissue",
  lung: "lung",
  brain: "soft-tissue",
  bone: "bone",
};

const MPR_PANE_LABELS: Record<MprPaneId, string> = {
  axial: "dicomWs.mprAxial",
  sagittal: "dicomWs.mprSagittal",
  coronal: "dicomWs.mprCoronal",
  volume3d: "dicomWs.vr3d",
};

function readHu(
  vp: ProbeViewport | null,
  el: HTMLElement,
  clientX: number,
  clientY: number,
): number | null {
  try {
    if (!vp) return null;
    const rect = el.getBoundingClientRect();
    const world = vp.canvasToWorld?.([clientX - rect.left, clientY - rect.top]);
    const idx = world ? vp.worldToIndex?.(world) : undefined;
    const imageData = vp.getImageData?.() as
      | { dimensions?: number[]; scalarData?: ArrayLike<number> }
      | undefined;
    const dims = imageData?.dimensions;
    const scalar = imageData?.scalarData;
    if (!idx || !dims || !scalar) return null;
    const cols = dims[0];
    const i = Math.round(idx[0] ?? -1);
    const j = Math.round(idx[1] ?? -1);
    if (
      typeof cols !== "number" ||
      i < 0 ||
      j < 0 ||
      i >= cols ||
      j >= (dims[1] ?? 0)
    ) {
      return null;
    }
    const v = scalar[j * cols + i];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

interface ViewportCellProps {
  cellIndex: number;
  seriesKey: string;
  active: boolean;
  ww: number;
  wc: number;
  cinePlaying: boolean;
  resetSignal: number;
  onActivate: (cellIndex: number) => void;
  onState: (cellIndex: number, state: CellState) => void;
}

function ViewportCell({
  cellIndex,
  seriesKey,
  active,
  ww,
  wc,
  cinePlaying,
  resetSignal,
  onActivate,
  onState,
}: ViewportCellProps) {
  const series = getSampleSeries(seriesKey);
  const imageIds = useMemo(() => getSeriesImageIds(seriesKey), [seriesKey]);
  const vpRef = useRef<ProbeViewport | null>(null);
  const wwRef = useRef(ww);
  const wcRef = useRef(wc);
  wwRef.current = ww;
  wcRef.current = wc;

  const applyPreset = useCallback((vp: ProbeViewport | null) => {
    const w = wwRef.current;
    const c = wcRef.current;
    try {
      vp?.setProperties?.({
        voiRange: { lower: c - w / 2, upper: c + w / 2 },
      });
      vp?.render?.();
    } catch {
      // ignore
    }
  }, []);

  const { elementRef, currentIndex, isLoading, error, annotations, setWWWC, jumpTo, reset } =
    useViewport(`dws-cell-${cellIndex}`, {
      imageIds,
      modality: series?.modality,
      onMount: (vp) => {
        vpRef.current = vp as unknown as ProbeViewport;
        applyPreset(vpRef.current);
      },
    });

  // 预设变化时同步窗宽窗位
  useEffect(() => {
    setWWWC(ww, wc);
    applyPreset(vpRef.current);
  }, [ww, wc, seriesKey, setWWWC, applyPreset]);

  // 重置视图 (父级 resetSignal 变化)
  const resetRef = useRef(resetSignal);
  useEffect(() => {
    if (resetRef.current !== resetSignal) {
      resetRef.current = resetSignal;
      reset();
    }
  }, [resetSignal, reset]);

  // CINE 播放
  const indexRef = useRef(currentIndex);
  indexRef.current = currentIndex;
  useEffect(() => {
    const total = imageIds.length;
    if (!cinePlaying || total <= 1) return;
    const timer = window.setInterval(() => {
      jumpTo((indexRef.current + 1) % total);
    }, 250);
    return () => window.clearInterval(timer);
  }, [cinePlaying, imageIds.length, jumpTo]);

  // 上报状态给父级 (当前层/层数/标注数)
  useEffect(() => {
    onState(cellIndex, {
      currentIndex,
      total: imageIds.length,
      annotationCount: annotations.length,
    });
  }, [cellIndex, currentIndex, imageIds.length, annotations.length, onState]);

  const [hover, setHover] = useState<{
    x: number;
    y: number;
    hu: number | null;
  } | null>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = elementRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const hu = readHu(vpRef.current, el, e.clientX, e.clientY);
    setHover({ x: e.clientX - rect.left, y: e.clientY - rect.top, hu });
  };

  const { ww: defWw, wc: defWc } = getSeriesWindow(series);

  return (
    <div
      onClick={() => onActivate(cellIndex)}
      style={{
        position: "relative",
        overflow: "hidden",
        background: "#000",
        border: active ? "1px solid #38bdf8" : "1px solid #1e293b",
        boxSizing: "border-box",
        minHeight: 0,
      }}
    >
      <div
        ref={elementRef}
        id={`dws-cell-${cellIndex}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
        style={{ position: "absolute", inset: 0, background: "#000" }}
      />

      {/* 患者/序列 HUD (左上) */}
      <div style={s.hudTop} data-testid={`hud-top-${cellIndex}`}>
        <div style={s.hudTitle}>
          {series?.studyDescription || "-"}
        </div>
        <div style={s.hudLine}>
          {t("dicomWs.patient")}: {series?.patientName?.replace("^", " ") || "-"} ·{" "}
          {series?.patientId || "-"}
        </div>
        <div style={s.hudMuted}>
          {t("dicomWs.seriesDesc")}: {series?.seriesDescription || "-"} ·{" "}
          {series?.modality || "-"} · {series?.rows}×{series?.columns}
        </div>
      </div>

      {/* 窗宽窗位 + 层号 HUD (右上) */}
      <div style={s.hudRight}>
        <div>
          W:{ww} L:{wc}
        </div>
        <div>
          {t("dicomWs.sliceIndex")} {currentIndex + 1}/{imageIds.length || 0}
        </div>
        <div style={s.hudMuted}>
          {t("dicomWs.huProbe")}:{" "}
          {hover?.hu !== null && hover?.hu !== undefined
            ? Math.round(hover.hu)
            : "--"}
        </div>
      </div>

      {/* 工具激活 + 标注计数 (左下) */}
      <div style={s.hudBottom}>
        <span>
          {t("dicomWs.annotations")}: {annotations.length}
        </span>
        {active && <span style={{ color: "#38bdf8" }}>{t("dicomWs.activeCell")}</span>}
      </div>

      {/* 十字准星 HUD */}
      {hover && (
        <>
          <div style={{ ...s.crossV, left: hover.x }} />
          <div style={{ ...s.crossH, top: hover.y }} />
        </>
      )}

      {(isLoading || error) && (
        <div style={s.overlay}>
          <Activity size={18} />
          <span>{error || t("dicomWs.engineLoading")}</span>
          <span style={s.hudMuted}>
            {defWw}/{defWc}
          </span>
        </div>
      )}
    </div>
  );
}

interface VolumePaneProps {
  paneId: MprPaneId;
  label: string;
  elementRef: React.RefObject<HTMLDivElement | null>;
  info: PaneInfo;
  status: "idle" | "loading" | "ready" | "error";
  active: boolean;
  onActivate: () => void;
}

/** [W2] MPR / VR 单视口 (真实容积渲染 + 角标 + 十字准星) */
function VolumePane({
  paneId,
  label,
  elementRef,
  info,
  status,
  active,
  onActivate,
}: VolumePaneProps) {
  const loading = status === "loading";
  return (
    <div
      onClick={onActivate}
      data-testid={`mpr-pane-${paneId}`}
      style={{
        ...s.pane,
        border: active ? "1px solid #38bdf8" : "1px solid #1e293b",
      }}
    >
      <div
        ref={elementRef as React.Ref<HTMLDivElement>}
        data-testid={`mpr-canvas-${paneId}`}
        style={{ position: "absolute", inset: 0, background: "#000" }}
      />

      {/* 角标: 方位 (左上) */}
      <div style={s.hudTop} data-testid={`mpr-label-${paneId}`}>
        <div style={s.hudTitle}>{label}</div>
        <div style={s.hudMuted}>{info.orientation.toUpperCase()}</div>
      </div>

      {/* 角标: 层号 + WW/WL (右上) */}
      <div style={s.hudRight}>
        <div>
          W:{info.ww || "-"} L:{info.wc || "-"}
        </div>
        <div>
          {t("dicomWs.sliceIndex")} {info.sliceIndex + 1}/
          {info.numSlices || "-"}
        </div>
      </div>

      {/* 十字准星: Cornerstone CrosshairsTool 叠加; 静态中心十字作为可见兜底 */}
      {paneId !== "volume3d" && (
        <>
          <div style={s.paneCrossV} />
          <div style={s.paneCrossH} />
        </>
      )}

      {loading && (
        <div style={s.overlay}>
          <Activity size={18} />
          <span>{t("dicomWs.volumeLoading")}</span>
        </div>
      )}
    </div>
  );
}

export const DicomRealWorkstationPage: React.FC = () => {
  const { ready } = useCornerstone3D();
  const seriesList = useMemo(() => listSampleSeries(), []);

  const [layout, setLayout] = useState<WorkstationLayout>("mpr");
  const [activeCell, setActiveCell] = useState(0);
  const [cellSeries, setCellSeries] = useState<string[]>([
    DEFAULT_SERIES,
    "CT_HEAD",
    "MR_BRAIN",
    "DR_CHEST",
  ]);
  const [presetKey, setPresetKey] = useState("lung");
  const [activeTool, setActiveTool] = useState<LogicalTool>("WindowLevel");
  const [cinePlaying, setCinePlaying] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [cellStates, setCellStates] = useState<CellState[]>([]);

  // [W2] MPR / VR 真实容积状态
  const [volumePreset, setVolumePreset] = useState<VolumePresetKey>("lung");
  const [slabThickness, setSlabThickness] = useState(10);
  const [mipEnabled, setMipEnabled] = useState(false);
  const [mprTool, setMprTool] = useState<MprTool>("Crosshairs");
  const [activePane, setActivePane] = useState<MprPaneId>("axial");

  const volumeImageIds = useMemo(
    () => getSeriesImageIds(DEFAULT_SERIES),
    [],
  );

  const mprEnabled = layout !== "1x1";
  const mpr = useVolumeViewports({
    enabled: mprEnabled,
    layoutMode: layout === "vr" ? "vr" : "mpr",
    imageIds: volumeImageIds,
    preset: volumePreset,
    slabThickness,
    mipEnabled,
    tool: mprTool,
  });
  const mprFailed = mprEnabled && mpr.status === "error";

  const preset = PRESETS.find((p) => p.key === presetKey) ?? PRESETS[0]!;
  const cellCount = 1;
  const activeKey = cellSeries[activeCell] ?? DEFAULT_SERIES;
  const activeSeries = getSampleSeries(activeKey);
  const activeState = cellStates[activeCell];

  const handleCellState = useCallback((cellIndex: number, state: CellState) => {
    setCellStates((prev) => {
      const cur = prev[cellIndex];
      if (
        cur &&
        cur.currentIndex === state.currentIndex &&
        cur.total === state.total &&
        cur.annotationCount === state.annotationCount
      ) {
        return prev;
      }
      const next = [...prev];
      next[cellIndex] = state;
      return next;
    });
  }, []);

  const applyPreset = (p: PresetDef) => {
    setPresetKey(p.key);
    activateWindowLevel();
    setActiveTool("WindowLevel");
    // MPR 模式下同步体积传输函数/VOI
    const volumeKey = WINDOW_TO_VOLUME_PRESET[p.key];
    if (volumeKey) setVolumePreset(volumeKey);
  };

  const selectTool = (tool: LogicalTool) => {
    activateTool(tool);
    setActiveTool(tool);
    // [W2] 同步到 MPR ToolGroup (名称漂移在 hook 内兼容)
    const mprMapped = MPR_TOOL_MAP[tool];
    if (mprMapped) setMprTool(mprMapped);
  };

  const selectMprTool = (tool: MprTool) => {
    setMprTool(tool);
  };

  const selectSeries = (key: string) => {
    setCellSeries((prev) => {
      const next = [...prev];
      next[activeCell] = key;
      return next;
    });
    setCinePlaying(false);
  };

  return (
    <div style={s.root}>
      {/* 顶部工具栏 */}
      <div style={s.toolbar}>
        <div style={s.brand}>
          <LayoutGrid size={16} color="#38bdf8" />
          <span style={s.brandText}>{t("dicomWs.title")}</span>
          <span
            style={{
              ...s.pill,
              background: ready ? "#064e3b" : "#7c2d12",
              color: ready ? "#6ee7b7" : "#fdba74",
            }}
          >
            {ready ? t("dicomWs.engineReady") : t("dicomWs.engineLoading")}
          </span>
          <span style={{ ...s.pill, background: "#1e3a8a", color: "#93c5fd" }}>
            {t("dicomWs.realPixels")}
          </span>
        </div>

        <div style={s.toolGroup}>
          <span style={s.groupLabel}>{t("dicomWs.windowPreset")}</span>
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              data-testid={`preset-${p.key}`}
              onClick={() => applyPreset(p)}
              style={{
                ...s.btn,
                ...(presetKey === p.key && activeTool === "WindowLevel"
                  ? s.btnActive
                  : {}),
              }}
            >
              <Sun size={13} />
              {t(p.labelKey)}
            </button>
          ))}
        </div>

        <div style={s.toolGroup}>
          <span style={s.groupLabel}>{t("dicomWs.workstation")}</span>
          <button
            type="button"
            data-testid="tool-zoom"
            onClick={() => selectTool("Zoom")}
            style={{ ...s.btn, ...(activeTool === "Zoom" ? s.btnActive : {}) }}
          >
            <ZoomIn size={13} /> {t("dicomWs.toolZoom")}
          </button>
          <button
            type="button"
            data-testid="tool-pan"
            onClick={() => selectTool("Pan")}
            style={{ ...s.btn, ...(activeTool === "Pan" ? s.btnActive : {}) }}
          >
            <Move size={13} /> {t("dicomWs.toolPan")}
          </button>
          <button
            type="button"
            data-testid="tool-reset"
            onClick={() => {
              setResetSignal((v) => v + 1);
              activateWindowLevel();
              setActiveTool("WindowLevel");
            }}
            style={s.btn}
          >
            <RotateCcw size={13} /> {t("dicomWs.toolReset")}
          </button>
          <button
            type="button"
            data-testid="tool-cine"
            onClick={() => setCinePlaying((v) => !v)}
            style={{ ...s.btn, ...(cinePlaying ? s.btnActive : {}) }}
          >
            {cinePlaying ? <Pause size={13} /> : <Play size={13} />}
            {cinePlaying ? t("dicomWs.toolCineStop") : t("dicomWs.toolCine")}
          </button>
        </div>

        <div style={s.toolGroup}>
          <span style={s.groupLabel}>{t("dicomWs.measureTools")}</span>
          {MEASURE_TOOLS.map((m) => (
            <button
              key={m.id}
              type="button"
              data-testid={`measure-${m.id}`}
              onClick={() => selectTool(m.id)}
              title={t(m.labelKey)}
              style={{ ...s.btn, ...(activeTool === m.id ? s.btnActive : {}) }}
            >
              {m.icon}
            </button>
          ))}
          <button
            type="button"
            data-testid="clear-annotations"
            onClick={() => clearAllAnnotations()}
            style={{ ...s.btn, color: "#fca5a5" }}
          >
            <Trash2 size={13} /> {t("dicomWs.clearAnnotations")}
          </button>
        </div>

        {mprEnabled && (
          <div style={s.toolGroup} data-testid="mpr-controls">
            <span style={s.groupLabel}>{t("dicomWs.mprControls")}</span>
            {VOLUME_PRESET_OPTIONS.map((p) => (
              <button
                key={p.key}
                type="button"
                data-testid={`vr-preset-${p.key}`}
                onClick={() => setVolumePreset(p.key)}
                style={{
                  ...s.btn,
                  ...(volumePreset === p.key ? s.btnActive : {}),
                }}
              >
                <Layers size={13} /> {t(p.labelKey)}
              </button>
            ))}
            <button
              type="button"
              data-testid="mpr-mip"
              onClick={() => setMipEnabled((v) => !v)}
              style={{ ...s.btn, ...(mipEnabled ? s.btnActive : {}) }}
            >
              <Sun size={13} /> {t("dicomWs.mip")}
            </button>
            <label style={s.slabLabel} title={t("dicomWs.slabThickness")}>
              <SlidersHorizontal size={13} />
              {t("dicomWs.slabThickness")}
              <input
                type="range"
                data-testid="mpr-slab"
                min={1}
                max={50}
                step={1}
                value={slabThickness}
                onChange={(e) => setSlabThickness(Number(e.target.value))}
                style={s.slabRange}
              />
              <span style={s.slabValue}>{slabThickness}mm</span>
            </label>
            <button
              type="button"
              data-testid="mpr-crosshair"
              onClick={() => selectMprTool("Crosshairs")}
              style={{
                ...s.btn,
                ...(mprTool === "Crosshairs" ? s.btnActive : {}),
              }}
            >
              <Crosshair size={13} /> {t("dicomWs.crosshair")}
            </button>
            <button
              type="button"
              data-testid="mpr-reset"
              onClick={() => mpr.resetView()}
              style={s.btn}
            >
              <RotateCcw size={13} /> {t("dicomWs.toolReset")}
            </button>
          </div>
        )}

        <div style={{ flex: 1 }} />

        <div style={s.toolGroup}>
          <span style={s.groupLabel}>{t("dicomWs.layout")}</span>
          <button
            type="button"
            data-testid="layout-1x1"
            onClick={() => setLayout("1x1")}
            style={{ ...s.btn, ...(layout === "1x1" ? s.btnActive : {}) }}
          >
            {t("dicomWs.layout1x1")}
          </button>
          <button
            type="button"
            data-testid="layout-mpr"
            onClick={() => setLayout("mpr")}
            style={{ ...s.btn, ...(layout === "mpr" ? s.btnActive : {}) }}
          >
            <Grid3X3 size={13} /> {t("dicomWs.layoutMpr")}
          </button>
          <button
            type="button"
            data-testid="layout-vr"
            onClick={() => setLayout("vr")}
            style={{ ...s.btn, ...(layout === "vr" ? s.btnActive : {}) }}
          >
            <Box size={13} /> {t("dicomWs.layoutVr")}
          </button>
        </div>
      </div>

      {/* 主体: 序列列表 + 视口 + 元数据 */}
      <div style={s.body}>
        <aside style={s.sidebar}>
          <div style={s.sideHeader}>{t("dicomWs.seriesList")}</div>
          <div style={s.sideScroll}>
            {seriesList.map((sd) => {
              const selected = sd.key === activeKey;
              return (
                <button
                  key={sd.key}
                  type="button"
                  data-testid={`series-${sd.key}`}
                  onClick={() => selectSeries(sd.key)}
                  style={{
                    ...s.seriesItem,
                    borderColor: selected ? "#38bdf8" : "#1e293b",
                    background: selected ? "#0c4a6e" : "#0b1220",
                  }}
                >
                  <div style={s.seriesTop}>
                    <span style={s.seriesMod}>{sd.modality}</span>
                    <span style={s.seriesKey}>{sd.key}</span>
                  </div>
                  <div style={s.seriesDesc}>{sd.seriesDescription}</div>
                  <div style={s.hudMuted}>
                    {sd.studyDescription} · {sd.count} {t("dicomWs.slices")}
                  </div>
                </button>
              );
            })}
            {seriesList.length === 0 && (
              <div style={s.hudMuted}>{t("dicomWs.noSeries")}</div>
            )}
          </div>

          {/* 序列元数据 */}
          <div style={s.metaBox}>
            <div style={s.sideHeader}>{t("dicomWs.study")}</div>
            <Meta label={t("dicomWs.patient")} value={activeSeries?.patientName?.replace("^", " ")} />
            <Meta label={t("dicomWs.patientId")} value={activeSeries?.patientId} />
            <Meta label={t("dicomWs.modality")} value={activeSeries?.modality} />
            <Meta label={t("dicomWs.seriesDesc")} value={activeSeries?.seriesDescription} />
            <Meta
              label={t("dicomWs.size")}
              value={
                activeSeries ? `${activeSeries.rows}×${activeSeries.columns}` : undefined
              }
            />
            <Meta
              label={t("dicomWs.sliceIndex")}
              value={
                activeState
                  ? `${activeState.currentIndex + 1}/${activeState.total}`
                  : "-"
              }
            />
            <Meta
              label={t("dicomWs.annotations")}
              value={String(activeState?.annotationCount ?? 0)}
            />
          </div>
        </aside>

        <main style={s.viewportArea}>
          {mprFailed && (
            <div style={s.warnBanner} data-testid="mpr-fallback-warning">
              <Activity size={14} />
              {t("dicomWs.volumeError")}
            </div>
          )}
          {layout === "1x1" || mprFailed ? (
            <div
              style={{
                ...s.grid,
                gridTemplateColumns: "1fr",
                gridTemplateRows: "1fr",
              }}
            >
              {Array.from({ length: cellCount }).map((_, idx) => {
                const key = cellSeries[idx] ?? DEFAULT_SERIES;
                return (
                  <ViewportCell
                    key={`cell-${idx}`}
                    cellIndex={idx}
                    seriesKey={key}
                    active={activeCell === idx}
                    ww={preset.ww}
                    wc={preset.wc}
                    cinePlaying={cinePlaying}
                    resetSignal={resetSignal}
                    onActivate={setActiveCell}
                    onState={handleCellState}
                  />
                );
              })}
            </div>
          ) : (
            <div
              style={{
                ...s.grid,
                gridTemplateColumns: layout === "vr" ? "1fr" : "1fr 1fr",
                gridTemplateRows: layout === "vr" ? "1fr" : "1fr 1fr",
              }}
            >
              {layout === "mpr" ? (
                (
                  ["axial", "sagittal", "coronal", "volume3d"] as MprPaneId[]
                ).map((paneId) => (
                  <VolumePane
                    key={paneId}
                    paneId={paneId}
                    label={t(MPR_PANE_LABELS[paneId])}
                    elementRef={mpr.refs[paneId]}
                    info={mpr.paneInfo[paneId]}
                    status={mpr.status}
                    active={activePane === paneId}
                    onActivate={() => setActivePane(paneId)}
                  />
                ))
              ) : (
                <VolumePane
                  paneId="volume3d"
                  label={t("dicomWs.vr3d")}
                  elementRef={mpr.refs.volume3d}
                  info={mpr.paneInfo.volume3d}
                  status={mpr.status}
                  active
                  onActivate={() => setActivePane("volume3d")}
                />
              )}
            </div>
          )}
        </main>
      </div>

      {/* 底部缩略图条 */}
      <div style={s.thumbStrip} data-testid="thumb-strip">
        <span style={s.groupLabel}>{t("dicomWs.thumbnails")}</span>
        <div style={s.thumbScroll}>
          {seriesList.map((sd) => {
            const series = getSampleSeries(sd.key);
            const firstInstance = series?.instances[0];
            return (
              <button
                key={sd.key}
                type="button"
                data-testid={`thumb-${sd.key}`}
                onClick={() => selectSeries(sd.key)}
                style={{
                  ...s.thumb,
                  borderColor: sd.key === activeKey ? "#38bdf8" : "#1e293b",
                }}
                title={firstInstance?.file}
              >
                <span style={s.thumbMod}>{sd.modality}</span>
                <span style={s.thumbCount}>{sd.count}</span>
                <span style={s.thumbDesc}>{sd.seriesDescription}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

function Meta({ label, value }: { label: string; value?: string | number }) {
  return (
    <div style={s.metaRow}>
      <span style={s.metaLabel}>{label}</span>
      <span style={s.metaValue}>{value ?? "-"}</span>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: {
    display: "flex",
    flexDirection: "column",
    height: "calc(100vh - 120px)",
    minHeight: 600,
    background: "#020617",
    color: "#e2e8f0",
    borderRadius: 8,
    overflow: "hidden",
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "6px 10px",
    background: "#0b1220",
    borderBottom: "1px solid #1e293b",
    flexWrap: "wrap",
  },
  brand: { display: "flex", alignItems: "center", gap: 8 },
  brandText: { fontSize: 12, fontWeight: 700, color: "#f8fafc", whiteSpace: "nowrap" },
  pill: {
    fontSize: 10,
    padding: "2px 6px",
    borderRadius: 10,
    whiteSpace: "nowrap",
  },
  toolGroup: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    paddingLeft: 8,
    borderLeft: "1px solid #1e293b",
  },
  groupLabel: { fontSize: 10, color: "#64748b", whiteSpace: "nowrap" },
  btn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    background: "#111c2e",
    color: "#cbd5e1",
    border: "1px solid #1e293b",
    borderRadius: 4,
    padding: "4px 8px",
    fontSize: 11,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  btnActive: {
    background: "#0c4a6e",
    borderColor: "#38bdf8",
    color: "#e0f2fe",
  },
  body: { display: "flex", flex: 1, minHeight: 0 },
  sidebar: {
    width: 250,
    display: "flex",
    flexDirection: "column",
    background: "#0b1220",
    borderRight: "1px solid #1e293b",
    minHeight: 0,
  },
  sideHeader: {
    fontSize: 11,
    fontWeight: 700,
    color: "#94a3b8",
    padding: "6px 10px",
    borderBottom: "1px solid #1e293b",
    background: "#0f172a",
  },
  sideScroll: { flex: 1, overflowY: "auto", padding: 6 },
  seriesItem: {
    display: "block",
    width: "100%",
    textAlign: "left",
    background: "#0b1220",
    border: "1px solid #1e293b",
    borderRadius: 6,
    padding: "6px 8px",
    marginBottom: 6,
    cursor: "pointer",
    color: "#cbd5e1",
    fontFamily: "inherit",
  },
  seriesTop: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  seriesMod: {
    fontSize: 10,
    fontWeight: 700,
    color: "#38bdf8",
    background: "#082f49",
    borderRadius: 3,
    padding: "1px 5px",
  },
  seriesKey: { fontSize: 10, color: "#64748b" },
  seriesDesc: { fontSize: 11, color: "#e2e8f0", marginTop: 2 },
  metaBox: { borderTop: "1px solid #1e293b" },
  metaRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    padding: "3px 10px",
    fontSize: 11,
  },
  metaLabel: { color: "#64748b" },
  metaValue: { color: "#e2e8f0", textAlign: "right", wordBreak: "break-all" },
  viewportArea: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    padding: 4,
    background: "#000",
    position: "relative",
  },
  grid: { display: "grid", width: "100%", height: "100%", gap: 4 },
  pane: {
    position: "relative",
    overflow: "hidden",
    background: "#000",
    boxSizing: "border-box",
    minHeight: 0,
  },
  paneCrossV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "50%",
    width: 1,
    background: "rgba(56,189,248,0.35)",
    pointerEvents: "none",
  },
  paneCrossH: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "50%",
    height: 1,
    background: "rgba(56,189,248,0.35)",
    pointerEvents: "none",
  },
  slabLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 11,
    color: "#cbd5e1",
    whiteSpace: "nowrap",
  },
  slabRange: { width: 90, accentColor: "#38bdf8" },
  slabValue: { fontSize: 10, color: "#7dd3fc", minWidth: 34 },
  warnBanner: {
    position: "absolute",
    top: 8,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 5,
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "#7c2d12",
    color: "#fed7aa",
    border: "1px solid #9a3412",
    borderRadius: 4,
    padding: "4px 10px",
    fontSize: 11,
  },
  hudTop: {
    position: "absolute",
    top: 6,
    left: 6,
    pointerEvents: "none",
    textShadow: "0 1px 2px #000",
  },
  hudTitle: { fontSize: 12, fontWeight: 700, color: "#fbbf24" },
  hudLine: { fontSize: 11, color: "#e2e8f0" },
  hudMuted: { fontSize: 10, color: "#94a3b8" },
  hudRight: {
    position: "absolute",
    top: 6,
    right: 6,
    textAlign: "right",
    fontSize: 11,
    color: "#7dd3fc",
    pointerEvents: "none",
    textShadow: "0 1px 2px #000",
  },
  hudBottom: {
    position: "absolute",
    bottom: 6,
    left: 6,
    right: 6,
    display: "flex",
    justifyContent: "space-between",
    fontSize: 10,
    color: "#cbd5e1",
    pointerEvents: "none",
    textShadow: "0 1px 2px #000",
  },
  crossV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    background: "rgba(56,189,248,0.5)",
    pointerEvents: "none",
  },
  crossH: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    background: "rgba(56,189,248,0.5)",
    pointerEvents: "none",
  },
  overlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    background: "rgba(2,6,23,0.75)",
    color: "#94a3b8",
    fontSize: 12,
  },
  thumbStrip: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    background: "#0b1220",
    borderTop: "1px solid #1e293b",
    minHeight: 66,
  },
  thumbScroll: { display: "flex", gap: 6, overflowX: "auto", flex: 1 },
  thumb: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 2,
    minWidth: 120,
    background: "#0b1220",
    border: "1px solid #1e293b",
    borderRadius: 6,
    padding: "4px 8px",
    cursor: "pointer",
    color: "#cbd5e1",
    fontFamily: "inherit",
  },
  thumbMod: { fontSize: 10, color: "#38bdf8", fontWeight: 700 },
  thumbCount: { fontSize: 10, color: "#94a3b8" },
  thumbDesc: { fontSize: 10, color: "#e2e8f0", whiteSpace: "nowrap" },
};

export default DicomRealWorkstationPage;
