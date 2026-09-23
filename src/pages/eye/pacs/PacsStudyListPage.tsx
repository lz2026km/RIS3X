import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Tag, Button, Space, Input, Table, Badge, Modal, Form, Select, message, Popconfirm } from 'antd';
import { Image, Search, Eye, Plus, Trash2 } from "lucide-react";
import EyeLateralityBadge from "@/components/eye/EyeLateralityBadge";
import { eyeApi } from "@/services/api/eyeApi";
import { ErrorBanner } from "@/components/feedback";
import { PageContainer, PageHeader } from "@/components/common";
import { usePagination } from "@/hooks/usePagination";
import { t } from "../../../i18n/appI18n";

const MODALITY_LABELS: Record<string, string> = {
  oct_a: "OCTA",  corneal_endothelium: "角膜内皮",  tear_film: "泪膜",  fundus_autofluorescence: "眼底自发荧光",  fundus_photo: "眼底彩照",
  oct: "OCT",
  ffa: "FFA",
  icga: "ICGA",
  visual_field: "视野",
  topography: "角膜地形图",
  pentacam: "Pentacam",
  iol_master: "IOL Master",
  ubm: "UBM",
  slit_lamp: "裂隙灯",
  borderline: "临界",
  cup_to_disc_ratio: "杯盘比",
  rim_width: "视盘缘宽度",
  arteriovenous_ratio: "动静脉比",
  abnormal: "异常",
  v6: "v6",
  text: "文本",
  findings_multi: "多发发现",
  images: "图像",
  productivity: "生产力",
  clinical: "临床",
  operational: "运营",
  financial: "财务",
  critical_value: "危急值",
  pending_review: "待审核",
};

