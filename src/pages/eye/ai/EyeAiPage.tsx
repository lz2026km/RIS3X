import React, { useState } from "react";
import {
  Card,
  Row,
  Col,
  Tag,
  Table,
  Tabs,
  Select,
  Statistic,
  Space,
  Progress,
  Badge,
} from "antd";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  Brain,
  Sparkles,
  Activity,
  Eye,
  AlertTriangle,
  CheckCircle,
  Clock,
} from "lucide-react";
import AiDiagnosisCard from "@/components/eye/AiDiagnosisCard";
import { MOCK_AI_MODELS, MOCK_AI_DIAGNOSES } from "@/data/eyeAiMock";
import { MOCK_EYE_STUDIES, MODALITY_LABELS } from "@/data/eyePacsMock";
import { PageContainer, PageHeader } from "@/components/common";
import { AppEmpty } from "@/components/feedback";
import { useBreakpoint } from "@/hooks/useBreakpoint";

const ACCEPTANCE_TREND_DATA = [
  { day: '周一', rate: 65, target: 80 },
  { day: '周二', rate: 68, target: 80 },
  { day: '周三', rate: 71, target: 80 },
  { day: '周四', rate: 70, target: 80 },
  { day: '周五', rate: 73, target: 80 },
  { day: '周六', rate: 75, target: 80 },
  { day: '周日', rate: 78, target: 80 },
];

const ROC_CURVE_DATA = [
  { fpr: 0.0, auc_dr: 0.0, auc_glaucoma: 0.0, auc_amd: 0.0, random: 0.0 },
  { fpr: 0.1, auc_dr: 0.55, auc_glaucoma: 0.5, auc_amd: 0.45, random: 0.1 },
  { fpr: 0.2, auc_dr: 0.75, auc_glaucoma: 0.7, auc_amd: 0.65, random: 0.2 },
  { fpr: 0.3, auc_dr: 0.85, auc_glaucoma: 0.8, auc_amd: 0.78, random: 0.3 },
  { fpr: 0.4, auc_dr: 0.9, auc_glaucoma: 0.86, auc_amd: 0.85, random: 0.4 },
  { fpr: 0.5, auc_dr: 0.93, auc_glaucoma: 0.9, auc_amd: 0.89, random: 0.5 },
  { fpr: 0.6, auc_dr: 0.95, auc_glaucoma: 0.92, auc_amd: 0.92, random: 0.6 },
  { fpr: 0.7, auc_dr: 0.97, auc_glaucoma: 0.94, auc_amd: 0.94, random: 0.7 },
  { fpr: 0.8, auc_dr: 0.98, auc_glaucoma: 0.96, auc_amd: 0.95, random: 0.8 },
  { fpr: 0.9, auc_dr: 0.99, auc_glaucoma: 0.98, auc_amd: 0.96, random: 0.9 },
  { fpr: 1.0, auc_dr: 1.0, auc_glaucoma: 1.0, auc_amd: 1.0, random: 1.0 },
];

