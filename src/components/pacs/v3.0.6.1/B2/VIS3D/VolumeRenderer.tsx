/**
 * G005 放射RIS系统 v3.0.6.1 - Siemens syngo.via 3D 容积渲染 (VRT)
 * 对标:Siemens syngo.via Volume Rendering
 * @deprecated v3.0.6.11-50: 请使用 src/components/v3/dicom/VolumeRenderer.tsx
 * （该实现为功能最全版本，支持 MIP/MPR/VR 三模式与真实 DICOM 数据）
 * 保留仅因 B2/index.ts 与 VRTools.tsx 仍引用其 VRPreset 类型。
 */
import React, { useState } from "react";
import {
  Card,
  Row,
  Col,
  Space,
  Tag,
  Button,
  Slider,
  Select,
  Statistic,
} from "antd";
import { Box, RotateCw } from "lucide-react";
import { VRTools } from "./VRTools";
import { ThreeDControls } from "./ThreeDControls";
import { MIPPanel } from "./MIPPanel";
import { MPRView } from "./MPRView";

export type VRPreset = "BONE" | "SOFT_TISSUE" | "VESSEL" | "AIRWAY" | "CUSTOM";

export interface VolumeRendererProps {
  studyId?: string;
  onPresetChange?: (p: VRPreset) => void;
}

export const VolumeRenderer: React.FC<VolumeRendererProps> = ({
  studyId = "S20240618001",
  onPresetChange,
}) => {
  const [preset, setPreset] = useState<VRPreset>("BONE");
  const [opacity, setOpacity] = useState(80);
  const [threshold, setThreshold] = useState(150);
  const [rotation, setRotation] = useState(0);

  return (
    <div data-testid="volume-renderer">
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={5}>
          <Card size="small">
            <Statistic
              title="Study"
              value={studyId}
              valueStyle={{ fontSize: 12 }}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic title="预设" value={preset} prefix={<Box size={14} />} />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic title="不透明度" value={opacity} suffix="%" />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic title="阈值" value={threshold} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="旋转"
              value={`${rotation}°`}
              prefix={<RotateCw size={14} />}
            />
          </Card>
        </Col>
      </Row>
      <Row gutter={12}>
        <Col span={6}>
          <Card size="small" title="VR 预设">
            <VRTools
              preset={preset}
              onChange={(p) => {
                setPreset(p);
                onPresetChange?.(p);
              }}
            />
            <Space
              direction="vertical"
              size={8}
              style={{ marginTop: 12, width: "100%" }}
            >
              <div>
                <span style={{ fontSize: 12 }}>不透明度:{opacity}%</span>
                <Slider
                  min={0}
                  max={100}
                  value={opacity}
                  onChange={setOpacity}
                />
              </div>
              <div>
                <span style={{ fontSize: 12 }}>阈值:{threshold}</span>
                <Slider
                  min={0}
                  max={500}
                  value={threshold}
                  onChange={setThreshold}
                />
              </div>
              <div>
                <span style={{ fontSize: 12 }}>旋转:{rotation}°</span>
                <Slider
                  min={0}
                  max={360}
                  value={rotation}
                  onChange={setRotation}
                />
              </div>
              <Select
                size="small"
                defaultValue="axial"
                style={{ width: "100%" }}
                options={[
                  { value: "axial", label: "轴位" },
                  { value: "sagittal", label: "矢状位" },
                  { value: "coronal", label: "冠状位" },
                  { value: "oblique", label: "斜位" },
                ]}
              />
            </Space>
          </Card>
        </Col>
        <Col span={12}>
          <Card
            size="small"
            title="容积渲染视图"
            extra={
              <Space>
                <Tag color="blue">{preset}</Tag>
                <Tag>{opacity}%</Tag>
              </Space>
            }
          >
            <div
              data-testid="vr-canvas"
              style={{
                height: 380,
                background:
                  "radial-gradient(circle at 50% 50%, #1e293b, #020617)",
                borderRadius: 4,
                position: "relative",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 240,
                  height: 240,
                  background:
                    preset === "BONE"
                      ? "#f1f5f9"
                      : preset === "SOFT_TISSUE"
                        ? "#fbbf24"
                        : preset === "VESSEL"
                          ? "#dc2626"
                          : "#3b82f6",
                  borderRadius: "50%",
                  opacity: opacity / 100,
                  transform: `rotate(${rotation}deg)`,
                  boxShadow: `0 0 60px ${preset === "BONE" ? "#f1f5f9" : preset === "SOFT_TISSUE" ? "#fbbf24" : "#dc2626"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#0f172a",
                  fontWeight: 600,
                }}
              >
                VR · {preset}
              </div>
              <div
                style={{
                  position: "absolute",
                  bottom: 8,
                  left: 8,
                  color: "#94a3b8",
                  fontSize: 12,
                }}
              >
                Threshold: {threshold} HU
              </div>
            </div>
            <Space style={{ marginTop: 8 }}>
              <Button size="small">截图</Button>
              <Button size="small">导出 STL</Button>
              <Button size="small">电影</Button>
              <Button size="small" type="primary">
                保存预设
              </Button>
            </Space>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" title="三维控制">
            <ThreeDControls rotation={rotation} onRotate={setRotation} />
          </Card>
        </Col>
      </Row>
      <Row gutter={12} style={{ marginTop: 12 }}>
        <Col span={12}>
          <Card size="small" title="MIP (最大密度投影)">
            <MIPPanel />
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" title="MPR 多平面重建">
            <MPRView />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default VolumeRenderer;
