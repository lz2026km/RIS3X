import React, { useState, useEffect } from "react";
import { Card, Row, Col, Tag, Space, Statistic, Spin, Button } from 'antd';
import { Activity, Target, Droplets, RefreshCw, Download } from 'lucide-react';
import EyeLateralityBadge from "@/components/eye/EyeLateralityBadge";
import AiDiagnosisCard from "@/components/eye/AiDiagnosisCard";
import { eyeApi } from "@/services/api/eyeApi";
import { ErrorBanner } from "@/components/feedback";
import { t } from "../../../i18n/appI18n";

const modalityLabel = (m?: string) => t(`w9d.modality.${m ?? 'oct_a'}`);

const OctAngiographyPage: React.FC = () => {
  const [study, setStudy] = useState<any>(null);
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [aiDiag, setAiDiag] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const handleExport = () => {
    const payload = { study, measurements, aiDiag, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${t('w9d.octa.exportName')}_${study?.id ?? "export"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [studiesRes, measRes, aiRes] = await Promise.all([
          eyeApi.getStudies({ modality: 'oct_a' }),
          eyeApi.getMeasurements().catch(() => ({ success: false, data: [] })),
          eyeApi.listInferences().catch(() => ({ success: false, data: [] })),
        ]);
        if (!cancelled && studiesRes.success && Array.isArray(studiesRes.data) && studiesRes.data.length > 0) {
          const s = studiesRes.data[0];
          setStudy(s);
          if (measRes.success && Array.isArray(measRes.data)) {
            setMeasurements(measRes.data.filter((m: any) => m.studyId === s.id));
          }
          if (aiRes.success && Array.isArray(aiRes.data)) {
            setAiDiag(aiRes.data.filter((d: any) => d.studyId === s.id));
          }
        } else if (!cancelled && !studiesRes.success) {
          setLoadError(t('w9.states.error'));
        }
      } catch { setLoadError(t('w9.states.error')); }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [reloadTick]);
  if (loading) return <div style={{ padding: 16, textAlign: 'center' }}><Spin tip={t('w9d.viewerPro.loading')} /></div>;
  if (!study) return (
    <div style={{ padding: 16, textAlign: 'center' }}>
      {loadError && <ErrorBanner message={loadError} onRetry={() => setReloadTick((n) => n + 1)} retryLabel={t('w9.states.retry')} />}
      {t('w9d.octa.empty')}
    </div>
  );
  return (
    <div
      style={{
        padding: 16,
        background: "var(--bg-card)",
        minHeight: "calc(100vh - 56px)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 12 }}>
        <Button icon={<RefreshCw size={16} />} onClick={() => setReloadTick((n) => n + 1)}>{t('w1tables.viewer.refresh')}</Button>
        <Button type="primary" icon={<Download size={16} />} onClick={handleExport}>{t('w1tables.viewer.export')}</Button>
      </div>
      <Row gutter={12}>
        <Col span={16}>
          <Card
            size="small"
            title={
              <Space>
                <Activity size={16} />
                <span>{t('w9d.octa.title')}</span>
                <EyeLateralityBadge eyeSide="OD" />
                <Tag color="cyan">Optovue RTVue XR AngioVue</Tag>
              </Space>
            }
          >
            <Row gutter={8}>
              {[
                "浅层毛细血管丛",
                "深层毛细血管丛",
                "外层视网膜",
                "脉络膜毛细血管",
              ].map((layer, i) => (
                <Col span={6} key={i}>
                  <div
                    style={{
                      background: "#0f172a",
                      height: 200,
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--text-secondary)",
                      fontSize: 12,
                      flexDirection: "column",
                    }}
                  >
                    <Droplets size={24} />
                    <span style={{ marginTop: 4 }}>{layer}</span>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      textAlign: "center",
                      marginTop: 4,
                      color: "var(--text-secondary)",
                    }}
                  >
                    {layer}
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
          <Card size="small" title={t('w9d.octa.quantTitle')} style={{ marginTop: 8 }}>
            <Row gutter={16}>
              {measurements.slice(0, 6).map((m) => (
                <Col span={8} key={m.id}>
                  <Statistic
                    title={m.type}
                    value={m.value}
                    suffix={m.unit}
                    styles={{ content: { 
                      fontSize: 18,
                      color:
                        m.interpretation === "abnormal" ? "var(--color-error-500)" : "#0f172a",
                     } }}
                  />
                </Col>
              ))}
            </Row>
          </Card>
          <Card size="small" title={t('w9d.octa.cnvTitle')} style={{ marginTop: 8 }}>
            <div
              style={{
                background: "#0f172a",
                height: 240,
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-secondary)",
                flexDirection: "column",
              }}
            >
              <Target size={36} />
              <span>CNV 彩色血流叠加图 (面积 1.85mm², 血流面积 1.22mm²)</span>
              <div
                style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 12 }}
              >
                <span>
                  <Tag color="red">CNV 区域</Tag> 面积 1.85mm²
                </span>
                <span>
                  <Tag color="green">血流区域</Tag> 面积 1.22mm²
                </span>
                <span>
                  <Tag color="orange">滋养血管</Tag> 可见
                </span>
              </div>
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title={`${t('w9d.octa.patient')} ${study?.patientName}`}>
            <div style={{ fontSize: 12, lineHeight: 2 }}>
              {t('w9d.ffa.diagnosis')} <Tag color="orange">湿性AMD</Tag>
              <br />
              {t('w9d.octa.examType')} {modalityLabel(study?.modality || "oct_a")}
              <br />
              {t('w9d.octa.date')} {study ? new Date(study.studyDate).toLocaleString() : "-"}
            </div>
          </Card>
          {aiDiag.map((d) => (
            <AiDiagnosisCard key={d.id} diagnosis={d} />
          ))}
        </Col>
      </Row>
    </div>
  );
};
export default OctAngiographyPage;
