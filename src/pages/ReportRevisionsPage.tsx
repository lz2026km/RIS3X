// ============================================================
// G005 放射科RIS系统 v1.0.3 - 报告修订链与版本对比
// Phase R3：修订链 / 版本对比 (Diff) / 补发 / 患者告知
// ============================================================

import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  History, GitCompare, ChevronRight, Plus, Edit2, Eye, X,
  FileText, Bell, ArrowLeftRight, RotateCcw, Search, Layers, GitBranch,
} from 'lucide-react';
import {
  REPORT_REVISIONS,
  REPORT_REVISIONS_044,
  type ReportRevision,
} from '../data/reviewRevisionCollabMock';
import { extendedReportMock } from '../data/reportSubsystemMock';

// ============================================================
// 修订动作配置
// ============================================================
const ACTION_CONFIG = {
  initial:  { label: '初次发布', color: '#3b82f6', bg: '#dbeafe', icon: FileText },
  revise:   { label: '修订',     color: '#f59e0b', bg: '#fef3c7', icon: Edit2 },
  addendum: { label: '补发',     color: '#7c3aed', bg: '#ede9fe', icon: Plus },
  recall:   { label: '撤回',     color: '#dc2626', bg: '#fee2e2', icon: RotateCcw },
};

// ============================================================
// 变更类型配置
// ============================================================
const CHANGE_CONFIG = {
  modified: { label: '修改', color: '#f59e0b', bg: '#fef3c7', icon: Edit2 },
  added:    { label: '新增', color: '#10b981', bg: '#d1fae5', icon: Plus },
  deleted:  { label: '删除', color: '#dc2626', bg: '#fee2e2', icon: X },
};

// ============================================================
// 简易 Diff 文本对比算法
// ============================================================
function diffText(before: string, after: string): { type: 'same' | 'removed' | 'added'; text: string }[] {
  if (!before && !after) return [];
  if (!before) return [{ type: 'added', text: after }];
  if (!after) return [{ type: 'removed', text: before }];
  if (before === after) return [{ type: 'same', text: before }];

  // 简单逐句对比
  const beforeSentences = before.split(/([。！？；\n])/).filter(s => s.trim());
  const afterSentences = after.split(/([。！？；\n])/).filter(s => s.trim());

  const result: { type: 'same' | 'removed' | 'added'; text: string }[] = [];
  const beforeSet = new Set(beforeSentences);
  const afterSet = new Set(afterSentences);

  for (const s of beforeSentences) {
    if (!afterSet.has(s)) {
      result.push({ type: 'removed', text: s });
    }
  }
  for (const s of afterSentences) {
    if (!beforeSet.has(s)) {
      result.push({ type: 'added', text: s });
    }
  }
  return result;
}

