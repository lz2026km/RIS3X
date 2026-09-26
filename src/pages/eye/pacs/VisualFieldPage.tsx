import React, { useState, useEffect } from "react";
import { Card, Row, Col, Tag, Space, Statistic, Spin, Button } from "antd";
import { Activity, Target, RefreshCw, Download } from 'lucide-react';
import EyeLateralityBadge from "@/components/eye/EyeLateralityBadge";
import { eyeApi } from "@/services/api/eyeApi";
import { ErrorBanner } from "@/components/feedback";
import { t } from "../../../i18n/appI18n";

const VisualFieldPage: React.FC = () => {
  const [study, setStudy] = useState<any>(null);
  const [vf, setVf] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const handleExport = () => {
    const payload = { study, visualField: vf, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${t('w9d.visualField.exportName')}_${study?.id ?? "export"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [studiesRes, vfRes] = await Promise.all([
          eyeApi.getStudies({ modality: 'visual_field' }),
          eyeApi.getVisualFields().catch(() => ({ success: false, data: [] })),
        ]);
        if (!cancelled && studiesRes.success && Array.isArray(studiesRes.data) && studiesRes.data.length > 0) {
          const s = studiesRes.data[0];
          setStudy(s);
          if (vfRes.success && Array.isArray(vfRes.data)) {
            const match = vfRes.data.find((v: any) => v.studyId === s.id);
            if (match) setVf(match);
          }
        } else if (!cancelled && !studiesRes.success) {
          setLoadError(t('w9.states.error'));
        }
      } catch { setLoadError(t('w9.states.error')); }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [reloadTick]);

  if (loading) return <div style={{ padding: 16, textAlign: 'center' }}><Spin tip={t('visualField.loading')} /></div>;
  if (!study) return (
    <div style={{ padding: 16, textAlign: 'center' }}>
      {loadError && <ErrorBanner message={loadError} onRetry={() => setReloadTick((n) => n + 1)} retryLabel={t('w9.states.retry')} />}
      {t('visualField.noData')}
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
                <span>{t('visualField.analysis')}</span>
                <EyeLateralityBadge eyeSide="OS" />
                <Tag color="cyan">Zeiss Humphrey HFA3 24-2 SITA-Fast</Tag>
                <Tag color="gold">{t('visualField.demoTag')}</Tag>
              </Space>
            }
          >
            <Row gutter={12}>
              <Col span={8}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(8,1fr)",
                    gap: 1,
                    background: "#1e293b",
                    padding: 8,
                    borderRadius: 6,
                  }}
                >
                  {[
                    0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 2, 3, 2, 1, 0, 1, 0, 2, 4, 5,
                    4, 2, 0, 1, 2, 3, 5, 5, 5, 4, 2, 0, 1, 4, 5, 5, 4, 3, 0, 0,
                    0, 2, 4, 3, 1, 1, 0, 0, 0, 1, 3, 3, 2, 1, 0, 0, 0, 0, 1, 1,
                    0, 0, 0, 0,
                  ].map((v, i) => (
                    <div
                      key={i}
                      style={{
                        width: "100%",
                        aspectRatio: "1",
                        background:
                          v === 0
                            ? "#0f172a"
                            : v === 1
                              ? "var(--color-primary-800)"
                              : v === 2
                                ? "#2d5a8c"
                                : v === 3
                                  ? "#4a7ab5"
                                  : v >= 4
                                    ? "#6a9ad5"
                                    : "#0f172a",
                        borderRadius: 2,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 7,
                        color: "var(--text-secondary)",
                      }}
                    >
                      {v > 0 ? v : ""}
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    marginTop: 4,
                    textAlign: "center",
                  }}
                >
                  {t('visualField.grayscaleCaption')}
                </div>
              </Col>
              <Col span={8}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(8,1fr)",
                    gap: 1,
                    background: "#1e293b",
                    padding: 8,
                    borderRadius: 6,
                  }}
                >
                  {[
                    -2, -1, -3, -1, -2, -1, 0, -1, -3, -5, -8, -10, -12, -8, -2,
                    -1, -4, -8, -12, -14, -15, -12, -5, -2, -3, -8, -14, -18,
                    -20, -18, -10, -4, -1, -5, -12, -16, -15, -12, -6, -2, 0,
                    -3, -8, -10, -8, -5, -2, 0, 0, -1, -3, -5, -3, -2, 0, 0, 0,
                    0, -1, -1, 0, 0, 0, 0,
                  ].map((v, i) => (
                    <div
                      key={i}
                      style={{
                        width: "100%",
                        aspectRatio: "1",
                        background:
                          v < -10
                            ? "#ef4444"
                            : v < -5
                              ? "#f97316"
                              : v < -2
                                ? "#eab308"
                                : "#0f172a",
                        borderRadius: 2,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 7,
                        color: "#fff",
                      }}
                    >
                      {v}
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    marginTop: 4,
                    textAlign: "center",
                  }}
                >
                  {t('visualField.patternDeviation')}
                </div>
              </Col>
              <Col span={8}>
                <div
                  style={{
                    background: "#0f172a",
                    height: 180,
                    borderRadius: 6,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text-secondary)",
                    flexDirection: "column",
                  }}
                >
                  <Target size={24} />
                  <span style={{ fontSize: 12, marginTop: 4 }}>{t('visualField.tdCurve')}</span>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {t('visualField.tdCurveDesc')}
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
          <Card size="small" title={t('visualField.indices')} style={{ marginTop: 8 }}>
            <Row gutter={16}>
              {[
                {
                  title: "MD",
                  value: vf?.md,
                  suffix: "dB",
                  color: vf && vf.md < -6 ? "#ef4444" : "#0f172a",
                },
                {
                  title: "PSD",
                  value: vf?.psd,
                  suffix: "dB",
                  color: vf && vf.psd > 5 ? "#ef4444" : "#0f172a",
                },
                {
                  title: "VFI",
                  value: vf?.vfi,
                  suffix: "%",
                  color: vf && vf.vfi < 75 ? "#ef4444" : "#0f172a",
                },
                { title: "visualField.centralThreshold", value: vf?.fovealThreshold, suffix: "dB" },
                {
                  title: "visualField.meanSensitivity",
                  value: vf?.meanSensitivity,
                  suffix: "dB",
                },
              ].map((s) => (
                <Col span={8} key={s.title} style={{ marginBottom: 8 }}>
                  <Statistic
                    title={t(s.title)}
                    value={s.value}
                    suffix={s.suffix}
                    styles={{ content: {  fontSize: 20, color: s.color  } }}
                  />
                </Col>
              ))}
            </Row>
          </Card>
          <Card size="small" title={t('visualField.reliability')} style={{ marginTop: 8 }}>
            <Row gutter={16}>
              {[
                { title: "visualField.fixationLosses", value: vf?.fixationLosses, suffix: "%" },
                { title: "visualField.falsePositives", value: vf?.falsePositives, suffix: "%" },
                { title: "visualField.falseNegatives", value: vf?.falseNegatives, suffix: "%" },
                { title: "GHT", value: vf?.ght },
                { title: "visualField.reliabilityShort", value: vf?.reliability },
              ].map((s) => (
                <Col span={8} key={s.title}>
                  <Statistic
                    title={t(s.title)}
                    value={s.value}
                    suffix={s.suffix || ""}
                    styles={{ content: {  fontSize: 16  } }}
                  />
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title={t('visualField.patientInfo')}>
            <div style={{ fontSize: 12, lineHeight: 2 }}>
              {t('visualField.patient')} <strong>{study?.patientName}</strong>
              <br />
              {t('visualField.eyeSide')} <EyeLateralityBadge eyeSide="OS" size="small" />
              <br />
              {t('visualField.studyDate')}{" "}
              {study ? new Date(study.studyDate).toLocaleString() : "-"}
              <br />
              {t('visualField.diagnosis')} <Tag color="orange">{t('visualField.poag')}</Tag>
            </div>
          </Card>
          <Card size="small" title={t('visualField.interpretation')} style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, lineHeight: 1.8 }}>
              <div>
                GHT: <Tag color="red">{t('visualField.outsideNormal')}</Tag>
              </div>
              <div>{t('visualField.defectPattern')}</div>
              <div>{t('visualField.defectDepth')} {vf?.defectDepth}dB</div>
              <div style={{ marginTop: 8, color: "var(--text-secondary)" }}>
                • {t('visualField.note1')}
              </div>
              <div style={{ color: "var(--text-secondary)" }}>• {t('visualField.note2')}</div>
              <div style={{ color: "var(--text-secondary)" }}>• {t('visualField.note3')}</div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};
export default VisualFieldPage;
