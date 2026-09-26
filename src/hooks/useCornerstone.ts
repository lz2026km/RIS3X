// ============================================================
// G005 放射RIS系统 v3.0.6.8-34 - Cornerstone3D Real Rendering
// PR 1: 真实 DICOM 渲染 (8 模态 viewport + 标注工具 + DICOM-SR)
// [W1] 接入真实 DICOM 样本: wadouri imageIds + ToolGroup + 真实标注读回
// 对标: ZEISS FORUM DICOM Viewer
// ============================================================

import { useEffect, useRef, useState, useCallback } from "react";
import { uniqueId } from "../utils/uniqueId";

let dicomUidSeq = 0;
/** 生成仅含数字与点的唯一 DICOM UID 后缀 (Date.now + 自增 + 随机数字), 满足 ^[0-9.]{1,64}$ */
function dicomUidSuffix(): string {
  dicomUidSeq = (dicomUidSeq + 1) % 1_000_000;
  const rand = Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0");
  return `${Date.now()}${dicomUidSeq.toString().padStart(6, "0")}${rand}`;
}

// ------------------------------------------------------------
// Cornerstone3D 模块类型 shim (动态 import, 运行期以 any 访问)
// ------------------------------------------------------------
interface RenderingEngineLike {
  id?: string;
  enableElement(opts: {
    viewportId: string;
    type?: string;
    element: HTMLElement;
    defaultOptions?: { background: number[] };
  }): void;
  getViewport(id: string): ViewportLike;
  getViewports?(): ViewportLike[];
  disableElement(id: string): void;
  resize?(immediate?: boolean, keepCamera?: boolean): void;
  render?(): void;
  destroy(): void;
}

interface ViewportLike {
  destroy?: () => void;
  render?: () => void;
  resize?: () => void;
  setStack?: (ids: string[], currentImageIdIndex?: number) => void;
  getImageIds?: () => string[];
  setImageIds?: (ids: string[]) => void;
  setImageIdIndex?: (index: number) => void;
  getCurrentImageIdIndex?: () => number;
  getCurrentImageId?: () => string;
  setWindowLevel?: (windowCenter: number, windowWidth: number) => void;
  setPreset?: (preset: string) => void;
  resetCamera?: () => void;
  setActiveTool?: (tool: string) => void;
  addAnnotation?: (data: unknown) => unknown;
  getAnnotations?: () => unknown[];
  setProperties?: (props: Record<string, unknown>) => void;
  getProperties?: () => unknown;
  canvasToWorld?: (canvasPos: number[]) => number[];
  worldToIndex?: (worldPos: number[]) => number[];
  getImageData?: () => unknown;
  getScalarData?: () => unknown;
}

interface CoreModule {
  init?: () => unknown;
  cache?: { setMaxCacheSize?: (size: number) => void };
  RenderingEngine?: new (id: string) => RenderingEngineLike;
  getRenderingEngine?: (id: string) => RenderingEngineLike | undefined;
  Enums?: {
    ViewportType?: Record<string, string>;
    Events?: Record<string, string>;
  };
  metaData?: { get: (type: string, imageId: string) => unknown };
  eventTarget?: EventTarget;
}

interface ToolGroupLike {
  addTool(name: string, config?: unknown): void;
  addViewport(viewportId: string, renderingEngineId?: string): void;
  removeViewports?(renderingEngineId: string, viewportId?: string): void;
  setToolActive(
    name: string,
    options?: { bindings?: Array<{ mouseButton?: number }> },
  ): void;
  setToolPassive(name: string): void;
  getActivePrimaryToolName?(): string | undefined;
}

interface AnnotationStateLike {
  getAnnotations: (toolName: string, element?: HTMLElement) => unknown[];
  addAnnotation?: (annotation: unknown, element?: HTMLElement) => void;
  removeAllAnnotations?: () => void;
}

interface ToolsModule {
  init?: () => void;
  addTool?: (tool: unknown) => void;
  ToolGroupManager?: {
    createToolGroup?: (id: string) => ToolGroupLike | undefined;
    getToolGroup?: (id: string) => ToolGroupLike | undefined;
    destroyToolGroup?: (id: string) => void;
  };
  annotation?: { state?: AnnotationStateLike };
  Enums?: {
    MouseBindings?: Record<string, number>;
    Events?: Record<string, string>;
  };
  [key: string]: unknown;
}

