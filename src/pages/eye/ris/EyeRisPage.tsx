import React, { useState, useMemo, useEffect } from "react";
import {
  Card,
  Row,
  Col,
  Tag,
  Table,
  Tabs,
  Steps,
  Badge,
  Button,
  Timeline,
  Empty,
  Spin,
} from "antd";
import {
  Activity,
  Calendar,
  Clock,
  AlertTriangle,
  UserCheck,
  ArrowRight,
  Phone,
  Bell,
} from "lucide-react";
import CriticalValueAlert from "@/components/eye/CriticalValueAlert";
import { eyeApi } from "../../../services/api/eyeApi";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { AppEmpty } from "@/components/feedback";
import { PageContainer, PageHeader } from "@/components/common";
import type {
  EyeAppointment,
  SurgeryAppointment,
  FollowUpReminder,
  EyeReferral,
  CriticalValue,
} from "../../types/eye";


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
  const [criticalValues, setCriticalValues] = useState<CriticalValue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const [aptRes, surgRes, fuRes, refRes, cvRes] = await Promise.all([
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

  const today = new Date().toISOString().split("T")[0];
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

  const statusFlow = FLOW_STEP_KEYS;
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
              dataSource={todayApts}
              rowKey="id"
              size="small"
              pagination={{
                pageSize: 5,
                showSizeChanger: true,
                showTotal: (t) => `共 ${t} 条`,
              }}
              scroll={{ x: "max-content" }}
              locale={{ emptyText: <Empty description="暂无数据" /> }}
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
                  render: () => (
                    <Space.Compact size="small">
                      <Button>到检</Button>
                      <Button>叫号</Button>
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
              dataSource={upcomingApts}
              rowKey="id"
              size="small"
              pagination={{
                pageSize: 5,
                showSizeChanger: true,
                showTotal: (t) => `共 ${t} 条`,
              }}
              scroll={{ x: "max-content" }}
              locale={{ emptyText: <Empty description="暂无数据" /> }}
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
              dataSource={followUps}
              rowKey="id"
              size="small"
              pagination={{
                pageSize: 4,
                showSizeChanger: true,
                showTotal: (t) => `共 ${t} 条`,
              }}
              scroll={{ x: "max-content" }}
              locale={{ emptyText: <Empty description="暂无数据" /> }}
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
              dataSource={referrals}
              rowKey="id"
              size="small"
              pagination={{
                pageSize: 3,
                showSizeChanger: true,
                showTotal: (t) => `共 ${t} 条`,
              }}
              scroll={{ x: "max-content" }}
              locale={{ emptyText: <Empty description="暂无数据" /> }}
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
          >
            <Table
              dataSource={surgeryAppointments}
              rowKey="id"
              size="small"
              pagination={{
                pageSize: 5,
                showSizeChanger: true,
                showTotal: (t) => `共 ${t} 条`,
              }}
              scroll={{ x: "max-content" }}
              locale={{ emptyText: <Empty description="暂无数据" /> }}
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
    </PageContainer>
  );
};
export default EyeRisPage;
