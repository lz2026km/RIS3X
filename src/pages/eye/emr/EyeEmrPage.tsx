import React, { useState, useEffect } from "react";
import { Card, Row, Col, Tag, Table, Tabs, Input, Descriptions, Alert, Space, Badge, Spin, message, Modal, Form } from 'antd';
import { BookOpen, User } from 'lucide-react';
import EyeLateralityBadge from "@/components/eye/EyeLateralityBadge";
import { eyeApi } from "@/services/api/eyeApi";
import { ErrorBanner } from "@/components/feedback";
import { PageContainer, PageHeader, ActionButton, ExportButton } from "@/components/common";
import { usePagination } from "@/hooks/usePagination";
import { t } from "../../../i18n/appI18n";

const EyeEmrPage: React.FC = () => {
  const [emrList, setEmrList] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  // [G005 W1-Controls P0-1] 新建病历
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<{ patientName: string; patientId: string; chiefComplaint: string; diagnosis: string; plan: string }>({
    patientName: '', patientId: '', chiefComplaint: '', diagnosis: '', plan: '',
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await eyeApi.getEmr();
        if (!cancelled && res.success && Array.isArray(res.data)) {
          setEmrList(res.data);
          if (res.data.length > 0) setSelected(res.data[0]);
        } else if (!cancelled && !res.success) {
          setLoadError(t('w9.states.error'));
        }
      } catch { setLoadError(t('w9.states.error')); }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [reloadTick]);

  // [G005 W1-Controls P0-1] 新建病历 → eyeApi.createEmr (MSW /eye/emr/records POST) → 列表前置 + 选中
  const handleCreateEmr = async () => {
    if (!createForm.patientName.trim()) {
      message.warning(t('w1Controls.emr.required'));
      return;
    }
    setCreating(true);
    try {
      const res = await eyeApi.createEmr(createForm);
      if (res.success && res.data) {
        const created = res.data;
        setEmrList((list) => [created, ...list]);
        setSelected(created);
        setCreateOpen(false);
        setCreateForm({ patientName: '', patientId: '', chiefComplaint: '', diagnosis: '', plan: '' });
        message.success(t('w1Controls.emr.created', { id: created.id }));
      } else {
        message.error(res.error?.message ?? t('w1Controls.emr.failed'));
      }
    } catch {
      message.error(t('w1Controls.emr.failed'));
    } finally {
      setCreating(false);
    }
  };

  const filtered = search
    ? emrList.filter(
        (e) =>
          e.patientId.includes(search) || e.chiefComplaint.includes(search),
      )
    : emrList;
  // [v3.0.6.11-95] W4-B P2: 受控分页 (EMR 列表)
  const emrPagination = usePagination(filtered, 10);

  return (
    <PageContainer background="slate" maxWidth="full" padding={16} testId="eye-emr-page">
      <PageHeader
        title={t('eyeEmr.title')}
        icon={<BookOpen size={24} color="#8b5cf6" />}
        variant="inline"
        actions={
          <>
            <Input.Search
              placeholder={t('eyeEmr.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 240 }}
            />
            <ActionButton action="refresh" loading={loading} onClick={() => setReloadTick((n) => n + 1)}>{t('w45.actions.refresh')}</ActionButton>
            <ActionButton action="create" onClick={() => setCreateOpen(true)}>{t('w45.eyeEmr.newRecord')}</ActionButton>
            <ExportButton
              data={() => filtered}
              filename="eye-emr"
              label={t('w45.actions.export')}
              size="small"
              formats={["csv", "json"]}
            />
          </>
        }
      />

      {loadError && !loading && <ErrorBanner message={loadError} onRetry={() => setReloadTick((n) => n + 1)} retryLabel={t('w9.states.retry')} />}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin tip={t('eyeEmr.loading')} /></div>
      ) : !selected ? (
        <Alert type="info" title={t('eyeEmr.noData')} style={{ marginTop: 16 }} />
      ) : (
      <Row gutter={12}>
        <Col span={6}>
          <Card size="small" title={t('eyeEmr.recordList')}>
            <Table
              dataSource={emrPagination.pageData}
              rowKey="id"
              size="small"
              pagination={emrPagination.pagination}
              onRow={(r) => ({
                onClick: () => setSelected(r),
                style: {
                  cursor: "pointer",
                  background: r.id === selected.id ? "#eef2ff" : undefined,
                },
              })}
              columns={[
                {
                  title: t('eyeEmr.colPatient'),
                  dataIndex: "patientName",
                  key: "patientName",
                  width: 60,
                },
                {
                  title: t('eyeEmr.colDate'),
                  dataIndex: "createdAt",
                  key: "createdAt",
                  width: 80,
                  render: (v: string) => v.slice(0, 10),
                },
                {
                  title: t('eyeEmr.colDiagnosis'),
                  dataIndex: "diagnosis",
                  key: "diagnosis",
                  ellipsis: true,
                  render: (v: string[]) => (
                    <Tag style={{ fontSize: 12 }}>{v[0]}</Tag>
                  ),
                },
              ]}
            scroll={{ x: 'max-content' }} />
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
                  title={t('w9d.eyeEmr.recordCount', { count: filtered.length })}
                  style={{ backgroundColor: '#8b5cf6' }}
                />
              }
              items={[
                {
                  key: "basic",
                  label: t('eyeEmr.tabBasic'),
                  children: (
                    <Descriptions
                      size="small"
                      column={2}
                      items={[
                        { label: t('eyeEmr.infoChiefComplaint'), children: selected.chiefComplaint },
                        { label: t('eyeEmr.infoHpi'), children: selected.hpi, span: 2 },
                        {
                          label: t('eyeEmr.infoPastHistory'),
                          children: selected.pastHistory.join("; "),
                        },
                        {
                          label: t('eyeEmr.infoSystemicHistory'),
                          children: selected.systemicHistory.join("; "),
                        },
                        {
                          label: t('eyeEmr.infoMedicationHistory'),
                          children: selected.medicationHistory.join("; "),
                        },
                        {
                          label: t('eyeEmr.infoAllergyHistory'),
                          children: selected.allergyHistory.join("; "),
                        },
                        {
                          label: t('eyeEmr.infoFamilyHistory'),
                          children: selected.familyHistory.join("; "),
                        },
                        {
                          label: t('eyeEmr.infoSocialHistory'),
                          children: selected.socialHistory.join("; "),
                        },
                      ]}
                    />
                  ),
                },
                {
                  key: "exam",
                  label: t('eyeEmr.tabEyeExam'),
                  children: (
                    <Row gutter={12}>
                      <Col span={8}>
                        <Card size="small" title={t('eyeEmr.vision')}>
                          <Descriptions
                            size="small"
                            column={2}
                            items={[
                              { label: t('eyeEmr.ucvaOd'), children: selected.visionOd[0] },
                              { label: t('eyeEmr.bcvaOd'), children: selected.visionOd[1] },
                              { label: t('eyeEmr.ucvaOs'), children: selected.visionOs[0] },
                              { label: t('eyeEmr.bcvaOs'), children: selected.visionOs[1] },
                            ]}
                          />
                        </Card>
                        <Card
                          size="small"
                          title={t('eyeEmr.iop')}
                          style={{ marginTop: 4 }}
                        >
                          <div style={{ fontSize: 12 }}>
                            NCT: OD {selected.iopOd[0]?.od} / OS{" "}
                            {selected.iopOd[0]?.os} mmHg
                          </div>
                        </Card>
                        <Card
                          size="small"
                          title={t('eyeEmr.refraction')}
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
                        <Card size="small" title={t('eyeEmr.slitLamp')}>
                          <div style={{ fontSize: 12, lineHeight: 1.8 }}>
                            <div>
                              <strong>{t('eyeEmr.slitLampLid')}</strong>{" "}
                              {selected.slitLamp.lid || "-"}
                            </div>
                            <div>
                              <strong>{t('eyeEmr.slitLampConjunctiva')}</strong>{" "}
                              {selected.slitLamp.conjunctiva || "-"}
                            </div>
                            <div>
                              <strong>{t('eyeEmr.slitLampCornea')}</strong>{" "}
                              {selected.slitLamp.cornea || "-"}
                            </div>
                            <div>
                              <strong>{t('eyeEmr.slitLampAnteriorChamber')}</strong>{" "}
                              {selected.slitLamp.anteriorChamber || "-"}
                            </div>
                            <div>
                              <strong>{t('eyeEmr.slitLampIris')}</strong>{" "}
                              {selected.slitLamp.iris || "-"}
                            </div>
                            <div>
                              <strong>{t('eyeEmr.slitLampPupil')}</strong>{" "}
                              {selected.slitLamp.pupil || "-"}
                            </div>
                            <div>
                              <strong>{t('eyeEmr.slitLampLens')}</strong>{" "}
                              {selected.slitLamp.lens || "-"}
                            </div>
                          </div>
                        </Card>
                      </Col>
                      <Col span={8}>
                        <Card size="small" title={t('eyeEmr.fundus')}>
                          <div style={{ fontSize: 12, lineHeight: 1.8 }}>
                            <div>
                              <strong>{t('eyeEmr.fundusDisc')}</strong>{" "}
                              {selected.fundus.disc || "-"}
                            </div>
                            <div>
                              <strong>{t('eyeEmr.fundusMacula')}</strong>{" "}
                              {selected.fundus.macula || "-"}
                            </div>
                            <div>
                              <strong>{t('eyeEmr.fundusVessel')}</strong>{" "}
                              {selected.fundus.vessel || "-"}
                            </div>
                            <div>
                              <strong>{t('eyeEmr.fundusPeriphery')}</strong>{" "}
                              {selected.fundus.periphery || "-"}
                            </div>
                          </div>
                        </Card>
                        <Card
                          size="small"
                          title={t('eyeEmr.gonioscopy')}
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
                  label: t('eyeEmr.tabDiagnosisPlan'),
                  children: (
                    <div>
                      <div style={{ marginBottom: 8 }}>
                        <Tag color="red">{t('eyeEmr.icdCode')}</Tag>{" "}
                        {selected.icdCodes.join(", ")}
                      </div>
                      <Descriptions
                        size="small"
                        column={1}
                        items={[
                          {
                            label: t('eyeEmr.diagnosis'),
                            children: selected.diagnosis.map((d: string, i: number) => (
                              <Tag key={i} color="orange">
                                {d}
                              </Tag>
                            )),
                          },
                          {
                            label: t('eyeEmr.treatmentPlan'),
                            children: selected.plan,
                            span: 2,
                          },
                          {
                            label: t('eyeEmr.followUp'),
                            children: selected.followUpDays
                              ? t('w9d.eyeEmr.followUpDays', { days: selected.followUpDays })
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
                        label: t('eyeEmr.tabPreOp'),
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
                                label: t('eyeEmr.bloodPressure'),
                                children:
                                  selected.preOpAssessment.bloodPressure,
                              },
                              {
                                label: t('eyeEmr.heartRate'),
                                children: `${selected.preOpAssessment.heartRate}bpm`,
                              },
                              {
                                label: "ECG",
                                children: selected.preOpAssessment.ecgNormal
                                  ? t('eyeEmr.normal')
                                  : t('eyeEmr.abnormal'),
                              },
                              {
                                label: t('eyeEmr.medicationAdjustments'),
                                children:
                                  selected.preOpAssessment
                                    .medicationAdjustments,
                                span: 2,
                              },
                              {
                                label: t('eyeEmr.anesthesiaNote'),
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

      {/* [G005 W1-Controls P0-1] 新建病历 Modal → eyeApi.createEmr */}
      <Modal
        open={createOpen}
        title={t('w1Controls.emr.title')}
        okText={creating ? t('w1Controls.emr.creating') : t('w1Controls.emr.create')}
        cancelText={t('w1Controls.emr.cancel')}
        confirmLoading={creating}
        onOk={() => void handleCreateEmr()}
        onCancel={() => setCreateOpen(false)}
        destroyOnHidden
      >
        <Form layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item label={t('w1Controls.emr.patientName')} required>
            <Input value={createForm.patientName} onChange={(e) => setCreateForm((f) => ({ ...f, patientName: e.target.value }))} placeholder={t('w1Controls.emr.patientNamePlaceholder')} />
          </Form.Item>
          <Form.Item label={t('w1Controls.emr.patientId')}>
            <Input value={createForm.patientId} onChange={(e) => setCreateForm((f) => ({ ...f, patientId: e.target.value }))} placeholder={t('w1Controls.emr.patientIdPlaceholder')} />
          </Form.Item>
          <Form.Item label={t('w1Controls.emr.chiefComplaint')}>
            <Input.TextArea rows={2} value={createForm.chiefComplaint} onChange={(e) => setCreateForm((f) => ({ ...f, chiefComplaint: e.target.value }))} placeholder={t('w1Controls.emr.chiefComplaintPlaceholder')} />
          </Form.Item>
          <Form.Item label={t('w1Controls.emr.diagnosis')}>
            <Input value={createForm.diagnosis} onChange={(e) => setCreateForm((f) => ({ ...f, diagnosis: e.target.value }))} placeholder={t('w1Controls.emr.diagnosisPlaceholder')} />
          </Form.Item>
          <Form.Item label={t('w1Controls.emr.plan')}>
            <Input.TextArea rows={2} value={createForm.plan} onChange={(e) => setCreateForm((f) => ({ ...f, plan: e.target.value }))} placeholder={t('w1Controls.emr.planPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};
export default EyeEmrPage;
