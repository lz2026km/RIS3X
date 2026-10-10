import CriticalValueAlert from "@/components/eye/CriticalValueAlert";
import { usePagination } from "../../../hooks/usePagination";
import { eyeApi } from "../../../services/api/eyeApi";
import type {
  EyeAppointment,
  SurgeryAppointment,
  FollowUpReminder,
  EyeReferral,
  CriticalValue,
} from "../../../types/eye";
import { PageContainer, PageHeader } from "@/components/common";
import { ErrorBanner } from "@/components/feedback";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import {
  Card,
  Row,
  Col,
  Tag,
  Steps,
  Badge,
  Button,
  Timeline,
  Empty,
  Spin,
  Space,
  message,
  Modal,
  Form,
  Input,
  DatePicker,
  Select,
  Popconfirm,
} from "antd";
import {
  Activity,
  Calendar,
  Clock,
  UserCheck,
  ArrowRight,
  Bell,
} from "lucide-react";
import React, { useState, useMemo, useEffect } from "react";
import { Inbox } from 'lucide-react'
import { t } from "../../../i18n/appI18n";
import { DataTable } from "../../../components/common";


const MODALITY_LABELS: Record<string, string> = { fundus_photo: t('eyeRis.modalityFundusPhoto'), oct: 'OCT', ffa: 'FFA', icga: 'ICGA', visual_field: t('eyeRis.modalityVisualField'), topography: t('eyeRis.modalityTopography'), pentacam: 'Pentacam', iol_master: 'IOL Master', ubm: 'UBM', slit_lamp: t('eyeRis.modalitySlitLamp'), oct_a: 'OCTA', corneal_endothelium: t('eyeRis.modalityCornealEndothelium'), tear_film: t('eyeRis.modalityTearFilm'), fundus_autofluorescence: t('eyeRis.modalityFundusAf') };
const PRIORITY_LABELS_EYE_RIS: Record<string, string> = { routine: t('eyeRis.priorityRoutine'), urgent: t('eyeRis.priorityUrgent'), emergent: t('eyeRis.priorityEmergent'), stat: t('eyeRis.priorityStat') };
const REFERRAL_STATUS_LABELS_DICT: Record<string, string> = { pending: t('eyeRis.referralPending'), accepted: t('eyeRis.referralAccepted'), completed: t('eyeRis.referralCompleted'), rejected: t('eyeRis.referralRejected') };
const SURGERY_STATUS_LABELS_DICT: Record<string, string> = { scheduled: t('eyeRis.surgeryScheduled'), pre_checked: t('eyeRis.surgeryPreChecked'), completed: t('eyeRis.surgeryCompleted'), cancelled: t('eyeRis.surgeryCancelled') };

const FLOW_STEP_KEYS = [
  "scheduled",
  "arrived",
  "in_progress",
  "completed",
] as const;
type FlowStepKey = (typeof FLOW_STEP_KEYS)[number];

const stepIndex: Record<FlowStepKey, number> = {
  scheduled: 0,
  arrived: 1,
  in_progress: 2,
  completed: 3,
};