// ============================================================
// 主组件
// ============================================================
export default function ReportRevisionsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams(); // [W2-3] 支持 /report-revisions?reportId= 直达

  // 加载所有修订报告
  const allRevisions = useMemo(() => {
    const list: ReportRevision[] = [];
    for (const rev of [...REPORT_REVISIONS, ...REPORT_REVISIONS_044]) {
      list.push(rev);
    }
    return list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, []);

  // 分组按报告 ID
  const revisionsByReport = useMemo(() => {
    const map: Record<string, ReportRevision[]> = {};
    for (const r of allRevisions) {
      if (!map[r.reportId]) map[r.reportId] = [];
      map[r.reportId].push(r);
    }
    return map;
  }, [allRevisions]);

  // 报告 ID 列表
  const reportIds = Object.keys(revisionsByReport);

  // 选中报告 ([W2-3] 支持从报告列表带 ?reportId= 直达)
  const [selectedReportId, setSelectedReportId] = useState<string>(() => {
    const fromUrl = searchParams.get('reportId');
    if (fromUrl && revisionsByReport[fromUrl]) return fromUrl;
    return reportIds[0] || 'rpt-043';
  });
  const [leftVersion, setLeftVersion] = useState<number>(1);
  const [rightVersion, setRightVersion] = useState<number>(2);
  const [diffField, setDiffField] = useState<'findings' | 'diagnosis' | 'impression'>('impression');
  const [showDiff, setShowDiff] = useState(true);
  const [, setShowAddendumModal] = useState(false);
  const [search, setSearch] = useState('');

  // 当前选中的报告的修订链
  const currentRevisions = revisionsByReport[selectedReportId] || [];
  const report = extendedReportMock.find(r => r.id === selectedReportId);

  // 选中的左右版本
  const leftRev = currentRevisions.find(r => r.versionNumber === leftVersion);
  const rightRev = currentRevisions.find(r => r.versionNumber === rightVersion);

  return (
    <div style={{ padding: 20, maxWidth: 1600, margin: '0 auto' }}>
      {/* 顶部 */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <History size={20} color="#f59e0b" /> 报告修订与版本管理
            <span style={{ fontSize: 12, padding: '2px 6px', background: '#10b981', color: '#fff', borderRadius: 3, fontWeight: 700 }}>R3</span>
          </h1>
          <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
            修订链追溯 · 版本对比 (Diff) · 补发/勘误 · 患者告知
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowAddendumModal(true)}
            disabled={currentRevisions.length === 0}
            style={{
              padding: '6px 12px', border: 'none', borderRadius: 6,
              background: currentRevisions.length > 0 ? '#7c3aed' : '#cbd5e1',
              color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <Plus size={12} /> 创建修订/补发
          </button>
          <button
            onClick={() => navigate('/reports')}
            style={{
              padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: 6,
              background: '#fff', color: '#475569', fontSize: 12, cursor: 'pointer',
            }}
          >
            返回报告列表
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 12 }}>
        {/* 左：报告列表 */}
        <div style={{
          background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0',
          overflow: 'hidden', alignSelf: 'flex-start',
        }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Layers size={12} /> 修订报告 ({reportIds.length})
            </div>
            <div style={{ position: 'relative' }}>
              <Search size={11} style={{ position: 'absolute', left: 8, top: 8, color: '#94a3b8' }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="搜索报告 ID / 患者..."
                style={{
                  width: '100%', padding: '5px 8px 5px 26px',
                  border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12, outline: 'none',
                }}
              />
            </div>
          </div>
          <div style={{ maxHeight: 600, overflowY: 'auto' }}>
            {reportIds
              .filter(rid => !search || rid.includes(search) || report?.patientName.includes(search))
              .map(rid => {
              const revs = revisionsByReport[rid];
              const r = extendedReportMock.find(x => x.id === rid);
              const isSelected = rid === selectedReportId;
              return (
                  <div
                    key={rid}
                    onClick={() => {
                      setSelectedReportId(rid);
                      setLeftVersion(revs[0].versionNumber);
                      setRightVersion(revs[revs.length - 1].versionNumber);
                    }}
                    style={{
                      padding: 10, borderBottom: '1px solid #f1f5f9',
                      background: isSelected ? '#eff6ff' : 'transparent',
                      borderLeft: isSelected ? '3px solid #3b82f6' : '3px solid transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{r?.patientName || rid}</span>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>{r?.modality}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
                      {rid} · {revs.length} 个版本
                    </div>
                    <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      {revs.map(rev => {
                        const aConf = ACTION_CONFIG[rev.action];
                        return (
                          <span key={rev.id} style={{
                            fontSize: 12, padding: '1px 5px', borderRadius: 3,
                            background: aConf.bg, color: aConf.color, fontWeight: 600,
                          }}>{rev.versionLabel} {aConf.label}</span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            {reportIds.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
                暂无修订报告
              </div>
            )}
          </div>
        </div>

        {/* 右：详情 + 版本对比 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {currentRevisions.length > 0 ? (
            <>
              {/* 报告信息 */}
              {report && (
                <div style={{
                  background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e2e8f0',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
                        {report.patientName} · {report.modality} {report.bodyPart}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>报告 ID：{report.id}</div>
                    </div>
                    <div style={{ fontSize: 12, color: '#475569' }}>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>修订次数</span>
                      <span style={{ marginLeft: 6, fontSize: 18, fontWeight: 700, color: '#f59e0b' }}>{currentRevisions.length}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 修订链时间线 */}
              <div style={{
                background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e2e8f0',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <GitBranch size={14} /> 修订链时间线
                </div>
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
                  {currentRevisions.map((rev, idx) => {
                    const aConf = ACTION_CONFIG[rev.action];
                    const Icon = aConf.icon;
                    const isLeft = rev.versionNumber === leftVersion;
                    const isRight = rev.versionNumber === rightVersion;
                    return (
                      <React.Fragment key={rev.id}>
                        <div
                          onClick={() => {
                            if (isRight) setLeftVersion(rev.versionNumber);
                            else setRightVersion(rev.versionNumber);
                          }}
                          style={{
                            minWidth: 200, padding: 12,
                            background: (isLeft || isRight) ? '#eff6ff' : '#f8fafc',
                            border: `2px solid ${isLeft ? '#f59e0b' : isRight ? '#10b981' : '#e2e8f0'}`,
                            borderRadius: 8, cursor: 'pointer',
                            position: 'relative',
                          }}
                        >
                          {isLeft && <span style={{ position: 'absolute', top: -8, left: 8, fontSize: 12, padding: '1px 5px', background: '#f59e0b', color: '#fff', borderRadius: 3, fontWeight: 700 }}>左侧</span>}
                          {isRight && <span style={{ position: 'absolute', top: -8, right: 8, fontSize: 12, padding: '1px 5px', background: '#10b981', color: '#fff', borderRadius: 3, fontWeight: 700 }}>右侧</span>}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                            <Icon size={12} color={aConf.color} />
                            <strong style={{ fontSize: 12, color: aConf.color }}>{rev.versionLabel}</strong>
                            <span style={{ fontSize: 12, color: '#94a3b8' }}>{aConf.label}</span>
                          </div>
                          <div style={{ fontSize: 12, color: '#475569', marginBottom: 4, fontWeight: 600 }}>
                            {rev.authorTitle} {rev.authorName}
                          </div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>{rev.createdAt}</div>
                          {rev.publishedAt && (
                            <div style={{ fontSize: 12, color: '#10b981', marginTop: 4 }}>✓ 已发布 {rev.publishedAt}</div>
                          )}
                          {rev.patientNotified && (
                            <div style={{ fontSize: 12, color: '#3b82f6', marginTop: 2 }}>🔔 已通知患者</div>
                          )}
                          <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4, fontStyle: 'italic' }}>{rev.reason}</div>
                        </div>
                        {idx < currentRevisions.length - 1 && (
                          <div style={{ display: 'flex', alignItems: 'center', color: '#cbd5e1' }}>
                            <ChevronRight size={20} />
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* 对比控制栏 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8, borderTop: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: 12, color: '#64748b' }}>对比：</span>
                  <select value={leftVersion} onChange={e => setLeftVersion(Number(e.target.value))} style={selectStyle}>
                    {currentRevisions.map(r => <option key={r.id} value={r.versionNumber}>{r.versionLabel} {ACTION_CONFIG[r.action].label}</option>)}
                  </select>
                  <ArrowLeftRight size={14} color="#64748b" />
                  <select value={rightVersion} onChange={e => setRightVersion(Number(e.target.value))} style={selectStyle}>
                    {currentRevisions.map(r => <option key={r.id} value={r.versionNumber}>{r.versionLabel} {ACTION_CONFIG[r.action].label}</option>)}
                  </select>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>字段：</span>
                  <select value={diffField} onChange={e => setDiffField(e.target.value as any)} style={selectStyle}>
                    <option value="findings">检查所见</option>
                    <option value="diagnosis">诊断</option>
                    <option value="impression">意见</option>
                  </select>
                  <button
                    onClick={() => setShowDiff(!showDiff)}
                    style={{
                      padding: '4px 10px', border: '1px solid #cbd5e1', borderRadius: 4,
                      background: showDiff ? '#dbeafe' : '#fff',
                      color: showDiff ? '#1e40af' : '#475569',
                      fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <GitCompare size={11} /> {showDiff ? '隐藏' : '显示'} Diff
                  </button>
                </div>
              </div>

              {/* Diff 对比视图 */}
              {showDiff && leftRev && rightRev && (
                <div style={{
                  background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e2e8f0',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ flex: 1, padding: 8, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 4 }}>
                      <div style={{ fontSize: 12, color: '#9a3412', fontWeight: 600 }}>左侧：{leftRev.versionLabel} {ACTION_CONFIG[leftRev.action].label}</div>
                      <div style={{ fontSize: 12, color: '#7c2d12' }}>{leftRev.authorName} · {leftRev.createdAt}</div>
                    </div>
                    <ArrowLeftRight size={16} color="#64748b" />
                    <div style={{ flex: 1, padding: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 4 }}>
                      <div style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>右侧：{rightRev.versionLabel} {ACTION_CONFIG[rightRev.action].label}</div>
                      <div style={{ fontSize: 12, color: '#166534' }}>{rightRev.authorName} · {rightRev.createdAt}</div>
                    </div>
                  </div>

                  {/* Diff 内容 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <DiffPanel
                      title="变更前"
                      text={leftRev[diffField] || ''}
                      variant="before"
                    />
                    <DiffPanel
                      title="变更后"
                      text={rightRev[diffField] || ''}
                      variant="after"
                    />
                  </div>

                  {/* 合并视图 */}
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, color: '#475569', fontWeight: 600, marginBottom: 6 }}>合并视图（红=删除 绿=新增 黑=相同）</div>
                    <div style={{
                      padding: 12, background: '#f8fafc', borderRadius: 6,
                      border: '1px solid #e2e8f0', fontSize: 12, lineHeight: 1.8,
                    }}>
                      {diffText(leftRev[diffField] || '', rightRev[diffField] || '').map((seg, i) => (
                        <span
                          key={i}
                          style={{
                            background: seg.type === 'removed' ? '#fee2e2' : seg.type === 'added' ? '#d1fae5' : 'transparent',
                            color: seg.type === 'removed' ? '#b91c1c' : seg.type === 'added' ? '#047857' : '#1e293b',
                            textDecoration: seg.type === 'removed' ? 'line-through' : 'none',
                            padding: '0 2px',
                          }}
                        >
                          {seg.text}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 修订变更列表 */}
                  {rightRev.changes && rightRev.changes.length > 0 && (
                    <div style={{ marginTop: 12, padding: 10, background: '#fef3c7', borderRadius: 6, border: '1px solid #fcd34d' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>
                        📝 修订变更列表（{rightRev.changes.length} 项）
                      </div>
                      {rightRev.changes.map((change, i) => {
                        const cConf = CHANGE_CONFIG[change.changeType];
                        const CIcon = cConf.icon;
                        const fieldLabel = { findings: '检查所见', diagnosis: '诊断', impression: '意见', recommendation: '建议', critical: '危急值' }[change.field] || change.field;
                        return (
                          <div key={i} style={{ marginBottom: 8, padding: 8, background: '#fff', borderRadius: 4, fontSize: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                              <span style={{
                                fontSize: 12, padding: '1px 5px', borderRadius: 2,
                                background: cConf.bg, color: cConf.color, fontWeight: 700,
                                display: 'flex', alignItems: 'center', gap: 2,
                              }}>
                                <CIcon size={9} /> {cConf.label}
                              </span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{fieldLabel}</span>
                            </div>
                            {change.before && (
                              <div style={{ padding: 4, background: '#fee2e2', color: '#7f1d1d', textDecoration: 'line-through', borderRadius: 3, marginBottom: 2 }}>
                                − {change.before}
                              </div>
                            )}
                            {change.after && (
                              <div style={{ padding: 4, background: '#d1fae5', color: '#065f46', borderRadius: 3 }}>
                                + {change.after}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 操作按钮 */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  style={{
                    padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: 4,
                    background: '#fff', color: '#475569', fontSize: 12, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <Eye size={11} /> 预览终版
                </button>
                <button
                  style={{
                    padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: 4,
                    background: '#fff', color: '#475569', fontSize: 12, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <Bell size={11} /> 通知患者
                </button>
                <button
                  style={{
                    padding: '6px 12px', border: '1px solid #dc2626', borderRadius: 4,
                    background: '#fff', color: '#dc2626', fontSize: 12, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <RotateCcw size={11} /> 撤回报告
                </button>
              </div>
            </>
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', background: '#fff', borderRadius: 8 }}>
              请从左侧选择有修订的报告
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 样式
// ============================================================
const selectStyle: React.CSSProperties = {
  padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: 4,
  fontSize: 12, outline: 'none', minWidth: 100,
};

// ============================================================
// Diff 面板
// ============================================================
const DiffPanel: React.FC<{ title: string; text: string; variant: 'before' | 'after' }> = ({ title, text, variant }) => {
  const isBefore = variant === 'before';
  return (
    <div style={{
      background: isBefore ? '#fff7ed' : '#f0fdf4',
      border: `1px solid ${isBefore ? '#fed7aa' : '#bbf7d0'}`,
      borderRadius: 6, padding: 10,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: isBefore ? '#9a3412' : '#15803d', marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.7, color: isBefore ? '#7c2d12' : '#166534', whiteSpace: 'pre-wrap' }}>
        {text || <em style={{ color: '#94a3b8' }}>（空）</em>}
      </div>
    </div>
  );
};
