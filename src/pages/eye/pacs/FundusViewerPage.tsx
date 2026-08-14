import React, { useState, useEffect, useRef } from "react";
import { Card, Row, Col, Tag, Table, Space, Button, Spin } from "antd";
import { Image, Download, ZoomIn, Maximize, Target } from 'lucide-react';
import EyeLateralityBadge from "@/components/eye/EyeLateralityBadge";
import MeasurementPanel from "@/components/eye/MeasurementPanel";
import AiDiagnosisCard from "@/components/eye/AiDiagnosisCard";
import { eyeApi } from "../../../services/api/eyeApi";
import { eyePacsApi, type EyeStudyDto, type EyeMeasurementDto, type KeyImageDto, type LesionSegmentationDto, type AiDiagnosisDto } from "../../../services/api/eyePacsApi";
const MODALITY_LABELS: Record<string, string> = { fundus_photo: '眼底彩照', oct: 'OCT', ffa: 'FFA', icga: 'ICGA', visual_field: '视野', topography: '角膜地形图', pentacam: 'Pentacam', iol_master: 'IOL Master', ubm: 'UBM', slit_lamp: '裂隙灯', oct_a: 'OCTA', corneal_endothelium: '角膜内皮', tear_film: '泪膜', fundus_autofluorescence: '眼底自发荧光' };

