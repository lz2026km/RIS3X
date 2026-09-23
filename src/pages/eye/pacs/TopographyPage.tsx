import React, { useState, useEffect } from "react";
import { Card, Row, Col, Tag, Space, Statistic, Spin, Button } from "antd";
import { Map, RefreshCw, Download } from 'lucide-react';
import EyeLateralityBadge from "@/components/eye/EyeLateralityBadge";
import { eyeApi } from "@/services/api/eyeApi";
import { t } from "../../../i18n/appI18n";

const TopographyPage: React.FC = () => {
  const [study, setStudy] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);

  const handleExport = () => {
    const payload = { study, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `角膜地形图报告_${study?.id ?? "export"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await eyeApi.getStudies({ modality: 'topography' });
        if (!cancelled && res.success && Array.isArray(res.data) && res.data.length > 0) {
          setStudy(res.data[0]);
        }
      } catch { /* API may not be available */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [reloadTick]);

  if (loading) return <div style={{ padding: 16, textAlign: 'center' }}><Spin tip={t('topography.loading')} /></div>;
  if (!study) return <div style={{ padding: 16, textAlign: 'center' }}>{t('topography.noData')}</div>;
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
                <Map size={16} />
                <span>{t('topography.title')}</span>
                <EyeLateralityBadge eyeSide="OD" />
                <Tag color="cyan">Medmont E300</Tag>
                <Tag color="gold">{t('topography.demoData')}</Tag>
              </Space>
            }
          >
            <Row gutter={12}>
              {[
                { key: 'axial', label: t('topography.axialMap'), value: "SimK 43.1@178°/44.6@88°" },
                { key: 'tangential', label: t('topography.tangentialMap'), value: t('topography.sriInline', { value: "0.48" }) },
                { key: 'thickness', label: t('topography.thicknessMap'), value: t('topography.thinnestInline', { value: "524μm" }) },
              ].map((m) => (
                <Col span={8} key={m.key}>
                  <div
                    style={{
                      background: "linear-gradient(135deg, #1e40af, #0f172a)",
                      height: 240,
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--text-secondary)",
                      flexDirection: "column",
                    }}
                  >
                    <Map size={32} />
                    <span style={{ fontSize: 12, marginTop: 4 }}>{m.label}</span>
                    <div
                      style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}
                    >
                      {m.value}
                    </div>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
          <Card size="small" title={t('topography.cornealParams')} style={{ marginTop: 8 }}>
            <Row gutter={16}>
              {[
                { title: "SimK1", value: "43.1", suffix: "D @178°" },
                { title: "SimK2", value: "44.6", suffix: "D @88°" },
                { title: t('topography.astigmatism'), value: "1.5", suffix: "D" },
                { title: t('topography.avgK'), value: "43.85", suffix: "D" },
                { title: t('topography.thinnest'), value: "524", suffix: "μm" },
                { title: "SAI", value: "0.32" },
                { title: "SRI", value: "0.48" },
                { title: t('topography.expectedVa'), value: "20/20" },
              ].map((s) => (
                <Col span={6} key={s.title}>
                  <Statistic
                    title={s.title}
                    value={s.value}
                    suffix={s.suffix || ""}
                    styles={{ content: {  fontSize: 16  } }}
                  />
                </Col>
              ))}
            </Row>
          </Card>
          <Card
            size="small"
            title={t('topography.keratoconusScreening')}
            style={{ marginTop: 8 }}
          >
            <Row gutter={16}>
              {[
                {
                  title: "BAD D",
                  value: "0.82",
                  color: "#22c55e",
                  note: t('topography.normalLt'),
                },
                {
                  title: "BAD D_Δ",
                  value: "0.64",
                  color: "#22c55e",
                  note: t('topography.normal'),
                },
                {
                  title: t('topography.anteriorElevation'),
                  value: "+0.008",
                  color: "#22c55e",
                  note: "mm",
                },
                {
                  title: t('topography.posteriorElevation'),
                  value: "+0.014",
                  color: "#22c55e",
                  note: "mm",
                },
              ].map((s) => (
                <Col span={6} key={s.title}>
                  <Statistic
                    title={s.title}
                    value={s.value}
                    styles={{ content: {  fontSize: 16, color: s.color  } }}
                  />
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{s.note}</div>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title={t('topography.patientInfo')}>
            <div style={{ fontSize: 12, lineHeight: 2 }}>
              {t('topography.patient')}: <strong>{study?.patientName}</strong>
              <br />
              {t('topography.eyeSide')}: <EyeLateralityBadge eyeSide="OD" size="small" />
              <br />
              {t('topography.diagnosis')}: <Tag>{t('topography.refractiveError')}</Tag>
              <br />
              {t('topography.cornealStatus')}: <Tag color="green">{t('topography.normal')}</Tag>
            </div>
          </Card>
          <Card size="small" title={t('topography.interpretation')} style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, lineHeight: 1.8, color: "var(--text-secondary)" }}>
              • {t('topography.interp1')}
              <br />• {t('topography.interp2')}
              <br />• {t('topography.interp3')}
              <br />• {t('topography.interp4')}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};
export default TopographyPage;
