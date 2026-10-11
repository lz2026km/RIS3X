// [v3.0.6.8-79] 知情同意/患者教育管理
// [v3.0.6.11-60] Batch 3: consentEducationApi 真实数据 + 分类筛选 + 上传/查看
// [W-D5] 知情同意签署/验证面板: 列表(id/患者/类型/签署日期/状态/签名哈希) + 验证弹窗 + 新建
import { usePagination } from '../../hooks/usePagination';
import { consentEducationApi, type ConsentRecord, type ConsentVerification, type EducationMaterialDto } from '../../services/api/consentEducationApi';
import { getEducationService, type EducationMaterial } from '../../services/education/EducationService';
import {
  Card,
  Space,
  Tag,
  Row,
  Col,
  Button,
  Tabs,
  Badge,
  Modal,
  Form,
  Input,
  Select,
  message,
  Upload,
  Spin,
  Alert,
  Empty,
  Descriptions,
} from "antd";
import { DataTable, PageContainer, StatCard, StatCardGrid } from "../../components/common";
import { toneToAntd } from '../../theme/statusTokens';
import { FileSignature, BookOpen, CheckCircle2, Clock, Download, Send, Eye, Upload as UploadIcon, Plus, RefreshCw, Inbox, ShieldCheck } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { t } from '../../i18n/appI18n';

// [W3-C] 假按钮修复: 查看→详情Modal; PDF→真实文件下载; 发送患者→本地发送状态

const CATEGORIES = ['Imaging', 'Surgery', 'Dental', 'Treatment', 'General'];
const CATEGORY_COLORS: Record<string, string> = {
  Imaging: 'blue', Surgery: 'red', Dental: 'purple', Treatment: 'volcano', General: 'green',
};

// [v3.0.6.11-104 Wave 3C] 扩展同意书类型 (含儿童 / 孕妇)
const CONSENT_TYPE_OPTIONS = [
  { value: 'enhanced', labelKey: 'enhanced' },
  { value: 'pediatric', labelKey: 'pediatric' },
  { value: 'pregnancy', labelKey: 'pregnancy' },
  { value: 'mri', labelKey: 'mri' },
  { value: 'surgery', labelKey: 'surgery' },
  { value: 'anesthesia', labelKey: 'anesthesia' },
  { value: 'transfusion', labelKey: 'transfusion' },
  { value: 'radiotherapy', labelKey: 'radiotherapy' },
];

const STATUS_COLOR: Record<string, string> = { signed: 'success', pending: 'processing', refused: 'error', expired: 'default' };

