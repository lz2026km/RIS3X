import React, { useState, useCallback } from 'react'

export interface TeachingCase {
  id: string
  title: string
  modality: string
  bodyPart: string
  diagnosis: string
  findings: string
  keyImages: string[]
  annotations: TeachingAnnotation[]
  references: string[]
  createdAt: string
  author: string
  anonymized: boolean
}

export interface TeachingAnnotation {
  id: string
  imageIndex: number
  label: string
  description: string
  type: 'arrow' | 'circle' | 'text' | 'freehand'
}

export interface TeachingFileBuilderProps {
  seriesId?: string
  studyId?: string
  imageIds?: string[]
  onSave?: (caseData: TeachingCase) => void
  onExport?: (format: 'pdf' | 'pptx' | 'dicom' | 'html') => void
}

export const TeachingFileBuilder: React.FC<TeachingFileBuilderProps> = ({
  seriesId,
  studyId,
  imageIds = [],
  onSave,
  onExport,
}) => {
  const [title, setTitle] = useState('')
  const [modality, setModality] = useState('CT')
  const [bodyPart, setBodyPart] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [findings, setFindings] = useState('')
  const [annotations, setAnnotations] = useState<TeachingAnnotation[]>([])
  const [references, setReferences] = useState<string[]>([])
  const [refInput, setRefInput] = useState('')
  const [anonymize, setAnonymize] = useState(true)
  const [saving, setSaving] = useState(false)

  const addAnnotation = useCallback(() => {
    const newAnnotation: TeachingAnnotation = {
      id: `ann-${Date.now()}`,
      imageIndex: 0,
      label: `Label ${annotations.length + 1}`,
      description: '',
      type: 'arrow',
    }
    setAnnotations(prev => [...prev, newAnnotation])
  }, [annotations])

  const removeAnnotation = useCallback((id: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== id))
  }, [])

  const addReference = useCallback(() => {
    if (refInput.trim()) {
      setReferences(prev => [...prev, refInput.trim()])
      setRefInput('')
    }
  }, [refInput])

  const handleSave = useCallback(async () => {
    setSaving(true)
    await new Promise(r => setTimeout(r, 300))
    const caseData: TeachingCase = {
      id: `tc-${Date.now().toString(36)}`,
      title,
      modality,
      bodyPart,
      diagnosis,
      findings,
      keyImages: imageIds,
      annotations,
      references,
      createdAt: new Date().toISOString(),
      author: 'current_user',
      anonymized: anonymize,
    }
    setSaving(false)
    onSave?.(caseData)
  }, [title, modality, bodyPart, diagnosis, findings, imageIds, annotations, references, anonymize, onSave])

  return (
    <div style={{ background: '#1a1a1a', borderRadius: 8, padding: 12, color: '#cbd5e1', fontSize: 12 }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: '#fbbf24' }}>Teaching File Builder</h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 4, color: '#94a3b8' }}>Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} style={{ width: '100%', background: '#0a0a0a', border: '1px solid #333', borderRadius: 4, padding: '4px 8px', color: '#cbd5e1' }} />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 4, color: '#94a3b8' }}>Modality</label>
          <input value={modality} onChange={e => setModality(e.target.value)} style={{ width: '100%', background: '#0a0a0a', border: '1px solid #333', borderRadius: 4, padding: '4px 8px', color: '#cbd5e1' }} />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 4, color: '#94a3b8' }}>Body Part</label>
          <input value={bodyPart} onChange={e => setBodyPart(e.target.value)} style={{ width: '100%', background: '#0a0a0a', border: '1px solid #333', borderRadius: 4, padding: '4px 8px', color: '#cbd5e1' }} />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 4, color: '#94a3b8' }}>Diagnosis</label>
          <input value={diagnosis} onChange={e => setDiagnosis(e.target.value)} style={{ width: '100%', background: '#0a0a0a', border: '1px solid #333', borderRadius: 4, padding: '4px 8px', color: '#cbd5e1' }} />
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        <label style={{ display: 'block', marginBottom: 4, color: '#94a3b8' }}>Findings</label>
        <textarea value={findings} onChange={e => setFindings(e.target.value)} rows={4} style={{ width: '100%', background: '#0a0a0a', border: '1px solid #333', borderRadius: 4, padding: '4px 8px', color: '#cbd5e1', resize: 'vertical' }} />
      </div>

      <div style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ color: '#94a3b8' }}>Annotations ({annotations.length})</span>
          <button onClick={addAnnotation} style={{ background: '#1e40af', border: 'none', borderRadius: 4, padding: '2px 8px', color: '#fff', fontSize: 12, cursor: 'pointer' }}>+ 添加</button>
        </div>
        {annotations.map(a => (
          <div key={a.id} style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4, background: '#0a0a0a', padding: '4px 8px', borderRadius: 4 }}>
            <span style={{ flex: 1 }}>{a.label}</span>
            <button onClick={() => removeAnnotation(a.id)} style={{ background: 'transparent', border: '1px solid #ef4444', borderRadius: 4, padding: '1px 6px', color: '#ef4444', fontSize: 12, cursor: 'pointer' }}>×</button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 8 }}>
        <label style={{ display: 'block', marginBottom: 4, color: '#94a3b8' }}>References</label>
        <div style={{ display: 'flex', gap: 4 }}>
          <input value={refInput} onChange={e => setRefInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addReference()} placeholder="Add reference..." style={{ flex: 1, background: '#0a0a0a', border: '1px solid #333', borderRadius: 4, padding: '4px 8px', color: '#cbd5e1' }} />
          <button onClick={addReference} style={{ background: '#1e40af', border: 'none', borderRadius: 4, padding: '4px 12px', color: '#fff', fontSize: 12, cursor: 'pointer' }}>添加</button>
        </div>
        {references.map((r, i) => (
          <div key={i} style={{ marginTop: 4, fontSize: 12, color: '#64748b' }}>{i + 1}. {r}</div>
        ))}
      </div>

      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <input type="checkbox" checked={anonymize} onChange={e => setAnonymize(e.target.checked)} />
          Anonymize PHI
        </label>
        <div style={{ flex: 1 }} />
        <button onClick={handleSave} disabled={saving} style={{ background: '#059669', border: 'none', borderRadius: 4, padding: '6px 16px', color: '#fff', fontSize: 12, cursor: 'pointer' }}>
          {saving ? 'Saving...' : 'Save Case'}
        </button>
        <button onClick={() => onExport?.('pdf')} style={{ background: '#1e40af', border: 'none', borderRadius: 4, padding: '6px 12px', color: '#fff', fontSize: 12, cursor: 'pointer' }}>导出 PDF</button>
        <button onClick={() => onExport?.('pptx')} style={{ background: '#7c3aed', border: 'none', borderRadius: 4, padding: '6px 12px', color: '#fff', fontSize: 12, cursor: 'pointer' }}>导出 PPT</button>
      </div>
    </div>
  )
}

export default TeachingFileBuilder
