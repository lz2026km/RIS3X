import React, { useState } from "react";
import { Card, Row, Col, Tag, Space, Select, Slider, Button } from "antd";
import { Layout as LayoutIcon, Image, Download } from 'lucide-react';

const MontagePage: React.FC = () => {
  const [type, setType] = useState<"panoramic" | "mosaic" | "widefield">(
    "panoramic",
  );
  const [overlap, setOverlap] = useState(30);
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
                <LayoutIcon size={16} />
                <span>影像拼图</span>
                <Tag color="cyan">全景</Tag>
              </Space>
            }
            extra={
              <Space>
                <Select
                  value={type}
                  onChange={setType}
                  style={{ width: 140 }}
                  options={[
                    { value: "panoramic", label: "全景拼图" },
                    { value: "mosaic", label: "马赛克(4x4)" },
                    { value: "widefield", label: "超广角" },
                  ]}
                />
                <Button size="small" icon={<Download size={14} />}>
                  导出
                </Button>
              </Space>
            }
          >
            <div
              style={{
                background: "#0f172a",
                height: 350,
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#64748b",
                flexDirection: "column",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "grid",
                  gridTemplateColumns: "repeat(3,1fr)",
                  gap: 2,
                  padding: 4,
                }}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <div
                    key={n}
                    style={{
                      background: "var(--color-primary-800)",
                      borderRadius: 4,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#475569",
                      fontSize: 12,
                    }}
                  >
                    图像 {n}
                  </div>
                ))}
              </div>
              <div
                style={{
                  position: "absolute",
                  bottom: 16,
                  background: "rgba(0,0,0,0.6)",
                  color: "#e2e8f0",
                  padding: "4px 12px",
                  borderRadius: 4,
                  fontSize: 12,
                }}
              >
                9 张图像拼合 • 重叠率 {overlap}%
              </div>
            </div>
          </Card>
          <Card size="small" title="拼接参数" style={{ marginTop: 8 }}>
            <Row gutter={16}>
              <Col span={8}>
                <div style={{ fontSize: 12 }}>
                  重叠率:{" "}
                  <Slider
                    min={10}
                    max={50}
                    value={overlap}
                    onChange={setOverlap}
                    style={{ width: "80%", display: "inline-block" }}
                  />
                  {overlap}%
                </div>
              </Col>
              <Col span={6}>
                <Tag>融合模式: Multi-Band</Tag>
              </Col>
              <Col span={5}>
                <Tag>自动裁剪: 是</Tag>
              </Col>
              <Col span={5}>
                <Tag>质量: 标准</Tag>
              </Col>
            </Row>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title="源图像列表 (9)">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: 4,
              }}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <div
                  key={n}
                  style={{
                    background: "#1e293b",
                    height: 60,
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#475569",
                    fontSize: 12,
                  }}
                >
                  <Image size={16} />
                </div>
              ))}
            </div>
          </Card>
          <Card size="small" title="拼接历史" style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, lineHeight: 2 }}>
              • 2026-06-18 拼图 #1 (眼底彩照) ✓<br />• 2026-06-10 拼图 #2 (OCT
              切片) ✓<br />• 2026-05-28 拼图 #3 (FFA 时序) ✓
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};
export default MontagePage;