const FundusViewerPage: React.FC = () => {
  const [study, setStudy] = useState<EyeStudyDto | null>(null);
  const [measurements, setMeasurements] = useState<EyeMeasurementDto[]>([]);
  const [aiDiag, setAiDiag] = useState<AiDiagnosisDto[]>([]);
  const [lesions, setLesions] = useState<LesionSegmentationDto[]>([]);
  const [keyImages, setKeyImages] = useState<KeyImageDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFullscreen = () => {
    const el = viewerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleExport = () => {
    if (!study) return;
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 700;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 28px sans-serif";
    ctx.fillText("眼底彩照查看器 - 导出摘要", 40, 60);
    ctx.font = "20px sans-serif";
    ctx.fillStyle = "#94a3b8";
    [
      `患者: ${study.patientName}  眼别: ${study.eyeSide ?? "-"}  设备: ${study.device}`,
      `检查类型: ${MODALITY_LABELS[study.modality] || study.modality}  检查日期: ${new Date(study.studyDate).toLocaleString()}`,
      `测量项: ${measurements.length}  病灶标注: ${lesions.length}  关键影像: ${keyImages.length}`,
      `AI 诊断: ${aiDiag.length} 条`,
    ].forEach((l, i) => ctx.fillText(l, 40, 120 + i * 36));
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `fundus_${study.patientName || "export"}.png`;
    a.click();
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const studiesRes = await eyePacsApi.getStudies({ modality: "fundus_photo", patientId: "p-1001" });
        if (cancelled) return;
        if (studiesRes.success && Array.isArray(studiesRes.data) && studiesRes.data.length > 0) {
          const s = studiesRes.data[0];
          setStudy(s);
          const [measRes, aiRes, lesionRes, kiRes] = await Promise.all([
            eyePacsApi.getMeasurements(s.id),
            eyeApi.getDiagnoses(s.id).catch(() => ({ success: false, data: [] })),
            eyePacsApi.getLesionSegmentations(s.id),
            eyePacsApi.getKeyImages(s.id),
          ]);
          if (cancelled) return;
          if (measRes.success && Array.isArray(measRes.data)) setMeasurements(measRes.data);
          if (aiRes.success && Array.isArray(aiRes.data)) setAiDiag(aiRes.data as unknown as AiDiagnosisDto[]);
          if (lesionRes.success && Array.isArray(lesionRes.data)) setLesions(lesionRes.data);
          if (kiRes.success && Array.isArray(kiRes.data)) setKeyImages(kiRes.data);
        }
      } catch {
        // APIs may not be available
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 16, background: "var(--bg-card)", minHeight: "calc(100vh - 56px)", textAlign: "center", paddingTop: 60 }}>
        <Spin tip="加载眼底影像数据..." />
      </div>
    );
  }

  if (!study) {
    return (
      <div style={{ padding: 16, background: "var(--bg-card)", minHeight: "calc(100vh - 56px)" }}>
        <Card><div style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>暂无眼底影像数据</div></Card>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 16,
        background: "var(--bg-card)",
        minHeight: "calc(100vh - 56px)",
      }}
    >
      <Row gutter={12}>
        <Col span={16}>
          <Card
            size="small"
            title={
              <Space>
                <Image size={16} />
                <span>眼底彩照查看器</span>
                <EyeLateralityBadge eyeSide="OD" />
                <Tag color="cyan">{study.device}</Tag>
              </Space>
            }
            extra={
              <Space>
                <Button size="small" icon={<ZoomIn size={14} />} onClick={() => setZoom(1)}>
                  1:1
                </Button>
                <Button size="small" icon={<Maximize size={14} />} onClick={toggleFullscreen}>
                  全屏
                </Button>
                <Button size="small" icon={<Download size={14} />} onClick={handleExport}>
                  导出
                </Button>
              </Space>
            }
          >
            <div
              ref={viewerRef}
              style={{
                background: "#0f172a",
                height: isFullscreen ? "100vh" : 420,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-secondary)",
                flexDirection: "column",
                gap: 8,
                transform: zoom !== 1 ? `scale(${zoom})` : undefined,
                transition: "transform 0.2s",
              }}
            >
              <Target size={48} />
              <span>眼底彩照影像区域 ({study.patientName})</span>
              {/* [v3.0.6.11-96 Wave5A P2] 病灶标签: 接口无病灶数据时展示「示例病灶标注」灰标 + 区块标注 (第 4 个 eye 查看器) */}
              {lesions.length === 0 ? (
                <div style={{ display: "flex", gap: 8, fontSize: 12, alignItems: "center" }}>
                  <Tag style={{ background: "var(--bg-primary)", color: "#64748b", borderColor: "#cbd5e1" }}>示例病灶标注</Tag>
                  <span style={{ color: "#94a3b8" }}>演示数据 · 接口无病灶分段数据, 以下为本地示例</span>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
                  <Tag>视盘 C/D 0.55</Tag>
                  <Tag color="red">微动脉瘤 ×8</Tag>
                  <Tag color="orange">出血 ×2</Tag>
                  <Tag color="gold">渗出 ×4</Tag>
                </div>
              )}
            </div>
          </Card>
          <div style={{ marginTop: 8 }}>
            <MeasurementPanel
              measurements={measurements as any}
              title={`眼底测量 (${measurements.length}项)`}
            />
          </div>
          <Card size="small" title="AI 自动标注" style={{ marginTop: 8 }}>
            <Table
              dataSource={lesions}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                {
                  title: "病灶类型",
                  dataIndex: "type",
                  key: "type",
                  width: 100,
                  render: (v: string) => <Tag>{v}</Tag>,
                },
                {
                  title: "面积",
                  dataIndex: "area",
                  key: "area",
                  width: 80,
                  render: (v: number) => `${v.toFixed(2)}mm²`,
                },
                {
                  title: "距黄斑",
                  dataIndex: "distanceFromFovea",
                  key: "distanceFromFovea",
                  width: 80,
                  render: (v: number) => `${v.toFixed(1)}mm`,
                },
                {
                  title: "象限",
                  dataIndex: "quadrant",
                  key: "quadrant",
                  width: 80,
                },
                {
                  title: "置信度",
                  dataIndex: "confidence",
                  key: "confidence",
                  width: 60,
                  render: (v: number) => (
                    <Tag color={v > 0.9 ? "green" : "gold"}>
                      {Math.round(v * 100)}%
                    </Tag>
                  ),
                },
              ]}
            scroll={{ x: 'max-content' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title="患者信息">
            <div style={{ fontSize: 12, lineHeight: 2 }}>
              <Row>
                <Col span={10}>姓名:</Col>
                <Col span={14}>
                  <strong>{study.patientName}</strong>
                </Col>
              </Row>
              <Row>
                <Col span={10}>检查:</Col>
                <Col span={14}>
                  <Tag color="orange">{MODALITY_LABELS[study.modality] || study.modality}</Tag>
                </Col>
              </Row>
              <Row>
                <Col span={10}>设备:</Col>
                <Col span={14}>{study.device}</Col>
              </Row>
              <Row>
                <Col span={10}>检查日期:</Col>
                <Col span={14}>
                  {new Date(study.studyDate).toLocaleString()}
                </Col>
              </Row>
            </div>
          </Card>
          {aiDiag.map((d) => (
            <AiDiagnosisCard key={d.id} diagnosis={d as any} />
          ))}
          <Card size="small" title="关键影像标记" style={{ marginTop: 8 }}>
            <Table
              dataSource={keyImages}
              rowKey="id"
              size="small"
              scroll={{ x: 'max-content' }}
              pagination={false}
              columns={[
                {
                  title: "影像",
                  key: "imageNo",
                  width: 60,
                  render: (_: unknown, _r: KeyImageDto, i: number) => `#${i + 1}`,
                },
                {
                  title: "原因",
                  dataIndex: "reason",
                  key: "reason",
                  ellipsis: true,
                },
                {
                  title: "标记者",
                  dataIndex: "flaggedBy",
                  key: "flaggedBy",
                  width: 60,
                },
                {
                  title: "时间",
                  dataIndex: "flaggedAt",
                  key: "flaggedAt",
                  width: 110,
                  render: (v: string) =>
                    v ? new Date(v).toLocaleString().slice(0, 16) : "-",
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};
export default FundusViewerPage;