interface DicomLoaderModule {
  init?: (options?: { maxWebWorkers?: number }) => void;
  default?: DicomLoaderModule;
}

interface ToolClassLike {
  toolName?: string;
  name?: string;
}

// ------------------------------------------------------------
// 全局单例状态
// ------------------------------------------------------------
export const RENDERING_ENGINE_ID = "g005-rendering-engine";
export const TOOL_GROUP_ID = "g005-tool-group";
const VIEWPORT_PREFIX = "g005-viewport";

/** Cornerstone3D 初始化状态 */
let cornerstoneInitPromise: Promise<boolean> | null = null;
/** 已注册的逻辑工具 -> 实际 toolName 映射 */
let registeredTools: Record<string, string> = {};
let toolGroupRef: ToolGroupLike | null = null;
let csToolsApi: ToolsModule | null = null;
let activePrimaryLogical: string | null = null;

/** 逻辑工具名 (工具栏/测量面板使用) */
export type LogicalTool =
  | "WindowLevel"
  | "Pan"
  | "Zoom"
  | "StackScroll"
  | "Length"
  | "Angle"
  | "Rectangle"
  | "Ellipse"
  | "Probe"
  | "Arrow"
  | "FreehandRoi"
  | "TextMarker";

type MeasurementLogical =
  | "Length"
  | "Angle"
  | "Rectangle"
  | "Ellipse"
  | "Probe"
  | "Arrow"
  | "FreehandRoi"
  | "TextMarker";

// 逻辑工具 -> 候选 Cornerstone 类名 (不同版本命名差异的兼容回退)
const TOOL_CLASS_CANDIDATES: Record<LogicalTool, string[]> = {
  WindowLevel: ["WindowLevelTool"],
  Pan: ["PanTool"],
  Zoom: ["ZoomTool"],
  StackScroll: ["StackScrollMouseWheelTool", "StackScrollTool"],
  Length: ["LengthTool"],
  Angle: ["AngleTool"],
  Rectangle: ["RectangleROITool"],
  Ellipse: ["EllipticalROITool"],
  Probe: ["ProbeTool"],
  Arrow: ["ArrowAnnotateTool"],
  FreehandRoi: ["FreehandROITool", "PlanarFreehandROITool"],
  TextMarker: ["TextMarkerTool", "LabelTool"],
};

