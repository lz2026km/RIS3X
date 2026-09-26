// ============================================================
// [W2] Cornerstone3D 真实容积重建 (MPR / MIP / VR / thin-slab)
// - 从 wadouri imageIds 构建 StreamingImageVolume
// - ORTHOGRAPHIC 视口 (axial / sagittal / coronal) + VolumeViewport3D (VR)
// - 传输函数预设 (CT-Bone / CT-Lung / CT-Soft-Tissue)
// - MAXIMUM_INTENSITY_BLEND (MIP) + slabThickness (薄层)
// - CrosshairsTool 多视口十字准星联动
// 说明: 所有动态 import 以 shim 类型访问, 与 useCornerstone.ts 保持一致。
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { initCornerstone3D } from "./useCornerstone";

// ------------------------------------------------------------
// 对外类型
// ------------------------------------------------------------
export type MprPaneId = "axial" | "sagittal" | "coronal" | "volume3d";
export type MprLayoutMode = "mpr" | "vr";
export type VolumePresetKey = "bone" | "lung" | "soft-tissue";
export type VolumeStatus = "idle" | "loading" | "ready" | "error";

export type MprTool =
  | "Crosshairs"
  | "TrackballRotate"
  | "WindowLevel"
  | "Pan"
  | "Zoom"
  | "StackScroll"
  | "Length"
  | "Angle"
  | "Ellipse"
  | "Rectangle"
  | "Probe";

export interface VolumePresetDef {
  /** 候选 Cornerstone VIEWPORT_PRESETS 名称 (版本命名差异兼容) */
  names: string[];
  /** 默认窗宽 (用于 MPR 2D 视口 VOI) */
  ww: number;
  /** 默认窗位 */
  wc: number;
}

/** VR / MPR 传输函数预设 (名称回退见 resolvePresetName) */
export const VOLUME_PRESETS: Record<VolumePresetKey, VolumePresetDef> = {
  bone: { names: ["CT-BONE", "CT-Bone", "CT-Bones"], ww: 2000, wc: 400 },
  lung: { names: ["CT-LUNG", "CT-Lung"], ww: 1500, wc: -600 },
  "soft-tissue": {
    names: ["CT-SOFT-TISSUE", "CT-Soft-Tissue", "CT-Muscle"],
    ww: 400,
    wc: 40,
  },
};

export interface PaneInfo {
  orientation: string;
  sliceIndex: number;
  numSlices: number;
  ww: number;
  wc: number;
}

export type PaneInfoMap = Record<MprPaneId, PaneInfo>;

export interface VolumeViewportRefs {
  axial: RefObject<HTMLDivElement | null>;
  sagittal: RefObject<HTMLDivElement | null>;
  coronal: RefObject<HTMLDivElement | null>;
  volume3d: RefObject<HTMLDivElement | null>;
}

export interface UseVolumeViewportsOptions {
  enabled: boolean;
  layoutMode: MprLayoutMode;
  imageIds: string[];
  preset: VolumePresetKey;
  slabThickness: number;
  mipEnabled: boolean;
  tool: MprTool;
}

export interface UseVolumeViewportsResult {
  refs: VolumeViewportRefs;
  status: VolumeStatus;
  error: string | null;
  paneInfo: PaneInfoMap;
  resetView: () => void;
}

// ------------------------------------------------------------
// Cornerstone3D 模块类型 shim (运行期以 any 访问)
// ------------------------------------------------------------
interface CoreViewportLike {
  id?: string;
  render?: () => void;
  resize?: () => void;
  setVolumes?: (
    inputs: Array<{ volumeId: string }>,
    immediate?: boolean,
  ) => Promise<void> | void;
  setProperties?: (props: Record<string, unknown>) => void;
  getProperties?: () =>
    | { voiRange?: { lower?: number; upper?: number } }
    | undefined
    | null;
  setBlendMode?: (
    mode: number,
    filterActorUIDs?: unknown[],
    immediate?: boolean,
  ) => void;
  setSlabThickness?: (slabThickness: number, filterActorUIDs?: unknown[]) => void;
  resetSlabThickness?: () => void;
  resetCamera?: (options?: Record<string, unknown>) => void;
  getSliceIndex?: () => number;
  getNumberOfSlices?: () => number;
  getImageIds?: () => string[];
}

