
import { useState } from 'react'
import { Video, FileText, Clock, CheckCircle, ChevronRight, ShieldCheck, BadgeCheck, XCircle, Monitor, PenTool, Lock, FileSignature, ArrowRight, X, Check, RefreshCw, ShieldAlert, ArrowUp, ArrowDown, ZoomIn, Ruler, SlidersHorizontal } from 'lucide-react'
import { styles, COLORS, Consultation, Report, RemoteDiagnosis, CoSignRecord, Institution, getStatusColor } from './RegionalReportServiceWire'

interface DetailProps {
  selectedConsultation: Consultation | null
  selectedReport: Report | null
  selectedRemoteDiagnosis: RemoteDiagnosis | null
  selectedCoSign: CoSignRecord | null
  opinionText: string
  onOpinionTextChange: (v: string) => void
  remoteReportContent: string
  onRemoteReportContentChange: (v: string) => void
  reviewText: string
  onReviewTextChange: (v: string) => void
  onBack: () => void
  onOpenModal: (type: string) => void
  onSubmitOpinion: () => void
  onSubmitRemoteReport: () => void
}

export const ConsultationDetail: React.FC<DetailProps> = ({
  selectedConsultation, opinionText, onOpinionTextChange, onBack, onOpenModal
}) => {
  if (!selectedConsultation) {
    return (
      <div style={{ ...styles.middlePanel, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={styles.emptyState}><Video size={48} style={{ marginBottom: '12px', opacity: 0.3 }} /><div>请选择一个会诊记录查看详情</div></div>
      </div>
    )
  }
  const c = selectedConsultation
  return (
    <div style={{ ...styles.middlePanel, display: 'flex', flexDirection: 'column' }}>
      <div style={styles.panelHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Video size={18} style={{ color: COLORS.primary }} /><span>会诊详情</span></div>
        <button style={{ ...styles.button, ...styles.buttonGhost }} onClick={onBack}><ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} /> 返回</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ marginBottom: '12px', fontSize: '14px', color: COLORS.textMuted }}>基本信息</h4>
          <div style={{ backgroundColor: '#f9fafb', borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>病例号</div><div style={{ fontWeight: 500 }}>{c.caseId}</div></div>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>状态</div><span style={{ ...styles.statusTag, backgroundColor: `${getStatusColor(c.status)}20`, color: getStatusColor(c.status) }}>{c.status}</span></div>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>患者姓名</div><div style={{ fontWeight: 500 }}>{c.patientName}</div></div>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>患者信息</div><div>{c.gender} / {c.age}岁</div></div>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>检查设备</div><div>{c.modality}</div></div>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>检查项目</div><div>{c.examItem}</div></div>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>申请机构</div><div>{c.institution}</div></div>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>申请医生</div><div>{c.applyDoctor}</div></div>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>申请时间</div><div>{c.applyTime}</div></div>
              {c.acceptDoctor && <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>接诊医生</div><div>{c.acceptDoctor}</div></div>}
            </div>
          </div>
        </div>
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ marginBottom: '12px', fontSize: '14px', color: COLORS.textMuted }}>会诊申请理由</h4>
          <div style={{ backgroundColor: '#f9fafb', borderRadius: '8px', padding: '16px' }}>{c.applyReason}</div>
        </div>
        {c.status === '已完成' && c.consultationOpinion && (
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ marginBottom: '12px', fontSize: '14px', color: COLORS.textMuted }}>会诊意见见</h4>
            <div style={{ backgroundColor: '#f0fdf4', borderRadius: '8px', padding: '16px', border: `1px solid ${COLORS.success}` }}>{c.consultationOpinion}</div>
          </div>
        )}
        {c.status === '会诊中' && (
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ marginBottom: '12px', fontSize: '14px', color: COLORS.textMuted }}>填写会诊意见见</h4>
            <textarea style={{ ...styles.textarea, width: '100%', minHeight: '150px' }} placeholder="请输入会诊意见见..." value={opinionText} onChange={e => onOpinionTextChange(e.target.value)} />
            <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
              <button style={{ ...styles.button, ...styles.buttonPrimary }} onClick={() => onOpenModal('opinion')}><Check size={14} /> 提交意见</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export const ReportDetail: React.FC<DetailProps> = ({
  selectedReport, onBack, onOpenModal
}) => {
  if (!selectedReport) {
    return (
      <div style={{ ...styles.middlePanel, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={styles.emptyState}><FileText size={48} style={{ marginBottom: '12px', opacity: 0.3 }} /><div>请选择一个报告查看详情</div></div>
      </div>
    )
  }
  const r = selectedReport
  return (
    <div style={{ ...styles.middlePanel, display: 'flex', flexDirection: 'column' }}>
      <div style={styles.panelHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ShieldCheck size={18} style={{ color: COLORS.primary }} /><span>报告详情</span></div>
        <button style={{ ...styles.button, ...styles.buttonGhost }} onClick={onBack}><ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} /> 返回</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ marginBottom: '12px', fontSize: '14px', color: COLORS.textMuted }}>报告信息</h4>
          <div style={{ backgroundColor: '#f9fafb', borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>报告号</div><div style={{ fontWeight: 500 }}>{r.reportId}</div></div>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>状态</div><span style={{ ...styles.statusTag, backgroundColor: `${getStatusColor(r.status)}20`, color: getStatusColor(r.status) }}>{r.status}</span></div>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>患者姓名</div><div style={{ fontWeight: 500 }}>{r.patientName}</div></div>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>患者信息</div><div>{r.gender} / {r.age}岁</div></div>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>检查设备</div><div>{r.modality}</div></div>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>检查项目</div><div>{r.examItem}</div></div>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>报告机构</div><div>{r.institution}</div></div>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>报告医生</div><div>{r.reportDoctor}</div></div>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>报告时间</div><div>{r.reportTime}</div></div>
              {r.reviewDoctor && <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>审核医生</div><div>{r.reviewDoctor}</div></div>}
            </div>
          </div>
        </div>
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ marginBottom: '12px', fontSize: '14px', color: COLORS.textMuted }}>质控评分</h4>
          <div style={{ backgroundColor: '#f9fafb', borderRadius: '8px', padding: '16px' }}>
            {r.qualityScore > 0 ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
                  <div style={{ fontSize: '32px', fontWeight: 700, color: r.qualityScore >= 90 ? COLORS.success : r.qualityScore >= 70 ? COLORS.warning : COLORS.danger }}>{r.qualityScore}</div>
                  <div style={{ flex: 1 }}><div style={{ ...styles.progressBar, height: '12px' }}><div style={{ ...styles.progressFill, width: `${r.qualityScore}%`, backgroundColor: r.qualityScore >= 90 ? COLORS.success : r.qualityScore >= 70 ? COLORS.warning : COLORS.danger }} /></div><div style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '4px' }}>格式规范 / 内容完整 / 诊断准确</div></div>
                </div>
                {r.qualityIssues.length > 0 && <div style={{ marginTop: '12px' }}><div style={{ fontSize: '12px', color: COLORS.danger, marginBottom: '6px' }}>发现问题：</div>{r.qualityIssues.map((issue, idx) => <div key={idx} style={{ fontSize: '13px', color: COLORS.danger, marginLeft: '12px' }}>• {issue}</div>)}</div>}
              </>
            ) : <div style={{ color: COLORS.textMuted }}>尚未进行质控评分</div>}
          </div>
        </div>
        {r.reviewOpinion && <div style={{ marginBottom: '24px' }}><h4 style={{ marginBottom: '12px', fontSize: '14px', color: COLORS.textMuted }}>审核意见</h4><div style={{ backgroundColor: '#fef3c7', borderRadius: '8px', padding: '16px', border: `1px solid ${COLORS.warning}` }}>{r.reviewOpinion}</div></div>}
        {r.status === '待审核' && (
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ marginBottom: '12px', fontSize: '14px', color: COLORS.textMuted }}>审核操作</h4>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button style={{ ...styles.button, ...styles.buttonPrimary }} onClick={() => onOpenModal('review-pass')}><CheckCircle size={14} /> 通过</button>
              <button style={{ ...styles.button, ...styles.buttonDanger }} onClick={() => onOpenModal('review-reject')}><XCircle size={14} /> 驳回</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export const RemoteWriting: React.FC<DetailProps> = ({
  selectedRemoteDiagnosis, remoteReportContent, onRemoteReportContentChange, onBack, onSubmitRemoteReport
}) => {
  const [zoom, setZoom] = useState(100)
  const [ww, setWw] = useState(400)
  const [wc, setWc] = useState(40)
  const [measuring, setMeasuring] = useState(false)
  const [measureResult, setMeasureResult] = useState<string | null>(null)
  if (!selectedRemoteDiagnosis) {
    return (
      <div style={{ ...styles.middlePanel, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={styles.emptyState}><Monitor size={48} style={{ marginBottom: '12px', opacity: 0.3 }} /><div>请选择一个远程诊断记录</div></div>
      </div>
    )
  }
  const rd = selectedRemoteDiagnosis
  return (
    <div style={{ ...styles.middlePanel, display: 'flex', flexDirection: 'column' }}>
      <div style={styles.panelHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Monitor size={18} style={{ color: COLORS.primary }} /><span>远程书写 - {rd.caseId}</span></div>
        <button style={{ ...styles.button, ...styles.buttonGhost }} onClick={onBack}><ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} /> 返回</button>
      </div>
      {rd.isOtherTyping && <div style={{ padding: '8px 16px', backgroundColor: `${COLORS.inProgress}15`, borderBottom: `1px solid ${COLORS.inProgress}30`, display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS.inProgress }} /><span style={{ fontSize: '12px', color: COLORS.inProgress }}>{rd.otherTypingName} 正在输入报告...</span></div>}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, backgroundColor: '#1a1a2e', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 12px', backgroundColor: 'rgba(0,0,0,0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'white', fontSize: '12px' }}>DICOM影像查看器（模拟）</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                style={{ ...styles.button, padding: '4px 8px', fontSize: '11px', backgroundColor: zoom !== 100 ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.1)', color: 'white', border: zoom !== 100 ? '1px solid #3b82f6' : 'none' }}
                onClick={() => setZoom(z => Math.min(300, z + 25))}
                title="放大"
              >
                <ZoomIn size={12} /> 缩放 {zoom}%
              </button>
              <button
                style={{ ...styles.button, padding: '4px 8px', fontSize: '11px', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white' }}
                onClick={() => { setWw(Math.min(2000, ww + 100)); setWc(wc - 5) }}
                title="窗宽增大 / 窗位微调"
              >
                <SlidersHorizontal size={12} /> 窗宽 {ww} L:{wc}
              </button>
              <button
                style={{ ...styles.button, padding: '4px 8px', fontSize: '11px', backgroundColor: measuring ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.1)', color: 'white', border: measuring ? '1px solid #3b82f6' : 'none' }}
                onClick={() => { setMeasuring(m => !m); setMeasureResult(null) }}
                title="测量"
              >
                <Ruler size={12} /> 测量
              </button>
              {measuring && (
                <button
                  style={{ ...styles.button, padding: '4px 8px', fontSize: '11px', backgroundColor: 'rgba(34,197,94,0.35)', color: 'white' }}
                  onClick={() => setMeasureResult(`${(Math.random() * 2 + 1).toFixed(1)} mm`)}
                >
                  打点测量
                </button>
              )}
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <div style={{ width: 200, height: 200, borderRadius: '8px', background: 'linear-gradient(135deg, #2d2d44 0%, #1a1a2e 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${zoom / 100})`, transition: 'transform 0.15s', border: measuring ? '2px dashed #3b82f6' : 'none' }}>
              <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}><Monitor size={48} style={{ marginBottom: '8px', opacity: 0.5 }} /><div style={{ fontSize: '12px' }}>CT 胸部</div><div style={{ fontSize: '10px', marginTop: '4px' }}>影像加载区域</div></div>
            </div>
            {measuring && <div style={{ position: 'absolute', width: 120, height: 60, border: '1px solid rgba(59,130,246,0.9)', borderRadius: 2 }} />}
            {measureResult && <div style={{ position: 'absolute', top: '36px', left: '20px', background: 'rgba(16,185,129,0.9)', color: '#fff', fontSize: '11px', padding: '2px 8px', borderRadius: 4 }}>距离: {measureResult}</div>}
            <div style={{ position: 'absolute', top: '20px', left: '20px', color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>AXIAL | 5.0mm | W:{ww} L:{wc}</div>
            <div style={{ position: 'absolute', bottom: '20px', right: '20px', color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>1/120</div>
          </div>
        </div>
        <div style={{ width: '400px', borderLeft: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', backgroundColor: 'white' }}>
          <div style={{ padding: '12px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>患者信息</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '12px' }}>
              <div>姓名：{rd.patientName}</div><div>性别：{rd.gender}</div><div>年龄：{rd.age}岁</div><div>检查：{rd.examType}</div>
              <div style={{ gridColumn: '1/-1' }}>申请机构：{rd.applyInstitution}</div>
              <div style={{ gridColumn: '1/-1' }}>远程专家：{rd.remoteExpert}（{rd.expertInstitution}）</div>
            </div>
          </div>
          <div style={{ flex: 1, padding: '12px', overflow: 'auto' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>报告内容</div>
            <textarea style={{ ...styles.textarea, width: '100%', minHeight: '200px', fontSize: '13px', lineHeight: '1.6' }} placeholder="请在此书写诊断报告..." value={remoteReportContent} onChange={e => onRemoteReportContentChange(e.target.value)} />
          </div>
          <div style={{ padding: '12px', borderTop: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>双向数字签名</div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
              <div style={{ flex: 1, padding: '8px', backgroundColor: 'white', borderRadius: '6px', border: '1px solid #e5e7eb' }}><div style={{ fontSize: '10px', color: COLORS.textMuted, marginBottom: '4px' }}>申请医生签名</div><div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Lock size={12} style={{ color: COLORS.success }} /><span style={{ fontSize: '11px' }}>待签名</span></div></div>
              <div style={{ flex: 1, padding: '8px', backgroundColor: 'white', borderRadius: '6px', border: '1px solid #e5e7eb' }}><div style={{ fontSize: '10px', color: COLORS.textMuted, marginBottom: '4px' }}>审核专家签名</div><div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Lock size={12} style={{ color: COLORS.pending }} /><span style={{ fontSize: '11px' }}>待签名</span></div></div>
            </div>
            <button style={{ ...styles.button, width: '100%', justifyContent: 'center', ...styles.buttonPrimary }} onClick={onSubmitRemoteReport}><PenTool size={14} /> 提交报告</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export const CoSignDetail: React.FC<DetailProps> = ({ selectedCoSign, onBack }) => {
  if (!selectedCoSign) {
    return (
      <div style={{ ...styles.middlePanel, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={styles.emptyState}><FileSignature size={48} style={{ marginBottom: '12px', opacity: 0.3 }} /><div>请选择一个联合签发记录</div></div>
      </div>
    )
  }
  const cs = selectedCoSign
  return (
    <div style={{ ...styles.middlePanel, display: 'flex', flexDirection: 'column' }}>
      <div style={styles.panelHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><FileSignature size={18} style={{ color: COLORS.primary }} /><span>联合签发详情 - {cs.reportId}</span></div>
        <button style={{ ...styles.button, ...styles.buttonGhost }} onClick={onBack}><ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} /> 返回</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ marginBottom: '12px', fontSize: '14px', color: COLORS.textMuted }}>基本信息</h4>
          <div style={{ backgroundColor: '#f9fafb', borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>报告编号</div><div style={{ fontWeight: 500 }}>{cs.reportId}</div></div>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>状态</div><span style={{ ...styles.statusTag, backgroundColor: `${getStatusColor(cs.status)}20`, color: getStatusColor(cs.status) }}>{cs.status}</span></div>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>患者姓名</div><div style={{ fontWeight: 500 }}>{cs.patientName}</div></div>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>患者信息</div><div>{cs.gender} / {cs.age}岁</div></div>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>检查类型</div><div>{cs.examType}</div></div>
              <div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>创建时间</div><div>{cs.createTime}</div></div>
            </div>
          </div>
        </div>
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ marginBottom: '12px', fontSize: '14px', color: COLORS.textMuted }}>多方签名</h4>
          <div style={{ backgroundColor: '#f9fafb', borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {cs.signatures.map((sig, idx) => (
                <React.Fragment key={idx}>
                  <div style={{ padding: '12px 16px', backgroundColor: 'white', borderRadius: '8px', border: `1px solid ${sig.certificateStatus === '已认证' ? COLORS.success : COLORS.danger}30`, minWidth: '160px' }}>
                    <div style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '4px' }}><BadgeCheck size={12} style={{ color: COLORS.primary }} /> {sig.institution}</div>
                    <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>{sig.doctorName}</div>
                    <div style={{ fontSize: '10px', color: COLORS.textMuted, marginBottom: '4px' }}>{sig.signTime}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>{sig.certificateStatus === '已认证' ? <><CheckCircle size={12} style={{ color: COLORS.success }} /><span style={{ fontSize: '10px', color: COLORS.success }}>✓已认证</span></> : <><XCircle size={12} style={{ color: COLORS.danger }} /><span style={{ fontSize: '10px', color: COLORS.danger }}>未认证</span></>}</div>
                  </div>
                  {idx < cs.signatures.length - 1 && <ArrowRight size={20} style={{ color: COLORS.textMuted }} />}
                </React.Fragment>
              ))}
              {cs.status === '待签发' && <div style={{ padding: '12px 16px', backgroundColor: '#f3f4f6', borderRadius: '8px', border: '2px dashed #d1d5db', minWidth: '120px', textAlign: 'center' }}><div style={{ fontSize: '12px', color: COLORS.textMuted }}>待签名</div><div style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '4px' }}>...</div></div>}
            </div>
          </div>
        </div>
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ marginBottom: '12px', fontSize: '14px', color: COLORS.textMuted }}>报告版本管理</h4>
          <div style={{ backgroundColor: '#f9fafb', borderRadius: '8px', padding: '16px' }}>
            <table style={styles.table}>
              <thead><tr><th style={{ ...styles.th, fontSize: '12px' }}>版本号</th><th style={{ ...styles.th, fontSize: '12px' }}>修改时间</th><th style={{ ...styles.th, fontSize: '12px' }}>修改机构</th><th style={{ ...styles.th, fontSize: '12px' }}>修改原因</th><th style={{ ...styles.th, fontSize: '12px' }}>修改人</th></tr></thead>
              <tbody>{cs.versions.map((ver, idx) => (<tr key={idx}><td style={{ ...styles.td, fontSize: '12px' }}><span style={{ ...styles.badge, backgroundColor: idx === cs.versions.length - 1 ? COLORS.primary : '#e5e7eb', color: idx === cs.versions.length - 1 ? 'white' : COLORS.textMuted }}>{ver.version}</span></td><td style={{ ...styles.td, fontSize: '12px' }}>{ver.modifyTime}</td><td style={{ ...styles.td, fontSize: '12px' }}>{ver.modifyInstitution}</td><td style={{ ...styles.td, fontSize: '12px' }}>{ver.modifyReason}</td><td style={{ ...styles.td, fontSize: '12px' }}>{ver.modifier}</td></tr>))}</tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

interface StatCardsProps {
  filteredStats: { totalReports: number; pendingConsultations: number; criticalValues: number; avgResponseTime: string }
}

export const StatCards: React.FC<StatCardsProps> = ({ filteredStats }) => {
  const statItems = [
    { label: '报告总数', value: filteredStats.totalReports, change: 12, changeType: 'up' as const, icon: <FileText size={18} />, color: COLORS.primary },
    { label: '待接诊会诊', value: filteredStats.pendingConsultations, change: -3, changeType: 'down' as const, icon: <Video size={18} />, color: COLORS.warning },
    { label: '危急值待处理', value: filteredStats.criticalValues, change: 2, changeType: 'up' as const, icon: <ShieldAlert size={18} />, color: COLORS.danger },
    { label: '平均响应时间', value: filteredStats.avgResponseTime, change: -5, changeType: 'down' as const, icon: <Clock size={18} />, color: COLORS.success },
  ]
  return (
    <div style={styles.statsContainer}>
      {statItems.map((stat, index) => (
        <div key={index} style={styles.statCard}>
          <div style={{ ...styles.statLabel, color: stat.color }}>{stat.icon}<span>{stat.label}</span></div>
          <div style={{ ...styles.statValue, color: stat.color }}>{stat.value}</div>
          {stat.change !== undefined && (
            <div style={{ ...styles.statChange, color: stat.changeType === 'up' ? COLORS.danger : COLORS.success }}>
              {stat.changeType === 'up' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
              <span>{Math.abs(stat.change)}% 较上月</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

interface RightPanelProps {
  institutions: Institution[]
  onRefreshStats: () => void
}

export const RightPanel: React.FC<RightPanelProps> = ({ institutions, onRefreshStats }) => {
  return (
    <div style={styles.rightPanel}>
      <div style={styles.panelHeader}><span>区域统计</span><button style={{ ...styles.button, ...styles.buttonGhost, padding: '4px' }} onClick={onRefreshStats}><RefreshCw size={14} /></button></div>
      <div style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '10px', color: COLORS.textMuted }}>各机构报告数量</div>
        {institutions.map((inst) => {
          const maxCount = Math.max(...institutions.map(i => i.reportCount))
          const percentage = (inst.reportCount / maxCount) * 100
          return (
            <div key={inst.id} style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span style={{ fontSize: '12px' }}>{inst.name}</span><span style={{ fontSize: '12px', fontWeight: 600 }}>{inst.reportCount}</span></div>
              <div style={{ ...styles.progressBar, height: '6px' }}><div style={{ ...styles.progressFill, width: `${percentage}%`, backgroundColor: COLORS.primary }} /></div>
            </div>
          )
        })}
      </div>
      <div style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '10px', color: COLORS.textMuted }}>会诊响应时间（分钟）</div>
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', height: '100px' }}>
          {[{ label: '今日', value: 15, height: 40 }, { label: '本周', value: 18, height: 48 }, { label: '本月', value: 22, height: 58 }, { label: '本季', value: 20, height: 53 }].map((item, idx) => (
            <div key={idx} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: COLORS.primary }}>{item.value}</div>
              <div style={{ width: '30px', height: `${item.height}%`, backgroundColor: COLORS.primary, borderRadius: '4px 4px 0 0', margin: '4px auto' }} />
              <div style={{ fontSize: '10px', color: COLORS.textMuted }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '10px', color: COLORS.textMuted }}>阳性率统计</div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '80px', height: '80px' }}>
            <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%' }}>
              <circle cx="18" cy="18" r="16" fill="none" stroke="#e5e7eb" strokeWidth="3" />
              <circle cx="18" cy="18" r="16" fill="none" stroke={COLORS.success} strokeWidth="3" strokeDasharray={`${67} 100`} strokeLinecap="round" transform="rotate(-90 18 18)" />
            </svg>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '14px', fontWeight: 600 }}>67%</div>
          </div>
          <div style={{ flex: 1 }}><div style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '4px' }}>本月区域阳性率</div><div style={{ fontSize: '13px' }}>较上月 <span style={{ color: COLORS.success }}>+2.3%</span></div></div>
        </div>
      </div>
      <div style={{ padding: '12px' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '10px', color: COLORS.textMuted }}>危急值处理时效</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          <div style={{ backgroundColor: '#f9fafb', padding: '10px', borderRadius: '6px', textAlign: 'center' }}><div style={{ fontSize: '18px', fontWeight: 600, color: COLORS.success }}>8分钟</div><div style={{ fontSize: '10px', color: COLORS.textMuted }}>平均接收时间</div></div>
          <div style={{ backgroundColor: '#f9fafb', padding: '10px', borderRadius: '6px', textAlign: 'center' }}><div style={{ fontSize: '18px', fontWeight: 600, color: COLORS.primary }}>25分钟</div><div style={{ fontSize: '10px', color: COLORS.textMuted }}>平均处理时间</div></div>
          <div style={{ backgroundColor: '#f9fafb', padding: '10px', borderRadius: '6px', textAlign: 'center' }}><div style={{ fontSize: '18px', fontWeight: 600, color: COLORS.success }}>98%</div><div style={{ fontSize: '10px', color: COLORS.textMuted }}>闭环率</div></div>
          <div style={{ backgroundColor: '#f9fafb', padding: '10px', borderRadius: '6px', textAlign: 'center' }}><div style={{ fontSize: '18px', fontWeight: 600, color: COLORS.warning }}>3例</div><div style={{ fontSize: '10px', color: COLORS.textMuted }}>处理中</div></div>
        </div>
      </div>
    </div>
  )
}

interface ModalContentProps {
  modalType: string
  showModal: boolean
  onClose: () => void
  consultationForm: any
  onConsultationFormChange: (v: any) => void
  opinionText: string
  onOpinionTextChange: (v: string) => void
  reviewText: string
  onReviewTextChange: (v: string) => void
  selectedReport: Report | null
  onSubmitConsultation: () => void
  onSubmitOpinion: () => void
  onReviewReport: (report: Report, result: '通过' | '驳回') => void
  institutions: Institution[]
  onToast: (msg: string, success?: boolean) => void
}

export const ModalContent: React.FC<ModalContentProps> = ({
  modalType, showModal, onClose, consultationForm, onConsultationFormChange,
  opinionText, onOpinionTextChange, reviewText, onReviewTextChange,
  selectedReport, onSubmitConsultation, onSubmitOpinion, onReviewReport, institutions, onToast
}) => {
  if (!showModal) return null
  const setForm = (v: any) => onConsultationFormChange({ ...consultationForm, ...v })
  return (
    <div style={styles.modal} onClick={onClose}>
      <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
        {modalType === 'apply' && (
          <>
            <div style={styles.modalHeader}><span>发起会诊申请</span><X size={20} style={{ cursor: 'pointer' }} onClick={onClose} /></div>
            <div style={styles.modalBody}>
              <div style={styles.formGroup}><label style={styles.formLabel}>患者姓名 *</label><input type="text" style={{ ...styles.input, width: '100%' }} placeholder="请输入患者姓名" value={consultationForm.patientName} onChange={e => setForm({ patientName: e.target.value })} /></div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ ...styles.formGroup, flex: 1 }}><label style={styles.formLabel}>性别</label><select style={{ ...styles.input, width: '100%' }} value={consultationForm.gender} onChange={e => setForm({ gender: e.target.value })}><option value="男">男</option><option value="女">女</option></select></div>
                <div style={{ ...styles.formGroup, flex: 1 }}><label style={styles.formLabel}>年龄</label><input type="number" style={{ ...styles.input, width: '100%' }} placeholder="年龄" value={consultationForm.age} onChange={e => setForm({ age: e.target.value })} /></div>
              </div>
              <div style={styles.formGroup}><label style={styles.formLabel}>申请机构 *</label><select style={{ ...styles.input, width: '100%' }} value={consultationForm.institution} onChange={e => setForm({ institution: e.target.value })}><option value="">请选择机构</option>{institutions.map(inst => <option key={inst.id} value={inst.name}>{inst.name}</option>)}</select></div>
            </div>
            <div style={styles.modalFooter}><button style={{ ...styles.button, ...styles.buttonOutline }} onClick={onClose}>取消</button><button style={{ ...styles.button, ...styles.buttonPrimary }} onClick={onSubmitConsultation}>提交</button></div>
          </>
        )}
        {modalType === 'opinion' && (
          <>
            <div style={styles.modalHeader}><span>填写会诊意见见</span><X size={20} style={{ cursor: 'pointer' }} onClick={onClose} /></div>
            <div style={styles.modalBody}><div style={styles.formGroup}><label style={styles.formLabel}>会诊意见见</label><textarea style={{ ...styles.textarea, width: '100%', minHeight: '150px' }} placeholder="请详细填写会诊意见见..." value={opinionText} onChange={e => onOpinionTextChange(e.target.value)} /></div></div>
            <div style={styles.modalFooter}><button style={{ ...styles.button, ...styles.buttonOutline }} onClick={onClose}>取消</button><button style={{ ...styles.button, ...styles.buttonPrimary }} onClick={onSubmitOpinion}>提交意见</button></div>
          </>
        )}
        {modalType === 'review' && (
          <>
            <div style={styles.modalHeader}><span>审核报告</span><X size={20} style={{ cursor: 'pointer' }} onClick={onClose} /></div>
            <div style={styles.modalBody}>
              <div style={{ backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                <div style={{ fontSize: '13px' }}><div style={{ marginBottom: '8px' }}>报告号：{selectedReport?.reportId}</div><div style={{ marginBottom: '8px' }}>患者：{selectedReport?.patientName}</div><div>检查：{selectedReport?.modality} - {selectedReport?.examItem}</div></div>
              </div>
              <div style={styles.formGroup}><label style={styles.formLabel}>审核意见</label><textarea style={{ ...styles.textarea, width: '100%', minHeight: '120px' }} placeholder="请填写审核意见..." value={reviewText} onChange={e => onReviewTextChange(e.target.value)} /></div>
            </div>
            <div style={styles.modalFooter}><button style={{ ...styles.button, padding: '8px 20px', backgroundColor: COLORS.success, color: 'white' }} onClick={() => selectedReport && onReviewReport(selectedReport, '通过')}><CheckCircle size={14} /> 通过</button><button style={{ ...styles.button, padding: '8px 20px', backgroundColor: COLORS.danger, color: 'white' }} onClick={() => selectedReport && onReviewReport(selectedReport, '驳回')}><XCircle size={14} /> 驳回</button></div>
          </>
        )}
        {modalType === 'review-pass' && (
          <>
            <div style={styles.modalHeader}><span>审核通过</span><X size={20} style={{ cursor: 'pointer' }} onClick={onClose} /></div>
            <div style={styles.modalBody}><div style={{ textAlign: 'center', padding: '20px' }}><CheckCircle size={48} style={{ color: COLORS.success, marginBottom: '16px' }} /><div style={{ fontSize: '16px', fontWeight: 500, marginBottom: '8px' }}>确认通过该报告？</div><div style={{ color: COLORS.textMuted, fontSize: '13px' }}>报告号：{selectedReport?.reportId}</div></div></div>
            <div style={styles.modalFooter}><button style={{ ...styles.button, ...styles.buttonOutline }} onClick={onClose}>取消</button><button style={{ ...styles.button, ...styles.buttonPrimary }} onClick={() => { selectedReport && onReviewReport(selectedReport, '通过') }}>确认通过</button></div>
          </>
        )}
        {modalType === 'review-reject' && (
          <>
            <div style={styles.modalHeader}><span>驳回报告</span><X size={20} style={{ cursor: 'pointer' }} onClick={onClose} /></div>
            <div style={styles.modalBody}><div style={styles.formGroup}><label style={styles.formLabel}>驳回原因 *</label><textarea style={{ ...styles.textarea, width: '100%', minHeight: '120px' }} placeholder="请详细说明驳回原因，以便下级医院修正..." value={reviewText} onChange={e => onReviewTextChange(e.target.value)} /></div></div>
            <div style={styles.modalFooter}><button style={{ ...styles.button, ...styles.buttonOutline }} onClick={onClose}>取消</button><button style={{ ...styles.button, ...styles.buttonDanger }} onClick={() => { selectedReport && onReviewReport(selectedReport, '驳回') }}>确认驳回</button></div>
          </>
        )}
        {modalType === 'quality-filter' && (
          <>
            <div style={styles.modalHeader}><span>质控筛选</span><X size={20} style={{ cursor: 'pointer' }} onClick={onClose} /></div>
            <div style={styles.modalBody}>
              <div style={styles.formGroup}><label style={styles.formLabel}>质量评分范围</label><div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><input type="number" style={{ ...styles.input, width: '80px' }} placeholder="最低" min="0" max="100" /><span>至</span><input type="number" style={{ ...styles.input, width: '80px' }} placeholder="最高" min="0" max="100" /></div></div>
              <div style={styles.formGroup}><label style={styles.formLabel}>问题类型</label><div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}><label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" /> 描述欠详细</label><label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" /> 诊断意见不明确</label><label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" /> 报告格式不规范</label><label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" /> 缺少测量数据</label></div></div>
            </div>
            <div style={styles.modalFooter}><button style={{ ...styles.button, ...styles.buttonOutline }} onClick={onClose}>取消</button><button style={{ ...styles.button, ...styles.buttonPrimary }} onClick={() => { onClose(); onToast('筛选条件已应用', true) }}>应用筛选</button></div>
          </>
        )}
        {modalType === 'cosign-add' && (
          <>
            <div style={styles.modalHeader}><span>新增联合签发</span><X size={20} style={{ cursor: 'pointer' }} onClick={onClose} /></div>
            <div style={styles.modalBody}>
              <div style={styles.formGroup}><label style={styles.formLabel}>报告编号 *</label><input type="text" style={{ ...styles.input, width: '100%' }} placeholder="请输入报告编号" /></div>
              <div style={styles.formGroup}><label style={styles.formLabel}>检查类型</label><select style={{ ...styles.input, width: '100%' }}><option value="">请选择</option><option value="CT">CT</option><option value="MRI">MRI</option><option value="DR">DR</option><option value="超声">超声</option></select></div>
              <div style={styles.formGroup}><label style={styles.formLabel}>参与机构</label><div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>{institutions.map(inst => <label key={inst.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" /> {inst.name}</label>)}</div></div>
            </div>
            <div style={styles.modalFooter}><button style={{ ...styles.button, ...styles.buttonOutline }} onClick={onClose}>取消</button><button style={{ ...styles.button, ...styles.buttonPrimary }} onClick={() => { onClose(); onToast('联合签发记录已创建', true) }}>创建</button></div>
          </>
        )}
        {modalType === 'critical-stats' && (
          <>
            <div style={styles.modalHeader}><span>危急值统计报表</span><X size={20} style={{ cursor: 'pointer' }} onClick={onClose} /></div>
            <div style={styles.modalBody}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px', textAlign: 'center' }}><div style={{ fontSize: '24px', fontWeight: 700, color: COLORS.danger }}>5</div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>待处理</div></div>
                <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px', textAlign: 'center' }}><div style={{ fontSize: '24px', fontWeight: 700, color: COLORS.success }}>3</div><div style={{ fontSize: '12px', color: COLORS.textMuted }}>已闭环</div></div>
              </div>
              <div style={styles.formGroup}><label style={styles.formLabel}>按时间范围筛选</label><select style={{ ...styles.input, width: '100%' }}><option value="today">今日</option><option value="week">本周</option><option value="month">本月</option><option value="year">本年</option></select></div>
            </div>
            <div style={styles.modalFooter}><button style={{ ...styles.button, ...styles.buttonOutline }} onClick={onClose}>关闭</button><button style={{ ...styles.button, ...styles.buttonPrimary }} onClick={() => { onClose(); onToast('报表已导出', true) }}>导出报表</button></div>
          </>
        )}
      </div>
    </div>
  )
}
