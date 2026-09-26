import React, { useState, useEffect } from "react";
import { Tag, Button, Spin } from 'antd';
import { Image, ArrowLeft, Download } from "lucide-react";
import EyeLateralityBadge from "@/components/eye/EyeLateralityBadge";
import { eyeApi } from "@/services/api/eyeApi";
import { ErrorBanner } from "@/components/feedback";
import { t } from "../../../i18n/appI18n";
import { useNavigate, useSearchParams } from "react-router-dom";

const MODALITY_LABELS: Record<string, string> = {
  fundus_photo: "w9d.modality.fundus_photo",
  oct: "w9d.modality.oct",
  ffa: "w9d.modality.ffa",
  icga: "w9d.modality.icga",
  visual_field: "w9d.modality.visual_field",
  topography: "w9d.modality.topography",
  pentacam: "w9d.modality.pentacam",
  iol_master: "w9d.modality.iol_master",
  ubm: "w9d.modality.ubm",
  slit_lamp: "w9d.modality.slit_lamp",
  oct_a: "w9d.modality.oct_a",
  corneal_endothelium: "w9d.modality.corneal_endothelium",
  tear_film: "w9d.modality.tear_film",
  fundus_autofluorescence: "w9d.modality.fundus_autofluorescence",
  borderline: "w9d.reportStatus.borderline",
  cup_to_disc_ratio: "w9d.reportStatus.cup_to_disc_ratio",
  rim_width: "w9d.reportStatus.rim_width",
  arteriovenous_ratio: "w9d.reportStatus.arteriovenous_ratio",
  abnormal: "w9d.reportStatus.abnormal",
  v6: "w9d.reportStatus.v6",
  text: "w9d.reportStatus.text",
  findings_multi: "w9d.reportStatus.findings_multi",
  images: "w9d.reportStatus.images",
  productivity: "w9d.reportStatus.productivity",
  clinical: "w9d.reportStatus.clinical",
  operational: "w9d.reportStatus.operational",
  financial: "w9d.reportStatus.financial",
  critical_value: "w9d.reportStatus.critical_value",
  pending_review: "w9d.reportStatus.pending_review",
};
const modalityLabel = (m?: string) => (m && MODALITY_LABELS[m] ? t(MODALITY_LABELS[m]) : (m ?? ''));

const PacsViewerPage: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const studyId = params.get("studyId") || "";
  const [study, setStudy] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        if (studyId) {
          const res = await eyeApi.getStudy(studyId);
          if (!cancelled && res.success && res.data) {
            setStudy(res.data);
          } else if (!cancelled && !res.success) {
            setLoadError(t('w9.states.error'));
          }
        }
        if (!study) {
          const listRes = await eyeApi.getStudies();
          if (!cancelled && listRes.success && Array.isArray(listRes.data) && listRes.data.length > 0) {
            setStudy(listRes.data[0]);
          } else if (!cancelled && !listRes.success) {
            setLoadError(t('w9.states.error'));
          }
        }
      } catch { setLoadError(t('w9.states.error')); }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [studyId, reloadTick]);

  if (loading) return <div style={{ padding: 16, textAlign: 'center' }}><Spin tip={t('w9d.viewerPro.loading')} /></div>;
  if (!study) return (
    <div style={{ padding: 16, textAlign: 'center', color: '#fff' }}>
      {loadError && <ErrorBanner message={loadError} onRetry={() => setReloadTick((n) => n + 1)} retryLabel={t('w9.states.retry')} />}
      {t('w9d.pacsViewer.noData')}
    </div>
  );

  return (
    <div
      style={{
        padding: 16,
        background: "#0f172a",
        minHeight: "calc(100vh - 56px)",
        color: "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <Button
          type="text"
          style={{ color: "#fff" }}
          icon={<ArrowLeft className="v4-icon" />}
          onClick={() => navigate(-1)}
        >
          {t('w9d.pacsViewer.back')}
        </Button>
        <span style={{ fontSize: 16, fontWeight: 600 }}>
          {study.patientName}
        </span>
        <EyeLateralityBadge eyeSide={study.eyeSide} />
        <Tag color="cyan" style={{ fontSize: 12 }}>
          {modalityLabel(study.modality)}
        </Tag>
        <Tag style={{ fontSize: 12 }}>{study.patientId}</Tag>
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          {new Date(study.studyDate).toLocaleDateString()}
        </span>
        <div style={{ flex: 1 }} />
        <Button
          type="text"
          style={{ color: "#fff" }}
          icon={<Download className="v4-icon" />}
        >
          {t('w9d.pacsViewer.exportDicom')}
        </Button>
      </div>

      <div style={{ display: "flex", gap: 16, height: "calc(100vh - 140px)" }}>
        <div
          style={{
            flex: 1,
            background: "#000",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 400,
          }}
        >
          <div style={{ textAlign: "center", color: "var(--text-secondary)" }}>
            <Image
              className="v4-icon"
              style={{ width: 64, height: 64, color: "var(--text-primary)" }}
            />
            <div style={{ marginTop: 12, fontSize: 14 }}>{t('w9d.pacsViewer.imageArea')}</div>
            <div style={{ fontSize: 12, color: "var(--text-primary)" }}>{study.device}</div>
            {study.criticalFlag && (
              <div style={{ color: "#ef4444", marginTop: 8, fontSize: 12 }}>
                {t('w9d.pacsViewer.criticalWarning')}
              </div>
            )}
          </div>
        </div>
        <div
          style={{
            width: 320,
            background: "#1e293b",
            borderRadius: 8,
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600 }}>{t('w9d.pacsViewer.measurements')}</div>
          {Object.entries(study.measurements).map(([k, v]) => (
            <div
              key={k}
              style={{
                fontSize: 12,
                color: "#cbd5e1",
                padding: "4px 0",
                borderBottom: "1px solid #334155",
              }}
            >
              <span style={{ color: "var(--text-secondary)" }}>{k}: </span>
              <span style={{ fontWeight: 600 }}>{String(v)}</span>
            </div>
          ))}
          <div style={{ height: 1, background: "#334155", margin: "8px 0" }} />
          <div style={{ fontSize: 14, fontWeight: 600 }}>{t('w9d.pacsViewer.report')}</div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-secondary)",
              lineHeight: 1.6,
              flex: 1,
              overflow: "auto",
            }}
          >
            {study.report}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PacsViewerPage;