interface CoreRenderingEngineLike {
  id?: string;
  enableElement(opts: {
    viewportId: string;
    type: string;
    element: HTMLElement;
    defaultOptions?: { orientation?: string; background?: number[] };
  }): void;
  getViewport(id: string): CoreViewportLike;
  disableElement(id: string): void;
  resize(immediate?: boolean, keepCamera?: boolean): void;
  render(): void;
  destroy(): void;
}

interface VolumeLike {
  volumeId?: string;
  dimensions?: number[];
  load?: (callback?: (...args: unknown[]) => void) => void;
  cancelLoading?: () => void;
  destroy?: () => void;
}

interface CoreModuleLike {
  RenderingEngine?: new (id: string) => CoreRenderingEngineLike;
  volumeLoader?: {
    createAndCacheVolume?: (
      volumeId: string,
      options: { imageIds: string[]; progressiveRendering?: boolean },
    ) => Promise<VolumeLike>;
  };
  cache?: { getVolume?: (id: string) => VolumeLike | undefined };
  Enums?: {
    ViewportType?: Record<string, string>;
    OrientationAxis?: Record<string, string>;
    BlendModes?: Record<string, number>;
  };
  CONSTANTS?: { VIEWPORT_PRESETS?: Array<{ name?: string }> };
  eventTarget?: EventTarget;
}

interface ToolClassLike {
  toolName?: string;
}

interface ToolGroupLike {
  addTool: (name: string, config?: unknown) => void;
  addViewport: (viewportId: string, renderingEngineId?: string) => void;
  removeViewports?: (renderingEngineId: string, viewportId?: string) => void;
  setToolActive: (
    name: string,
    options?: { bindings?: Array<{ mouseButton?: number }> },
  ) => void;
  setToolPassive: (
    name: string,
    options?: { removeAllBindings?: boolean | unknown[] },
  ) => void;
  setToolConfiguration: (
    name: string,
    configuration: Record<string, unknown>,
    overwrite?: boolean,
  ) => boolean;
}

interface ToolsModuleLike {
  addTool?: (tool: unknown) => void;
  ToolGroupManager?: {
    createToolGroup?: (id: string) => ToolGroupLike | undefined;
    getToolGroup?: (id: string) => ToolGroupLike | undefined;
    destroyToolGroup?: (id: string) => void;
  };
  Enums?: { MouseBindings?: Record<string, number> };
  [key: string]: unknown;
}

interface MprSession {
  disposed: boolean;
  engineId: string;
  toolGroupId: string;
  engine: CoreRenderingEngineLike;
  toolGroup: ToolGroupLike;
  csCore: CoreModuleLike;
  csTools: ToolsModuleLike;
  toolNames: Partial<Record<MprTool, string>>;
  viewports: Partial<Record<MprPaneId, CoreViewportLike>>;
  paneOrder: MprPaneId[];
  volumeId: string;
  preset: VolumePresetKey;
  slabThickness: number;
  mipEnabled: boolean;
  tool: MprTool;
}

// ------------------------------------------------------------
// 工具注册 (逻辑名 -> 候选类名, 兼容 Cornerstone 命名差异)
// ------------------------------------------------------------
const MPR_TOOL_CANDIDATES: Record<MprTool, string[]> = {
  Crosshairs: ["CrosshairsTool"],
  TrackballRotate: ["TrackballRotateTool"],
  WindowLevel: ["WindowLevelTool"],
  Pan: ["PanTool"],
  Zoom: ["ZoomTool"],
  StackScroll: ["StackScrollMouseWheelTool", "StackScrollTool"],
  Length: ["LengthTool"],
  Angle: ["AngleTool"],
  Ellipse: ["EllipticalROITool"],
  Rectangle: ["RectangleROITool"],
  Probe: ["ProbeTool"],
};

const ORTHO_PANES: MprPaneId[] = ["axial", "sagittal", "coronal"];

function resolveToolClass(
  csTools: ToolsModuleLike,
  candidates: string[],
): ToolClassLike | undefined {
  for (const name of candidates) {
    const cls = csTools[name];
    if (cls && typeof cls === "function") {
      return cls as ToolClassLike;
    }
  }
  return undefined;
}

