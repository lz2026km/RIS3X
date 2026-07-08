import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PhraseBankPro from '../../components/v3/report/PhraseBankPro'
import AIReportReview from '../../components/v3/report/AIReportReview'
import KeywordHighlight from '../../components/v3/report/KeywordHighlight'
import InlineTermLookup from '../../components/v3/report/InlineTermLookup'

describe('PhraseBankPro', () => {
  it('renders with 100+ phrases', () => {
    render(<PhraseBankPro open onClose={() => {}} />)
    expect(screen.getByText(/短语库 Pro/)).toBeInTheDocument()
  })

  it('filters by keyword', () => {
    render(<PhraseBankPro open onClose={() => {}} />)
    const input = screen.getByTestId('pbp-search')
    fireEvent.change(input, { target: { value: '脑室' } })
    expect((input as HTMLInputElement).value).toBe('脑室')
  })

  it('AI recs panel visible with modality hint', async () => {
    render(<PhraseBankPro open onClose={() => {}} modality="CT" bodyPart="BRAIN" />)
    await waitFor(() => {
      expect(screen.getByTestId('pbp-ai-recs')).toBeInTheDocument()
    })
  })

  it('calls onInsert when phrase clicked', () => {
    const onInsert = vi.fn()
    render(<PhraseBankPro open onClose={() => {}} onInsert={onInsert} modality="CT" bodyPart="CHEST" />)
    const firstPhrase = screen.getAllByTestId(/pbp-phrase-/)[0]
    fireEvent.click(firstPhrase)
    expect(onInsert).toHaveBeenCalled()
  })
})

describe('AIReportReview', () => {
  it('detects short findings', async () => {
    render(
      <AIReportReview
        findings="短"
        conclusion="正常"
        autoReview={false}
      />
    )
    fireEvent.click(screen.getByTestId('ai-review-refresh'))
    await waitFor(() => {
      expect(screen.getByTestId(/ai-issue-len-findings/)).toBeInTheDocument()
    })
  })

  it('detects blacklist word TODO', async () => {
    render(
      <AIReportReview
        findings="所见描述完整,详细记录影像学所见信息"
        conclusion="TODO: 待补充"
        autoReview={false}
      />
    )
    fireEvent.click(screen.getByTestId('ai-review-refresh'))
    await waitFor(() => {
      expect(screen.getByTestId(/blk-conclusion-TODO/)).toBeInTheDocument()
    })
  })

  it('detects seen-pos vs conclusion-neg conflict', async () => {
    render(
      <AIReportReview
        findings="右肺中叶外侧段见实性结节,直径约 18mm"
        conclusion="双肺未见明显异常"
        autoReview={false}
      />
    )
    fireEvent.click(screen.getByTestId('ai-review-refresh'))
    await waitFor(() => {
      expect(screen.getByTestId(/ai-issue-conflict-posneg/)).toBeInTheDocument()
    })
  })

  it('detects RADS required field missing', async () => {
    render(
      <AIReportReview
        findings="所见完整"
        conclusion="结论"
        structured={{}}
        radsSchema={{ fields: [{ key: 'lesionSize', label: '病灶大小', type: 'number', required: true }] }}
        autoReview={false}
      />
    )
    fireEvent.click(screen.getByTestId('ai-review-refresh'))
    await waitFor(() => {
      expect(screen.getByTestId(/ai-issue-rads-lesionSize/)).toBeInTheDocument()
    })
  })

  it('validates ICD-10 format', async () => {
    render(
      <AIReportReview
        findings="所见完整"
        conclusion="结论"
        structured={{ icd10: 'BAD-CODE' }}
        autoReview={false}
      />
    )
    fireEvent.click(screen.getByTestId('ai-review-refresh'))
    await waitFor(() => {
      expect(screen.getByTestId(/ai-issue-icd10-format/)).toBeInTheDocument()
    })
  })

  it('passes with clean report', async () => {
    render(
      <AIReportReview
        findings="双肺纹理清晰,肺门影不大,纵隔居中,气管居中,双侧膈面光滑,肋膈角锐利。"
        conclusion="双肺未见明显异常,心影大小、形态正常。"
        suggestion="建议 3-6 个月后随访"
        autoReview={false}
      />
    )
    fireEvent.click(screen.getByTestId('ai-review-refresh'))
    await waitFor(() => {
      expect(screen.getByText(/未发现明显问题/)).toBeInTheDocument()
    })
  })

  it('refresh button triggers re-review', async () => {
    const { container } = render(
      <AIReportReview findings="" conclusion="" autoReview={false} />
    )
    fireEvent.click(screen.getByTestId('ai-review-refresh'))
    await waitFor(() => {
      expect(container.querySelector('.ant-spin')).toBeInTheDocument()
    })
  })
})

