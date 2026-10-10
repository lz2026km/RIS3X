import React, { useState, useEffect, useRef } from "react";
import {
  Card,
  Row,
  Col,
  Tag,
  Space,
  Button,
  Spin,
} from "antd";
import { Image, Download, ZoomIn, Maximize, Target } from 'lucide-react';
import EyeLateralityBadge from "@/components/eye/EyeLateralityBadge";
import MeasurementPanel from "@/components/eye/MeasurementPanel";
import AiDiagnosisCard from "@/components/eye/AiDiagnosisCard";
import { eyeApi } from "../../../services/api/eyeApi";
import { eyePacsApi, type EyeStudyDto, type EyeMeasurementDto, type KeyImageDto, type LesionSegmentationDto, type AiDiagnosisDto } from "../../../services/api/eyePacsApi";
import { ErrorBanner } from "@/components/feedback";
import { t } from "../../../i18n/appI18n";
import { DataTable } from "../../../components/common";
const modalityLabel = (m?: string) => t(`w9d.modality.${m ?? ''}`);

const FundusViewerPage: React.FC = () => {
  const [study, setStudy] = useState<EyeStudyDto | null>(null);
  const [measurements, setMeasurements] = useState<EyeMeasurementDto[]>([]);
  const [aiDiag, setAiDiag] = useState<AiDiagnosisDto[]>([]);
  const [lesions, setLesions] = useState<LesionSegmentationDto[]>([]);
  const [keyImages, setKeyImages] = useState<KeyImageDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
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
    ctx.fillText(t('fundusViewer.exportSummaryTitle'), 40, 60);
    ctx.font = "20px sans-serif";
    ctx.fillStyle = "#94a3b8";
    [
      t('fundusViewer.exportPatient', { name: study.patientName, eye: study.eyeSide ?? "-", device: study.device }),
      t('fundusViewer.exportExam', { type: modalityLabel(study.modality), date: new Date(study.studyDate).toLocaleString() }),
      t('fundusViewer.exportCounts', { measure: measurements.length, lesion: lesions.length, key: keyImages.length }),
      t('fundusViewer.exportAi', { count: aiDiag.length }),
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
      setLoadError(null);
      try {
        const studiesRes = await eyePacsApi.getStudies({ modality: "fundus_photo", patientId: "p-1001" });
        if (cancelled) return;
        if (studiesRes.success && Array.isArray(studiesRes.data) && studiesRes.data.length > 0) {
          const s = studiesRes.data[0]!;
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
        } else if (!studiesRes.success) {
          setLoadError(t('w9.states.error'));
        }
      } catch {
        setLoadError(t('w9.states.error'));
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [reloadTick]);

  if (loading) {
    return (
      <div style={{ padding: 16, background: "var(--bg-card)", minHeight: "calc(100vh - 56px)", textAlign: "center", paddingTop: 60 }}>
        <Spin tip={t('fundusViewer.loadingData')} />
      </div>
    );
  }

  if (!study) {
    return (
      <div style={{ padding: 16, background: "var(--bg-card)", minHeight: "calc(100vh - 56px)" }}>
        {loadError && <ErrorBanner message={loadError} onRetry={() => setReloadTick((n) => n + 1)} retryLabel={t('w9.states.retry')} />}
        <Card><div style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>{t('fundusViewer.noData')}</div></Card>
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
                <span>{t('fundusViewer.title')}</span>
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
                  {t('fundusViewer.fullscreen')}
                </Button>
                <Button size="small" icon={<Download size={14} />} onClick={handleExport}>
                  {t('fundusViewer.export')}
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
              <span>{t('fundusViewer.imageArea', { name: study.patientName })}</span>
              {/* [v3.0.6.11-96 Wave5A P2] 病灶标签: 接口无病灶数据时展示「示例病灶标注」灰标 + 区块标注 (第 4 个 eye 查看器) */}
              {lesions.length === 0 ? (
                <div style={{ display: "flex", gap: 8, fontSize: 12, alignItems: "center" }}>
                  <Tag style={{ background: "var(--bg-primary)", color: "#64748b", borderColor: "#cbd5e1" }}>{t('fundusViewer.sampleLesionTag')}</Tag>
                  <span style={{ color: "#94a3b8" }}>{t('fundusViewer.sampleLesionHint')}</span>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
                  <Tag>{t('fundusViewer.lesionOpticDisc')}</Tag>
                  <Tag color="red">{t('fundusViewer.lesionMicroaneurysm')}</Tag>
                  <Tag color="orange">{t('fundusViewer.lesionHemorrhage')}</Tag>
                  <Tag color="gold">{t('fundusViewer.lesionExudate')}</Tag>
                </div>
              )}
            </div>
          </Card>
          <div style={{ marginTop: 8 }}>
            <MeasurementPanel
              measurements={measurements as any}
              title={t('fundusViewer.measurementTitle', { count: measurements.length })}
            />
          </div>
          <Card size="small" title={t('fundusViewer.aiAnnotation')} style={{ marginTop: 8 }}>
            <DataTable
              dataSource={lesions}
              rowKey="id"
              pagination={false}
              columns={[
                {
                  title: t('fundusViewer.colLesionType'),
                  dataIndex: "type",
                  key: "type",
                  width: 100,
                  render: (v: string) => <Tag>{v}</Tag>,
                },
                {
                  title: t('fundusViewer.colArea'),
                  dataIndex: "area",
                  key: "area",
                  width: 80,
                  render: (v: number) => `${v.toFixed(2)}mm²`,
                },
                {
                  title: t('fundusViewer.colDistanceFromFovea'),
                  dataIndex: "distanceFromFovea",
                  key: "distanceFromFovea",
                  width: 80,
                  render: (v: number) => `${v.toFixed(1)}mm`,
                },
                {
                  title: t('fundusViewer.colQuadrant'),
                  dataIndex: "quadrant",
                  key: "quadrant",
                  width: 80,
                },
                {
                  title: t('fundusViewer.colConfidence'),
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
          <Card size="small" title={t('fundusViewer.patientInfo')}>
            <div style={{ fontSize: 12, lineHeight: 2 }}>
              <Row>
                <Col span={10}>{t('fundusViewer.name')}:</Col>
                <Col span={14}>
                  <strong>{study.patientName}</strong>
                </Col>
              </Row>
              <Row>
                <Col span={10}>{t('fundusViewer.exam')}:</Col>
                <Col span={14}>
                  <Tag color="orange">{modalityLabel(study.modality)}</Tag>
                </Col>
              </Row>
              <Row>
                <Col span={10}>{t('fundusViewer.device')}:</Col>
                <Col span={14}>{study.device}</Col>
              </Row>
              <Row>
                <Col span={10}>{t('fundusViewer.studyDate')}:</Col>
                <Col span={14}>
                  {new Date(study.studyDate).toLocaleString()}
                </Col>
              </Row>
            </div>
          </Card>
          {aiDiag.map((d) => (
            <AiDiagnosisCard key={d.id} diagnosis={d as any} />
          ))}
          <Card size="small" title={t('fundusViewer.keyImageMarkers')} style={{ marginTop: 8 }}>
            <DataTable
              dataSource={keyImages}
              rowKey="id"
              scroll={{ x: 'max-content' }}
              pagination={false}
              columns={[
                {
                  title: t('fundusViewer.colImageNo'),
                  key: "imageNo",
                  width: 60,
                  render: (_: unknown, _r: KeyImageDto, i: number) => `#${i + 1}`,
                },
                {
                  title: t('fundusViewer.colReason'),
                  dataIndex: "reason",
                  key: "reason",
                  ellipsis: true,
                },
                {
                  title: t('fundusViewer.colFlaggedBy'),
                  dataIndex: "flaggedBy",
                  key: "flaggedBy",
                  width: 60,
                },
                {
                  title: t('fundusViewer.colTime'),
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
