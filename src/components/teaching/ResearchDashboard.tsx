import React, { useState, useCallback } from 'react'

export interface CohortFilter {
  modality?: string[]
  bodyPart?: string[]
  dateRange?: { start: string; end: string }
  ageRange?: { min: number; max: number }
  gender?: string
  diagnosis?: string
  biRads?: string
  lungRads?: string
}

export interface ResearchQuery {
  id: string
  name: string
  filter: CohortFilter
  resultCount: number
  lastRun: string
}

export interface ResearchDashboardProps {
  onQuery?: (filter: CohortFilter) => void
  onExport?: (format: 'csv' | 'json' | 'dicom') => void
}

const MODALITIES = ['CT', 'MR', 'DR', 'MG', 'US', 'PET-CT', 'DSA']
const BODY_PARTS = ['HEAD', 'CHEST', 'ABDOMEN', 'PELVIS', 'SPINE', 'EXTREMITY', 'BREAST']
const BI_RADS = ['0', '1', '2', '3', '4A', '4B', '4C', '5', '6']
const LUNG_RADS = ['0', '1', '2', '3', '4A', '4B', '4X']

export const ResearchDashboard: React.FC<ResearchDashboardProps> = ({
  onQuery,
  onExport,
}) => {
  const [filter, setFilter] = useState<CohortFilter>({})
  const [queryName, setQueryName] = useState('')
  const [results, setResults] = useState<ResearchQuery[]>([])
  const [isRunning, setIsRunning] = useState(false)

  const updateFilter = useCallback(<K extends keyof CohortFilter>(key: K, value: CohortFilter[K]) => {
    setFilter(prev => ({ ...prev, [key]: value }))
  }, [])

  const runQuery = useCallback(async () => {
    setIsRunning(true)
    await new Promise(r => setTimeout(r, 800))
    const newQuery: ResearchQuery = {
      id: `q-${Date.now().toString(36)}`,
      name: queryName || `Query ${results.length + 1}`,
      filter,
      resultCount: Math.floor(Math.random() * 100) + 5,
      lastRun: new Date().toISOString(),
    }
    setResults(prev => [newQuery, ...prev])
    setIsRunning(false)
    onQuery?.(filter)
  }, [filter, queryName, results.length, onQuery])

  const deleteQuery = useCallback((id: string) => {
    setResults(prev => prev.filter(q => q.id !== id))
  }, [])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 12, fontSize: 12, color: '#cbd5e1' }}>
      <div style={{ background: '#1a1a1a', borderRadius: 8, padding: 12 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: '#fbbf24' }}>队列筛选</h3>

        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'block', marginBottom: 4, color: '#94a3b8' }}>Query Name</label>
          <input value={queryName} onChange={e => setQueryName(e.target.value)} placeholder="e.g., Lung cancer screening" style={{ width: '100%', background: '#0a0a0a', border: '1px solid #333', borderRadius: 4, padding: '4px 8px', color: '#cbd5e1' }} />
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'block', marginBottom: 4, color: '#94a3b8' }}>Modality</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {MODALITIES.map(m => (
              <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer', fontSize: 12 }}>
                <input type="checkbox" checked={filter.modality?.includes(m) ?? false} onChange={e => {
                  const current = filter.modality ?? []
                  updateFilter('modality', e.target.checked ? [...current, m] : current.filter(x => x !== m))
                }} />
                {m}
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'block', marginBottom: 4, color: '#94a3b8' }}>Body Part</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {BODY_PARTS.map(bp => (
              <label key={bp} style={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer', fontSize: 12 }}>
                <input type="checkbox" checked={filter.bodyPart?.includes(bp) ?? false} onChange={e => {
                  const current = filter.bodyPart ?? []
                  updateFilter('bodyPart', e.target.checked ? [...current, bp] : current.filter(x => x !== bp))
                }} />
                {bp}
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'block', marginBottom: 4, color: '#94a3b8' }}>Date Range</label>
          <div style={{ display: 'flex', gap: 4 }}>
            <input type="date" value={filter.dateRange?.start ?? ''} onChange={e => updateFilter('dateRange', { start: e.target.value, end: filter.dateRange?.end ?? '' })} style={{ flex: 1, background: '#0a0a0a', border: '1px solid #333', borderRadius: 4, padding: '4px', color: '#cbd5e1', fontSize: 12 }} />
            <input type="date" value={filter.dateRange?.end ?? ''} onChange={e => updateFilter('dateRange', { start: filter.dateRange?.start ?? '', end: e.target.value })} style={{ flex: 1, background: '#0a0a0a', border: '1px solid #333', borderRadius: 4, padding: '4px', color: '#cbd5e1', fontSize: 12 }} />
          </div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'block', marginBottom: 4, color: '#94a3b8' }}>BI-RADS</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {BI_RADS.map(r => (
              <button
                key={r}
                onClick={() => updateFilter('biRads', filter.biRads === r ? undefined : r)}
                style={{
                  background: filter.biRads === r ? '#1e40af' : '#0a0a0a',
                  border: '1px solid', borderColor: filter.biRads === r ? '#3b82f6' : '#333',
                  borderRadius: 4, padding: '2px 6px', color: '#cbd5e1', fontSize: 12, cursor: 'pointer',
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'block', marginBottom: 4, color: '#94a3b8' }}>Lung-RADS</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {LUNG_RADS.map(r => (
              <button
                key={r}
                onClick={() => updateFilter('lungRads', filter.lungRads === r ? undefined : r)}
                style={{
                  background: filter.lungRads === r ? '#1e40af' : '#0a0a0a',
                  border: '1px solid', borderColor: filter.lungRads === r ? '#3b82f6' : '#333',
                  borderRadius: 4, padding: '2px 6px', color: '#cbd5e1', fontSize: 12, cursor: 'pointer',
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={runQuery}
          disabled={isRunning}
          style={{
            width: '100%', background: isRunning ? '#333' : '#059669',
            border: 'none', borderRadius: 4, padding: '8px', color: '#fff',
            fontSize: 12, cursor: 'pointer', marginTop: 8,
          }}
        >
          {isRunning ? 'Running...' : 'Run Query'}
        </button>
      </div>

      <div style={{ background: '#1a1a1a', borderRadius: 8, padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#fbbf24' }}>Query Results ({results.length})</h3>
          {results.length > 0 && (
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => onExport?.('csv')} style={{ background: '#1e40af', border: 'none', borderRadius: 4, padding: '4px 10px', color: '#fff', fontSize: 12, cursor: 'pointer' }}>CSV</button>
              <button onClick={() => onExport?.('json')} style={{ background: '#7c3aed', border: 'none', borderRadius: 4, padding: '4px 10px', color: '#fff', fontSize: 12, cursor: 'pointer' }}>JSON</button>
              <button onClick={() => onExport?.('dicom')} style={{ background: '#0891b2', border: 'none', borderRadius: 4, padding: '4px 10px', color: '#fff', fontSize: 12, cursor: 'pointer' }}>DICOM</button>
            </div>
          )}
        </div>

        {results.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>
            <div>Configure filters and run a query to get started</div>
          </div>
        ) : (
          results.map(q => (
            <div key={q.id} style={{ background: '#0a0a0a', borderRadius: 4, padding: 8, marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{q.name}</span>
                  <span style={{ color: '#64748b', fontSize: 12, marginLeft: 8 }}>
                    {q.resultCount} results | {new Date(q.lastRun).toLocaleString()}
                  </span>
                </div>
                <button onClick={() => deleteQuery(q.id)} style={{ background: 'transparent', border: '1px solid #ef4444', borderRadius: 4, padding: '1px 6px', color: '#ef4444', fontSize: 12, cursor: 'pointer' }}>×</button>
              </div>
              {q.filter.modality && <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Modalities: {q.filter.modality.join(', ')}</div>}
              {q.filter.biRads && <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 2 }}>BI-RADS: {q.filter.biRads}</div>}
              {q.filter.lungRads && <div style={{ fontSize: 12, color: '#10b981', marginTop: 2 }}>Lung-RADS: {q.filter.lungRads}</div>}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default ResearchDashboard
