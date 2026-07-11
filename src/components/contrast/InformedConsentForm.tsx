import { useState } from 'react'
import { FileText, CheckCircle, XCircle, Download, Printer, PenLine, AlertTriangle } from 'lucide-react'
import { sanitizeHtml } from '../../utils/sanitization'
import type { InformedConsentData } from '../../templates/contrast'
import { generateInformedConsentHtml } from '../../templates/contrast'

const MOCK_PATIENT: InformedConsentData = {
  patientId: 'P202506001', patientName: '张小明', gender: '男', age: 52, idNumber: '110101******1234',
  inpatientNo: 'IP20250601', examName: '胸部CT增强扫描', modality: 'CT', contrastName: '碘海醇',
  contrastGenericName: 'Iohexol', route: 'IV', dose: '80mL (350mgI/mL)', indication: '肺部占位性病变待查',
  attendingPhysician: '李伟', hospitalName: 'XX市人民医院',
  risks: [], benefits: [], alternatives: [],
  patientStatement: '', createdAt: new Date().toISOString(),
}

const DEFAULT_RISKS = [
  '过敏反应（荨麻疹、呼吸困难、喉头水肿、过敏性休克）',
  '造影剂肾病（eGFR<30患者风险显著升高）',
  '造影剂外渗（局部肿胀、疼痛、皮肤坏死）',
  '心血管反应（血压下降、心律失常）',
]

export default function InformedConsentForm() {
  const [data, setData] = useState<InformedConsentData>(MOCK_PATIENT)
  const [signed, setSigned] = useState(false)
  const [signature, setSignature] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [acceptedRisks, setAcceptedRisks] = useState<boolean[]>(DEFAULT_RISKS.map(() => false))
  const [egfrValue, setEgfrValue] = useState<number>(85)
  const [egfrChecked, setEgfrChecked] = useState(false)

  const allRisksAccepted = acceptedRisks.every(Boolean)

  const handleSign = () => {
    if (!signature.trim() || !allRisksAccepted || !egfrChecked) return
    setData(prev => ({ ...prev, patientSignature: signature, patientSignedAt: new Date().toISOString() }))
    setSigned(true)
  }

  const handlePrint = () => {
    const html = generateInformedConsentHtml({ ...data, patientSignature: signature, patientSignedAt: new Date().toISOString() })
    const win = window.open('', '_blank')
    if (win) { win.document.write(html); win.document.close(); win.print() }
  }

  const togglePreview = () => setShowPreview(!showPreview)

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#f0f6fc', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#1e40af,#1e3a8a)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <FileText size={24} /><span style={{ fontSize: 20, fontWeight: 600 }}>对比剂使用知情同意书</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={togglePreview} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: showPreview ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            {showPreview ? <XCircle size={14} /> : <FileText size={14} />}{showPreview ? '关闭预览' : '预览'}
          </button>
          <button onClick={handlePrint} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <Printer size={14} />打印
          </button>
        </div>
      </div>

      <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: showPreview ? '1fr 1fr' : '1fr', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>患者信息</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: '姓名', value: data.patientName },
                { label: '性别', value: data.gender },
                { label: '年龄', value: `${data.age}岁` },
                { label: '病历号', value: data.patientId },
                { label: '检查项目', value: data.examName },
                { label: '对比剂', value: `${data.contrastName} (${data.contrastGenericName})` },
                { label: '申请医师', value: data.attendingPhysician },
              ].map(field => (
                <div key={field.label} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ color: '#8b949e', minWidth: 60, fontSize: 12 }}>{field.label}</span>
                  <span style={{ fontSize: 13 }}>{field.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} style={{ color: '#f59e0b' }} />风险告知
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {DEFAULT_RISKS.map((risk, idx) => (
                <label key={idx} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 12px', background: '#0d1117', borderRadius: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={acceptedRisks[idx]} onChange={() => { const n = [...acceptedRisks]; n[idx] = !n[idx]; setAcceptedRisks(n) }} style={{ marginTop: 3 }} />
                  <span style={{ fontSize: 13, color: acceptedRisks[idx] ? '#f0f6fc' : '#8b949e' }}>{risk}</span>
                </label>
              ))}
            </div>
            {!allRisksAccepted && <div style={{ marginTop: 8, fontSize: 12, color: '#f59e0b' }}>请阅读并确认所有风险告知内容</div>}
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>eGFR 评估确认</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13, color: '#8b949e' }}>eGFR 值:</span>
              <input type="number" value={egfrValue} onChange={e => setEgfrValue(Number(e.target.value))} style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #30363d', background: '#0d1117', color: '#f0f6fc', width: 80, fontSize: 13 }} />
              <span style={{ fontSize: 13 }}>mL/min</span>
              <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: egfrValue >= 60 ? '#22c55e20' : '#ef444420', color: egfrValue >= 60 ? '#22c55e' : '#ef4444' }}>
                {egfrValue >= 60 ? '安全' : egfrValue >= 30 ? '中风险' : '高风险'}
              </span>
            </div>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, padding: '8px 12px', background: '#0d1117', borderRadius: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={egfrChecked} onChange={e => setEgfrChecked(e.target.checked)} />
              <span style={{ fontSize: 13 }}>已确认患者eGFR值，评估风险后可进行对比剂注射</span>
            </label>
          </div>

          {!signed ? (
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <PenLine size={16} />电子签名
              </div>
              <input type="text" value={signature} onChange={e => setSignature(e.target.value)} placeholder="请输入患者/家属姓名进行电子签名" style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #30363d', background: '#0d1117', color: '#f0f6fc', fontSize: 14, outline: 'none', marginBottom: 12, boxSizing: 'border-box' }} />
              <button onClick={handleSign} disabled={!signature.trim() || !allRisksAccepted || !egfrChecked} style={{ width: '100%', padding: '10px', borderRadius: 6, border: 'none', cursor: signature.trim() && allRisksAccepted && egfrChecked ? 'pointer' : 'not-allowed', background: signature.trim() && allRisksAccepted && egfrChecked ? '#22c55e' : '#21262d', color: signature.trim() && allRisksAccepted && egfrChecked ? '#fff' : '#484f58', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <PenLine size={16} />确认签署
              </button>
            </div>
          ) : (
            <div style={{ background: '#161b22', border: '1px solid #22c55e', borderRadius: 8, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#22c55e', fontSize: 14, fontWeight: 600 }}>
                <CheckCircle size={18} />已签署
              </div>
              <div style={{ marginTop: 8, fontSize: 13, color: '#8b949e' }}>
                签署人: {data.patientSignature} | 签署日期: {data.patientSignedAt ? new Date(data.patientSignedAt).toLocaleString('zh-CN') : ''}
              </div>
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <button onClick={handlePrint} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #30363d', background: 'transparent', color: '#8b949e', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}><Download size={14} />下载PDF</button>
                <button onClick={togglePreview} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #30363d', background: 'transparent', color: '#8b949e', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}><FileText size={14} />查看正式版</button>
              </div>
            </div>
          )}
        </div>

        {showPreview && (
          <div style={{ background: '#fff', color: '#333', borderRadius: 8, overflow: 'hidden', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: 8, background: '#f0f0f0', borderBottom: '1px solid #ddd', fontSize: 12, color: '#666', textAlign: 'center' }}>预览</div>
            <div style={{ padding: 20 }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(generateInformedConsentHtml({ ...data, patientSignature: signature || '（待签名）', patientSignedAt: signed ? data.patientSignedAt : undefined })) }} />
          </div>
        )}
      </div>
    </div>
  )
}
