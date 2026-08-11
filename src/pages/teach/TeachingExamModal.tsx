// [G005 Wave4B] G-04 在线考试模式 (教学) — 基于典型病例库的在线考试
// 选题: 典型病例 (随机 N 题 / 分类) → 逐题作答 (影像描述 + 4 选项诊断) → 评分 (≥60% 通过) → localStorage 成绩记录
import React, { useMemo, useState } from 'react'
import { X, ChevronRight, Award, Clock, CheckCircle2, XCircle, RotateCcw, FileQuestion } from 'lucide-react'
import type { TypicalCase } from '../../services/mockBackend/typicalCasesSeed'

interface TeachingExamModalProps {
  visible: boolean
  cases: TypicalCase[]
  onClose: () => void
}

interface ExamQuestion {
  caseId: string
  description: string
  modality: string
  bodyPart: string
  correct: string
  options: string[]
}

interface ExamRecord {
  id: string
  date: string
  total: number
  correct: number
  score: number
  pass: boolean
  category: string
}

const COLORS = {
  primary: '#1e40af',
  info: '#2563eb',
  success: '#059669',
  successBg: '#ecfdf5',
  danger: '#dc2626',
  dangerBg: 'var(--color-error-bg)',
  warning: '#d97706',
  text: '#1e293b',
  textMuted: '#64748b',
  border: '#e2e8f0',
  bg: 'var(--bg-card)',
}

const EXAM_RECORDS_KEY = 'g005_exam_records'

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