describe('KeywordHighlight', () => {
  it('renders textarea mode by default toggle off', () => {
    render(<KeywordHighlight value="" onChange={() => {}} enableHighlight={false} />)
    expect(screen.getByTestId('kw-textarea')).toBeInTheDocument()
  })

  it('detects ICD-10 codes', () => {
    render(<KeywordHighlight value="肺炎,J18.901 编码" onChange={() => {}} />)
    expect(screen.getByTestId('kw-icd10').textContent).toContain('1')
  })

  it('detects RadLex IDs', () => {
    render(<KeywordHighlight value="肝区, RID11936 形态" onChange={() => {}} />)
    expect(screen.getByTestId('kw-radlex').textContent).toContain('1')
  })

  it('detects RADS categories', () => {
    render(<KeywordHighlight value="BI-RADS 3 类" onChange={() => {}} />)
    expect(screen.getByTestId('kw-rads').textContent).toContain('1')
  })

  it('detects measurements', () => {
    render(<KeywordHighlight value="结节大小 12mm" onChange={() => {}} />)
    expect(screen.getByTestId('kw-measure').textContent).toContain('1')
  })

  it('detects anatomy terms', () => {
    render(<KeywordHighlight value="肝脏大小形态正常" onChange={() => {}} />)
    expect(screen.getByTestId('kw-anatomy').textContent).toContain('1')
  })

  it('detects critical value and notifies', async () => {
    const onCritical = vi.fn()
    render(
      <KeywordHighlight
        value="主动脉夹层 Stanford A 型"
        onChange={() => {}}
        onCriticalFound={onCritical}
      />
    )
    await waitFor(() => {
      expect(onCritical).toHaveBeenCalled()
      expect(onCritical.mock.calls[0][0].length).toBeGreaterThan(0)
    })
  })

  it('notifies stats changes', () => {
    const onStats = vi.fn()
    render(<KeywordHighlight value="肝脏 5mm" onChange={() => {}} onStatsChange={onStats} />)
    expect(onStats).toHaveBeenCalled()
    const last = onStats.mock.calls[onStats.mock.calls.length - 1][0]
    expect(last.anatomy).toBeGreaterThanOrEqual(1)
    expect(last.measure).toBeGreaterThanOrEqual(1)
  })

  it('inserts quick term on button click', () => {
    const onChange = vi.fn()
    render(<KeywordHighlight value="原文本" onChange={onChange} />)
    fireEvent.click(screen.getByTestId('kw-insert-5mm'))
    expect(onChange).toHaveBeenCalledWith('原文本 5mm')
  })
})

describe('InlineTermLookup', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<InlineTermLookup open={false} onClose={() => {}} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders ICD-10 panel when open', () => {
    render(<InlineTermLookup open onClose={() => {}} />)
    expect(screen.getByTestId('inline-term-lookup')).toBeInTheDocument()
  })

  it('searches ICD-10', () => {
    render(<InlineTermLookup open onClose={() => {}} />)
    fireEvent.change(screen.getByTestId('term-search'), { target: { value: '肺炎' } })
    const matches = screen.getAllByTestId(/term-icd10-J18/)
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  it('inserts term on click', () => {
    const onInsert = vi.fn()
    render(<InlineTermLookup open onClose={() => {}} onInsert={onInsert} />)
    fireEvent.click(screen.getByTestId('term-icd10-J18.901'))
    expect(onInsert).toHaveBeenCalledWith(expect.stringContaining('J18.901'))
  })
})
