import React, { useState, useEffect } from "react";
import { Card, Row, Col, Tag, Space, Statistic, Spin } from "antd";
import { Activity, Target } from 'lucide-react';
import EyeLateralityBadge from "@/components/eye/EyeLateralityBadge";
import { eyeApi } from "@/services/api/eyeApi";

const VisualFieldPage: React.FC = () => {
  const [study, setStudy] = useState<any>(null);
  const [vf, setVf] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
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
        }
      } catch { /* API may not be available */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div style={{ padding: 16, textAlign: 'center' }}><Spin tip="加载中..." /></div>;
  if (!study) return <div style={{ padding: 16, textAlign: 'center' }}>无视野检查数据</div>;
  return (
    <div
      style={{
        padding: 16,
        background: "#f8fafc",
        minHeight: "calc(100vh - 56px)",
      }}
    >
      <Row gutter={12}>
        <Col span={16}>
          <Card
            size="small"
            title={
              <Space>
                <Activity size={16} />
                <span>视野分析</span>
                <EyeLateralityBadge eyeSide="OS" />
                <Tag color="cyan">Zeiss Humphrey HFA3 24-2 SITA-Fast</Tag>
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
                        color: "#94a3b8",
                      }}
                    >
                      {v > 0 ? v : ""}
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#64748b",
                    marginTop: 4,
                    textAlign: "center",
                  }}
                >
                  灰度图 (dB) — 数值越小越暗
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
                    color: "#64748b",
                    marginTop: 4,
                    textAlign: "center",
                  }}
                >
                  模式偏差图 (dB)
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
                    color: "#64748b",
                    flexDirection: "column",
                  }}
                >
                  <Target size={24} />
                  <span style={{ fontSize: 12, marginTop: 4 }}>TD 曲线图</span>
                  <div style={{ fontSize: 12, color: "#475569" }}>
                    上方鼻侧阶梯状暗点
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
          <Card size="small" title="视野指数" style={{ marginTop: 8 }}>
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
                { title: "中心阈值", value: vf?.fovealThreshold, suffix: "dB" },
                {
                  title: "平均敏感度",
                  value: vf?.meanSensitivity,
                  suffix: "dB",
                },
              ].map((s) => (
                <Col span={8} key={s.title} style={{ marginBottom: 8 }}>
                  <Statistic
                    title={s.title}
                    value={s.value}
                    suffix={s.suffix}
                    styles={{ content: {  fontSize: 20, color: s.color  } }}
                  />
                </Col>
              ))}
            </Row>
          </Card>
          <Card size="small" title="可靠性指标" style={{ marginTop: 8 }}>
            <Row gutter={16}>
              {[
                { title: "固视丢失", value: vf?.fixationLosses, suffix: "%" },
                { title: "假阳性", value: vf?.falsePositives, suffix: "%" },
                { title: "假阴性", value: vf?.falseNegatives, suffix: "%" },
                { title: "GHT", value: vf?.ght },
                { title: "可靠性", value: vf?.reliability },
              ].map((s) => (
                <Col span={8} key={s.title}>
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
        </Col>
        <Col span={8}>
          <Card size="small" title="患者信息">
            <div style={{ fontSize: 12, lineHeight: 2 }}>
              患者: <strong>{study?.patientName}</strong>
              <br />
              眼别: <EyeLateralityBadge eyeSide="OS" size="small" />
              <br />
              检查日期:{" "}
              {study ? new Date(study.studyDate).toLocaleString() : "-"}
              <br />
              诊断: <Tag color="orange">原发性开角型青光眼</Tag>
            </div>
          </Card>
          <Card size="small" title="视野解读" style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, lineHeight: 1.8 }}>
              <div>
                GHT: <Tag color="red">正常范围外</Tag>
              </div>
              <div>缺损模式: 上方鼻侧阶梯状暗点</div>
              <div>缺损深度: {vf?.defectDepth}dB</div>
              <div style={{ marginTop: 8, color: "#475569" }}>
                • 颞上扇形敏感度显著下降(-12.5dB)
              </div>
              <div style={{ color: "#475569" }}>• 与 RNFL 颞上变薄一致</div>
              <div style={{ color: "#475569" }}>• 功能损伤已达重度</div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};
export default VisualFieldPage;