const PacsStudyListPage: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [studies, setStudies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [createForm] = Form.useForm();

  const loadStudies = async () => {
    setLoadError(null);
    try {
      const res = await eyeApi.getStudies();
      if (res.success && Array.isArray(res.data)) {
        setStudies(res.data);
      } else if (!res.success) {
        setLoadError(t('w9.states.error'));
      }
    } catch { setLoadError(t('w9.states.error')); }
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      await loadStudies();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // [v3.0.6.11-88 P0] 新建检查 → POST /eye/studies (后端 CreateEyeStudySchema)
  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setCreating(true);
      const res = await eyeApi.createStudy({
        patientId: values.patientId,
        modality: values.modality,
        bodyPart: values.bodyPart || values.modality,
        studyDate: new Date().toISOString(),
        findings: values.findings ?? '',
        impressions: values.impressions ?? '',
      });
      if (res.success) {
        message.success(t('eyePacs.studyCreated'));
        setCreateOpen(false);
        createForm.resetFields();
        await loadStudies();
      } else {
        message.error(res.error?.message ?? t('eyePacs.createFailed'));
      }
    } catch { /* 表单校验未通过 */ } finally {
      setCreating(false);
    }
  };

  // [v3.0.6.11-88 P0] 删除检查 → DELETE /eye/studies/:id
  const handleDelete = async (id: string) => {
    setDeletingIds((prev) => new Set(prev).add(id));
    try {
      const res = await eyeApi.deleteStudy(id);
      if (res.success) {
        message.success(t('eyePacs.studyDeleted'));
        await loadStudies();
      } else {
        message.error(res.error?.message ?? t('eyePacs.deleteFailed'));
      }
    } catch {
      message.error(t('eyePacs.deleteNetworkError'));
    } finally {
      setDeletingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  const filtered = search
    ? studies.filter(
        (s) => s.patientName.includes(search) || s.patientId.includes(search),
      )
    : studies;
  // [W3-C] 受控分页: 检查列表 (20/页)
  const studyPagination = usePagination(filtered, 20);

  const columns = [
    { title: t('eyePacs.colPatient'), dataIndex: "patientName", key: "patientName", width: 90 },
    { title: t('eyePacs.colPatientId'), dataIndex: "patientId", key: "patientId", width: 80 },
    {
      title: t('eyePacs.colEyeSide'),
      dataIndex: "eyeSide",
      key: "eyeSide",
      width: 80,
      render: (v: string) => (
        <EyeLateralityBadge eyeSide={v as any} size="small" />
      ),
    },
    {
      title: t('eyePacs.colModality'),
      dataIndex: "modality",
      key: "modality",
      width: 100,
      render: (v: string) => (
        <Tag color="cyan" style={{ fontSize: 12 }}>
          {MODALITY_LABELS[v] || v}
        </Tag>
      ),
    },
    {
      title: t('eyePacs.colStudyDate'),
      dataIndex: "studyDate",
      key: "studyDate",
      width: 140,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: t('eyePacs.colDevice'),
      dataIndex: "device",
      key: "device",
      width: 160,
      ellipsis: true,
    },
    {
      title: t('eyePacs.colImageCount'),
      dataIndex: "images",
      key: "images",
      width: 70,
      render: (v: any[]) => <Tag>{v.length}</Tag>,
    },
    {
      title: t('eyePacs.colCritical'),
      dataIndex: "criticalFlag",
      key: "criticalFlag",
      width: 50,
      render: (v: boolean) => v && <Badge dot color="#ef4444" />,
    },
    {
      title: "",
      key: "action",
      width: 150,
      render: (_: any, record: any) => (
        <Space size={4}>
          <Button
            size="small"
            type="primary"
            icon={<Eye className="v4-icon" />}
            onClick={() => navigate(`/eye/pacs/viewer?studyId=${record.id}`)}
          >
            {t('eyePacs.view')}
          </Button>
          <Popconfirm
            title={t('eyePacs.deleteConfirm')}
            onConfirm={() => void handleDelete(record.id)}
            okText={t('eyePacs.delete')}
            cancelText={t('eyePacs.cancel')}
          >
            <Button
              size="small"
              danger
              icon={<Trash2 className="v4-icon" size={12} />}
              loading={deletingIds.has(record.id)}
            >
              {t('eyePacs.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer background="slate" maxWidth="full" padding={16} testId="pacs-study-list-page">
      <PageHeader
        title={t('eyePacs.title')}
        icon={<Image className="v4-icon" style={{ width: 24, height: 24, color: "#2563eb" }} />}
        variant="inline"
        actions={
          <>
            <Tag color="blue">{studies.length} {t('eyePacs.studyUnit')}</Tag>
            <Button
              size="small"
              type="primary"
              icon={<Plus className="v4-icon" size={14} />}
              onClick={() => setCreateOpen(true)}
            >
              {t('eyePacs.newStudy')}
            </Button>
            <Input
              prefix={<Search className="v4-icon" />}
              placeholder={t('eyePacs.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 240 }}
            />
          </>
        }
      />

      {loadError && !loading && <ErrorBanner message={loadError} onRetry={() => void loadStudies()} retryLabel={t('w9.states.retry')} />}

      <Table
        dataSource={studyPagination.pageData}
        columns={columns}
        rowKey="id"
        size="small"
        loading={loading}
        locale={{ emptyText: t('w9.states.empty') }}
        pagination={studyPagination.pagination}
      scroll={{ x: 'max-content' }}
      />

      {/* [v3.0.6.11-88 P0] 新建检查 (POST /eye/studies) */}
      <Modal
        open={createOpen}
        title={t('eyePacs.newStudy')}
        onCancel={() => setCreateOpen(false)}
        onOk={() => void handleCreate()}
        confirmLoading={creating}
        okText={t('eyePacs.create')}
        cancelText={t('eyePacs.cancel')}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" size="small" style={{ marginTop: 12 }}>
          <Form.Item name="patientId" label={t('eyePacs.patientId')} rules={[{ required: true, message: t('eyePacs.patientIdRequired') }]}>
            <Input placeholder={t('eyePacs.patientIdPlaceholder')} />
          </Form.Item>
          <Form.Item name="modality" label={t('eyePacs.colModality')} rules={[{ required: true, message: t('eyePacs.modalityRequired') }]}>
            <Select
              placeholder={t('eyePacs.modalityPlaceholder')}
              options={Object.entries(MODALITY_LABELS)
                .filter(([k]) => !['v6', 'text', 'findings_multi', 'images', 'productivity', 'clinical', 'operational', 'financial', 'critical_value', 'pending_review'].includes(k))
                .map(([value, label]) => ({ value, label }))}
            />
          </Form.Item>
          <Form.Item name="bodyPart" label={t('eyePacs.bodyPart')}>
            <Select
              placeholder={t('eyePacs.eyeSidePlaceholder')}
              options={[
                { value: 'OD', label: t('eyePacs.od') },
                { value: 'OS', label: t('eyePacs.os') },
                { value: 'OU', label: t('eyePacs.ou') },
              ]}
            />
          </Form.Item>
          <Form.Item name="findings" label={t('eyePacs.findings')}>
            <Input.TextArea rows={2} placeholder={t('eyePacs.optional')} />
          </Form.Item>
          <Form.Item name="impressions" label={t('eyePacs.impressions')}>
            <Input.TextArea rows={2} placeholder={t('eyePacs.optional')} />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default PacsStudyListPage;