function registerMprTools(
  csTools: ToolsModuleLike,
): Partial<Record<MprTool, string>> {
  const map: Partial<Record<MprTool, string>> = {};
  (Object.keys(MPR_TOOL_CANDIDATES) as MprTool[]).forEach((logical) => {
    const cls = resolveToolClass(csTools, MPR_TOOL_CANDIDATES[logical]);
    const toolName = cls?.toolName;
    if (!cls || !toolName) return;
    try {
      csTools.addTool?.(cls);
      map[logical] = toolName;
    } catch (e) {
      console.warn(`[Cornerstone3D][MPR] addTool(${toolName}) failed:`, e);
    }
  });
  return map;
}

function mouseBindings(csTools: ToolsModuleLike): {
  primary: number;
  auxiliary: number;
  wheel: number;
} {
  const mb = csTools.Enums?.MouseBindings ?? {};
  return {
    primary: mb["Primary"] ?? 1,
    auxiliary: mb["Auxiliary"] ?? 4,
    wheel: mb["Wheel"] ?? 524288,
  };
}

/** 从 VIEWPORT_PRESETS 中按名称 (大小写不敏感) 解析真实预设名 */
function resolvePresetName(
  csCore: CoreModuleLike,
  names: string[],
): string | null {
  const presets = csCore.CONSTANTS?.VIEWPORT_PRESETS ?? [];
  for (const candidate of names) {
    const found = presets.find(
      (p) => (p.name ?? "").toLowerCase() === candidate.toLowerCase(),
    );
    if (found?.name) return found.name;
  }
  return names[0] ?? null;
}

// ------------------------------------------------------------
// 视口状态应用
// ------------------------------------------------------------
function applyPreset(session: MprSession): void {
  const def = VOLUME_PRESETS[session.preset];
  const lower = def.wc - def.ww / 2;
  const upper = def.wc + def.ww / 2;

  ORTHO_PANES.forEach((id) => {
    const vp = session.viewports[id];
    if (!vp?.setProperties) return;
    try {
      vp.setProperties({ voiRange: { lower, upper } });
      vp.render?.();
    } catch (e) {
      console.warn(`[Cornerstone3D][MPR] VOI 应用失败 (${id}):`, e);
    }
  });

  const vr = session.viewports.volume3d;
  if (vr?.setProperties) {
    const name = resolvePresetName(session.csCore, def.names);
    try {
      if (name) vr.setProperties({ preset: name });
      vr.render?.();
    } catch (e) {
      console.warn("[Cornerstone3D][MPR] VR 传输函数预设失败:", e);
    }
  }
}

function applySlabAndMip(session: MprSession): void {
  const blendModes = session.csCore.Enums?.BlendModes ?? {};
  const blend = session.mipEnabled
    ? (blendModes["MAXIMUM_INTENSITY_BLEND"] ?? 1)
    : (blendModes["COMPOSITE"] ?? 0);

  ORTHO_PANES.forEach((id) => {
    const vp = session.viewports[id];
    if (!vp) return;
    try {
      vp.setBlendMode?.(blend);
      if (session.mipEnabled) {
        vp.setSlabThickness?.(session.slabThickness);
      } else {
        vp.resetSlabThickness?.();
      }
      vp.render?.();
    } catch (e) {
      console.warn(`[Cornerstone3D][MPR] slab/MIP 应用失败 (${id}):`, e);
    }
  });
}

function applyTool(session: MprSession): void {
  const toolGroup = session.toolGroup;
  const { primary, auxiliary, wheel } = mouseBindings(session.csTools);

  (Object.values(session.toolNames) as string[]).forEach((name) => {
    try {
      toolGroup.setToolPassive(name);
    } catch {
      // 工具可能未注册, 忽略
    }
  });

  const target = session.toolNames[session.tool];
  if (target) {
    const bindings =
      session.tool === "Pan"
        ? [{ mouseButton: primary }, { mouseButton: auxiliary }]
        : [{ mouseButton: primary }];
    try {
      toolGroup.setToolActive(target, { bindings });
    } catch (e) {
      console.warn(`[Cornerstone3D][MPR] 激活工具 ${session.tool} 失败:`, e);
    }
  }

  const scroll = session.toolNames.StackScroll;
  if (scroll) {
    try {
      toolGroup.setToolActive(scroll, { bindings: [{ mouseButton: wheel }] });
    } catch {
      // ignore
    }
  }
}

