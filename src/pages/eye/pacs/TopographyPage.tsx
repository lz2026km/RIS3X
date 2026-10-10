import React, { useState, useEffect } from "react";
import { Card, Row, Col, Tag, Space, Statistic, Spin, Button } from "antd";
import { Map, RefreshCw, Download } from 'lucide-react';
import EyeLateralityBadge from "@/components/eye/EyeLateralityBadge";
import { eyeApi } from "@/services/api/eyeApi";
import { ErrorBanner } from "@/components/feedback";
import { t } from "../../../i18n/appI18n";

const TopographyPage: React.FC = () => {
  const [study, setStudy] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const handleExport = () => {
    const payload = { study, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${t('w9d.topography.exportName')}_${study?.id ?? "export"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await eyeApi.getStudies({ modality: 'topography' });
        if (!cancelled && res.success && Array.isArray(res.data) && res.data.length > 0) {
          setStudy(res.data[0]);
        } else if (!cancelled && !res.success) {
          setLoadError(t('w9.states.error'));
        }
      } catch { setLoadError(t('w9.states.error')); }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [reloadTick]);

  if (loading) return <div style={{ padding: 'var(--space-4, 16px)', textAlign: 'center' }}><Spin tip={t('topography.loading')} /></div>;
  if (!study) return (
    <div style={{ padding: 'var(--space-4, 16px)', textAlign: 'center' }}>
      {loadError && <ErrorBanner message={loadError} onRetry={() => setReloadTick((n) => n + 1)} retryLabel={t('w9.states.retry')} />}
      {t('topography.noData')}
    </div>
  );
  return (
    <div
      style={{
        padding: 'var(--space-4, 16px)',
        background: "var(--bg-card)",
        minHeight: "calc(100vh - 56px)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-3, 12px)' }}>
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
                      background: "linear-gradient(135deg, var(--color-primary-800), #0f172a)",
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
                    <span style={{ fontSize: 12, marginTop: 'var(--space-1, 4px)' }}>{m.label}</span>
                    <div
                      style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 'var(--space-1, 4px)' }}
                    >
                      {m.value}
                    </div>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
          <Card size="small" title={t('topography.cornealParams')} style={{ marginTop: 'var(--space-2, 8px)' }}>
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
            style={{ marginTop: 'var(--space-2, 8px)' }}
          >
            <Row gutter={16}>
              {[
                {
                  title: "BAD D",
                  value: "0.82",
                  color: "var(--color-success-500)",
                  note: t('topography.normalLt'),
                },
                {
                  title: "BAD D_Δ",
                  value: "0.64",
                  color: "var(--color-success-500)",
                  note: t('topography.normal'),
                },
                {
                  title: t('topography.anteriorElevation'),
                  value: "+0.008",
                  color: "var(--color-success-500)",
                  note: "mm",
                },
                {
                  title: t('topography.posteriorElevation'),
                  value: "+0.014",
                  color: "var(--color-success-500)",
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
          <Card size="small" title={t('topography.interpretation')} style={{ marginTop: 'var(--space-2, 8px)' }}>
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
