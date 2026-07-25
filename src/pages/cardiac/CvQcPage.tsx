import { useState } from 'react'
import { message } from 'antd'
import { Shield, CheckCircle2, AlertTriangle, XCircle, BarChart3, ClipboardCheck } from 'lucide-react'

type QcMetric = {
  label: string
  current: number
  target: number
  status: 'pass' | 'warning' | 'fail'
}

type ModalityQc = {
  modality: string
  metrics: QcMetric[]
}

const MODALITY_QC: ModalityQc[] = [
  {
    modality: 'CCTA',
    metrics: [
      { label: 'Image Quality Score', current: 4.2, target: 4.0, status: 'pass' },
      { label: 'Motion Score', current: 1.8, target: 2.0, status: 'pass' },
      { label: 'Contrast-to-Noise Ratio', current: 8.5, target: 6.0, status: 'pass' },
      { label: 'Diagnostic Confidence %', current: 92, target: 90, status: 'pass' },
      { label: 'ACR Compliance %', current: 95, target: 95, status: 'pass' },
      { label: 'CAD-RADS Documentation %', current: 88, target: 95, status: 'warning' },
      { label: 'Turnaround Time (min)', current: 45, target: 60, status: 'pass' },
    ],
  },
  {
    modality: 'CMR',
    metrics: [
      { label: 'Image Quality Score', current: 4.0, target: 4.0, status: 'pass' },
      { label: 'LGE Present Documentation %', current: 85, target: 95, status: 'warning' },
      { label: 'T1/T2 Mapping Completion %', current: 78, target: 90, status: 'warning' },
      { label: 'Strain Analysis %', current: 65, target: 80, status: 'fail' },
      { label: 'LVEF Accuracy (vs reference)', current: 90, target: 95, status: 'warning' },
      { label: 'Turnaround Time (min)', current: 90, target: 90, status: 'pass' },
    ],
  },
  {
    modality: 'Echocardiography',
    metrics: [
      { label: 'Image Quality Score', current: 3.8, target: 4.0, status: 'warning' },
      { label: 'LVEF Documentation %', current: 96, target: 95, status: 'pass' },
      { label: 'Diastolic Function Grading %', current: 82, target: 95, status: 'fail' },
      { label: 'Valve Lesion Completeness %', current: 90, target: 90, status: 'pass' },
      { label: 'Strain (GLS) Performance %', current: 55, target: 80, status: 'fail' },
      { label: 'Report Timeliness (hrs)', current: 4, target: 6, status: 'pass' },
    ],
  },
  {
    modality: 'Cath Lab',
    metrics: [
      { label: 'Contrast Volume < 100mL %', current: 72, target: 80, status: 'warning' },
      { label: 'Radiation Dose Tracking %', current: 98, target: 100, status: 'pass' },
      { label: 'FFR/IVUS Usage Rate %', current: 65, target: 70, status: 'warning' },
      { label: 'Complication Rate %', current: 2.1, target: 3.0, status: 'pass' },
      { label: 'Door-to-Balloon Time (min)', current: 68, target: 90, status: 'pass' },
      { label: 'Hemodynamic Data Completeness %', current: 85, target: 95, status: 'warning' },
    ],
  },
  {
    modality: 'Vascular',
    metrics: [
      { label: 'Carotid Stenosis Grading %', current: 94, target: 95, status: 'pass' },
      { label: 'ABI Measurement Documentation %', current: 80, target: 90, status: 'warning' },
      { label: 'Aorta Diameter Measurement Accuracy', current: 4.1, target: 4.0, status: 'pass' },
      { label: 'Endoleak Classification %', current: 88, target: 95, status: 'warning' },
      { label: 'Report Generation Time (hrs)', current: 12, target: 24, status: 'pass' },
    ],
  },
]

const STATUS_CONFIG = {
  pass: { icon: CheckCircle2, color: '#16a34a', bg: '#dcfce7' },
  warning: { icon: AlertTriangle, color: '#d97706', bg: '#fef3c7' },
  fail: { icon: XCircle, color: '#dc2626', bg: '#fee2e2' },
}

export default function CvQcPage() {
  const [activeModality, setActiveModality] = useState(0)

  const overallPass = MODALITY_QC.reduce((a, m) => a + m.metrics.filter(x => x.status === 'pass').length, 0)
  const overallTotal = MODALITY_QC.reduce((a, m) => a + m.metrics.length, 0)

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 16px' }}>
        <Shield size={24} /> CV Quality Control Dashboard
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <div style={{ padding: 16, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
          <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, textTransform: 'uppercase' }}>Overall QC Pass Rate</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', marginTop: 4 }}>{Math.round(overallPass / overallTotal * 100)}%</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{overallPass}/{overallTotal} metrics passing</div>
        </div>
        {MODALITY_QC.map((m, i) => (
          <div key={m.modality} onClick={() => setActiveModality(i)} style={{ padding: 16, background: activeModality === i ? '#eff6ff' : '#fff', borderRadius: 8, border: activeModality === i ? '2px solid #1e40af' : '1px solid #e2e8f0', cursor: 'pointer' }}>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>{m.modality}</div>
            <div style={{ fontSize: 24, fontWeight: 'bold', marginTop: 4 }}>{Math.round(m.metrics.filter(x => x.status !== 'fail').length / m.metrics.length * 100)}%</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{m.metrics.filter(x => x.status === 'pass').length} pass, {m.metrics.filter(x => x.status === 'fail').length} fail</div>
          </div>
        ))}
      </div>

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 600, fontSize: 14 }}>
          {MODALITY_QC[activeModality].modality} — Detailed Metrics
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '10px 16px', textAlign: 'left' }}>Metric</th>
              <th style={{ padding: '10px 16px', textAlign: 'center' }}>Current</th>
              <th style={{ padding: '10px 16px', textAlign: 'center' }}>Target</th>
              <th style={{ padding: '10px 16px', textAlign: 'center' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {MODALITY_QC[activeModality].metrics.map(m => {
              const s = STATUS_CONFIG[m.status]
              const Icon = s.icon
              return (
                <tr key={m.label} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ClipboardCheck size={16} color="#64748b" /> {m.label}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600 }}>{m.current}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center', color: '#64748b' }}>{m.target}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: s.bg, color: s.color, padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
                      <Icon size={14} /> {m.status === 'pass' ? 'Pass' : m.status === 'warning' ? 'Warning' : 'Fail'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button onClick={() => message.success('QC 报告生成已启动')} style={{ padding: '8px 16px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <BarChart3 size={16} /> Generate QC Report
        </button>
      </div>
    </div>
  )
}
