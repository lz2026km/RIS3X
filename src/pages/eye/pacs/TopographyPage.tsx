import React, { useState, useEffect } from "react";
import { Card, Row, Col, Tag, Space, Statistic, Spin } from "antd";
import { Map } from 'lucide-react';
import EyeLateralityBadge from "@/components/eye/EyeLateralityBadge";
import { eyeApi } from "@/services/api/eyeApi";

const TopographyPage: React.FC = () => {
  const [study, setStudy] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
  }, []);

  if (loading) return <div style={{ padding: 16, textAlign: 'center' }}><Spin tip="加载中..." /></div>;
  if (!study) return <div style={{ padding: 16, textAlign: 'center' }}>无角膜地形图数据</div>;
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
                <Map size={16} />
                <span>角膜地形图</span>
                <EyeLateralityBadge eyeSide="OD" />
                <Tag color="cyan">Medmont E300</Tag>
                <Tag color="gold">演示数据 · 示例影像数据</Tag>
              </Space>
            }
          >
            <Row gutter={12}>
              {["轴向图", "切向图", "厚度图"].map((name, i) => (
                <Col span={8} key={i}>
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
                    <span style={{ fontSize: 12, marginTop: 4 }}>{name}</span>
                    <div
                      style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}
                    >
                      {name === "轴向图"
                        ? "SimK 43.1@178°/44.6@88°"
                        : name === "切向图"
                          ? "不规则指数 SRI 0.48"
                          : "最薄点 524μm"}
                    </div>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
          <Card size="small" title="角膜参数" style={{ marginTop: 8 }}>
            <Row gutter={16}>
              {[
                { title: "SimK1", value: "43.1", suffix: "D @178°" },
                { title: "SimK2", value: "44.6", suffix: "D @88°" },
                { title: "散光", value: "1.5", suffix: "D" },
                { title: "平均 K", value: "43.85", suffix: "D" },
                { title: "最薄点", value: "524", suffix: "μm" },
                { title: "SAI", value: "0.32" },
                { title: "SRI", value: "0.48" },
                { title: "预期视力", value: "20/20" },
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
            title="圆锥角膜筛查 (BAD)"
            style={{ marginTop: 8 }}
          >
            <Row gutter={16}>
              {[
                {
                  title: "BAD D",
                  value: "0.82",
                  color: "#22c55e",
                  note: "正常(<1.6)",
                },
                {
                  title: "BAD D_Δ",
                  value: "0.64",
                  color: "#22c55e",
                  note: "正常",
                },
                {
                  title: "前表面高度",
                  value: "+0.008",
                  color: "#22c55e",
                  note: "mm",
                },
                {
                  title: "后表面高度",
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
          <Card size="small" title="患者信息">
            <div style={{ fontSize: 12, lineHeight: 2 }}>
              患者: <strong>{study?.patientName}</strong>
              <br />
              眼别: <EyeLateralityBadge eyeSide="OD" size="small" />
              <br />
              诊断: <Tag>屈光不正</Tag>
              <br />
              角膜状态: <Tag color="green">正常</Tag>
            </div>
          </Card>
          <Card size="small" title="解读" style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, lineHeight: 1.8, color: "var(--text-secondary)" }}>
              • 角膜形态对称,规则散光
              <br />• SimK 差 1.5D 规则散光
              <br />• 最薄点位于中央偏颞
              <br />• BAD 筛查: 圆锥角膜阴性
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};
export default TopographyPage;
