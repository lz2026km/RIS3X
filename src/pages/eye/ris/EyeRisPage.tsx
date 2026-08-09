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
import { useBreakpoint } from "@/hooks/useBreakpoint";
import {
  Card,
  Row,
  Col,
  Tag,
  Table,
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


const MODALITY_LABELS: Record<string, string> = { fundus_photo: '眼底彩照', oct: 'OCT', ffa: 'FFA', icga: 'ICGA', visual_field: '视野', topography: '角膜地形图', pentacam: 'Pentacam', iol_master: 'IOL Master', ubm: 'UBM', slit_lamp: '裂隙灯', oct_a: 'OCTA', corneal_endothelium: '角膜内皮', tear_film: '泪膜', fundus_autofluorescence: '眼底自发荧光' };
const PRIORITY_LABELS_EYE_RIS: Record<string, string> = { routine: '常规', urgent: '加急', emergent: '紧急', stat: '立刻' };
const REFERRAL_STATUS_LABELS_DICT: Record<string, string> = { pending: '待处理', accepted: '已接受', completed: '已完成', rejected: '已拒绝' };
const SURGERY_STATUS_LABELS_DICT: Record<string, string> = { scheduled: '已预约', pre_checked: '已术前', completed: '已完成', cancelled: '已取消' };

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
        message.success(`${record.patientName} 已到检`);
      } else {
        message.warning(res.error?.message ?? "到检接口不可用，已本地更新状态");
        updateAppointmentStatus(record.id, "arrived");
      }
    } catch {
      updateAppointmentStatus(record.id, "arrived");
      message.success(`${record.patientName} 已到检（本地）`);
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
        message.success(`已叫号: ${record.patientName}（${MODALITY_LABELS[record.modality] || record.modality}）`);
      } else {
        message.warning(res.error?.message ?? "叫号接口不可用，已本地更新状态");
        updateAppointmentStatus(record.id, "in_progress");
      }
    } catch {
      updateAppointmentStatus(record.id, "in_progress");
      message.success(`已叫号: ${record.patientName}（本地）`);
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
        message.success(`已接受转诊: ${r.patientName}`);
      } else {
        message.warning(res.error?.message ?? "接受转诊接口不可用");
      }
    } catch {
      setReferrals(prev => prev.map(x => x.id === r.id ? { ...x, status: "accepted" as const } : x));
      message.success(`已接受转诊 (本地): ${r.patientName}`);
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
        message.success(`手术已排程: ${values.patientName} (${values.procedure})`);
        setSurgeryModal({ open: false, submitting: false });
        surgeryForm.resetFields();
        const surgRes = await eyeApi.getSurgeries();
        if (surgRes.success && Array.isArray(surgRes.data)) setSurgeryAppointments(surgRes.data as unknown as SurgeryAppointment[]);
      } else {
        message.error(res.error?.message ?? "排程失败");
        setSurgeryModal(prev => ({ ...prev, submitting: false }));
      }
    } catch (e: any) {
      message.error(e?.message ?? "排程失败");
      setSurgeryModal(prev => ({ ...prev, submitting: false }));
    }
  };

  // [G005 Wave1B] 取消手术: DELETE /eye/ris/surgeries/:id
  const handleCancelSurgery = async (s: SurgeryAppointment) => {
    try {
      const res = await eyeApi.deleteSurgery(s.id);
      if (res.success) {
        setSurgeryAppointments(prev => prev.filter(x => x.id !== s.id));
        message.success(`已取消手术: ${s.patientName}`);
      } else {
        message.warning(res.error?.message ?? "取消接口不可用");
      }
    } catch {
      setSurgeryAppointments(prev => prev.map(x => x.id === s.id ? { ...x, status: "cancelled" as const } : x));
      message.success(`已取消手术 (本地): ${s.patientName}`);
    }
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
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
      } catch {
        // APIs may not be available
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

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
    scheduled: "已预约",
    arrived: "已到检",
    in_progress: "检查中",
    completed: "已完成",
    cancelled: "已取消",
    no_show: "未到检",
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
        <div style={{ textAlign: "center", padding: 60 }}><Spin tip="加载 RIS 数据..." /></div>
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
        title="RIS 工作流程"
        icon={<Activity size={24} color="#10b981" />}
        variant="inline"
        actions={
          <>
            <Tag color="green">今日预约 {todayApts.length}</Tag>
            <Tag color="orange">
              危急值{" "}
              {criticalValues.filter((c) => c.status === "open").length}
            </Tag>
            <Tag color="blue">
              待处理转诊{" "}
              {referrals.filter((r) => r.status === "pending").length}
            </Tag>
          </>
        }
      />

      <CriticalValueAlert
        items={criticalValues.filter((c) => c.status !== "resolved")}
      />

      <Row gutter={12}>
        <Col span={24} style={{ marginBottom: 12 }}>
          <Card
            size="small"
            title={
              <>
                <Calendar size={14} /> 今日检查流程 ({today})
              </>
            }
          >
            <Steps
              current={flowCurrent}
              size="small"
              direction={isNarrow ? "vertical" : "horizontal"}
              style={{ marginBottom: 12 }}
              items={[
                { title: '登记', description: isNarrow ? '已预约/已到检' : undefined },
                { title: '候诊', description: isNarrow ? '等候检查' : undefined },
                { title: '检查', description: isNarrow ? '检查中' : undefined },
                { title: '影像上传', description: isNarrow ? 'DICOM 上传' : undefined },
                { title: 'AI 分析', description: isNarrow ? 'AI 辅助诊断' : undefined },
                { title: '报告', description: isNarrow ? '医师书写' : undefined },
                { title: '审核', description: isNarrow ? '终审发布' : undefined },
              ]}
            />
            <Table
              dataSource={todayAptsPage}
              rowKey="id"
              size="small"
              pagination={{
                ...todayAptsPagination,
                showSizeChanger: true,
                showTotal: (t: number) => `共 ${t} 条`,
              }}
              scroll={{ x: "max-content" }}
              locale={{ emptyText: <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="暂无数据" /> }}
              columns={[
                {
                  title: "时间",
                  dataIndex: "scheduledTime",
                  key: "scheduledTime",
                  width: 60,
                },
                {
                  title: "患者",
                  dataIndex: "patientName",
                  key: "patientName",
                  width: 70,
                },
                {
                  title: "检查",
                  dataIndex: "modality",
                  key: "modality",
                  width: 80,
                  render: (v: string) => (
                    <Tag style={{ fontSize: 12 }}>{MODALITY_LABELS[v] || v}</Tag>
                  ),
                },
                {
                  title: "眼别",
                  dataIndex: "eyeSide",
                  key: "eyeSide",
                  width: 40,
                },
                { title: "房间", dataIndex: "room", key: "room", width: 70 },
                {
                  title: "医生",
                  dataIndex: "doctorName",
                  key: "doctorName",
                  width: 60,
                },
                {
                  title: "状态",
                  dataIndex: "status",
                  key: "status",
                  width: 70,
                  render: (v: string) => (
                    <Tag color={statusColors[v]}>{statusLabels[v]}</Tag>
                  ),
                },
                {
                  title: "操作",
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
                        到检
                      </Button>
                      <Button
                        size="small"
                        disabled={record.status === "completed" || record.status === "cancelled"}
                        loading={callLoadingId === record.id}
                        onClick={() => void handleCall(record)}
                      >
                        叫号
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
                <Clock size={14} /> 近期预约
              </>
            }
          >
            <Table
              dataSource={upcomingAptsPage}
              rowKey="id"
              size="small"
              pagination={{
                ...upcomingAptsPagination,
                showSizeChanger: true,
                showTotal: (t: number) => `共 ${t} 条`,
              }}
              scroll={{ x: "max-content" }}
              locale={{ emptyText: <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="暂无数据" /> }}
              columns={[
                {
                  title: "日期",
                  dataIndex: "scheduledDate",
                  key: "scheduledDate",
                  width: 80,
                  render: (v: string) => v.slice(5),
                },
                {
                  title: "患者",
                  dataIndex: "patientName",
                  key: "patientName",
                  width: 60,
                },
                {
                  title: "检查",
                  dataIndex: "modality",
                  key: "modality",
                  width: 60,
                  render: (v: string) => <Tag>{MODALITY_LABELS[v] || v}</Tag>,
                },
                {
                  title: "优先级",
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
                <Bell size={14} /> 随访提醒
              </>
            }
          >
            <Table
              dataSource={followUpsPage}
              rowKey="id"
              size="small"
              pagination={{
                ...followUpsPagination,
                showSizeChanger: true,
                showTotal: (t: number) => `共 ${t} 条`,
              }}
              scroll={{ x: "max-content" }}
              locale={{ emptyText: <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="暂无数据" /> }}
              columns={[
                {
                  title: "患者",
                  dataIndex: "patientName",
                  key: "patientName",
                  width: 60,
                },
                {
                  title: "病种",
                  dataIndex: "condition",
                  key: "condition",
                  width: 80,
                  ellipsis: true,
                },
                {
                  title: "间隔",
                  dataIndex: "recommendedInterval",
                  key: "recommendedInterval",
                  width: 50,
                  render: (v: number) => `${v}d`,
                },
                {
                  title: "超期",
                  dataIndex: "overdue",
                  key: "overdue",
                  width: 40,
                  render: (v: boolean) => v && <Badge dot color="#ef4444" />,
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
                <ArrowRight size={14} /> 转诊管理
              </>
            }
          >
            <Table
              dataSource={referralsPage}
              rowKey="id"
              size="small"
              pagination={{
                ...referralsPagination,
                showSizeChanger: true,
                showTotal: (t: number) => `共 ${t} 条`,
              }}
              scroll={{ x: "max-content" }}
              locale={{ emptyText: <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="暂无数据" /> }}
              columns={[
                {
                  title: "患者",
                  dataIndex: "patientName",
                  key: "patientName",
                  width: 60,
                },
                {
                  title: "转诊到",
                  dataIndex: "referredTo",
                  key: "referredTo",
                  width: 60,
                  ellipsis: true,
                },
                {
                  title: "状态",
                  dataIndex: "status",
                  key: "status",
                  width: 60,
                  render: (v: string) => <Tag>{REFERRAL_STATUS_LABELS_DICT[v] || v}</Tag>,
                },
                {
                  title: "操作",
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
                      接受转诊
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
                <UserCheck size={14} /> 今日手术
              </>
            }
            extra={
              <Button size="small" type="primary" icon={<Calendar size={12} />} onClick={() => { surgeryForm.resetFields(); setSurgeryModal({ open: true, submitting: false }); }}>
                预约手术
              </Button>
            }
          >
            <Table
              dataSource={surgeryAptsPage}
              rowKey="id"
              size="small"
              pagination={{
                ...surgeryAptsPagination,
                showSizeChanger: true,
                showTotal: (t: number) => `共 ${t} 条`,
              }}
              scroll={{ x: "max-content" }}
              locale={{ emptyText: <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="暂无数据" /> }}
              columns={[
                {
                  title: "时间",
                  dataIndex: "scheduledDate",
                  key: "scheduledDate",
                  width: 80,
                },
                {
                  title: "患者",
                  dataIndex: "patientName",
                  key: "patientName",
                  width: 60,
                },
                {
                  title: "手术",
                  dataIndex: "procedure",
                  key: "procedure",
                  width: 160,
                  ellipsis: true,
                },
                {
                  title: "医生",
                  dataIndex: "surgeonName",
                  key: "surgeonName",
                  width: 60,
                },
                {
                  title: "状态",
                  dataIndex: "status",
                  key: "status",
                  width: 60,
                  render: (v: string) => (
                    <Tag>{SURGERY_STATUS_LABELS_DICT[v] || v}</Tag>
                  ),
                },
                {
                  title: "操作",
                  key: "action",
                  width: 80,
                  render: (_: unknown, s: SurgeryAppointment) => (
                    <Popconfirm title="取消该手术排期?" onConfirm={() => void handleCancelSurgery(s)}>
                      <Button size="small" danger disabled={s.status === "cancelled" || s.status === "completed"}>取消</Button>
                    </Popconfirm>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" title="危急值闭环流程">
            <Timeline
              items={[
                {
                  color: "red",
                  children: "AI 检测活动性 CNV(置信度95%) → 自动标记紧急",
                },
                { color: "orange", children: "通知王建国医生(已确认)" },
                { color: "blue", children: "启动抗 VEGF 治疗流程" },
                { color: "gray", children: "待填写处理记录" },
              ]}
            />
          </Card>
        </Col>
      </Row>

      {/* [G005 Wave1B] 预约手术 Modal (POST /eye/ris/surgeries) */}
      <Modal
        title="预约眼科手术"
        open={surgeryModal.open}
        onCancel={() => setSurgeryModal({ open: false, submitting: false })}
        onOk={() => void handleScheduleSurgery()}
        confirmLoading={surgeryModal.submitting}
        width={480}
      >
        <Form form={surgeryForm} layout="vertical" size="small" style={{ marginTop: 8 }} initialValues={{ eyeSide: 'OD', orRoom: '手术室 1' }}>
          <Form.Item label="患者姓名" name="patientName" rules={[{ required: true, message: '请输入患者姓名' }]}>
            <Input placeholder="如: 张伟" />
          </Form.Item>
          <Form.Item label="手术名称" name="procedure" rules={[{ required: true, message: '请输入手术名称' }]}>
            <Input placeholder="如: 白内障超声乳化+IOL植入" />
          </Form.Item>
          <Row gutter={8}>
            <Col span={12}>
              <Form.Item label="手术日期" name="scheduledDate" rules={[{ required: true, message: '请选择日期' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="术眼" name="eyeSide">
                <Select options={[{ value: 'OD', label: '右眼 OD' }, { value: 'OS', label: '左眼 OS' }, { value: 'OU', label: '双眼 OU' }]} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={8}>
            <Col span={12}>
              <Form.Item label="术者" name="surgeonName" rules={[{ required: true, message: '请输入术者' }]}>
                <Input placeholder="如: 张主任" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="手术室" name="orRoom">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="术前诊断" name="preOpDiagnosis">
            <Input placeholder="如: 老年性白内障" />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};
export default EyeRisPage;