const EyeRisPage: React.FC = () => {
  const [appointments, setAppointments] = useState<EyeAppointment[]>([]);
  const [surgeryAppointments, setSurgeryAppointments] = useState<SurgeryAppointment[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpReminder[]>([]);
  const [referrals, setReferrals] = useState<EyeReferral[]>([]);
  const [criticalValues, _setCriticalValues] = useState<CriticalValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [checkinLoadingId, setCheckinLoadingId] = useState<string | null>(null);
  const [callLoadingId, setCallLoadingId] = useState<string | null>(null);
  // [G005 Wave1B] 转诊接受 / 手术排程 (eyeApi.acceptReferral / scheduleSurgery / deleteSurgery)
  const [acceptLoadingId, setAcceptLoadingId] = useState<string | null>(null);
  const [surgeryModal, setSurgeryModal] = useState<{ open: boolean; submitting: boolean }>({ open: false, submitting: false });
  const [surgeryForm] = Form.useForm();

  const updateAppointmentStatus = (id: string, status: string) => {
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: status as EyeAppointment["status"] } : a));
  };

  const handleCheckin = async (record: EyeAppointment) => {
    setCheckinLoadingId(record.id);
    try {
      const res = await eyeApi.checkinAppointment(record.id);
      if (res.success) {
        updateAppointmentStatus(record.id, "arrived");
        message.success(t('w9d.eyeRis.checkedIn', { name: record.patientName }));
      } else {
        message.warning(res.error?.message ?? t("eyeRis.checkinUnavailable"));
        updateAppointmentStatus(record.id, "arrived");
      }
    } catch {
      updateAppointmentStatus(record.id, "arrived");
      message.success(t('w9d.eyeRis.checkedInLocal', { name: record.patientName }));
    } finally {
      setCheckinLoadingId(null);
    }
  };

  const handleCall = async (record: EyeAppointment) => {
    setCallLoadingId(record.id);
    try {
      const res = await eyeApi.startAppointment(record.id);
      if (res.success) {
        updateAppointmentStatus(record.id, "in_progress");
        message.success(t('w9d.eyeRis.called', { name: record.patientName, modality: MODALITY_LABELS[record.modality] || record.modality }));
      } else {
        message.warning(res.error?.message ?? t("eyeRis.callUnavailable"));
        updateAppointmentStatus(record.id, "in_progress");
      }
    } catch {
      updateAppointmentStatus(record.id, "in_progress");
      message.success(t('w9d.eyeRis.calledLocal', { name: record.patientName }));
    } finally {
      setCallLoadingId(null);
    }
  };

  // [G005 Wave1B] 接受转诊: POST /eye/ris/referrals/:id/accept
  const handleAcceptReferral = async (r: EyeReferral) => {
    setAcceptLoadingId(r.id);
    try {
      const res = await eyeApi.acceptReferral(r.id);
      if (res.success) {
        setReferrals(prev => prev.map(x => x.id === r.id ? { ...x, status: "accepted" as const } : x));
        message.success(t('w9d.eyeRis.referralAccepted', { name: r.patientName }));
      } else {
        message.warning(res.error?.message ?? t("eyeRis.acceptReferralUnavailable"));
      }
    } catch {
      setReferrals(prev => prev.map(x => x.id === r.id ? { ...x, status: "accepted" as const } : x));
      message.success(t('w9d.eyeRis.referralAcceptedLocal', { name: r.patientName }));
    } finally {
      setAcceptLoadingId(null);
    }
  };

  // [G005 Wave1B] 预约手术: POST /eye/ris/surgeries
  const handleScheduleSurgery = async () => {
    let values: any = {};
    try { values = await surgeryForm.validateFields(); } catch { return; }
    setSurgeryModal(prev => ({ ...prev, submitting: true }));
    try {
      const res = await eyeApi.scheduleSurgery({
        patientName: values.patientName,
        procedure: values.procedure,
        surgeonName: values.surgeonName,
        scheduledDate: values.scheduledDate ? values.scheduledDate.format('YYYY-MM-DD') : new Date().toISOString().slice(0, 10),
        eyeSide: values.eyeSide || 'OD',
        orRoom: values.orRoom || '手术室 1',
        status: 'scheduled',
        preOpDiagnosis: values.preOpDiagnosis || '',
        anesthesiaType: 'local',
        estimatedDuration: 60,
      });
      if (res.success) {
        message.success(t('w9d.eyeRis.surgeryScheduled', { name: values.patientName, procedure: values.procedure }));
        setSurgeryModal({ open: false, submitting: false });
        surgeryForm.resetFields();
        const surgRes = await eyeApi.getSurgeries();
        if (surgRes.success && Array.isArray(surgRes.data)) setSurgeryAppointments(surgRes.data as unknown as SurgeryAppointment[]);
      } else {
        message.error(res.error?.message ?? t("eyeRis.scheduleFailed"));
        setSurgeryModal(prev => ({ ...prev, submitting: false }));
      }
    } catch (e: any) {
      message.error(e?.message ?? t("eyeRis.scheduleFailed"));
      setSurgeryModal(prev => ({ ...prev, submitting: false }));
    }
  };

  // [G005 Wave1B] 取消手术: DELETE /eye/ris/surgeries/:id
  const handleCancelSurgery = async (s: SurgeryAppointment) => {
    try {
      const res = await eyeApi.deleteSurgery(s.id);
      if (res.success) {
        setSurgeryAppointments(prev => prev.filter(x => x.id !== s.id));
        message.success(t('w9d.eyeRis.surgeryCancelled', { name: s.patientName }));
      } else {
        message.warning(res.error?.message ?? t("eyeRis.cancelUnavailable"));
      }
    } catch {
      setSurgeryAppointments(prev => prev.map(x => x.id === s.id ? { ...x, status: "cancelled" as const } : x));
      message.success(t('w9d.eyeRis.surgeryCancelledLocal', { name: s.patientName }));
    }
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [aptRes, surgRes, fuRes, refRes, _cvRes] = await Promise.all([
          eyeApi.getAppointments(),
          eyeApi.getSurgeries(),
          eyeApi.getFollowups(),
          eyeApi.getReferrals(),
          eyeApi.getReports().catch(() => ({ success: false, data: [] })),
        ]);
        if (cancelled) return;
        if (aptRes.success && Array.isArray(aptRes.data)) setAppointments(aptRes.data as unknown as EyeAppointment[]);
        if (surgRes.success && Array.isArray(surgRes.data)) setSurgeryAppointments(surgRes.data as unknown as SurgeryAppointment[]);
        if (fuRes.success && Array.isArray(fuRes.data)) setFollowUps(fuRes.data as unknown as FollowUpReminder[]);
        if (refRes.success && Array.isArray(refRes.data)) setReferrals(refRes.data as unknown as EyeReferral[]);
        if (!aptRes.success && !surgRes.success && !fuRes.success && !refRes.success) setLoadError(t('w9.states.error'));
      } catch {
        setLoadError(t('w9.states.error'));
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [reloadTick]);

  const today = new Date().toISOString().split("T")[0] ?? "";
  const todayApts = appointments.filter((a) => a.scheduledDate === today);
  const upcomingApts = appointments.filter(
    (a) => a.scheduledDate > today,
  ).slice(0, 5);

  // A9-A7-P1-4/5: 窄屏自动 vertical Steps
  const bp = useBreakpoint();
  const isNarrow = bp === "xs" || bp === "sm" || bp === "md";

  // A2-P1-5: 绑定状态机 current - 基于今日预约的状态计算
  const flowCurrent = useMemo(() => {
    if (todayApts.length === 0) return -1;
    const stepCounts = todayApts.reduce<Record<number, number>>((acc, a) => {
      const idx = stepIndex[a.status as FlowStepKey];
      if (typeof idx === "number") {
        acc[idx] = (acc[idx] ?? 0) + 1;
      }
      return acc;
    }, {});
    let maxIdx = -1;
    let maxCount = -1;
    Object.entries(stepCounts).forEach(([k, v]) => {
      if (v > maxCount) {
        maxCount = v;
        maxIdx = Number(k);
      }
    });
    return maxIdx;
  }, [todayApts]);

  // [G005 W2-B] 5 张表受控分页 (usePagination: current/total/onChange)
  const { pageData: todayAptsPage, pagination: todayAptsPagination } = usePagination(todayApts, 5);
  const { pageData: upcomingAptsPage, pagination: upcomingAptsPagination } = usePagination(upcomingApts, 5);
  const { pageData: followUpsPage, pagination: followUpsPagination } = usePagination(followUps, 4);
  const { pageData: referralsPage, pagination: referralsPagination } = usePagination(referrals, 3);
  const { pageData: surgeryAptsPage, pagination: surgeryAptsPagination } = usePagination(surgeryAppointments, 5);

  
  const statusLabels: Record<string, string> = {
    scheduled: t("eyeRis.statusScheduled"),
    arrived: t("eyeRis.statusArrived"),
    in_progress: t("eyeRis.statusInProgress"),
    completed: t("eyeRis.statusCompleted"),
    cancelled: t("eyeRis.statusCancelled"),
    no_show: t("eyeRis.statusNoShow"),
  };
  const statusColors: Record<string, string> = {
    scheduled: "blue",
    arrived: "processing",
    in_progress: "gold",
    completed: "green",
    cancelled: "default",
    no_show: "error",
  };

  if (loading) {
    return (
      <PageContainer background="slate" maxWidth="full" padding={16} testId="eye-ris-page">
        <div style={{ textAlign: "center", padding: 60 }}><Spin tip={t("eyeRis.loadingRis")} /></div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      background="slate"
      maxWidth="full"
      padding={16}
      testId="eye-ris-page"
    >
      <PageHeader
        title={t("eyeRis.title")}
        icon={<Activity size={24} color="#10b981" />}
        variant="inline"
        actions={
          <>
            <Tag color="green">{t("eyeRis.tagTodayAppointments")} {todayApts.length}</Tag>
            <Tag color="orange">
              {t("eyeRis.tagCriticalValues")}{" "}
              {criticalValues.filter((c) => c.status === "open").length}
            </Tag>
            <Tag color="blue">
              {t("eyeRis.tagPendingReferrals")}{" "}
              {referrals.filter((r) => r.status === "pending").length}
            </Tag>
          </>
        }
      />

      {loadError && <ErrorBanner message={loadError} onRetry={() => setReloadTick((n) => n + 1)} retryLabel={t('w9.states.retry')} />}

      <CriticalValueAlert
        items={criticalValues.filter((c) => c.status !== "resolved")}
      />

      <Row gutter={12}>
        <Col span={24} style={{ marginBottom: 12 }}>
          <Card
            size="small"
            title={
              <>
                <Calendar size={14} /> {t("eyeRis.todayFlow")} ({today})
              </>
            }
          >
            <Steps
              current={flowCurrent}
              size="small"
              direction={isNarrow ? "vertical" : "horizontal"}
              style={{ marginBottom: 12 }}
              items={[
                { title: t('eyeRis.stepRegister'), description: isNarrow ? t('eyeRis.stepRegisterDesc') : undefined },
                { title: t('eyeRis.stepWaiting'), description: isNarrow ? t('eyeRis.stepWaitingDesc') : undefined },
                { title: t('eyeRis.stepExam'), description: isNarrow ? t('eyeRis.stepExamDesc') : undefined },
                { title: t('eyeRis.stepImageUpload'), description: isNarrow ? t('eyeRis.stepImageUploadDesc') : undefined },
                { title: t('eyeRis.stepAiAnalysis'), description: isNarrow ? t('eyeRis.stepAiAnalysisDesc') : undefined },
                { title: t('eyeRis.stepReport'), description: isNarrow ? t('eyeRis.stepReportDesc') : undefined },
                { title: t('eyeRis.stepReview'), description: isNarrow ? t('eyeRis.stepReviewDesc') : undefined },
              ]}
            />
            <DataTable
              dataSource={todayAptsPage}
              rowKey="id"
              pagination={{
                ...todayAptsPagination,
                showSizeChanger: true,
                showTotal: (n: number) => `${t("eyeRis.totalCount")} ${n} ${t("eyeRis.items")}`,
              }}
              scroll={{ x: "max-content" }}
              locale={{ emptyText: <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t("eyeRis.noData")} /> }}
              columns={[
                {
                  title: t("eyeRis.colTime"),
                  dataIndex: "scheduledTime",
                  key: "scheduledTime",
                  width: 60,
                },
                {
                  title: t("eyeRis.colPatient"),
                  dataIndex: "patientName",
                  key: "patientName",
                  width: 70,
                },
                {
                  title: t("eyeRis.colExam"),
                  dataIndex: "modality",
                  key: "modality",
                  width: 80,
                  render: (v: string) => (
                    <Tag style={{ fontSize: 12 }}>{MODALITY_LABELS[v] || v}</Tag>
                  ),
                },
                {
                  title: t("eyeRis.colEyeSide"),
                  dataIndex: "eyeSide",
                  key: "eyeSide",
                  width: 40,
                },
                { title: t("eyeRis.colRoom"), dataIndex: "room", key: "room", width: 70 },
                {
                  title: t("eyeRis.colDoctor"),
                  dataIndex: "doctorName",
                  key: "doctorName",
                  width: 60,
                },
                {
                  title: t("eyeRis.colStatus"),
                  dataIndex: "status",
                  key: "status",
                  width: 70,
                  render: (v: string) => (
                    <Tag color={statusColors[v]}>{statusLabels[v]}</Tag>
                  ),
                },
                {
                  title: t("eyeRis.colActions"),
                  key: "action",
                  width: 120,
                  render: (_: unknown, record: EyeAppointment) => (
                    <Space.Compact size="small">
                      <Button
                        size="small"
                        disabled={record.status !== "scheduled"}
                        loading={checkinLoadingId === record.id}
                        onClick={() => void handleCheckin(record)}
                      >
                        {t("eyeRis.checkin")}
                      </Button>
                      <Button
                        size="small"
                        disabled={record.status === "completed" || record.status === "cancelled"}
                        loading={callLoadingId === record.id}
                        onClick={() => void handleCall(record)}
                      >
                        {t("eyeRis.callNumber")}
                      </Button>
                    </Space.Compact>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={12}>
        <Col span={8}>
          <Card
            size="small"
            title={
              <>
                <Clock size={14} /> {t("eyeRis.upcomingAppointments")}
              </>
            }
          >
            <DataTable
              dataSource={upcomingAptsPage}
              rowKey="id"
              pagination={{
                ...upcomingAptsPagination,
                showSizeChanger: true,
                showTotal: (n: number) => `${t("eyeRis.totalCount")} ${n} ${t("eyeRis.items")}`,
              }}
              scroll={{ x: "max-content" }}
              locale={{ emptyText: <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t("eyeRis.noData")} /> }}
              columns={[
                {
                  title: t("eyeRis.colDate"),
                  dataIndex: "scheduledDate",
                  key: "scheduledDate",
                  width: 80,
                  render: (v: string) => v.slice(5),
                },
                {
                  title: t("eyeRis.colPatient"),
                  dataIndex: "patientName",
                  key: "patientName",
                  width: 60,
                },
                {
                  title: t("eyeRis.colExam"),
                  dataIndex: "modality",
                  key: "modality",
                  width: 60,
                  render: (v: string) => <Tag>{MODALITY_LABELS[v] || v}</Tag>,
                },
                {
                  title: t("eyeRis.colPriority"),
                  dataIndex: "priority",
                  key: "priority",
                  width: 60,
                  render: (v: string) => (
                    <Tag
                      color={
                        v === "urgent"
                          ? "red"
                          : v === "emergent"
                            ? "error"
                            : "default"
                      }
                    >
                      {PRIORITY_LABELS_EYE_RIS[v] || v}
                    </Tag>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card
            size="small"
            title={
              <>
                <Bell size={14} /> {t("eyeRis.followUpReminders")}
              </>
            }
          >
            <DataTable
              dataSource={followUpsPage}
              rowKey="id"
              pagination={{
                ...followUpsPagination,
                showSizeChanger: true,
                showTotal: (n: number) => `${t("eyeRis.totalCount")} ${n} ${t("eyeRis.items")}`,
              }}
              scroll={{ x: "max-content" }}
              locale={{ emptyText: <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t("eyeRis.noData")} /> }}
              columns={[
                {
                  title: t("eyeRis.colPatient"),
                  dataIndex: "patientName",
                  key: "patientName",
                  width: 60,
                },
                {
                  title: t("eyeRis.colCondition"),
                  dataIndex: "condition",
                  key: "condition",
                  width: 80,
                  ellipsis: true,
                },
                {
                  title: t("eyeRis.colInterval"),
                  dataIndex: "recommendedInterval",
                  key: "recommendedInterval",
                  width: 50,
                  render: (v: number) => `${v}d`,
                },
                {
                  title: t("eyeRis.colOverdue"),
                  dataIndex: "overdue",
                  key: "overdue",
                  width: 40,
                  render: (v: boolean) => v && <Badge dot color="var(--color-error-500)" />,
                },
              ]}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card
            size="small"
            title={
              <>
                <ArrowRight size={14} /> {t("eyeRis.referralManagement")}
              </>
            }
          >
            <DataTable
              dataSource={referralsPage}
              rowKey="id"
              pagination={{
                ...referralsPagination,
                showSizeChanger: true,
                showTotal: (n: number) => `${t("eyeRis.totalCount")} ${n} ${t("eyeRis.items")}`,
              }}
              scroll={{ x: "max-content" }}
              locale={{ emptyText: <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t("eyeRis.noData")} /> }}
              columns={[
                {
                  title: t("eyeRis.colPatient"),
                  dataIndex: "patientName",
                  key: "patientName",
                  width: 60,
                },
                {
                  title: t("eyeRis.colReferredTo"),
                  dataIndex: "referredTo",
                  key: "referredTo",
                  width: 60,
                  ellipsis: true,
                },
                {
                  title: t("eyeRis.colStatus"),
                  dataIndex: "status",
                  key: "status",
                  width: 60,
                  render: (v: string) => <Tag>{REFERRAL_STATUS_LABELS_DICT[v] || v}</Tag>,
                },
                {
                  title: t("eyeRis.colActions"),
                  key: "action",
                  width: 100,
                  render: (_: unknown, r: EyeReferral) => (
                    <Button
                      size="small"
                      type="primary"
                      disabled={r.status !== "pending"}
                      loading={acceptLoadingId === r.id}
                      onClick={() => void handleAcceptReferral(r)}
                    >
                      {t("eyeRis.acceptReferral")}
                    </Button>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={12} style={{ marginTop: 12 }}>
        <Col span={12}>
          <Card
            size="small"
            title={
              <>
                <UserCheck size={14} /> {t("eyeRis.todaySurgery")}
              </>
            }
            extra={
              <Button size="small" type="primary" icon={<Calendar size={12} />} onClick={() => { surgeryForm.resetFields(); setSurgeryModal({ open: true, submitting: false }); }}>
                {t("eyeRis.scheduleSurgery")}
              </Button>
            }
          >
            <DataTable
              dataSource={surgeryAptsPage}
              rowKey="id"
              pagination={{
                ...surgeryAptsPagination,
                showSizeChanger: true,
                showTotal: (n: number) => `${t("eyeRis.totalCount")} ${n} ${t("eyeRis.items")}`,
              }}
              scroll={{ x: "max-content" }}
              locale={{ emptyText: <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t("eyeRis.noData")} /> }}
              columns={[
                {
                  title: t("eyeRis.colTime"),
                  dataIndex: "scheduledDate",
                  key: "scheduledDate",
                  width: 80,
                },
                {
                  title: t("eyeRis.colPatient"),
                  dataIndex: "patientName",
                  key: "patientName",
                  width: 60,
                },
                {
                  title: t("eyeRis.colSurgery"),
                  dataIndex: "procedure",
                  key: "procedure",
                  width: 160,
                  ellipsis: true,
                },
                {
                  title: t("eyeRis.colDoctor"),
                  dataIndex: "surgeonName",
                  key: "surgeonName",
                  width: 60,
                },
                {
                  title: t("eyeRis.colStatus"),
                  dataIndex: "status",
                  key: "status",
                  width: 60,
                  render: (v: string) => (
                    <Tag>{SURGERY_STATUS_LABELS_DICT[v] || v}</Tag>
                  ),
                },
                {
                  title: t("eyeRis.colActions"),
                  key: "action",
                  width: 80,
                  render: (_: unknown, s: SurgeryAppointment) => (
                    <Popconfirm title={t("eyeRis.cancelSurgeryConfirm")} onConfirm={() => void handleCancelSurgery(s)}>
                      <Button size="small" danger disabled={s.status === "cancelled" || s.status === "completed"}>{t("eyeRis.cancel")}</Button>
                    </Popconfirm>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" title={<Space>{t("eyeRis.criticalValueLoop")}<Tag color="orange" style={{ fontSize: 11 }}>{t("eyeRis.demoProcessTag")}</Tag></Space>}>
            <Timeline
              items={[
                {
                  color: "red",
                  children: t("eyeRis.timeline1"),
                },
                { color: "orange", children: t("eyeRis.timeline2") },
                { color: "blue", children: t("eyeRis.timeline3") },
                { color: "gray", children: t("eyeRis.timeline4") },
              ]}
            />
          </Card>
        </Col>
      </Row>

      {/* [G005 Wave1B] 预约手术 Modal (POST /eye/ris/surgeries) */}
      <Modal
        title={t("eyeRis.scheduleSurgeryTitle")}
        open={surgeryModal.open}
        onCancel={() => setSurgeryModal({ open: false, submitting: false })}
        onOk={() => void handleScheduleSurgery()}
        confirmLoading={surgeryModal.submitting}
        width={480}
      >
        <Form form={surgeryForm} layout="vertical" size="small" style={{ marginTop: 8 }} initialValues={{ eyeSide: 'OD', orRoom: '手术室 1' }}>
          <Form.Item label={t("eyeRis.fPatientName")} name="patientName" rules={[{ required: true, message: t("eyeRis.fPatientNameRequired") }]}>
            <Input placeholder={t("eyeRis.fPatientNamePlaceholder")} />
          </Form.Item>
          <Form.Item label={t("eyeRis.fProcedure")} name="procedure" rules={[{ required: true, message: t("eyeRis.fProcedureRequired") }]}>
            <Input placeholder={t("eyeRis.fProcedurePlaceholder")} />
          </Form.Item>
          <Row gutter={8}>
            <Col span={12}>
              <Form.Item label={t("eyeRis.fSurgeryDate")} name="scheduledDate" rules={[{ required: true, message: t("eyeRis.fDateRequired") }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t("eyeRis.fEyeSide")} name="eyeSide">
                <Select options={[{ value: 'OD', label: t('eyeRis.eyeRight') }, { value: 'OS', label: t('eyeRis.eyeLeft') }, { value: 'OU', label: t('eyeRis.eyeBoth') }]} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={8}>
            <Col span={12}>
              <Form.Item label={t("eyeRis.fSurgeon")} name="surgeonName" rules={[{ required: true, message: t("eyeRis.fSurgeonRequired") }]}>
                <Input placeholder={t("eyeRis.fSurgeonPlaceholder")} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t("eyeRis.fOrRoom")} name="orRoom">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label={t("eyeRis.fPreOpDiagnosis")} name="preOpDiagnosis">
            <Input placeholder={t("eyeRis.fPreOpDiagnosisPlaceholder")} />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};
export default EyeRisPage;