function resolveToolClass(
  csTools: ToolsModule,
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

function registerCornerstoneTools(csTools: ToolsModule): void {
  const map: Record<string, string> = {};
  (Object.keys(TOOL_CLASS_CANDIDATES) as LogicalTool[]).forEach((logical) => {
    const cls = resolveToolClass(csTools, TOOL_CLASS_CANDIDATES[logical]);
    const toolName = cls?.toolName;
    if (!cls || !toolName) return;
    try {
      csTools.addTool?.(cls);
      map[logical] = toolName;
    } catch (e) {
      console.warn(`[Cornerstone3D] addTool(${toolName}) failed:`, e);
    }
  });
  registeredTools = map;
}

function mouseBindings(csTools: ToolsModule): {
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

/** 创建/复用可复用的 ToolGroup 并绑定默认工具 (WL/Pan/滚轮翻页) */
function ensureToolGroup(csTools: ToolsModule): ToolGroupLike | null {
  if (toolGroupRef) return toolGroupRef;
  const mgr = csTools.ToolGroupManager;
  if (!mgr?.createToolGroup) return null;
  const existing = mgr.getToolGroup?.(TOOL_GROUP_ID);
  const tg = existing ?? mgr.createToolGroup(TOOL_GROUP_ID);
  if (!tg) return null;
  toolGroupRef = tg;

  const { primary, auxiliary, wheel } = mouseBindings(csTools);
  Object.values(registeredTools).forEach((name) => {
    try {
      tg.addTool(name);
    } catch (e) {
      console.warn(`[Cornerstone3D] toolGroup.addTool(${name}) failed:`, e);
    }
  });

  if (registeredTools["WindowLevel"]) {
    tg.setToolActive(registeredTools["WindowLevel"], {
      bindings: [{ mouseButton: primary }],
    });
  }
  if (registeredTools["Pan"]) {
    // 鼠标中键平移 (与主键工具互不冲突)
    tg.setToolActive(registeredTools["Pan"], {
      bindings: [{ mouseButton: auxiliary }],
    });
  }
  if (registeredTools["StackScroll"]) {
    tg.setToolActive(registeredTools["StackScroll"], {
      bindings: [{ mouseButton: wheel }],
    });
  }
  return tg;
}

function setPrimary(logical: string, bindings: number[]): void {
  const tg = toolGroupRef;
  const target = registeredTools[logical];
  if (!tg || !target) return;
  tg.setToolActive(target, { bindings: bindings.map((mouseButton) => ({ mouseButton })) });
  activePrimaryLogical = logical;
}

/**
 * 切换当前主键工具 (WindowLevel/Pan/Zoom/测量工具)。
 * 返回是否成功 (工具未注册时返回 false)。
 */
export function activateTool(tool: LogicalTool): boolean {
  const csTools = csToolsApi;
  const tg = toolGroupRef;
  if (!csTools || !tg) return false;
  const { primary, auxiliary } = mouseBindings(csTools);

  if (tool === "StackScroll") {
    // 滚轮翻页始终可用, 不占用主键
    if (registeredTools["StackScroll"]) {
      const { wheel } = mouseBindings(csTools);
      tg.setToolActive(registeredTools["StackScroll"], {
        bindings: [{ mouseButton: wheel }],
      });
    }
    return true;
  }

  const target = registeredTools[tool];
  if (!target) return false;

  // 关闭上一个主键工具
  if (activePrimaryLogical && activePrimaryLogical !== tool) {
    const prev = registeredTools[activePrimaryLogical];
    if (prev) {
      try {
        tg.setToolPassive(prev);
      } catch {
        // ignore
      }
    }
  }

  // WindowLevel 与主键测量/平移/缩放互斥
  if (tool !== "WindowLevel" && registeredTools["WindowLevel"]) {
    try {
      tg.setToolPassive(registeredTools["WindowLevel"]);
    } catch {
      // ignore
    }
  }

  if (tool === "Pan") {
    // 平移同时保留中键
    setPrimary("Pan", [primary, auxiliary]);
  } else {
    setPrimary(tool, [primary]);
  }
  return true;
}

/** 切换当前激活的测量工具 */
export function setActiveMeasurementTool(tool: MeasurementLogical): boolean {
  return activateTool(tool);
}

/** 恢复窗宽窗位 (主键左键) */
export function activateWindowLevel(): boolean {
  return activateTool("WindowLevel");
}

/** 读取某个工具在当前元素上的真实标注 (Cornerstone annotation state) */
export function getAnnotationsForElement(
  toolName: string,
  element: HTMLElement,
): unknown[] {
  const state = csToolsApi?.annotation?.state;
  if (!state?.getAnnotations) return [];
  try {
    return state.getAnnotations(toolName, element) || [];
  } catch {
    return [];
  }
}

/** 清除当前元素上的全部标注 */
export function clearAllAnnotations(): void {
  try {
    csToolsApi?.annotation?.state?.removeAllAnnotations?.();
  } catch {
    // ignore
  }
}

/** 已注册工具的逻辑名 -> 实际 toolName (调试/HUD) */
export function getRegisteredToolNames(): Record<string, string> {
  return { ...registeredTools };
}

export async function initCornerstone3D(): Promise<boolean> {
  if (cornerstoneInitPromise) return cornerstoneInitPromise;
  cornerstoneInitPromise = (async () => {
    try {
      const csCore = (await import("@cornerstonejs/core")) as unknown as CoreModule;
      const csTools = (await import("@cornerstonejs/tools")) as unknown as ToolsModule;

      // 1) core init (WebGL/CPU 渲染管线探测)
      try {
        csCore.init?.();
      } catch (e) {
        console.warn("[Cornerstone3D] core.init failed:", e);
      }

      // 2) DICOM image loader: 注册 wadouri/wadors scheme + metadata provider
      try {
        const loaderMod = (await import(
          "@cornerstonejs/dicom-image-loader"
        )) as unknown as DicomLoaderModule;
        const dl = loaderMod.default ?? loaderMod;
        const hc =
          typeof navigator !== "undefined" ? navigator.hardwareConcurrency : 0;
        dl.init?.({ maxWebWorkers: Math.min(4, Math.max(1, hc || 2)) });
      } catch (e) {
        console.warn(
          "[Cornerstone3D] DICOM image loader 不可用, viewport 回退占位帧:",
          e,
        );
      }

      // 3) 缓存
      csCore.cache?.setMaxCacheSize?.(2 * 1024 * 1024 * 1024);

      // 4) tools init
      try {
        csTools.init?.();
      } catch (e) {
        console.warn("[Cornerstone3D] tools.init failed:", e);
      }

      // 5) 注册工具 + 复用 ToolGroup
      csToolsApi = csTools;
      registerCornerstoneTools(csTools);
      ensureToolGroup(csTools);
      return true;
    } catch (e) {
      console.warn("[Cornerstone3D] init degraded, viewport 回退占位帧:", e);
      return false;
    }
  })();
  return cornerstoneInitPromise;
}

export function useCornerstone3D() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    initCornerstone3D().then((ok) => {
      if (mounted) {
        setReady(ok);
        if (!ok) setError("Cornerstone3D 初始化失败（可能浏览器不支持 WebGL）");
      }
    });
    return () => {
      mounted = false;
    };
  }, []);
  return { ready, error };
}

