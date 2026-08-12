import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Tag, Button, Space, Input, Table, Badge, Modal, Form, Select, message, Popconfirm } from 'antd';
import { Image, Search, Eye, Plus, Trash2 } from "lucide-react";
import EyeLateralityBadge from "@/components/eye/EyeLateralityBadge";
import { eyeApi } from "@/services/api/eyeApi";
import { PageContainer, PageHeader } from "@/components/common";
import { usePagination } from "@/hooks/usePagination";

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
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [createForm] = Form.useForm();

  const loadStudies = async () => {
    try {
      const res = await eyeApi.getStudies();
      if (res.success && Array.isArray(res.data)) {
        setStudies(res.data);
      }
    } catch { /* API may not be available */ }
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
        message.success('检查已创建');
        setCreateOpen(false);
        createForm.resetFields();
        await loadStudies();
      } else {
        message.error(res.error?.message ?? '创建失败');
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
        message.success('检查已删除');
        await loadStudies();
      } else {
        message.error(res.error?.message ?? '删除失败');
      }
    } catch {
      message.error('删除失败:网络错误');
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
    { title: "患者", dataIndex: "patientName", key: "patientName", width: 90 },
    { title: "编号", dataIndex: "patientId", key: "patientId", width: 80 },
    {
      title: "眼别",
      dataIndex: "eyeSide",
      key: "eyeSide",
      width: 80,
      render: (v: string) => (
        <EyeLateralityBadge eyeSide={v as any} size="small" />
      ),
    },
    {
      title: "检查类型",
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
      title: "检查日期",
      dataIndex: "studyDate",
      key: "studyDate",
      width: 140,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: "设备",
      dataIndex: "device",
      key: "device",
      width: 160,
      ellipsis: true,
    },
    {
      title: "影像数",
      dataIndex: "images",
      key: "images",
      width: 70,
      render: (v: any[]) => <Tag>{v.length}</Tag>,
    },
    {
      title: "危急",
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
            查看
          </Button>
          <Popconfirm
            title="删除该检查?"
            onConfirm={() => void handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
          >
            <Button
              size="small"
              danger
              icon={<Trash2 className="v4-icon" size={12} />}
              loading={deletingIds.has(record.id)}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer background="slate" maxWidth="full" padding={16} testId="pacs-study-list-page">
      <PageHeader
        title="眼科影像中心 (PACS)"
        icon={<Image className="v4-icon" style={{ width: 24, height: 24, color: "#2563eb" }} />}
        variant="inline"
        actions={
          <>
            <Tag color="blue">{studies.length} 个检查</Tag>
            <Button
              size="small"
              type="primary"
              icon={<Plus className="v4-icon" size={14} />}
              onClick={() => setCreateOpen(true)}
            >
              新建检查
            </Button>
            <Input
              prefix={<Search className="v4-icon" />}
              placeholder="搜索患者/ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 240 }}
            />
          </>
        }
      />

      <Table
        dataSource={studyPagination.pageData}
        columns={columns}
        rowKey="id"
        size="small"
        loading={loading}
        pagination={studyPagination.pagination}
      scroll={{ x: 'max-content' }}
      />

      {/* [v3.0.6.11-88 P0] 新建检查 (POST /eye/studies) */}
      <Modal
        open={createOpen}
        title="新建检查"
        onCancel={() => setCreateOpen(false)}
        onOk={() => void handleCreate()}
        confirmLoading={creating}
        okText="创建"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" size="small" style={{ marginTop: 12 }}>
          <Form.Item name="patientId" label="患者 ID" rules={[{ required: true, message: '请输入患者 ID' }]}>
            <Input placeholder="如 P000001" />
          </Form.Item>
          <Form.Item name="modality" label="检查类型" rules={[{ required: true, message: '请选择检查类型' }]}>
            <Select
              placeholder="选择检查类型"
              options={Object.entries(MODALITY_LABELS)
                .filter(([k]) => !['v6', 'text', 'findings_multi', 'images', 'productivity', 'clinical', 'operational', 'financial', 'critical_value', 'pending_review'].includes(k))
                .map(([value, label]) => ({ value, label }))}
            />
          </Form.Item>
          <Form.Item name="bodyPart" label="检查部位/眼别">
            <Select
              placeholder="选择眼别"
              options={[
                { value: 'OD', label: '右眼 (OD)' },
                { value: 'OS', label: '左眼 (OS)' },
                { value: 'OU', label: '双眼 (OU)' },
              ]}
            />
          </Form.Item>
          <Form.Item name="findings" label="检查所见">
            <Input.TextArea rows={2} placeholder="(可选)" />
          </Form.Item>
          <Form.Item name="impressions" label="印象">
            <Input.TextArea rows={2} placeholder="(可选)" />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default PacsStudyListPage;
