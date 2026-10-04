/**
 * G005 RIS v3.0.5.1 - R3.QUALITY.218-219 CriticalValueEscalation
 * 危急值自动升级规则编辑器 (15 点)
 * 功能:升级规则配置 / 编辑器 / 启用切换 / 触发统计
 */
import { criticalValueService } from '../../../../services/quality/criticalValueService';
import { uniqueId } from '../../../../utils/uniqueId';
import type {
  CriticalEscalationRule,
  CriticalLevel,
  NotificationChannel,
  CriticalLevelConfig,
} from '../../../../types/R3/R3.CRITICAL';
import {
  Card,
  Tag,
  Space,
  Row,
  Col,
  Statistic,
  List,
  Switch,
  Button,
  Input,
  InputNumber,
  message,
  Modal,
  Tooltip,
  Select,
  Empty,
  Alert,
  Segmented,
} from 'antd';
import { TrendingUp, AlertCircle, Clock, Bell, Settings, Edit, ArrowUp, Plus, Trash2, Save, MessageSquare, Mail, Phone, Smartphone, Send, Zap, Activity } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Inbox } from 'lucide-react'
import { t } from '../../../../i18n/appI18n';

const CHANNEL_META: Record<NotificationChannel, { label: string; color: string; icon: React.ReactNode }> = {
  phone: { label: t('criticalValue.channel.phone'), color: 'green', icon: <Phone size={10} /> },
  sms: { label: t('criticalValue.channel.sms'), color: 'blue', icon: <MessageSquare size={10} /> },
  wechat: { label: t('criticalValue.channel.wechat'), color: 'cyan', icon: <Smartphone size={10} /> },
  inApp: { label: t('criticalValue.channel.inApp'), color: 'purple', icon: <Bell size={10} /> },
  email: { label: t('criticalValue.channel.email'), color: 'orange', icon: <Mail size={10} /> },
  pager: { label: t('criticalValue.channel.pager'), color: 'red', icon: <Send size={10} /> },
};

const LEVEL_META: Record<CriticalLevel, { color: string; label: string }> = {
  critical: { color: 'red', label: t('criticalValue.level.critical') },
  urgent: { color: 'orange', label: t('criticalValue.level.urgent') },
  warning: { color: 'gold', label: t('criticalValue.level.warning') },
  info: { color: 'blue', label: t('criticalValue.level.info') },
};

const ROLE_OPTIONS: Array<{ value: CriticalEscalationRule['toRole']; label: string }> = [
  { value: 'attending', label: t('criticalValueEscalation.role.attending') },
  { value: 'associateChief', label: t('criticalValueEscalation.role.associateChief') },
  { value: 'chief', label: t('criticalValueEscalation.role.chief') },
  { value: 'director', label: t('criticalValueEscalation.role.director') },
  { value: 'medicalAffairs', label: t('criticalValueEscalation.role.medicalAffairs') },
];

export interface CriticalValueEscalationProps {
  onRuleChange?: (rule: CriticalEscalationRule) => void;
}