// ------------------------------------------------------------
// 视口信息采集 (角标: 方位 / 层号 / WW-WL)
// ------------------------------------------------------------
function emptyPaneInfo(): PaneInfoMap {
  const blank: PaneInfo = {
    orientation: "-",
    sliceIndex: 0,
    numSlices: 0,
    ww: 0,
    wc: 0,
  };
  return {
    axial: { ...blank, orientation: "axial" },
    sagittal: { ...blank, orientation: "sagittal" },
    coronal: { ...blank, orientation: "coronal" },
    volume3d: { ...blank, orientation: "3D" },
  };
}

function readPane(
  session: MprSession,
  id: MprPaneId,
  orientation: string,
): PaneInfo {
  const vp = session.viewports[id];
  let sliceIndex = 0;
  let numSlices = 0;
  let ww = 0;
  let wc = 0;
  try {
    sliceIndex = vp?.getSliceIndex?.() ?? 0;
  } catch {
    // ignore
  }
  try {
    numSlices = vp?.getNumberOfSlices?.() ?? 0;
  } catch {
    // ignore
  }
  try {
    const range = vp?.getProperties?.()?.voiRange;
    if (
      range &&
      typeof range.lower === "number" &&
      typeof range.upper === "number"
    ) {
      ww = Math.round(range.upper - range.lower);
      wc = Math.round((range.upper + range.lower) / 2);
    }
  } catch {
    // ignore
  }
  return { orientation, sliceIndex, numSlices, ww, wc };
}

function collectPaneInfo(session: MprSession): PaneInfoMap {
  return {
    axial: readPane(session, "axial", "axial"),
    sagittal: readPane(session, "sagittal", "sagittal"),
    coronal: readPane(session, "coronal", "coronal"),
    volume3d: readPane(session, "volume3d", "3D"),
  };
}

function isSamePaneInfo(a: PaneInfoMap, b: PaneInfoMap): boolean {
  return (Object.keys(a) as MprPaneId[]).every((id) => {
    const x = a[id];
    const y = b[id];
    return (
      x.orientation === y.orientation &&
      x.sliceIndex === y.sliceIndex &&
      x.numSlices === y.numSlices &&
      x.ww === y.ww &&
      x.wc === y.wc
    );
  });
}

// ------------------------------------------------------------
// 会话生命周期
// ------------------------------------------------------------
let mprSessionSeq = 0;

function destroySession(session: MprSession): void {
  if (session.disposed) return;
  session.disposed = true;
  try {
    session.csTools.ToolGroupManager?.destroyToolGroup?.(session.toolGroupId);
  } catch {
    // ignore
  }
  try {
    session.engine.destroy();
  } catch {
    // ignore
  }
}

interface CreateSessionOptions {
  layoutMode: MprLayoutMode;
  imageIds: string[];
  elementFor: (id: MprPaneId) => HTMLDivElement | null;
  preset: VolumePresetKey;
  slabThickness: number;
  mipEnabled: boolean;
  tool: MprTool;
  /** 返回 true 时中止初始化 (StrictMode / 快速切换布局保护) */
  shouldAbort: () => boolean;
}

class MprAbortError extends Error {}

