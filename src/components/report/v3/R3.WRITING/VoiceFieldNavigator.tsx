/**
 * G005 放射RIS系统 v3.0.6.5 - 语音字段导航器 UI
 * 30 升级点:字段列表 / 焦点显示 / 触发词提示 / 跳转历史
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Card, Tag, Space, Button, Tooltip, List, Empty, Progress, Badge, Row, Col, Statistic, Divider } from 'antd';
import {
  ChevronLeft, ChevronRight, MapPin, Clock, Target, History, Mic, ListOrdered,
} from 'lucide-react';
import { useVoiceFieldNavigation } from '../../../hooks/useVoiceFieldNavigation';
import type { VoiceFieldTarget } from '../../../types/voice';

interface Props {
  reportId: string;
  fields: VoiceFieldTarget[];
  onFocus?: (field: VoiceFieldTarget) => void;
  initialIndex?: number;
}

export const VoiceFieldNavigator: React.FC<Props> = ({ reportId, fields, onFocus, initialIndex }) => {
  const nav = useVoiceFieldNavigation({ fields, initialIndex, onNavigate: (e: { from: string; to: string; mode: string; timestamp: number }) => {
    const target = fields.find((f) => f.fieldKey === e.to);
    if (target) onFocus?.(target);
  } });
  const [voiceText, setVoiceText] = useState('');

  useEffect(() => {
    if (nav.currentField && onFocus) onFocus(nav.currentField);
  }, [nav.currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const simulateVoice = useCallback((text: string) => {
    setVoiceText(text);
    nav.processCommand(text);
    setTimeout(() => setVoiceText(''), 1500);
  }, [nav]);

  const completedCount = nav.fields.filter((f: VoiceFieldTarget) => (f.value ?? '').length > 0).length;
  const totalRequired = nav.fields.filter((f: VoiceFieldTarget) => f.required).length;
  const completedRequired = nav.fields.filter((f: VoiceFieldTarget) => f.required && (f.value ?? '').length > 0).length;
  const percent = nav.fields.length === 0 ? 0 : Math.round((completedCount / nav.fields.length) * 100);

  return (
    <Card
      size="small"
      title={
        <Space>
          <Target className="w-4 h-4" style={{ color: '#3b82f6' }} />
          <span className="font-semibold">语音字段导航</span>
          <Tag color="blue">{nav.currentIndex + 1}/{nav.fields.length}</Tag>
        </Space>
      }
      extra={
        <Space>
          <Tooltip title="上一字段">
            <Button size="small" icon={<ChevronLeft className="w-3 h-3" />} onClick={nav.prev} />
          </Tooltip>
          <Tooltip title="下一字段">
            <Button size="small" icon={<ChevronRight className="w-3 h-3" />} onClick={nav.next} />
          </Tooltip>
        </Space>
      }
      className="shadow-sm"
    >
      <Row gutter={8} className="mb-3">
        <Col span={8}><Statistic title="完成字段" value={`${completedCount}/${nav.fields.length}`} valueStyle={{ fontSize: 14 }} /></Col>
        <Col span={8}><Statistic title="必填完成" value={`${completedRequired}/${totalRequired}`} valueStyle={{ fontSize: 14, color: completedRequired === totalRequired ? '#10b981' : '#f59e0b' }} /></Col>
        <Col span={8}><Statistic title="完成度" value={percent} suffix="%" valueStyle={{ fontSize: 14 }} /></Col>
      </Row>
      <Progress percent={percent} size="small" showInfo={false} strokeColor="#3b82f6" />

      <Divider style={{ margin: '12px 0' }} />

      {/* 当前字段高亮 */}
      {nav.currentField && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-3">
          <div className="flex items-center justify-between mb-1">
            <Space>
              <MapPin className="w-3 h-3 text-blue-600" />
              <span className="text-sm font-semibold text-blue-700">{nav.currentField.fieldLabel}</span>
              {nav.currentField.required && <Tag color="red" className="text-[10px]">必填</Tag>}
            </Space>
            <Badge count={nav.currentField.order} style={{ backgroundColor: '#3b82f6' }} />
          </div>
          {nav.currentField.value ? (
            <div className="text-xs text-slate-700 mt-1 max-h-16 overflow-y-auto">{nav.currentField.value}</div>
          ) : (
            <div className="text-xs text-slate-400 italic mt-1">该字段尚未填写 · 试着说"去{nav.currentField.fieldLabel}"</div>
          )}
          {nav.currentField.triggerWords.length > 0 && (
            <div className="mt-2">
              <div className="text-[10px] text-slate-500 mb-1">触发词:</div>
              <Space wrap size={4}>
                {nav.currentField.triggerWords.map((w: string) => (
                  <Tag key={w} color="cyan" className="text-[10px]">{w}</Tag>
                ))}
              </Space>
            </div>
          )}
        </div>
      )}

      {/* 语音命令 */}
      <div className="mb-3">
        <div className="text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
          <Mic className="w-3 h-3" /> 语音命令
        </div>
        <Space wrap size={4}>
          {nav.fields.slice(0, 5).map((f: VoiceFieldTarget) => (
            <Button key={f.fieldKey} size="small" type="dashed" onClick={() => simulateVoice(`去${f.fieldLabel}`)}>
              去{f.fieldLabel}
            </Button>
          ))}
          <Button size="small" type="dashed" onClick={() => simulateVoice('下一字段')}>下一字段</Button>
          <Button size="small" type="dashed" onClick={() => simulateVoice('上一字段')}>上一字段</Button>
          <Button size="small" type="dashed" onClick={() => simulateVoice('清除字段')}>清除字段</Button>
        </Space>
        {voiceText && (
          <div className="mt-2 text-xs text-slate-500 italic">识别中: "{voiceText}"</div>
        )}
      </div>

      {/* 字段列表 */}
      <div>
        <div className="text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
          <ListOrdered className="w-3 h-3" /> 字段清单
        </div>
        <List
          size="small"
          dataSource={nav.fields}
          renderItem={(f, idx) => {
            const active = idx === nav.currentIndex;
            const filled = (f.value ?? '').length > 0;
            return (
              <List.Item
                className={`cursor-pointer hover:bg-slate-50 rounded px-2 ${active ? 'bg-blue-50' : ''}`}
                onClick={() => nav.goTo(f.fieldKey)}
                actions={[
                  filled
                    ? <Tag key="filled" color="green" className="text-[10px]">已填</Tag>
                    : <Tag key="empty" color="default" className="text-[10px]">未填</Tag>,
                  f.required && <Tag key="req" color="red" className="text-[10px]">必填</Tag>,
                ]}
              >
                <List.Item.Meta
                  avatar={<Badge count={idx + 1} style={{ backgroundColor: active ? '#3b82f6' : '#94a3b8' }} />}
                  title={<span className={`text-xs ${active ? 'font-semibold text-blue-700' : 'text-slate-700'}`}>{f.fieldLabel}</span>}
                  description={<span className="text-[10px] text-slate-400">{f.section}</span>}
                />
              </List.Item>
            );
          }}
        />
      </div>

      {nav.history.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-200">
          <div className="text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
            <History className="w-3 h-3" /> 导航历史 ({nav.history.length})
          </div>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {nav.history.slice(0, 5).map((h: { from: string; to: string; mode: string; timestamp: number }, i: number) => (
              <div key={i} className="text-[10px] text-slate-500 flex items-center gap-1">
                <Clock className="w-2 h-2" />
                <span>{new Date(h.timestamp).toLocaleTimeString()}</span>
                <Tag color="cyan" className="text-[10px]">{h.mode}</Tag>
                <span>{h.from} → {h.to}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {nav.fields.length === 0 && <Empty description="无字段" />}
    </Card>
  );
};

export default VoiceFieldNavigator;
