// [v3.0.6.11-17] 检查室占用率 + 排队预测仪表盘
import React, { useState, useEffect, useCallback } from 'react';
import { Card, Space, Tag, Button, Row, Col, Statistic, Table, Tooltip, message, Badge, Select, Alert } from 'antd';
import { LayoutDashboard, Users, Clock, TrendingUp, AlertTriangle, Circle } from 'lucide-react';

interface Room {
  id: string; roomNo: string; status: 'idle' | 'occupied' | 'disinfecting' | 'fault';
  currentPatient?: string; examItem?: string; startTime?: string; expectedEnd?: string; overdue: boolean;
}

interface QueueItem { position: number; patientName: string; examItem: string; estimatedWaitMin: number; }
interface TrendPoint { time: string; occupied: number; total: number; rate: number; }

const STATUS_META: Record<string, { color: string; label: string }> = {
  idle: { color: '#52c41a', label: '空闲' },
  occupied: { color: '#1677ff', label: '占用中' },
  disinfecting: { color: '#faad14', label: '消毒中' },
  fault: { color: '#ff4d4f', label: '故障' },
};

export const RoomOccupancyPage: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [trends, setTrends] = useState<TrendPoint[]>([]);

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch('/api/occupancy/rooms');
      if (res.ok) setRooms(await res.json());
    } catch { /* fallback mock */ }
  }, []);

  const fetchTrends = useCallback(async () => {
    try {
      const res = await fetch('/api/occupancy/trends');
      if (res.ok) setTrends(await res.json());
    } catch { /* fallback */ }
  }, []);

  useEffect(() => {
    fetchRooms();
    fetchTrends();
    const iv = setInterval(fetchRooms, 15000);
    return () => clearInterval(iv);
  }, [fetchRooms, fetchTrends]);

  useEffect(() => {
    if (!selectedRoom) { setQueue([]); return; }
    (async () => {
      try {
        const res = await fetch(`/api/occupancy/queue/${selectedRoom}`);
        if (res.ok) { const d = await res.json(); setQueue(d.queue ?? []); }
      } catch { /* fallback */ }
    })();
  }, [selectedRoom]);

  const occupied = rooms.filter(r => r.status === 'occupied').length;
  const idle = rooms.filter(r => r.status === 'idle').length;
  const fault = rooms.filter(r => r.status === 'fault').length;
  const total = rooms.length;
  const utilRate = total ? Math.round((occupied / total) * 100) : 0;

  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <LayoutDashboard size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>检查室占用率 & 排队预测</span>
        <Tag color="cyan">v3.0.6.11-17</Tag>
        <Button size="small" onClick={() => { fetchRooms(); fetchTrends(); }}>刷新</Button>
      </Space>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="总检查室" value={total} suffix={`间`} prefix={<LayoutDashboard size={16} />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="当前占用" value={occupied} valueStyle={{ color: '#1677ff' }} prefix={<Users size={16} />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="空闲" value={idle} valueStyle={{ color: '#52c41a' }} prefix={<Circle size={16} />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="故障" value={fault} valueStyle={{ color: fault ? '#ff4d4f' : undefined }} prefix={<AlertTriangle size={16} />} /></Card></Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={16}>
          <Card size="small" title={<Space><LayoutDashboard size={14} />检查室平面布局</Space>}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {rooms.map(r => {
                const meta = STATUS_META[r.status] || STATUS_META.idle;
                const isOverdue = r.overdue;
                return (
                  <Tooltip key={r.id} title={
                    <div>
                      <div>{r.roomNo} - {meta.label}</div>
                      {r.currentPatient && <div>患者: {r.currentPatient}</div>}
                      {r.examItem && <div>项目: {r.examItem}</div>}
                      {r.expectedEnd && <div>预计结束: {new Date(r.expectedEnd).toLocaleTimeString()}</div>}
                      {isOverdue && <div style={{ color: '#ff4d4f' }}>超时 &gt;15min</div>}
                    </div>
                  }>
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label={`选择检查室 ${r.roomNo} - ${meta.label}${isOverdue ? ' (超时)' : ''}`}
                      aria-pressed={selectedRoom === r.id}
                      onClick={() => setSelectedRoom(r.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedRoom(r.id) } }}
                      style={{
                        width: 140, height: 90, borderRadius: 8, cursor: 'pointer',
                        background: isOverdue ? '#ff4d4f' : meta.color,
                        opacity: isOverdue ? undefined : 0.85,
                        color: '#fff', padding: 10, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                        animation: isOverdue ? 'blink 1s infinite' : undefined,
                        border: selectedRoom === r.id ? '3px solid #000' : '3px solid transparent',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{r.roomNo}</div>
                      <div style={{ fontSize: 11 }}>{meta.label}{isOverdue && ' ⚠'}</div>
                    </div>
                  </Tooltip>
                );
              })}
            </div>
          </Card>

          <Card size="small" title={<Space><TrendingUp size={14} />占用率趋势（过去 24h）</Space>} style={{ marginTop: 16 }}>
            <div style={{ height: 200, display: 'flex', alignItems: 'flex-end', gap: 2, padding: '0 4px' }}>
              {trends.map((p, i) => (
                <Tooltip key={i} title={`${p.time} 占用 ${p.occupied}/${p.total} (${p.rate}%)`}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                      width: '100%', height: `${p.rate}%`, background: p.rate > 80 ? '#ff4d4f' : p.rate > 50 ? '#faad14' : '#52c41a',
                      borderRadius: '4px 4px 0 0', minHeight: 4, transition: 'height 0.3s',
                    }} />
                    <div style={{ fontSize: 9, color: '#999', marginTop: 2, transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>{p.time}</div>
                  </div>
                </Tooltip>
              ))}
            </div>
          </Card>
        </Col>

        <Col span={8}>
          <Card size="small" title={<Space><Clock size={14} />排队队列 {selectedRoom ? `- ${rooms.find(r => r.id === selectedRoom)?.roomNo ?? ''}` : ''}</Space>}>
            {!selectedRoom ? (
              <div style={{ color: '#999', textAlign: 'center', padding: 24 }}>点击左侧房间查看排队</div>
            ) : (
              <>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>等候人数: {queue.length} 人</span>
                  <span style={{ marginLeft: 16, fontSize: 13 }}>预计等待: {queue.reduce((s, q) => s + q.estimatedWaitMin, 0)} 分钟</span>
                </div>
                <Table dataSource={queue} rowKey="position" size="small" pagination={false}
                  columns={[
                    { title: '#', dataIndex: 'position', width: 40 },
                    { title: '患者', dataIndex: 'patientName', ellipsis: true },
                    { title: '项目', dataIndex: 'examItem', ellipsis: true },
                    { title: '预计等待', dataIndex: 'estimatedWaitMin', render: v => `${v}min` },
                  ]} />
              </>
            )}
          </Card>

          <Card size="small" title={<Space><AlertTriangle size={14} />超时告警</Space>} style={{ marginTop: 16 }}>
            {rooms.filter(r => r.overdue).length === 0 ? (
              <div style={{ color: '#52c41a', padding: 12, textAlign: 'center' }}>暂无超时房间</div>
            ) : (
              rooms.filter(r => r.overdue).map(r => (
                <Alert key={r.id} type="error" showIcon message={`${r.roomNo} 超时 >15min`} style={{ marginBottom: 8 }}
                  description={`患者: ${r.currentPatient ?? '--'} | 预计结束: ${r.expectedEnd ? new Date(r.expectedEnd).toLocaleTimeString() : '--'}`}
                />
              ))
            )}
          </Card>

          <Card size="small" title={<Space><Circle size={14} />手动更新状态</Space>} style={{ marginTop: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Select placeholder="选择房间" style={{ width: '100%' }}
                options={rooms.map(r => ({ value: r.id, label: r.roomNo }))}
                onChange={v => setSelectedRoom(v)}
              />
              <Select placeholder="目标状态" style={{ width: '100%' }}
                options={[
                  { value: 'idle', label: '空闲' },
                  { value: 'occupied', label: '占用中' },
                  { value: 'disinfecting', label: '消毒中' },
                  { value: 'fault', label: '故障' },
                ]}
                onChange={async (v) => {
                  const sel = document.querySelector<HTMLSelectElement>('.ant-select')?.dataset?.roomId;
                  if (!selectedRoom) { message.warning('请先选择房间'); return; }
                  try {
                    const res = await fetch(`/api/occupancy/room/${selectedRoom}/status`, {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ status: v }),
                    });
                    if (res.ok) { message.success('状态已更新'); fetchRooms(); }
                    else message.error('更新失败');
                  } catch { message.error('请求失败'); }
                }}
              />
            </Space>
          </Card>
        </Col>
      </Row>

      <style>{`
        @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  );
};
export default RoomOccupancyPage;
