import React, { useState, useEffect } from "react";
import {
  Card,
  Row,
  Col,
  Tag,
  Table,
  Tabs,
  Select,
  Input,
  Button,
  Descriptions,
  Divider,
  Timeline,
  Alert,
  Space,
  Badge,
  Spin,
} from "antd";
import {
  BookOpen,
  FileText,
  Eye,
  Activity,
  Clock,
  User,
  Stethoscope,
  Prescription,
} from "lucide-react";
import EyeLateralityBadge from "@/components/eye/EyeLateralityBadge";
import { eyeApi } from "@/services/api/eyeApi";
import { PageContainer, PageHeader } from "@/components/common";

const EyeEmrPage: React.FC = () => {
  const [emrList, setEmrList] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await eyeApi.getEmr();
        if (!cancelled && res.success && Array.isArray(res.data)) {
          setEmrList(res.data);
          if (res.data.length > 0) setSelected(res.data[0]);
        }
      } catch { /* API may not be available */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = search
    ? emrList.filter(
        (e) =>
          e.patientId.includes(search) || e.chiefComplaint.includes(search),
      )
    : emrList;

  return (
    <PageContainer background="slate" maxWidth="full" padding={16} testId="eye-emr-page">
      <PageHeader
        title="眼科 EMR"
        icon={<BookOpen size={24} color="#8b5cf6" />}
        variant="inline"
        actions={
          <Input.Search
            placeholder="搜索患者/诊断"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 240 }}
          />
        }
      />

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin tip="加载中..." /></div>
      ) : !selected ? (
        <Alert type="info" message="暂无病历数据" style={{ marginTop: 16 }} />
      ) : (
      <Row gutter={12}>
        <Col span={6}>
          <Card size="small" title="病历列表">
            <Table
              dataSource={filtered}
              rowKey="id"
              size="small"
              pagination={false}
              onRow={(r) => ({
                onClick: () => setSelected(r),
                style: {
                  cursor: "pointer",
                  background: r.id === selected.id ? "#eef2ff" : undefined,
                },
              })}
              columns={[
                {
                  title: "患者",
                  dataIndex: "patientName",
                  key: "patientName",
                  width: 60,
                },
                {
                  title: "日期",
                  dataIndex: "createdAt",
                  key: "createdAt",
                  width: 80,
                  render: (v: string) => v.slice(0, 10),
                },
                {
                  title: "诊断",
                  dataIndex: "diagnosis",
                  key: "diagnosis",
                  ellipsis: true,
                  render: (v: string[]) => (
                    <Tag style={{ fontSize: 12 }}>{v[0]}</Tag>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
        <Col span={18}>
          <Card
            size="small"
            title={
              <Space>
                <User size={16} />
                <span>{selected.patientName}</span>
                <EyeLateralityBadge eyeSide="OD" size="small" />
                <Tag color="blue">{selected.doctorName}</Tag>
              </Space>
            }
          >
            <Tabs
              tabBarExtraContent={
                <Badge
                  count={filtered.length}
                  title={`病历 ${filtered.length} 份`}
                  style={{ backgroundColor: '#8b5cf6' }}
                />
              }
              items={[
                {
                  key: "basic",
                  label: "基本信息",
                  children: (
                    <Descriptions
                      size="small"
                      column={2}
                      items={[
                        { label: "主诉", children: selected.chiefComplaint },
                        { label: "现病史", children: selected.hpi, span: 2 },
                        {
                          label: "既往史",
                          children: selected.pastHistory.join("; "),
                        },
                        {
                          label: "全身史",
                          children: selected.systemicHistory.join("; "),
                        },
                        {
                          label: "用药史",
                          children: selected.medicationHistory.join("; "),
                        },
                        {
                          label: "过敏史",
                          children: selected.allergyHistory.join("; "),
                        },
                        {
                          label: "家族史",
                          children: selected.familyHistory.join("; "),
                        },
                        {
                          label: "社会史",
                          children: selected.socialHistory.join("; "),
                        },
                      ]}
                    />
                  ),
                },
                {
                  key: "exam",
                  label: "眼科检查",
                  children: (
                    <Row gutter={12}>
                      <Col span={8}>
                        <Card size="small" title="视力">
                          <Table
                            size="small"
                            pagination={false}
                            dataSource={[
                              {
                                type: "UCVA",
                                od: selected.visionOd[0],
                                os: selected.visionOs[0],
                              },
                              {
                                type: "BCVA",
                                od: selected.visionOd[1],
                                os: selected.visionOs[1],
                              },
                            ]}
                            rowKey="type"
                            columns={[
                              { title: "", dataIndex: "type", width: 50 },
                              { title: "OD", render: (_, r) => r.od },
                              { title: "OS", render: (_, r) => r.os },
                            ]}
                          />
                        </Card>
                        <Card
                          size="small"
                          title="眼压"
                          style={{ marginTop: 4 }}
                        >
                          <div style={{ fontSize: 12 }}>
                            NCT: OD {selected.iopOd[0]?.od} / OS{" "}
                            {selected.iopOd[0]?.os} mmHg
                          </div>
                        </Card>
                        <Card
                          size="small"
                          title="验光"
                          style={{ marginTop: 4 }}
                        >
                          <div style={{ fontSize: 12 }}>
                            OD: {selected.refraction.od.sph}DS/
                            {selected.refraction.od.cyl}DC×
                            {selected.refraction.od.axis}
                            <br />
                            OS: {selected.refraction.os.sph}DS/
                            {selected.refraction.os.cyl}DC×
                            {selected.refraction.os.axis}
                          </div>
                        </Card>
                      </Col>
                      <Col span={8}>
                        <Card size="small" title="裂隙灯">
                          <div style={{ fontSize: 12, lineHeight: 1.8 }}>
                            <div>
                              <strong>眼睑:</strong>{" "}
                              {selected.slitLamp.lid || "-"}
                            </div>
                            <div>
                              <strong>结膜:</strong>{" "}
                              {selected.slitLamp.conjunctiva || "-"}
                            </div>
                            <div>
                              <strong>角膜:</strong>{" "}
                              {selected.slitLamp.cornea || "-"}
                            </div>
                            <div>
                              <strong>前房:</strong>{" "}
                              {selected.slitLamp.anteriorChamber || "-"}
                            </div>
                            <div>
                              <strong>虹膜:</strong>{" "}
                              {selected.slitLamp.iris || "-"}
                            </div>
                            <div>
                              <strong>瞳孔:</strong>{" "}
                              {selected.slitLamp.pupil || "-"}
                            </div>
                            <div>
                              <strong>晶体:</strong>{" "}
                              {selected.slitLamp.lens || "-"}
                            </div>
                          </div>
                        </Card>
                      </Col>
                      <Col span={8}>
                        <Card size="small" title="眼底">
                          <div style={{ fontSize: 12, lineHeight: 1.8 }}>
                            <div>
                              <strong>视盘:</strong>{" "}
                              {selected.fundus.disc || "-"}
                            </div>
                            <div>
                              <strong>黄斑:</strong>{" "}
                              {selected.fundus.macula || "-"}
                            </div>
                            <div>
                              <strong>血管:</strong>{" "}
                              {selected.fundus.vessel || "-"}
                            </div>
                            <div>
                              <strong>周边:</strong>{" "}
                              {selected.fundus.periphery || "-"}
                            </div>
                          </div>
                        </Card>
                        <Card
                          size="small"
                          title="房角镜"
                          style={{ marginTop: 4 }}
                        >
                          <div style={{ fontSize: 12 }}>
                            {selected.gonioscopy || "-"}
                          </div>
                        </Card>
                      </Col>
                    </Row>
                  ),
                },
                {
                  key: "diagnosis",
                  label: "诊断 & 计划",
                  children: (
                    <div>
                      <div style={{ marginBottom: 8 }}>
                        <Tag color="red">ICD编码</Tag>{" "}
                        {selected.icdCodes.join(", ")}
                      </div>
                      <Descriptions
                        size="small"
                        column={1}
                        items={[
                          {
                            label: "诊断",
                            children: selected.diagnosis.map((d, i) => (
                              <Tag key={i} color="orange">
                                {d}
                              </Tag>
                            )),
                          },
                          {
                            label: "治疗方案",
                            children: selected.plan,
                            span: 2,
                          },
                          {
                            label: "随访",
                            children: selected.followUpDays
                              ? `${selected.followUpDays}天后复查`
                              : "-",
                          },
                        ]}
                      />
                    </div>
                  ),
                },
                ...(selected.preOpAssessment
                  ? [
                      {
                        key: "preop",
                        label: "术前评估",
                        children: (
                          <Descriptions
                            size="small"
                            column={2}
                            items={[
                              {
                                label: "ASA",
                                children: `ASA ${selected.preOpAssessment.asaGrade}`,
                              },
                              {
                                label: "血压",
                                children:
                                  selected.preOpAssessment.bloodPressure,
                              },
                              {
                                label: "心率",
                                children: `${selected.preOpAssessment.heartRate}bpm`,
                              },
                              {
                                label: "ECG",
                                children: selected.preOpAssessment.ecgNormal
                                  ? "正常"
                                  : "异常",
                              },
                              {
                                label: "用药调整",
                                children:
                                  selected.preOpAssessment
                                    .medicationAdjustments,
                                span: 2,
                              },
                              {
                                label: "麻醉意见",
                                children:
                                  selected.preOpAssessment.anesthesiologistNote,
                                span: 2,
                              },
                            ]}
                          />
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          </Card>
        </Col>
      </Row>
      )}
    </PageContainer>
  );
};
export default EyeEmrPage;
