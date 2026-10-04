import { currentApiMode } from "@/services/api/client";
import { eyeApi, type EyeStudy } from "@/services/api/eyeApi";
import { Card, Row, Col, Tag, Space, Select, Slider, Button } from "antd";
import { Alert, Dropdown, message, Spin } from 'antd'
import { Layout as LayoutIcon, Download } from 'lucide-react';
import { Camera, Database, FileImage, FileSpreadsheet, ImageIcon, RefreshCw } from 'lucide-react'
import React, { useState } from "react";
import { useCallback, useEffect, useRef } from 'react'
import { t } from '../../../i18n/appI18n'

// 演示回退数据 (后端 /eye/studies 不可用时展示, 与 backend eye.service SEED_EYE_STUDIES 同形)
const FALLBACK_STUDIES: EyeStudy[] = [
  { id: "ES-1001", patientId: "PEYE-001", patientName: "李慧敏", modality: "OCT", eye: "OD", acquisitionDate: "2026-07-02T09:30:00.000Z", deviceModel: "Topcon Maestro2", status: "reported", indications: "糖尿病史 8 年,双眼视物模糊" },
  { id: "ES-1002", patientId: "PEYE-002", patientName: "王建国", modality: "Fundus", eye: "OU", acquisitionDate: "2026-07-01T10:15:00.000Z", deviceModel: "Canon CR-2", status: "reviewed", indications: "高血压,常规眼底体检" },
  { id: "ES-1003", patientId: "PEYE-003", patientName: "张伟", modality: "FA", eye: "OS", acquisitionDate: "2026-06-30T14:40:00.000Z", deviceModel: "Zeiss FF 450", status: "reported", indications: "左眼黄斑水肿,行荧光造影" },
  { id: "ES-1004", patientId: "PEYE-004", patientName: "刘敏", modality: "VisualField", eye: "OU", acquisitionDate: "2026-06-29T08:50:00.000Z", deviceModel: "Humphrey HFA3", status: "acquired", indications: "疑似青光眼,视野检查" },
  { id: "ES-1005", patientId: "PEYE-005", patientName: "陈杰", modality: "Biometry", eye: "OD", acquisitionDate: "2026-06-28T11:20:00.000Z", deviceModel: "IOLMaster 700", status: "reported", indications: "白内障术前 IOL 测算" },
  { id: "ES-1006", patientId: "PEYE-001", patientName: "李慧敏", modality: "Fundus", eye: "OD", acquisitionDate: "2026-07-03T09:05:00.000Z", deviceModel: "Canon CR-2", status: "reported", indications: "DR 随访复查" },
];

const MODALITY_COLORS: Record<string, string> = {
  OCT: "linear-gradient(135deg,#0ea5e9,#1d4ed8)",
  Fundus: "linear-gradient(135deg,#f59e0b,#dc2626)",
  FA: "linear-gradient(135deg,#8b5cf6,#4c1d95)",
  ICG: "linear-gradient(135deg,#06b6d4,#0e7490)",
  SlitLamp: "linear-gradient(135deg,#10b981,#065f46)",
  VisualField: "linear-gradient(135deg,#64748b,#1e293b)",
  Biometry: "linear-gradient(135deg,#f97316,#7c2d12)",
};

