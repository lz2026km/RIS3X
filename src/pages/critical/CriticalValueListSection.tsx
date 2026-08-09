import { useState } from 'react'
import {
  ShieldAlert, AlertTriangle, X,
  ChevronRight, FileText, Activity, Workflow, Eye, Download, Heart, Wind, Siren,
  Brain, Bone, AlertOctagon,
} from 'lucide-react'
import type { CriticalValue } from './types'
import { PRIMARY_COLOR, PRIMARY_LIGHT } from './types'
import { FilterBar, CriticalValueList } from './CriticalValueList'

const NATIONAL_CRITICAL_ITEMS: Record<string, { code: string; name: string; icon: any; color: string; description: string }[]> = {
  'CT/MR': [
    { code: 'CV-RAD-001', name: '主动脉夹层', icon: Heart, color: '#dc2626', description: '主动脉内膜片影，真假腔形成' },
    { code: 'CV-RAD-002', name: '肺栓塞', icon: Wind, color: '#dc2626', description: '肺动脉内血栓或脂肪栓塞' },
    { code: 'CV-RAD-003', name: '张力性气胸', icon: Siren, color: '#dc2626', description: '患侧肺完全受压，纵隔移位' },
    { code: 'CV-RAD-004', name: '急性脑疝', icon: Brain, color: '#dc2626', description: '中线偏移>5mm，脑室受压' },
    { code: 'CV-RAD-005', name: '脑血管栓塞/梗死', icon: Brain, color: '#d97706', description: '大血管闭塞或大面积梗死' },
    { code: 'CV-RAD-006', name: '消化道穿孔', icon: AlertTriangle, color: '#dc2626', description: '腹腔游离气体' },
    { code: 'CV-RAD-007', name: '肠系膜栓塞', icon: AlertTriangle, color: '#d97706', description: '肠系膜血管栓塞伴肠管扩张' },
    { code: 'CV-RAD-008', name: '腹部脏器急性出血', icon: AlertOctagon, color: '#dc2626', description: '腹腔或腹膜后血肿' },
  ],
  'DR/CR': [
    { code: 'CV-RAD-009', name: '气胸(≥30%)', icon: Siren, color: '#dc2626', description: '肺压缩≥30%' },
    { code: 'CV-RAD-010', name: '骨折急性并发症', icon: Bone, color: '#d97706', description: '长骨干骨折伴血管神经损伤' },
    { code: 'CV-RAD-011', name: '心影增大伴心衰', icon: Heart, color: '#d97706', description: '心胸比>0.6伴肺水肿' },
  ],
  'DSA/介入': [
    { code: 'CV-RAD-012', name: '介入术后血管急性闭塞', icon: AlertOctagon, color: '#dc2626', description: '支架内急性血栓形成' },
    { code: 'CV-RAD-013', name: '对比剂严重过敏反应', icon: AlertTriangle, color: '#dc2626', description: '喉头水肿或过敏性休克' },
  ],
  超声: [
    { code: 'CV-RAD-014', name: '急性心包填塞', icon: Heart, color: '#dc2626', description: '心包积液伴右心受压' },
    { code: 'CV-RAD-015', name: '宫外孕破裂', icon: AlertOctagon, color: '#dc2626', description: '腹腔积血' },
  ],
}

