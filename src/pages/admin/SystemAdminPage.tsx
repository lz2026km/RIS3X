// [v3.0.6.8-64] 系统管理后台 (用户+角色+配置)
// [G005 Wave1A P0-2] 用户创建/删除改走真实 userApi (/users, 后端 users.module), 替代不存在的 /system/admin/users 写端点
import React, { useState, useEffect } from 'react';
import { Card, Space, Tag, Button, Table, Row, Col, Statistic, message, Tabs, Form, Input, Select, Modal, List, Badge, Spin } from 'antd';
import { Plus, Edit3, Trash2, Settings, Save } from 'lucide-react';
import { systemAdminApi, type SystemUserDto, type SystemRoleDto, type SystemConfigDto } from '../../services/api/systemAdminApi';
import { userApi } from '../../services/api/userApi';
import { usePagination } from '../../hooks/usePagination';

// [G005 Wave1A P0-2] 中文角色 → userApi 英文枚举
const ROLE_TO_ENUM: Record<string, 'DOCTOR' | 'TECHNICIAN' | 'NURSE' | 'ADMIN' | 'DIRECTOR'> = {
  '主任医师': 'DOCTOR',
  '主治医师': 'DOCTOR',
  '技师': 'TECHNICIAN',
  '护士': 'NURSE',
  '管理员': 'ADMIN',
};

