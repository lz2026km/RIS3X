// [v3.0.6.8-44] PR 11: 视光中心闭环 (OK 镜/角膜塑形/离焦/复查)
// [v3.0.6.11-99 Wave1A 17] 裸 fetch → eyeApi.optometry* (后端真实 /eye/optometry/*, MSW 仅 dev 兜底)
// 对标: 视光中心 (近视防控闭环)
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
  Database,
  Search,
  FileText,
} from "lucide-react";
import { Inbox } from 'lucide-react'
import React, { useState, useEffect } from "react";
import { usePagination } from "../../../hooks/usePagination";
import { eyeApi } from "../../../services/api/eyeApi";
import { t } from "../../../i18n/appI18n";

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
  // [G005 2B] 受控分页: 屈光发育历史 (数据可增长)
  const { pageData: curveHistory, pagination: curveHistoryPagination } = usePagination(refractionCurve?.history ?? [], 10);

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
        const res = await eyeApi.getOptometryStats();
        if (res.success) setStats(res.data);
      } catch (e) {
        console.warn("[F03] Error:", (e as Error)?.message);
      }
    })();
  }, []);

  // 筛查
  const handleScreening = async () => {
    try {
      const res = await eyeApi.optometryScreening({
        patientId,
        age,
        parentRefraction: {
          reSphere: parentReSphere,
          leSphere: parentLeSphere,
        },
      });
      if (res.success) {
        setScreening(res.data);
        message.success("筛查完成");
      }
    } catch (e: any) {
      message.error(e.message);
    }
  };

  // 屈光发育曲线
  const handleRefractionCurve = async () => {
    try {
      const res = await eyeApi.getRefractionCurve(patientId);
      if (res.success) {
        setRefractionCurve(res.data);
        message.success("屈光发育数据加载");
      }
    } catch (e: any) {
      message.error(e.message);
    }
  };

  // OK 镜试戴
  const handleOkTrial = async () => {
    try {
      const res = await eyeApi.okTrial({ patientId, trialLensId, fluoresceinPattern });
      if (res.success) {
        setOkTrial(res.data);
        message.success("试戴评估完成");
      }
    } catch (e: any) {
      message.error(e.message);
    }
  };

  // OK 镜订单
  const handleOrthoOrder = async () => {
    try {
      const res = await eyeApi.orthoKOrder({
        patientId,
        design: {
          baseCurve: 7.8,
          returnZoneDepth: 0.55,
          landingZoneAngle: 33,
          diameter: 10.6,
          brand: "Euclid Emerald",
        },
        prescriptionId: "PRES001",
      });
      if (res.success) {
        setOrthoOrder(res.data);
        message.success("OK 镜订单已生成");
      }
    } catch (e: any) {
      message.error(e.message);
    }
  };

  // 离焦镜订单
  const handleDefocusOrder = async () => {
    try {
      const res = await eyeApi.defocusOrder({
        patientId,
        frameSelection: "Ray-Ban Junior",
        lensType,
      });
      if (res.success) {
        setDefocusOrder(res.data);
        message.success("离焦镜订单已生成");
      }
    } catch (e: any) {
      message.error(e.message);
    }
  };

  // [v3.0.6.11-103 Wave 3A] 验光档案 (refraction / ok-lens / vision-record / orders)
  const [refractionRecords, setRefractionRecords] = useState<any[]>([]);
  const [okLensRecords, setOkLensRecords] = useState<any[]>([]);
  const [visionSeq, setVisionSeq] = useState<any>(null);
  const [orderId, setOrderId] = useState("OKO-SEED-001");
  const [orderDetail, setOrderDetail] = useState<any>(null);
  // 创建验光记录表单
  const [refReSphere, setRefReSphere] = useState(-2.0);
  const [refReCylinder, setRefReCylinder] = useState(-0.5);
  const [refReAxis, setRefReAxis] = useState(180);
  const [refLeSphere, setRefLeSphere] = useState(-2.25);
  const [refLeCylinder, setRefLeCylinder] = useState(-0.75);
  const [refLeAxis, setRefLeAxis] = useState(175);

  const loadOptometryRecords = async () => {
    try {
      const [refRes, okRes, vRes] = await Promise.all([
        eyeApi.listRefractionRecords({ patientId }),
        eyeApi.listOkLens({ patientId }),
        eyeApi.getOptometryVisionRecord(patientId),
      ]);
      if (refRes.success) {
        const list = Array.isArray((refRes.data as any)?.data)
          ? (refRes.data as any).data
          : Array.isArray(refRes.data)
            ? refRes.data
            : [];
        setRefractionRecords(list);
      }
      if (okRes.success) {
        const list = Array.isArray((okRes.data as any)?.data)
          ? (okRes.data as any).data
          : Array.isArray(okRes.data)
            ? okRes.data
            : [];
        setOkLensRecords(list);
      }
      if (vRes.success) setVisionSeq(vRes.data);
    } catch (e) {
      console.warn("[F03] loadOptometryRecords Error:", (e as Error)?.message);
    }
  };

  useEffect(() => {
    void loadOptometryRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateRefraction = async () => {
    try {
      const res = await eyeApi.createRefractionRecord({
        patientId,
        reSphere: refReSphere,
        reCylinder: refReCylinder,
        reAxis: refReAxis,
        leSphere: refLeSphere,
        leCylinder: refLeCylinder,
        leAxis: refLeAxis,
        prescriptionType: "眼镜",
      });
      if (res.success) {
        message.success("验光处方已保存");
        void loadOptometryRecords();
      }
    } catch (e: any) {
      message.error(e.message);
    }
  };

  const handleOrderDetail = async () => {
    if (!orderId.trim()) return;
    try {
      const res = await eyeApi.getOptometryOrder(orderId.trim());
      if (res.success) {
        setOrderDetail(res.data);
        message.success("订单详情已加载");
      }
    } catch (e: any) {
      setOrderDetail(null);
      message.error((e as Error)?.message ?? "订单不存在");
    }
  };

  const { pageData: refPage, pagination: refPagination } = usePagination(refractionRecords, 6);
  const { pageData: okLensPage, pagination: okLensPagination } = usePagination(okLensRecords, 6);

  return (
    <div style={{ padding: 24, background: "var(--bg-card)", minHeight: "100vh" }}>
      <Space style={{ marginBottom: 16 }}>
        <Heart size={20} color="#f5222d" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>
          视光中心闭环 (近视防控)
        </span>
        <Tag color="cyan">PR11</Tag>
        <Tag color="purple">v3.0.6.8-44</Tag>
        <Tag color="blue">OK 镜 / 离焦镜 / 阿托品</Tag>
        {/* [G005 Wave1B] /eye/optometry/* 后端真实 (eye-optometry 模块), eyeApi 封装 */}
        <Tag color="green">真实后端 /eye/optometry/*</Tag>
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
                          color: "var(--text-secondary)",
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
                              color: "var(--text-secondary)",
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
                      <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="点击开始筛查" />
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
                        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
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
                          dataSource={curveHistory}
                          rowKey="date"
                          pagination={curveHistoryPagination}
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
                  <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="点击刷新数据" />
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
                        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
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

          // [v3.0.6.11-103 Wave 3A] 验光档案: 屈光记录/OK镜档案/视力序列/订单详情
          {
            key: "records",
            label: (
              <span>
                <Database size={14} /> {t("eye.optometry.records")}
              </span>
            ),
            children: (
              <Row gutter={16}>
                <Col span={10}>
                  <Card
                    title={t("eye.optometry.createRefraction")}
                    size="small"
                    extra={
                      <Button
                        icon={<RefreshCw size={12} />}
                        onClick={() => void loadOptometryRecords()}
                      >
                        {t("eye.common.refresh")}
                      </Button>
                    }
                  >
                    <Form layout="vertical" size="small">
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--text-secondary)",
                          marginBottom: 8,
                          fontWeight: 600,
                        }}
                      >
                        OD 右眼
                      </div>
                      <Row gutter={8}>
                        <Col span={8}>
                          <Form.Item label="球镜 (DS)">
                            <InputNumber value={refReSphere} onChange={(v) => setRefReSphere(v || 0)} step={0.25} style={{ width: "100%" }} />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item label="柱镜 (DC)">
                            <InputNumber value={refReCylinder} onChange={(v) => setRefReCylinder(v || 0)} step={0.25} style={{ width: "100%" }} />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item label="轴位 (°)">
                            <InputNumber value={refReAxis} onChange={(v) => setRefReAxis(v || 0)} min={0} max={180} style={{ width: "100%" }} />
                          </Form.Item>
                        </Col>
                      </Row>
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--text-secondary)",
                          marginBottom: 8,
                          fontWeight: 600,
                        }}
                      >
                        OS 左眼
                      </div>
                      <Row gutter={8}>
                        <Col span={8}>
                          <Form.Item label="球镜 (DS)">
                            <InputNumber value={refLeSphere} onChange={(v) => setRefLeSphere(v || 0)} step={0.25} style={{ width: "100%" }} />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item label="柱镜 (DC)">
                            <InputNumber value={refLeCylinder} onChange={(v) => setRefLeCylinder(v || 0)} step={0.25} style={{ width: "100%" }} />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item label="轴位 (°)">
                            <InputNumber value={refLeAxis} onChange={(v) => setRefLeAxis(v || 0)} min={0} max={180} style={{ width: "100%" }} />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Button
                        type="primary"
                        block
                        icon={<Save size={14} />}
                        onClick={handleCreateRefraction}
                      >
                        {t("eye.optometry.saveRefraction")}
                      </Button>
                    </Form>
                  </Card>

                  <Card
                    title={t("eye.optometry.orderDetail")}
                    size="small"
                    style={{ marginTop: 16 }}
                  >
                    <Space.Compact style={{ width: "100%" }}>
                      <Input
                        prefix={<Search size={12} />}
                        placeholder="订单 ID"
                        value={orderId}
                        onChange={(e) => setOrderId(e.target.value)}
                      />
                      <Button type="primary" onClick={handleOrderDetail}>
                        {t("eye.common.search")}
                      </Button>
                    </Space.Compact>
                    {orderDetail && (
                      <div style={{ marginTop: 12, fontSize: 12 }}>
                        <Tag color={orderDetail.type === "ortho-k" ? "blue" : "purple"}>
                          {orderDetail.type === "ortho-k" ? "OK 镜订单" : "离焦镜订单"}
                        </Tag>
                        <div>品牌: {orderDetail.brand}</div>
                        <div>患者: {orderDetail.patientName ?? orderDetail.patientId}</div>
                        <div>预计到货: {orderDetail.estimatedDelivery}</div>
                        <div>成本: ¥{orderDetail.cost?.total}</div>
                        {orderDetail.lensType && <div>镜片: {orderDetail.lensType}</div>}
                        {orderDetail.parameters?.baseCurve && (
                          <div>基弧 (BC): {orderDetail.parameters.baseCurve} mm</div>
                        )}
                        <Divider style={{ margin: "4px 0" }} />
                        <div style={{ color: "var(--text-secondary)" }}>
                          {orderDetail.followupSchedule
                            ? `随访计划: ${orderDetail.followupSchedule.join(" / ")}`
                            : `订购于 ${String(orderDetail.orderedAt ?? "").slice(0, 19).replace("T", " ")}`}
                        </div>
                      </div>
                    )}
                  </Card>
                </Col>

                <Col span={14}>
                  <Card
                    title={t("eye.optometry.refractionList")}
                    size="small"
                    extra={<Tag color="blue">{refractionRecords.length}</Tag>}
                    style={{ marginBottom: 16 }}
                  >
                    <Table
                      size="small"
                      rowKey={(r: any) => r.refractionId ?? r.id}
                      dataSource={refPage}
                      pagination={refPagination}
                      columns={[
                        { title: "日期", dataIndex: "prescribedAt", render: (v: string) => String(v ?? "").slice(0, 10) },
                        { title: "患者", dataIndex: "patientName" },
                        {
                          title: "OD",
                          render: (_, r: any) =>
                            `${r.rightEye?.sphere} S / ${r.rightEye?.cylinder} C ×${r.rightEye?.axis}`,
                        },
                        {
                          title: "OS",
                          render: (_, r: any) =>
                            `${r.leftEye?.sphere} S / ${r.leftEye?.cylinder} C ×${r.leftEye?.axis}`,
                        },
                        { title: "类型", dataIndex: "prescriptionType", render: (v: string) => <Tag>{v}</Tag> },
                      ]}
                      scroll={{ x: "max-content" }}
                    />
                  </Card>

                  <Card
                    title={t("eye.optometry.okLensList")}
                    size="small"
                    extra={<Tag color="blue">{okLensRecords.length}</Tag>}
                    style={{ marginBottom: 16 }}
                  >
                    <Table
                      size="small"
                      rowKey={(r: any) => r.okLensId ?? r.id}
                      dataSource={okLensPage}
                      pagination={okLensPagination}
                      columns={[
                        { title: "日期", dataIndex: "prescribedAt", render: (v: string) => String(v ?? "").slice(0, 10) },
                        { title: "患者", dataIndex: "patientName" },
                        { title: "BC (mm)", render: (_, r: any) => r.design?.baseCurve },
                        { title: "目标减少 (D)", render: (_, r: any) => r.design?.targetReduction },
                        { title: "品牌", render: (_, r: any) => r.design?.brand },
                      ]}
                      scroll={{ x: "max-content" }}
                    />
                  </Card>

                  <Card
                    title={t("eye.optometry.visionSeq")}
                    size="small"
                    extra={
                      <Button icon={<RefreshCw size={12} />} onClick={() => void loadOptometryRecords()}>
                        {t("eye.common.refresh")}
                      </Button>
                    }
                  >
                    {visionSeq?.history?.length ? (
                      <Table
                        size="small"
                        rowKey="date"
                        dataSource={visionSeq.history}
                        pagination={false}
                        columns={[
                          { title: "日期", dataIndex: "date" },
                          { title: "OD (DS)", render: (_, r: any) => r.rightEye?.sphere },
                          { title: "OD 散光", render: (_, r: any) => `${r.rightEye?.cylinder} C ×${r.rightEye?.axis}` },
                          { title: "OS (DS)", render: (_, r: any) => r.leftEye?.sphere },
                          { title: "OS 散光", render: (_, r: any) => `${r.leftEye?.cylinder} C ×${r.leftEye?.axis}` },
                        ]}
                        scroll={{ x: "max-content" }}
                      />
                    ) : (
                      <Empty
                        image={<Inbox size={48} style={{ opacity: 0.4 }} />}
                        description={`${t("eye.optometry.visionSeq")}: ${t("eye.common.noData")}`}
                      />
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