async function createSession(
  opts: CreateSessionOptions,
): Promise<MprSession> {
  await initCornerstone3D();
  if (opts.shouldAbort()) throw new MprAbortError("aborted");

  const csCore = (await import(
    "@cornerstonejs/core"
  )) as unknown as CoreModuleLike;
  const csTools = (await import(
    "@cornerstonejs/tools"
  )) as unknown as ToolsModuleLike;

  const volumeLoader = csCore.volumeLoader;
  if (!volumeLoader?.createAndCacheVolume) {
    throw new Error("volumeLoader.createAndCacheVolume 不可用");
  }
  if (!csCore.RenderingEngine) {
    throw new Error("RenderingEngine 不可用");
  }

  // 1) 构建并缓存容积 (StreamingImageVolume), 再触发流式加载
  const volumeId = `g005-mpr-volume:${opts.imageIds.length}`;
  const volume = await volumeLoader.createAndCacheVolume(volumeId, {
    imageIds: opts.imageIds,
  });
  if (opts.shouldAbort()) throw new MprAbortError("aborted");
  volume.load?.();

  mprSessionSeq += 1;
  const engineId = `g005-mpr-engine-${mprSessionSeq}`;
  const toolGroupId = `g005-mpr-toolgroup-${mprSessionSeq}`;

  const toolNames = registerMprTools(csTools);
  const engine = new csCore.RenderingEngine(engineId);

  let session: MprSession | null = null;
  try {
    const manager = csTools.ToolGroupManager;
    const toolGroup =
      manager?.getToolGroup?.(toolGroupId) ??
      manager?.createToolGroup?.(toolGroupId);
    if (!toolGroup) throw new Error("ToolGroup 创建失败");

    const viewports: Partial<Record<MprPaneId, CoreViewportLike>> = {};
    const paneOrder: MprPaneId[] = [];

    const orthoType =
      csCore.Enums?.ViewportType?.ORTHOGRAPHIC ?? "orthographic";
    const volume3dType =
      csCore.Enums?.ViewportType?.VOLUME_3D ?? "volume3d";
    const orientations: Record<MprPaneId, string | undefined> = {
      axial: csCore.Enums?.OrientationAxis?.AXIAL ?? "axial",
      sagittal: csCore.Enums?.OrientationAxis?.SAGITTAL ?? "sagittal",
      coronal: csCore.Enums?.OrientationAxis?.CORONAL ?? "coronal",
      volume3d: undefined,
    };

    const paneIds: MprPaneId[] =
      opts.layoutMode === "mpr"
        ? ["axial", "sagittal", "coronal", "volume3d"]
        : ["volume3d"];

    for (const id of paneIds) {
      if (opts.shouldAbort()) throw new MprAbortError("aborted");
      const element = opts.elementFor(id);
      if (!element) throw new Error(`MPR 视口元素缺失: ${id}`);
      const viewportId = `${engineId}-${id}`;
      const orientation = orientations[id];
      engine.enableElement({
        viewportId,
        type: id === "volume3d" ? volume3dType : orthoType,
        element,
        defaultOptions: orientation
          ? { orientation, background: [0, 0, 0] }
          : { background: [0, 0, 0] },
      });
      const vp = engine.getViewport(viewportId);
      viewports[id] = vp;
      paneOrder.push(id);
      await Promise.resolve(vp.setVolumes?.([{ volumeId }]));
      try {
        vp.resetCamera?.();
      } catch {
        // ignore
      }
    }

    session = {
      disposed: false,
      engineId,
      toolGroupId,
      engine,
      toolGroup,
      csCore,
      csTools,
      toolNames,
      viewports,
      paneOrder,
      volumeId,
      preset: opts.preset,
      slabThickness: opts.slabThickness,
      mipEnabled: opts.mipEnabled,
      tool: opts.tool,
    };

    // 2) 注册工具 + 基础配置
    (Object.values(toolNames) as string[]).forEach((name) => {
      try {
        toolGroup.addTool(name);
      } catch (e) {
        console.warn(`[Cornerstone3D][MPR] toolGroup.addTool(${name}) 失败:`, e);
      }
    });
    if (toolNames.Crosshairs) {
      try {
        toolGroup.setToolConfiguration(toolNames.Crosshairs, {
          viewportIndicators: true,
          viewportIndicatorsConfig: { radius: 6, x: null, y: null },
          autoPan: { enabled: true, panSize: 8 },
        });
      } catch (e) {
        console.warn("[Cornerstone3D][MPR] crosshairs 配置失败:", e);
      }
    }

    // 3) 视口加入 ToolGroup (触发 crosshairs 联动初始化)
    for (const id of paneOrder) {
      const viewportId = `${engineId}-${id}`;
      try {
        toolGroup.addViewport(viewportId, engineId);
      } catch (e) {
        console.warn(`[Cornerstone3D][MPR] addViewport(${id}) 失败:`, e);
      }
    }

    // VR 全屏模式默认使用轨迹球旋转 (单 3D 视口无需十字准星)
    if (opts.layoutMode === "vr" && session.tool === "Crosshairs") {
      session.tool = "TrackballRotate";
    }

    applyPreset(session);
    applySlabAndMip(session);
    applyTool(session);

    try {
      engine.resize(true, false);
    } catch {
      // ignore
    }
    for (const id of paneOrder) {
      try {
        viewports[id]?.render?.();
      } catch {
        // ignore
      }
    }

    return session;
  } catch (e) {
    if (session) destroySession(session);
    else {
      try {
        engine.destroy();
      } catch {
        // ignore
      }
      try {
        csTools.ToolGroupManager?.destroyToolGroup?.(toolGroupId);
      } catch {
        // ignore
      }
    }
    throw e;
  }
}

