import { useState, useEffect } from 'react'
import { message, Modal, Typography } from 'antd'
import { UserManagement, type UserAccount } from '../components/v3/admin/UserManagement'
import { generateId } from '../data/simulationStore'
import { PermissionGate } from '../components/common/PermissionGate'
import { userApi } from '../services/api/userApi'
import { uniqueId } from '../utils/uniqueId'

const { Title } = Typography

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserAccount[]>([])
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true)
    userApi.list().then(res => {
      if (res.success && Array.isArray(res.data)) {
        setUsers(res.data.map(u => ({
          id: u.id,
          username: u.username,
          name: u.fullName,
          role: u.role,
          department: u.department || '',
          email: '',
          active: u.active ?? true,
          twoFactor: false,
          failedLogins: 0,
          createdAt: u.createdAt || '',
          lastLoginAt: u.updatedAt || '',
        })))
        setError(null)
      } else {
        setError('API 不可用')
      }
    }).catch(() => setError('API 不可用')).finally(() => setLoading(false))
  }, [])

  if (loading) return <div role="status" data-testid="user-loading" style={{ padding: 'var(--space-10, 40px)', textAlign: 'center', color: 'var(--text-secondary)' }}>加载中...</div>;
  if (error) return <div role="alert" data-testid="user-error" style={{ padding: 'var(--space-10, 40px)', textAlign: 'center', color: 'var(--color-error-600)' }}>{error}</div>;
  if (users.length === 0) {
    return (
      <div data-testid="user-empty" style={{ padding: 'var(--space-10, 40px)', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div style={{ fontSize: 14, marginBottom: 'var(--space-3, 12px)' }}>暂无用户</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>请联系系统管理员开通账号</div>
      </div>
    );
  }

  const onCreate = async (u: Omit<UserAccount, 'id' | 'createdAt' | 'failedLogins'>) => {
    const newUser: UserAccount = {
      ...u,
      id: generateId(),
      createdAt: new Date().toISOString().slice(0, 10),
      failedLogins: 0,
    }
    const res = await userApi.create({
      username: u.username,
      password: '',
      fullName: u.name,
      role: u.role as any,
      department: u.department,
    })
    if (res.success) message.success(`已创建用户 ${res.data.username}`)
    setUsers((prev) => [...prev, newUser])
  }

  const onUpdate = async (id: string, patch: Partial<UserAccount>) => {
    const res = await userApi.update(id, {
      fullName: patch.name,
      role: patch.role as any,
      department: patch.department,
      active: patch.active,
    })
    if (res.success) message.success(`已更新用户`)
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)))
  }

  const onDelete = async (id: string) => {
    const res = await userApi.delete(id)
    if (res.success) message.success(`已删除用户`)
    setUsers((prev) => prev.filter((u) => u.id !== id))
  }

  const onResetPassword = async (id: string) => {
    const user = users.find((u) => u.id === id)
    const showTemp = (temp: string, fromApi: boolean) => {
      Modal.info({
        title: fromApi ? '密码已重置 (后端真实生成)' : '密码已重置 (本地记录)',
        content: (
          <div>
            <p style={{ marginBottom: 'var(--space-2, 8px)' }}>
              用户 <strong>{user?.username ?? id}</strong> 的临时密码为:
            </p>
            <p style={{ fontSize: 20, fontWeight: 700, letterSpacing: 2, padding: '8px 0', color: fromApi ? 'var(--color-success-600)' : 'var(--color-warning-600)', fontFamily: 'monospace' }}>
              {temp}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
              {fromApi
                ? '临时密码仅显示一次, 请立即转交用户。失败登录计数已清零。'
                : '后端重置密码接口待接入, 临时密码仅本地展示。失败登录计数已清零。'}
            </p>
          </div>
        ),
        okText: '我已记录',
      })
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, failedLogins: 0 } : u)))
    }
    try {
      const res = await userApi.resetPassword(id)
      if (res.success && res.data?.temporaryPassword) {
        showTemp(res.data.temporaryPassword, true)
        return
      }
    } catch { /* 后端不可用 → 本地生成 */ }
    showTemp(`Ris${uniqueId('').replace(/-/g, '')}@a1`, false)
  }

  const onSave = async () => {
    setSaving(true)
    try {
      await Promise.all(
        users.map((u) =>
          userApi.update(u.id, {
            fullName: u.name,
            role: u.role as any,
            department: u.department,
            active: u.active,
          }),
        ),
      )
      message.success('全部用户已保存')
    } catch (e) {
      message.error('保存失败: ' + (e instanceof Error ? e.message : '未知错误'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: 'var(--space-6, 24px)', background: 'var(--bg-card)',}} data-testid="user-management-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4, 16px)' }}>
        <Title level={4} style={{ margin: 0 }}>用户权限管理</Title>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          data-testid="user-save-all"
          style={{ padding: '6px 14px', background: 'var(--color-primary-600)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: saving ? 'wait' : 'pointer' }}
        >
          {saving ? '保存中...' : '批量保存'}
        </button>
      </div>
      <PermissionGate
        permission="user.manage"
        fallback={
          <div
            data-testid="user-management-denied"
            style={{
              padding: 'var(--space-6, 24px)',
              background: 'var(--color-error-bg)',
              border: '1px solid #fca5a5',
              color: '#7f1d1d',
              borderRadius: 8,
              fontSize: 14,
            }}
          >
            您当前角色没有用户管理权限,无法新增/编辑/删除用户。请联系系统管理员。
          </div>
        }
      >
        <UserManagement
          users={users}
          onCreate={onCreate}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onResetPassword={onResetPassword}
        />
      </PermissionGate>
    </div>
  )
}
