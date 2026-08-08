// [v3.0.6.8-55] 全景片标注工具 (Canvas)
import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Space, Tag, Button, Row, Col, Select, message } from 'antd';
import { Ruler, Square, Circle, Type, Trash2, Save } from 'lucide-react';

type Tool = 'ruler' | 'rect' | 'circle' | 'text';
interface Annotation { id: string; tool: Tool; x: number; y: number; w: number; h: number; text?: string; color: string; label?: string; value?: string; }

const COLORS = ['#ff4d4f', '#2563eb', '#52c41a', '#faad14', '#722ed1', '#13c2c2'];

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
      message.success(`已保存 ${annotations.length} 条标注到本地`);
    } catch {
      message.error('保存失败，浏览器存储不可用');
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
        ctx.fillStyle = a.color; ctx.font = '14px sans-serif'; ctx.fillText(a.text || a.label || '', a.x, a.y);
      }
      if (a.label) {
        ctx.fillStyle = a.color; ctx.font = '10px sans-serif'; ctx.fillText(a.label, a.x, a.y-8);
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
    const a: Annotation = { id: `ann-${Date.now()}`, tool: activeTool, x: Math.min(startPos.x, endX), y: Math.min(startPos.y, endY), w: Math.abs(endX - startPos.x), h: Math.abs(endY - startPos.y), color: COLORS[colorIdx % COLORS.length], label };
    if (activeTool === 'text') { a.text = label || '标注'; a.w = 0; a.h = 0; }
    setAnnotations([...annotations, a]);
    setIsDrawing(false);
  };

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Ruler size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>全景片标注</span>
        <Tag color="cyan">v3.0.6.8-55</Tag>
        <Tag color="blue">{studyId || '无研究'}</Tag>
      </Space>
      <Row gutter={16}>
        <Col span={18}>
          <Card size="small" title={
            <Space>
              {(['ruler','rect','circle','text'] as Tool[]).map(t => (
                <Button key={t} type={activeTool === t ? 'primary' : 'default'} size="small"
                  icon={t === 'ruler' ? <Ruler size={12} /> : t === 'rect' ? <Square size={12} /> : t === 'circle' ? <Circle size={12} /> : <Type size={12} />}
                  onClick={() => setActiveTool(t)}>{t === 'ruler' ? '测量' : t === 'rect' ? '矩形' : t === 'circle' ? '椭圆' : '文字'}</Button>
              ))}
            </Space>
          } extra={
            <Space>
              <Select size="small" value={label || undefined} onChange={setLabel} allowClear style={{ width: 100 }} options={['龋齿','根尖病变','骨丧失','种植位','阻生'].map(t=>({value:t,label:t}))} />
              <Button size="small" icon={<Save size={12} />} onClick={handleSaveAnnotations}>保存标注</Button>
              <Button size="small" icon={<Trash2 size={12} />} onClick={() => setAnnotations([])}>清除</Button>
            </Space>
          }>
            <canvas ref={canvasRef} width={700} height={550} style={{ width: '100%', height: 'auto', cursor: 'crosshair', border: '1px solid #333', borderRadius: 4 }}
              onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} />
            <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>在图片上拖动进行标注 | 标注数: {annotations.length}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card title="标注列表" size="small">
            {annotations.map((a, i) => <div key={a.id} style={{ padding: 8, marginBottom: 4, background: '#fafafa', borderRadius: 4, borderLeft: `3px solid ${a.color}` }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{a.tool} - {a.label || '-'}</div>
              <div style={{ fontSize: 11, color: '#666' }}>{a.tool === 'ruler' ? Math.round(Math.sqrt(a.w*a.w + a.h*a.h)) + 'mm' : `${a.w}×${a.h}`}</div>
              <Button type="text" size="small" danger icon={<Trash2 size={10} />} onClick={() => setAnnotations(annotations.filter((_, j) => j !== i))}>删</Button>
            </div>)}
            {annotations.length === 0 && <div style={{ color: '#999', fontSize: 12 }}>暂无标注</div>}
          </Card>
        </Col>
      </Row>
    </div>
  );
};
export default PanoramicAnnotatorPage;