export const TeachingExamModal: React.FC<TeachingExamModalProps> = ({ visible, cases, onClose }) => {
  const [phase, setPhase] = useState<'config' | 'quiz' | 'result'>('config')
  const [questionCount, setQuestionCount] = useState(10)
  const [category, setCategory] = useState<'all' | 'teaching'>('all')
  const [questions, setQuestions] = useState<ExamQuestion[]>([])
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)

  const categories = useMemo(() => {
    const byExam = new Map<string, number>()
    cases.forEach((c) => byExam.set(c.examName || c.examType, (byExam.get(c.examName || c.examType) ?? 0) + 1))
    return Array.from(byExam.entries()).map(([name, count]) => ({ name, count }))
  }, [cases])

  const startExam = (categoryName?: string) => {
    let pool = [...cases]
    if (category === 'teaching') pool = pool.filter((c) => c.teaching)
    if (categoryName && categoryName !== '全部') pool = pool.filter((c) => (c.examName || c.examType) === categoryName)
    if (pool.length === 0) pool = [...cases]
    const n = Math.min(Math.max(questionCount, 1), pool.length)
    const picked = shuffle(pool).slice(0, n)

    const allDiagnoses = Array.from(
      new Set(cases.map((c) => c.diagnosis || c.disease).filter(Boolean)),
    )
    const fallbackOptions = ['未见明确异常', '建议随访观察', '不能确定诊断', '需结合临床']
    const qs: ExamQuestion[] = picked.map((c) => {
      const correct = c.diagnosis || c.disease || '不能确定诊断'
      const distractors = shuffle(
        allDiagnoses.filter((d) => d !== correct),
      ).slice(0, 3)
      const options = shuffle(
        [...distractors, correct].length >= 4
          ? [...distractors, correct]
          : [...distractors, correct, ...fallbackOptions.filter((f) => f !== correct)].slice(0, 4),
      )
      return {
        caseId: c.id,
        description: c.findings || c.impression || '该病例影像描述暂缺',
        modality: c.examType,
        bodyPart: c.bodyPart,
        correct,
        options,
      }
    })
    setQuestions(qs)
    setAnswers({})
    setCurrent(0)
    setSelected(null)
    setLocked(false)
    setPhase('quiz')
  }

  const handleSelect = (opt: string) => {
    if (locked) return
    setSelected(opt)
    setLocked(true)
    setAnswers((prev) => ({ ...prev, [questions[current]!.caseId]: opt }))
  }

  const handleNext = () => {
    if (current + 1 < questions.length) {
      setCurrent((c) => c + 1)
      setSelected(answers[questions[current + 1]!.caseId] ?? null)
      setLocked(answers[questions[current + 1]!.caseId] != null)
    } else {
      finishExam()
    }
  }

  const finishExam = () => {
    const correctCount = questions.filter((q) => answers[q.caseId] === q.correct).length
    const score = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0
    const pass = score >= 60
    const record: ExamRecord = {
      id: `EXM-${Date.now().toString(36)}`,
      date: new Date().toISOString(),
      total: questions.length,
      correct: correctCount,
      score,
      pass,
      category: category === 'teaching' ? '教学病例' : '全部病例',
    }
    try {
      const prev: ExamRecord[] = JSON.parse(localStorage.getItem(EXAM_RECORDS_KEY) || '[]')
      localStorage.setItem(EXAM_RECORDS_KEY, JSON.stringify([record, ...prev].slice(0, 50)))
    } catch {
      /* localStorage unavailable */
    }
    setPhase('result')
  }

  const resetAll = () => {
    setPhase('config')
    setQuestions([])
    setAnswers({})
    setCurrent(0)
  }

  if (!visible) return null

  const q = questions[current]

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.55)', zIndex: 1100,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: '#fff', borderRadius: 14, width: '100%', maxWidth: 720,
          maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px', background: COLORS.primary, display: 'flex',
            justifyContent: 'space-between', alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Award size={18} color="#fff" />
            <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>在线考试模式</span>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 6, border: 'none',
              background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {phase === 'config' && (
            <div>
              <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                <div style={{ flex: 1, padding: 14, background: COLORS.bg, borderRadius: 10, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.primary }}>{cases.length}</div>
                  <div style={{ fontSize: 12, color: COLORS.textMuted }}>病例总数</div>
                </div>
                <div style={{ flex: 1, padding: 14, background: COLORS.successBg, borderRadius: 10, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.success }}>
                    {cases.filter((c) => c.teaching).length}
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.textMuted }}>教学病例</div>
                </div>
                <div style={{ flex: 1, padding: 14, background: '#eff6ff', borderRadius: 10, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.info }}>{categories.length}</div>
                  <div style={{ fontSize: 12, color: COLORS.textMuted }}>病例分类</div>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 8 }}>题目数量</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[5, 10, 15, 20].map((n) => (
                    <button
                      key={n}
                      onClick={() => setQuestionCount(n)}
                      style={{
                        padding: '8px 18px', borderRadius: 8, border: `1px solid ${questionCount === n ? COLORS.info : COLORS.border}`,
                        background: questionCount === n ? '#eff6ff' : '#fff',
                        color: questionCount === n ? COLORS.info : COLORS.textMuted,
                        fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      {n} 题
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 8 }}>选题范围</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setCategory('all')}
                    style={{
                      padding: '8px 14px', borderRadius: 8, border: `1px solid ${category === 'all' ? COLORS.info : COLORS.border}`,
                      background: category === 'all' ? '#eff6ff' : '#fff',
                      color: category === 'all' ? COLORS.info : COLORS.textMuted, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    全部病例
                  </button>
                  <button
                    onClick={() => setCategory('teaching')}
                    style={{
                      padding: '8px 14px', borderRadius: 8, border: `1px solid ${category === 'teaching' ? COLORS.danger : COLORS.border}`,
                      background: category === 'teaching' ? COLORS.dangerBg : '#fff',
                      color: category === 'teaching' ? COLORS.danger : COLORS.textMuted, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    仅教学病例
                  </button>
                </div>
                <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {categories.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => { setCategory('all'); startExam(c.name) }}
                      style={{
                        padding: '4px 10px', borderRadius: 12, border: `1px solid ${COLORS.border}`,
                        background: '#fff', color: COLORS.textMuted, fontSize: 12, cursor: 'pointer',
                      }}
                    >
                      {c.name} ({c.count})
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => startExam()}
                  style={{
                    padding: '10px 28px', borderRadius: 8, border: 'none', background: COLORS.info,
                    color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <FileQuestion size={16} />开始考试
                </button>
              </div>
            </div>
          )}

          {phase === 'quiz' && q && (
            <div>
              {/* 进度 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ height: 8, borderRadius: 4, background: COLORS.bg, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%', borderRadius: 4, background: COLORS.info,
                        width: `${((current + 1) / questions.length) * 100}%`, transition: 'width 0.3s',
                      }}
                    />
                  </div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.textMuted }}>
                  第 {current + 1} / {questions.length} 题
                </span>
              </div>

              {/* 病例信息 */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, background: '#eff6ff', color: COLORS.info }}>
                  {q.modality}
                </span>
                <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: COLORS.bg, color: COLORS.textMuted }}>
                  {q.bodyPart}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: COLORS.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={13} />请选择最可能的诊断
                </span>
              </div>

              <div style={{ background: COLORS.bg, borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 13, lineHeight: 1.8, color: COLORS.text }}>
                {q.description}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {q.options.map((opt, idx) => {
                  const isCorrect = opt === q.correct
                  const isChosen = selected === opt
                  let border = COLORS.border
                  let bg = '#fff'
                  if (locked) {
                    if (isCorrect) { border = COLORS.success; bg = COLORS.successBg }
                    else if (isChosen) { border = COLORS.danger; bg = COLORS.dangerBg }
                  } else if (isChosen) { border = COLORS.info; bg = '#eff6ff' }
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelect(opt)}
                      disabled={locked}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                        borderRadius: 10, border: `1.5px solid ${border}`, background: bg,
                        cursor: locked ? 'default' : 'pointer', textAlign: 'left',
                        fontSize: 13, color: COLORS.text, fontFamily: 'inherit',
                      }}
                    >
                      <span style={{
                        width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700, background: locked && isCorrect ? COLORS.success : isChosen ? COLORS.info : COLORS.bg,
                        color: locked && (isCorrect || isChosen) ? '#fff' : COLORS.textMuted,
                      }}>
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span style={{ flex: 1 }}>{opt}</span>
                      {locked && isCorrect && <CheckCircle2 size={16} color={COLORS.success} />}
                      {locked && isChosen && !isCorrect && <XCircle size={16} color={COLORS.danger} />}
                    </button>
                  )
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                {locked ? (
                  <button
                    onClick={handleNext}
                    style={{
                      padding: '10px 28px', borderRadius: 8, border: 'none', background: COLORS.success,
                      color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    {current + 1 < questions.length ? '下一题' : '交卷'}
                    <ChevronRight size={16} />
                  </button>
                ) : (
                  <span style={{ fontSize: 12, color: COLORS.textMuted }}>请先选择一个答案</span>
                )}
              </div>
            </div>
          )}

          {phase === 'result' && (
            <div>
              {(() => {
                const correctCount = questions.filter((qq) => answers[qq.caseId] === qq.correct).length
                const score = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0
                const pass = score >= 60
                return (
                  <div>
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                      <div style={{
                        width: 88, height: 88, borderRadius: '50%', margin: '0 auto 12px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: pass ? COLORS.successBg : COLORS.dangerBg,
                        border: `3px solid ${pass ? COLORS.success : COLORS.danger}`,
                      }}>
                        <span style={{ fontSize: 22, fontWeight: 800, color: pass ? COLORS.success : COLORS.danger }}>
                          {score}
                        </span>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text }}>
                        {pass ? '通过' : '未通过'}
                      </div>
                      <div style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 4 }}>
                        答对 {correctCount} / {questions.length} 题 · 通过线 60 分 · 成绩已记录
                      </div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 10 }}>答题回顾</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {questions.map((qq, idx) => {
                          const chosen = answers[qq.caseId]
                          const ok = chosen === qq.correct
                          return (
                            <div key={qq.caseId} style={{
                              padding: '10px 12px', borderRadius: 8, background: COLORS.bg,
                              border: `1px solid ${ok ? '#a7f3d0' : '#fecaca'}`,
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                {ok ? <CheckCircle2 size={14} color={COLORS.success} /> : <XCircle size={14} color={COLORS.danger} />}
                                <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.text }}>第 {idx + 1} 题 ({qq.modality} · {qq.bodyPart})</span>
                              </div>
                              <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.6 }}>
                                正确答案: <span style={{ color: COLORS.success, fontWeight: 600 }}>{qq.correct}</span>
                                {chosen && chosen !== qq.correct && (
                                  <> · 你的答案: <span style={{ color: COLORS.danger }}>{chosen}</span></>
                                )}
                                {!chosen && ' · 未作答'}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                      <button
                        onClick={resetAll}
                        style={{
                          padding: '10px 24px', borderRadius: 8, border: `1px solid ${COLORS.border}`,
                          background: '#fff', color: COLORS.text, fontSize: 13, fontWeight: 600,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                        }}
                      >
                        <RotateCcw size={14} />再考一次
                      </button>
                      <button
                        onClick={onClose}
                        style={{
                          padding: '10px 24px', borderRadius: 8, border: 'none', background: COLORS.info,
                          color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        关闭
                      </button>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TeachingExamModal
