import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PermissionGuard } from '../PermissionGuard';
import { useAuth } from '@/hooks/useAuth';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: { id: '1', name: '管理员', role: '管理员' as const, department: '放射科', phone: '13800000000', username: 'admin', permissions: ['report:update', 'report:sign', 'report:publish'] },
  })),
}));

describe('PermissionGuard', () => {
  it('renders children when user has required single permission', () => {
    render(
      <PermissionGuard permission="report:update">
        <div>可写报告</div>
      </PermissionGuard>
    );
    expect(screen.getByText('可写报告')).toBeInTheDocument();
  });

  it('renders children when user has one of required permissions (any)', () => {
    render(
      <PermissionGuard permission={['report:delete', 'report:update']}>
        <div>有权限</div>
      </PermissionGuard>
    );
    expect(screen.getByText('有权限')).toBeInTheDocument();
  });

  it('renders children when user has all required permissions', () => {
    render(
      <PermissionGuard permission={['report:update', 'report:sign']} requireAll>
        <div>写和签</div>
      </PermissionGuard>
    );
    expect(screen.getByText('写和签')).toBeInTheDocument();
  });

  it('hides children when user lacks permission (fallback=null)', () => {
    render(
      <PermissionGuard permission="report:delete">
        <div>不可见</div>
      </PermissionGuard>
    );
    expect(screen.queryByText('不可见')).not.toBeInTheDocument();
  });

  it('shows fallback when user lacks permission', () => {
    render(
      <PermissionGuard permission="report:delete" fallback={<span>无权限</span>}>
        <div>不可见</div>
      </PermissionGuard>
    );
    expect(screen.getByText('无权限')).toBeInTheDocument();
    expect(screen.queryByText('不可见')).not.toBeInTheDocument();
  });

  it('renders fallback when no user is present', () => {
    vi.mocked(useAuth).mockReturnValueOnce({ user: null } as any);
    render(
      <PermissionGuard permission="report:update" fallback={<span>请登录</span>}>
        <div>内容</div>
      </PermissionGuard>
    );
    expect(screen.getByText('请登录')).toBeInTheDocument();
    expect(screen.queryByText('内容')).not.toBeInTheDocument();
  });

  it('uses provided user prop over auth context', () => {
    const limitedUser = { id: '2', name: '观察者', role: '技师' as const, department: '放射科', phone: '', username: 'viewer', permissions: ['report:read'] as any[] };
    render(
      <PermissionGuard permission="report:update" user={limitedUser as any}>
        <div>不应显示</div>
      </PermissionGuard>
    );
    expect(screen.queryByText('不应显示')).not.toBeInTheDocument();
  });

  it('accepts single permission as string', () => {
    render(
      <PermissionGuard permission="report:update">
        <div>单权限</div>
      </PermissionGuard>
    );
    expect(screen.getByText('单权限')).toBeInTheDocument();
  });

  it('accepts multiple permissions as array', () => {
    render(
      <PermissionGuard permission={['report:update', 'report:sign']}>
        <div>多权限</div>
      </PermissionGuard>
    );
    expect(screen.getByText('多权限')).toBeInTheDocument();
  });

  it('requires all permissions when requireAll is true', () => {
    render(
      <PermissionGuard permission={['report:update', 'report:delete']} requireAll fallback={<span>权限不足</span>}>
        <div>全部需要</div>
      </PermissionGuard>
    );
    expect(screen.queryByText('全部需要')).not.toBeInTheDocument();
    expect(screen.getByText('权限不足')).toBeInTheDocument();
  });

  it('renders nested children correctly', () => {
    render(
      <PermissionGuard permission="report:update">
        <div>
          <span>外层</span>
          <span>内层</span>
        </div>
      </PermissionGuard>
    );
    expect(screen.getByText('外层')).toBeInTheDocument();
    expect(screen.getByText('内层')).toBeInTheDocument();
  });

  it('returns null fallback by default when no permission', () => {
    const { container } = render(
      <PermissionGuard permission="report:delete">
        <div>不应看到</div>
      </PermissionGuard>
    );
    expect(container.innerHTML).toBe('');
  });

  it('works with admin role having all permissions', () => {
    vi.mocked(useAuth).mockReturnValueOnce({
      user: { id: '1', name: '管理员', role: '管理员' as const, department: '放射科', phone: '', username: 'admin', permissions: ['report:update', 'report:delete', 'report:sign', 'report:publish'] as any[] },
    } as any);
    render(
      <PermissionGuard permission="report:delete">
        <div>管理员可见</div>
      </PermissionGuard>
    );
    expect(screen.getByText('管理员可见')).toBeInTheDocument();
  });

  it('works with viewer role having limited access', () => {
    vi.mocked(useAuth).mockReturnValueOnce({
      user: { id: '2', name: '观察者', role: '技师' as const, department: '放射科', phone: '', username: 'viewer', permissions: ['report:read'] as any[] },
    } as any);
    render(
      <PermissionGuard permission="report:update" fallback={<span>只读</span>}>
        <div>写报告</div>
      </PermissionGuard>
    );
    expect(screen.getByText('只读')).toBeInTheDocument();
    expect(screen.queryByText('写报告')).not.toBeInTheDocument();
  });
});
