// [v3.0.6.8-47] PR3: 通知 + 模板 + 词典综合管理
import React, { useState, useEffect } from 'react';
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
  message,
  Tabs,
  List,
  InputNumber,
  Modal,
  Badge,
  Switch,
  Avatar,
} from "antd";
import { Bell, FileText, BookOpen, Plus, Edit3, CheckCircle2, RefreshCw } from 'lucide-react';
import { notificationApi, templateApi, dictionaryApi } from '@/services/api/notificationTemplateDictApi';
import { LoadingBanner } from '../../components/feedback';
import { t } from '../../i18n/appI18n';
import { DataTable, PageContainer, StatCard, StatCardGrid } from "../../components/common";

const { TextArea } = Input;

export const NotificationTemplateDictPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('notifications');
  // 通知
  const [notifs, setNotifs] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifFilter, setNotifFilter] = useState({ isRead: '', type: '' });

  // 模板
  const [templates, setTemplates] = useState<any[]>([]);
  const [tplModal, setTplModal] = useState<{ type: 'create' | 'update' | null; data: any }>({ type: null, data: {} });
  const [tplFilter, setTplFilter] = useState({ modality: '', category: '' });

  // 词典
  const [dictItems, setDictItems] = useState<any[]>([]);
  const [dictModal, setDictModal] = useState<{ type: 'create' | 'update' | null; data: any }>({ type: null, data: {} });
  const [dictFilter, setDictFilter] = useState({ category: '', keyword: '' });

  const [tplForm] = Form.useForm();
  const [dictForm] = Form.useForm();

  // 分页
  const PAGE_SIZE = 10;
  const [notifPage, setNotifPage] = useState(1);
  const [tplPage, setTplPage] = useState(1);
  const [dictPage, setDictPage] = useState(1);

  // 加载
  const [loading, setLoading] = useState(true);
  const loadNotifs = async () => {
    try {
      const r = await notificationApi.list();
      if (r.success) setNotifs(r.data);
      const u = await notificationApi.unread();
      if (u.success) setUnreadCount(u.data.unread);
    } catch (e: any) { message.error(e.message); }
  };

  const loadTemplates = async () => {
    try {
      const r = await templateApi.list();
      if (r.success) setTemplates(r.data);
    } catch (e: any) { message.error(e.message); }
  };

  const loadDict = async () => {
    try {
      const r = await dictionaryApi.list();
      if (r.success) setDictItems(r.data);
    } catch (e: any) { message.error(e.message); }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await Promise.all([loadNotifs(), loadTemplates(), loadDict()]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 操作
  const handleMarkRead = async (id: string) => {
    try {
      const r = await notificationApi.markRead(id);
      if (r.success) { message.success(t('notificationTemplateDict.markedRead')); loadNotifs(); }
    } catch (e: any) { message.error(e.message); }
  };

  const handleMarkAllRead = async () => {
    try {
      const r = await notificationApi.markAllRead();
      if (r.success) { message.success(t('notificationTemplateDict.allMarkedRead')); loadNotifs(); }
    } catch (e: any) { message.error(e.message); }
  };

  const openTplModal = (type: 'create' | 'update', data: any) => {
    tplForm.setFieldsValue({
      name: data.name,
      modality: data.modality,
      category: data.category,
      isDefault: !!data.isDefault,
      description: data.description,
    });
    setTplModal({ type, data: { ...data, isDefault: !!data.isDefault } });
  };

  const handleTplSave = async () => {
    let values: any;
    try {
      values = await tplForm.validateFields();
    } catch (e: any) {
      if (e?.errorFields?.length) return;
      message.error(e.message);
      return;
    }
    const payload = { ...tplModal.data, ...values, isDefault: !!values.isDefault };
    try {
      let r;
      if (tplModal.type === 'create') r = await templateApi.create(payload);
      else r = await templateApi.update(payload.id, payload);
      if (r.success) { message.success(t('notificationTemplateDict.saveSuccess')); setTplModal({ type: null, data: {} }); tplForm.resetFields(); loadTemplates(); }
      else message.error(r.error?.message ?? t('notificationTemplateDict.saveFailed'));
    } catch (e: any) { message.error(e.message); }
  };

  const openDictModal = (type: 'create' | 'update', data: any) => {
    dictForm.setFieldsValue({
      category: data.category,
      code: data.code,
      name: data.name,
      enName: data.enName,
      description: data.description,
      sortOrder: data.sortOrder || 0,
      isActive: data.isActive !== false,
    });
    setDictModal({ type, data: { ...data } });
  };

  const handleDictSave = async () => {
    let values: any;
    try {
      values = await dictForm.validateFields();
    } catch (e: any) {
      if (e?.errorFields?.length) return;
      message.error(e.message);
      return;
    }
    const payload = { ...dictModal.data, ...values, isActive: !!values.isActive };
    try {
      let r;
      if (dictModal.type === 'create') r = await dictionaryApi.create(payload);
      else r = await dictionaryApi.update(payload.id, payload);
      if (r.success) { message.success(t('notificationTemplateDict.saveSuccess')); setDictModal({ type: null, data: {} }); dictForm.resetFields(); loadDict(); }
      else message.error(r.error?.message ?? t('notificationTemplateDict.saveFailed'));
    } catch (e: any) { message.error(e.message); }
  };

  const filteredNotifs = notifs.filter((n: any) => {
    if (notifFilter.isRead === 'true' && !n.isRead) return false;
    if (notifFilter.isRead === 'false' && n.isRead) return false;
    if (notifFilter.type && n.type !== notifFilter.type) return false;
    return true;
  });

  const filteredTemplates = templates.filter((t: any) => {
    if (tplFilter.modality && t.modality !== tplFilter.modality) return false;
    if (tplFilter.category && t.category !== tplFilter.category) return false;
    return true;
  });

  const filteredDict = dictItems.filter((d: any) => {
    if (dictFilter.category && d.category !== dictFilter.category) return false;
    if (dictFilter.keyword && !d.name?.includes(dictFilter.keyword) && !d.code?.includes(dictFilter.keyword)) return false;
    return true;
  });

  return (
    <PageContainer padding={24}>
      <Space style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Bell size={20} color="#f5222d" />
        <FileText size={20} color="var(--color-primary-600)" />
        <BookOpen size={20} color="#52c41a" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('notificationTemplateDict.title')}</span>
        <Tag color="cyan">PR3 (v3.0.6.8-47)</Tag>
        <Tag color="purple">{t('notificationTemplateDict.systemBasic')}</Tag>
        <Tag color="green">{t('notificationTemplateDict.clientsEndpoints')}</Tag>
      </Space>

      {loading && <LoadingBanner message={t('w9.states.loading')} />}

      <Tabs activeKey={activeTab} onChange={setActiveTab} type="card">
        {/* 通知中心 */}
        <Tabs.TabPane tab={
          <span>
            <Bell size={14} /> {t('notificationTemplateDict.tabNotifications')}
            {unreadCount > 0 && <Badge count={unreadCount} offset={[8, -2]} />}
          </span>
        } key="notifications">
          <Row gutter={16}>
            <Col span={12}>
              <StatCardGrid minWidth={120}>
                <StatCard title={t('notificationTemplateDict.unread')} value={unreadCount} color="error" />
                <StatCard title={t('notificationTemplateDict.totalNotifs')} value={notifs.length} />
                <StatCard title={t('notificationTemplateDict.critical')} value={notifs.filter((n: any) => n.severity === 'critical').length} color="error" />
              </StatCardGrid>
            </Col>
            <Col span={12}>
              <Space>
                <Button type="primary" icon={<CheckCircle2 size={14} />} onClick={handleMarkAllRead}>{t('notificationTemplateDict.allMarkedRead')}</Button>
                <Button icon={<RefreshCw size={14} />} onClick={loadNotifs}>{t('notificationTemplateDict.refresh')}</Button>
                <Select size="small" value={notifFilter.isRead || undefined} onChange={v => setNotifFilter({ ...notifFilter, isRead: v })} allowClear placeholder={t('notificationTemplateDict.readStatus')} style={{ width: 120 }} options={[{value:'false',label:t('notificationTemplateDict.unreadOption')},{value:'true',label:t('notificationTemplateDict.readOption')}]} />
                <Select size="small" value={notifFilter.type || undefined} onChange={v => setNotifFilter({ ...notifFilter, type: v })} allowClear placeholder={t('notificationTemplateDict.typePlaceholder')} style={{ width: 120 }} options={['critical','review','system','reminder','task'].map(v=>({value:v,label:v}))} />
              </Space>
            </Col>
          </Row>
          <Card style={{ marginTop: 'var(--space-4, 16px)' }} size="small">
            <List
              dataSource={filteredNotifs}
              renderItem={(n: any) => (
                <List.Item
                  actions={!n.isRead ? [<Button key="r" type="link" size="small" onClick={() => handleMarkRead(n.id)}>{t('notificationTemplateDict.markAsRead')}</Button>] : []}
                >
                  <List.Item.Meta
                    avatar={
                      <Badge dot={!n.isRead}>
                        <Avatar style={{ background: n.severity === 'critical' ? '#f5222d' : n.severity === 'warning' ? '#faad14' : 'var(--color-primary-600)' }}>
                          {n.type?.slice(0, 1).toUpperCase()}
                        </Avatar>
                      </Badge>
                    }
                    title={
                      <Space>
                        <span style={{ fontWeight: n.isRead ? 400 : 600 }}>{n.title}</span>
                        <Tag color={n.severity === 'critical' ? 'red' : n.severity === 'warning' ? 'orange' : 'blue'}>{n.severity || 'info'}</Tag>
                      </Space>
                    }
                    description={
                      <div>
                        <div>{n.content}</div>
                        <div style={{ fontSize: 11, color: '#999', marginTop: 'var(--space-1, 4px)' }}>
                          {n.patientName || '-'} | {n.doctorName || '-'} | {new Date(n.createdAt).toLocaleString('zh-CN')}
                        </div>
                      </div>
                    }
                  />
                </List.Item>
              )}
              pagination={{ current: notifPage, pageSize: PAGE_SIZE, total: filteredNotifs.length, onChange: setNotifPage, showSizeChanger: false }}
            />
          </Card>
        </Tabs.TabPane>

        {/* 模板管理 */}
        <Tabs.TabPane tab={<span><FileText size={14} /> {t('notificationTemplateDict.tabTemplates')}</span>} key="templates">
          <Card
            title={t('notificationTemplateDict.templateCardTitle', { count: filteredTemplates.length })}
            size="small"
            extra={
              <Space>
                <Select size="small" value={tplFilter.modality || undefined} onChange={v => setTplFilter({ ...tplFilter, modality: v })} allowClear placeholder={t('notificationTemplateDict.modality')} style={{ width: 100 }} options={['CT','MR','DR','US','MG'].map(m=>({value:m,label:m}))} />
                <Select size="small" value={tplFilter.category || undefined} onChange={v => setTplFilter({ ...tplFilter, category: v })} allowClear placeholder={t('notificationTemplateDict.category')} style={{ width: 100 }} options={['CT','MR','DR','US','MG'].map(c=>({value:c,label:c})).concat([{value:t('notificationTemplateDict.general'),label:t('notificationTemplateDict.general')}])} />
                <Button type="primary" icon={<Plus size={14} />} onClick={() => openTplModal('create', { sections: [], isDefault: false })}>{t('notificationTemplateDict.add')}</Button>
              </Space>
            }
          >
            <DataTable
              loading={loading}
              dataSource={filteredTemplates}
              rowKey="id"
              pagination={{ current: tplPage, pageSize: PAGE_SIZE, total: filteredTemplates.length, onChange: setTplPage, showSizeChanger: false }}
              columns={[
                { title: t('notificationTemplateDict.colName'), dataIndex: 'name' },
                { title: t('notificationTemplateDict.modality'), dataIndex: 'modality', render: (m) => <Tag color="blue">{m}</Tag> },
                { title: t('notificationTemplateDict.category'), dataIndex: 'category' },
                { title: t('notificationTemplateDict.sectionCount'), render: (_, row) => row.sections?.length || 0 },
                { title: t('notificationTemplateDict.usage'), dataIndex: 'usageCount' },
                { title: t('notificationTemplateDict.isDefaultCol'), dataIndex: 'isDefault', render: (d) => d ? <Tag color="green">{t('notificationTemplateDict.yes')}</Tag> : '-' },
                { title: t('notificationTemplateDict.updatedAtCol'), dataIndex: 'updatedAt', render: (d) => new Date(d).toLocaleDateString('zh-CN') },
                { title: t('notificationTemplateDict.colActions'), render: (_, row) => <Button type="link" size="small" icon={<Edit3 size={12} />} onClick={() => openTplModal('update', { ...row })}>{t('notificationTemplateDict.edit')}</Button> },
              ]}
            scroll={{ x: 'max-content' }}
            />
          </Card>
        </Tabs.TabPane>

        {/* 词典维护 */}
        <Tabs.TabPane tab={<span><BookOpen size={14} /> {t('notificationTemplateDict.tabDictionary')}</span>} key="dictionary">
          <Card
            title={t('notificationTemplateDict.dictCardTitle', { count: filteredDict.length })}
            size="small"
            extra={
              <Space>
                <Select size="small" value={dictFilter.category || undefined} onChange={v => setDictFilter({ ...dictFilter, category: v })} allowClear placeholder={t('notificationTemplateDict.category')} style={{ width: 150 }} options={[t('notificationTemplateDict.dictCatExam'),t('notificationTemplateDict.dictCatDiagnosis'),t('notificationTemplateDict.dictCatDrug'),t('notificationTemplateDict.dictCatDevice'),t('notificationTemplateDict.dictCatDept'),t('notificationTemplateDict.dictCatBodyPart'),t('notificationTemplateDict.dictCatReportTpl'),t('notificationTemplateDict.dictCatOther')].map(c=>({value:c,label:c}))} />
                <Input.Search size="small" placeholder={t('notificationTemplateDict.codeOrName')} value={dictFilter.keyword} onChange={e => setDictFilter({ ...dictFilter, keyword: e.target.value })} style={{ width: 180 }} />
                <Button type="primary" icon={<Plus size={14} />} onClick={() => openDictModal('create', {})}>{t('notificationTemplateDict.add')}</Button>
              </Space>
            }
          >
            <DataTable
              loading={loading}
              dataSource={filteredDict}
              rowKey="id"
              pagination={{ current: dictPage, pageSize: PAGE_SIZE, total: filteredDict.length, onChange: setDictPage, showSizeChanger: false }}
              columns={[
                { title: t('notificationTemplateDict.category'), dataIndex: 'category', render: (c) => <Tag color="blue">{c}</Tag> },
                { title: t('notificationTemplateDict.code'), dataIndex: 'code' },
                { title: t('notificationTemplateDict.colName'), dataIndex: 'name' },
                { title: t('notificationTemplateDict.english'), dataIndex: 'enName' },
                { title: t('notificationTemplateDict.description'), dataIndex: 'description' },
                { title: t('notificationTemplateDict.sortOrder'), dataIndex: 'sortOrder' },
                { title: t('notificationTemplateDict.status'), dataIndex: 'isActive', render: (a) => a ? <Tag color="green">{t('notificationTemplateDict.enabled')}</Tag> : <Tag>{t('notificationTemplateDict.disabled')}</Tag> },
                { title: t('notificationTemplateDict.colActions'), render: (_, row) => <Button type="link" size="small" icon={<Edit3 size={12} />} onClick={() => openDictModal('update', { ...row })}>{t('notificationTemplateDict.edit')}</Button> },
              ]}
            scroll={{ x: 'max-content' }}
            />
          </Card>
        </Tabs.TabPane>
      </Tabs>

      {/* 模板 Modal */}
      <Modal
        title={tplModal.type === 'create' ? t('notificationTemplateDict.addTemplate') : t('notificationTemplateDict.editTemplate')}
        open={!!tplModal.type}
        onCancel={() => { setTplModal({ type: null, data: {} }); tplForm.resetFields(); }}
        onOk={handleTplSave}
        width={600}
      >
        <Form form={tplForm} layout="vertical" size="small" initialValues={{ isDefault: false }}>
          <Row gutter={8}>
            <Col span={16}><Form.Item name="name" label={t('notificationTemplateDict.templateName')} rules={[{ required: true, message: t('notificationTemplateDict.enterTemplateName') }]}><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="modality" label={t('notificationTemplateDict.modality')}><Select options={['CT','MR','DR','US','MG'].map(m=>({value:m,label:m}))} /></Form.Item></Col>
            <Col span={12}><Form.Item name="category" label={t('notificationTemplateDict.category')}><Select options={['CT','MR','DR','US','MG'].map(c=>({value:c,label:c})).concat([{value:t('notificationTemplateDict.general'),label:t('notificationTemplateDict.general')}])} /></Form.Item></Col>
            <Col span={12}><Form.Item name="isDefault" label={t('notificationTemplateDict.setDefault')} valuePropName="checked"><Switch /></Form.Item></Col>
            <Col span={24}><Form.Item name="description" label={t('notificationTemplateDict.description')}><TextArea rows={2} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      {/* 词典 Modal */}
      <Modal
        title={dictModal.type === 'create' ? t('notificationTemplateDict.addDictItem') : t('notificationTemplateDict.editDictItem')}
        open={!!dictModal.type}
        onCancel={() => { setDictModal({ type: null, data: {} }); dictForm.resetFields(); }}
        onOk={handleDictSave}
        width={500}
      >
        <Form form={dictForm} layout="vertical" size="small" initialValues={{ sortOrder: 0, isActive: true }}>
          <Row gutter={8}>
            <Col span={12}><Form.Item name="category" label={t('notificationTemplateDict.category')}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="code" label={t('notificationTemplateDict.code')} rules={[{ required: true, message: t('notificationTemplateDict.enterCode') }]}><Input /></Form.Item></Col>
            <Col span={24}><Form.Item name="name" label={t('notificationTemplateDict.colName')} rules={[{ required: true, message: t('notificationTemplateDict.enterName') }]}><Input /></Form.Item></Col>
            <Col span={24}><Form.Item name="enName" label={t('notificationTemplateDict.english')}><Input /></Form.Item></Col>
            <Col span={24}><Form.Item name="description" label={t('notificationTemplateDict.description')}><TextArea rows={2} /></Form.Item></Col>
            <Col span={12}><Form.Item name="sortOrder" label={t('notificationTemplateDict.sortOrder')}><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="isActive" label={t('notificationTemplateDict.enabled')} valuePropName="checked"><Switch /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default NotificationTemplateDictPage;