const CriticalItemsDirectory = () => {
  const [expandedCategory, setExpandedCategory] = useState<string | null>('CT/MR')
  const [showModal, setShowModal] = useState(false)

  const categoryIcons: Record<string, any> = { 'CT/MR': Activity, 'DR/CR': FileText, 'DSA/介入': Workflow, '超声': Activity }

  return (
    <>
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: 16 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: `linear-gradient(135deg, ${PRIMARY_COLOR} 0%, ${PRIMARY_LIGHT} 100%)`, borderRadius: '12px 12px 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldAlert size={18} style={{ color: '#fff' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>国家卫健委2024年版危急值目录</span>
          </div>
          <button onClick={() => setShowModal(true)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Eye size={12} />完整目录
          </button>
        </div>
        <div style={{ padding: 12 }}>
          {Object.entries(NATIONAL_CRITICAL_ITEMS).map(([category, items]) => {
            const CategoryIcon = categoryIcons[category] || AlertTriangle
            const isExpanded = expandedCategory === category
            return (
              <div key={category} style={{ marginBottom: 8 }}>
                <div onClick={() => setExpandedCategory(isExpanded ? null : category)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: isExpanded ? 'var(--color-info-bg)' : 'var(--bg-card)', borderRadius: 8, cursor: 'pointer', border: `1px solid ${isExpanded ? 'var(--color-info-border)' : 'var(--border-color)'}` }}>
                  <CategoryIcon size={14} style={{ color: PRIMARY_COLOR }} />
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: '#1e40af' }}>{category}</span>
                  <span style={{ fontSize: 12, color: '#64748b', background: 'var(--border-light)', padding: '2px 8px', borderRadius: 10 }}>{items.length}项</span>
                  <ChevronRight size={14} style={{ color: '#64748b', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                </div>
                {isExpanded && (
                  <div style={{ padding: '8px 12px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, background: 'var(--bg-card)', borderRadius: '0 0 8px 8px', border: '1px solid var(--border-color)', borderTop: 'none' }}>
                    {items.map((item) => {
                      const ItemIcon = item.icon
                      return (
                        <div key={item.code} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'var(--bg-card)', borderRadius: 6, border: '1px solid var(--border-light)' }}>
                          <div style={{ width: 28, height: 28, borderRadius: 6, background: item.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ItemIcon size={14} style={{ color: item.color }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                            <div style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.code}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {showModal && (
        <div onClick={() => setShowModal(false)} role="dialog" aria-modal="true" aria-label="国家卫健委2024年版放射科危急值目录" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 'var(--z-modal, 500)' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 700, maxHeight: '80vh', background: 'var(--bg-card)', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: `linear-gradient(135deg, ${PRIMARY_COLOR} 0%, ${PRIMARY_LIGHT} 100%)` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <ShieldAlert size={20} style={{ color: '#fff' }} />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>国家卫健委2024年版放射科危急值目录</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>共{Object.values(NATIONAL_CRITICAL_ITEMS).flat().length}项危急值条目</div>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} style={{ color: '#fff' }} />
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
              {Object.entries(NATIONAL_CRITICAL_ITEMS).map(([category, items]) => {
                const CategoryIcon = categoryIcons[category] || AlertTriangle
                return (
                  <div key={category} style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid ' + PRIMARY_COLOR }}>
                      <CategoryIcon size={16} style={{ color: PRIMARY_COLOR }} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: PRIMARY_COLOR }}>{category}</span>
                      <span style={{ fontSize: 12, color: '#fff', background: PRIMARY_COLOR, padding: '2px 8px', borderRadius: 10 }}>{items.length}项</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {items.map((item) => {
                        const ItemIcon = item.icon
                        return (
                          <div key={item.code} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 12, background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                            <div style={{ width: 36, height: 36, borderRadius: 8, background: item.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <ItemIcon size={18} style={{ color: item.color }} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>{item.name}</span>
                                <span style={{ fontSize: 12, color: '#fff', background: item.color, padding: '1px 6px', borderRadius: 4 }}>{item.code}</span>
                              </div>
                              <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{item.description}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'center', gap: 12 }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '10px 24px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>关闭</button>
              <button onClick={() => { const blob = new Blob([JSON.stringify(NATIONAL_CRITICAL_ITEMS, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = '危急值目录.json'; link.click(); URL.revokeObjectURL(url) }}
                style={{ padding: '10px 24px', borderRadius: 8, border: '1px solid ' + PRIMARY_COLOR, background: PRIMARY_COLOR, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Download size={14} />导出目录
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export interface CriticalValueListSectionProps {
  search: string
  setSearch: (v: string) => void
  statusFilter: string
  setStatusFilter: (v: string) => void
  modalityFilter: string
  setModalityFilter: (v: string) => void
  severityFilter: string
  setSeverityFilter: (v: string) => void
  timeRangeFilter: string
  setTimeRangeFilter: (v: string) => void
  dateRange: string
  setDateRange: (v: string) => void
  onBatchNotify: () => void
  onBatchProcess: () => void
  selectedCount: number
  onOpenSettings: () => void
  filtered: CriticalValue[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onToggleSelectAll: () => void
  onProcess: (cv: CriticalValue) => void
  onViewDetail: (cv: CriticalValue) => void
  onContactClinical: (cv: CriticalValue) => void
  onVoiceCall: (cv: CriticalValue) => void
  onClinicalReceipt: (cv: CriticalValue) => void
  onAcknowledge: (cv: CriticalValue) => void
  onTransferToFollowUp: (cv: CriticalValue) => void
  onEscalate: (cv: CriticalValue) => void
  onCloseLoop: (cv: CriticalValue) => void
  onDelete: (cv: CriticalValue) => void
  onGo5Step: (cv: CriticalValue) => void
  criticalValues: CriticalValue[]
}

export const CriticalValueListSection = (props: CriticalValueListSectionProps) => {
  const { filtered, selectedIds, onToggleSelect, onToggleSelectAll, onProcess, onViewDetail, onContactClinical, onVoiceCall, onClinicalReceipt, onAcknowledge, onTransferToFollowUp, onEscalate, onCloseLoop, onDelete, onGo5Step, criticalValues, ...filterProps } = props

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <div style={{ width: 280, flexShrink: 0 }}>
        <CriticalItemsDirectory />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FilterBar {...filterProps} />
        <CriticalValueList
          filtered={filtered}
          selectedIds={selectedIds}
          onToggleSelect={onToggleSelect}
          onToggleSelectAll={onToggleSelectAll}
          onProcess={onProcess}
          onViewDetail={onViewDetail}
          onContactClinical={onContactClinical}
          onVoiceCall={onVoiceCall}
          onClinicalReceipt={onClinicalReceipt}
          onAcknowledge={onAcknowledge}
          onTransferToFollowUp={onTransferToFollowUp}
          onEscalate={onEscalate}
          onCloseLoop={onCloseLoop}
          onDelete={onDelete}
          onGo5Step={onGo5Step}
          criticalValues={criticalValues}
        />
      </div>
    </div>
  )
}
