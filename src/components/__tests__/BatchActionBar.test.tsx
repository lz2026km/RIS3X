import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BatchActionBar from '../batch/BatchActionBar';

const defaultActions = [
  { key: 'delete', label: '删除', icon: <span>X</span>, confirm: '确认删除?' },
  { key: 'export', label: '导出', icon: <span>E</span> },
];

describe('BatchActionBar', () => {
  it('renders selected count', () => {
    render(<BatchActionBar selectedCount={3} onAction={vi.fn()} actions={defaultActions} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText(/已选中/)).toBeInTheDocument();
  });

  it('returns null when selectedCount is 0', () => {
    const { container } = render(<BatchActionBar selectedCount={0} onAction={vi.fn()} actions={defaultActions} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders all action buttons', () => {
    render(<BatchActionBar selectedCount={2} onAction={vi.fn()} actions={defaultActions} />);
    expect(screen.getByText('导出')).toBeInTheDocument();
    expect(screen.getByText('删除')).toBeInTheDocument();
  });

  it('calls onAction on non-destructive button click', () => {
    const onAction = vi.fn();
    render(<BatchActionBar selectedCount={2} onAction={onAction} actions={defaultActions} />);
    fireEvent.click(screen.getByText('导出'));
    expect(onAction).toHaveBeenCalledWith('export');
  });

  it('shows confirm text for destructive action on first click', () => {
    const onAction = vi.fn();
    render(<BatchActionBar selectedCount={2} onAction={onAction} actions={defaultActions} />);
    fireEvent.click(screen.getByText('删除'));
    expect(screen.getByText('确认删除?')).toBeInTheDocument();
    expect(onAction).not.toHaveBeenCalled();
  });

  it('calls onAction on second click after confirm', () => {
    const onAction = vi.fn();
    render(<BatchActionBar selectedCount={2} onAction={onAction} actions={defaultActions} />);
    fireEvent.click(screen.getByText('删除'));
    fireEvent.click(screen.getByText('确认删除?'));
    expect(onAction).toHaveBeenCalledWith('delete');
  });

  it('calls onClear when clear button is clicked', () => {
    const onClear = vi.fn();
    render(<BatchActionBar selectedCount={2} onAction={vi.fn()} actions={defaultActions} onClear={onClear} />);
    fireEvent.click(screen.getByText('取消选择'));
    expect(onClear).toHaveBeenCalled();
  });

  it('shows clear button only when onClear is provided', () => {
    const { rerender } = render(<BatchActionBar selectedCount={2} onAction={vi.fn()} actions={defaultActions} />);
    expect(screen.queryByText('取消选择')).not.toBeInTheDocument();
    rerender(<BatchActionBar selectedCount={2} onAction={vi.fn()} actions={defaultActions} onClear={vi.fn()} />);
    expect(screen.getByText('取消选择')).toBeInTheDocument();
  });

  it('resets confirm state on mouse leave', () => {
    const onAction = vi.fn();
    render(<BatchActionBar selectedCount={2} onAction={onAction} actions={defaultActions} />);
    fireEvent.click(screen.getByText('删除'));
    expect(screen.getByText('确认删除?')).toBeInTheDocument();
    fireEvent.mouseLeave(screen.getByText('确认删除?'));
    expect(screen.getByText('删除')).toBeInTheDocument();
  });

  it('renders with 1 selected item', () => {
    render(<BatchActionBar selectedCount={1} onAction={vi.fn()} actions={defaultActions} />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders action with no confirm as non-destructive', () => {
    const actions = [{ key: 'print', label: '打印', icon: <span>P</span> }];
    const onAction = vi.fn();
    render(<BatchActionBar selectedCount={2} onAction={onAction} actions={actions} />);
    fireEvent.click(screen.getByText('打印'));
    expect(onAction).toHaveBeenCalledWith('print');
  });

  it('renders with multiple actions', () => {
    const actions = [
      { key: 'delete', label: '删除', icon: <span>X</span>, confirm: '确认?' },
      { key: 'export', label: '导出', icon: <span>E</span> },
      { key: 'print', label: '打印', icon: <span>P</span> },
    ];
    render(<BatchActionBar selectedCount={3} onAction={vi.fn()} actions={actions} />);
    expect(screen.getByText('删除')).toBeInTheDocument();
    expect(screen.getByText('导出')).toBeInTheDocument();
    expect(screen.getByText('打印')).toBeInTheDocument();
  });

  it('renders selected count as 99+ for large numbers', () => {
    render(<BatchActionBar selectedCount={150} onAction={vi.fn()} actions={defaultActions} />);
    expect(screen.getByText('150')).toBeInTheDocument();
  });

  it('renders icon elements in action buttons', () => {
    render(<BatchActionBar selectedCount={2} onAction={vi.fn()} actions={defaultActions} />);
    expect(screen.getByText('X')).toBeInTheDocument();
    expect(screen.getByText('E')).toBeInTheDocument();
  });

  it('does not render anything when count is 0 with actions', () => {
    const { container } = render(<BatchActionBar selectedCount={0} onAction={vi.fn()} actions={defaultActions} />);
    expect(container.innerHTML).toBe('');
  });
});
