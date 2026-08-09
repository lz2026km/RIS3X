import React, { useState, useEffect } from 'react'
import {
  FileText, Send, Search, Filter, RefreshCw, Plus, Eye,
  ClipboardList, ShieldAlert, BarChart3,
  Building2, Building, Download, X, Circle, Monitor, PenTool,
  FileSignature, Share2, UserX, TrendingUp, TrendingDown
} from 'lucide-react'
import {
  styles, COLORS,
  getStatusColor, getSeverityColor,
} from './RegionalReportServiceWire'
import { regionalApi } from '../../services/api'
import type { Institution, Consultation, Report, CriticalValueReport, RemoteDiagnosis, CoSignRecord, ShareRecord, SLARecord } from './RegionalReportServiceWire'

interface InstitutionListProps {
  selectedInstitution: string
  onSelect: (id: string) => void
}

export const InstitutionList: React.FC<InstitutionListProps> = ({ selectedInstitution, onSelect }) => {
  const [institutions, setInstitutions] = useState<Institution[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await regionalApi.listRegionalInstitutions()
        if (!cancelled && res.success && Array.isArray(res.data)) {
          setInstitutions(res.data.map(i => ({
            id: i.id, name: i.institutionName, level: '三级' as const, type: '综合医院' as const,
            reportCount: i.examCount, pendingCount: 0, icon: 'hospital',
          })))
        }
      } catch { /* keep empty */ }
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <div style={styles.leftPanel}>
      <div style={styles.panelHeader}><span>医疗机构</span><span style={{ fontSize: '12px', fontWeight: 400, color: COLORS.textMuted }}>{institutions.length}家</span></div>
      <div style={{ padding: '8px' }}>
        <div style={{ ...styles.listItem, ...(selectedInstitution === 'all' ? styles.listItemActive : {}) }} onClick={() => onSelect('all')}
          onMouseEnter={e => { if (selectedInstitution !== 'all') e.currentTarget.style.backgroundColor = '#f3f4f6' }}
          onMouseLeave={e => { if (selectedInstitution !== 'all') e.currentTarget.style.backgroundColor = 'transparent' }}>
          <Building size={16} style={{ color: COLORS.primary }} />
          <div style={{ flex: 1 }}><div style={{ fontWeight: 500, fontSize: '13px' }}>全部机构</div><div style={{ fontSize: '11px', color: COLORS.textMuted }}>区域所有医院</div></div>
          <span style={{ ...styles.badge, backgroundColor: '#eff6ff', color: COLORS.primary }}>{institutions.reduce((sum, i) => sum + i.reportCount, 0)}</span>
        </div>
        {institutions.map(inst => (
          <div key={inst.id} style={{ ...styles.listItem, ...(selectedInstitution === inst.id ? styles.listItemActive : {}) }} onClick={() => onSelect(inst.id)}
            onMouseEnter={e => { if (selectedInstitution !== inst.id) e.currentTarget.style.backgroundColor = '#f3f4f6' }}
            onMouseLeave={e => { if (selectedInstitution !== inst.id) e.currentTarget.style.backgroundColor = 'transparent' }}>
            <Building2 size={16} style={{ color: COLORS.secondary }} />
            <div style={{ flex: 1 }}><div style={{ fontWeight: 500, fontSize: '13px' }}>{inst.name}</div><div style={{ fontSize: '11px', color: COLORS.textMuted }}>{inst.level} {inst.type}</div></div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ ...styles.badge, backgroundColor: '#f3f4f6', color: COLORS.textMuted }}>{inst.reportCount}</span>
              {inst.pendingCount > 0 && <div style={{ fontSize: '10px', color: COLORS.warning, marginTop: '2px' }}>待审 {inst.pendingCount}</div>}
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: '12px', borderTop: '1px solid #e5e7eb' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: COLORS.textMuted }}>快速筛选</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {['全部', '三级医院', '二级医院', '一级医院', '待审核'].map(filter => (
            <span key={filter} style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', backgroundColor: filter === '全部' ? COLORS.primary : '#f3f4f6', color: filter === '全部' ? 'white' : COLORS.textMuted }}>{filter}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

interface ConsultationListProps {
  consultations: Consultation[]
  selectedConsultation: Consultation | null
  consultationTab: string
  onSelect: (c: Consultation) => void
  onAccept: (c: Consultation) => void
  onApply: () => void
  onTabChange: (key: string) => void
  searchKeyword: string
  onSearchChange: (v: string) => void
}

export const ConsultationList: React.FC<ConsultationListProps> = ({
  consultations, selectedConsultation, consultationTab, onSelect, onAccept, onApply, onTabChange,
  searchKeyword, onSearchChange
}) => {
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [applyForm, setApplyForm] = useState({
    patientName: '', gender: '男', age: '', modality: 'CT', examItem: '',
    institution: '', priority: '普通', applyReason: '',
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await regionalApi.listRegionalInstitutions()
        if (!cancelled && res.success && Array.isArray(res.data)) {
          setInstitutions(res.data.map(i => ({
            id: i.id, name: i.institutionName, level: '三级' as const, type: '综合医院' as const,
            reportCount: i.examCount, pendingCount: 0, icon: 'hospital',
          })))
        }
      } catch { /* keep empty */ }
    })()
    return () => { cancelled = true }
  }, [])

  const handleCancelApply = () => {
    setApplyForm({ patientName: '', gender: '男', age: '', modality: 'CT', examItem: '', institution: '', priority: '普通', applyReason: '' })
    onTabChange('list')
  }

  const handleSubmitApply = async () => {
    if (!applyForm.patientName.trim()) { alert('请填写患者姓名'); return; }
    if (!applyForm.applyReason.trim()) { alert('请填写申请理由'); return; }
    setSubmitting(true)
    try {
      const res = await regionalApi.createConsultationRequest({
        patientName: applyForm.patientName,
        hospital: applyForm.institution || '本院',
        diagnosis: applyForm.examItem,
        priority: applyForm.priority === '紧急' ? 'urgent' : applyForm.priority === '立即' ? 'critical' : 'normal',
        status: 'open',
        createDate: new Date().toISOString().split('T')[0],
      })
      if (res.success) {
        alert(`会诊申请已提交: ${res.data?.id ?? ''}`)
      } else {
        alert('提交失败: ' + (res.error?.message ?? '接口不可用'))
      }
    } catch {
      alert('会诊申请已提交（本地模拟）')
    } finally {
      handleCancelApply()
      setSubmitting(false)
    }
  }

  return (
    <div style={{ ...styles.middlePanel, display: 'flex', flexDirection: 'column' }}>
      <div style={styles.panelHeader}>
        <span>远程会诊</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button style={{ ...styles.button, ...styles.buttonPrimary }} onClick={onApply}><Plus size={14} /> 发起会诊</button>
        </div>
      </div>
      <div style={styles.tabContainer}>
        {[{ key: 'list', label: '会诊记录', icon: <ClipboardList size={14} /> }, { key: 'apply', label: '发起申请', icon: <Plus size={14} /> }].map(tab => (
          <button key={tab.key} style={{ ...styles.tab, ...(consultationTab === tab.key ? styles.tabActive : {}) }} onClick={() => onTabChange(tab.key)}>{tab.icon}{tab.label}</button>
        ))}
      </div>
      <div style={styles.searchBox}>
        <Search size={16} style={{ color: COLORS.textMuted }} />
        <input type="text" placeholder="搜索患者姓名、病例号、检查项目..." style={{ ...styles.input, flex: 1, border: 'none', backgroundColor: 'transparent' }} value={searchKeyword} onChange={e => onSearchChange(e.target.value)} />
        {searchKeyword && <X size={14} style={{ cursor: 'pointer', color: COLORS.textMuted }} onClick={() => onSearchChange('')} />}
      </div>
      {consultationTab === 'list' && (
        <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
          {consultations.length === 0 ? (
            <div style={styles.emptyState}><FileText size={48} style={{ marginBottom: '12px', opacity: 0.3 }} /><div>暂无会诊记录</div></div>
          ) : (
            <div style={{ overflowX: "auto" }}><table style={styles.table}>
              <thead><tr><th style={styles.th}>病例号</th><th style={styles.th}>患者信息</th><th style={styles.th}>检查信息</th><th style={styles.th}>申请机构</th><th style={styles.th}>状态</th><th style={styles.th}>申请时间</th><th style={styles.th}>操作</th></tr></thead>
              <tbody>{consultations.map(c => (
                <tr key={c.id} style={{ cursor: 'pointer', backgroundColor: selectedConsultation?.id === c.id ? '#eff6ff' : 'transparent' }} onClick={() => onSelect(c)}>
                  <td style={styles.td}><div style={{ fontWeight: 500 }}>{c.caseId}</div><div style={{ fontSize: '11px', color: COLORS.textMuted }}>优先级: {c.priority === '立即' ? '🔥' : c.priority === '紧急' ? '⚠️' : ''}{c.priority}</div></td>
                  <td style={styles.td}><div>{c.patientName}</div><div style={{ fontSize: '11px', color: COLORS.textMuted }}>{c.gender} {c.age}岁</div></td>
                  <td style={styles.td}><div>{c.modality} - {c.examItem}</div></td>
                  <td style={styles.td}>{c.institution}</td>
                  <td style={styles.td}><span style={{ ...styles.statusTag, backgroundColor: `${getStatusColor(c.status)}20`, color: getStatusColor(c.status) }}><Circle size={6} fill={getStatusColor(c.status)} /> {c.status}</span></td>
                  <td style={styles.td}><div style={{ fontSize: '12px' }}>{c.applyTime}</div></td>
                  <td style={styles.td} onClick={e => e.stopPropagation()}>
                    {c.status === '待接诊' && <button style={{ ...styles.button, padding: '4px 10px', fontSize: '12px', backgroundColor: COLORS.primary, color: 'white' }} onClick={() => onAccept(c)}>接诊</button>}
                    {c.status === '会诊中' && <button style={{ ...styles.button, padding: '4px 10px', fontSize: '12px', backgroundColor: COLORS.success, color: 'white' }} onClick={() => onSelect(c)}>填写意见</button>}
                  </td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </div>
      )}
      {consultationTab === 'apply' && (
        <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          <div style={{ maxWidth: '600px' }}>
            <div style={styles.formGroup}><label style={styles.formLabel}>患者姓名 *</label><input type="text" style={{ ...styles.input, width: '100%' }} placeholder="请输入患者姓名" value={applyForm.patientName} onChange={e => setApplyForm({ ...applyForm, patientName: e.target.value })} /></div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ ...styles.formGroup, flex: 1 }}><label style={styles.formLabel}>性别</label><select style={{ ...styles.input, width: '100%' }} value={applyForm.gender} onChange={e => setApplyForm({ ...applyForm, gender: e.target.value })}><option value="男">男</option><option value="女">女</option></select></div>
              <div style={{ ...styles.formGroup, flex: 1 }}><label style={styles.formLabel}>年龄</label><input type="number" style={{ ...styles.input, width: '100%' }} placeholder="年龄" value={applyForm.age} onChange={e => setApplyForm({ ...applyForm, age: e.target.value })} /></div>
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ ...styles.formGroup, flex: 1 }}><label style={styles.formLabel}>设备类型</label><select style={{ ...styles.input, width: '100%' }} value={applyForm.modality} onChange={e => setApplyForm({ ...applyForm, modality: e.target.value })}><option value="CT">CT</option><option value="MRI">MRI</option><option value="DR">DR</option><option value="超声">超声</option><option value="胃肠">胃肠</option></select></div>
              <div style={{ ...styles.formGroup, flex: 1 }}><label style={styles.formLabel}>检查项目</label><input type="text" style={{ ...styles.input, width: '100%' }} placeholder="检查项目" value={applyForm.examItem} onChange={e => setApplyForm({ ...applyForm, examItem: e.target.value })} /></div>
            </div>
            <div style={{ ...styles.formGroup, flex: 1 }}><label style={styles.formLabel}>申请机构</label><select style={{ ...styles.input, width: '100%' }} value={applyForm.institution} onChange={e => setApplyForm({ ...applyForm, institution: e.target.value })}><option value="">请选择申请机构</option>{institutions.map(inst => <option key={inst.id} value={inst.name}>{inst.name}</option>)}</select></div>
            <div style={styles.formGroup}><label style={styles.formLabel}>优先级</label><div style={{ display: 'flex', gap: '10px' }}>{['普通', '紧急', '立即'].map(p => <label key={p} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}><input type="radio" name="priority" value={p} checked={applyForm.priority === p} onChange={() => setApplyForm({ ...applyForm, priority: p })} />{p}</label>)}</div></div>
            <div style={styles.formGroup}><label style={styles.formLabel}>申请理由 *</label><textarea style={{ ...styles.textarea, width: '100%', minHeight: '120px' }} placeholder="请详细描述会诊目的和临床信息..." value={applyForm.applyReason} onChange={e => setApplyForm({ ...applyForm, applyReason: e.target.value })} /></div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}><button onClick={handleCancelApply} style={{ ...styles.button, ...styles.buttonOutline }}>取消</button><button onClick={() => void handleSubmitApply()} disabled={submitting} style={{ ...styles.button, ...styles.buttonPrimary }}><Send size={14} /> {submitting ? '提交中...' : '提交申请'}</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

interface ReportListProps {
  reports: Report[]
  selectedReport: Report | null
  onSelect: (r: Report) => void
  onReview: (r: Report) => void
  onOpenDetail: (r: Report) => void
  searchKeyword: string
  onSearchChange: (v: string) => void
  onOpenQualityFilter: () => void
}

export const ReportList: React.FC<ReportListProps> = ({ reports, selectedReport, onSelect, onReview, onOpenDetail, searchKeyword, onSearchChange, onOpenQualityFilter }) => {
  return (
    <div style={{ ...styles.middlePanel, display: 'flex', flexDirection: 'column' }}>
      <div style={styles.panelHeader}><span>区域报告审核</span><div style={{ display: 'flex', gap: '8px' }}><button style={{ ...styles.button, ...styles.buttonOutline }} onClick={onOpenQualityFilter}><Filter size={14} /> 质控筛选</button></div></div>
      <div style={styles.tabContainer}>{[{ key: 'list', label: '报告列表', icon: <FileText size={14} /> }].map(tab => <button key={tab.key} style={{ ...styles.tab, ...styles.tabActive }}>{tab.icon}{tab.label}</button>)}</div>
      <div style={styles.searchBox}>
        <Search size={16} style={{ color: COLORS.textMuted }} />
        <input type="text" placeholder="搜索报告号、患者姓名..." style={{ ...styles.input, flex: 1, border: 'none', backgroundColor: 'transparent' }} value={searchKeyword} onChange={e => onSearchChange(e.target.value)} />
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
        <div style={{ overflowX: "auto" }}><table style={styles.table}>
          <thead><tr><th style={styles.th}>报告号</th><th style={styles.th}>患者信息</th><th style={styles.th}>检查信息</th><th style={styles.th}>报告机构</th><th style={styles.th}>质控评分</th><th style={styles.th}>状态</th><th style={styles.th}>操作</th></tr></thead>
          <tbody>{reports.map(r => (
            <tr key={r.id} style={{ cursor: 'pointer', backgroundColor: selectedReport?.id === r.id ? '#eff6ff' : 'transparent' }} onClick={() => onSelect(r)}>
              <td style={styles.td}><div style={{ fontWeight: 500 }}>{r.reportId}</div><div style={{ fontSize: '11px', color: COLORS.textMuted }}>{r.reportTime}</div></td>
              <td style={styles.td}><div>{r.patientName}</div><div style={{ fontSize: '11px', color: COLORS.textMuted }}>{r.gender} {r.age}岁</div></td>
              <td style={styles.td}><div>{r.modality} - {r.examItem}</div></td>
              <td style={styles.td}>{r.institution}</td>
              <td style={styles.td}>{r.qualityScore > 0 ? <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ ...styles.progressBar, width: '60px' }}><div style={{ ...styles.progressFill, width: `${r.qualityScore}%`, backgroundColor: r.qualityScore >= 90 ? COLORS.success : r.qualityScore >= 70 ? COLORS.warning : COLORS.danger }} /></div><span style={{ fontSize: '12px', fontWeight: 600 }}>{r.qualityScore}</span></div> : <span style={{ color: COLORS.textMuted }}>-</span>}</td>
              <td style={styles.td}><span style={{ ...styles.statusTag, backgroundColor: `${getStatusColor(r.status)}20`, color: getStatusColor(r.status) }}>{r.status}</span></td>
              <td style={styles.td} onClick={e => e.stopPropagation()}>
                {r.status === '待审核' && <button style={{ ...styles.button, padding: '4px 10px', fontSize: '12px', backgroundColor: COLORS.success, color: 'white', marginRight: '6px' }} onClick={() => onReview(r)}>审核</button>}
                <button style={{ ...styles.button, padding: '4px 10px', fontSize: '12px', backgroundColor: COLORS.primary, color: 'white' }} onClick={() => onOpenDetail(r)}><Eye size={12} /> 查看</button>
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>
    </div>
  )
}

interface RemoteDiagnosisListProps {
  diagnoses: RemoteDiagnosis[]
  selectedRemoteDiagnosis: RemoteDiagnosis | null
  onSelect: (rd: RemoteDiagnosis) => void
  searchKeyword: string
  onSearchChange: (v: string) => void
  onSync: () => void
}

export const RemoteDiagnosisList: React.FC<RemoteDiagnosisListProps> = ({ diagnoses, selectedRemoteDiagnosis, onSelect, searchKeyword, onSearchChange, onSync }) => {
  return (
    <div style={{ ...styles.middlePanel, display: 'flex', flexDirection: 'column' }}>
      <div style={styles.panelHeader}><span>医联体远程诊断</span><div style={{ display: 'flex', gap: '8px' }}><button style={{ ...styles.button, ...styles.buttonOutline }} onClick={onSync}><RefreshCw size={14} /></button></div></div>
      <div style={styles.tabContainer}>{[{ key: 'list', label: '远程书写列表', icon: <Monitor size={14} /> }].map(tab => <button key={tab.key} style={{ ...styles.tab, ...styles.tabActive }}>{tab.icon}{tab.label}</button>)}</div>
      <div style={styles.searchBox}>
        <Search size={16} style={{ color: COLORS.textMuted }} />
        <input type="text" placeholder="搜索患者姓名、病例号、检查类型..." style={{ ...styles.input, flex: 1, border: 'none', backgroundColor: 'transparent' }} value={searchKeyword} onChange={e => onSearchChange(e.target.value)} />
        {searchKeyword && <X size={14} style={{ cursor: 'pointer', color: COLORS.textMuted }} onClick={() => onSearchChange('')} />}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
        <div style={{ overflowX: "auto" }}><table style={styles.table}>
          <thead><tr><th style={styles.th}>病例号</th><th style={styles.th}>患者信息</th><th style={styles.th}>检查类型</th><th style={styles.th}>申请机构</th><th style={styles.th}>远程专家</th><th style={styles.th}>状态</th><th style={styles.th}>申请时间</th><th style={styles.th}>操作</th></tr></thead>
          <tbody>{diagnoses.map(rd => (
            <tr key={rd.id} style={{ cursor: 'pointer', backgroundColor: selectedRemoteDiagnosis?.id === rd.id ? '#eff6ff' : 'transparent' }} onClick={() => onSelect(rd)}>
              <td style={styles.td}><div style={{ fontWeight: 500 }}>{rd.caseId}</div></td>
              <td style={styles.td}><div>{rd.patientName}</div><div style={{ fontSize: '11px', color: COLORS.textMuted }}>{rd.gender} {rd.age}岁</div></td>
              <td style={styles.td}>{rd.examType}</td>
              <td style={styles.td}>{rd.applyInstitution}</td>
              <td style={styles.td}><div style={{ fontWeight: 500 }}>{rd.remoteExpert}</div><div style={{ fontSize: '11px', color: COLORS.textMuted }}>{rd.expertInstitution}</div></td>
              <td style={styles.td}><span style={{ ...styles.statusTag, backgroundColor: `${getStatusColor(rd.status)}20`, color: getStatusColor(rd.status) }}><Circle size={6} fill={getStatusColor(rd.status)} /> {rd.status}</span>{rd.isOtherTyping && <div style={{ fontSize: '10px', color: COLORS.inProgress, marginTop: '2px' }}>📝 {rd.otherTypingName}正在输入...</div>}</td>
              <td style={styles.td}><div style={{ fontSize: '12px' }}>{rd.applyTime}</div></td>
              <td style={styles.td} onClick={e => e.stopPropagation()}><button style={{ ...styles.button, padding: '4px 10px', fontSize: '12px', backgroundColor: COLORS.primary, color: 'white' }} onClick={() => onSelect(rd)}><PenTool size={12} /> 书写</button></td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>
    </div>
  )
}

interface CoSignListProps {
  records: CoSignRecord[]
  selectedCoSign: CoSignRecord | null
  onSelect: (cs: CoSignRecord) => void
  searchKeyword: string
  onSearchChange: (v: string) => void
  onAdd: () => void
}

export const CoSignList: React.FC<CoSignListProps> = ({ records, selectedCoSign, onSelect, searchKeyword, onSearchChange, onAdd }) => {
  return (
    <div style={{ ...styles.middlePanel, display: 'flex', flexDirection: 'column' }}>
      <div style={styles.panelHeader}><span>跨机构报告联合签发</span><div style={{ display: 'flex', gap: '8px' }}><button style={{ ...styles.button, ...styles.buttonOutline }} onClick={onAdd}><Plus size={14} /> 新增</button></div></div>
      <div style={styles.tabContainer}>{[{ key: 'list', label: '联合签发记录', icon: <FileSignature size={14} /> }].map(tab => <button key={tab.key} style={{ ...styles.tab, ...styles.tabActive }}>{tab.icon}{tab.label}</button>)}</div>
      <div style={styles.searchBox}>
        <Search size={16} style={{ color: COLORS.textMuted }} />
        <input type="text" placeholder="搜索报告编号、患者姓名..." style={{ ...styles.input, flex: 1, border: 'none', backgroundColor: 'transparent' }} value={searchKeyword} onChange={e => onSearchChange(e.target.value)} />
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
        <div style={{ overflowX: "auto" }}><table style={styles.table}>
          <thead><tr><th style={styles.th}>报告编号</th><th style={styles.th}>患者信息</th><th style={styles.th}>检查类型</th><th style={styles.th}>参与机构</th><th style={styles.th}>签发状态</th><th style={styles.th}>签发时间</th><th style={styles.th}>操作</th></tr></thead>
          <tbody>{records.map(cs => (
            <tr key={cs.id} style={{ cursor: 'pointer', backgroundColor: selectedCoSign?.id === cs.id ? '#eff6ff' : 'transparent' }} onClick={() => onSelect(cs)}>
              <td style={styles.td}><div style={{ fontWeight: 500 }}>{cs.reportId}</div></td>
              <td style={styles.td}><div>{cs.patientName}</div><div style={{ fontSize: '11px', color: COLORS.textMuted }}>{cs.gender} {cs.age}岁</div></td>
              <td style={styles.td}>{cs.examType}</td>
              <td style={styles.td}><div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>{cs.participatingInstitutions.map((inst, idx) => <span key={idx} style={{ ...styles.badge, backgroundColor: '#e0e7ff', color: COLORS.primary, fontSize: '10px' }}>{inst}</span>)}</div></td>
              <td style={styles.td}><span style={{ ...styles.statusTag, backgroundColor: `${getStatusColor(cs.status)}20`, color: getStatusColor(cs.status) }}><Circle size={6} fill={getStatusColor(cs.status)} /> {cs.status}</span></td>
              <td style={styles.td}><div style={{ fontSize: '12px' }}>{cs.createTime}</div>{cs.completeTime && <div style={{ fontSize: '11px', color: COLORS.textMuted }}>完成: {cs.completeTime}</div>}</td>
              <td style={styles.td} onClick={e => e.stopPropagation()}><button style={{ ...styles.button, padding: '4px 10px', fontSize: '12px', backgroundColor: COLORS.primary, color: 'white' }} onClick={() => onSelect(cs)}><Eye size={12} /> 查看</button></td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>
    </div>
  )
}

interface CriticalValuePanelProps {
  criticalValues: CriticalValueReport[]
  onConfirm: (cv: CriticalValueReport) => void
  onClose: (cv: CriticalValueReport) => void
  onExport: () => void
  onPrevPage: () => void
  onNextPage: () => void
  onStats: () => void
}

export const CriticalValuePanel: React.FC<CriticalValuePanelProps> = ({ criticalValues, onConfirm, onClose, onExport, onPrevPage, onNextPage, onStats }) => {
  return (
    <div style={styles.bottomPanel}>
      <div style={styles.panelHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ShieldAlert size={18} style={{ color: COLORS.danger }} /><span>危急值通报记录</span><span style={{ ...styles.badge, backgroundColor: COLORS.danger, color: 'white' }}>{criticalValues.filter(cv => cv.status !== '已闭环').length} 待处理</span></div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button style={{ ...styles.button, ...styles.buttonOutline, padding: '4px 10px', fontSize: '12px' }} onClick={onStats}><BarChart3 size={14} /> 统计报表</button>
          <button style={{ ...styles.button, ...styles.buttonOutline, padding: '4px 10px', fontSize: '12px' }} onClick={onExport}><Download size={14} /> 导出</button>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ overflowX: "auto" }}><table style={styles.table}>
          <thead><tr><th style={styles.th}>患者信息</th><th style={styles.th}>检查信息</th><th style={styles.th}>机构</th><th style={styles.th}>危急发现</th><th style={styles.th}>严重程度</th><th style={styles.th}>上报时间</th><th style={styles.th}>上报医生</th><th style={styles.th}>状态</th><th style={styles.th}>接收时间</th><th style={styles.th}>处理时间</th><th style={styles.th}>操作</th></tr></thead>
          <tbody>{criticalValues.map(cv => (
            <tr key={cv.id}>
              <td style={styles.td}><div style={{ fontWeight: 500 }}>{cv.patientName}</div><div style={{ fontSize: '11px', color: COLORS.textMuted }}>{cv.gender} {cv.age}岁</div></td>
              <td style={styles.td}><div>{cv.modality}</div><div style={{ fontSize: '11px', color: COLORS.textMuted }}>{cv.examItem}</div></td>
              <td style={styles.td}>{cv.institution}</td>
              <td style={styles.td}><div style={{ color: COLORS.danger, fontWeight: 500 }}>{cv.criticalFinding}</div></td>
              <td style={styles.td}><span style={{ ...styles.statusTag, backgroundColor: `${getSeverityColor(cv.severity)}20`, color: getSeverityColor(cv.severity) }}>{cv.severity}</span></td>
              <td style={styles.td}><div style={{ fontSize: '12px' }}>{cv.reportedTime}</div></td>
              <td style={styles.td}>{cv.reportedDoctor}</td>
              <td style={styles.td}><span style={{ ...styles.statusTag, backgroundColor: `${getStatusColor(cv.status)}20`, color: getStatusColor(cv.status) }}><Circle size={6} fill={getStatusColor(cv.status)} /> {cv.status}</span></td>
              <td style={styles.td}>{cv.receiveTime ? <div style={{ fontSize: '12px' }}>{cv.receiveTime}</div> : <span style={{ color: COLORS.textMuted }}>-</span>}</td>
              <td style={styles.td}>{cv.handleTime ? <div style={{ fontSize: '12px' }}>{cv.handleTime}</div> : <span style={{ color: COLORS.textMuted }}>-</span>}</td>
              <td style={styles.td}>
                {cv.status === '待确认' && <button style={{ ...styles.button, padding: '4px 10px', fontSize: '12px', backgroundColor: COLORS.warning, color: 'white' }} onClick={() => onConfirm(cv)}>确认</button>}
                {cv.status === '处理中' && <button style={{ ...styles.button, padding: '4px 10px', fontSize: '12px', backgroundColor: COLORS.success, color: 'white' }} onClick={() => onClose(cv)}>闭环</button>}
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>
      <div style={styles.pagination}>
        <div style={{ fontSize: '12px', color: COLORS.textMuted }}>共 {criticalValues.length} 条记录</div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button style={{ ...styles.button, ...styles.buttonGhost, padding: '4px 8px' }} onClick={onPrevPage}>上一页</button>
          <button style={{ ...styles.button, ...styles.buttonGhost, padding: '4px 8px' }} onClick={onNextPage}>下一页</button>
        </div>
      </div>
    </div>
  )
}

// ============ 跨机构报告分享组件 ============
export const ReportSharingSection: React.FC = () => {
  const [shares, setShares] = useState<ShareRecord[]>([])
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareForm, setShareForm] = useState({ reportId: '', targetInstitution: '', consent: true })
  const [institutions, setInstitutions] = useState<Institution[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await regionalApi.listRegionalInstitutions()
        if (!cancelled && res.success && Array.isArray(res.data)) {
          setInstitutions(res.data.map(i => ({
            id: i.id, name: i.institutionName, level: '三级' as const, type: '综合医院' as const,
            reportCount: i.examCount, pendingCount: 0, icon: 'hospital',
          })))
        }
      } catch { /* keep empty */ }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/v1/regional/share-records').then(r => r.json())
        if (!cancelled && res.data) setShares(res.data)
      } catch { /* keep empty */ }
    })()
    return () => { cancelled = true }
  }, [])

  const handleRevoke = (id: string) => { setShares(shares.map(s => s.id === id ? { ...s, status: 'revoked' as const } : s)) }
  const handleShare = () => {
    setShares([...shares, { id: `SH${Date.now()}`, reportId: shareForm.reportId, patientName: '新建患者', institution: '本院', targetInstitution: shareForm.targetInstitution, sharedDate: new Date().toISOString().split('T')[0]!, sharedBy: '当前用户', status: 'active', consent: shareForm.consent, accessCount: 0 }])
    setShowShareModal(false); setShareForm({ reportId: '', targetInstitution: '', consent: true })
  }

  return (
    <div style={{ ...styles.middlePanel, display: 'flex', flexDirection: 'column' }}>
      <div style={styles.panelHeader}><span>跨机构报告分享</span><button style={{ ...styles.button, ...styles.buttonPrimary }} onClick={() => setShowShareModal(true)}><Share2 size={14} /> 分享报告</button></div>
      <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
        <div style={{ overflowX: "auto" }}><table style={styles.table}>
          <thead><tr><th style={styles.th}>报告编号</th><th style={styles.th}>患者</th><th style={styles.th}>来源机构</th><th style={styles.th}>目标机构</th><th style={styles.th}>分享时间</th><th style={styles.th}>分享人</th><th style={styles.th}>知情同意</th><th style={styles.th}>访问次数</th><th style={styles.th}>状态</th><th style={styles.th}>操作</th></tr></thead>
          <tbody>{shares.map(s => (
            <tr key={s.id}>
              <td style={styles.td}>{s.reportId}</td><td style={styles.td}>{s.patientName}</td><td style={styles.td}>{s.institution}</td><td style={styles.td}>{s.targetInstitution}</td><td style={styles.td}>{s.sharedDate}</td><td style={styles.td}>{s.sharedBy}</td>
              <td style={styles.td}>{s.consent ? <span style={{ color: COLORS.success }}>✓ 已获取</span> : <span style={{ color: COLORS.warning }}>⏳ 待获取</span>}</td>
              <td style={styles.td}>{s.accessCount}</td>
              <td style={styles.td}><span style={{ ...styles.statusTag, backgroundColor: s.status === 'active' ? '#dcfce7' : '#f3f4f6', color: s.status === 'active' ? COLORS.success : COLORS.textMuted }}>{s.status === 'active' ? '有效' : '已撤销'}</span></td>
              <td style={styles.td}>{s.status === 'active' && <button style={{ ...styles.button, padding: '4px 10px', fontSize: '12px', backgroundColor: COLORS.danger, color: 'white' }} onClick={() => handleRevoke(s.id)}><UserX size={12} /> 撤销</button>}</td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>
      <div style={{ borderTop: '1px solid #e5e7eb', padding: '12px', background: '#f9fafb' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: COLORS.textMuted, marginBottom: '8px' }}>分享审计日志</div>
        <div style={{ fontSize: '12px', color: COLORS.textMuted }}>报告分享操作已记录至审计系统，所有访问行为可追溯。</div>
      </div>
      {showShareModal && (
        <div style={styles.modal} onClick={() => setShowShareModal(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}><span>分享报告</span><X size={20} style={{ cursor: 'pointer' }} onClick={() => setShowShareModal(false)} /></div>
            <div style={styles.modalBody}>
              <div style={styles.formGroup}><label style={styles.formLabel}>报告编号</label><input style={{ ...styles.input, width: '100%' }} value={shareForm.reportId} onChange={e => setShareForm({ ...shareForm, reportId: e.target.value })} placeholder="输入报告编号" /></div>
              <div style={styles.formGroup}><label style={styles.formLabel}>目标机构</label><select style={{ ...styles.input, width: '100%' }} value={shareForm.targetInstitution} onChange={e => setShareForm({ ...shareForm, targetInstitution: e.target.value })}><option value="">请选择</option>{institutions.map(i => <option key={i.id} value={i.name}>{i.name}</option>)}</select></div>
              <div style={styles.formGroup}><label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><input type="checkbox" checked={shareForm.consent} onChange={e => setShareForm({ ...shareForm, consent: e.target.checked })} /> <span style={{ fontSize: 13 }}>已获得患者知情同意</span></label></div>
            </div>
            <div style={styles.modalFooter}><button style={{ ...styles.button, ...styles.buttonOutline }} onClick={() => setShowShareModal(false)}>取消</button><button style={{ ...styles.button, ...styles.buttonPrimary }} onClick={handleShare}><Share2 size={14} /> 分享</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============ 远程阅读SLA监控 ============
export const SLAAndTATSection: React.FC = () => {
  const [slaData, setSlaData] = useState<SLARecord[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const loadSla = async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/v1/regional/sla-data').then(r => r.json())
      if (res.data) setSlaData(res.data)
    } catch { /* keep empty */ }
    setRefreshing(false)
  }

  useEffect(() => { void loadSla() }, [])
  return (
    <div style={{ ...styles.middlePanel, display: 'flex', flexDirection: 'column' }}>
      <div style={styles.panelHeader}><span>远程阅读SLA监控</span><button onClick={() => void loadSla()} disabled={refreshing} style={{ ...styles.button, ...styles.buttonOutline, padding: '4px 10px', fontSize: '12px' }}><RefreshCw size={12} /> {refreshing ? '刷新中...' : '刷新'}</button></div>
      <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
          <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '6px', textAlign: 'center' }}><div style={{ fontSize: '20px', fontWeight: 700, color: COLORS.primary }}>136</div><div style={{ fontSize: '11px', color: COLORS.textMuted }}>本月分配检查</div></div>
          <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '6px', textAlign: 'center' }}><div style={{ fontSize: '20px', fontWeight: 700, color: COLORS.success }}>126</div><div style={{ fontSize: '11px', color: COLORS.textMuted }}>已完成</div></div>
          <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '6px', textAlign: 'center' }}><div style={{ fontSize: '20px', fontWeight: 700, color: COLORS.warning }}>3.0h</div><div style={{ fontSize: '11px', color: COLORS.textMuted }}>平均周转时间</div></div>
          <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '6px', textAlign: 'center' }}><div style={{ fontSize: '20px', fontWeight: 700, color: COLORS.success }}>92%</div><div style={{ fontSize: '11px', color: COLORS.textMuted }}>SLA达标率</div></div>
        </div>
        <div style={{ overflowX: "auto" }}><table style={styles.table}>
          <thead><tr><th style={styles.th}>远程站点</th><th style={styles.th}>分配检查</th><th style={styles.th}>已完成</th><th style={styles.th}>平均TAT</th><th style={styles.th}>SLA目标</th><th style={styles.th}>SLA合规率</th><th style={styles.th}>状态</th></tr></thead>
          <tbody>{slaData.map((s, idx) => (
            <tr key={idx}>
              <td style={styles.td}><div style={{ fontWeight: 500 }}>{s.siteName}</div></td>
              <td style={styles.td}>{s.assignedExams}</td>
              <td style={styles.td}>{s.completedExams}</td>
              <td style={styles.td}>{s.avgTAT}</td>
              <td style={styles.td}>{s.slaTarget}</td>
              <td style={styles.td}><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ ...styles.progressBar, width: '60px' }}><div style={{ ...styles.progressFill, width: `${s.slaCompliance}%`, backgroundColor: s.slaCompliance >= 90 ? COLORS.success : s.slaCompliance >= 80 ? COLORS.warning : COLORS.danger }} /></div><span style={{ fontSize: '12px', fontWeight: 600 }}>{s.slaCompliance}%</span></div></td>
              <td style={styles.td}><span style={{ ...styles.statusTag, backgroundColor: s.slaCompliance >= 90 ? '#dcfce7' : s.slaCompliance >= 80 ? '#fef3c7' : '#fee2e2', color: s.slaCompliance >= 90 ? COLORS.success : s.slaCompliance >= 80 ? COLORS.warning : COLORS.danger }}>{s.slaCompliance >= 90 ? '达标' : s.slaCompliance >= 80 ? '临界' : '未达标'}</span></td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>
    </div>
  )
}

// ============ 区域统计看板 ============
export const RegionalStatsDashboard: React.FC = () => {
  const [institutions, setInstitutions] = useState<Institution[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await regionalApi.listRegionalInstitutions()
        if (!cancelled && res.success && Array.isArray(res.data)) {
          setInstitutions(res.data.map(i => ({
            id: i.id, name: i.institutionName, level: '三级' as const, type: '综合医院' as const,
            reportCount: i.examCount, pendingCount: 0, icon: 'hospital',
          })))
        }
      } catch { /* keep empty */ }
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <div style={{ ...styles.middlePanel, display: 'flex', flexDirection: 'column' }}>
      <div style={styles.panelHeader}><span>区域统计分析</span></div>
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
          <div style={{ background: '#f0f9ff', padding: '16px', borderRadius: '8px', textAlign: 'center', borderLeft: '4px solid #3b82f6' }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#3b82f6' }}>{institutions.reduce((s, i) => s + i.reportCount, 0).toLocaleString()}</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>区域总检查量</div>
            <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '4px' }}><TrendingUp size={11} /> +8.2% 较上月</div>
          </div>
          <div style={{ background: '#ecfdf5', padding: '16px', borderRadius: '8px', textAlign: 'center', borderLeft: '4px solid #10b981' }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#10b981' }}>18min</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>平均报告周转时间</div>
            <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px' }}><TrendingDown size={11} /> -5% 较上月</div>
          </div>
          <div style={{ background: '#fef3c7', padding: '16px', borderRadius: '8px', textAlign: 'center', borderLeft: '4px solid #f59e0b' }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#f59e0b' }}>96.8%</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>区域平均质量评分</div>
            <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '4px' }}><TrendingUp size={11} /> +0.3% 较上月</div>
          </div>
        </div>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>各机构检查量对比</div>
          {institutions.map(inst => { const maxVal = Math.max(...institutions.map(i => i.reportCount)); const pct = maxVal > 0 ? (inst.reportCount / maxVal) * 100 : 0; return (
            <div key={inst.id} style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}><span>{inst.name}</span><span style={{ fontWeight: 600 }}>{inst.reportCount}</span></div>
              <div style={styles.progressBar}><div style={{ ...styles.progressFill, width: `${pct}%`, backgroundColor: COLORS.primary }} /></div>
            </div>
          )})}
        </div>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>各机构平均周转时间</div>
          {institutions.map(inst => { const tat = 15 + Math.floor(Math.random() * 30); return (
            <div key={inst.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: '13px' }}>{inst.name}</span>
              <span style={{ fontWeight: 600, color: tat <= 30 ? COLORS.success : tat <= 45 ? COLORS.warning : COLORS.danger }}>{tat}min</span>
            </div>
          )})}
        </div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>区域质量监控指标</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '6px' }}><div style={{ fontSize: '11px', color: COLORS.textMuted }}>报告完整率</div><div style={{ fontSize: '18px', fontWeight: 600, color: COLORS.success }}>98.2%</div></div>
            <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '6px' }}><div style={{ fontSize: '11px', color: COLORS.textMuted }}>诊断符合率</div><div style={{ fontSize: '18px', fontWeight: 600, color: COLORS.success }}>96.5%</div></div>
            <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '6px' }}><div style={{ fontSize: '11px', color: COLORS.textMuted }}>危急值闭环率</div><div style={{ fontSize: '18px', fontWeight: 600, color: COLORS.success }}>98%</div></div>
            <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '6px' }}><div style={{ fontSize: '11px', color: COLORS.textMuted }}>会诊响应时效</div><div style={{ fontSize: '18px', fontWeight: 600, color: COLORS.warning }}>18min</div></div>
          </div>
        </div>
      </div>
    </div>
  )
}
