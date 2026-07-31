// [v3.0.6.8-64] 系统管理后台 (用户+角色+配置)
import React, { useState, useEffect } from 'react';
import { Card, Space, Tag, Button, Table, Row, Col, Statistic, message, Tabs, Form, Input, Select, Switch, Modal, List, Alert, Badge, Descriptions, Popconfirm, Spin } from 'antd';
import { Activity, Plus, Edit3, Trash2, Shield, User, Settings, Key, Save } from 'lucide-react';
import { systemAdminApi, type SystemUserDto, type SystemRoleDto, type SystemConfigDto } from '../../services/api/systemAdminApi';

export const SystemAdminPage: React.FC = () => {
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState<SystemUserDto[]>([]);
  const [roles, setRoles] = useState<SystemRoleDto[]>([]);
  const [configs, setConfigs] = useState<SystemConfigDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [userModal, setUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState('技师');
  const [configEditKey, setConfigEditKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const [usersRes, rolesRes, configsRes] = await Promise.all([
          systemAdminApi.getUsers(),
          systemAdminApi.getRoles(),
          systemAdminApi.getConfigs(),
        ]);
        if (cancelled) return;
        if (usersRes.success && Array.isArray(usersRes.data)) setUsers(usersRes.data);
        if (rolesRes.success && Array.isArray(rolesRes.data)) setRoles(rolesRes.data);
        if (configsRes.success && Array.isArray(configsRes.data)) setConfigs(configsRes.data);
      } catch {
        if (!cancelled) message.error('加载系统管理数据失败');
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleCreateUser = async () => {
    try {
      const res = await systemAdminApi.createUser({ name: newUserName || '新用户', role: newUserRole });
      if (res.success && res.data) {
        setUsers(prev => [...prev, res.data]);
        setNewUserName('');
        setUserModal(false);
        message.success('用户创建成功');
      } else {
        message.error(res.error?.message || '创建失败');
      }
    } catch {
      message.error('创建用户失败');
    }
  };

  const handleDeleteUser = async (record: SystemUserDto) => {
    try {
      const res = await systemAdminApi.deleteUser(record.id);
      if (res.success) {
        setUsers(prev => prev.filter(u => u.id !== record.id));
        message.success('已删除: ' + record.name);
      } else {
        message.error(res.error?.message || '删除失败');
      }
    } catch {
      message.error('删除用户失败');
    }
  };

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Settings size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>系统管理</span>
        <Tag color="cyan">v3.0.6.11-35</Tag>
      </Space>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card><Statistic title="用户" value={users.length} /></Card></Col>
        <Col span={4}><Card><Statistic title="角色" value={roles.length} /></Card></Col>
        <Col span={4}><Card><Statistic title="在线" value="2" valueStyle={{color:'#52c41a'}} /></Card></Col>
      </Row>

      {loading ? (
        <Card><div style={{ textAlign: 'center', padding: 40 }}><Spin tip="加载中..." /></div></Card>
      ) : (
        <Tabs activeKey={tab} onChange={setTab} type="card"
          items={[
            { key:'users', label:'用户管理', children:
              <Card size="small" extra={<Button type="primary" icon={<Plus size={12}/>} onClick={() => setUserModal(true)}>新增用户</Button>} title={`${users.length} 用户`}>
                <Table dataSource={users} rowKey="id" pagination={false}
                  columns={[
                    {title:'ID',dataIndex:'id'},{title:'姓名',dataIndex:'name'},
                    {title:'角色',dataIndex:'role',render:(r)=><Tag color="blue">{r}</Tag>},
                    {title:'科室',dataIndex:'dept'},
                    {title:'状态',dataIndex:'status',render:(s)=><Badge status={s==='active'?'success':'default'} />},
                    {title:'最后登录',dataIndex:'lastLogin'},
                    {title:'操作',render:(_,record)=><Space><Button size="small" icon={<Edit3 size={10}/>} disabled title="功能开发中，请通过后台系统操作"/><Button size="small" danger icon={<Trash2 size={10}/>} onClick={() => handleDeleteUser(record)}/></Space>},
                  ]} />
              </Card>
            },
            { key:'roles', label:'角色权限', children:
              <Card size="small" title={`${roles.length} 角色`}>
                <Table dataSource={roles} rowKey="name" pagination={false}
                  columns={[
                    {title:'角色',dataIndex:'name',render:(r)=><Tag color="purple">{r}</Tag>},
                    {title:'权限',dataIndex:'permissions',render:(p)=><>{p.map((x:string)=><Tag key={x} style={{margin:2}}>{x}</Tag>)}</>},
                    {title:'用户数',dataIndex:'userCount'},
                    {title:'操作',render:(_,record)=><Button size="small" icon={<Edit3 size={10}/>} disabled title="功能开发中，请通过后台系统操作">编辑</Button>},
                  ]} />
              </Card>
            },
            { key:'config', label:'系统配置', children:
              <Card size="small" title="配置项">
                <List dataSource={configs} renderItem={(c:any)=>(
                  <List.Item actions={[<Button size="small" icon={<Edit3 size={10}/>} disabled title="功能开发中，请通过后台系统操作">编辑</Button>]}>
                    <List.Item.Meta title={<Space><Tag color="blue">{c.key}</Tag><Input defaultValue={c.value} size="small" style={{width:200}} /></Space>}
                      description={<span style={{fontSize:12,color:'#999'}}>{c.desc}</span>} />
                  </List.Item>
                )} />
              </Card>
            },
          ]}
        />
      )}
      <Button type="primary" icon={<Save size={14}/>} style={{marginTop:16}} disabled>保存所有配置</Button>
      <Modal title="新增用户" open={userModal} onOk={handleCreateUser} onCancel={() => setUserModal(false)}>
        <Form layout="vertical">
          <Form.Item label="姓名"><Input value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="请输入姓名" /></Form.Item>
          <Form.Item label="角色"><Select value={newUserRole} onChange={setNewUserRole} options={[{value:'主任医师'},{value:'主治医师'},{value:'技师'},{value:'护士'},{value:'管理员'}]} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
export default SystemAdminPage;
