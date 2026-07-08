// [v3.0.6.8-64] 系统管理后台 (用户+角色+配置)
import React, { useState } from 'react';
import { Card, Space, Tag, Button, Table, Row, Col, Statistic, message, Tabs, Form, Input, Select, Switch, Modal, List, Alert, Badge, Descriptions, Popconfirm } from 'antd';
import { Activity, Plus, Edit3, Trash2, Shield, User, Settings, Key, Save } from 'lucide-react';

export const SystemAdminPage: React.FC = () => {
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([
    { id: 'D001', name: '张明远', role: '主任医师', dept: '放射科', status: 'active', lastLogin: '2026-06-27' },
    { id: 'D002', name: '李慧敏', role: '主治医师', dept: '放射科', status: 'active', lastLogin: '2026-06-26' },
    { id: 'D003', name: '王磊', role: '技师', dept: '放射科', status: 'active', lastLogin: '2026-06-25' },
    { id: 'A001', name: '系统管理员', role: '管理员', dept: '信息科', status: 'active', lastLogin: '2026-06-28' },
  ]);
  const [roles, setRoles] = useState([
    { name: '主任医师', permissions: ['报告:全部', '审核:全部', '双签:全部', '患者:读', '管理:读'], userCount: 3 },
    { name: '主治医师', permissions: ['报告:写', '报告:读', '患者:读', '审核:部分'], userCount: 12 },
    { name: '技师', permissions: ['登记:全部', '检查:全部', '报告:读'], userCount: 25 },
    { name: '护士', permissions: ['登记:部分', '通知:全部'], userCount: 8 },
    { name: '管理员', permissions: ['全部'], userCount: 2 },
  ]);
  const [configs, setConfigs] = useState([
    { key: 'APP_TITLE', value: 'G005 放射科RIS系统', desc: '系统标题' },
    { key: 'DICOM_AETITLE', value: 'G005RIS', desc: 'DICOM AE Title' },
    { key: 'HL7_HOST', value: 'localhost', desc: 'HL7 服务器地址' },
    { key: 'HL7_PORT', value: '2575', desc: 'HL7 端口' },
  ]);
  const [userModal, setUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState('技师');
  const [configEditKey, setConfigEditKey] = useState<string | null>(null);

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Settings size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>系统管理</span>
        <Tag color="cyan">v3.0.6.8-64</Tag>
      </Space>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card><Statistic title="用户" value={users.length} /></Card></Col>
        <Col span={4}><Card><Statistic title="角色" value={roles.length} /></Card></Col>
        <Col span={4}><Card><Statistic title="在线" value="2" valueStyle={{color:'#52c41a'}} /></Card></Col>
      </Row>

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
                  {title:'操作',render:(_,record)=><Space><Button size="small" icon={<Edit3 size={10}/>} onClick={() => message.info('编辑用户: ' + record.name)}/><Button size="small" danger icon={<Trash2 size={10}/>} onClick={() => { setUsers(prev => prev.filter(u => u.id !== record.id)); message.success('已删除: ' + record.name); }}/></Space>},
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
                  {title:'操作',render:(_,record)=><Button size="small" icon={<Edit3 size={10}/>} onClick={() => message.info('编辑角色: ' + record.name)}>编辑</Button>},
                ]} />
            </Card>
          },
          { key:'config', label:'系统配置', children:
            <Card size="small" title="配置项">
              <List dataSource={configs} renderItem={(c:any)=>(
                <List.Item actions={[<Button size="small" icon={<Edit3 size={10}/>} onClick={() => { setConfigEditKey(c.key); message.info('编辑配置: ' + c.key); }}>编辑</Button>]}>
                  <List.Item.Meta title={<Space><Tag color="blue">{c.key}</Tag><Input defaultValue={c.value} size="small" style={{width:200}} /></Space>}
                    description={<span style={{fontSize:12,color:'#999'}}>{c.desc}</span>} />
                </List.Item>
              )} />
            </Card>
          },
        ]}
      />
      <Button type="primary" icon={<Save size={14}/>} style={{marginTop:16}} onClick={() => message.success('所有配置已保存(模拟)')}>保存所有配置</Button>
      <Modal title="新增用户" open={userModal} onOk={() => { setUsers(prev => [...prev, { id: 'U' + Date.now(), name: newUserName || '新用户', role: newUserRole, dept: '放射科', status: 'active', lastLogin: '-' }]); setNewUserName(''); setUserModal(false); message.success('用户已创建(模拟)'); }} onCancel={() => setUserModal(false)}>
        <Form layout="vertical">
          <Form.Item label="姓名"><Input value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="请输入姓名" /></Form.Item>
          <Form.Item label="角色"><Select value={newUserRole} onChange={setNewUserRole} options={[{value:'主任医师'},{value:'主治医师'},{value:'技师'},{value:'护士'},{value:'管理员'}]} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
export default SystemAdminPage;
