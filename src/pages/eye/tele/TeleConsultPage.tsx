// [v3.0.6.8-41] PR 8: 远程眼科 (WebRTC) + 视光中心闭环
// 对标: Topcon Harmony + Biotics3D 3Dnet Cloud + 视光中心 (OK?角膜塑形?
// [G005 Wave1B] 7 处裸 fetch → eyeApi (tele 走 MSW 兜底, optometry 走后端真实)
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
  Slider,
  Modal,
} from "antd";
import {
  Video,
  MonitorSmartphone,
  Globe,
  Sparkles,
  Activity,
  Phone,
  Mic,
  MicOff,
  VideoOff,
  Settings,
  Share2,
  Save,
  Send,
  Layers,
  FileText,
  ListTree,
  Database,
} from "lucide-react";
import { Inbox } from 'lucide-react'
import React, { useState, useEffect } from "react";
import { eyeApi } from "../../../services/api/eyeApi";
import { ErrorBanner } from "../../../components/feedback";
import { t } from "../../../i18n/appI18n";
import { DataTable } from "../../../components/common";
import { PageContainer } from "../../../components/common";

export const TeleConsultPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState("tele");
  // 远程会诊
  const [patientId, setPatientId] = useState("P000001");
  const [studyId, setStudyId] = useState("STU-20260620-00001");
  const [mode, setMode] = useState<"video" | "screen" | "data">("video");
  const [participants, setParticipants] = useState<string[]>(["D001", "D002"]);
  const [session, setSession] = useState<any>(null);
  const [turnInfo, setTurnInfo] = useState<any>(null);
  const [consult, setConsult] = useState<any>(null);
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [callActive, setCallActive] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    device: '内置摄像头 (HD)',
    mic: '内置麦克风',
    speaker: '默认扬声器',
    resolution: '1080p',
    autoRecord: false,
    enableNoiseCancellation: true,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // 视光中心
  const [reSphere, setReSphere] = useState(-2.5);
  const [reCylinder, setReCylinder] = useState(-0.75);
  const [reAxis, setReAxis] = useState(180);
  const [leSphere, setLeSphere] = useState(-2.75);
  const [leCylinder, setLeCylinder] = useState(-1.0);
  const [leAxis, setLeAxis] = useState(175);
  const [prescriptionType, setPrescriptionType] = useState("眼镜");
  const [refraction, setRefraction] = useState<any>(null);
  const [okLens, setOkLens] = useState<any>(null);
  const [targetReduction, setTargetReduction] = useState(3.0);

  // 视光中心 - 加载
  useEffect(() => {
    (async () => {
      try {
        const res = await eyeApi.getOptometryVisionRecord(patientId);
        if (res.success) {
          // set last record to form
          const data = res.data as any;
          const last = data.history[0];
          if (last) {
            setReSphere(last.rightEye.sphere);
            setReCylinder(last.rightEye.cylinder);
            setReAxis(last.rightEye.axis);
            setLeSphere(last.leftEye.sphere);
            setLeCylinder(last.leftEye.cylinder);
            setLeAxis(last.leftEye.axis);
          }
        }
      } catch (e) {
        console.warn("[F03] Error:", (e as Error)?.message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 远程会诊 - 加载 TURN
  useEffect(() => {
    (async () => {
      try {
        const res = await eyeApi.getTeleTurn();
        if (res.success) setTurnInfo(res.data);
      } catch (e) {
        console.warn("[F03] Error:", (e as Error)?.message);
      }
    })();
  }, []);

  // [G005 Wave10A] 远程会诊记录 (后端 /eye/tele/* 真实): 会话/意见/统计
  const [teleSessions, setTeleSessions] = useState<any[]>([]);
  const [teleConsults, setTeleConsults] = useState<any[]>([]);
  const [teleStats, setTeleStats] = useState<any>(null);
  // [v3.0.6.11-103 Wave 3A] 远程阅片: 流状态/会话详情/意见答复
  const [teleStreams, setTeleStreams] = useState<any[]>([]);
  const [detailSessionId, setDetailSessionId] = useState<string>("");
  const [sessionDetail, setSessionDetail] = useState<any>(null);
  const [detailConsultId, setDetailConsultId] = useState<string>("");
  const [consultDetail, setConsultDetail] = useState<any>(null);
  const [answerText, setAnswerText] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  useEffect(() => {
    (async () => {
      setLoadError(null);
      try {
        const [sRes, cRes, stRes, stmRes] = await Promise.all([
          eyeApi.listTeleSessions(),
          eyeApi.listTeleConsults(),
          eyeApi.getTeleStats(),
          eyeApi.listTeleStreams(),
        ]);
        if (sRes.success) setTeleSessions(sRes.data || []);
        if (cRes.success) setTeleConsults(cRes.data || []);
        if (stRes.success) setTeleStats(stRes.data);
        if (stmRes.success) setTeleStreams(stmRes.data || []);
        if (!sRes.success && !cRes.success && !stRes.success && !stmRes.success) setLoadError(t("w9.states.error"));
      } catch (e) {
        setLoadError(t("w9.states.error"));
        console.warn("[F03] tele list Error:", (e as Error)?.message);
      }
    })();
  }, [reloadTick]);

  // [v3.0.6.11-103 Wave 3A] 会话详情 / 结束会话
  const handleSessionDetail = async () => {
    if (!detailSessionId.trim()) return;
    try {
      const res = await eyeApi.getTeleSession(detailSessionId.trim());
      if (res.success) {
        setSessionDetail(res.data);
        message.success(t("eye.tele.sessionDetailLoaded"));
      }
    } catch (e: any) {
      setSessionDetail(null);
      message.error(e.message);
    }
  };

  const handleEndSession = async (sessionId: string) => {
    try {
      const res = await eyeApi.endTeleSession(sessionId);
      if (res.success) {
        message.success(`会话 ${res.data.sessionId} 已结束`);
        setSessionDetail(null);
        const sRes = await eyeApi.listTeleSessions();
        if (sRes.success) setTeleSessions(sRes.data || []);
      }
    } catch (e: any) {
      message.error(e.message);
    }
  };

  // [G005] 呼叫/挂断: 本地通话状态 + toast (会诊会话在线时可用)
  const handleCall = () => {
    if (!session) {
      message.warning(t("eye.tele.emptyLive"));
      return;
    }
    if (!callActive) {
      setCallActive(true);
      message.success(t("w1Buttons.tele.calling"));
    } else {
      setCallActive(false);
      message.info(t("w1Buttons.tele.callEnded"));
    }
  };

  // [v3.0.6.11-103 Wave 3A] 会诊记录详情 / 意见答复
  const handleConsultDetail = async () => {
    if (!detailConsultId.trim()) return;
    try {
      const res = await eyeApi.getTeleConsult(detailConsultId.trim());
      if (res.success) {
        setConsultDetail(res.data);
        setAnswerText("");
        message.success(t("eye.tele.consultLoaded"));
      }
    } catch (e: any) {
      setConsultDetail(null);
      message.error(e.message);
    }
  };

  const handleAnswerConsult = async () => {
    if (!answerText.trim()) {
      message.warning(t("eye.tele.answerRequired"));
      return;
    }
    try {
      const res = await eyeApi.answerTeleConsult(detailConsultId.trim(), {
        answer: answerText,
        reviewedBy: "D005",
      });
      if (res.success) {
        setConsultDetail(res.data);
        setAnswerText("");
        message.success(t("eye.tele.answerSubmitted"));
        const cRes = await eyeApi.listTeleConsults();
        if (cRes.success) setTeleConsults(cRes.data || []);
      }
    } catch (e: any) {
      message.error(e.message);
    }
  };

  // 创建会诊
  const handleCreateSession = async () => {
    try {
      const res = await eyeApi.createTeleSession({ patientId, studyId, participants, mode });
      if (res.success && res.data) {
        setSession(res.data);
        message.success(t("eye.tele.sessionCreated"));
      }
    } catch (e: any) {
      message.error(e.message);
    }
  };

  // 远程?
  const handleStream = async () => {
    try {
      const res = await eyeApi.createTeleStream({
        studyId,
        targetHospital: "PUMC-眼科",
        protocol: "dicom-tls",
      });
      if (res.success && res.data) {
        message.success(`远程流已建立: ${res.data.endpoint}`);
      }
    } catch (e: any) {
      message.error(e.message);
    }
  };

  // 会诊意见见
  const handleConsult = async () => {
    try {
      const res = await eyeApi.createTeleConsult({
        sessionId: session?.sessionId,
        specialistId: "D005",
        question: "请评估该眼底彩照DR 分级和AMD 风险",
      });
      if (res.success && res.data) {
        setConsult(res.data);
        message.success(t("eye.tele.consultSent"));
      }
    } catch (e: any) {
      message.error(e.message);
    }
  };

  // 验光
  const handleRefraction = async () => {
    try {
      const res = await eyeApi.createRefractionRecord({
        patientId,
        reSphere,
        reCylinder,
        reAxis,
        leSphere,
        leCylinder,
        leAxis,
        prescriptionType,
      });
      if (res.success) {
        setRefraction(res.data);
        message.success(t("eye.tele.refractionSaved"));
      }
    } catch (e: any) {
      message.error(e.message);
    }
  };

  // OK 镜
  const handleOkLens = async () => {
    try {
      const res = await eyeApi.createOkLens({
        patientId,
        k1: 43.0,
        k2: 43.5,
        kAxis: 180,
        targetReduction,
      });
      if (res.success) {
        setOkLens(res.data);
        message.success(t("eye.tele.okLensGenerated"));
      }
    } catch (e: any) {
      message.error(e.message);
    }
  };

  // 录像计时
  useEffect(() => {
    if (!recording) return undefined;
    const interval = setInterval(() => setRecordingTime((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, [recording]);

  return (
    <PageContainer maxWidth="full" padding="var(--space-6, 24px)" style={{ background: 'var(--bg-card)' }}>
      <Space style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Video size={20} />
        <span style={{ fontSize: 18, fontWeight: 600 }}>
          {t("eye.tele.title")}
        </span>
        <Tag color="cyan">PR8</Tag>
        <Tag color="purple">v3.0.6.8-41</Tag>
        <Tag color="blue">{t("eye.tele.tagWebrtc")}</Tag>
        <Tag color="green">{t("eye.tele.tagOkLens")}</Tag>
        {/* [v3.0.6.11-99 Wave1A 17] /eye/optometry/* 后端已实现 (验光/OK镜/视力档案); [G005 Wave10A] /eye/tele/* 后端真实 (桥接 tele 模块) */}
        <Tag color="green">{t("eye.tele.tagOptometryReal")}</Tag>
        <Tag color="green">{t("eye.tele.tagTeleReal")}</Tag>
        {/* [G005 Wave10A] 失败时回退标注: 后端不可达时操作会以 message.error 提示并保留现场 */}
        <Tag>{t("eye.tele.tagFallback")}</Tag>
      </Space>

      {loadError && <ErrorBanner message={loadError} onRetry={() => setReloadTick((n) => n + 1)} retryLabel={t("w9.states.retry")} />}

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        items={[
          {
            key: "tele",
            label: (
              <span>
                <Video size={14} /> {t("eye.tele.tabTele")}
              </span>
            ),
            children: (
              <Row gutter={16}>
                <Col span={10}>
                  <Card title={t("eye.tele.consultParams")} size="small">
                    <Form layout="vertical" size="small">
                      <Form.Item label={t("eye.tele.patientId")}>
                        <Input
                          value={patientId}
                          onChange={(e) => setPatientId(e.target.value)}
                        />
                      </Form.Item>
                      <Form.Item label={t("eye.tele.studyId")}>
                        <Input
                          value={studyId}
                          onChange={(e) => setStudyId(e.target.value)}
                        />
                      </Form.Item>
                      <Form.Item label={t("eye.tele.consultMode")}>
                        <Radio.Group
                          value={mode}
                          onChange={(e) => setMode(e.target.value)}
                        >
                          <Radio.Button value="video">
                            <Video size={12} /> {t("eye.tele.modeVideo")}
                          </Radio.Button>
                          <Radio.Button value="screen">
                            <MonitorSmartphone size={12} /> {t("eye.tele.modeScreen")}
                          </Radio.Button>
                          <Radio.Button value="data">
                            <Layers size={12} /> {t("eye.tele.modeData")}
                          </Radio.Button>
                        </Radio.Group>
                      </Form.Item>
                      <Form.Item label={t("eye.tele.participants")}>
                        <Select
                          mode="tags"
                          value={participants}
                          onChange={setParticipants}
                          options={[
                            { value: "D001", label: "D001 张主任" },
                            { value: "D002", label: "D002 王医生" },
                            { value: "D003", label: "D003 李医师" },
                            { value: "D005", label: "D005 孙会诊专家" },
                          ]}
                        />
                      </Form.Item>
                      <Space>
                        <Button
                          type="primary"
                          icon={<Video size={14} />}
                          onClick={handleCreateSession}
                        >
                          {t("eye.tele.createSession")}
                        </Button>
                        <Button
                          icon={<Share2 size={14} />}
                          onClick={handleStream}
                          disabled={!session}
                        >
                          {t("eye.tele.remoteStream")}
                        </Button>
                        <Button
                          icon={<Send size={14} />}
                          onClick={handleConsult}
                          disabled={!session}
                        >
                          {t("eye.tele.consultOpinion")}
                        </Button>
                      </Space>
                    </Form>
                  </Card>

                  {turnInfo && (
                    <Card
                      title={t("eye.tele.networkTitle")}
                      size="small"
                      style={{ marginTop: 'var(--space-4, 16px)' }}
                    >
                      <Row gutter={[8, 8]}>
                        <Col span={12}>
                          <Statistic
                            title={t("eye.tele.latencyP95")}
                            value={turnInfo.latency.p95}
                            suffix="ms"
                            styles={{ content: {  color: "#52c41a"  } }}
                          />
                        </Col>
                        <Col span={12}>
                          <Statistic
                            title={t("eye.tele.uplinkBandwidth")}
                            value={turnInfo.bandwidth.up}
                            suffix="Mbps"
                          />
                        </Col>
                        <Col span={24}>
                          <Alert
                            title={t("eye.tele.edgeSliceTitle")}
                            description={t('w9d.tele.edgeSliceDesc', { node: turnInfo && turnInfo["5G"] ? turnInfo["5G"].edgeNodeId : "N/A", slice: turnInfo && turnInfo["5G"] ? turnInfo["5G"].slice : "N/A" })}
                            type="success"
                            showIcon
                          />
                        </Col>
                      </Row>
                    </Card>
                  )}
                </Col>

                <Col span={14}>
                  <Card
                    title={
                      <Space>
                        <MonitorSmartphone size={16} color="var(--color-primary-600)" />
                        {t("eye.tele.liveView")}
                        {session && (
                          <Tag color="green">
                            {session.status === "active"
                              ? "LIVE"
                              : session.status}
                          </Tag>
                        )}
                      </Space>
                    }
                    size="small"
                  >
                    <div
                      style={{
                        width: "100%",
                        height: 320,
                        background: "#000",
                        borderRadius: 4,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "column",
                        color: "var(--text-secondary)",
                        position: "relative",
                      }}
                    >
                      {session ? (
                        <>
                          <Video
                            size={64}
                            color={videoOn ? "var(--color-primary-600)" : "#444"}
                          />
                          <div style={{ marginTop: 'var(--space-4, 16px)', fontSize: 14 }}>
                            {t("eye.tele.consultLabel")} {session.sessionId}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                            {t("eye.tele.patientLabel")}{session.patientId} | {session.mode} |{" "}
                            {session.participants.length} {t("eye.tele.participantsUnit")}
                          </div>
                        </>
                      ) : (
                        <>
                          <MonitorSmartphone size={64} color="var(--text-secondary)" />
                          <div style={{ marginTop: 'var(--space-4, 16px)', color: "var(--text-secondary)" }}>
                            {t("eye.tele.emptyLive")}
                          </div>
                        </>
                      )}
                      {recording && (
                        <div
                          style={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            color: "#ff4d4f",
                            fontWeight: 700,
                          }}
                        >
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 'var(--space-1, 4px)' }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} />REC</span> {Math.floor(recordingTime / 60)}:
                          {(recordingTime % 60).toString().padStart(2, "0")}
                        </div>
                      )}
                    </div>
                    <Divider style={{ margin: "8px 0" }} />
                    <Space>
                      <Button aria-label="麦克风开关"
                        shape="circle"
                        icon={micOn ? <Mic size={14} /> : <MicOff size={14} />}
                        onClick={() => setMicOn(!micOn)}
                        danger={!micOn}
                      />
                      <Button aria-label="摄像头开关"
                        shape="circle"
                        icon={
                          videoOn ? <Video size={14} /> : <VideoOff size={14} />
                        }
                        onClick={() => setVideoOn(!videoOn)}
                        danger={!videoOn}
                      />
                      <Button
                        shape="circle"
                        icon={<Phone size={14} />}
                        danger
                        disabled={!session}
                        onClick={handleCall}
                        title={callActive ? t("w1Buttons.tele.callEnded") : t("w1Buttons.tele.call")}
                      />
                      <Button aria-label="录制开关"
                        shape="circle"
                        icon={
                          recording ? (
                            <Activity size={14} />
                          ) : (
                            <Video size={14} />
                          )
                        }
                        onClick={() => setRecording(!recording)}
                        danger={recording}
                      />
                      <Button icon={<Settings size={14} />} onClick={() => setShowSettings(true)}>{t("eye.tele.settings")}</Button>
                    </Space>
                  </Card>

                  {consult && (
                    <Card
                      title={
                        <Space>
                          <Send size={16} color="#52c41a" />
                          {t("eye.tele.consultOpinion")}
                        </Space>
                      }
                      size="small"
                      style={{ marginTop: 'var(--space-4, 16px)' }}
                    >
                      <Alert
                        title={t('w9d.tele.statusSla', { status: consult.status, sla: consult.sla.responseTime })}
                        type="info"
                        showIcon
                      />
                      <div
                        style={{ marginTop: 'var(--space-2, 8px)', fontSize: 12, color: "var(--text-secondary)" }}
                      >
                        {t("eye.tele.expertLabel")} {consult.specialistId}
                        <br />
                        {t("eye.tele.requestTimeLabel")}{" "}
                        {new Date(consult.requestedAt).toLocaleString("zh-CN")}
                      </div>
                    </Card>
                  )}

                  {/* [G005 Wave10A] 远程会诊记录 (后端真实 /eye/tele/*) */}
                  <Card
                    title={
                      <Space>
                        <Activity size={16} color="var(--color-primary-600)" />
                        {t("eye.tele.consultRecords")}
                        {teleStats && (
                          <Tag color="blue">
                            {t("eye.tele.statsSessions")} {teleStats.totalSessions} | {t("eye.tele.statsConsults")}{" "}
                            {teleStats.totalConsults} | {t("eye.tele.statsAvgResponse")}{" "}
                            {teleStats.avgResponseMinutes} {t("eye.tele.minutesUnit")}
                          </Tag>
                        )}
                      </Space>
                    }
                    size="small"
                    style={{ marginTop: 'var(--space-4, 16px)' }}
                  >
                    {teleSessions.length === 0 && teleConsults.length === 0 ? (
                      <Empty
                        image={<Inbox size={48} style={{ opacity: 0.4 }} />}
                        description={t("eye.tele.emptyHistory")}
                      />
                    ) : (
                      <>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 'var(--space-1, 4px)' }}>
                          {t("eye.tele.historySessions")}
                        </div>
                        {teleSessions.slice(0, 5).map((s: any) => (
                          <div
                            key={s.sessionId}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: 12,
                              padding: "2px 0",
                            }}
                          >
                            <span>
                              {s.sessionId} · {t("eye.tele.patientLabel")} {s.patientId}
                            </span>
                            <span>
                              {s.mode} · {s.status}
                            </span>
                          </div>
                        ))}
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            margin: "8px 0 4px",
                          }}
                        >
                          {t("eye.tele.pendingAnswers")}
                        </div>
                        {teleConsults
                          .filter((c: any) => c.status === "pending")
                          .slice(0, 3)
                          .map((c: any) => (
                            <div key={c.consultId} style={{ fontSize: 12, padding: "2px 0" }}>
                              <Tag color="orange" style={{ marginRight: 'var(--space-1, 4px)' }}>
                                {c.specialistName}
                              </Tag>
                              {c.question}
                            </div>
                          ))}
                      </>
                    )}
                  </Card>
                </Col>
              </Row>
            ),
          },

          {
            key: "optometry",
            label: (
              <span>
                <Globe size={14} /> {t("eye.tele.tabOptometry")}
              </span>
            ),
            children: (
              <Row gutter={16}>
                <Col span={10}>
                  <Card title={t("eye.tele.refractionParams")} size="small">
                    <Form layout="vertical" size="small">
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--text-secondary)",
                          marginBottom: 'var(--space-2, 8px)',
                          fontWeight: 600,
                        }}
                      >
                        {t("eye.tele.odRightEye")}
                      </div>
                      <Row gutter={8}>
                        <Col span={8}>
                          <Form.Item label={t("eye.tele.sphereDs")}>
                            <InputNumber
                              value={reSphere}
                              onChange={(v) => setReSphere(v || 0)}
                              step={0.25}
                              style={{ width: "100%" }}
                            />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item label={t("eye.tele.cylinderDc")}>
                            <InputNumber
                              value={reCylinder}
                              onChange={(v) => setReCylinder(v || 0)}
                              step={0.25}
                              style={{ width: "100%" }}
                            />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item label={t("eye.tele.axisDeg")}>
                            <InputNumber
                              value={reAxis}
                              onChange={(v) => setReAxis(v || 0)}
                              step={1}
                              min={0}
                              max={180}
                              style={{ width: "100%" }}
                            />
                          </Form.Item>
                        </Col>
                      </Row>
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--text-secondary)",
                          marginBottom: 'var(--space-2, 8px)',
                          fontWeight: 600,
                        }}
                      >
                        {t("eye.tele.osLeftEye")}
                      </div>
                      <Row gutter={8}>
                        <Col span={8}>
                          <Form.Item label={t("eye.tele.sphereDs")}>
                            <InputNumber
                              value={leSphere}
                              onChange={(v) => setLeSphere(v || 0)}
                              step={0.25}
                              style={{ width: "100%" }}
                            />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item label={t("eye.tele.cylinderDc")}>
                            <InputNumber
                              value={leCylinder}
                              onChange={(v) => setLeCylinder(v || 0)}
                              step={0.25}
                              style={{ width: "100%" }}
                            />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item label={t("eye.tele.axisDeg")}>
                            <InputNumber
                              value={leAxis}
                              onChange={(v) => setLeAxis(v || 0)}
                              step={1}
                              min={0}
                              max={180}
                              style={{ width: "100%" }}
                            />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Form.Item label={t("eye.tele.prescriptionTypeLabel")}>
                        <Radio.Group
                          value={prescriptionType}
                          onChange={(e) => setPrescriptionType(e.target.value)}
                        >
                          <Radio.Button value="眼镜">{t("eye.tele.typeGlasses")}</Radio.Button>
                          <Radio.Button value="隐形">{t("eye.tele.typeContact")}</Radio.Button>
                          <Radio.Button value="渐进">{t("eye.tele.typeProgressive")}</Radio.Button>
                        </Radio.Group>
                      </Form.Item>
                      <Button
                        type="primary"
                        block
                        icon={<Save size={14} />}
                        onClick={handleRefraction}
                      >
                        {t("eye.tele.saveRefraction")}
                      </Button>
                    </Form>
                  </Card>

                  <Card
                    title={t("eye.tele.okLensCard")}
                    size="small"
                    style={{ marginTop: 'var(--space-4, 16px)' }}
                  >
                    <Form layout="vertical" size="small">
                      <Form.Item label={t("eye.tele.targetReductionLabel")}>
                        <Slider
                          min={1}
                          max={6}
                          step={0.5}
                          value={targetReduction}
                          onChange={setTargetReduction}
                          marks={{ 1: "1D", 3: "3D", 6: "6D" }}
                        />
                      </Form.Item>
                      <Button
                        type="primary"
                        block
                        icon={<Sparkles size={14} />}
                        onClick={handleOkLens}
                      >
                        {t("eye.tele.generateOkLens")}
                      </Button>
                    </Form>
                  </Card>
                </Col>

                <Col span={14}>
                  <Card title={t("eye.tele.optometryResult")} size="small">
                    {refraction ? (
                      <Row gutter={[16, 16]}>
                        <Col span={12}>
                          <Card size="small" title={t("eye.tele.odRightEye")}>
                            <div>S: {refraction.rightEye.sphere} DS</div>
                            <div>
                              C: {refraction.rightEye.cylinder} DC ×{" "}
                              {refraction.rightEye.axis}°
                            </div>
                          </Card>
                        </Col>
                        <Col span={12}>
                          <Card size="small" title={t("eye.tele.osLeftEye")}>
                            <div>S: {refraction.leftEye.sphere} DS</div>
                            <div>
                              C: {refraction.leftEye.cylinder} DC ×{" "}
                              {refraction.leftEye.axis}°
                            </div>
                          </Card>
                        </Col>
                        <Col span={24}>
                          <Alert
                            title={t('w9d.tele.prescriptionLine', { type: refraction.prescriptionType, validUntil: refraction.validUntil.slice(0, 10) })}
                            type="success"
                            showIcon
                          />
                        </Col>
                      </Row>
                    ) : (
                      <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t("eye.tele.emptyRefraction")} />
                    )}
                  </Card>

                  {okLens && (
                    <Card
                      title={
                        <Space>
                          <Sparkles size={16} color="#722ed1" />
                          {t("eye.tele.okLensDesign")}
                        </Space>
                      }
                      size="small"
                      style={{ marginTop: 'var(--space-4, 16px)' }}
                    >
                      <Row gutter={[16, 16]}>
                        <Col span={8}>
                          <Statistic
                            title={t("eye.tele.baseCurve")}
                            value={okLens.design.baseCurve.toFixed(2)}
                            suffix="mm"
                          />
                        </Col>
                        <Col span={8}>
                          <Statistic
                            title={t("eye.tele.returnZoneDepth")}
                            value={okLens.design.returnZoneDepth}
                            suffix="mm"
                          />
                        </Col>
                        <Col span={8}>
                          <Statistic
                            title={t("eye.tele.landingZoneAngle")}
                            value={okLens.design.landingZoneAngle}
                            suffix="°"
                          />
                        </Col>
                        <Col span={8}>
                          <Statistic
                            title={t("eye.tele.diameter")}
                            value={okLens.design.diameter}
                            suffix="mm"
                          />
                        </Col>
                        <Col span={8}>
                          <Statistic
                            title={t("eye.tele.targetReductionShort")}
                            value={Math.abs(okLens.design.targetReduction)}
                            suffix="D"
                          />
                        </Col>
                        <Col span={8}>
                          <Statistic title={t("eye.tele.brand")} value={okLens.design.brand} />
                        </Col>
                        <Col span={24}>
                          <Alert
                            title={okLens.fittingNotes}
                            type="info"
                            showIcon
                          />
                        </Col>
                      </Row>
                    </Card>
                  )}
                </Col>
              </Row>
            ),
          },

          // [v3.0.6.11-103 Wave 3A] 远程阅片: 流状态 / 会话详情 / 意见答复
          {
            key: "remote",
            label: (
              <span>
                <MonitorSmartphone size={14} /> {t("eye.tele.remoteReading")}
              </span>
            ),
            children: (
              <Row gutter={16}>
                <Col span={12}>
                  <Card
                    title={
                      <Space>
                        <Database size={16} color="var(--color-info-600)" />
                        {t("eye.tele.streams")}
                        <Tag color="blue">{teleStreams.length}</Tag>
                      </Space>
                    }
                    size="small"
                  >
                    {teleStreams.length === 0 ? (
                      <Empty
                        image={<Inbox size={48} style={{ opacity: 0.4 }} />}
                        description={t("eye.common.noData")}
                      />
                    ) : (
                      <DataTable
                        rowKey="streamId"
                        dataSource={teleStreams}
                        pagination={{ pageSize: 5, showSizeChanger: false }}
                        columns={[
                          { title: t("eye.tele.colStreamId"), dataIndex: "streamId" },
                          { title: t("eye.tele.studyId"), dataIndex: "studyId" },
                          { title: t("eye.tele.colTargetHospital"), dataIndex: "targetHospital" },
                          {
                            title: t("eye.tele.colProtocol"),
                            dataIndex: "protocol",
                            render: (v: string) => <Tag color="cyan">{v}</Tag>,
                          },
                          {
                            title: t("eye.tele.colStatus"),
                            dataIndex: "status",
                            render: (v: string) => (
                              <Tag color={v === "streaming" ? "green" : v === "starting" ? "orange" : "default"}>
                                {v === "streaming" ? t("eye.tele.statusStreaming") : v === "starting" ? t("eye.tele.statusStarting") : t("eye.tele.statusEnded")}
                              </Tag>
                            ),
                          },
                          {
                            title: t("eye.tele.colProgress"),
                            render: (_, r: any) =>
                              r.bytesTransferred
                                ? `${(Number(r.bytesTransferred) / 1024 / 1024).toFixed(1)} MB`
                                : "-",
                          },
                        ]}
                        scroll={{ x: "max-content" }}
                      />
                    )}
                  </Card>

                  <Card
                    title={
                      <Space>
                        <ListTree size={16} color="var(--color-primary-600)" />
                        {t("eye.tele.sessionDetail")}
                      </Space>
                    }
                    size="small"
                    style={{ marginTop: 'var(--space-4, 16px)' }}
                  >
                    <Space.Compact style={{ width: "100%" }}>
                      <Input
                        placeholder={t("eye.tele.sessionIdPlaceholder")}
                        value={detailSessionId}
                        onChange={(e) => setDetailSessionId(e.target.value)}
                      />
                      <Button type="primary" onClick={handleSessionDetail}>
                        {t("eye.common.search")}
                      </Button>
                    </Space.Compact>
                    {sessionDetail ? (
                      <div style={{ marginTop: 'var(--space-3, 12px)', fontSize: 12 }}>
                        <div>
                          {t("eye.tele.sessionLabel")} {sessionDetail.sessionId} · {t("eye.tele.patientLabel")} {sessionDetail.patientId}
                        </div>
                        <div style={{ color: "var(--text-secondary)" }}>
                          {t("eye.tele.studyIdLabel")} {sessionDetail.studyId} · {t("eye.tele.signalingLabel")} {sessionDetail.signalingUrl}
                        </div>
                        <div style={{ color: "var(--text-secondary)" }}>
                          {t("eye.tele.startedAtLabel")} {String(sessionDetail.startedAt ?? "").slice(0, 19).replace("T", " ")}
                          {sessionDetail.endedAt
                            ? t('w9d.tele.endedAt', { time: String(sessionDetail.endedAt).slice(0, 19).replace("T", " ") })
                            : ""}
                        </div>
                        <Divider style={{ margin: "8px 0" }} />
                        <Space>
                          <Tag color={sessionDetail.status === "active" ? "green" : "default"}>
                            {sessionDetail.status === "active" ? t("eye.tele.statusActive") : sessionDetail.status}
                          </Tag>
                          <Tag>{sessionDetail.mode}</Tag>
                          <span>{t("eye.tele.participantsLabel")} {sessionDetail.participants?.join(" / ")}</span>
                          {sessionDetail.status === "active" && (
                            <Button
                              size="small"
                              danger
                              onClick={() => handleEndSession(sessionDetail.sessionId)}
                            >
                              {t("eye.tele.endSession")}
                            </Button>
                          )}
                        </Space>
                        {sessionDetail.network && (
                          <div style={{ marginTop: 'var(--space-2, 8px)', color: "var(--text-secondary)" }}>
                            {t("eye.tele.edgeLabel")} {sessionDetail.network.edgeNodeId} · {t("eye.tele.sliceLabel")} {sessionDetail.network.slice} · P95 {sessionDetail.network.latencyP95}ms
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ marginTop: 'var(--space-3, 12px)', fontSize: 12, color: "var(--text-secondary)" }}>
                        {t("eye.common.noData")}
                      </div>
                    )}
                  </Card>
                </Col>

                <Col span={12}>
                  <Card
                    title={
                      <Space>
                        <FileText size={16} color="#7c3aed" />
                        {t("eye.tele.answer")}
                      </Space>
                    }
                    size="small"
                  >
                    <Space.Compact style={{ width: "100%" }}>
                      <Input
                        placeholder={t("eye.tele.consultIdPlaceholder")}
                        value={detailConsultId}
                        onChange={(e) => setDetailConsultId(e.target.value)}
                      />
                      <Button type="primary" onClick={handleConsultDetail}>
                        {t("eye.common.search")}
                      </Button>
                    </Space.Compact>
                    {consultDetail ? (
                      <div style={{ marginTop: 'var(--space-3, 12px)', fontSize: 12 }}>
                        <Alert
                          title={`${consultDetail.specialistName ?? consultDetail.specialistId} · ${consultDetail.status === "pending" ? t('w9d.tele.pendingReply') : consultDetail.status}`}
                          description={consultDetail.question}
                          type={consultDetail.status === "pending" ? "info" : "success"}
                          showIcon
                        />
                        {consultDetail.answer && (
                          <div style={{ marginTop: 'var(--space-2, 8px)' }}>
                            <div style={{ fontWeight: 600, marginBottom: 'var(--space-1, 4px)' }}>
                              {t("eye.tele.existingAnswer")}:
                            </div>
                            <div style={{ color: "var(--text-secondary)" }}>
                              {consultDetail.answer}
                            </div>
                          </div>
                        )}
                        {consultDetail.status === "pending" && (
                          <>
                            <Divider style={{ margin: "8px 0" }} />
                            <Input.TextArea
                              rows={3}
                              placeholder={t("eye.tele.answerPlaceholder")}
                              value={answerText}
                              onChange={(e) => setAnswerText(e.target.value)}
                            />
                            <Button
                              type="primary"
                              block
                              icon={<Send size={14} />}
                              style={{ marginTop: 'var(--space-2, 8px)' }}
                              onClick={handleAnswerConsult}
                            >
                              {t("eye.tele.submitAnswer")}
                            </Button>
                          </>
                        )}
                      </div>
                    ) : (
                      <div style={{ marginTop: 'var(--space-3, 12px)', fontSize: 12, color: "var(--text-secondary)" }}>
                        {t("eye.common.noData")}
                      </div>
                    )}
                  </Card>

                  <Card
                    title={
                      <Space>
                        <Activity size={16} color="#52c41a" />
                        {t("eye.tele.consultRecords")}
                      </Space>
                    }
                    size="small"
                    style={{ marginTop: 'var(--space-4, 16px)' }}
                  >
                    {teleConsults.length === 0 ? (
                      <Empty
                        image={<Inbox size={48} style={{ opacity: 0.4 }} />}
                        description={t("eye.common.noData")}
                      />
                    ) : (
                      <DataTable
                        rowKey="consultId"
                        dataSource={teleConsults}
                        pagination={{ pageSize: 5, showSizeChanger: false }}
                        columns={[
                          { title: t("eye.tele.colConsultId"), dataIndex: "consultId" },
                          { title: t("eye.tele.colSpecialist"), dataIndex: "specialistName" },
                          {
                            title: t("eye.tele.colQuestion"),
                            dataIndex: "question",
                            ellipsis: true,
                          },
                          {
                            title: t("eye.tele.colStatus"),
                            dataIndex: "status",
                            render: (v: string) => (
                              <Tag color={v === "pending" ? "orange" : "green"}>
                                {v === "pending" ? t("eye.tele.statusPending") : t("eye.tele.statusAnswered")}
                              </Tag>
                            ),
                          },
                          {
                            title: "SLA",
                            render: (_, r: any) => r.sla?.responseTime ?? "-",
                          },
                        ]}
                        scroll={{ x: "max-content" }}
                      />
                    )}
                  </Card>
                </Col>
              </Row>
            ),
          },
        ]}
      />

      <Modal
        title={<Space><Settings size={16} /> {t("eye.tele.settingsTitle")}</Space>}
        open={showSettings}
        onCancel={() => setShowSettings(false)}
        onOk={() => {
          setSavingSettings(true);
          setTimeout(() => {
            setSavingSettings(false);
            setShowSettings(false);
            message.success(t('eye.tele.settingsSaved'));
          }, 400);
        }}
        okText={t("eye.tele.saveSettings")}
        confirmLoading={savingSettings}
        width={420}
      >
        <Form layout="vertical" size="small">
          <Form.Item label={t("eye.tele.videoDevice")}>
            <Select value={settings.device} onChange={(v) => setSettings({ ...settings, device: v })} options={[{ value: '内置摄像头 (HD)', label: t('w9d.tele.device.builtin') }, { value: '外接摄像头', label: t('w9d.tele.device.external') }, { value: 'USB 高清摄像头', label: t('w9d.tele.device.usbHd') }]} />
          </Form.Item>
          <Form.Item label={t("eye.tele.microphone")}>
            <Select value={settings.mic} onChange={(v) => setSettings({ ...settings, mic: v })} options={[{ value: '内置麦克风', label: t('w9d.tele.mic.builtin') }, { value: '耳机麦克风', label: t('w9d.tele.mic.headset') }, { value: '领夹麦克风', label: t('w9d.tele.mic.lavalier') }]} />
          </Form.Item>
          <Form.Item label={t("eye.tele.speaker")}>
            <Select value={settings.speaker} onChange={(v) => setSettings({ ...settings, speaker: v })} options={[{ value: '默认扬声器', label: t('w9d.tele.speaker.default') }, { value: '耳机', label: t('w9d.tele.speaker.headset') }]} />
          </Form.Item>
          <Form.Item label={t("eye.tele.resolution")}>
            <Radio.Group value={settings.resolution} onChange={(e) => setSettings({ ...settings, resolution: e.target.value })}>
              <Radio.Button value="720p">720p</Radio.Button>
              <Radio.Button value="1080p">1080p</Radio.Button>
              <Radio.Button value="4K">4K</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item label={t("eye.tele.otherOptions")}>
            <Space direction="vertical">
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', cursor: 'pointer' }}>
                <input type="checkbox" checked={settings.enableNoiseCancellation} onChange={(e) => setSettings({ ...settings, enableNoiseCancellation: e.target.checked })} />
                {t("eye.tele.enableNoiseCancellation")}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', cursor: 'pointer' }}>
                <input type="checkbox" checked={settings.autoRecord} onChange={(e) => setSettings({ ...settings, autoRecord: e.target.checked })} />
                {t("eye.tele.autoRecord")}
              </label>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default TeleConsultPage;
