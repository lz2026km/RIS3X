/**
 * G005 放射RIS系统 v3.0.6.5 - 语音命令面板 UI
 * 30 升级点:命令目录 / 分类 / 快捷键 / 触发测试
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Card, Tag, Space, Button, Input, Tooltip, List, Empty, Tabs, message, Badge, Statistic, Row, Col, Divider } from 'antd';
import { Command, Search, Play, Mic, Zap, Edit, Save, Settings, History as HistoryIcon, PlusCircle, Type, Navigation, Layout, Palette, Trash2 } from 'lucide-react';
import { VOICE_COMMANDS, COMMAND_CATEGORIES } from '../../../data/voice/voiceCommands';
import { voiceCommandEngine } from '../../../services/voice/commands/VoiceCommandEngine';
import type { VoiceCommandDefinition, VoiceCommandCategory, VoiceCommandMatch } from '../../../types/voice';

interface Props {
  onCommandTriggered?: (cmd: VoiceCommandDefinition, match: VoiceCommandMatch) => void;
  defaultLang?: string;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Type, Edit, Navigation, Layout, PlusCircle, Save, Settings, Palette,
};

export const VoiceCommandPanel: React.FC<Props> = ({ onCommandTriggered, defaultLang = 'zh-CN' }) => {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<VoiceCommandCategory | 'all'>('all');
  const [recentTriggered, setRecentTriggered] = useState<VoiceCommandDefinition[]>([]);
  const [testInput, setTestInput] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return VOICE_COMMANDS.filter((c: VoiceCommandDefinition) => {
      if (!c.enabled) return false;
      if (activeCategory !== 'all' && c.category !== activeCategory) return false;
      if (!q) return true;
      return c.command.includes(q)
        || c.english.toLowerCase().includes(q)
        || c.aliases.some((a: string) => a.toLowerCase().includes(q))
        || c.description.toLowerCase().includes(q);
    });
  }, [query, activeCategory]);

  const triggerCommand = useCallback((cmd: VoiceCommandDefinition) => {
    const match: VoiceCommandMatch = {
      command: cmd,
      matchedPhrase: cmd.command,
      confidence: 1,
      timestamp: Date.now(),
      payload: cmd.customPayload,
    };
    onCommandTriggered?.(cmd, match);
    setRecentTriggered((prev) => [cmd, ...prev.filter((c) => c.id !== cmd.id)].slice(0, 8));
    message.success(`已触发: ${cmd.command}`);
  }, [onCommandTriggered]);

  const testRecognition = useCallback(() => {
    if (!testInput.trim()) {
      message.warning('请输入要测试的语音文本');
      return;
    }
    const matches = voiceCommandEngine.recognize(testInput);
    if (matches.length === 0) {
      message.info('未识别到命令');
      return;
    }
    matches.forEach((m: VoiceCommandMatch) => {
      triggerCommand(m.command);
    });
  }, [testInput, triggerCommand]);

  const stats = useMemo(() => {
    const total = VOICE_COMMANDS.filter((c: VoiceCommandDefinition) => c.enabled).length;
    return { total, categories: COMMAND_CATEGORIES.length, recent: recentTriggered.length };
  }, [recentTriggered.length]);

  return (
    <Card
      size="small"
      title={
        <Space>
          <Command className="w-4 h-4" style={{ color: '#7c3aed' }} />
          <span className="font-semibold">语音命令</span>
          <Tag color="purple">{stats.total} 个</Tag>
        </Space>
      }
      extra={
        <Badge count={stats.recent} size="small" offset={[-4, 4]}>
          <HistoryIcon className="w-4 h-4 text-slate-400" />
        </Badge>
      }
      className="shadow-sm"
    >
      <Row gutter={8} className="mb-3">
        <Col span={8}><Statistic title="命令总数" value={stats.total} prefix={<Command className="w-3 h-3" />} valueStyle={{ fontSize: 14 }} /></Col>
        <Col span={8}><Statistic title="分类" value={stats.categories} prefix={<Layout className="w-3 h-3" />} valueStyle={{ fontSize: 14 }} /></Col>
        <Col span={8}><Statistic title="已触发" value={stats.recent} prefix={<Zap className="w-3 h-3" />} valueStyle={{ fontSize: 14 }} /></Col>
      </Row>

      <Input
        size="small"
        prefix={<Search className="w-3 h-3 text-slate-400" />}
        placeholder="搜索命令、中英文、别名..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        allowClear
        className="mb-2"
      />

      <Tabs
        size="small"
        activeKey={activeCategory}
        onChange={(k) => setActiveCategory(k as VoiceCommandCategory | 'all')}
        items={[
          { key: 'all', label: '全部', children: null },
          ...COMMAND_CATEGORIES.map((cat: VoiceCommandCategory) => {
            const Icon = ICON_MAP[cat.icon] ?? Type;
            return {
              key: cat.key,
              label: (
                <span className="flex items-center gap-1 text-xs">
                  <Icon className="w-3 h-3" />
                  {cat.label}
                  <Tag className="text-[10px]">{cat.count}</Tag>
                </span>
              ),
              children: null,
            };
          }),
        ]}
      />

      <div className="max-h-72 overflow-y-auto">
        <List
          size="small"
          dataSource={filtered}
          renderItem={(cmd) => (
            <List.Item
              className="hover:bg-slate-50 rounded px-2"
              actions={[
                cmd.shortcut ? <Tag key="hot" color="orange" className="text-[10px]">{cmd.shortcut}</Tag> : null,
                <Button key="trigger" size="small" type="primary" icon={<Play className="w-3 h-3" />} onClick={() => triggerCommand(cmd)}>
                  触发
                </Button>,
              ].filter(Boolean) as React.ReactNode[]}
            >
              <List.Item.Meta
                title={
                  <Space wrap size={4}>
                    <span className="text-sm font-semibold text-slate-700">"{cmd.command}"</span>
                    <span className="text-[10px] text-slate-400">/ {cmd.english}</span>
                    {cmd.aliases.length > 0 && (
                      <span className="text-[10px] text-slate-500">别名: {cmd.aliases.join(', ')}</span>
                    )}
                  </Space>
                }
                description={
                  <div className="text-xs text-slate-500">
                    {cmd.description} · <span className="text-[10px]">{cmd.descriptionEn}</span>
                  </div>
                }
              />
            </List.Item>
          )}
        />
        {filtered.length === 0 && <Empty description="无匹配命令" />}
      </div>

      <Divider style={{ margin: '12px 0' }} />

      {/* 测试区 */}
      <div>
        <div className="text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
          <Mic className="w-3 h-3" /> 模拟识别测试
        </div>
        <Space.Compact style={{ width: '100%' }}>
          <Input
            size="small"
            placeholder='试试: "新段落" / "正常模板" / "下一字段"'
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            onPressEnter={testRecognition}
          />
          <Button size="small" type="primary" icon={<Play className="w-3 h-3" />} onClick={testRecognition}>
            识别
          </Button>
        </Space.Compact>
        {testInput && (
          <div className="mt-1 text-[10px] text-slate-500">输入: "{testInput}"</div>
        )}
      </div>

      {recentTriggered.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-200">
          <div className="text-xs font-semibold text-slate-600 mb-1">最近触发</div>
          <Space wrap size={4}>
            {recentTriggered.map((cmd) => (
              <Tag key={cmd.id} color="cyan" className="text-xs">
                {cmd.command}
              </Tag>
            ))}
            <Button size="small" type="text" icon={<Trash2 className="w-3 h-3" />} onClick={() => setRecentTriggered([])}>
              清空
            </Button>
          </Space>
        </div>
      )}
    </Card>
  );
};

export default VoiceCommandPanel;
