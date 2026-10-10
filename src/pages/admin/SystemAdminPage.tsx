// [v3.0.6.8-64] 系统管理后台 (用户+角色+配置)
// [G005 Wave1A P0-2] 用户创建/删除改走真实 userApi (/users, 后端 users.module), 替代不存在的 /system/admin/users 写端点
import React, { useState, useEffect } from 'react';
import {
  Card,
  Space,
  Tag,
  Button,
  message,
  Tabs,
  Form,
  Input,
  Select,
  Modal,
  List,
  Badge,
  Spin,
} from "antd";
import { Plus, Edit3, Trash2, Settings, Save } from 'lucide-react';
import { systemAdminApi, type SystemUserDto, type SystemRoleDto, type SystemConfigDto } from '../../services/api/systemAdminApi';
import { userApi } from '../../services/api/userApi';
import { usePagination } from '../../hooks/usePagination';
import { t } from '../../i18n/appI18n';
import { DataTable, PageContainer, StatCard, StatCardGrid } from "../../components/common";

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
    message.success(t('sysAdmin.userUpdated'));
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
    message.success(t('sysAdmin.roleUpdated'));
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
      } catch (err) { console.error('[SystemAdmin] load configs failed:', err); if (!cancelled) message.error(t('sysAdmin.loadConfigsFailed')); }
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
    } catch (err) { console.error('[SystemAdmin] saveConfig failed:', err); message.error(t('sysAdmin.saveConfigFailed')); }
  };

  // [W5] 批量保存所有配置
  const handleSaveAllConfigs = async () => {
    setSavingConfig(true);
    try {
      const res = await systemAdminApi.saveConfigs(
        configs.map(c => ({ key: c.key, value: configValues[c.key] ?? c.value })),
      );
      if (res.success) {
        message.success(t('sysAdmin.allConfigsSaved'));
        void loadConfigs();
      } else {
        message.error(res.error?.message || t('sysAdmin.saveFailed'));
      }
    } catch (err) { console.error('[SystemAdmin] saveConfigs failed:', err); message.error(t('sysAdmin.saveAllFailed')); }
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
        message.success(t('sysAdmin.userCreated'));
      } else {
        message.error(res.error?.message || t('sysAdmin.createFailed'));
      }
    } catch (err) { console.error('[SystemAdmin] createUser failed:', err); message.error(t('sysAdmin.createUserFailed')); }
  };

  const handleDeleteUser = async (record: SystemUserDto) => {
    try {
      const res = await userApi.delete(record.id);
      if (res.success) {
        setUsers(prev => prev.filter(u => u.id !== record.id));
        message.success('已删除: ' + record.name);
      } else {
        message.error(res.error?.message || t('sysAdmin.deleteFailed'));
      }
    } catch (err) { console.error('[SystemAdmin] deleteUser failed:', err); message.error(t('sysAdmin.deleteUserFailed')); }
  };

  return (
    <PageContainer padding={24}>
      <Space style={{ marginBottom: 16 }}>
        <Settings size={20} color="var(--color-primary-600)" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('sysAdmin.title')}</span>
        <Tag color="cyan">v3.0.6.11-35</Tag>
      </Space>

      <StatCardGrid style={{ marginBottom: 16 }}>
        <StatCard title={t('sysAdmin.statUsers')} value={users.length} />
        <StatCard title={t('sysAdmin.statRoles')} value={roles.length} />
        <StatCard title={t('sysAdmin.statOnline')} value="2" color="success" />
      </StatCardGrid>

      {loading ? (
        <Card><div style={{ textAlign: 'center', padding: 40 }}><Spin tip={t('sysAdmin.loading')} /></div></Card>
      ) : (
        <Tabs activeKey={tab} onChange={setTab} type="card"
          items={[
            { key:'users', label:t('sysAdmin.tabUsers'), children:
              <Card size="small" extra={<Button type="primary" icon={<Plus size={12}/>} onClick={() => { setEditUser(null); setUserModal(true) }}>{t('sysAdmin.addUser')}</Button>} title={`${users.length} 用户`}>
                <DataTable dataSource={pagedUsers} rowKey="id" pagination={usersPagination}
                  columns={[
                    {title:t('sysAdmin.colId'),dataIndex:'id'},{title:t('sysAdmin.colName'),dataIndex:'name'},
                    {title:t('sysAdmin.colRole'),dataIndex:'role',render:(r)=><Tag color="blue">{r}</Tag>},
                    {title:t('sysAdmin.colDept'),dataIndex:'dept'},
                    {title:t('sysAdmin.colStatus'),dataIndex:'status',render:(s)=><Badge status={s==='active'?'success':'default'} />},
                    {title:t('sysAdmin.colLastLogin'),dataIndex:'lastLogin'},
                    {title:t('sysAdmin.colActions'),render:(_,record)=><Space><Button size="small" icon={<Edit3 size={10}/>} onClick={() => openEditUser(record)} title={t('sysAdmin.editUser')}/><Button size="small" danger icon={<Trash2 size={10}/>} onClick={() => handleDeleteUser(record)}/></Space>},
                  ]} 
                scroll={{ x: 'max-content' }}/>
              </Card>
            },
            { key:'roles', label:t('sysAdmin.tabRoles'), children:
              <Card size="small" title={`${roles.length} 角色`}>
                <DataTable dataSource={pagedRoles} rowKey="name" pagination={rolesPagination} scroll={{ x: 'max-content' }}
                  columns={[
                    {title:t('sysAdmin.colRole'),dataIndex:'name',render:(r)=><Tag color="purple">{r}</Tag>},
                    {title:t('sysAdmin.colPermissions'),dataIndex:'permissions',render:(p)=><>{p.map((x:string)=><Tag key={x} style={{margin:2}}>{x}</Tag>)}</>},
                    {title:t('sysAdmin.colUserCount'),dataIndex:'userCount'},
                    {title:t('sysAdmin.colActions'),render:(_,record)=><Button size="small" icon={<Edit3 size={10}/>} onClick={() => openEditRole(record)}>{t('sysAdmin.edit')}</Button>},
                  ]} />
              </Card>
            },
            { key:'config', label:t('sysAdmin.tabConfig'), children:
              <Card size="small" title={`配置项 (${configs.length})`}>
                <List dataSource={configs} renderItem={(c:any)=>(
                  <List.Item actions={[
                    <Button key="edit" size="small" type="primary" icon={<Edit3 size={10}/>} onClick={() => handleSaveConfig(c)}>{t('sysAdmin.save')}</Button>,
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
      <Button type="primary" icon={<Save size={14}/>} style={{marginTop:16}} loading={savingConfig} onClick={handleSaveAllConfigs}>{t('sysAdmin.saveAllConfigs')}</Button>
      <Modal title={t('sysAdmin.addUser')} open={userModal} onOk={handleCreateUser} onCancel={() => setUserModal(false)}>
        <Form layout="vertical">
          <Form.Item label={t('sysAdmin.formName')}><Input value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder={t('sysAdmin.namePlaceholder')} /></Form.Item>
          <Form.Item label={t('sysAdmin.formRole')}><Select value={newUserRole} onChange={setNewUserRole} options={[{value:'主任医师',label:t('sysAdmin.role.chief')},{value:'主治医师',label:t('sysAdmin.role.attending')},{value:'技师',label:t('sysAdmin.role.technician')},{value:'护士',label:t('sysAdmin.role.nurse')},{value:'管理员',label:t('sysAdmin.role.admin')}]} /></Form.Item>
        </Form>
      </Modal>
      {editUser && (
        <Modal title={`编辑用户 - ${editUser.id}`} open={userModal} onOk={handleSaveEditUser} onCancel={() => { setUserModal(false); setEditUser(null); }}>
          <Form layout="vertical">
            <Form.Item label={t('sysAdmin.formName')}><Input value={editUserName} onChange={e => setEditUserName(e.target.value)} /></Form.Item>
            <Form.Item label={t('sysAdmin.formRole')}><Select value={editUserRole} onChange={setEditUserRole} options={[{value:'主任医师',label:t('sysAdmin.role.chief')},{value:'主治医师',label:t('sysAdmin.role.attending')},{value:'技师',label:t('sysAdmin.role.technician')},{value:'护士',label:t('sysAdmin.role.nurse')},{value:'管理员',label:t('sysAdmin.role.admin')}]} /></Form.Item>
            <Form.Item label={t('sysAdmin.formDept')}><Input value={editUserDept} onChange={e => setEditUserDept(e.target.value)} /></Form.Item>
          </Form>
        </Modal>
      )}
      <Modal title={t('sysAdmin.editRolePerms')} open={roleModal} onOk={handleSaveEditRole} onCancel={() => { setRoleModal(false); setEditRole(null); }} okText={t('sysAdmin.okSave')}>
        <Form layout="vertical">
          <Form.Item label={`角色: ${editRole?.name ?? ''}`}>
            <Input.TextArea rows={4} value={editRolePerms} onChange={e => setEditRolePerms(e.target.value)} placeholder={t('sysAdmin.permsPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};
export default SystemAdminPage;