const EyeAiPage: React.FC = () => {
  const [tab, setTab] = useState("diagnoses");
  const bp = useBreakpoint();
  const isNarrow = bp === "xs" || bp === "sm";
  const pendingDiag = MOCK_AI_DIAGNOSES.filter(
    (d) => d.reviewStatus === "pending",
  );
  const acceptedDiag = MOCK_AI_DIAGNOSES.filter(
    (d) => d.reviewStatus !== "pending",
  );
  const totalDiag = MOCK_AI_DIAGNOSES.length;

  return (
    <PageContainer background="slate" maxWidth="full" padding={16} testId="eye-ai-page">
      <PageHeader
        title="AI 辅助诊断中心"
        icon={<Brain size={24} color="#8b5cf6" />}
        variant="inline"
        actions={
          <>
            <Tag color="purple">{totalDiag} 条诊断</Tag>
            <Tag color="warning">{pendingDiag.length} 待审核</Tag>
            <Tag color="green">{acceptedDiag.length} 已采纳</Tag>
          </>
        }
      />

      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="AI 模型数"
              value={MOCK_AI_MODELS.length}
              prefix={<Brain size={18} color="#8b5cf6" />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="已诊断检查"
              value={totalDiag}
              prefix={<Activity size={18} color="#1677ff" />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="阳性发现"
              value={
                MOCK_AI_DIAGNOSES.filter((d) => d.severity !== "none").length
              }
              prefix={<AlertTriangle size={18} color="#ef4444" />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="AI 采纳率"
              value="72.3"
              suffix="%"
              prefix={<CheckCircle size={18} color="#22c55e" />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={12}>
        <Col span={24}>
          <Tabs
            activeKey={tab}
            onChange={setTab}
            tabBarExtraContent={
              <Space size={6} wrap>
                <Badge
                  count={pendingDiag.length}
                  title={`待审核 ${pendingDiag.length}`}
                  style={{ backgroundColor: "#f59e0b" }}
                />
                <Tag color="purple">{totalDiag} 总</Tag>
              </Space>
            }
            items={[
              {
                key: "diagnoses",
                label: `诊断列表 (${totalDiag})`,
                children: (
                  <Row gutter={12}>
                    <Col span={12}>
                      <Card
                        size="small"
                        title={
                          <>
                            <Clock size={14} /> 待审核诊断 ({pendingDiag.length}
                            )
                          </>
                        }
                      >
                        {pendingDiag.length === 0 ? (
                          <AppEmpty
                            variant="no-data"
                            description="全部已审核"
                            minHeight={isNarrow ? 120 : 160}
                          />
                        ) : (
                          pendingDiag.map((d) => (
                            <AiDiagnosisCard key={d.id} diagnosis={d} />
                          ))
                        )}
                      </Card>
                    </Col>
                    <Col span={12}>
                      <Card
                        size="small"
                        title={
                          <>
                            <CheckCircle size={14} /> 已审核诊断
                          </>
                        }
                      >
                        {acceptedDiag.map((d) => (
                          <AiDiagnosisCard key={d.id} diagnosis={d} />
                        ))}
                      </Card>
                    </Col>
                  </Row>
                ),
              },
              {
                key: "models",
                label: "AI 模型管理 (6)",
                children: (
                  <Table
                    dataSource={MOCK_AI_MODELS}
                    rowKey="id"
                    size="small"
                    pagination={false}
                    columns={[
                      {
                        title: "模型名称",
                        dataIndex: "name",
                        key: "name",
                        width: 140,
                      },
                      {
                        title: "厂商",
                        dataIndex: "vendor",
                        key: "vendor",
                        width: 100,
                        render: (v: string) => <Tag>{MODALITY_LABELS[v] || v}</Tag>,
                      },
                      {
                        title: "诊断病种",
                        dataIndex: "conditions",
                        key: "conditions",
                        width: 200,
                        render: (v: string[]) =>
                          v.map((c) => (
                            <Tag key={c} style={{ fontSize: 12 }}>
                              {c}
                            </Tag>
                          )),
                      },
                      {
                        title: "准确率",
                        dataIndex: "accuracy",
                        key: "accuracy",
                        width: 80,
                        render: (v: number) => (
                          <Progress
                            percent={Math.round(v * 100)}
                            size="small"
                            style={{ margin: 0 }}
                          />
                        ),
                      },
                      {
                        title: "敏感度",
                        dataIndex: "sensitivity",
                        key: "sensitivity",
                        width: 70,
                        render: (v: number) => `${(v * 100).toFixed(1)}%`,
                      },
                      {
                        title: "特异度",
                        dataIndex: "specificity",
                        key: "specificity",
                        width: 70,
                        render: (v: number) => `${(v * 100).toFixed(1)}%`,
                      },
                      {
                        title: "审批",
                        key: "approval",
                        width: 80,
                        render: () => (
                          <Space size={4}>
                            {["NMPA", "CE"].map((a) => (
                              <Tag key={a} color="green">
                                {a}
                              </Tag>
                            ))}
                          </Space>
                        ),
                      },
                    ]}
                  />
                ),
              },
              {
                key: "stats",
                label: "AI 统计",
                children: (
                  <Row gutter={12}>
                    <Col span={8}>
                      <Card size="small" title="各病种AI诊断分布">
                        <Table
                          size="small"
                          pagination={false}
                          dataSource={[
                            "糖尿病视网膜病变",
                            "青光眼",
                            "AMD",
                            "黄斑水肿",
                            "高度近视",
                          ].map((c, i) => ({
                            condition: c,
                            count: [8, 4, 6, 3, 2][i],
                          }))}
                          rowKey="condition"
                          columns={[
                            { title: "病种", dataIndex: "condition" },
                            { title: "诊断数", dataIndex: "count" },
                          ]}
                        />
                      </Card>
                    </Col>
                    <Col span={8}>
                      <Card size="small" title="AI 采纳率趋势">
                        <div style={{ height: 180 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={ACCEPTANCE_TREND_DATA}
                              margin={{ top: 8, right: 12, bottom: 0, left: -10 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                              <XAxis
                                dataKey="day"
                                tick={{ fontSize: 11, fill: "#64748b" }}
                                stroke="#cbd5e1"
                              />
                              <YAxis
                                tick={{ fontSize: 11, fill: "#64748b" }}
                                stroke="#cbd5e1"
                                domain={[40, 100]}
                                tickFormatter={(v: number) => `${v}%`}
                              />
                              <Tooltip
                                contentStyle={{
                                  fontSize: 12,
                                  borderRadius: 6,
                                  border: "1px solid #e2e8f0",
                                }}
                                formatter={(v: number) => [`${v}%`, "采纳率"]}
                              />
                              <Line
                                type="monotone"
                                dataKey="rate"
                                name="采纳率"
                                stroke="#8b5cf6"
                                strokeWidth={2}
                                dot={{ r: 3, fill: "#8b5cf6" }}
                                activeDot={{ r: 5 }}
                              />
                              <Line
                                type="monotone"
                                dataKey="target"
                                name="目标"
                                stroke="#94a3b8"
                                strokeDasharray="4 4"
                                strokeWidth={1.5}
                                dot={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </Card>
                    </Col>
                    <Col span={8}>
                      <Card size="small" title="模型表现对比 (ROC)">
                        <div style={{ height: 180 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={ROC_CURVE_DATA}
                              margin={{ top: 8, right: 12, bottom: 0, left: -10 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                              <XAxis
                                dataKey="fpr"
                                tick={{ fontSize: 11, fill: "#64748b" }}
                                stroke="#cbd5e1"
                                domain={[0, 1]}
                                tickFormatter={(v: number) => v.toFixed(1)}
                              />
                              <YAxis
                                tick={{ fontSize: 11, fill: "#64748b" }}
                                stroke="#cbd5e1"
                                domain={[0, 1]}
                                tickFormatter={(v: number) => v.toFixed(1)}
                              />
                              <Tooltip
                                contentStyle={{
                                  fontSize: 12,
                                  borderRadius: 6,
                                  border: "1px solid #e2e8f0",
                                }}
                              />
                              <Legend wrapperStyle={{ fontSize: 11 }} />
                              <Line
                                type="monotone"
                                dataKey="auc_dr"
                                name="DR 分级"
                                stroke="#1677ff"
                                strokeWidth={2}
                                dot={false}
                              />
                              <Line
                                type="monotone"
                                dataKey="auc_glaucoma"
                                name="青光眼"
                                stroke="#10b981"
                                strokeWidth={2}
                                dot={false}
                              />
                              <Line
                                type="monotone"
                                dataKey="auc_amd"
                                name="AMD"
                                stroke="#f59e0b"
                                strokeWidth={2}
                                dot={false}
                              />
                              <Line
                                type="monotone"
                                dataKey="random"
                                name="随机"
                                stroke="#94a3b8"
                                strokeDasharray="4 4"
                                strokeWidth={1}
                                dot={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </Card>
                    </Col>
                  </Row>
                ),
              },
            ]}
          />
        </Col>
      </Row>
    </PageContainer>
  );
};
export default EyeAiPage;
