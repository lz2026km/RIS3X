// [v3.0.6.8-47] PR3: 通知 + 模板 + 词典综合管理
import React, { useState, useEffect } from 'react';
import { Card, Space, Tag, Button, Select, Input, Form, Row, Col, message, Tabs, List, Statistic, InputNumber, Modal, Badge, Table, Switch, Avatar } from 'antd';
import { Bell, FileText, BookOpen, Plus, Edit3, CheckCircle2, RefreshCw } from 'lucide-react';
import { notificationApi, templateApi, dictionaryApi } from '@/services/api/notificationTemplateDictApi';

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

  useEffect(() => { loadNotifs(); loadTemplates(); loadDict(); }, []);

  // 操作
  const handleMarkRead = async (id: string) => {
    try {
      const r = await notificationApi.markRead(id);
      if (r.success) { message.success('已读'); loadNotifs(); }
    } catch (e: any) { message.error(e.message); }
  };

  const handleMarkAllRead = async () => {
    try {
      const r = await notificationApi.markAllRead();
      if (r.success) { message.success('全部已读'); loadNotifs(); }
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
      if (r.success) { message.success('保存成功'); setTplModal({ type: null, data: {} }); tplForm.resetFields(); loadTemplates(); }
      else message.error(r.error?.message ?? '保存失败');
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
      if (r.success) { message.success('保存成功'); setDictModal({ type: null, data: {} }); dictForm.resetFields(); loadDict(); }
      else message.error(r.error?.message ?? '保存失败');
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
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Bell size={20} color="#f5222d" />
        <FileText size={20} color="#2563eb" />
        <BookOpen size={20} color="#52c41a" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>通知 · 模板 · 词典</span>
        <Tag color="cyan">PR3 (v3.0.6.8-47)</Tag>
        <Tag color="purple">系统级基础组件</Tag>
        <Tag color="green">12 客户端 + 20 端点</Tag>
      </Space>

      <Tabs activeKey={activeTab} onChange={setActiveTab} type="card">
        {/* 通知中心 */}
        <Tabs.TabPane tab={
          <span>
            <Bell size={14} /> 通知
            {unreadCount > 0 && <Badge count={unreadCount} offset={[8, -2]} />}
          </span>
        } key="notifications">
          <Row gutter={16}>
            <Col span={4}>
              <Card size="small">
                <Statistic title="未读" value={unreadCount} styles={{ content: {  color: '#f5222d'  } }} />
              </Card>
            </Col>
            <Col span={4}>
              <Card size="small">
                <Statistic title="总通知" value={notifs.length} />
              </Card>
            </Col>
            <Col span={4}>
              <Card size="small">
                <Statistic title="危急" value={notifs.filter((n: any) => n.severity === 'critical').length} styles={{ content: {  color: '#f5222d'  } }} />
              </Card>
            </Col>
            <Col span={12}>
              <Space>
                <Button type="primary" icon={<CheckCircle2 size={14} />} onClick={handleMarkAllRead}>全部已读</Button>
                <Button icon={<RefreshCw size={14} />} onClick={loadNotifs}>刷新</Button>
                <Select size="small" value={notifFilter.isRead || undefined} onChange={v => setNotifFilter({ ...notifFilter, isRead: v })} allowClear placeholder="已读/未读" style={{ width: 120 }} options={[{value:'false',label:'未读'},{value:'true',label:'已读'}]} />
                <Select size="small" value={notifFilter.type || undefined} onChange={v => setNotifFilter({ ...notifFilter, type: v })} allowClear placeholder="类型" style={{ width: 120 }} options={['critical','review','system','reminder','task'].map(t=>({value:t,label:t}))} />
              </Space>
            </Col>
          </Row>
          <Card style={{ marginTop: 16 }} size="small">
            <List
              dataSource={filteredNotifs}
              renderItem={(n: any) => (
                <List.Item
                  actions={!n.isRead ? [<Button key="r" type="link" size="small" onClick={() => handleMarkRead(n.id)}>标为已读</Button>] : []}
                >
                  <List.Item.Meta
                    avatar={
                      <Badge dot={!n.isRead}>
                        <Avatar style={{ background: n.severity === 'critical' ? '#f5222d' : n.severity === 'warning' ? '#faad14' : '#2563eb' }}>
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
                        <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
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
        <Tabs.TabPane tab={<span><FileText size={14} /> 模板</span>} key="templates">
          <Card
            title={`报告模板 (${filteredTemplates.length})`}
            size="small"
            extra={
              <Space>
                <Select size="small" value={tplFilter.modality || undefined} onChange={v => setTplFilter({ ...tplFilter, modality: v })} allowClear placeholder="模态" style={{ width: 100 }} options={['CT','MR','DR','US','MG'].map(m=>({value:m,label:m}))} />
                <Select size="small" value={tplFilter.category || undefined} onChange={v => setTplFilter({ ...tplFilter, category: v })} allowClear placeholder="类别" style={{ width: 100 }} options={['CT','MR','DR','US','MG','通用'].map(c=>({value:c,label:c}))} />
                <Button type="primary" icon={<Plus size={14} />} onClick={() => openTplModal('create', { sections: [], isDefault: false })}>新增</Button>
              </Space>
            }
          >
            <Table
              size="small"
              dataSource={filteredTemplates}
              rowKey="id"
              pagination={{ current: tplPage, pageSize: PAGE_SIZE, total: filteredTemplates.length, onChange: setTplPage, showSizeChanger: false }}
              columns={[
                { title: '名称', dataIndex: 'name' },
                { title: '模态', dataIndex: 'modality', render: (m) => <Tag color="blue">{m}</Tag> },
                { title: '类别', dataIndex: 'category' },
                { title: '段数', render: (_, t) => t.sections?.length || 0 },
                { title: '使用', dataIndex: 'usageCount' },
                { title: '默认', dataIndex: 'isDefault', render: (d) => d ? <Tag color="green">是</Tag> : '-' },
                { title: '更新', dataIndex: 'updatedAt', render: (d) => new Date(d).toLocaleDateString('zh-CN') },
                { title: '操作', render: (_, t) => <Button type="link" size="small" icon={<Edit3 size={12} />} onClick={() => openTplModal('update', { ...t })}>编辑</Button> },
              ]}
            scroll={{ x: 'max-content' }}
            />
          </Card>
        </Tabs.TabPane>

        {/* 词典维护 */}
        <Tabs.TabPane tab={<span><BookOpen size={14} /> 词典</span>} key="dictionary">
          <Card
            title={`数据字典 (${filteredDict.length})`}
            size="small"
            extra={
              <Space>
                <Select size="small" value={dictFilter.category || undefined} onChange={v => setDictFilter({ ...dictFilter, category: v })} allowClear placeholder="分类" style={{ width: 150 }} options={['检查项目','诊断','药品','设备','科室','检查部位','报告模板','其他'].map(c=>({value:c,label:c}))} />
                <Input.Search size="small" placeholder="编码/名称" value={dictFilter.keyword} onChange={e => setDictFilter({ ...dictFilter, keyword: e.target.value })} style={{ width: 180 }} />
                <Button type="primary" icon={<Plus size={14} />} onClick={() => openDictModal('create', {})}>新增</Button>
              </Space>
            }
          >
            <Table
              size="small"
              dataSource={filteredDict}
              rowKey="id"
              pagination={{ current: dictPage, pageSize: PAGE_SIZE, total: filteredDict.length, onChange: setDictPage, showSizeChanger: false }}
              columns={[
                { title: '分类', dataIndex: 'category', render: (c) => <Tag color="blue">{c}</Tag> },
                { title: '编码', dataIndex: 'code' },
                { title: '名称', dataIndex: 'name' },
                { title: '英文', dataIndex: 'enName' },
                { title: '说明', dataIndex: 'description' },
                { title: '排序', dataIndex: 'sortOrder' },
                { title: '状态', dataIndex: 'isActive', render: (a) => a ? <Tag color="green">启用</Tag> : <Tag>禁用</Tag> },
                { title: '操作', render: (_, d) => <Button type="link" size="small" icon={<Edit3 size={12} />} onClick={() => openDictModal('update', { ...d })}>编辑</Button> },
              ]}
            scroll={{ x: 'max-content' }}
            />
          </Card>
        </Tabs.TabPane>
      </Tabs>

      {/* 模板 Modal */}
      <Modal
        title={tplModal.type === 'create' ? '新增模板' : '编辑模板'}
        open={!!tplModal.type}
        onCancel={() => { setTplModal({ type: null, data: {} }); tplForm.resetFields(); }}
        onOk={handleTplSave}
        width={600}
      >
        <Form form={tplForm} layout="vertical" size="small" initialValues={{ isDefault: false }}>
          <Row gutter={8}>
            <Col span={16}><Form.Item name="name" label="模板名称" rules={[{ required: true, message: '请输入模板名称' }]}><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="modality" label="模态"><Select options={['CT','MR','DR','US','MG'].map(m=>({value:m,label:m}))} /></Form.Item></Col>
            <Col span={12}><Form.Item name="category" label="类别"><Select options={['CT','MR','DR','US','MG','通用'].map(c=>({value:c,label:c}))} /></Form.Item></Col>
            <Col span={12}><Form.Item name="isDefault" label="设为默认" valuePropName="checked"><Switch /></Form.Item></Col>
            <Col span={24}><Form.Item name="description" label="说明"><TextArea rows={2} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      {/* 词典 Modal */}
      <Modal
        title={dictModal.type === 'create' ? '新增词典项' : '编辑词典项'}
        open={!!dictModal.type}
        onCancel={() => { setDictModal({ type: null, data: {} }); dictForm.resetFields(); }}
        onOk={handleDictSave}
        width={500}
      >
        <Form form={dictForm} layout="vertical" size="small" initialValues={{ sortOrder: 0, isActive: true }}>
          <Row gutter={8}>
            <Col span={12}><Form.Item name="category" label="分类"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="code" label="编码" rules={[{ required: true, message: '请输入编码' }]}><Input /></Form.Item></Col>
            <Col span={24}><Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}><Input /></Form.Item></Col>
            <Col span={24}><Form.Item name="enName" label="英文"><Input /></Form.Item></Col>
            <Col span={24}><Form.Item name="description" label="说明"><TextArea rows={2} /></Form.Item></Col>
            <Col span={12}><Form.Item name="sortOrder" label="排序"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="isActive" label="启用" valuePropName="checked"><Switch /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default NotificationTemplateDictPage;
