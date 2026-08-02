import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Spin, Tag } from 'antd';
import { initCornerstone3D } from '@/hooks/useCornerstone';

export type CBCTViewMode = 'volume' | 'axial' | 'sagittal' | 'coronal' | 'stack';

export interface CBCTViewerProps {
  imageIds?: string[];
  dicomPath?: string;
  frameCount?: number;
  view?: CBCTViewMode;
  ww?: number;
  wc?: number;
  slice?: number;
  preset?: string;
  height?: number | string;
  overlay?: React.ReactNode;
  onViewportReady?: (viewport: any) => void;
}

export function createDentalImageIds(source?: string, frameCount = 1): string[] {
  if (!source || source.startsWith('data:image')) return [];
  const imageId = source.startsWith('wadouri:') || source.startsWith('wadors:') ? source : `wadouri:${source}`;
  const count = Math.max(1, Math.floor(frameCount || 1));
  if (count === 1) return [imageId];
  const separator = imageId.includes('?') ? '&' : '?';
  return Array.from({ length: count }, (_, index) => `${imageId}${separator}frame=${index + 1}`);
}

function getViewportType(csCore: any, view: CBCTViewMode) {
  const viewportType = csCore.Enums?.ViewportType ?? {};
  if (view === 'stack') return viewportType.STACK ?? 'stack';
  if (view === 'volume') return viewportType.VOLUME_3D ?? viewportType.VOLUME ?? 'volume3d';
  return viewportType.ORTHOGRAPHIC ?? 'orthographic';
}

function getOrientation(csCore: any, view: CBCTViewMode) {
  const axis = csCore.Enums?.OrientationAxis ?? {};
  if (view === 'sagittal') return axis.SAGITTAL ?? 'sagittal';
  if (view === 'coronal') return axis.CORONAL ?? 'coronal';
  return axis.AXIAL ?? 'axial';
}

function applyWindow(viewport: any, ww: number, wc: number, volumeId?: string) {
  const voiRange = { lower: wc - ww / 2, upper: wc + ww / 2 };
  try {
    viewport?.setProperties?.({ voiRange }, volumeId);
  } catch {
    viewport?.setProperties?.({ voiRange });
  }
  viewport?.render?.();
}

function applyPreset(viewport: any, csCore: any, preset?: string) {
  const blendModes = csCore.Enums?.BlendModes ?? {};
  if (preset === 'mip') viewport?.setBlendMode?.(blendModes.MAXIMUM_INTENSITY_BLEND ?? 'MAXIMUM_INTENSITY_BLEND');
  if (preset === 'minip') viewport?.setBlendMode?.(blendModes.MINIMUM_INTENSITY_BLEND ?? 'MINIMUM_INTENSITY_BLEND');
}