// 标注工具类型
export type AnnotationTool =
  | "Length"
  | "Angle"
  | "Rectangle"
  | "Ellipse"
  | "Arrow"
  | "FreehandRoi"
  | "TextMarker";

const ANNOTATION_TO_LOGICAL: Record<AnnotationTool, MeasurementLogical> = {
  Length: "Length",
  Angle: "Angle",
  Rectangle: "Rectangle",
  Ellipse: "Ellipse",
  Arrow: "Arrow",
  FreehandRoi: "FreehandRoi",
  TextMarker: "TextMarker",
};

// 单 viewport hook (PR 1 真实渲染)
export function useViewport(
  elementId: string,
  options: {
    imageIds: string[];
    modality?: string;
    preset?: string;
    onMount?: (viewport: ViewportLike) => void;
  },
) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<ViewportLike | null>(null);
  const renderingEngineRef = useRef<RenderingEngineLike | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<AnnotationTool>("Length");
  const [annotations, setAnnotations] = useState<unknown[]>([]);
  const imageIdsKey = options.imageIds.join("|");

  useEffect(() => {
    let mounted = true;
    const viewportId = `${VIEWPORT_PREFIX}-${elementId}`;
    let resizeObserver: ResizeObserver | null = null;
    const element = elementRef.current;
    const stackEventName = "CORNERSTONE_STACK_NEW_IMAGE";
    const annotationEventNames = [
      "CORNERSTONE_TOOLS_ANNOTATION_ADDED",
      "CORNERSTONE_TOOLS_ANNOTATION_COMPLETED",
      "CORNERSTONE_TOOLS_ANNOTATION_REMOVED",
      "CORNERSTONE_TOOLS_ANNOTATION_MODIFIED",
    ];

    const refreshAnnotations = () => {
      if (!mounted || !element) return;
      const names = Object.values(registeredTools);
      const all: unknown[] = [];
      names.forEach((name) => {
        all.push(...getAnnotationsForElement(name, element));
      });
      setAnnotations(all);
    };

    const handleStackNewImage = () => {
      const idx = viewportRef.current?.getCurrentImageIdIndex?.();
      if (typeof idx === "number") setCurrentIndex(idx);
    };

    let attachedStackEvent: string = stackEventName;
    let annTarget: EventTarget | null = null;

    const run = async () => {
      const ok = await initCornerstone3D();
      if (!ok || !mounted || !elementRef.current) {
        if (mounted) {
          setIsLoading(false);
          setError("Cornerstone3D 未就绪");
        }
        return;
      }
      try {
        const csCore = (await import("@cornerstonejs/core")) as unknown as CoreModule;
        const target = elementRef.current;

        let engine = csCore.getRenderingEngine?.(RENDERING_ENGINE_ID);
        if (!engine && csCore.RenderingEngine) {
          engine = new csCore.RenderingEngine(RENDERING_ENGINE_ID);
        }
        if (!engine) {
          throw new Error("RenderingEngine 创建失败");
        }
        renderingEngineRef.current = engine;

        engine.enableElement({
          viewportId,
          type: csCore.Enums?.ViewportType?.STACK || "stack",
          element: target,
          defaultOptions: { background: [0, 0, 0] },
        });
        const viewport = engine.getViewport(viewportId);
        viewportRef.current = viewport;

        if (options.imageIds.length > 0) {
          viewport.setStack?.(options.imageIds, 0);
          viewport.render?.();
          setCurrentIndex(viewport.getCurrentImageIdIndex?.() ?? 0);
        }

        // 绑定到复用 ToolGroup + 渲染
        try {
          toolGroupRef?.addViewport(viewportId, RENDERING_ENGINE_ID);
        } catch (e) {
          console.warn("[Cornerstone3D] toolGroup.addViewport failed:", e);
        }
        viewport.render?.();

        // 尺寸变化重绘 (grid 布局切换 / window resize)
        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(() => {
            try {
              renderingEngineRef.current?.resize?.(true, false);
            } catch {
              // ignore
            }
          });
          resizeObserver.observe(target);
        }

        // 滚轮翻页/程序切换切片 → 同步索引 (元素级事件)
        const coreEvents = csCore.Enums?.Events ?? {};
        const coreStackEvent = coreEvents["STACK_NEW_IMAGE"] ?? stackEventName;
        attachedStackEvent = coreStackEvent;
        target.addEventListener(coreStackEvent, handleStackNewImage as EventListener);

        // 标注事件 (tools 在 core.eventTarget 上派发) → 刷新真实标注
        annTarget = csCore.eventTarget ?? null;
        annotationEventNames.forEach((name) =>
          annTarget?.addEventListener(name, refreshAnnotations as EventListener),
        );

        refreshAnnotations();
        setIsLoading(false);
        options.onMount?.(viewport);
      } catch (renderErr) {
        console.warn("[Cornerstone3D] viewport init fallback:", renderErr);
        if (mounted) {
          viewportRef.current = createMockViewport(elementRef.current);
          setIsLoading(false);
          options.onMount?.(viewportRef.current);
        }
      }
    };
    run();
    return () => {
      mounted = false;
      if (resizeObserver) resizeObserver.disconnect();
      if (element) {
        element.removeEventListener(
          attachedStackEvent,
          handleStackNewImage as EventListener,
        );
      }
      if (annTarget) {
        annotationEventNames.forEach((name) =>
          annTarget?.removeEventListener(
            name,
            refreshAnnotations as EventListener,
          ),
        );
      }
      try {
        toolGroupRef?.removeViewports?.(RENDERING_ENGINE_ID, viewportId);
      } catch {
        // ignore
      }
      const vp = viewportRef.current;
      if (vp?.destroy) vp.destroy();
      try {
        renderingEngineRef.current?.disableElement(viewportId);
      } catch {
        // 元素可能已被销毁，忽略
      }
      renderingEngineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elementId, imageIdsKey]);

  const scroll = useCallback(
    (delta: number) => {
      if (options.imageIds.length === 0) return;
      const next = Math.max(
        0,
        Math.min(options.imageIds.length - 1, currentIndex + delta),
      );
      setCurrentIndex(next);
      viewportRef.current?.setImageIdIndex?.(next);
    },
    [currentIndex, options.imageIds.length],
  );

  const jumpTo = useCallback(
    (index: number) => {
      const idx = Math.max(0, Math.min(options.imageIds.length - 1, index));
      setCurrentIndex(idx);
      viewportRef.current?.setImageIdIndex?.(idx);
    },
    [options.imageIds.length],
  );

  // [W1] 真实窗宽窗位: StackViewport.setProperties({ voiRange }) (setWindowLevel 不存在)
  const setWWWC = useCallback((ww: number, wc: number) => {
    const viewport = viewportRef.current;
    if (!viewport?.setProperties) return;
    const lower = wc - ww / 2;
    const upper = wc + ww / 2;
    viewport.setProperties({ voiRange: { lower, upper } });
    viewport.render?.();
  }, []);

  const setPreset = useCallback((preset: string) => {
    viewportRef.current?.setPreset?.(preset);
  }, []);

  const reset = useCallback(() => {
    viewportRef.current?.resetCamera?.();
    viewportRef.current?.render?.();
  }, []);

  // [v3.0.6.8-34] 标注工具切换 (接入真实 ToolGroup)
  const setTool = useCallback((tool: AnnotationTool) => {
    setActiveTool(tool);
    const logical = ANNOTATION_TO_LOGICAL[tool];
    activateTool(logical);
  }, []);

  // [v3.0.6.8-34] 添加标注 (真实 annotation state 可用时写入)
  const addAnnotation = useCallback(
    (data: { type: AnnotationTool; coordinates: unknown[]; text?: string }) => {
      const element = elementRef.current;
      const state = csToolsApi?.annotation?.state;
      if (element && state?.addAnnotation) {
        try {
          const annotation = {
            annotationUID: uniqueId("ANN"),
            data,
            metadata: {},
          };
          state.addAnnotation(annotation, element);
          return annotation;
        } catch {
          // fallthrough to mock
        }
      }
      return { ...data, id: uniqueId("ANN") };
    },
    [],
  );

  // [W1] 获取真实标注 (Cornerstone annotation state)
  const getAnnotations = useCallback(() => annotations, [annotations]);

  return {
    elementRef,
    viewport: viewportRef.current,
    currentIndex,
    isLoading,
    error,
    activeTool,
    annotations,
    scroll,
    jumpTo,
    setWWWC,
    setPreset,
    reset,
    setTool,
    addAnnotation,
    getAnnotations,
  };
}

