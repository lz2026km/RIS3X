/**
 * @deprecated v3.0.6.11-50: 请使用 src/components/v3/dicom/VolumeRenderer.tsx
 * （该实现为功能最全版本，支持 MIP/MPR/VR 三模式与真实 DICOM 数据）
 * 保留仅因 viewer3d/index.ts 仍对外导出 TransferFunction / DEFAULT_TF。
 */
import React, { useRef, useEffect, useState } from "react";

export interface TransferFunction {
  density: [number, number][];
  opacity: [number, number][];
  gradient: [number, number][];
}

export interface VolumeRendererProps {
  imageIds: string[];
  transferFunction?: TransferFunction;
  rotation?: number;
  slabThickness?: number;
  height?: number;
  onRenderComplete?: (timeMs: number) => void;
}

export const DEFAULT_TF: TransferFunction = {
  density: [
    [0, 0],
    [500, 200],
    [1000, 500],
  ],
  opacity: [
    [0, 0],
    [100, 0.1],
    [400, 0.6],
    [1000, 0.9],
  ],
  gradient: [
    [0, 0],
    [50, 0.3],
    [200, 0.8],
  ],
};

export const VolumeRenderer: React.FC<VolumeRendererProps> = ({
  imageIds,
  transferFunction = DEFAULT_TF,
  rotation = 0,
  slabThickness = 50,
  height = 500,
  onRenderComplete,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tf] = useState<TransferFunction>(transferFunction);
  const [slab, setSlab] = useState(slabThickness);
  const [rot, setRot] = useState(rotation);
  const [rendering, setRendering] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || imageIds.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = 512;
    canvas.height = 512;
    setRendering(true);
    const start = performance.now();
    const imageData = ctx.createImageData(512, 512);
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        const idx = (y * 512 + x) * 4;
        const value =
          80 + Math.sin(x / 20 + rot * 0.01) * 40 + Math.cos(y / 20) * 30;
        let alpha = 0;
        for (const [v, a] of tf.opacity) {
          if (value >= v) alpha = a;
        }
        const gray = Math.max(0, Math.min(255, value));
        imageData.data[idx] = gray;
        imageData.data[idx + 1] = gray;
        imageData.data[idx + 2] = gray;
        imageData.data[idx + 3] = Math.round(alpha * 255);
      }
    }
    ctx.putImageData(imageData, 0, 0);
    setRendering(false);
    onRenderComplete?.(performance.now() - start);
  }, [imageIds, tf, slab, rot]);

  return (
    <div style={{ background: "#0a0a0a", borderRadius: 8, padding: 8, height }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
          fontSize: 12,
          color: "#cbd5e1",
        }}
      >
        <span style={{ fontWeight: 600 }}>Volume Ray-Casting</span>
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          Slab:
          <input
            type="range"
            min="1"
            max={imageIds.length}
            value={slab}
            onChange={(e) => setSlab(parseInt(e.target.value))}
            style={{ width: 80 }}
          />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          Rotation:
          <input
            type="range"
            min="-180"
            max="180"
            value={rot}
            onChange={(e) => setRot(parseInt(e.target.value))}
            style={{ width: 80 }}
          />
        </label>
        <div style={{ flex: 1 }} />
        {rendering && <span style={{ color: "#fbbf24" }}>渲染中...</span>}
      </div>
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "calc(100% - 40px)",
          background: "#000",
          borderRadius: 4,
          transform: `rotate(${rot}deg)`,
        }}
      />
    </div>
  );
};

export default VolumeRenderer;