// ------------------------------------------------------------
// React Hook
// ------------------------------------------------------------
export function useVolumeViewports(
  options: UseVolumeViewportsOptions,
): UseVolumeViewportsResult {
  const axialRef = useRef<HTMLDivElement | null>(null);
  const sagittalRef = useRef<HTMLDivElement | null>(null);
  const coronalRef = useRef<HTMLDivElement | null>(null);
  const volume3dRef = useRef<HTMLDivElement | null>(null);

  const refs = useMemo<VolumeViewportRefs>(
    () => ({
      axial: axialRef,
      sagittal: sagittalRef,
      coronal: coronalRef,
      volume3d: volume3dRef,
    }),
    [],
  );

  const sessionRef = useRef<MprSession | null>(null);
  const [status, setStatus] = useState<VolumeStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [readyTick, setReadyTick] = useState(0);
  const [paneInfo, setPaneInfo] = useState<PaneInfoMap>(emptyPaneInfo);

  const optionsRef = useRef(options);
  optionsRef.current = options;
  const imageIdsKey = options.imageIds.join("|");

  useEffect(() => {
    if (!options.enabled) {
      setStatus("idle");
      setError(null);
      setPaneInfo(emptyPaneInfo());
      return;
    }

    let cancelled = false;
    const shouldAbort = () => cancelled;
    setStatus("loading");
    setError(null);

    const elementFor = (id: MprPaneId): HTMLDivElement | null => {
      switch (id) {
        case "axial":
          return axialRef.current;
        case "sagittal":
          return sagittalRef.current;
        case "coronal":
          return coronalRef.current;
        case "volume3d":
          return volume3dRef.current;
      }
    };

    const opts = optionsRef.current;
    createSession({
      layoutMode: opts.layoutMode,
      imageIds: opts.imageIds,
      elementFor,
      preset: opts.preset,
      slabThickness: opts.slabThickness,
      mipEnabled: opts.mipEnabled,
      tool: opts.tool,
      shouldAbort,
    })
      .then((session) => {
        if (cancelled) {
          destroySession(session);
          return;
        }
        sessionRef.current = session;
        setStatus("ready");
        setReadyTick((v) => v + 1);
      })
      .catch((err: unknown) => {
        if (cancelled || err instanceof MprAbortError) return;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(
          "[Cornerstone3D][MPR] 容积/多平面重建初始化失败, 回退 2D 序列:",
          err,
        );
        setError(msg);
        setStatus("error");
      });

    return () => {
      cancelled = true;
      const session = sessionRef.current;
      sessionRef.current = null;
      if (session) destroySession(session);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.enabled, options.layoutMode, imageIdsKey]);

  // 预设变化
  useEffect(() => {
    const session = sessionRef.current;
    if (!session || status !== "ready") return;
    session.preset = options.preset;
    applyPreset(session);
  }, [status, readyTick, options.preset]);

  // MIP / slabThickness 变化
  useEffect(() => {
    const session = sessionRef.current;
    if (!session || status !== "ready") return;
    session.mipEnabled = options.mipEnabled;
    session.slabThickness = options.slabThickness;
    applySlabAndMip(session);
  }, [status, readyTick, options.mipEnabled, options.slabThickness]);

  // 工具变化
  useEffect(() => {
    const session = sessionRef.current;
    if (!session || status !== "ready") return;
    session.tool = options.tool;
    applyTool(session);
  }, [status, readyTick, options.tool]);

  // 角标状态轮询
  useEffect(() => {
    if (status !== "ready") return;
    const timer = window.setInterval(() => {
      const session = sessionRef.current;
      if (!session) return;
      const next = collectPaneInfo(session);
      setPaneInfo((prev) => (isSamePaneInfo(prev, next) ? prev : next));
    }, 500);
    return () => window.clearInterval(timer);
  }, [status, readyTick]);

  const resetView = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    session.paneOrder.forEach((id) => {
      try {
        session.viewports[id]?.resetCamera?.();
        session.viewports[id]?.render?.();
      } catch {
        // ignore
      }
    });
    session.preset = optionsRef.current.preset;
    session.mipEnabled = optionsRef.current.mipEnabled;
    session.slabThickness = optionsRef.current.slabThickness;
    applyPreset(session);
    applySlabAndMip(session);
  }, []);

  return { refs, status, error, paneInfo, resetView };
}
