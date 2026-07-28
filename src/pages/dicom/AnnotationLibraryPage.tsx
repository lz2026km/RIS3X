// ============================================================
// G005 放射RIS系统 v3.0.6.5 - 标注库页面
// Phase R11 W4: 全屏标注库管理 / 模板浏览 / 共享升级
// 20 升级点:左侧分类 / 右侧详情 / 统计 / 操作
// ============================================================

import React, { useEffect, useMemo, useState } from 'react';
import { Library, BarChart3, ChevronRight, Edit3, Trash2, Save, Shield, Tag, Ruler, PenTool, Square, type LucideIcon } from 'lucide-react';
import type { AnnotationTemplate } from '../../types/measurement';
import AnnotationLibrary from '../../services/measurement/library/AnnotationLibrary';

const CATEGORY_LABEL: Record<AnnotationTemplate['category'], string> = {
  finding: '影像所见',
  measurement: '测量',
  roi: 'ROI',
  label: '标签',
  arrow: '箭头',
};

const CATEGORY_ICON: Record<AnnotationTemplate['category'], LucideIcon> = {
  finding: PenTool,
  measurement: Ruler,
  roi: Square,
  label: Tag,
  arrow: ChevronRight,
};

const SCOPE_LABEL: Record<AnnotationTemplate['sharedScope'], string> = {
  private: '个人',
  department: '科室',
  institution: '全院',
  public: '公开',
};

const SCOPE_COLOR: Record<AnnotationTemplate['sharedScope'], string> = {
  private: '#6b7280',
  department: '#0ea5e9',
  institution: '#7c3aed',
  public: '#10b981',
};

const SHAPE_LABEL: Record<NonNullable<AnnotationTemplate['shape']>, string> = {
  arrow: '箭头',
  rectangle: '矩形',
  ellipse: '椭圆',
  text: '文字',
  freehand: '自由手绘',
};