// 降级 mock viewport (WebGL 不可用时使用)
function createMockViewport(element: HTMLElement | null): ViewportLike {
  void element;
  return {
    setImageIdIndex: (_idx: number) => {
      /* mock */
    },
    getCurrentImageIdIndex: () => 0,
    resetCamera: () => {
      /* mock */
    },
    setWindowLevel: (_ww: number, _wc: number) => {
      /* mock */
    },
    setPreset: (_preset: string) => {
      /* mock */
    },
    setActiveTool: (_tool: string) => {
      /* mock */
    },
    addAnnotation: (data: unknown) => ({ ...(data as object), id: uniqueId("ANN") }),
    getAnnotations: () => [],
    destroy: () => {
      /* mock */
    },
  } as ViewportLike;
}

// 8 模态适配 (PR 1)
export const MODALITY_PRESETS: Record<
  string,
  { ww: number; wc: number; invert?: boolean }
> = {
  // 眼底彩照
  fundus: { ww: 256, wc: 128 },
  // OCT B-scan
  oct: { ww: 500, wc: 250 },
  // OCT-A 血管
  octa: { ww: 255, wc: 128 },
  // FFA 荧光血管造影
  ffa: { ww: 300, wc: 150 },
  // 视野 (Humphrey)
  visualfield: { ww: 255, wc: 128, invert: true },
  // 角膜地形图
  topography: { ww: 80, wc: 40 },
  // 裂隙灯
  slitlamp: { ww: 255, wc: 128 },
  // 眼底自发荧光
  autofluorescence: { ww: 200, wc: 100 },
};

