// [v3.0.6.8-55] 全景片标注工具 (Canvas)
import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Space, Tag, Button, Row, Col, Select, message } from 'antd';
import { Ruler, Square, Circle, Type, Trash2, Save } from 'lucide-react';
import { t } from '../../i18n/appI18n';

type Tool = 'ruler' | 'rect' | 'circle' | 'text';
interface Annotation { id: string; tool: Tool; x: number; y: number; w: number; h: number; text?: string; color: string; label?: string; value?: string; }

const COLORS = ['#ff4d4f', 'var(--color-primary-600)', '#52c41a', '#faad14', '#722ed1', '#13c2c2'];

export const PanoramicAnnotatorPage: React.FC = () => {
  const [search] = useSearchParams();
  const studyId = search.get('studyId') || '';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeTool, setActiveTool] = useState<Tool>('ruler');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [colorIdx, _setColorIdx] = useState(0);
  const [label, setLabel] = useState('');

  // [W2-C] 标注保存到本地 (localStorage, 按 studyId 隔离)
  const storageKey = `panoramic-annotations:${studyId || 'default'}`;
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setAnnotations(JSON.parse(raw));
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyId]);

  const handleSaveAnnotations = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(annotations));
      message.success(t('w9d.panoramic.savedLocal', { count: annotations.length }));
    } catch {
      message.error(t('w9d.panoramic.saveFailed'));
    }
  };

  // Draw canvas with annotations
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Background (simulated panoramic)
    const gradient = ctx.createLinearGradient(0,0,canvas.width,canvas.height);
    gradient.addColorStop(0, '#2a2a3e');
    gradient.addColorStop(0.5, '#3a3a4e');
    gradient.addColorStop(1, '#2a2a3e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Draw dental arch outline
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(50, 200);
    ctx.quadraticCurveTo(200, 50, 350, 200);
    ctx.quadraticCurveTo(500, 50, 650, 200);
    ctx.quadraticCurveTo(750, 350, 650, 500);
    ctx.quadraticCurveTo(500, 450, 350, 500);
    ctx.quadraticCurveTo(200, 450, 50, 500);
    ctx.quadraticCurveTo(-50, 350, 50, 200);
    ctx.stroke();

    // Draw annotations
    for (const a of annotations) {
      ctx.strokeStyle = a.color;
      ctx.lineWidth = 2;
      ctx.fillStyle = a.color + '20';
      if (a.tool === 'ruler') {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(a.x + a.w, a.y + a.h);
        ctx.stroke();
        ctx.fillStyle = a.color;
        ctx.font = '12px sans-serif';
        ctx.fillText(Math.round(Math.sqrt(a.w*a.w + a.h*a.h)) + 'mm', a.x + a.w/2 - 15, a.y + a.h/2 - 5);
      } else if (a.tool === 'rect') {
        ctx.fillRect(a.x, a.y, a.w, a.h);
        ctx.strokeRect(a.x, a.y, a.w, a.h);
      } else if (a.tool === 'circle') {
        ctx.beginPath(); ctx.arc(a.x, a.y, Math.max(a.w, a.h), 0, Math.PI*2); ctx.fill(); ctx.stroke();
      } else if (a.tool === 'text') {
        ctx.fillStyle = a.color; ctx.font = '14px sans-serif'; ctx.fillText(a.text || (a.label ? t(a.label) : ''), a.x, a.y);
      }
      if (a.label) {
        ctx.fillStyle = a.color; ctx.font = '10px sans-serif'; ctx.fillText(t(a.label), a.x, a.y-8);
      }
    }
  }, [annotations]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    setStartPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setIsDrawing(true);
  };
  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const endX = e.clientX - rect.left, endY = e.clientY - rect.top;
    const a: Annotation = { id: `ann-${Date.now()}`, tool: activeTool, x: Math.min(startPos.x, endX), y: Math.min(startPos.y, endY), w: Math.abs(endX - startPos.x), h: Math.abs(endY - startPos.y), color: COLORS[colorIdx % COLORS.length] ?? '#000', label };
    if (activeTool === 'text') { a.text = label || t('w9d.panoramic.defaultAnnotation'); a.w = 0; a.h = 0; }
    setAnnotations([...annotations, a]);
    setIsDrawing(false);
  };

  return (
    <div style={{ padding: 24, background: 'var(--bg-card)',}}>
      <Space style={{ marginBottom: 16 }}>
        <Ruler size={20} color="var(--color-primary-600)" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('w9d.panoramic.title')}</span>
        <Tag color="cyan">v3.0.6.8-55</Tag>
        <Tag color="blue">{studyId || t('w9d.panoramic.noStudy')}</Tag>
      </Space>
      <Row gutter={16}>
        <Col span={18}>
          <Card size="small" title={
            <Space>
              {(['ruler','rect','circle','text'] as Tool[]).map(tool => (
                <Button key={tool} type={activeTool === tool ? 'primary' : 'default'} size="small"
                  icon={tool === 'ruler' ? <Ruler size={12} /> : tool === 'rect' ? <Square size={12} /> : tool === 'circle' ? <Circle size={12} /> : <Type size={12} />}
                  onClick={() => setActiveTool(tool)}>{tool === 'ruler' ? t('w9d.panoramic.toolRuler') : tool === 'rect' ? t('w9d.panoramic.toolRect') : tool === 'circle' ? t('w9d.panoramic.toolCircle') : t('w9d.panoramic.toolText')}</Button>
              ))}
            </Space>
          } extra={
            <Space>
              <Select size="small" value={label || undefined} onChange={setLabel} allowClear style={{ width: 100 }} options={['w9d.panoramicAnno.caries','w9d.panoramicAnno.periapical','w9d.panoramicAnno.boneLoss','w9d.panoramicAnno.implantSite','w9d.panoramicAnno.impacted'].map(k=>({value:k,label:t(k)}))} />
              <Button size="small" icon={<Save size={12} />} onClick={handleSaveAnnotations}>{t('w9d.panoramic.saveAnnotations')}</Button>
              <Button size="small" icon={<Trash2 size={12} />} onClick={() => setAnnotations([])}>{t('w9d.panoramic.clear')}</Button>
            </Space>
          }>
            <canvas ref={canvasRef} width={700} height={550} style={{ width: '100%', height: 'auto', cursor: 'crosshair', border: '1px solid #333', borderRadius: 4 }}
              onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} />
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{t('w9d.panoramic.hint')}{annotations.length}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card title={t('w9d.panoramic.annotationList')} size="small">
            {annotations.map((a, i) => <div key={a.id} style={{ padding: 8, marginBottom: 4, background: 'var(--bg-card)', borderRadius: 4, borderLeft: `3px solid ${a.color}` }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{a.tool} - {a.label ? t(a.label) : '-'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{a.tool === 'ruler' ? Math.round(Math.sqrt(a.w*a.w + a.h*a.h)) + 'mm' : `${a.w}×${a.h}`}</div>
              <Button type="text" size="small" danger icon={<Trash2 size={10} />} onClick={() => setAnnotations(annotations.filter((_, j) => j !== i))}>{t('w9d.panoramic.delete')}</Button>
            </div>)}
            {annotations.length === 0 && <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{t('w9d.panoramic.noAnnotations')}</div>}
          </Card>
        </Col>
      </Row>
    </div>
  );
};
export default PanoramicAnnotatorPage;
