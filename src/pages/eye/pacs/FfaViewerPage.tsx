import React, { useState, useEffect } from "react";
import { Card, Row, Col, Tag, Space, Statistic, Alert, Spin } from "antd";
import { Image } from 'lucide-react';
import EyeLateralityBadge from "@/components/eye/EyeLateralityBadge";
import AiDiagnosisCard from "@/components/eye/AiDiagnosisCard";
import CriticalValueAlert from "@/components/eye/CriticalValueAlert";
import { eyeApi } from "@/services/api/eyeApi";

const MODALITY_LABELS: Record<string, string> = { fundus_photo: '眼底彩照', oct: 'OCT', ffa: 'FFA', icga: 'ICGA', visual_field: '视野', topography: '角膜地形图', pentacam: 'Pentacam', iol_master: 'IOL Master', ubm: 'UBM', slit_lamp: '裂隙灯', oct_a: 'OCTA', corneal_endothelium: '角膜内皮', tear_film: '泪膜', fundus_autofluorescence: '眼底自发荧光' };

const FfaViewerPage: React.FC = () => {
  const [study, setStudy] = useState<any>(null);
  const [aiDiag, setAiDiag] = useState<any[]>([]);
  const [criticalValues, setCriticalValues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const [studiesRes, aiRes, cvRes] = await Promise.all([
          eyeApi.getStudies({ modality: 'ffa' }),
          eyeApi.listInferences().catch(() => ({ success: false, data: [] })),
          eyeApi.getCriticalValues().catch(() => ({ success: false, data: [] })),
        ]);
        if (!cancelled && studiesRes.success && Array.isArray(studiesRes.data) && studiesRes.data.length > 0) {
          const s = studiesRes.data[0];
          setStudy(s);
          if (aiRes.success && Array.isArray(aiRes.data)) {
            setAiDiag(aiRes.data.filter((d: any) => d.studyId === s.id));
          }
          if (cvRes.success && Array.isArray(cvRes.data)) {
            setCriticalValues(cvRes.data.filter((c: any) => c.studyId === s.id));
          }
        }
      } catch { /* API may not be available */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);
  if (loading) return <div style={{ padding: 32, textAlign: 'center' }}><Spin tip="加载中..." /></div>;
  if (!study) {
    return (
      <div style={{ padding: 32, textAlign: "center" }}>
        <Alert
          type="warning"
          showIcon
          title="无 FFA 检查数据"
          description="当前未加载眼底血管造影(FFA)检查数据,请先在检查列表中选择 FFA 检查。"
          style={{ maxWidth: 480, margin: "60px auto" }}
        />
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
          <CriticalValueAlert items={criticalValues} />
          <Card
            size="small"
            title={
              <Space>
                <Image size={16} />
                <span>FFA 荧光血管造影</span>
                <EyeLateralityBadge eyeSide="OD" />
                <Tag color="cyan">Heidelberg Spectralis HRA+OCT</Tag>
              </Space>
            }
          >
            <Row gutter={8}>
              {[
                { name: "动脉期 (30s)", desc: "颞上微动脉瘤" },
                { name: "静脉期 (1min)", desc: "囊样水肿渗漏" },
                { name: "晚期 (10min)", desc: "荧光积存" },
              ].map((p, i) => (
                <Col span={8} key={i}>
                  <div
                    style={{
                      background: "#0f172a",
                      height: 280,
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--text-secondary)",
                      flexDirection: "column",
                      fontSize: 12,
                    }}
                  >
                    <Image size={36} />
                    <span style={{ marginTop: 4 }}>{p.name}</span>
                    <span style={{ color: "var(--text-secondary)" }}>{p.desc}</span>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
          <Card size="small" title="FFA 定量分析" style={{ marginTop: 8 }}>
            <Row gutter={16}>
              {[
                { title: "AVT", value: "14", suffix: "s", note: "正常 10-15s" },
                {
                  title: "渗漏面积",
                  value: "8.5",
                  suffix: "mm²",
                  note: "黄斑区",
                },
                { title: "病灶面积", value: "3.2", suffix: "mm²", note: "CNV" },
                {
                  title: "FAZ",
                  value: "0.45",
                  suffix: "mm²",
                  note: "正常范围",
                },
                { title: "毛细血管无灌注", value: "阳性", note: "颞上象限" },
                { title: "CSME", value: "阳性", note: "黄斑水肿" },
              ].map((s) => (
                <Col span={8} key={s.title}>
                  <Statistic
                    title={s.title}
                    value={s.value}
                    suffix={s.suffix || ""}
                    styles={{ content: {  fontSize: 16  } }}
                  />
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{s.note}</div>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title="患者信息">
            <div style={{ fontSize: 12, lineHeight: 2 }}>
              患者: <strong>{study?.patientName}</strong>
              <br />
              眼别: <EyeLateralityBadge eyeSide="OD" size="small" />
              <br />
              诊断: <Tag color="orange">湿性AMD-CNV</Tag>
              <br />
              检查: {MODALITY_LABELS[study?.modality || "ffa"]}
              <br />
              <Alert
                title="活动性 CNV,需 72h 内抗 VEGF 治疗"
                type="warning"
                showIcon
                style={{ fontSize: 12, marginTop: 8 }}
              />
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
export default FfaViewerPage;