export const MODALITY_LABELS: Record<string, string> = {
  fundus: "眼底彩照",
  oct: "OCT 断层",
  octa: "OCT-A 血管",
  ffa: "FFA 荧光造影",
  visualfield: "视野分析",
  topography: "角膜地形图",
  slitlamp: "裂隙灯",
  autofluorescence: "自发荧光",
};

// DICOM stack
export function useDicomStack(imageIds: string[]) {
  const [stack, setStack] = useState<{
    imageIds: string[];
    currentIndex: number;
    metadata: any[];
  }>({
    imageIds,
    currentIndex: 0,
    metadata: [],
  });
  useEffect(() => {
    setStack((prev) => ({ ...prev, imageIds, currentIndex: 0 }));
  }, [imageIds.join("|")]);
  const setIndex = useCallback((idx: number) => {
    setStack((prev) => ({ ...prev, currentIndex: idx }));
  }, []);
  return { stack, setIndex };
}

// [v3.0.6.11-50] F06: 优先从 Cornerstone metaData provider 读取真实 DICOM tags
async function readRealDicomMetadata(
  imageId: string,
): Promise<Record<string, unknown> | null> {
  try {
    const csCore = (await import("@cornerstonejs/core")) as unknown as CoreModule;
    const metaData = csCore.metaData;
    if (!metaData?.get) return null;
    const pixel = metaData.get("imagePixelModule", imageId) as
      | {
          rows?: number;
          columns?: number;
          bitsAllocated?: number;
          windowCenter?: number | number[];
          windowWidth?: number | number[];
        }
      | undefined;
    const plane = metaData.get("imagePlaneModule", imageId) as
      | { sliceThickness?: number; pixelSpacing?: number[] }
      | undefined;
    const series = metaData.get("generalSeriesModule", imageId) as
      | { seriesDescription?: string; modality?: string }
      | undefined;
    if (!pixel) return null;
    const pick = (v: number | number[] | undefined): number | undefined =>
      Array.isArray(v) ? v[0] : v;
    return {
      imageId,
      rows: pixel.rows,
      columns: pixel.columns,
      bitsAllocated: pixel.bitsAllocated,
      windowCenter: pick(pixel.windowCenter),
      windowWidth: pick(pixel.windowWidth),
      sliceThickness: plane?.sliceThickness,
      pixelSpacing: plane?.pixelSpacing,
      seriesDescription: series?.seriesDescription,
      modality: series?.modality,
    };
  } catch {
    return null;
  }
}