export const CBCTViewer: React.FC<CBCTViewerProps> = ({
  imageIds,
  dicomPath,
  frameCount = 1,
  view = 'volume',
  ww = 1500,
  wc = 500,
  slice = 0,
  preset = 'bone',
  height = 300,
  overlay,
  onViewportReady,
}) => {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<any>(null);
  const volumeIdRef = useRef<string>();
  const idsRef = useRef({
    engineId: `dental-cbct-engine-${Math.random().toString(36).slice(2)}`,
    viewportId: `dental-cbct-viewport-${Math.random().toString(36).slice(2)}`,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedImageIds = useMemo(() => {
    if (imageIds && imageIds.length > 0) return imageIds;
    return createDentalImageIds(dicomPath, frameCount);
  }, [dicomPath, frameCount, imageIds]);

  const imageIdsKey = resolvedImageIds.join('|');

  useEffect(() => {
    let cancelled = false;
    let renderingEngine: any;

    const run = async () => {
      setError(null);
      if (!elementRef.current || resolvedImageIds.length === 0) return;
      setLoading(true);
      const ok = await initCornerstone3D();
      if (!ok) {
        if (!cancelled) {
          setError('Cornerstone3D 初始化失败');
          setLoading(false);
        }
        return;
      }

      try {
        const csCore = await import('@cornerstonejs/core');
        const RenderingEngine = (csCore as any).RenderingEngine;
        const volumeLoader = (csCore as any).volumeLoader;
        const setVolumesForViewports = (csCore as any).setVolumesForViewports;
        const element = elementRef.current;
        if (!RenderingEngine || !element) throw new Error('Cornerstone3D RenderingEngine 不可用');

        renderingEngine = new RenderingEngine(idsRef.current.engineId);
        renderingEngine.enableElement({
          viewportId: idsRef.current.viewportId,
          type: getViewportType(csCore, view),
          element,
          defaultOptions: {
            background: [0, 0, 0],
            orientation: getOrientation(csCore, view),
          },
        });

        const viewport = renderingEngine.getViewport(idsRef.current.viewportId);
        viewportRef.current = viewport;

        if (view === 'stack') {
          const index = Math.max(0, Math.min(resolvedImageIds.length - 1, Math.floor(slice)));
          await viewport.setStack(resolvedImageIds, index);
          applyWindow(viewport, ww, wc);
        } else {
          if (!volumeLoader?.createAndCacheVolume || !setVolumesForViewports) throw new Error('Cornerstone3D VolumeLoader 不可用');
          const volumeId = `cornerstoneStreamingImageVolume:${idsRef.current.viewportId}-${Math.abs(hashString(imageIdsKey))}`;
          volumeIdRef.current = volumeId;
          const volume = await volumeLoader.createAndCacheVolume(volumeId, { imageIds: resolvedImageIds });
          await volume.load();
          await setVolumesForViewports(renderingEngine, [{ volumeId }], [idsRef.current.viewportId]);
          applyPreset(viewport, csCore, preset);
          applyWindow(viewport, ww, wc, volumeId);
        }

        renderingEngine.renderViewports?.([idsRef.current.viewportId]);
        onViewportReady?.(viewport);
        if (!cancelled) setLoading(false);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'DICOM 渲染失败');
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
      viewportRef.current = null;
      try {
        renderingEngine?.destroy?.();
      } catch (e) { console.warn('[F03] Error:', (e as Error)?.message); }
    };
  }, [imageIdsKey, onViewportReady, preset, resolvedImageIds, slice, view, wc, ww]);

  useEffect(() => {
    applyWindow(viewportRef.current, ww, wc, volumeIdRef.current);
  }, [ww, wc]);

  return (
    <div style={{ position: 'relative', height, background: '#000', borderRadius: 8, overflow: 'hidden' }}>
      <div ref={elementRef} style={{ width: '100%', height: '100%' }} />
      {resolvedImageIds.length === 0 && (
        <Alert type="warning" title="未找到 DICOM 图像" description="请从 PACS 返回 wadouri/wadors DICOM 路径" style={{ position: 'absolute', left: 12, right: 12, top: 12 }} />
      )}
      {loading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' }}>
          <Spin />
        </div>
      )}
      {error && <Alert type="error" title={error} style={{ position: 'absolute', left: 12, right: 12, bottom: 12 }} />}
      <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 4, pointerEvents: 'none' }}>
        <Tag color="cyan">Cornerstone3D</Tag>
        <Tag color="blue">{view === 'volume' ? 'Volume Rendering' : view.toUpperCase()}</Tag>
        <Tag>W {ww} / C {wc}</Tag>
      </div>
      {overlay}
    </div>
  );
};

export const DentalDicomViewport: React.FC<Omit<CBCTViewerProps, 'view'> & { imageId?: string }> = ({ imageId, imageIds, ...props }) => {
  const singleImageIds = imageIds ?? (imageId ? [imageId] : undefined);
  return <CBCTViewer {...props} imageIds={singleImageIds} view="stack" />;
};

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}

export default CBCTViewer;
