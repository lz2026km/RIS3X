import { useState } from 'react';
import { searchClient } from '../services/search';
import { datareportApi, type EnterpriseSearchResult } from '../services/api/datareportApi';

export default function EnterpriseSearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>(null);
  const [apiResults, setApiResults] = useState<EnterpriseSearchResult[]>([]);

  const handleSearch = async () => {
    const res = await searchClient.search(query);
    setResults(res);
    const apiRes = await datareportApi.enterpriseSearch(query);
    if (apiRes.success) setApiResults(apiRes.data);
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, color: '#1e293b', margin: 0 }}>🔍 企业级全局搜索</h1>
        <p style={{ fontSize: 13, color: '#64748b', margin: '6px 0 0' }}>
          跨患者、检查、报告、影像、AI 模型、设备统一检索 · 毫秒级响应
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="输入关键词，例如：患者姓名/检查ID/诊断结论/影像UID/设备编号..."
          style={{ flex: 1, padding: '10px 14px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14 }}
        />
        <button onClick={handleSearch} style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>搜索</button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: '#64748b' }}>推荐：</span>
        {['胸部 CT', '王建国', '阳性报告', 'CT-1', 'P001', '2026-06'].map(q => (
          <button key={q} onClick={() => { setQuery(q); }} style={{ padding: '4px 10px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 14, fontSize: 12, color: '#475569', cursor: 'pointer' }}>{q}</button>
        ))}
      </div>

      {!results && (
        <div style={{ padding: 32, background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1', textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: '#64748b', marginBottom: 12 }}>📊 索引范围</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, maxWidth: 720, margin: '0 auto' }}>
            {[
              { label: '患者档案', count: '128K+' },
              { label: '检查记录', count: '450K+' },
              { label: '报告文档', count: '380K+' },
              { label: '影像实例', count: '2.1M+' },
              { label: 'AI 模型', count: '156' },
              { label: '设备台账', count: '89' },
              { label: '危急值事件', count: '1.2K' },
              { label: '质控记录', count: '24K' },
            ].map(it => (
              <div key={it.label} style={{ padding: 12, background: '#fff', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#1e40af' }}>{it.count}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{it.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {results && (
        <div style={{ marginTop: 16 }}>
          <div style={{ padding: '8px 12px', background: '#eff6ff', borderRadius: 6, marginBottom: 12, fontSize: 13, color: '#1e40af' }}>
            ✅ 命中 <strong>{results.total}</strong> 条结果 · 耗时 {results.tookMs}ms
          </div>
          {results.results?.map((r: any) => (
            <div key={r.id} style={{ padding: 12, marginTop: 8, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6 }}>
              <strong style={{ color: '#1e293b' }}>{r.title}</strong>
              <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>{r.description}</div>
              <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>Score: {r.score?.toFixed(1)} | Type: {r.type}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