export function useDicomMetadata(imageId: string | undefined) {
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!imageId) {
      setMeta(null);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const t = setTimeout(async () => {
      const real = await readRealDicomMetadata(imageId);
      if (cancelled) return;
      if (real) {
        setMeta(real);
      } else {
        // 占位实现: 当前数据源未注册 Cornerstone metaData provider，
        // 以下为演示用固定值；接入 wadors/dicomweb 数据源后会自动读取真实 tags。
        setMeta({
          imageId,
          rows: 512,
          columns: 512,
          windowCenter: 40,
          windowWidth: 400,
          sliceThickness: 1.0,
          pixelSpacing: [0.5, 0.5],
          bitsAllocated: 16,
        });
      }
      setLoading(false);
    }, 100);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [imageId]);
  return { meta, loading };
}

// [v3.0.6.8-34] DICOM-SR TID 1500 导出 (简化版)
export function exportMeasurementsToDicomSR(measurements: any[]): {
  sopInstanceUID: string;
  contentSequence: any[];
} {
  const sopInstanceUID = `1.2.826.0.1.3680043.8.498.${dicomUidSuffix()}`;
  const contentSequence = measurements.map((m, idx) => ({
    relationshipType: "CONTAINS",
    referencedContentItemIdentifier: idx + 1,
    valueType: "NUM",
    conceptNameCodeSequence: {
      codeValue: getMeasurementTypeCode(m.type),
      codeMeaning: m.type,
      codingSchemeDesignator: "DCM",
    },
    measuredValueSequence: {
      measurementUnitsCodeSequence: {
        codeValue: getUnitCode(m.unit),
        codeMeaning: m.unit,
        codingSchemeDesignator: "UCUM",
      },
      numericValue: m.value,
    },
  }));
  return { sopInstanceUID, contentSequence };
}

function getMeasurementTypeCode(type: string): string {
  const map: Record<string, string> = {
    Length: "410668003",
    Angle: "408683006",
    Rectangle: "125201",
    Ellipse: "125202",
    Area: "42798000",
  };
  return map[type] || "410668003";
}

function getUnitCode(unit: string): string {
  const map: Record<string, string> = {
    mm: "mm",
    cm: "cm",
    deg: "deg",
    "mm²": "mm2",
    px: "px",
  };
  return map[unit] || "mm";
}

// 测量计算工具
export function calculateDistance(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  pixelSpacing: number = 0.5,
): {
  value: number;
  unit: string;
} {
  const dx = (p2.x - p1.x) * pixelSpacing;
  const dy = (p2.y - p1.y) * pixelSpacing;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return { value: parseFloat(distance.toFixed(2)), unit: "mm" };
}

export function calculateAngle(
  p1: any,
  p2: any,
  p3: any,
): { value: number; unit: string } {
  const a = Math.atan2(p1.y - p2.y, p1.x - p2.x);
  const b = Math.atan2(p3.y - p2.y, p3.x - p2.x);
  const angle = Math.abs(((b - a) * 180) / Math.PI);
  return { value: parseFloat(angle.toFixed(2)), unit: "deg" };
}

export function calculateArea(
  width: number,
  height: number,
  pixelSpacing: number = 0.5,
): { value: number; unit: string } {
  const w = width * pixelSpacing;
  const h = height * pixelSpacing;
  return { value: parseFloat((w * h).toFixed(2)), unit: "mm²" };
}
