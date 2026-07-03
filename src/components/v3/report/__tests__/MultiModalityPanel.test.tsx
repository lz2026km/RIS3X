/**
 * G005 放射RIS系统 v3.0.2 - MultiModalityPanel 单测
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MultiModalityPanel, type ModalitySlice, type ModalityLink } from '../MultiModalityPanel'

const SLICES = [
  {
    id: 'ct1',
    modality: 'CT',
    bodyPart: 'CHEST',
    description: '胸部 CT 平扫',
    seriesNumber: 1,
    instanceCount: 320,
  },
  {
    id: 'mr1',
    modality: 'MR',
    bodyPart: 'BRAIN',
    description: '头颅 MR 平扫',
    seriesNumber: 2,
    instanceCount: 240,
  },
]

describe('MultiModalityPanel', () => {
  it('空状态显示添加按钮', () => {
    render(<MultiModalityPanel slices={[]} />)
    expect(screen.getByTestId('multi-modality-empty')).toBeInTheDocument()
    expect(screen.getByTestId('mm-add-empty')).toBeInTheDocument()
  })

  it('渲染多张切片 Tab', () => {
    render(<MultiModalityPanel slices={SLICES} />)
    const tablist = screen.getAllByRole('tab')
    expect(tablist.length).toBe(2)
    expect(tablist[0] && tablist[0].textContent).toContain('CT')
    expect(tablist[1] && tablist[1].textContent).toContain('MR')
  })

  it('点击添加按钮新增切片', () => {
    const onSlicesChange = vi.fn()
    render(<MultiModalityPanel slices={SLICES} onSlicesChange={onSlicesChange} />)
    fireEvent.click(screen.getByTestId('mm-add'))
    expect(onSlicesChange).toHaveBeenCalled()
    const newSlices = onSlicesChange.mock.calls[0][0]
    expect(newSlices.length).toBe(SLICES.length + 1)
  })

  it('点击移除按钮删除切片', () => {
    const onSlicesChange = vi.fn()
    render(<MultiModalityPanel slices={SLICES} onSlicesChange={onSlicesChange} />)
    fireEvent.click(screen.getByTestId('mm-remove-ct1'))
    const newSlices = onSlicesChange.mock.calls[0][0]
    expect(newSlices.find((s) => s.id === 'ct1')).toBeUndefined()
  })

  it('修改 bodyPart 触发 onSlicesChange', () => {
    const onSlicesChange = vi.fn()
    render(<MultiModalityPanel slices={SLICES} onSlicesChange={onSlicesChange} />)
    const input = screen.getByTestId('mm-bodyPart-ct1')
    fireEvent.change(input, { target: { value: 'ABDOMEN' } })
    expect(onSlicesChange).toHaveBeenCalled()
    const updated = onSlicesChange.mock.calls[0][0]
    expect(updated.find((s) => s.id === 'ct1').bodyPart).toBe('ABDOMEN')
  })

  it('建立关联模式', async () => {
    const onLinksChange = vi.fn()
    render(
      <MultiModalityPanel
        slices={SLICES}
        links={[]}
        onLinksChange={onLinksChange}
      />
    )
    fireEvent.click(screen.getByTestId('mm-link-mode'))
    fireEvent.click(screen.getByTestId('mm-link-ct1'))
    const tabs = screen.getAllByRole('tab')
    fireEvent.click(tabs[1])
    fireEvent.click(screen.getByTestId('mm-link-mr1'))
    const { waitFor } = await import('@testing-library/react')
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /确认关联/ })
      expect(btn).not.toBeDisabled()
    })
    fireEvent.click(screen.getByRole('button', { name: /确认关联/ }))
    expect(onLinksChange).toHaveBeenCalled()
    const newLinks = onLinksChange.mock.calls[0][0]
    expect(newLinks).toHaveLength(1)
    expect(newLinks[0].fromSliceId).toBe('ct1')
    expect(newLinks[0].toSliceId).toBe('mr1')
  })

  it('超出 maxSlices 限制时禁用添加', () => {
    render(<MultiModalityPanel slices={SLICES} maxSlices={2} />)
    const btn = screen.getByTestId('mm-add')
    expect(btn).toBeDisabled()
  })
})