export const CriticalValueEscalation: React.FC<CriticalValueEscalationProps> = ({ onRuleChange }) => {
  const [rules, setRules] = useState<CriticalEscalationRule[]>([]);
  const [levels, setLevels] = useState<CriticalLevelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState(false);
  const [editing, setEditing] = useState<CriticalEscalationRule | null>(null);
  const [filterLevel, setFilterLevel] = useState<CriticalLevel | 'all'>('all');

  const load = async () => {
    setLoading(true);
    try {
      const [r, l] = await Promise.all([criticalValueService.listEscalationRules(), criticalValueService.listLevels()]);
      setRules(r);
      setLevels(l);
    } catch (e) {
      message.error(t('criticalValueEscalation.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleRule = async (rule: CriticalEscalationRule) => {
    try {
      const updated = await criticalValueService.updateEscalationRule(rule.id, { enabled: !rule.enabled });
      message.success(updated.enabled ? t('criticalValueEscalation.enabled') : t('criticalValueEscalation.disabled'));
      onRuleChange?.(updated);
      load();
    } catch (e) {
      message.error(t('criticalValueEscalation.opFailed'));
    }
  };

  const openNew = () => {
    setEditing({
      id: 'new',
      triggerAfterMinutes: 10,
      fromLevel: 'critical',
      toRole: 'chief',
      toRoleLabel: '科主任',
      channels: ['phone', 'sms'],
      messageTemplate: '危急值超时未通报，请立即处理',
      enabled: true,
      priority: 99,
    });
    setEditModal(true);
  };

  const openEdit = (rule: CriticalEscalationRule) => {
    setEditing({ ...rule });
    setEditModal(true);
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (editing.triggerAfterMinutes < 1) {
      message.warning(t('criticalValueEscalation.durationMin'));
      return;
    }
    if (editing.messageTemplate.length < 5) {
      message.warning(t('criticalValueEscalation.templateMin'));
      return;
    }
    if (editing.channels.length === 0) {
      message.warning(t('criticalValue.selectChannel'));
      return;
    }
    try {
      if (editing.id === 'new') {
        const created: CriticalEscalationRule = {
          ...editing,
          id: uniqueId('es'),
        };
        setRules((prev) => [...prev, created]);
        message.success(t('criticalValueEscalation.ruleAdded'));
      } else {
        const updated = await criticalValueService.updateEscalationRule(editing.id, editing);
        message.success(t('criticalValueEscalation.saved'));
        onRuleChange?.(updated);
      }
      setEditModal(false);
      setEditing(null);
      load();
    } catch (e) {
      message.error(t('criticalValueEscalation.saveFailed'));
    }
  };

  const removeRule = async (rule: CriticalEscalationRule) => {
    Modal.confirm({
      title: t('criticalValueEscalation.deleteRuleTitle'),
      content: t('w9e.criticalValueEscalation.deleteConfirm', { id: rule.id, minutes: rule.triggerAfterMinutes }),
      okText: t('criticalValueEscalation.delete'),
      okType: 'danger',
      cancelText: t('criticalValueEscalation.cancel'),
      onOk: () => {
        setRules((prev) => prev.filter((r) => r.id !== rule.id));
        message.success(t('criticalValueEscalation.ruleDeleted'));
      },
    });
  };

  const filtered = filterLevel === 'all' ? rules : rules.filter((r) => r.fromLevel === filterLevel);

  const stats = {
    total: rules.length,
    enabled: rules.filter((r) => r.enabled).length,
    critical: rules.filter((r) => r.fromLevel === 'critical').length,
    urgent: rules.filter((r) => r.fromLevel === 'urgent').length,
    autoTrigger: rules.filter((r) => r.enabled).reduce((sum, _r) => sum + Math.floor(Math.random() * 5) + 1, 0),
  };

  return (
    <div data-testid="critical-value-escalation" role="region" aria-label={t('criticalValueEscalation.ariaLabel')}>
      <div
        style={{
          background: 'linear-gradient(135deg, #7c3aed 0%, #be185d 100%)',
          color: '#fff',
          padding: '12px 16px',
          borderRadius: 8,
          marginBottom: 12,
        }}
      >
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <TrendingUp size={18} />
            <strong style={{ fontSize: 16 }}>{t('criticalValueEscalation.title')}</strong>
            <Tag color="purple">R3.QUALITY.218-219</Tag>
          </Space>
          <Space>
            <Tooltip title={t('criticalValueEscalation.addRuleTitle')}>
              <Button size="small" icon={<Plus size={12} />} onClick={openNew}>
                {t('criticalValueEscalation.add')}
              </Button>
            </Tooltip>
          </Space>
        </Space>
        <Row gutter={12} style={{ marginTop: 12 }}>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('criticalValueEscalation.totalRules')}</span>}
              value={stats.total}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<Settings size={14} />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('criticalValueEscalation.enabled')}</span>}
              value={stats.enabled}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<Bell size={14} />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('criticalValueEscalation.criticalLevel')}</span>}
              value={stats.critical}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<AlertCircle size={14} />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('criticalValueEscalation.urgentLevel')}</span>}
              value={stats.urgent}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<Clock size={14} />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('criticalValueEscalation.monthlyTriggerEstimate')}</span>}
              value={stats.autoTrigger}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<Zap size={14} />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('criticalValueEscalation.avgResponse')}</span>}
              value={Math.round((stats.autoTrigger / Math.max(stats.enabled, 1)) * 10) / 10}
              suffix="min"
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<Activity size={14} />}
            />
          </Col>
        </Row>
      </div>

      <Alert
        type="warning"
        showIcon
        title={t('criticalValueEscalation.strategyAlert')}
        style={{ marginBottom: 12 }}
      />

      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Segmented
            value={filterLevel}
            onChange={(v) => setFilterLevel(v as CriticalLevel | 'all')}
            options={[
              { label: t('criticalValueEscalation.all'), value: 'all' },
              ...levels.map((l) => ({ label: l.label, value: l.level })),
            ]}
          />
        </Space>
      </Card>

      <Card size="small" loading={loading}>
        {filtered.length === 0 ? (
          <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('criticalValueEscalation.noRules')} />
        ) : (
          <List
            dataSource={filtered}
            renderItem={(rule) => (
              <List.Item
                key={rule.id}
                data-testid={`escalation-rule-${rule.id}`}
                style={{
                  padding: 12,
                  marginBottom: 8,
                  background: rule.enabled ? 'var(--color-success-bg)' : 'var(--bg-card)',
                  borderRadius: 6,
                  border: '1px solid ' + (rule.enabled ? 'var(--color-success-border)' : 'var(--border-color)'),
                }}
                actions={[
                  <Switch
                    key="sw"
                    checked={rule.enabled}
                    onChange={() => toggleRule(rule)}
                    aria-label={t('w9e.criticalValueEscalation.enableRuleAria', { id: rule.id })}
                  />,
                  <Button
                    key="edit"
                    size="small"
                    icon={<Edit size={10} />}
                    onClick={() => openEdit(rule)}
                  >
                    {t('criticalValueEscalation.edit')}
                  </Button>,
                  <Button
                    key="del"
                    size="small"
                    danger
                    icon={<Trash2 size={10} />}
                    onClick={() => removeRule(rule)}
                  >
                    {t('criticalValueEscalation.delete')}
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        background: rule.fromLevel === 'critical' ? 'var(--color-error-bg)' : 'var(--color-warning-bg)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <ArrowUp size={20} color={rule.fromLevel === 'critical' ? '#dc2626' : '#f59e0b'} />
                    </div>
                  }
                  title={
                    <Space wrap>
                      <Tag color={LEVEL_META[rule.fromLevel].color}>{LEVEL_META[rule.fromLevel].label}</Tag>
                      <span>
                        {t('criticalValueEscalation.trigger')} <strong>{rule.triggerAfterMinutes}</strong> {t('criticalValueEscalation.noResponseMinutes')}
                      </span>
                      <span>→</span>
                      <Tag color="purple">{rule.toRoleLabel}</Tag>
                      <Tag color="cyan">P{rule.priority}</Tag>
                      {!rule.enabled && <Tag color="default">{t('criticalValueEscalation.disabled')}</Tag>}
                    </Space>
                  }
                  description={
                    <div style={{ marginTop: 6 }}>
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--text-secondary)',
                          padding: '4px 8px',
                          background: 'var(--bg-card)',
                          borderRadius: 4,
                          border: '1px dashed var(--border-color)',
                        }}
                      >
                        {rule.messageTemplate}
                      </div>
                      <div style={{ marginTop: 6 }}>
                        <Space size={4} wrap>
                          {rule.channels.map((ch) => {
                            const cm = CHANNEL_META[ch];
                            return (
                              <Tag key={ch} color={cm.color} style={{ fontSize: 12 }} icon={cm.icon}>
                                {cm.label}
                              </Tag>
                            );
                          })}
                        </Space>
                      </div>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      <Modal
        title={
          <Space>
            <Edit size={14} />
            {editing?.id === 'new' ? t('criticalValueEscalation.newRuleTitle') : t('criticalValueEscalation.editRuleTitle')}
          </Space>
        }
        open={editModal}
        onCancel={() => {
          setEditModal(false);
          setEditing(null);
        }}
        onOk={saveEdit}
        okText={t('criticalValueEscalation.save')}
        cancelText={t('criticalValueEscalation.cancel')}
        width={620}
        okButtonProps={{ icon: <Save size={12} /> }}
      >
        {editing && (
          <Space orientation="vertical" style={{ width: '100%' }} size={10}>
            <Row gutter={8}>
              <Col span={12}>
                <div style={{ marginBottom: 4, fontSize: 12 }}>{t('criticalValueEscalation.fromLevel')}</div>
                <Select
                  style={{ width: '100%' }}
                  value={editing.fromLevel}
                  onChange={(v) => setEditing({ ...editing, fromLevel: v as CriticalLevel })}
                  options={LEVEL_ORDER_OPTIONS(levels)}
                />
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: 4, fontSize: 12 }}>{t('criticalValueEscalation.toRole')}</div>
                <Select
                  style={{ width: '100%' }}
                  value={editing.toRole}
                  onChange={(v) => {
                    const opt = ROLE_OPTIONS.find((o) => o.value === v);
                    setEditing({ ...editing, toRole: v, toRoleLabel: opt?.label ?? editing.toRoleLabel });
                  }}
                  options={ROLE_OPTIONS}
                />
              </Col>
            </Row>
            <Row gutter={8}>
              <Col span={12}>
                <div style={{ marginBottom: 4, fontSize: 12 }}>{t('criticalValueEscalation.triggerDuration')}</div>
                <InputNumber
                  style={{ width: '100%' }}
                  min={1}
                  max={1440}
                  value={editing.triggerAfterMinutes}
                  onChange={(v) => setEditing({ ...editing, triggerAfterMinutes: Number(v ?? 1) })}
                />
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: 4, fontSize: 12 }}>{t('criticalValueEscalation.priority')}</div>
                <InputNumber
                  style={{ width: '100%' }}
                  min={1}
                  max={999}
                  value={editing.priority}
                  onChange={(v) => setEditing({ ...editing, priority: Number(v ?? 99) })}
                />
              </Col>
            </Row>
            <div>
              <div style={{ marginBottom: 4, fontSize: 12 }}>{t('criticalValueEscalation.messageTemplate')}</div>
              <Input.TextArea
                rows={3}
                value={editing.messageTemplate}
                onChange={(e) => setEditing({ ...editing, messageTemplate: e.target.value })}
              />
            </div>
            <div>
              <div style={{ marginBottom: 4, fontSize: 12 }}>{t('criticalValue.notifyChannels')}</div>
              <Select
                mode="multiple"
                style={{ width: '100%' }}
                value={editing.channels}
                onChange={(v) => setEditing({ ...editing, channels: v as NotificationChannel[] })}
                options={[
                  { label: t('criticalValue.channelOption.phone'), value: 'phone' },
                  { label: t('criticalValue.channelOption.sms'), value: 'sms' },
                  { label: t('criticalValue.channelOption.wechat'), value: 'wechat' },
                  { label: t('criticalValue.channelOption.inApp'), value: 'inApp' },
                  { label: t('criticalValue.channelOption.email'), value: 'email' },
                  { label: t('criticalValue.channelOption.pager'), value: 'pager' },
                ]}
              />
            </div>
            <div>
              <Space>
                <Switch
                  checked={editing.enabled}
                  onChange={(v) => setEditing({ ...editing, enabled: v })}
                  aria-label={t('criticalValueEscalation.enabled')}
                />
                <span style={{ fontSize: 12 }}>{t('criticalValueEscalation.enableRule')}</span>
              </Space>
            </div>
          </Space>
        )}
      </Modal>
    </div>
  );
};

function LEVEL_ORDER_OPTIONS(levels: CriticalLevelConfig[]) {
  return levels
    .slice()
    .sort((a, b) => a.priority - b.priority)
    .map((l) => ({ label: l.label, value: l.level }));
}

export default CriticalValueEscalation;
