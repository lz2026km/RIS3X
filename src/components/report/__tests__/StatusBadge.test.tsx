/**
 * G005 放射RIS系统 v3.0.0 - StatusBadge 组件测试
 * Phase T1-W2: 组件单元测试
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { StatusBadge } from '../StatusBadge';
import { REPORT_STATUS_ORDER, REPORT_STATUS_META } from '../statusMeta';

// Mock react-i18next 真实 hook(避免依赖 init)
// 但直接用真实 i18n(已在 test/setup.ts 初始化)

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
);

describe('StatusBadge - 报告 14 态徽章', () => {
  it('渲染待分配状态', () => {
    render(
      <TestWrapper>
        <StatusBadge status="待分配" />
      </TestWrapper>
    );
    expect(screen.getByText('待分配')).toBeInTheDocument();
  });

  it('渲染已发布状态(应显示绿色)', () => {
    render(
      <TestWrapper>
        <StatusBadge status="已发布" />
      </TestWrapper>
    );
    const badge = screen.getByText('已发布');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveStyle({ color: '#059669' });
  });

  it('渲染危急值状态 - 已驳回', () => {
    render(
      <TestWrapper>
        <StatusBadge status="已驳回" />
      </TestWrapper>
    );
    expect(screen.getByText('已驳回')).toBeInTheDocument();
  });

  it('支持自定义 style', () => {
    const { container } = render(
      <TestWrapper>
        <StatusBadge status="书写中" style={{ marginLeft: '8px' }} />
      </TestWrapper>
    );
    const badge = container.querySelector('span');
    expect(badge).toHaveStyle({ marginLeft: '8px' });
  });

  it('所有 16 态都能渲染不报错', () => {
    for (const state of REPORT_STATUS_ORDER) {
      const { unmount } = render(
        <TestWrapper>
          <StatusBadge status={state} />
        </TestWrapper>
      );
      // 组件渲染规范化后的中文标签 (部分态 label 与枚举名不同, 如 CoSign双签→双签)
      const expectedLabel = REPORT_STATUS_META[state]?.label ?? state;
      expect(screen.getByText(expectedLabel)).toBeInTheDocument();
      unmount();
    }
  });

  it('带图标', () => {
    render(
      <TestWrapper>
        <StatusBadge status="已签发" showIcon />
      </TestWrapper>
    );
    const badge = screen.getByText('已签发');
    expect(badge.querySelector('svg')).toBeInTheDocument();
  });
});
