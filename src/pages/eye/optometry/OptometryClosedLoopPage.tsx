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
} from "lucide-react";
import { Inbox } from 'lucide-react'
import React, { useState, useEffect } from "react";
import { usePagination } from "../../../hooks/usePagination";
import { eyeApi } from "../../../services/api/eyeApi";
import { LoadingBanner, ErrorBanner } from "../../../components/feedback";
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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 加载统计
  useEffect(() => {
    (async () => {
      try {
        const res = await eyeApi.getOptometryStats();
        if (res.success) setStats(res.data);
        else setLoadError(t('w9.states.error'));
      } catch (e) {
        console.warn("[F03] Error:", (e as Error)?.message);
        setLoadError(t('w9.states.error'));
      } finally {
        setLoading(false);
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
        message.success(t("eye.optometry.screeningDone"));
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
        message.success(t("eye.optometry.curveLoaded"));
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
        message.success(t("eye.optometry.trialDone"));
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
        message.success(t("eye.optometry.orthoOrderCreated"));
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
        message.success(t("eye.optometry.defocusOrderCreated"));
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
        message.success(t("eye.optometry.refractionSaved"));
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
        message.success(t("eye.optometry.orderDetailLoaded"));
      }
    } catch (e: any) {
      setOrderDetail(null);
      message.error((e as Error)?.message ?? t("eye.optometry.orderNotFound"));
    }
  };

  const { pageData: refPage, pagination: refPagination } = usePagination(refractionRecords, 6);
  const { pageData: okLensPage, pagination: okLensPagination } = usePagination(okLensRecords, 6);

  return (
    <div style={{ padding: 24, background: "var(--bg-card)", minHeight: "100vh" }}>
      <Space style={{ marginBottom: 16 }}>
        <Heart size={20} color="#f5222d" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>
          {t("eye.optometry.title")}
        </span>
        <Tag color="cyan">PR11</Tag>
        <Tag color="purple">v3.0.6.8-44</Tag>
        <Tag color="blue">{t("eye.optometry.tagProducts")}</Tag>
        {/* [G005 Wave1B] /eye/optometry/* 后端真实 (eye-optometry 模块), eyeApi 封装 */}
        <Tag color="green">{t("eye.optometry.realBackend")}</Tag>
      </Space>

      {loading && <LoadingBanner message={t('w9.states.loading')} />}
      {loadError && !loading && <ErrorBanner message={loadError} />}

      {stats && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card size="small">
              <Statistic title={t("eye.optometry.totalPatients")} value={stats.totalPatients} />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title={t("eye.optometry.okLensPatients")}
                value={stats.okLensPatients}
                styles={{ content: {  color: "#2563eb"  } }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title={t("eye.optometry.defocusLensPatients")}
                value={stats.defocusLensPatients}
                styles={{ content: {  color: "#722ed1"  } }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title={t("eye.optometry.progressionRate")}
                value={stats.progressionRate}
                suffix={t("eye.optometry.perYearD")}
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
                <Activity size={14} /> {t("eye.optometry.tabScreening")}
              </span>
            ),
            children: (
              <Row gutter={16}>
                <Col span={10}>
                  <Card title={t("eye.optometry.screeningParams")} size="small">
                    <Form layout="vertical" size="small">
                      <Form.Item label={t("eye.optometry.patientId")}>
                        <Input
                          value={patientId}
                          onChange={(e) => setPatientId(e.target.value)}
                        />
                      </Form.Item>
                      <Form.Item label={t("eye.optometry.ageYears")}>
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
                        {t("eye.optometry.parentRefraction")}
                      </div>
                      <Row gutter={8}>
                        <Col span={12}>
                          <Form.Item label={t("eye.optometry.fatherRe")}>
                            <InputNumber
                              value={parentReSphere}
                              onChange={(v) => setParentReSphere(v || 0)}
                              step={0.5}
                              style={{ width: "100%" }}
                            />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item label={t("eye.optometry.fatherLe")}>
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
                        {t("eye.optometry.startScreening")}
                      </Button>
                    </Form>
                  </Card>
                </Col>
                <Col span={14}>
                  <Card title={t("eye.optometry.screeningResult")} size="small">
                    {screening ? (
                      <Row gutter={[16, 16]}>
                        <Col span={8}>
                          <Statistic
                            title={t("eye.optometry.myopiaRisk")}
                            value={
                              screening.myopiaRisk === "high"
                                ? t("eye.optometry.riskHigh")
                                : screening.myopiaRisk === "medium"
                                  ? t("eye.optometry.riskMedium")
                                  : t("eye.optometry.riskLow")
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
                            title={t("eye.optometry.ageRisk")}
                            value={
                              screening.ageRisk === "high"
                                ? t("eye.optometry.riskHigh")
                                : screening.ageRisk === "medium"
                                  ? t("eye.optometry.riskMedium")
                                  : t("eye.optometry.riskLow")
                            }
                          />
                        </Col>
                        <Col span={8}>
                          <Statistic
                            title={t("eye.optometry.hereditaryRisk")}
                            value={
                              screening.parentRisk === "high" ? t("eye.optometry.riskHigh") : t("eye.optometry.riskLow")
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
                            {t("eye.optometry.recommendation")}
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
                      <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t("eye.optometry.clickToScreen")} />
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
                <TrendingUp size={14} /> {t("eye.optometry.tabCurve")}
              </span>
            ),
            children: (
              <Card
                title={t("eye.optometry.curveTitle")}
                size="small"
                extra={
                  <Button
                    icon={<RefreshCw size={12} />}
                    onClick={handleRefractionCurve}
                  >
                    {t("eye.optometry.refreshData")}
                  </Button>
                }
              >
                {refractionCurve ? (
                  <>
                    <Row gutter={[16, 16]}>
                      <Col span={8}>
                        <Statistic
                          title={t("eye.optometry.progressionRate")}
                          value={refractionCurve.progression.rate}
                          suffix={t("eye.optometry.perYearD")}
                        />
                      </Col>
                      <Col span={8}>
                        <Statistic
                          title={t("eye.optometry.axialGrowth")}
                          value={refractionCurve.axialGrowth.rate}
                          suffix={t("eye.optometry.perYearMm")}
                        />
                      </Col>
                      <Col span={8}>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                          {t("eye.optometry.interventionEffect")}
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
                            { title: t("eye.optometry.colDate"), dataIndex: "date" },
                            { title: t("eye.optometry.colAge"), dataIndex: "age" },
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
                            { title: t("eye.optometry.colIntervention"), dataIndex: "intervention" },
                          ]}
                        scroll={{ x: 'max-content' }}
                        />
                      </Col>
                    </Row>
                  </>
                ) : (
                  <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t("eye.optometry.clickToRefresh")} />
                )}
              </Card>
            ),
          },

          {
            key: "ok",
            label: (
              <span>
                <GraduationCap size={14} /> {t("eye.optometry.tabOkLens")}
              </span>
            ),
            children: (
              <Row gutter={16}>
                <Col span={12}>
                  <Card title={t("eye.optometry.okTrialTitle")} size="small">
                    <Form layout="vertical" size="small">
                      <Form.Item label={t("eye.optometry.trialLensId")}>
                        <Input
                          value={trialLensId}
                          onChange={(e) => setTrialLensId(e.target.value)}
                        />
                      </Form.Item>
                      <Form.Item label={t("eye.optometry.fluoresceinPattern")}>
                        <Select
                          value={fluoresceinPattern}
                          onChange={setFluoresceinPattern as any}
                          options={[
                            {
                              value: "bulls-eye",
                              label: t("eye.optometry.patternBullsEye"),
                            },
                            {
                              value: "central-pool",
                              label: t("eye.optometry.patternCentralPool"),
                            },
                            {
                              value: "edge-lift",
                              label: t("eye.optometry.patternEdgeLift"),
                            },
                          ]}
                        />
                      </Form.Item>
                      <Space>
                        <Button
                          icon={<Save size={12} />}
                          onClick={handleOkTrial}
                        >
                          {t("eye.optometry.evaluateTrial")}
                        </Button>
                        <Button
                          type="primary"
                          icon={<Plus size={12} />}
                          onClick={handleOrthoOrder}
                        >
                          {t("eye.optometry.generateOrthoOrder")}
                        </Button>
                      </Space>
                    </Form>
                    {okTrial && (
                      <Alert
                        title={`${t("eye.optometry.fit")}: ${okTrial.fit === "optimal" ? t("eye.optometry.fitOptimal") : okTrial.fit === "too-tight" ? t("eye.optometry.fitTooTight") : t("eye.optometry.fitTooLoose")}`}
                        description={okTrial.recommendation}
                        type={okTrial.fit === "optimal" ? "success" : "warning"}
                        showIcon
                        style={{ marginTop: 8 }}
                      />
                    )}
                    {orthoOrder && (
                      <Card
                        size="small"
                        title={t("eye.optometry.orthoOrder")}
                        style={{ marginTop: 8 }}
                      >
                        <div>{t("eye.optometry.brand")}: {orthoOrder.brand}</div>
                        <div>
                          {t("eye.optometry.baseCurve")}: {orthoOrder.parameters.baseCurve} mm
                        </div>
                        <div>{t("eye.optometry.cost")}: ¥{orthoOrder.cost.total}</div>
                        <div>{t("eye.optometry.estimatedDelivery")}: {orthoOrder.estimatedDelivery}</div>
                        <Divider style={{ margin: "4px 0" }} />
                        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                          {t("eye.optometry.followupSchedule")}: {orthoOrder.followupSchedule.join(" / ")}
                        </div>
                      </Card>
                    )}
                  </Card>
                </Col>

                <Col span={12}>
                  <Card title={t("eye.optometry.defocusLensTitle")} size="small">
                    <Form layout="vertical" size="small">
                      <Form.Item label={t("eye.optometry.lensType")}>
                        <Radio.Group
                          value={lensType}
                          onChange={(e) => setLensType(e.target.value)}
                        >
                          <Radio.Button value="DIMS">
                            {t("w9d.optometry.dims")}
                          </Radio.Button>
                          <Radio.Button value="MiSight">MiSight</Radio.Button>
                        </Radio.Group>
                      </Form.Item>
                      <Form.Item label={t("eye.optometry.frameSelection")}>
                        <Input defaultValue="Ray-Ban Junior" />
                      </Form.Item>
                      <Button
                        type="primary"
                        block
                        icon={<Plus size={14} />}
                        onClick={handleDefocusOrder}
                      >
                        {t("eye.optometry.generateDefocusOrder")}
                      </Button>
                    </Form>
                    {defocusOrder && (
                      <Card
                        size="small"
                        title={t("eye.optometry.defocusOrder")}
                        style={{ marginTop: 8 }}
                      >
                        <div>{t("eye.optometry.lens")}: {defocusOrder.brand}</div>
                        <div>{t("eye.optometry.efficacy")}: {defocusOrder.efficacy}</div>
                        <div>{t("eye.optometry.cost")}: ¥{defocusOrder.cost.total}</div>
                        <div>{t("eye.optometry.estimatedDelivery")}: {defocusOrder.estimatedDelivery}</div>
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
                        {t("eye.optometry.odRight")}
                      </div>
                      <Row gutter={8}>
                        <Col span={8}>
                          <Form.Item label={t("eye.optometry.sphereDs")}>
                            <InputNumber value={refReSphere} onChange={(v) => setRefReSphere(v || 0)} step={0.25} style={{ width: "100%" }} />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item label={t("eye.optometry.cylinderDc")}>
                            <InputNumber value={refReCylinder} onChange={(v) => setRefReCylinder(v || 0)} step={0.25} style={{ width: "100%" }} />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item label={t("eye.optometry.axisDeg")}>
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
                        {t("eye.optometry.osLeft")}
                      </div>
                      <Row gutter={8}>
                        <Col span={8}>
                          <Form.Item label={t("eye.optometry.sphereDs")}>
                            <InputNumber value={refLeSphere} onChange={(v) => setRefLeSphere(v || 0)} step={0.25} style={{ width: "100%" }} />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item label={t("eye.optometry.cylinderDc")}>
                            <InputNumber value={refLeCylinder} onChange={(v) => setRefLeCylinder(v || 0)} step={0.25} style={{ width: "100%" }} />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item label={t("eye.optometry.axisDeg")}>
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
                        placeholder={t("eye.optometry.orderIdPlaceholder")}
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
                          {orderDetail.type === "ortho-k" ? t("eye.optometry.orthoOrder") : t("eye.optometry.defocusOrder")}
                        </Tag>
                        <div>{t("eye.optometry.brand")}: {orderDetail.brand}</div>
                        <div>{t("eye.optometry.patient")}: {orderDetail.patientName ?? orderDetail.patientId}</div>
                        <div>{t("eye.optometry.estimatedDelivery")}: {orderDetail.estimatedDelivery}</div>
                        <div>{t("eye.optometry.cost")}: ¥{orderDetail.cost?.total}</div>
                        {orderDetail.lensType && <div>{t("eye.optometry.lens")}: {orderDetail.lensType}</div>}
                        {orderDetail.parameters?.baseCurve && (
                          <div>{t("eye.optometry.baseCurve")}: {orderDetail.parameters.baseCurve} mm</div>
                        )}
                        <Divider style={{ margin: "4px 0" }} />
                        <div style={{ color: "var(--text-secondary)" }}>
                          {orderDetail.followupSchedule
                            ? t("w9d.optometry.followupPlan", { plan: orderDetail.followupSchedule.join(" / ") })
                            : t("w9d.optometry.orderedAt", { time: String(orderDetail.orderedAt ?? "").slice(0, 19).replace("T", " ") })}
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
                        { title: t("eye.optometry.colDate"), dataIndex: "prescribedAt", render: (v: string) => String(v ?? "").slice(0, 10) },
                        { title: t("eye.optometry.colPatient"), dataIndex: "patientName" },
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
                        { title: t("eye.optometry.colType"), dataIndex: "prescriptionType", render: (v: string) => <Tag>{v}</Tag> },
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
                        { title: t("eye.optometry.colDate"), dataIndex: "prescribedAt", render: (v: string) => String(v ?? "").slice(0, 10) },
                        { title: t("eye.optometry.colPatient"), dataIndex: "patientName" },
                        { title: t("eye.optometry.colBc"), render: (_, r: any) => r.design?.baseCurve },
                        { title: t("eye.optometry.colTargetReduction"), render: (_, r: any) => r.design?.targetReduction },
                        { title: t("eye.optometry.colBrand"), render: (_, r: any) => r.design?.brand },
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
                          { title: t("eye.optometry.colDate"), dataIndex: "date" },
                          { title: "OD (DS)", render: (_, r: any) => r.rightEye?.sphere },
                          { title: t("eye.optometry.colOdAstigmatism"), render: (_, r: any) => `${r.rightEye?.cylinder} C ×${r.rightEye?.axis}` },
                          { title: "OS (DS)", render: (_, r: any) => r.leftEye?.sphere },
                          { title: t("eye.optometry.colOsAstigmatism"), render: (_, r: any) => `${r.leftEye?.cylinder} C ×${r.leftEye?.axis}` },
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