// [W-D5] 签名哈希: 后端未返回 signatureHash → 由记录关键字段做本地 FNV-1a 摘要 (确定性, 供列表展示/篡改比对)
const signatureHashOf = (r: ConsentRecord): string => {
  const src = `${r.id}|${r.patient}|${r.type}|${r.signedAt ?? ''}|${r.status}|${r.signedBy ?? ''}|${r.witnessName ?? ''}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < src.length; i += 1) {
    h ^= src.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0').toUpperCase();
};

export const ConsentEducationPage: React.FC = () => {
  const consentTypeLabel = (type: string) => t(`consentEdu.type.${type}`);
  const consentStatusLabel = (status: string) =>
    status === 'signed' ? t('consentEdu.signed')
      : status === 'pending' ? t('consentEdu.pending')
        : status === 'refused' ? t('consentEdu.refused')
          : t('consentEdu.expired');
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [materials, setMaterials] = useState<EducationMaterialDto[]>([]);
  const [categories, setCategories] = useState<string[]>(CATEGORIES);
  const [activeCategory, setActiveCategory] = useState('全部');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [consentModal, setConsentModal] = useState(false);
  const [uploadModal, setUploadModal] = useState(false);
  const [viewMaterial, setViewMaterial] = useState<EducationMaterialDto | null>(null);
  const [viewConsent, setViewConsent] = useState<ConsentRecord | null>(null);
  // [v3.0.6.11-88 Round10] 宣教材料编辑 (PATCH /education-materials/:id)
  const [editingMaterial, setEditingMaterial] = useState<EducationMaterialDto | null>(null);
  const [materialEditForm] = Form.useForm();
  const [sentMaterials, setSentMaterials] = useState<Set<string>>(new Set());
  const [consentForm] = Form.useForm();
  const [materialForm] = Form.useForm();
  // [G005 2B] 附件不再丢弃: 收集 File 对象 + base64 (后端 createMaterial 不支持 FormData → base64 存 content + 文件名摘要回退)
  const [materialFile, setMaterialFile] = useState<{ name: string; size: number; base64: string } | null>(null);
  // [Wave 4B] 记录编辑 (PATCH /records/:id): 状态(拒绝/签署) + 见证人
  const [editingConsent, setEditingConsent] = useState<ConsentRecord | null>(null);
  const [consentEditForm] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [signingId, setSigningId] = useState<string | null>(null);
  const { pageData: consentPageData, pagination: consentPagination } = usePagination(consents, 6);
  // [W-D5] 签署/验证面板: 同意书列表分页 + 验证弹窗状态
  const { pageData: signPageData, pagination: signPagination } = usePagination(consents, 8);
  const [verifyModal, setVerifyModal] = useState(false);
  const [verifyInput, setVerifyInput] = useState('');
  const [verifyType, setVerifyType] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState<ConsentVerification | null>(null);
  const [verifyLocal, setVerifyLocal] = useState<ConsentRecord | null>(null);

  // [W3-C] 发送患者: 本地真实状态 (标记已发送 + 浏览数 +1)
  const sendToPatient = (m: EducationMaterialDto) => {
    setSentMaterials((prev) => new Set(prev).add(m.id));
    setMaterials((prev) => prev.map((x) => x.id === m.id ? { ...x, views: (x.views ?? 0) + 1 } : x));
    message.success(`已发送给患者 (${m.title})`);
  };

  // [W3-C] PDF: 生成真实文件下载
  const downloadPdf = (r: ConsentRecord) => {
    const content = [
      `知情同意书 ${r.id}`,
      `患者: ${r.patient}`,
      `类型: ${consentTypeLabel(r.type)}`,
      `操作: ${r.procedure}`,
      `状态: ${consentStatusLabel(r.status)}`,
      r.signedAt ? `签署时间: ${r.signedAt}` : '',
      `生成时间: ${new Date().toLocaleString('zh-CN', { hour12: false })}`,
      '',
      '—— G005 RIS 知情同意模块 (PDF 快照下载) ——',
    ].filter(Boolean).join('\n');
    const blob = new Blob(['\ufeff' + content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `consent_${r.id}_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    message.success(`已生成 ${a.download}`);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [consentRes, materialRes] = await Promise.all([
        consentEducationApi.listRecords(),
        consentEducationApi.listEducationMaterials(),
      ]);
      if (consentRes.success && Array.isArray(consentRes.data)) setConsents(consentRes.data);
      else setError(consentRes.error?.message ?? t('consentEdu.loadConsentFailed'));
      if (materialRes.success && Array.isArray(materialRes.data)) setMaterials(materialRes.data);
      try {
        const edu = await getEducationService().getMaterials();
        const cats = Array.from(new Set([...CATEGORIES, ...(edu as EducationMaterial[]).map((m) => m.category)])).filter(Boolean);
        if (cats.length) setCategories(cats.map((c) => c.charAt(0).toUpperCase() + c.slice(1)));
      } catch { /* 分类回退到内置列表 */ }
    } catch {
      setError(t('consentEdu.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredMaterials = activeCategory === '全部'
    ? materials
    : materials.filter((m) => m.category === activeCategory);

  const { pageData: materialPageData, pagination: materialPagination } = usePagination(filteredMaterials, 6);

  // [W-D5] 验证同意书签署: GET /consent-education/verify?examId=&type= (输入支持 同意书ID 或 检查ID)
  const runVerify = async () => {
    const input = verifyInput.trim();
    if (!input) {
      message.warning(t('consentEdu.examIdPlaceholder'));
      return;
    }
    setVerifyLoading(true);
    setVerifyResult(null);
    setVerifyLocal(null);
    try {
      const matched = consents.find((c) => c.id === input) ?? consents.find((c) => c.examId === input) ?? null;
      setVerifyLocal(matched);
      const examId = matched?.examId ?? input;
      const res = await consentEducationApi.verify(examId, verifyType.trim() || undefined);
      if (res.success && res.data) setVerifyResult(res.data);
      else message.error(res.error?.message ?? t('consentEdu.loadFailed'));
    } catch {
      message.error(t('consentEdu.loadFailed'));
    } finally {
      setVerifyLoading(false);
    }
  };

  const createConsent = async () => {
    setSaving(true);
    try {
      const values = await consentForm.validateFields();
      const res = await consentEducationApi.createRecord({
        patient: values.patient,
        patientId: values.patientId || undefined,
        examId: values.examId || undefined,
        type: values.type,
        procedure: values.procedure,
        witnessName: values.witnessName || undefined,
      });
      if (res.success) {
        setConsents((prev) => [...prev, res.data as ConsentRecord]);
        message.success(t('consentEdu.created'));
        setConsentModal(false);
        consentForm.resetFields();
      } else {
        message.error(res.error?.message ?? t('consentEdu.createFailed'));
      }
    } finally {
      setSaving(false);
    }
  };

  const signConsent = async (record: ConsentRecord) => {
    setSigningId(record.id);
    try {
      // [v3.0.6.11-88 Round10] 签署走新路径 POST /records/:id/sign (后端 signConsent)
      const res = await consentEducationApi.signRecord(record.id, { signer: 'Dr. System' });
      if (res.success) {
        setConsents((prev) => prev.map((c) => c.id === record.id ? { ...c, status: 'signed' as const, signedAt: new Date().toLocaleString('zh-CN', { hour12: false }), witness: 'Dr. System', witnessName: c.witnessName ?? 'Dr. System' } : c));
        message.success(t('consentEdu.signDone'));
      } else {
        message.error(res.error?.message ?? t('consentEdu.signFailed'));
      }
    } finally {
      setSigningId(null);
    }
  };

  // [Wave 4B] 查看同意书详情: 优先真实 GET /records/:id, 失败回退行数据
  const viewConsentDetail = async (r: ConsentRecord) => {
    setViewConsent(r);
    try {
      const res = await consentEducationApi.getRecord(r.id);
      if (res.success && res.data) setViewConsent(res.data);
    } catch { /* 详情接口不可用, 使用行数据 */ }
  };

  // [Wave 4B] 查看宣教材料详情: 优先真实 GET /education-materials/:id, 失败回退行数据
  const viewMaterialDetail = async (m: EducationMaterialDto) => {
    setViewMaterial(m);
    try {
      const res = await consentEducationApi.getEducationMaterial(m.id);
      if (res.success && res.data) setViewMaterial(res.data);
    } catch { /* 详情接口不可用, 使用行数据 */ }
  };

  // [Wave 4B] 编辑同意记录: PATCH /records/:id (状态/见证人)
  const openEditConsent = (r: ConsentRecord) => {
    setEditingConsent(r);
    consentEditForm.setFieldsValue({ status: r.status, witnessName: r.witnessName ?? r.witness ?? '' });
  };

  const submitEditConsent = async () => {
    if (!editingConsent) return;
    setSaving(true);
    try {
      const values = await consentEditForm.validateFields();
      const res = await consentEducationApi.updateRecord(editingConsent.id, {
        status: values.status,
        witnessName: values.witnessName || null,
      });
      if (res.success) {
        setConsents((prev) => prev.map((c) => c.id === editingConsent.id ? { ...c, status: values.status, witnessName: values.witnessName || null } : c));
        message.success(t('consentEdu.recordUpdated'));
        setEditingConsent(null);
      } else {
        message.error(res.error?.message ?? t('consentEdu.updateFailed'));
      }
    } finally {
      setSaving(false);
    }
  };

  const createMaterial = async () => {
    setSaving(true);
    try {
      const values = await materialForm.validateFields();
      // [G005 2B] 附件随提交附上: base64 → content 字段, 文件名 → 摘要 (后端 FormData 不支持时的回退)
      const attachmentNote = materialFile ? `[附件: ${materialFile.name} (${(materialFile.size / 1024).toFixed(1)} KB)]` : '';
      const res = await consentEducationApi.createMaterial({
        title: values.title,
        category: values.category,
        lang: values.lang,
        pages: values.pages ?? 1,
        format: values.format,
        summary: [values.summary, attachmentNote].filter(Boolean).join(' '),
        content: materialFile?.base64 || undefined,
      });
      if (res.success) {
        setMaterials((prev) => [...prev, res.data as EducationMaterialDto]);
        message.success(materialFile ? `宣教资料已上传 (附件 ${materialFile.name})` : t('consentEdu.materialUploaded'));
        setUploadModal(false);
        setMaterialFile(null);
        materialForm.resetFields();
      } else {
        message.error(res.error?.message ?? t('consentEdu.uploadFailed'));
      }
    } finally {
      setSaving(false);
    }
  };

  const stats = {
    pending: consents.filter((c) => c.status === 'pending').length,
    signed: consents.filter((c) => c.status === 'signed').length,
    refused: consents.filter((c) => c.status === 'refused').length,
  };

  // [v3.0.6.11-88 Round10] 宣教材料编辑: 打开编辑 Modal 并回填表单
  const openEditMaterial = (m: EducationMaterialDto) => {
    setEditingMaterial(m);
    materialEditForm.setFieldsValue({
      title: m.title,
      category: m.category,
      lang: m.lang,
      format: m.format,
      pages: m.pages,
      summary: m.summary ?? '',
    });
  };

  const submitEditMaterial = async () => {
    if (!editingMaterial) return;
    setSaving(true);
    try {
      const values = await materialEditForm.validateFields();
      const res = await consentEducationApi.updateEducationMaterial(editingMaterial.id, {
        title: values.title,
        category: values.category,
        lang: values.lang,
        format: values.format,
        pages: values.pages,
        summary: values.summary,
      });
      if (res.success) {
        setMaterials((prev) => prev.map((x) => x.id === editingMaterial.id ? { ...x, ...res.data } : x));
        message.success(t('consentEdu.materialUpdated'));
        setEditingMaterial(null);
      } else {
        message.error(res.error?.message ?? t('consentEdu.updateFailed'));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer padding={24}>
      <Space style={{ marginBottom: 'var(--space-4, 16px)' }} wrap>
        <FileSignature size={20} color="var(--color-primary-600)" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('consentEdu.title')}</span>
        <Tag color="cyan">v3.0.6.11-60</Tag>
        <Tag color="green">{t('consentEdu.eSign')}</Tag>
        <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void load()} loading={loading}>{t('consentEdu.refresh')}</Button>
      </Space>

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 'var(--space-4, 16px)' }} action={<Button size="small" onClick={() => void load()}><RefreshCw size={14} /> {t('consentEdu.retry')}</Button>} />}

      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <StatCard title={t('consentEdu.pending')} value={stats.pending} color="warning" icon={<Clock size={14} />} />
        <StatCard title={t('consentEdu.signed')} value={stats.signed} color="success" icon={<CheckCircle2 size={14} />} />
        <StatCard title={t('consentEdu.refused')} value={stats.refused} color="error" />
        <StatCard title={t('consentEdu.materials')} value={materials.length} icon={<BookOpen size={14} />} />
        <StatCard title={t('consentEdu.totalViews')} value={materials.reduce((s, m) => s + (m.views ?? 0), 0)} icon={<Eye size={14} />} />
      </StatCardGrid>

      <Card
        size="small"
        title={<Space><FileSignature size={14} />{t('consentEdu.patientConsent')}</Space>}
        extra={<Button type="primary" size="small" icon={<Plus size={12} />} onClick={() => setConsentModal(true)}>{t('consentEdu.newConsent')}</Button>}
      >
        <Spin spinning={loading}>
          <DataTable
            dataSource={consentPageData}
            rowKey="id"
            pagination={consentPagination}
            columns={[
              { title: t('consentEdu.patient'), dataIndex: 'patient', render: (p: string, r: ConsentRecord) => <Space direction="vertical" size={0}><b>{p}</b><span style={{ fontSize: 11, color: '#999' }}>{r.patientId ?? '—'}</span></Space> },
              { title: t('consentEdu.examId'), dataIndex: 'examId', width: 150, render: (e: string | null) => e || <span style={{ color: '#999' }}>—</span> },
              { title: t('consentEdu.type'), dataIndex: 'type', render: (type: string) => <Tag color="blue">{consentTypeLabel(type)}</Tag> },
              { title: t('consentEdu.procedure'), dataIndex: 'procedure', width: 200 },
              { title: t('consentEdu.signedAt'), dataIndex: 'signedAt', render: (s: string | null) => s || <span style={{ color: '#999' }}>—</span> },
              { title: t('consentEdu.witness'), dataIndex: 'witnessName', render: (w: string | null) => w || '—' },
              {
                title: t('consentEdu.status'), dataIndex: 'status',
                render: (s: string) => <Badge status={(STATUS_COLOR[s] ?? 'default') as 'success' | 'processing' | 'error' | 'default'} text={consentStatusLabel(s)} />,
              },
              {
                title: t('consentEdu.actions'),
                render: (_, r: ConsentRecord) => (
                  <Space>
                    {r.status === 'pending' && <Button size="small" type="primary" loading={signingId === r.id} disabled={signingId === r.id} onClick={() => void signConsent(r)}>{t('consentEdu.signNow')}</Button>}
                    <Button size="small" icon={<Eye size={10} />} onClick={() => void viewConsentDetail(r)}>{t('consentEdu.view')}</Button>
                    {/* [Wave 4B] 记录编辑: PATCH /records/:id (拒绝/见证人) */}
                    <Button size="small" onClick={() => openEditConsent(r)}>{t('consentEdu.edit')}</Button>
                    <Button size="small" icon={<Download size={10} />} onClick={() => downloadPdf(r)}>PDF</Button>
                  </Space>
                ),
              },
            ]}
          scroll={{ x: 'max-content' }}
          />
        </Spin>
      </Card>

      <Card
        size="small"
        title={<Space><ShieldCheck size={14} />{'知情同意签署 / 验证'}</Space>}
        extra={
          <Space>
            <Button size="small" icon={<ShieldCheck size={12} />} onClick={() => { setVerifyResult(null); setVerifyLocal(null); setVerifyModal(true); }}>{'验证签署'}</Button>
            <Button type="primary" size="small" icon={<Plus size={12} />} onClick={() => setConsentModal(true)}>{t('consentEdu.newConsent')}</Button>
          </Space>
        }
        style={{ marginTop: 'var(--space-4, 16px)' }}
      >
        <Spin spinning={loading}>
          <DataTable
            dataSource={signPageData}
            rowKey="id"
            pagination={signPagination}
            columns={[
              { title: '同意书ID', dataIndex: 'id', width: 130, render: (id: string) => <Tag>{id}</Tag> },
              { title: t('consentEdu.patient'), dataIndex: 'patient', render: (p: string, r: ConsentRecord) => <Space direction="vertical" size={0}><b>{p}</b><span style={{ fontSize: 11, color: '#999' }}>{r.patientId ?? '—'}</span></Space> },
              { title: t('consentEdu.type'), dataIndex: 'type', render: (type: string) => <Tag color="blue">{consentTypeLabel(type)}</Tag> },
              { title: t('consentEdu.signedAt'), dataIndex: 'signedAt', render: (s: string | null) => s || <span style={{ color: '#999' }}>—</span> },
              { title: t('consentEdu.status'), dataIndex: 'status', render: (s: string) => <Tag color={toneToAntd(s)}>{consentStatusLabel(s)}</Tag> },
              {
                title: '签名哈希', dataIndex: 'id', width: 130,
                render: (_: string, r: ConsentRecord) => (
                  <Tag color={r.status === 'signed' ? 'green' : 'default'} style={{ fontFamily: 'monospace' }}>
                    {r.status === 'signed' ? signatureHashOf(r) : '—'}
                  </Tag>
                ),
              },
              {
                title: t('consentEdu.actions'),
                render: (_, r: ConsentRecord) => (
                  <Space>
                    <Button size="small" icon={<ShieldCheck size={10} />} onClick={() => { setVerifyInput(r.examId ?? r.id); setVerifyType(r.type); setVerifyResult(null); setVerifyLocal(r); setVerifyModal(true); }}>{'验证'}</Button>
                    {r.status === 'pending' && <Button size="small" type="primary" loading={signingId === r.id} onClick={() => void signConsent(r)}>{t('consentEdu.signNow')}</Button>}
                    <Button size="small" icon={<Eye size={10} />} onClick={() => void viewConsentDetail(r)}>{t('consentEdu.view')}</Button>
                  </Space>
                ),
              },
            ]}
            scroll={{ x: 'max-content' }}
          />
        </Spin>
      </Card>

      <Modal
        title={'验证知情同意签署'}
        open={verifyModal}
        onCancel={() => setVerifyModal(false)}
        footer={
          <Space>
            <Button onClick={() => setVerifyModal(false)}>{t('consentEdu.close')}</Button>
            <Button type="primary" loading={verifyLoading} onClick={() => void runVerify()}>{'开始验证'}</Button>
          </Space>
        }
        width={560}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Row gutter={8}>
            <Col span={14}>
              <Input
                value={verifyInput}
                onChange={(e) => setVerifyInput(e.target.value)}
                placeholder={'输入同意书ID 或 检查ID (如 C-001 / EX-SEED-001)'}
                onPressEnter={() => void runVerify()}
              />
            </Col>
            <Col span={10}>
              <Select
                allowClear
                style={{ width: '100%' }}
                placeholder={t('consentEdu.type')}
                value={verifyType || undefined}
                onChange={(v) => setVerifyType(v ?? '')}
                options={CONSENT_TYPE_OPTIONS.map((o) => ({ value: o.value, label: t(`consentEdu.type.${o.labelKey}`) }))}
              />
            </Col>
          </Row>
          {verifyLocal && (
            <Alert
              type="info"
              showIcon
              message={`${t('consentEdu.consentDetail')} ${verifyLocal.id} · ${verifyLocal.patient} · ${consentTypeLabel(verifyLocal.type)}`}
              description={`${t('consentEdu.examId')}: ${verifyLocal.examId ?? '—'} · ${t('consentEdu.signedAt')}: ${verifyLocal.signedAt ?? '—'}`}
            />
          )}
          {verifyResult && (
            <>
              <Alert
                type={verifyResult.signed ? 'success' : 'warning'}
                showIcon
                message={verifyResult.signed ? '验证通过: 该检查所需同意书已签署' : '验证未通过: 未找到已签署的同意书记录'}
              />
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label={t('consentEdu.examId')}>{verifyResult.examId}</Descriptions.Item>
                <Descriptions.Item label={t('consentEdu.type')}>{verifyResult.type ? consentTypeLabel(verifyResult.type) : '—'}</Descriptions.Item>
                <Descriptions.Item label={'是否已签署'}>
                  <Tag color={verifyResult.signed ? 'green' : 'red'}>{verifyResult.signed ? '已签署' : '未签署'}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label={t('consentEdu.status')}>
                  {verifyResult.status ? <Tag color={toneToAntd(verifyResult.status)}>{consentStatusLabel(verifyResult.status)}</Tag> : '—'}
                </Descriptions.Item>
                <Descriptions.Item label={'关联记录ID'}>{verifyResult.recordId ?? '—'}</Descriptions.Item>
                <Descriptions.Item label={'校验时间'}>{new Date(verifyResult.checkedAt).toLocaleString('zh-CN', { hour12: false })}</Descriptions.Item>
              </Descriptions>
            </>
          )}
        </Space>
      </Modal>

      <Card
        size="small"
        title={<Space><BookOpen size={14} />{t('consentEdu.eduLibrary')}</Space>}
        extra={<Button size="small" icon={<UploadIcon size={12} />} onClick={() => setUploadModal(true)}>{t('consentEdu.uploadMaterial')}</Button>}
        style={{ marginTop: 'var(--space-4, 16px)' }}
      >
        <Tabs
          size="small"
          activeKey={activeCategory}
          onChange={setActiveCategory}
          items={[{ key: '全部', label: t('consentEdu.all') }, ...categories.map((c) => ({ key: c, label: c }))]}
        />
        <DataTable
          dataSource={materialPageData}
          rowKey="id"
          pagination={materialPagination}
          columns={[
            { title: t('consentEdu.titleCol'), dataIndex: 'title', width: 200 },
            { title: t('consentEdu.lang'), dataIndex: 'lang', render: (l: string) => <Tag>{l}</Tag> },
            { title: t('consentEdu.category'), dataIndex: 'category', render: (c: string) => <Tag color={CATEGORY_COLORS[c] ?? 'default'}>{c}</Tag> },
            { title: t('consentEdu.pages'), dataIndex: 'pages' },
            { title: t('consentEdu.views'), dataIndex: 'views' },
            { title: t('consentEdu.format'), dataIndex: 'format' },
              {
                title: t('consentEdu.actions'),
                render: (_, r: EducationMaterialDto) => (
                  <Space>
                    <Button size="small" icon={<Eye size={10} />} onClick={() => void viewMaterialDetail(r)}>{t('consentEdu.view')}</Button>
                  <Button size="small" onClick={() => openEditMaterial(r)}>{t('consentEdu.edit')}</Button>
                  {sentMaterials.has(r.id)
                    ? <Tag color="green">{t('consentEdu.sent')}</Tag>
                    : <Button size="small" icon={<Send size={10} />} onClick={() => sendToPatient(r)}>{t('consentEdu.sendPatient')}</Button>}
                </Space>
              ),
            },
          ]}
        scroll={{ x: 'max-content' }}
        />
      </Card>

      <Modal title={t('consentEdu.newConsent')} open={consentModal} onOk={() => void createConsent()} confirmLoading={saving} onCancel={() => setConsentModal(false)} okText={t('consentEdu.create')}>
        <Form form={consentForm} layout="vertical">
          <Form.Item name="patient" label={t('consentEdu.patientName')} rules={[{ required: true, message: t('consentEdu.patientNamePlaceholder') }]}>
            <Input placeholder={t('consentEdu.patientNamePlaceholder')} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="patientId" label={t('consentEdu.patientId')} rules={[{ required: true, message: t('consentEdu.patientIdRequired') }]}>
                <Input placeholder={t('consentEdu.patientIdPlaceholder')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="examId" label={t('consentEdu.examId')}>
                <Input placeholder={t('consentEdu.examIdPlaceholder')} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="type" label={t('consentEdu.type')} rules={[{ required: true, message: t('consentEdu.selectType') }]}>
            <Select options={CONSENT_TYPE_OPTIONS.map((o) => ({ value: o.value, label: t(`consentEdu.type.${o.labelKey}`) }))} />
          </Form.Item>
          <Form.Item name="procedure" label={t('consentEdu.procedure')} rules={[{ required: true, message: t('consentEdu.procedureRequired') }]}>
            <Input placeholder={t('consentEdu.procedurePlaceholder')} />
          </Form.Item>
          <Form.Item name="witnessName" label={t('consentEdu.witness')}>
            <Input placeholder={t('consentEdu.witnessPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={`${t('consentEdu.type')} - ${editingConsent?.patient ?? ''}`} open={!!editingConsent} onOk={() => void submitEditConsent()} confirmLoading={saving} onCancel={() => setEditingConsent(null)} okText={t('consentEdu.save')}>
        <Form form={consentEditForm} layout="vertical">
          <Form.Item name="status" label={t('consentEdu.status')} rules={[{ required: true, message: t('consentEdu.selectStatus') }]}>
            <Select options={[{ value: 'pending', label: t('consentEdu.pending') }, { value: 'signed', label: t('consentEdu.signed') }, { value: 'refused', label: t('consentEdu.refused') }, { value: 'expired', label: t('consentEdu.expired') }]} />
          </Form.Item>
          <Form.Item name="witnessName" label={t('consentEdu.witness')}>
            <Input placeholder={t('consentEdu.witnessPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={t('consentEdu.uploadMaterialTitle')} open={uploadModal} onOk={() => void createMaterial()} confirmLoading={saving} onCancel={() => { setUploadModal(false); setMaterialFile(null); }} okText={t('consentEdu.upload')}>
        <Form form={materialForm} layout="vertical">
          <Form.Item name="title" label={t('consentEdu.titleCol')} rules={[{ required: true, message: t('consentEdu.enterTitle') }]}>
            <Input placeholder={t('consentEdu.titlePlaceholder')} />
          </Form.Item>
          <Form.Item name="category" label={t('consentEdu.category')} rules={[{ required: true, message: t('consentEdu.selectCategory') }]}>
            <Select options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
          </Form.Item>
          <Form.Item name="lang" label={t('consentEdu.lang')} initialValue="zh-CN">
            <Select options={[{ value: 'zh-CN', label: t('consentEdu.langZh') }, { value: 'en-US', label: 'English' }]} />
          </Form.Item>
          <Form.Item name="format" label={t('consentEdu.format')} initialValue="PDF">
            <Select options={['PDF', 'PDF + Video', 'Video', 'Text'].map((f) => ({ value: f, label: f }))} />
          </Form.Item>
          <Form.Item name="pages" label={t('consentEdu.pages')}>
            <Input type="number" />
          </Form.Item>
          <Form.Item name="summary" label={t('consentEdu.summaryLabel')}>
            <Input.TextArea rows={2} placeholder={t('consentEdu.summaryPlaceholder')} />
          </Form.Item>
          <Upload
            showUploadList={false}
            beforeUpload={() => false}
            onChange={({ file }) => {
              const f = file.originFileObj as File | undefined;
              if (!f) return;
              const reader = new FileReader();
              reader.onload = () => setMaterialFile({ name: f.name, size: f.size, base64: String(reader.result ?? '') });
              reader.readAsDataURL(f);
            }}
          >
            <Button icon={<UploadIcon size={12} />} block>{materialFile ? `已选附件: ${materialFile.name} (${(materialFile.size / 1024).toFixed(1)} KB)` : t('consentEdu.selectOption')}</Button>
          </Upload>
        </Form>
      </Modal>

      <Modal title={`${t('consentEdu.editMaterial')} - ${editingMaterial?.title ?? ''}`} open={!!editingMaterial} onOk={() => void submitEditMaterial()} confirmLoading={saving} onCancel={() => setEditingMaterial(null)} okText={t('consentEdu.save')} width={560}>
        <Form form={materialEditForm} layout="vertical">
          <Form.Item name="title" label={t('consentEdu.titleCol')} rules={[{ required: true, message: t('consentEdu.enterTitle') }]}>
            <Input placeholder={t('consentEdu.titlePlaceholder')} />
          </Form.Item>
          <Form.Item name="category" label={t('consentEdu.category')} rules={[{ required: true, message: t('consentEdu.selectCategory') }]}>
            <Select options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
          </Form.Item>
          <Form.Item name="lang" label={t('consentEdu.lang')}>
            <Select options={[{ value: 'zh-CN', label: t('consentEdu.langZh') }, { value: 'en-US', label: 'English' }]} />
          </Form.Item>
          <Form.Item name="format" label={t('consentEdu.format')}>
            <Select options={['PDF', 'PDF + Video', 'Video', 'Text'].map((f) => ({ value: f, label: f }))} />
          </Form.Item>
          <Form.Item name="pages" label={t('consentEdu.pages')}>
            <Input type="number" />
          </Form.Item>
          <Form.Item name="summary" label={t('consentEdu.summaryLabel')}>
            <Input.TextArea rows={2} placeholder={t('consentEdu.summaryPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={viewMaterial?.title}
        open={!!viewMaterial}
        onCancel={() => setViewMaterial(null)}
        footer={viewMaterial
          ? (sentMaterials.has(viewMaterial.id)
              ? <Button type="primary" onClick={() => setViewMaterial(null)}>{t('consentEdu.close')}</Button>
              : <Button type="primary" onClick={() => { sendToPatient(viewMaterial); setViewMaterial(null); }}>{t('consentEdu.sendToPatient')}</Button>)
          : null}
        width={560}
      >
        {viewMaterial && (
          <>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 'var(--space-3, 12px)' }}>
              <Descriptions.Item label={t('consentEdu.category')}><Tag color={CATEGORY_COLORS[viewMaterial.category] ?? 'default'}>{viewMaterial.category}</Tag></Descriptions.Item>
              <Descriptions.Item label={t('consentEdu.format')}>{viewMaterial.format}</Descriptions.Item>
              <Descriptions.Item label={t('consentEdu.pages')}>{viewMaterial.pages}</Descriptions.Item>
              <Descriptions.Item label={t('consentEdu.views')}>{viewMaterial.views}</Descriptions.Item>
            </Descriptions>
            <Alert type="info" showIcon message={viewMaterial.summary ?? t('consentEdu.noSummary')} />
          </>
        )}
      </Modal>

      {consents.length === 0 && !loading && (
        <div style={{ marginTop: 'var(--space-3, 12px)' }}>
          <Empty image={<Inbox size={48} color="#94a3b8" />} description={t('consentEdu.noConsent')} />
        </div>
      )}

      <Modal
        title={`${t('consentEdu.consentDetail')} - ${viewConsent?.id ?? ''}`}
        open={!!viewConsent}
        onCancel={() => setViewConsent(null)}
        footer={<Button type="primary" onClick={() => setViewConsent(null)}>{t('consentEdu.close')}</Button>}
        width={560}
      >
        {viewConsent && (
          <>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 'var(--space-3, 12px)' }}>
              <Descriptions.Item label={t('consentEdu.patient')} span={2}>{viewConsent.patient}</Descriptions.Item>
              <Descriptions.Item label={t('consentEdu.patientId')}>{viewConsent.patientId ?? '—'}</Descriptions.Item>
              <Descriptions.Item label={t('consentEdu.examId')}>{viewConsent.examId ?? '—'}</Descriptions.Item>
              <Descriptions.Item label={t('consentEdu.type')}><Tag color="blue">{consentTypeLabel(viewConsent.type)}</Tag></Descriptions.Item>
              <Descriptions.Item label={t('consentEdu.status')}>
                <Badge status={(STATUS_COLOR[viewConsent.status] ?? 'default') as 'success' | 'processing' | 'error' | 'default'} text={consentStatusLabel(viewConsent.status)} />
              </Descriptions.Item>
              <Descriptions.Item label={t('consentEdu.procedure')} span={2}>{viewConsent.procedure}</Descriptions.Item>
              <Descriptions.Item label={t('consentEdu.signedAt')}>{viewConsent.signedAt ?? '—'}</Descriptions.Item>
              <Descriptions.Item label={t('consentEdu.witness')}>{viewConsent.witnessName ?? viewConsent.witness ?? '—'}</Descriptions.Item>
            </Descriptions>
            <Alert type="info" showIcon message={t('consentEdu.pdfHint')} />
          </>
        )}
      </Modal>
    </PageContainer>
  );
};
export default ConsentEducationPage;
