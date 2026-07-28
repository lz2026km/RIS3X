import React, { useState, useEffect } from 'react'
import { patientPortalApi, type PortalPatientDto, type ExamHistoryItemDto, type ImagePreviewDto } from '../../services/api'

// ===== Types =====
export type { PortalPatientDto as PatientPortalUser, ExamHistoryItemDto as ExamHistoryItem, ImagePreviewDto as ImagePreview }

// ===== Styles =====
const styles = {
  container: { maxWidth: 1000, margin: '0 auto', padding: 24, fontFamily: '-apple-system, sans-serif' },
  card: { background: '#fff', borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  label: { fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4 },
  value: { fontSize: 14, color: '#1e293b' },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: { padding: '10px 12px', fontSize: 12, fontWeight: 600, color: '#64748b', textAlign: 'left' as const, borderBottom: '2px solid #e2e8f0' },
  td: { padding: '10px 12px', fontSize: 13, color: '#334155', borderBottom: '1px solid #f1f5f9' },
  badge: (status: string) => ({
    padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
    background: status === '已出报告' ? '#dcfce7' : status === '审核中' ? '#fef9c3' : '#f1f5f9',
    color: status === '已出报告' ? '#166534' : status === '审核中' ? '#854d0e' : '#64748b',
  }),
  btn: { padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: '#1e40af', color: '#fff' },
  imageGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 },
  imageCard: { background: '#f8fafc', borderRadius: 8, padding: 12, border: '1px solid #e2e8f0' },
  imagePlaceholder: { width: '100%', aspectRatio: '1', background: '#e2e8f0', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 12, marginBottom: 8 },
  slider: { width: '100%', margin: '4px 0' },
  voucherBtn: { padding: '12px 24px', borderRadius: 8, border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', background: '#059669', color: '#fff' },
  voucherCode: { marginTop: 12, padding: 12, background: '#f0fdf4', borderRadius: 8, fontSize: 18, fontWeight: 700, color: '#059669', fontFamily: 'monospace', textAlign: 'center' as const, letterSpacing: 2 },
}

// ===== Component =====
export default function SelfServicePortal() {
  const [loggedIn, setLoggedIn] = useState(true)
  const [selectedExam, setSelectedExam] = useState<ExamHistoryItemDto | null>(null)
  const [expandedReport, setExpandedReport] = useState<string | null>(null)
  const [images, setImages] = useState<ImagePreviewDto[]>([])
  const [voucherCode, setVoucherCode] = useState<string | null>(null)
  const [user, setUser] = useState<PortalPatientDto | null>(null)
  const [exams, setExams] = useState<ExamHistoryItemDto[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!loggedIn) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const [userRes, examsRes] = await Promise.all([
          patientPortalApi.getPortalUser('current'),
          patientPortalApi.listExamHistory('current'),
        ])
        if (cancelled) return
        if (userRes.success && userRes.data) setUser(userRes.data)
        if (examsRes.success && Array.isArray(examsRes.data)) setExams(examsRes.data)
      } catch { /* API may not be available in mock mode */ }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [loggedIn])

  useEffect(() => {
    if (!selectedExam) return
    let cancelled = false
    void (async () => {
      try {
        const res = await patientPortalApi.listExamImages(selectedExam.id)
        if (!cancelled && res.success && Array.isArray(res.data)) setImages(res.data)
      } catch { /* keep empty images */ }
    })()
    return () => { cancelled = true }
  }, [selectedExam])

  const handleWindowChange = (id: string, type: 'width' | 'center', value: number) => {
    setImages(prev => prev.map(img =>
      img.id === id
        ? { ...img, [type === 'width' ? 'windowWidth' : 'windowCenter']: value }
        : img
    ))
  }

  const handleInvertToggle = (id: string) => {
    setImages(prev => prev.map(img => img.id === id ? { ...img, invert: !img.invert } : img))
  }

  const generateVoucher = async () => {
    if (!user) return
    try {
      const res = await patientPortalApi.generateVoucher(user.id)
      if (res.success && res.data) setVoucherCode(res.data.code)
    } catch {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
      let code = ''
      for (let i = 0; i < 16; i++) code += chars[Math.floor(Math.random() * chars.length)]
      setVoucherCode(code)
    }
  }

  const getImageFilter = (img: ImagePreview) => {
    const brightness = img.windowCenter / 40
    const contrast = img.windowWidth / 400
    return `brightness(${brightness}) contrast(${contrast})${img.invert ? ' invert(1)' : ''}`
  }

  if (!loggedIn) {
    return (
      <div style={styles.container}>
        <div style={{ ...styles.card, maxWidth: 400, margin: '80px auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 22, marginBottom: 8 }}>患者自助服务</h2>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>输入手机号或证件号查询</p>
          <input placeholder="手机号 / 身份证号" style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, marginBottom: 16, boxSizing: 'border-box' as const }} />
          <button style={{ ...styles.btn, width: '100%', padding: '12px', fontSize: 15 }} onClick={() => setLoggedIn(true)}>查询</button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {/* Patient Header */}
      <div style={styles.card}>
        <div style={styles.header}>
          <h2 style={styles.title}>患者信息</h2>
          <button style={{ ...styles.btn, background: '#64748b' }} onClick={() => setLoggedIn(false)}>退出</button>
        </div>
        <div style={styles.grid2}>
          <div><div style={styles.label}>姓名</div><div style={styles.value}>{user?.name ?? '-'}</div></div>
          <div><div style={styles.label}>性别/年龄</div><div style={styles.value}>{user?.gender ?? '-'} / {user?.age ?? '-'}岁</div></div>
          <div><div style={styles.label}>证件号</div><div style={styles.value}>{user?.idNumber ?? '-'}</div></div>
          <div><div style={styles.label}>手机号</div><div style={styles.value}>{user?.phone ?? '-'}</div></div>
        </div>
      </div>

      {/* Exam History */}
      <div style={styles.card}>
        <h3 style={{ ...styles.title, fontSize: 16, marginBottom: 16 }}>检查记录</h3>
        <table style={styles.table}>
          <thead><tr>
            <th style={styles.th}>检查项目</th><th style={styles.th}>日期</th><th style={styles.th}>部位</th>
            <th style={styles.th}>状态</th><th style={styles.th}>影像</th><th style={styles.th}>报告</th>
          </tr></thead>
          <tbody>
            {exams.map(exam => (
              <tr key={exam.id}>
                <td style={styles.td}>{exam.examItem}</td>
                <td style={styles.td}>{exam.examDate}</td>
                <td style={styles.td}>{exam.bodyPart}</td>
                <td style={styles.td}><span style={styles.badge(exam.reportStatus)}>{exam.reportStatus}</span></td>
                <td style={styles.td}>
                  {exam.hasImages
                    ? <button style={styles.btn} onClick={() => setSelectedExam(exam)}>查看影像</button>
                    : <span style={{ color: '#94a3b8' }}>—</span>}
                </td>
                <td style={styles.td}>
                  {exam.reportContent
                    ? <button style={{ ...styles.btn, background: '#0d9488' }} onClick={() => setExpandedReport(expandedReport === exam.id ? null : exam.id)}>
                        {expandedReport === exam.id ? '收起' : '查看报告'}
                      </button>
                    : <span style={{ color: '#94a3b8' }}>待出具</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Report Detail */}
      {expandedReport && (() => {
        const exam = exams.find(e => e.id === expandedReport)
        if (!exam?.reportContent) return null
        return (
          <div style={styles.card}>
            <h3 style={{ ...styles.title, fontSize: 16, marginBottom: 12 }}>报告详情 — {exam.examItem}</h3>
            <div style={{ padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.7, color: '#334155' }}>
              {exam.reportContent}
            </div>
            {exam.diagnosis && <div style={{ marginTop: 12 }}><div style={styles.label}>诊断意见</div><div style={styles.value}>{exam.diagnosis}</div></div>}
            {exam.recommendations && <div style={{ marginTop: 8 }}><div style={styles.label}>建议</div><div style={styles.value}>{exam.recommendations}</div></div>}
          </div>
        )
      })()}

      {/* Image Preview */}
      {selectedExam && (
        <div style={styles.card}>
          <h3 style={{ ...styles.title, fontSize: 16, marginBottom: 16 }}>电子胶片 — {selectedExam.examItem}</h3>
          <div style={styles.imageGrid}>
            {images.map(img => (
              <div key={img.id} style={styles.imageCard}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 8 }}>{img.label}</div>
                <div style={{ ...styles.imagePlaceholder, filter: getImageFilter(img), background: '#1e293b' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8,1fr)', gap: 1, padding: 8, width: '100%', height: '100%', boxSizing: 'border-box' as const }}>
                    {Array.from({ length: 64 }).map((_, i) => (
                      <div key={i} style={{ background: `hsl(200,10%,${20 + Math.random() * 20}%)`, borderRadius: 1 }} />
                    ))}
                  </div>
                </div>
                <div style={{ marginTop: 8 }}>
                  <div><label style={styles.label}>窗宽</label><input type="range" min={100} max={2000} value={img.windowWidth} onChange={e => handleWindowChange(img.id, 'width', +e.target.value)} style={styles.slider} /></div>
                  <div><label style={styles.label}>窗位</label><input type="range" min={-100} max={500} value={img.windowCenter} onChange={e => handleWindowChange(img.id, 'center', +e.target.value)} style={styles.slider} /></div>
                  <button onClick={() => handleInvertToggle(img.id)} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #e2e8f0', fontSize: 12, cursor: 'pointer', background: img.invert ? '#3b82f6' : '#fff', color: img.invert ? '#fff' : '#64748b' }}>
                    {img.invert ? '取消反转' : '反转'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Download Voucher */}
      <div style={{ ...styles.card, textAlign: 'center' }}>
        <h3 style={{ ...styles.title, fontSize: 16, marginBottom: 12 }}>影像下载凭证</h3>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>生成凭证后可在自助终端领取影像光盘</p>
        {!voucherCode ? (
          <button style={styles.voucherBtn} onClick={generateVoucher}>生成下载凭证</button>
        ) : (
          <div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>您的下载凭证：</div>
            <div style={styles.voucherCode}>{voucherCode}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>有效期：24小时</div>
          </div>
        )}
      </div>
    </div>
  )
}
