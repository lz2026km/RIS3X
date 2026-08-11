import React, { useState, useEffect } from "react";
import { Card, Row, Col, Tag, Space, Select, Table, Button, message } from 'antd';
import { ArrowLeftRight, Eye, TrendingUp, TrendingDown, Trash2 } from "lucide-react";

import { eyeApi } from "@/services/api/eyeApi";

const ImageComparePage: React.FC = () => {
  const [pairIdx, setPairIdx] = useState(0);
  const [pairs, setPairs] = useState<any[]>([]);
  const [_loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await eyeApi.getComparison([]);
        if (!cancelled && res.success && Array.isArray(res.data)) {
          setPairs(res.data);
        }
      } catch { /* API may not be available */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const pair = pairs[pairIdx];

  if (!pair) {
    return (
      <div
        style={{
          padding: 16,
          background: "var(--bg-card)",
          minHeight: "calc(100vh - 56px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-secondary)",
          fontSize: 14,
        }}
      >
        暂无对比数据（影像对比服务不可用或未返回既往/当前检查）
      </div>
    );
  }

  // [G005 2B] 本地移除测量项
  const removeMeasurement = (parameter: string) => {
    if (!pair) return;
    setPairs(prev => prev.map((p, i) =>
      i === pairIdx
        ? { ...p, measurements: (p.measurements ?? []).filter((m: any) => m.parameter !== parameter) }
        : p,
    ));
    message.success(`已删除测量: ${parameter}`);
  };

  return (
    <div
      style={{
        padding: 16,
        background: "var(--bg-card)",
        minHeight: "calc(100vh - 56px)",
      }}
    >
      <Row gutter={12}>
        <Col span={24} style={{ marginBottom: 12 }}>
          <Space>
            <ArrowLeftRight size={20} color="#2563eb" />
            <span style={{ fontSize: 16, fontWeight: 600 }}>影像对比</span>
            <Select
              value={pairIdx}
              onChange={setPairIdx}
              style={{ width: 280 }}
              options={pairs.map((p, i) => ({
                value: i,
                label: `${p.patientName} - ${p.eyeSide === "OD" ? "右" : "左"}眼 (${p.priorDate ? new Date(p.priorDate).toLocaleDateString() : "—"} vs ${p.currentDate ? new Date(p.currentDate).toLocaleDateString() : "—"})`,
              }))}
            />
          </Space>
        </Col>
      </Row>
      <Row gutter={12}>
        <Col span={7}>
          <Card
            size="small"
            title={
              <>
                <Eye size={14} /> 既往检查{" "}
                <Tag>{new Date(pair.priorDate).toLocaleDateString()}</Tag>
              </>
            }
          >
            <div
              style={{
                background: "#0f172a",
                height: 300,
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-secondary)",
              }}
            >
              既往图像
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
              {pair.priorModality}
            </div>
          </Card>
        </Col>
        <Col
          span={2}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ArrowLeftRight size={28} color="var(--text-secondary)" />
        </Col>
        <Col span={7}>
          <Card
            size="small"
            title={
              <>
                <Eye size={14} /> 当前检查{" "}
                <Tag>{new Date(pair.currentDate).toLocaleDateString()}</Tag>
              </>
            }
          >
            <div
              style={{
                background: "#0f172a",
                height: 300,
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-secondary)",
              }}
            >
              当前图像
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
              {pair.currentModality}
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title="对比测量">
            <Table
              dataSource={pair.measurements}
              rowKey="parameter"
              size="small"
              pagination={false}
              columns={[
                { title: "参数", dataIndex: "parameter", key: "parameter" },
                {
                  title: "既往",
                  dataIndex: "priorValue",
                  key: "priorValue",
                  render: (v: number, r: any) => `${v} ${r.unit}`,
                },
                {
                  title: "当前",
                  dataIndex: "currentValue",
                  key: "currentValue",
                  render: (v: number, r: any) => `${v} ${r.unit}`,
                },
                {
                  title: "变化",
                  key: "change",
                  render: (_, r) => (
                    <Tag
                      color={
                        r.direction === "worsened"
                          ? "red"
                          : r.direction === "improved"
                            ? "green"
                            : "default"
                      }
                    >
                      {r.change > 0 ? "+" : ""}
                      {r.changePercent.toFixed(1)}%
                    </Tag>
                  ),
                },
                {
                  title: "趋势",
                  key: "trend",
                  render: (_, r) =>
                    r.direction === "worsened" ? (
                      <TrendingDown size={14} color="#ef4444" />
                    ) : r.direction === "improved" ? (
                      <TrendingUp size={14} color="#22c55e" />
                    ) : (
                      <Eye size={14} color="var(--text-secondary)" />
                    ),
                },
                {
                  title: "操作",
                  key: "action",
                  render: (_, r) => (
                    <Button size="small" danger icon={<Trash2 size={12} />} onClick={() => removeMeasurement(r.parameter)}>删除</Button>
                  ),
                },
              ]}
            scroll={{ x: 'max-content' }}
            />
          </Card>
          <Card size="small" title="AI 进展评估" style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, lineHeight: 1.8, color: "var(--text-secondary)" }}>
              {pair.aiProgression}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, marginTop: 8 }}>
              结论:{" "}
              <Tag color={pair.conclusion.includes("进展") ? "red" : "green"}>
                {pair.conclusion}
              </Tag>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};
export default ImageComparePage;
