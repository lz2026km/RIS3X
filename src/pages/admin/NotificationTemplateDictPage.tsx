// [v3.0.6.8-47] PR3: 通知 + 模板 + 词典综合管理
import React, { useState, useEffect } from 'react';
import {
  Card, Space, Tag, Button, Select, Input, Form, Row, Col, Divider, message,
  Tabs, List, Empty, Statistic, Alert, InputNumber, Modal, Badge,
  Table, Tree, Switch, Tooltip, Avatar, Descriptions,
} from 'antd';
import {
  Bell, FileText, BookOpen, Plus, Edit3, Trash2, Send, CheckCircle2,
  Search, Filter, Mail, MessageSquare, Volume2, Smartphone, Hash,
  AlertCircle, Activity, Clock, Save, X, ChevronRight, RefreshCw,
} from 'lucide-react';
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

  // 加载
  const loadNotifs = async () => {
    try {
      const r = await notificationApi.list({ pageSize: 50 });
      if (r.success) setNotifs(r.data);
      const u = await notificationApi.unread();
      if (u.success) setUnreadCount(u.data.unread);
    } catch (e: any) { message.error(e.message); }
  };

  const loadTemplates = async () => {
    try {
      const r = await templateApi.list({ pageSize: 50 });
      if (r.success) setTemplates(r.data);
    } catch (e: any) { message.error(e.message); }
  };

  const loadDict = async () => {
    try {
      const r = await dictionaryApi.list({ pageSize: 100 });
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

  const handleTplSave = async () => {
    if (!tplModal.data.name) return message.warning('请填写名称');
    try {
      let r;
      if (tplModal.type === 'create') r = await templateApi.create(tplModal.data);
      else r = await templateApi.update(tplModal.data.id, tplModal.data);
      if (r.success) { message.success('保存成功'); setTplModal({ type: null, data: {} }); loadTemplates(); }
    } catch (e: any) { message.error(e.message); }
  };

  const handleDictSave = async () => {
    if (!dictModal.data.code || !dictModal.data.name) return message.warning('请填写编码和名称');
    try {
      let r;
      if (dictModal.type === 'create') r = await dictionaryApi.create(dictModal.data);
      else r = await dictionaryApi.update(dictModal.data.id, dictModal.data);
      if (r.success) { message.success('保存成功'); setDictModal({ type: null, data: {} }); loadDict(); }
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
        <FileText size={20} color="#1677ff" />
        <BookOpen size={20} color="#52c41a" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>通知 · 模板 · 词典</span>
        <Tag color="cyan">PR3 (v3.0.6.8-47)</Tag>
        <Tag color="purple">系统级基础组件</Tag>
        <Tag color="green">12 client + 20 端点</Tag>
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
                <Statistic title="未读" value={unreadCount} valueStyle={{ color: '#f5222d' }} />
              </Card>
            </Col>
            <Col span={4}>
              <Card size="small">
                <Statistic title="总通知" value={notifs.length} />
              </Card>
            </Col>
            <Col span={4}>
              <Card size="small">
                <Statistic title="危急" value={notifs.filter((n: any) => n.severity === 'critical').length} valueStyle={{ color: '#f5222d' }} />
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
                        <Avatar style={{ background: n.severity === 'critical' ? '#f5222d' : n.severity === 'warning' ? '#faad14' : '#1677ff' }}>
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
              pagination={{ pageSize: 10 }}
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
                <Button type="primary" icon={<Plus size={14} />} onClick={() => setTplModal({ type: 'create', data: { sections: [], isDefault: false } })}>新增</Button>
              </Space>
            }
          >
            <Table
              size="small"
              dataSource={filteredTemplates}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              columns={[
                { title: '名称', dataIndex: 'name' },
                { title: '模态', dataIndex: 'modality', render: (m) => <Tag color="blue">{m}</Tag> },
                { title: '类别', dataIndex: 'category' },
                { title: '段数', render: (_, t) => t.sections?.length || 0 },
                { title: '使用', dataIndex: 'usageCount' },
                { title: '默认', dataIndex: 'isDefault', render: (d) => d ? <Tag color="green">是</Tag> : '-' },
                { title: '更新', dataIndex: 'updatedAt', render: (d) => new Date(d).toLocaleDateString('zh-CN') },
                { title: '操作', render: (_, t) => <Button type="link" size="small" icon={<Edit3 size={12} />} onClick={() => setTplModal({ type: 'update', data: { ...t } })}>编辑</Button> },
              ]}
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
                <Button type="primary" icon={<Plus size={14} />} onClick={() => setDictModal({ type: 'create', data: {} })}>新增</Button>
              </Space>
            }
          >
            <Table
              size="small"
              dataSource={filteredDict}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              columns={[
                { title: '分类', dataIndex: 'category', render: (c) => <Tag color="blue">{c}</Tag> },
                { title: '编码', dataIndex: 'code' },
                { title: '名称', dataIndex: 'name' },
                { title: '英文', dataIndex: 'enName' },
                { title: '说明', dataIndex: 'description' },
                { title: '排序', dataIndex: 'sortOrder' },
                { title: '状态', dataIndex: 'isActive', render: (a) => a ? <Tag color="green">启用</Tag> : <Tag>禁用</Tag> },
                { title: '操作', render: (_, d) => <Button type="link" size="small" icon={<Edit3 size={12} />} onClick={() => setDictModal({ type: 'update', data: { ...d } })}>编辑</Button> },
              ]}
            />
          </Card>
        </Tabs.TabPane>
      </Tabs>

      {/* 模板 Modal */}
      <Modal
        title={tplModal.type === 'create' ? '新增模板' : '编辑模板'}
        open={!!tplModal.type}
        onCancel={() => setTplModal({ type: null, data: {} })}
        onOk={handleTplSave}
        width={600}
      >
        <Form layout="vertical" size="small">
          <Row gutter={8}>
            <Col span={16}><Form.Item label="模板名称"><Input value={tplModal.data.name} onChange={e => setTplModal({ ...tplModal, data: { ...tplModal.data, name: e.target.value } })} /></Form.Item></Col>
            <Col span={8}><Form.Item label="模态"><Select value={tplModal.data.modality} onChange={v => setTplModal({ ...tplModal, data: { ...tplModal.data, modality: v } })} options={['CT','MR','DR','US','MG'].map(m=>({value:m,label:m}))} /></Form.Item></Col>
            <Col span={12}><Form.Item label="类别"><Select value={tplModal.data.category} onChange={v => setTplModal({ ...tplModal, data: { ...tplModal.data, category: v } })} options={['CT','MR','DR','US','MG','通用'].map(c=>({value:c,label:c}))} /></Form.Item></Col>
            <Col span={12}><Form.Item label="设为默认"><Switch checked={tplModal.data.isDefault} onChange={v => setTplModal({ ...tplModal, data: { ...tplModal.data, isDefault: v } })} /></Form.Item></Col>
            <Col span={24}><Form.Item label="说明"><TextArea rows={2} value={tplModal.data.description} onChange={e => setTplModal({ ...tplModal, data: { ...tplModal.data, description: e.target.value } })} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      {/* 词典 Modal */}
      <Modal
        title={dictModal.type === 'create' ? '新增词典项' : '编辑词典项'}
        open={!!dictModal.type}
        onCancel={() => setDictModal({ type: null, data: {} })}
        onOk={handleDictSave}
        width={500}
      >
        <Form layout="vertical" size="small">
          <Row gutter={8}>
            <Col span={12}><Form.Item label="分类"><Input value={dictModal.data.category} onChange={e => setDictModal({ ...dictModal, data: { ...dictModal.data, category: e.target.value } })} /></Form.Item></Col>
            <Col span={12}><Form.Item label="编码"><Input value={dictModal.data.code} onChange={e => setDictModal({ ...dictModal, data: { ...dictModal.data, code: e.target.value } })} /></Form.Item></Col>
            <Col span={24}><Form.Item label="名称"><Input value={dictModal.data.name} onChange={e => setDictModal({ ...dictModal, data: { ...dictModal.data, name: e.target.value } })} /></Form.Item></Col>
            <Col span={24}><Form.Item label="英文"><Input value={dictModal.data.enName} onChange={e => setDictModal({ ...dictModal, data: { ...dictModal.data, enName: e.target.value } })} /></Form.Item></Col>
            <Col span={24}><Form.Item label="说明"><TextArea rows={2} value={dictModal.data.description} onChange={e => setDictModal({ ...dictModal, data: { ...dictModal.data, description: e.target.value } })} /></Form.Item></Col>
            <Col span={12}><Form.Item label="排序"><InputNumber value={dictModal.data.sortOrder || 0} onChange={v => setDictModal({ ...dictModal, data: { ...dictModal.data, sortOrder: v } })} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item label="启用"><Switch checked={dictModal.data.isActive !== false} onChange={v => setDictModal({ ...dictModal, data: { ...dictModal.data, isActive: v } })} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default NotificationTemplateDictPage;