export const SystemAdminPage: React.FC = () => {
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState<SystemUserDto[]>([]);
  const [roles, setRoles] = useState<SystemRoleDto[]>([]);
  const [configs, setConfigs] = useState<SystemConfigDto[]>([]);
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [savingConfig, setSavingConfig] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userModal, setUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState('技师');
  const [roleModal, setRoleModal] = useState(false);
  const [_configEditKey, _setConfigEditKey] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<SystemUserDto | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserRole, setEditUserRole] = useState('');
  const [editUserDept, setEditUserDept] = useState('');
  const [editRole, setEditRole] = useState<SystemRoleDto | null>(null);
  const [editRolePerms, setEditRolePerms] = useState('');
  const { pageData: pagedUsers, pagination: usersPagination } = usePagination(users);
  const { pageData: pagedRoles, pagination: rolesPagination } = usePagination(roles);

  const openEditUser = (record: SystemUserDto) => {
    setEditUser(record);
    setEditUserName(record.name);
    setEditUserRole(record.role);
    setEditUserDept(record.dept || '');
    setUserModal(true);
  };

  const handleSaveEditUser = () => {
    if (!editUser) return;
    const updated = { ...editUser, name: editUserName, role: editUserRole, dept: editUserDept };
    setUsers(prev => prev.map(u => u.id === editUser.id ? updated : u));
    setUserModal(false);
    setEditUser(null);
    message.success('用户信息已更新');
  };

  const openEditRole = (record: SystemRoleDto) => {
    setEditRole(record);
    setEditRolePerms(record.permissions.join('、'));
    setRoleModal(true);
  };

  const handleSaveEditRole = () => {
    if (!editRole) return;
    const perms = editRolePerms.split(/[、,，]/).map(s => s.trim()).filter(Boolean);
    setRoles(prev => prev.map(r => r.name === editRole.name ? { ...r, permissions: perms } : r));
    setRoleModal(false);
    setEditRole(null);
    message.success('角色权限已更新');
  };

  const loadConfigs = async () => {
    const res = await systemAdminApi.getConfigs();
    if (res.success && Array.isArray(res.data)) {
      setConfigs(res.data);
      const next: Record<string, string> = {};
      for (const c of res.data) next[c.key] = c.value;
      setConfigValues(next);
    }
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      // 用户/角色统计为装饰性数据, fire-and-forget 不阻塞配置加载 (W5)
      void systemAdminApi.getUsers().then(res => {
        if (!cancelled && res.success && Array.isArray(res.data)) setUsers(res.data);
      }).catch(() => { /* noop */ });
      void systemAdminApi.getRoles().then(res => {
        if (!cancelled && res.success && Array.isArray(res.data)) setRoles(res.data);
      }).catch(() => { /* noop */ });
      try {
        await loadConfigs();
      } catch (err) { console.error('[SystemAdmin] load configs failed:', err); if (!cancelled) message.error('加载系统配置失败'); }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // [W5] 单项配置保存
  const handleSaveConfig = async (c: SystemConfigDto) => {
    const value = configValues[c.key] ?? c.value;
    try {
      const res = await systemAdminApi.updateConfig(c.key, value);
      if (res.success) {
        message.success(`已保存并生效: ${c.key}`);
        void loadConfigs();
      } else {
        message.error(res.error?.message || `保存失败: ${c.key}`);
      }
    } catch (err) { console.error('[SystemAdmin] saveConfig failed:', err); message.error('保存配置失败'); }
  };

  // [W5] 批量保存所有配置
  const handleSaveAllConfigs = async () => {
    setSavingConfig(true);
    try {
      const res = await systemAdminApi.saveConfigs(
        configs.map(c => ({ key: c.key, value: configValues[c.key] ?? c.value })),
      );
      if (res.success) {
        message.success('所有配置已保存并生效');
        void loadConfigs();
      } else {
        message.error(res.error?.message || '保存失败');
      }
    } catch (err) { console.error('[SystemAdmin] saveConfigs failed:', err); message.error('保存所有配置失败'); }
    setSavingConfig(false);
  };

  const handleCreateUser = async () => {
    try {
      const res = await userApi.create({
        username: `user_${Date.now().toString(36)}`,
        password: 'Passw0rd!',
        fullName: newUserName || '新用户',
        role: ROLE_TO_ENUM[newUserRole] ?? 'TECHNICIAN',
      });
      if (res.success && res.data) {
        setUsers(prev => [...prev, {
          id: res.data.id,
          name: res.data.fullName,
          role: newUserRole,
          dept: res.data.department ?? '',
          status: res.data.active === false ? 'inactive' : 'active',
          lastLogin: '',
        }]);
        setNewUserName('');
        setUserModal(false);
        message.success('用户创建成功');
      } else {
        message.error(res.error?.message || '创建失败');
      }
    } catch (err) { console.error('[SystemAdmin] createUser failed:', err); message.error('创建用户失败'); }
  };

  const handleDeleteUser = async (record: SystemUserDto) => {
    try {
      const res = await userApi.delete(record.id);
      if (res.success) {
        setUsers(prev => prev.filter(u => u.id !== record.id));
        message.success('已删除: ' + record.name);
      } else {
        message.error(res.error?.message || '删除失败');
      }
    } catch (err) { console.error('[SystemAdmin] deleteUser failed:', err); message.error('删除用户失败'); }
  };

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Settings size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>系统管理</span>
        <Tag color="cyan">v3.0.6.11-35</Tag>
      </Space>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card><Statistic title="用户" value={users.length} /></Card></Col>
        <Col span={4}><Card><Statistic title="角色" value={roles.length} /></Card></Col>
        <Col span={4}><Card><Statistic title="在线" value="2" styles={{ content: { color:'#52c41a' } }} /></Card></Col>
      </Row>

      {loading ? (
        <Card><div style={{ textAlign: 'center', padding: 40 }}><Spin tip="加载中..." /></div></Card>
      ) : (
        <Tabs activeKey={tab} onChange={setTab} type="card"
          items={[
            { key:'users', label:'用户管理', children:
              <Card size="small" extra={<Button type="primary" icon={<Plus size={12}/>} onClick={() => { setEditUser(null); setUserModal(true) }}>新增用户</Button>} title={`${users.length} 用户`}>
                <Table dataSource={pagedUsers} rowKey="id" pagination={usersPagination}
                  columns={[
                    {title:'编号',dataIndex:'id'},{title:'姓名',dataIndex:'name'},
                    {title:'角色',dataIndex:'role',render:(r)=><Tag color="blue">{r}</Tag>},
                    {title:'科室',dataIndex:'dept'},
                    {title:'状态',dataIndex:'status',render:(s)=><Badge status={s==='active'?'success':'default'} />},
                    {title:'最后登录',dataIndex:'lastLogin'},
                    {title:'操作',render:(_,record)=><Space><Button size="small" icon={<Edit3 size={10}/>} onClick={() => openEditUser(record)} title="编辑用户"/><Button size="small" danger icon={<Trash2 size={10}/>} onClick={() => handleDeleteUser(record)}/></Space>},
                  ]} 
                scroll={{ x: 'max-content' }}/>
              </Card>
            },
            { key:'roles', label:'角色权限', children:
              <Card size="small" title={`${roles.length} 角色`}>
                <Table dataSource={pagedRoles} rowKey="name" pagination={rolesPagination} scroll={{ x: 'max-content' }}
                  columns={[
                    {title:'角色',dataIndex:'name',render:(r)=><Tag color="purple">{r}</Tag>},
                    {title:'权限',dataIndex:'permissions',render:(p)=><>{p.map((x:string)=><Tag key={x} style={{margin:2}}>{x}</Tag>)}</>},
                    {title:'用户数',dataIndex:'userCount'},
                    {title:'操作',render:(_,record)=><Button size="small" icon={<Edit3 size={10}/>} onClick={() => openEditRole(record)}>编辑</Button>},
                  ]} />
              </Card>
            },
            { key:'config', label:'系统配置', children:
              <Card size="small" title={`配置项 (${configs.length})`}>
                <List dataSource={configs} renderItem={(c:any)=>(
                  <List.Item actions={[
                    <Button key="edit" size="small" type="primary" icon={<Edit3 size={10}/>} onClick={() => handleSaveConfig(c)}>保存</Button>,
                  ]}>
                    <List.Item.Meta title={<Space wrap>
                      <Tag color="blue" style={{ minWidth: 200 }}>{c.key}</Tag>
                      <Input value={configValues[c.key] ?? c.value} onChange={e => setConfigValues(prev => ({ ...prev, [c.key]: e.target.value }))} size="small" style={{ width: 320 }} />
                    </Space>}
                      description={<span style={{fontSize:12,color:'#999'}}>{c.desc}</span>} />
                  </List.Item>
                )} />
              </Card>
            },
          ]}
        />
      )}
      <Button type="primary" icon={<Save size={14}/>} style={{marginTop:16}} loading={savingConfig} onClick={handleSaveAllConfigs}>保存所有配置</Button>
      <Modal title="新增用户" open={userModal} onOk={handleCreateUser} onCancel={() => setUserModal(false)}>
        <Form layout="vertical">
          <Form.Item label="姓名"><Input value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="请输入姓名" /></Form.Item>
          <Form.Item label="角色"><Select value={newUserRole} onChange={setNewUserRole} options={[{value:'主任医师'},{value:'主治医师'},{value:'技师'},{value:'护士'},{value:'管理员'}]} /></Form.Item>
        </Form>
      </Modal>
      {editUser && (
        <Modal title={`编辑用户 - ${editUser.id}`} open={userModal} onOk={handleSaveEditUser} onCancel={() => { setUserModal(false); setEditUser(null); }}>
          <Form layout="vertical">
            <Form.Item label="姓名"><Input value={editUserName} onChange={e => setEditUserName(e.target.value)} /></Form.Item>
            <Form.Item label="角色"><Select value={editUserRole} onChange={setEditUserRole} options={[{value:'主任医师'},{value:'主治医师'},{value:'技师'},{value:'护士'},{value:'管理员'}]} /></Form.Item>
            <Form.Item label="科室"><Input value={editUserDept} onChange={e => setEditUserDept(e.target.value)} /></Form.Item>
          </Form>
        </Modal>
      )}
      <Modal title="编辑角色权限" open={roleModal} onOk={handleSaveEditRole} onCancel={() => { setRoleModal(false); setEditRole(null); }} okText="保存">
        <Form layout="vertical">
          <Form.Item label={`角色: ${editRole?.name ?? ''}`}>
            <Input.TextArea rows={4} value={editRolePerms} onChange={e => setEditRolePerms(e.target.value)} placeholder="权限点用顿号、逗号分隔，如 报告签发、危急值处理、质控审核" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
export default SystemAdminPage;