export default function AnnotationLibraryPage() {
  const [items, setItems] = useState<AnnotationTemplate[]>([]);
  const [activeCat, setActiveCat] = useState<AnnotationTemplate['category'] | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    setBusy(true);
    try {
      const list = await AnnotationLibrary.list({
        category: activeCat === 'all' ? undefined : activeCat,
      });
      setItems(list);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCat]);

  const selected = useMemo(() => items.find((i) => i.id === selectedId) ?? items[0], [items, selectedId]);

  const categoryDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    items.forEach(item => { dist[item.category] = (dist[item.category] || 0) + 1; });
    return dist;
  }, [items]);

  const scopeDistribution = useMemo(() => {
    const dist: Record<string, number> = { private: 0, institution: 0, global: 0 };
    items.forEach(item => { dist[item.sharedScope] = (dist[item.sharedScope] || 0) + 1; });
    return dist;
  }, [items]);

  const removeTemplate = async (id: string) => {
    if (!confirm('确认删除该模板?')) return;
    await AnnotationLibrary.remove(id);
    if (selectedId === id) setSelectedId(null);
    await reload();
  };

  return (
    <div
      style={{
        background: '#f3f4f6',
        minHeight: '100vh',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <header
        style={{
          background: '#fff',
          borderRadius: 10,
          padding: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}
      >
        <Library size={22} color="#7c3aed" />
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>标注库</h2>
          <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>复用高质量标注模板,统一报告用语</p>
        </div>
        <div style={{ flex: 1 }} />
        <Stat label="总模板" value={items.length} Icon={Library} />
        <Stat label="分类" value={Object.values(categoryDistribution).reduce((a, b) => a + b, 0)} Icon={BarChart3} />
        <Stat label="全院共享" value={scopeDistribution.institution} Icon={Shield} />
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 320px', gap: 12, flex: 1, minHeight: 0 }}>
        <aside
          style={{
            background: '#fff',
            borderRadius: 10,
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          <CategoryButton active={activeCat === 'all'} label="全部分类" count={items.length} onClick={() => setActiveCat('all')} />
          {(Object.keys(CATEGORY_LABEL) as Array<AnnotationTemplate['category']>).map((c) => (
            <CategoryButton
              key={c}
              active={activeCat === c}
              label={CATEGORY_LABEL[c]}
              count={categoryDistribution[c] || 0}
              Icon={CATEGORY_ICON[c]}
              onClick={() => setActiveCat(c)}
            />
          ))}
        </aside>

        <main
          style={{
            background: '#fff',
            borderRadius: 10,
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            overflow: 'hidden',
          }}
        >
          {busy && <div style={{ fontSize: 12, color: '#6b7280' }}>加载中...</div>}
          {!busy && items.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
              该分类暂无模板
            </div>
          )}
          {items.map((t) => {
            const Icon = CATEGORY_ICON[t.category];
            const isSelected = selected?.id === t.id;
            return (
              <article
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: 10,
                  border: `1px solid ${isSelected ? '#7c3aed' : '#e5e7eb'}`,
                  background: isSelected ? '#f5f3ff' : '#fff',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    display: 'grid',
                    placeItems: 'center',
                    background: `${t.defaultColor}1f`,
                    color: t.defaultColor,
                  }}
                >
                  <Icon size={18} color={t.defaultColor} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <strong style={{ fontSize: 13, color: '#111827' }}>{t.name}</strong>
                    <span style={{ fontSize: 12, padding: '1px 6px', borderRadius: 999, color: SCOPE_COLOR[t.sharedScope], background: `${SCOPE_COLOR[t.sharedScope]}1f` }}>
                      {SCOPE_LABEL[t.sharedScope]}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{t.description}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                    使用 {t.usageCount} 次 · 关键词 {t.keywords.slice(0, 4).join(', ')}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void removeTemplate(t.id);
                  }}
                  title="删除"
                  aria-label="删除"
                  style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer' }}
                >
                  <Trash2 size={14} />
                </button>
              </article>
            );
          })}
        </main>

        <aside
          style={{
            background: '#fff',
            borderRadius: 10,
            padding: 14,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            minHeight: 0,
          }}
        >
          {selected ? (
            <>
              <header style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: `${selected.defaultColor}1f`,
                    color: selected.defaultColor,
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  {React.createElement(CATEGORY_ICON[selected.category], { size: 18, color: selected.defaultColor })}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{selected.name}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{CATEGORY_LABEL[selected.category]} · {selected.label}</div>
                </div>
                <button
                  onClick={() => setEditing((e) => !e)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#2563eb' }}
                  title={editing ? '保存' : '编辑'}
                  aria-label="编辑"
                >
                  {editing ? <Save size={16} /> : <Edit3 size={16} />}
                </button>
              </header>

              <section>
                <Label>描述</Label>
                {editing ? (
                  <textarea
                    defaultValue={selected.description}
                    rows={2}
                    style={inputStyle}
                    onBlur={(e) => void AnnotationLibrary.update(selected.id, { description: e.target.value })}
                  />
                ) : (
                  <p style={{ margin: 0, fontSize: 12, color: '#374151' }}>{selected.description}</p>
                )}
              </section>

              <section>
                <Label>默认文字</Label>
                {editing ? (
                  <input
                    defaultValue={selected.defaultText}
                    style={inputStyle}
                    onBlur={(e) => void AnnotationLibrary.update(selected.id, { defaultText: e.target.value })}
                  />
                ) : (
                  <code style={{ fontSize: 12, color: '#111827' }}>{selected.defaultText}</code>
                )}
              </section>

              <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <KV k="形状" v={selected.shape ? SHAPE_LABEL[selected.shape] : '—'} />
                <KV k="测量类型" v={selected.measurementType ?? '—'} />
                <KV k="解剖位置" v={selected.anatomy ?? '—'} />
                <KV k="使用次数" v={String(selected.usageCount)} />
                <KV k="共享范围" v={SCOPE_LABEL[selected.sharedScope]} valueColor={SCOPE_COLOR[selected.sharedScope]} />
                <KV k="创建者" v={selected.createdBy} />
              </section>

              <section>
                <Label>关键词</Label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {selected.keywords.map((k) => (
                    <span
                      key={k}
                      style={{ fontSize: 12, padding: '2px 6px', borderRadius: 4, background: '#eef2ff', color: '#3730a3' }}
                    >
                      {k}
                    </span>
                  ))}
                </div>
              </section>

              {editing && (
                <section>
                  <Label>共享范围升级</Label>
                  <select
                    value={selected.sharedScope}
                    onChange={(e) => void AnnotationLibrary.upgradeScope(selected.id, e.target.value as AnnotationTemplate['sharedScope']).then(reload)}
                    style={inputStyle}
                  >
                    {(Object.keys(SCOPE_LABEL) as Array<AnnotationTemplate['sharedScope']>).map((s) => (
                      <option key={s} value={s}>{SCOPE_LABEL[s]}</option>
                    ))}
                  </select>
                </section>
              )}
            </>
          ) : (
            <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>请选择左侧模板以查看详情</div>
          )}
        </aside>
      </div>
    </div>
  );
}

function CategoryButton({
  active,
  label,
  count,
  Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  Icon?: LucideIcon;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 10px',
        border: 'none',
        background: active ? '#eef2ff' : 'transparent',
        color: active ? '#3730a3' : '#374151',
        borderRadius: 6,
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        textAlign: 'left',
      }}
    >
      {Icon && <Icon size={14} color={active ? '#3730a3' : '#6b7280'} />}
      <span style={{ flex: 1 }}>{label}</span>
      <span style={{ fontSize: 12, color: active ? '#4338ca' : '#9ca3af' }}>{count}</span>
    </button>
  );
}

function Stat({ label, value, Icon }: { label: string; value: number | string; Icon: LucideIcon }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        background: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: 6,
      }}
    >
      <Icon size={14} color="#6b7280" />
      <div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{value}</div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase' }}>{children}</div>;
}

function KV({ k, v, valueColor }: { k: string; v: string; valueColor?: string }) {
  return (
    <div style={{ background: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: 6, padding: 6 }}>
      <div style={{ fontSize: 12, color: '#9ca3af' }}>{k}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: valueColor ?? '#111827' }}>{v}</div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontSize: 12,
  padding: '6px 8px',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  outline: 'none',
};
