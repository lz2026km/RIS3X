import React from "react";
import { Card, Row, Col, Tag, Table, Space, Button } from "antd";
import {
  Image,
  Download,
  ZoomIn,
  Maximize,
  Target,
  Activity,
} from "lucide-react";
import EyeLateralityBadge from "@/components/eye/EyeLateralityBadge";
import MeasurementPanel from "@/components/eye/MeasurementPanel";
import AiDiagnosisCard from "@/components/eye/AiDiagnosisCard";
import {
  MOCK_EYE_STUDIES,
  MOCK_EYE_MEASUREMENTS,
  MOCK_KEY_IMAGES,
  MOCK_ANNOTATIONS,
  MOCK_LESION_SEGMENTATIONS,
} from "@/data/eyePacsMock";
import { MOCK_AI_DIAGNOSES } from "@/data/eyeAiMock";
const MODALITY_LABELS: Record<string, string> = { fundus_photo: '眼底彩照', oct: 'OCT', ffa: 'FFA', icga: 'ICGA', visual_field: '视野', topography: '角膜地形图', pentacam: 'Pentacam', iol_master: 'IOL Master', ubm: 'UBM', slit_lamp: '裂隙灯', oct_a: 'OCTA', corneal_endothelium: '角膜内皮', tear_film: '泪膜', fundus_autofluorescence: '眼底自发荧光' };

const FundusViewerPage: React.FC = () => {
  const study = MOCK_EYE_STUDIES.find(
    (s) => s.modality === "fundus_photo" && s.patientId === "p-1001",
  )!;
  const measurements = MOCK_EYE_MEASUREMENTS.filter(
    (m) => m.studyId === study?.id,
  );
  const aiDiag = MOCK_AI_DIAGNOSES.filter((d) => d.studyId === study?.id);
  const lesions = MOCK_LESION_SEGMENTATIONS.filter(
    (l) => l.studyId === study?.id,
  );
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
                <Image size={16} />
                <span>眼底彩照查看器</span>
                <EyeLateralityBadge eyeSide="OD" />
                <Tag color="cyan">Topcon TRC-NW400</Tag>
              </Space>
            }
            extra={
              <Space>
                <Button size="small" icon={<ZoomIn size={14} />}>
                  1:1
                </Button>
                <Button size="small" icon={<Maximize size={14} />}>
                  全屏
                </Button>
                <Button size="small" icon={<Download size={14} />}>
                  导出
                </Button>
              </Space>
            }
          >
            <div
              style={{
                background: "#0f172a",
                height: 420,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#94a3b8",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <Target size={48} />
              <span>眼底彩照模拟图像区域 (右眼后极部)</span>
              <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
                <Tag>视盘 C/D 0.55</Tag>
                <Tag color="red">微动脉瘤 ×8</Tag>
                <Tag color="orange">出血 ×2</Tag>
                <Tag color="gold">渗出 ×4</Tag>
              </div>
            </div>
          </Card>
          <div style={{ marginTop: 8 }}>
            <MeasurementPanel
              measurements={measurements}
              title={`眼底测量 (${measurements.length}项)`}
            />
          </div>
          <Card size="small" title="AI 自动标注" style={{ marginTop: 8 }}>
            <Table
              dataSource={lesions}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                {
                  title: "病灶类型",
                  dataIndex: "type",
                  key: "type",
                  width: 100,
                  render: (v: string) => <Tag>{MODALITY_LABELS[v] || v}</Tag>,
                },
                {
                  title: "面积",
                  dataIndex: "area",
                  key: "area",
                  width: 80,
                  render: (v: number) => `${v.toFixed(2)}mm²`,
                },
                {
                  title: "距黄斑",
                  dataIndex: "distanceFromFovea",
                  key: "distanceFromFovea",
                  width: 80,
                  render: (v: number) => `${v.toFixed(1)}mm`,
                },
                {
                  title: "象限",
                  dataIndex: "quadrant",
                  key: "quadrant",
                  width: 80,
                },
                {
                  title: "置信度",
                  dataIndex: "confidence",
                  key: "confidence",
                  width: 60,
                  render: (v: number) => (
                    <Tag color={v > 0.9 ? "green" : "gold"}>
                      {Math.round(v * 100)}%
                    </Tag>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title="患者信息">
            <div style={{ fontSize: 12, lineHeight: 2 }}>
              <Row>
                <Col span={10}>姓名:</Col>
                <Col span={14}>
                  <strong>李明</strong>
                </Col>
              </Row>
              <Row>
                <Col span={10}>性别:</Col>
                <Col span={14}>男</Col>
              </Row>
              <Row>
                <Col span={10}>年龄:</Col>
                <Col span={14}>58岁</Col>
              </Row>
              <Row>
                <Col span={10}>诊断:</Col>
                <Col span={14}>
                  <Tag color="orange">糖尿病视网膜病变</Tag>
                </Col>
              </Row>
              <Row>
                <Col span={10}>眼别:</Col>
                <Col span={14}>
                  <EyeLateralityBadge eyeSide="OD" size="small" />
                </Col>
              </Row>
              <Row>
                <Col span={10}>检查日期:</Col>
                <Col span={14}>
                  {new Date(study?.studyDate || "").toLocaleString()}
                </Col>
              </Row>
            </div>
          </Card>
          {aiDiag.map((d) => (
            <AiDiagnosisCard key={d.id} diagnosis={d} />
          ))}
          <Card size="small" title="关键影像标记" style={{ marginTop: 8 }}>
            <Table
              dataSource={MOCK_KEY_IMAGES.filter(
                (k) => k.studyId === study?.id,
              )}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                {
                  title: "原因",
                  dataIndex: "reason",
                  key: "reason",
                  ellipsis: true,
                },
                {
                  title: "标记者",
                  dataIndex: "flaggedBy",
                  key: "flaggedBy",
                  width: 60,
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};
export default FundusViewerPage;
