import React, { useState, useEffect } from "react";
import { Tag, Button, Spin } from 'antd';
import { Image, ArrowLeft, Download } from "lucide-react";
import EyeLateralityBadge from "@/components/eye/EyeLateralityBadge";
import { eyeApi } from "@/services/api/eyeApi";
import { useNavigate, useSearchParams } from "react-router-dom";

const MODALITY_LABELS: Record<string, string> = {
  fundus_photo: "眼底彩照",
  oct: "OCT",
  ffa: "FFA",
  icga: "ICGA",
  visual_field: "视野",
  topography: "角膜地形图",
  pentacam: "Pentacam",
  iol_master: "IOL Master",
  ubm: "UBM",
  slit_lamp: "裂隙灯",
  oct_a: "OCTA",
  corneal_endothelium: "角膜内皮",
  tear_film: "泪膜",
  fundus_autofluorescence: "眼底自发荧光",
  borderline: "临界",
  cup_to_disc_ratio: "杯盘比",
  rim_width: "视盘缘宽度",
  arteriovenous_ratio: "动静脉比",
  abnormal: "异常",
  v6: "v6",
  text: "文本",
  findings_multi: "多发发现",
  images: "图像",
  productivity: "生产力",
  clinical: "临床",
  operational: "运营",
  financial: "财务",
  critical_value: "危急值",
  pending_review: "待审核",
};

const PacsViewerPage: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const studyId = params.get("studyId") || "";
  const [study, setStudy] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        if (studyId) {
          const res = await eyeApi.getStudy(studyId);
          if (!cancelled && res.success && res.data) {
            setStudy(res.data);
          }
        }
        if (!study) {
          const listRes = await eyeApi.getStudies();
          if (!cancelled && listRes.success && Array.isArray(listRes.data) && listRes.data.length > 0) {
            setStudy(listRes.data[0]);
          }
        }
      } catch { /* API may not be available */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [studyId]);

  if (loading) return <div style={{ padding: 16, textAlign: 'center' }}><Spin tip="加载中..." /></div>;
  if (!study) return <div style={{ padding: 16, textAlign: 'center', color: '#fff' }}>无检查数据</div>;

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
          返回
        </Button>
        <span style={{ fontSize: 16, fontWeight: 600 }}>
          {study.patientName}
        </span>
        <EyeLateralityBadge eyeSide={study.eyeSide} />
        <Tag color="cyan" style={{ fontSize: 12 }}>
          {MODALITY_LABELS[study.modality] || study.modality}
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
          导出 DICOM
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
            <div style={{ marginTop: 12, fontSize: 14 }}>影像显示区</div>
            <div style={{ fontSize: 12, color: "var(--text-primary)" }}>{study.device}</div>
            {study.criticalFlag && (
              <div style={{ color: "#ef4444", marginTop: 8, fontSize: 12 }}>
                ⚠ 危急值 - 请立即审核
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
          <div style={{ fontSize: 14, fontWeight: 600 }}>测量数据</div>
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
              <span style={{ fontWeight: 600 }}>{v}</span>
            </div>
          ))}
          <div style={{ height: 1, background: "#334155", margin: "8px 0" }} />
          <div style={{ fontSize: 14, fontWeight: 600 }}>报告</div>
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