const MODALITY_LABELS: Record<string, string> = {
  OCT: "OCT",
  Fundus: "montage.modality.fundus",
  FA: "montage.modality.fa",
  ICG: "ICG",
  SlitLamp: "montage.modality.slitLamp",
  VisualField: "montage.modality.visualField",
  Biometry: "montage.modality.biometry",
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

const MontagePage: React.FC = () => {
  const [type, setType] = useState<"panoramic" | "mosaic" | "widefield">(
    "panoramic",
  );
  const [overlap, setOverlap] = useState(30);
  const [studies, setStudies] = useState<EyeStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [exporting, setExporting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const loadStudies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await eyeApi.getStudies({ take: 9 });
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setStudies(res.data as EyeStudy[]);
        setUsingFallback(false);
      } else {
        setStudies(FALLBACK_STUDIES.slice(0, 9));
        setUsingFallback(true);
      }
    } catch {
      setStudies(FALLBACK_STUDIES.slice(0, 9));
      setUsingFallback(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStudies();
  }, [loadStudies]);

  const gridItems = studies.slice(0, 9);

  const handleExportCsv = useCallback(() => {
    const header = [t("w9d.montage.csvStudyId"), t("w9d.montage.csvPatientId"), t("w9d.montage.csvPatientName"), t("w9d.montage.csvModality"), t("w9d.montage.csvEye"), t("w9d.montage.csvAcqTime"), t("w9d.montage.csvDevice"), t("w9d.montage.csvStatus"), t("w9d.montage.csvIndications")];
    const rows = gridItems.map((s) => [
      s.id,
      s.patientId,
      s.patientName,
      s.modality,
      s.eye,
      s.acquisitionDate,
      s.deviceModel,
      s.status,
      s.indications ?? "",
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, `eye-montage-${new Date().toISOString().slice(0, 10)}.csv`);
    message.success(t("w9d.montage.csvExported", { count: gridItems.length }));
  }, [gridItems]);

  // canvas 生成拼图截图 → PNG Blob 下载
  const handleExportPng = useCallback(() => {
    const size = 900;
    const tile = size / 3;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    canvasRef.current = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      message.error(t("montage.canvasUnsupported"));
      return;
    }
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, size, size);
    gridItems.forEach((s, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = col * tile;
      const y = row * tile;
      const grad = ctx.createLinearGradient(x, y, x + tile, y + tile);
      const c1 = MODALITY_COLORS[s.modality] ?? "#334155";
      const c2 = "#0f172a";
      grad.addColorStop(0, c1);
      grad.addColorStop(1, c2);
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, tile, tile);
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, tile - 2, tile - 2);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 28px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(t(MODALITY_LABELS[s.modality] ?? s.modality), x + tile / 2, y + tile / 2 - 18);
      ctx.font = "20px sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText(`${s.patientName} · ${s.eye}`, x + tile / 2, y + tile / 2 + 22);
      ctx.font = "16px sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillText(formatDate(s.acquisitionDate), x + tile / 2, y + tile / 2 + 50);
      ctx.fillText(`#${i + 1}`, x + 18, y + 28);
    });
    // 底部信息条
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, size - 46, size, 46);
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "18px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(
      t("w9d.montage.pngCaption", { count: gridItems.length, overlap, type: type === "mosaic" ? t("w9d.montage.typeMosaic") : type === "widefield" ? t("w9d.montage.typeWidefield") : t("w9d.montage.typePanorama") }),
      18,
      size - 16,
    );
    canvas.toBlob((blob) => {
      if (blob) {
        downloadBlob(blob, `eye-montage-${new Date().toISOString().slice(0, 10)}.png`);
        message.success(t("montage.pngExported"));
      } else {
        message.error(t("montage.pngFailed"));
      }
    }, "image/png");
  }, [gridItems, overlap, type]);

  const handleExport = (key: string) => {
    setExporting(true);
    try {
      if (key === "csv") handleExportCsv();
      else if (key === "png") handleExportPng();
    } finally {
      setExporting(false);
    }
  };

  const sourceBadge = loading ? null : usingFallback ? (
    <Tag color="orange" icon={<Database size={12} />}>{t("montage.previewFallback")}</Tag>
  ) : (
    <Tag color="green" icon={<Database size={12} />}>{t("montage.previewApi")}</Tag>
  );

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
                <LayoutIcon size={16} />
                <span>{t("montage.title")}</span>
                <Tag color="cyan">{type === "mosaic" ? t("montage.type.mosaic") : type === "widefield" ? t("montage.type.widefield") : t("montage.type.panoramic")}</Tag>
                {sourceBadge}
              </Space>
            }
            extra={
              <Space>
                <Select
                  value={type}
                  onChange={setType}
                  style={{ width: 140 }}
                  options={[
                    { value: "panoramic", label: t("montage.opt.panoramic") },
                    { value: "mosaic", label: t("montage.opt.mosaic") },
                    { value: "widefield", label: t("montage.opt.widefield") },
                  ]}
                />
                <Dropdown
                  menu={{
                    items: [
                      { key: "csv", icon: <FileSpreadsheet size={14} />, label: t("montage.export.csv") },
                      { key: "png", icon: <Camera size={14} />, label: t("montage.export.png") },
                    ],
                    onClick: ({ key }) => handleExport(key),
                  }}
                >
                  <Button size="small" icon={<Download size={14} />} loading={exporting}>
                    {t("montage.export")}
                  </Button>
                </Dropdown>
              </Space>
            }
          >
            {loading ? (
              <div style={{ height: 350, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Spin tip={t("montage.loading")}>
                  <div style={{ height: 60 }} />
                </Spin>
              </div>
            ) : error ? (
              <Alert
                type="error"
                showIcon
                message={error}
                action={<Button size="small" onClick={() => void loadStudies()}><RefreshCw size={12} /> {t("montage.retry")}</Button>}
              />
            ) : (
              <div
                style={{
                  background: "#0f172a",
                  height: 350,
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-secondary)",
                  flexDirection: "column",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "grid",
                    gridTemplateColumns: "repeat(3,1fr)",
                    gap: 2,
                    padding: 4,
                  }}
                >
                  {gridItems.length === 0 ? (
                    [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                      <div
                        key={n}
                        style={{
                          background: "var(--color-primary-800)",
                          borderRadius: 4,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--text-secondary)",
                          fontSize: 12,
                        }}
                      >
                        {t("montage.imageN", { n })}
                      </div>
                    ))
                  ) : (
                    gridItems.map((s, i) => (
                      <div
                        key={s.id}
                        title={`${s.patientName} · ${t(MODALITY_LABELS[s.modality] ?? s.modality)} (${s.eye}) · ${formatDate(s.acquisitionDate)}`}
                        style={{
                          background: MODALITY_COLORS[s.modality] ?? "#1e293b",
                          borderRadius: 4,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "rgba(255,255,255,0.9)",
                          fontSize: 12,
                          flexDirection: "column",
                          gap: 2,
                          position: "relative",
                          overflow: "hidden",
                          cursor: "pointer",
                        }}
                      >
                        <span style={{ position: "absolute", top: 4, left: 8, fontSize: 10, opacity: 0.7 }}>
                          #{i + 1}
                        </span>
                        <FileImage size={18} opacity={0.75} />
                        <span style={{ fontWeight: 700 }}>
                          {t(MODALITY_LABELS[s.modality] ?? s.modality)} · {s.eye}
                        </span>
                        <span style={{ opacity: 0.75, fontSize: 11 }}>{s.patientName}</span>
                        <span style={{ opacity: 0.6, fontSize: 10 }}>{formatDate(s.acquisitionDate)}</span>
                        {s.status === "reported" && (
                          <Tag color="green" style={{ position: "absolute", top: 4, right: 4, fontSize: 9, margin: 0 }}>
                            {t("montage.reported")}
                          </Tag>
                        )}
                      </div>
                    ))
                  )}
                </div>
                <div
                  style={{
                    position: "absolute",
                    bottom: 16,
                    background: "rgba(0,0,0,0.6)",
                    color: "#e2e8f0",
                    padding: "4px 12px",
                    borderRadius: 4,
                    fontSize: 12,
                  }}
                >
                  {gridItems.length} {t("montage.summaryMerged")} • {t("montage.summaryOverlap")} {overlap}% • {t("montage.summarySource")}:{" "}
                  {usingFallback ? t("montage.demoFallback") : `API /eye/studies (${currentApiMode()})`}
                </div>
              </div>
            )}
          </Card>
          <Card size="small" title={t("montage.params")} style={{ marginTop: 8 }}>
            <Row gutter={16}>
              <Col span={8}>
                <div style={{ fontSize: 12 }}>
                  {t("montage.overlapLabel")}{" "}
                  <Slider
                    min={10}
                    max={50}
                    value={overlap}
                    onChange={setOverlap}
                    style={{ width: "80%", display: "inline-block" }}
                  />
                  {overlap}%
                </div>
              </Col>
              <Col span={6}>
                <Tag>{t("montage.tag.multiband")}</Tag>
              </Col>
              <Col span={5}>
                <Tag>{t("montage.tag.autoCrop")}</Tag>
              </Col>
              <Col span={5}>
                <Tag>{t("montage.tag.quality")}</Tag>
              </Col>
            </Row>
          </Card>
        </Col>
        <Col span={8}>
          <Card
            size="small"
            title={t("montage.sourceList", { count: gridItems.length })}
            extra={
              <Button size="small" type="link" icon={<RefreshCw size={12} />} onClick={() => void loadStudies()}>
                {t("montage.refresh")}
              </Button>
            }
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: 4,
              }}
            >
              {gridItems.map((s) => (
                <div
                  key={s.id}
                  title={`${s.id} · ${s.deviceModel || t("montage.unknownDevice")}`}
                  style={{
                    background: MODALITY_COLORS[s.modality] ?? "#1e293b",
                    height: 60,
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "rgba(255,255,255,0.85)",
                    fontSize: 11,
                    flexDirection: "column",
                    gap: 2,
                  }}
                >
                  <ImageIcon size={14} />
                  <span>{s.modality} · {s.eye}</span>
                </div>
              ))}
              {gridItems.length === 0 && (
                <div style={{ gridColumn: "1 / -1", color: "var(--text-secondary)", fontSize: 12, textAlign: "center", padding: 20 }}>
                  {t("montage.emptyStudies")}
                </div>
              )}
            </div>
          </Card>
          <Card size="small" title={t("montage.history")} style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, lineHeight: 2 }}>
              {gridItems.length > 0 ? (
                <>
                  {gridItems.slice(0, 3).map((s, i) => (
                    <span key={s.id}>
                      • {formatDate(s.acquisitionDate)} {t("montage.montageShort")} #{i + 1} ({t(MODALITY_LABELS[s.modality] ?? s.modality)}) 
                      {i < 2 && <><br /></>}
                    </span>
                  ))}
                </>
              ) : (
                t("montage.emptyHistory")
              )}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};
export default MontagePage;
