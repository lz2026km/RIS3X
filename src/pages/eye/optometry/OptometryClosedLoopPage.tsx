// [v3.0.6.8-44] PR 11: 视光中心闭环 (OK ?角膜塑形?离焦?复查)
// 对标: 视光中心 (近视防控闭环)
import React, { useState, useEffect } from "react";
import {
  Card,
  Space,
  Tag,
  Button,
  Select,
  Input,
  Form,
  Row,
  Col,
  Divider,
  message,
  Tabs,
  Empty,
  Statistic,
  Alert,
  InputNumber,
  Radio,
  Table,
} from "antd";
import {
  Activity,
  TrendingUp,
  Save,
  RefreshCw,
  Plus,
  GraduationCap,
  Heart,
} from "lucide-react";

export const OptometryClosedLoopPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState("screening");
  // 筛查
  const [patientId, setPatientId] = useState("P000099");
  const [age, setAge] = useState(10);
  const [parentReSphere, setParentReSphere] = useState(-4.0);
  const [parentLeSphere, setParentLeSphere] = useState(-3.5);
  const [screening, setScreening] = useState<any>(null);

  // 屈光发育曲线
  const [refractionCurve, setRefractionCurve] = useState<any>(null);

  // OK 镜试?
  const [okTrial, setOkTrial] = useState<any>(null);
  const [trialLensId, setTrialLensId] = useState("TRIAL-A1");
  const [fluoresceinPattern, setFluoresceinPattern] = useState<
    "bulls-eye" | "central-pool" | "edge-lift"
  >("bulls-eye");

  // 订单
  const [orthoOrder, setOrthoOrder] = useState<any>(null);
  const [defocusOrder, setDefocusOrder] = useState<any>(null);
  const [lensType, setLensType] = useState<"DIMS" | "MiSight">("DIMS");

  // 统计
  const [stats, setStats] = useState<any>(null);

  // 加载统计
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/v1/eye/optometry/stats");
        const data = await r.json();
        if (data.success) setStats(data.data);
      } catch (e) {
        console.warn("[F03] Error:", (e as Error)?.message);
      }
    })();
  }, []);

  // 筛查
  const handleScreening = async () => {
    try {
      const r = await fetch("/api/v1/eye/optometry/screening", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          age,
          parentRefraction: {
            reSphere: parentReSphere,
            leSphere: parentLeSphere,
          },
        }),
      });
      const data = await r.json();
      if (data.success) {
        setScreening(data.data);
        message.success("筛查完成");
      }
    } catch (e: any) {
      message.error(e.message);
    }
  };

  // 屈光发育曲线
  const handleRefractionCurve = async () => {
    try {
      const r = await fetch(
        `/api/v1/eye/optometry/refraction-curve/${patientId}`,
      );
      const data = await r.json();
      if (data.success) {
        setRefractionCurve(data.data);
        message.success("屈光发育数据加载");
      }
    } catch (e: any) {
      message.error(e.message);
    }
  };

  // OK 镜试?
  const handleOkTrial = async () => {
    try {
      const r = await fetch("/api/v1/eye/optometry/ok-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, trialLensId, fluoresceinPattern }),
      });
      const data = await r.json();
      if (data.success) {
        setOkTrial(data.data);
        message.success("试戴评估完成");
      }
    } catch (e: any) {
      message.error(e.message);
    }
  };

  // OK 镜订?
  const handleOrthoOrder = async () => {
    try {
      const r = await fetch("/api/v1/eye/optometry/ortho-k-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          design: {
            baseCurve: 7.8,
            returnZoneDepth: 0.55,
            landingZoneAngle: 33,
            diameter: 10.6,
            brand: "Euclid Emerald",
          },
          prescriptionId: "PRES001",
        }),
      });
      const data = await r.json();
      if (data.success) {
        setOrthoOrder(data.data);
        message.success("OK 镜订单已生成");
      }
    } catch (e: any) {
      message.error(e.message);
    }
  };

  // 离焦镜订?
  const handleDefocusOrder = async () => {
    try {
      const r = await fetch("/api/v1/eye/optometry/defocus-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          frameSelection: "Ray-Ban Junior",
          lensType,
        }),
      });
      const data = await r.json();
      if (data.success) {
        setDefocusOrder(data.data);
        message.success("离焦镜订单已生成");
      }
    } catch (e: any) {
      message.error(e.message);
    }
  };

  return (
    <div style={{ padding: 24, background: "#f5f5f5", minHeight: "100vh" }}>
      <Space style={{ marginBottom: 16 }}>
        <Heart size={20} color="#f5222d" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>
          视光中心闭环 (近视防控)
        </span>
        <Tag color="cyan">PR11</Tag>
        <Tag color="purple">v3.0.6.8-44</Tag>
        <Tag color="blue">OK 镜 / 离焦镜 / 阿托品</Tag>
      </Space>

      {stats && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card size="small">
              <Statistic title="总患者" value={stats.totalPatients} />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="OK 镜患者"
                value={stats.okLensPatients}
                styles={{ content: {  color: "#2563eb"  } }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="离焦镜患者"
                value={stats.defocusLensPatients}
                styles={{ content: {  color: "#722ed1"  } }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="进展率"
                value={stats.progressionRate}
                suffix="D/年"
                styles={{ content: {  color: "#52c41a"  } }}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        items={[
          {
            key: "screening",
            label: (
              <span>
                <Activity size={14} /> 近视筛查
              </span>
            ),
            children: (
              <Row gutter={16}>
                <Col span={10}>
                  <Card title="筛查参数" size="small">
                    <Form layout="vertical" size="small">
                      <Form.Item label="患者ID">
                        <Input
                          value={patientId}
                          onChange={(e) => setPatientId(e.target.value)}
                        />
                      </Form.Item>
                      <Form.Item label="年龄 (岁)">
                        <InputNumber
                          value={age}
                          onChange={(v) => setAge(v || 10)}
                          min={3}
                          max={18}
                          style={{ width: "100%" }}
                        />
                      </Form.Item>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#666",
                          marginBottom: 8,
                          fontWeight: 600,
                        }}
                      >
                        父母屈光档案
                      </div>
                      <Row gutter={8}>
                        <Col span={12}>
                          <Form.Item label="父亲 RE (DS)">
                            <InputNumber
                              value={parentReSphere}
                              onChange={(v) => setParentReSphere(v || 0)}
                              step={0.5}
                              style={{ width: "100%" }}
                            />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item label="父亲 LE (DS)">
                            <InputNumber
                              value={parentLeSphere}
                              onChange={(v) => setParentLeSphere(v || 0)}
                              step={0.5}
                              style={{ width: "100%" }}
                            />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Button
                        type="primary"
                        block
                        icon={<Activity size={14} />}
                        onClick={handleScreening}
                      >
                        开始筛查
                      </Button>
                    </Form>
                  </Card>
                </Col>
                <Col span={14}>
                  <Card title="筛查结果" size="small">
                    {screening ? (
                      <Row gutter={[16, 16]}>
                        <Col span={8}>
                          <Statistic
                            title="近视风险"
                            value={
                              screening.myopiaRisk === "high"
                                ? "高"
                                : screening.myopiaRisk === "medium"
                                  ? "中"
                                  : "低"
                            }
                            styles={{ content: { 
                              color:
                                screening.myopiaRisk === "high"
                                  ? "#f5222d"
                                  : screening.myopiaRisk === "medium"
                                    ? "#faad14"
                                    : "#52c41a",
                             } }}
                          />
                        </Col>
                        <Col span={8}>
                          <Statistic
                            title="年龄风险"
                            value={
                              screening.ageRisk === "high"
                                ? "高"
                                : screening.ageRisk === "medium"
                                  ? "中"
                                  : "低"
                            }
                          />
                        </Col>
                        <Col span={8}>
                          <Statistic
                            title="遗传风险"
                            value={
                              screening.parentRisk === "high" ? "高" : "低"
                            }
                          />
                        </Col>
                        <Col span={24}>
                          <Divider style={{ margin: "4px 0" }} />
                          <div
                            style={{
                              fontSize: 12,
                              color: "#666",
                              marginBottom: 4,
                            }}
                          >
                            建议:
                          </div>
                          {screening.recommendations.map(
                            (r: string, i: number) => (
                              <Alert
                                key={i}
                                title={r}
                                type={
                                  screening.myopiaRisk === "high"
                                    ? "warning"
                                    : "info"
                                }
                                showIcon
                                style={{ marginBottom: 4 }}
                              />
                            ),
                          )}
                        </Col>
                      </Row>
                    ) : (
                      <Empty description="点击开始筛查" />
                    )}
                  </Card>
                </Col>
              </Row>
            ),
          },

          {
            key: "curve",
            label: (
              <span>
                <TrendingUp size={14} /> 屈光发育
              </span>
            ),
            children: (
              <Card
                title="屈光发育追踪 (5 年)"
                size="small"
                extra={
                  <Button
                    icon={<RefreshCw size={12} />}
                    onClick={handleRefractionCurve}
                  >
                    刷新数据
                  </Button>
                }
              >
                {refractionCurve ? (
                  <>
                    <Row gutter={[16, 16]}>
                      <Col span={8}>
                        <Statistic
                          title="进展率"
                          value={refractionCurve.progression.rate}
                          suffix="D/年"
                        />
                      </Col>
                      <Col span={8}>
                        <Statistic
                          title="眼轴增长"
                          value={refractionCurve.axialGrowth.rate}
                          suffix="mm/年"
                        />
                      </Col>
                      <Col span={8}>
                        <div style={{ fontSize: 12, color: "#666" }}>
                          干预效果
                        </div>
                        <div
                          style={{
                            color: "#52c41a",
                            fontSize: 14,
                            fontWeight: 600,
                          }}
                        >
                          {refractionCurve.interventionEffect}
                        </div>
                      </Col>
                      <Col span={24}>
                        <Divider style={{ margin: "4px 0" }} />
                        <Table
                          size="small"
                          dataSource={refractionCurve.history}
                          rowKey="date"
                          pagination={false}
                          columns={[
                            { title: "日期", dataIndex: "date" },
                            { title: "年龄", dataIndex: "age" },
                            {
                              title: "RE (DS)",
                              render: (_, r: any) =>
                                r.rightEye.sphere.toFixed(2),
                            },
                            {
                              title: "LE (DS)",
                              render: (_, r: any) =>
                                r.leftEye.sphere.toFixed(2),
                            },
                            {
                              title: "AL (mm)",
                              render: (_, r: any) => r.axialLength.toFixed(2),
                            },
                            { title: "干预", dataIndex: "intervention" },
                          ]}
                        scroll={{ x: 'max-content' }}
                        />
                      </Col>
                    </Row>
                  </>
                ) : (
                  <Empty description="点击刷新数据" />
                )}
              </Card>
            ),
          },

          {
            key: "ok",
            label: (
              <span>
                <GraduationCap size={14} /> OK 镜/离焦镜
              </span>
            ),
            children: (
              <Row gutter={16}>
                <Col span={12}>
                  <Card title="OK 镜试戴评估" size="small">
                    <Form layout="vertical" size="small">
                      <Form.Item label="试戴片ID">
                        <Input
                          value={trialLensId}
                          onChange={(e) => setTrialLensId(e.target.value)}
                        />
                      </Form.Item>
                      <Form.Item label="荧光素染色模式">
                        <Select
                          value={fluoresceinPattern}
                          onChange={setFluoresceinPattern as any}
                          options={[
                            {
                              value: "bulls-eye",
                              label: "牛眼 (Bulls-eye) - 理想",
                            },
                            {
                              value: "central-pool",
                              label: "中央池积液 (Central Pool) - 过紧",
                            },
                            {
                              value: "edge-lift",
                              label: "边缘翘起 (Edge Lift) - 过松",
                            },
                          ]}
                        />
                      </Form.Item>
                      <Space>
                        <Button
                          icon={<Save size={12} />}
                          onClick={handleOkTrial}
                        >
                          评估试戴
                        </Button>
                        <Button
                          type="primary"
                          icon={<Plus size={12} />}
                          onClick={handleOrthoOrder}
                        >
                          生成 OK 镜订单
                        </Button>
                      </Space>
                    </Form>
                    {okTrial && (
                      <Alert
                        title={`配适: ${okTrial.fit === "optimal" ? "理想" : okTrial.fit === "too-tight" ? "过紧" : "过松"}`}
                        description={okTrial.recommendation}
                        type={okTrial.fit === "optimal" ? "success" : "warning"}
                        showIcon
                        style={{ marginTop: 8 }}
                      />
                    )}
                    {orthoOrder && (
                      <Card
                        size="small"
                        title="OK 镜订单"
                        style={{ marginTop: 8 }}
                      >
                        <div>品牌: {orthoOrder.brand}</div>
                        <div>
                          基弧 (BC): {orthoOrder.parameters.baseCurve} mm
                        </div>
                        <div>成本: ¥{orthoOrder.cost.total}</div>
                        <div>预计到货: {orthoOrder.estimatedDelivery}</div>
                        <Divider style={{ margin: "4px 0" }} />
                        <div style={{ fontSize: 12, color: "#666" }}>
                          随访计划: {orthoOrder.followupSchedule.join(" / ")}
                        </div>
                      </Card>
                    )}
                  </Card>
                </Col>

                <Col span={12}>
                  <Card title="离焦镜 (DIMS/MiSight)" size="small">
                    <Form layout="vertical" size="small">
                      <Form.Item label="镜片类型">
                        <Radio.Group
                          value={lensType}
                          onChange={(e) => setLensType(e.target.value)}
                        >
                          <Radio.Button value="DIMS">
                            DIMS (新乐学)
                          </Radio.Button>
                          <Radio.Button value="MiSight">MiSight</Radio.Button>
                        </Radio.Group>
                      </Form.Item>
                      <Form.Item label="镜架选择">
                        <Input defaultValue="Ray-Ban Junior" />
                      </Form.Item>
                      <Button
                        type="primary"
                        block
                        icon={<Plus size={14} />}
                        onClick={handleDefocusOrder}
                      >
                        生成离焦镜订单
                      </Button>
                    </Form>
                    {defocusOrder && (
                      <Card
                        size="small"
                        title="离焦镜订单"
                        style={{ marginTop: 8 }}
                      >
                        <div>镜片: {defocusOrder.brand}</div>
                        <div>功效: {defocusOrder.efficacy}</div>
                        <div>成本: ¥{defocusOrder.cost.total}</div>
                        <div>预计到货: {defocusOrder.estimatedDelivery}</div>
                      </Card>
                    )}
                  </Card>
                </Col>
              </Row>
            ),
          },
        ]}
      />
    </div>
  );
};

export default OptometryClosedLoopPage;
