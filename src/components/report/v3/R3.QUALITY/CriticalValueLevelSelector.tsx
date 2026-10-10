/**
 * G005 RIS v3.0.5.1 - R3.QUALITY.211 CriticalValueLevelSelector
 * 危急值分级分类器 (15 点)
 * 功能:4 级分类展示与选择 / 渠道映射 / 响应时效
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Card, Tag, Space, Row, Col, Statistic, message, Alert, Progress, Badge, Segmented } from 'antd';
import { AlertTriangle, Layers, Clock, Zap, Bell, ChevronRight, Target, Timer, Gauge, Phone, Mail, MessageSquare, MessageCircle, BellRing, type LucideIcon } from 'lucide-react';
import { criticalValueService } from '../../../../services/quality/criticalValueService';
import type { CriticalLevel, CriticalLevelConfig, NotificationChannel, CriticalKPI } from '../../../../types/R3/R3.CRITICAL';
import { t } from '../../../../i18n/appI18n';

const CHANNEL_META: Record<NotificationChannel, { label: string; color: string; icon: LucideIcon }> = {
  phone: { label: t('w9e.criticalLevelSelector.channelPhone'), color: 'green', icon: Phone },
  sms: { label: t('w9e.criticalLevelSelector.channelSms'), color: 'blue', icon: MessageSquare },
  wechat: { label: t('w9e.criticalLevelSelector.channelWechat'), color: 'cyan', icon: MessageCircle },
  inApp: { label: t('w9e.criticalLevelSelector.channelInApp'), color: 'purple', icon: Bell },
  email: { label: t('w9e.criticalLevelSelector.channelEmail'), color: 'orange', icon: Mail },
  pager: { label: t('w9e.criticalLevelSelector.channelPager'), color: 'red', icon: BellRing },
};

const LEVEL_ORDER: CriticalLevel[] = ['critical', 'urgent', 'warning', 'info'];

export interface CriticalValueLevelSelectorProps {
  onSelect?: (level: CriticalLevel) => void;
  selectedLevel?: CriticalLevel;
  showKPI?: boolean;
}

export const CriticalValueLevelSelector: React.FC<CriticalValueLevelSelectorProps> = ({
  onSelect,
  selectedLevel,
  showKPI = true,
}) => {
  const [levels, setLevels] = useState<CriticalLevelConfig[]>([]);
  const [kpi, setKpi] = useState<CriticalKPI | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    Promise.all([criticalValueService.listLevels(), criticalValueService.getKPI()])
      .then(([l, k]) => {
        setLevels(l);
        setKpi(k);
      })
      .catch(() => message.error(t('w9e.criticalLevelSelector.loadFailed')))
      .finally(() => setLoading(false));
  }, []);

  const orderedLevels = useMemo(
    () => levels.slice().sort((a, b) => a.priority - b.priority),
    [levels],
  );

  const levelCounts = useMemo(() => {
    if (!kpi) return {} as Record<CriticalLevel, number>;
    return kpi.byLevel;
  }, [kpi]);

  const totalThisMonth = useMemo(() => {
    if (!kpi) return 0;
    return Object.values(levelCounts).reduce((a, b) => a + b, 0);
  }, [kpi, levelCounts]);

  const maxDeadline = useMemo(
    () => (orderedLevels.length > 0 ? Math.max(...orderedLevels.map((l) => l.responseDeadline)) : 0),
    [orderedLevels],
  );

  const channelUniverse = useMemo(() => {
    const set = new Set<NotificationChannel>();
    orderedLevels.forEach((l) => l.defaultChannels.forEach((c) => set.add(c)));
    return Array.from(set);
  }, [orderedLevels]);

  return (
    <div data-testid="critical-value-level-selector" role="region" aria-label={t('w9e.criticalLevelSelector.ariaLabel')}>
      <div
        style={{
          background: 'linear-gradient(135deg, #7c2d12 0%, var(--color-error-600) 100%)',
          color: '#fff',
          padding: '12px 16px',
          borderRadius: 8,
          marginBottom: 12,
        }}
      >
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Layers size={18} />
            <strong style={{ fontSize: 16 }}>{t('w9e.criticalLevelSelector.title')}</strong>
            <Tag color="purple">R3.QUALITY.211</Tag>
          </Space>
          <Segmented
            value={view}
            onChange={(v) => setView(v as 'grid' | 'list')}
            options={[
              { label: t('w9e.criticalLevelSelector.viewGrid'), value: 'grid' },
              { label: t('w9e.criticalLevelSelector.viewList'), value: 'list' },
            ]}
          />
        </Space>
        <Row gutter={12} style={{ marginTop: 12 }}>
          <Col span={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('w9e.criticalLevelSelector.statLevelCount')}</span>}
              value={orderedLevels.length}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<Layers size={14} />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('w9e.criticalLevelSelector.statMaxResponse')}</span>}
              value={orderedLevels.length > 0 ? Math.min(...orderedLevels.map((l) => l.responseDeadline)) : 0}
              suffix={t('w9e.criticalLevelSelector.minutes')}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<Zap size={14} />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('w9e.criticalLevelSelector.statChannels')}</span>}
              value={channelUniverse.length}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<Bell size={14} />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('w9e.criticalLevelSelector.statMonthTriggers')}</span>}
              value={totalThisMonth}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<Target size={14} />}
            />
          </Col>
        </Row>
      </div>

      <Alert
        type="info"
        showIcon
        title={t('w9e.criticalLevelSelector.alertTitle')}
        description={t('w9e.criticalLevelSelector.alertDesc')}
        style={{ marginBottom: 12 }}
      />

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>{t('w9e.criticalLevelSelector.loading')}</div>
      ) : view === 'grid' ? (
        <Row gutter={[12, 12]}>
          {orderedLevels.map((l) => {
            const count = levelCounts[l.level] ?? 0;
            const pct = totalThisMonth > 0 ? Math.round((count / totalThisMonth) * 100) : 0;
            return (
              <Col span={12} key={l.level}>
                <Card
                  size="small"
                  hoverable
                  onClick={() => onSelect?.(l.level)}
                  style={{
                    cursor: onSelect ? 'pointer' : 'default',
                    borderLeft: `6px solid ${l.color}`,
                    background: selectedLevel === l.level ? 'var(--color-error-bg)' : 'var(--bg-card)',
                    border: selectedLevel === l.level ? `2px solid ${l.color}` : '1px solid var(--border-color)',
                  }}
                  data-testid={`level-card-${l.level}`}
                  role="button"
                  aria-label={t('w9e.criticalLevelSelector.levelAria', { label: l.label })}
                  tabIndex={0}
                >
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space>
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 10,
                          background: l.bg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <AlertTriangle size={24} color={l.color} />
                      </div>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: l.color }}>{l.label}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{l.labelEn}</div>
                      </div>
                    </Space>
                    <Space orientation="vertical" align="end" size={2}>
                      <Tag color={l.color}>P{l.priority}</Tag>
                      <Badge count={count} style={{ backgroundColor: l.color }} />
                    </Space>
                  </Space>
                  <div style={{ fontSize: 12, color: '#475569', marginTop: 10 }}>{l.description}</div>

                  <Row gutter={8} style={{ marginTop: 10 }}>
                    <Col span={12}>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        <Timer size={10} /> {t('w9e.criticalLevelSelector.responseTime')}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: l.color }}>
                        {l.responseDeadline} <span style={{ fontSize: 12 }}>{t('w9e.criticalLevelSelector.minutes')}</span>
                      </div>
                      <Progress
                        percent={Math.round(((maxDeadline - l.responseDeadline + 1) / (maxDeadline + 1)) * 100)}
                        showInfo={false}
                        strokeColor={l.color}
                        size="small"
                      />
                    </Col>
                    <Col span={12}>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        <Bell size={10} /> {t('w9e.criticalLevelSelector.statChannels')}
                      </div>
                      <div style={{ marginTop: 2 }}>
                        <Space size={3} wrap>
                          {l.defaultChannels.map((ch) => (
                            <Tag key={ch} color={CHANNEL_META[ch].color} style={{ fontSize: 12, padding: '0 4px' }}>
                              {React.createElement(CHANNEL_META[ch].icon, { size: 12 })} {CHANNEL_META[ch].label}
                            </Tag>
                          ))}
                        </Space>
                      </div>
                    </Col>
                  </Row>

                  <div
                    style={{
                      marginTop: 10,
                      padding: '6px 8px',
                      background: 'var(--bg-primary)',
                      borderRadius: 4,
                      fontSize: 12,
                      color: '#475569',
                    }}
                  >
                    <Gauge size={10} /> {t('w9e.criticalLevelSelector.monthShare')}
                    <strong style={{ color: l.color, marginLeft: 4 }}>{pct}%</strong>
                    <span style={{ marginLeft: 4, color: '#94a3b8' }}>({count}/{totalThisMonth})</span>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      ) : (
        <Card size="small">
          {orderedLevels.map((l, idx) => (
            <div
              key={l.level}
              onClick={() => onSelect?.(l.level)}
              style={{
                padding: '10px 12px',
                borderBottom: idx < orderedLevels.length - 1 ? '1px solid #f1f5f9' : 'none',
                cursor: onSelect ? 'pointer' : 'default',
                background: selectedLevel === l.level ? '#fef2f2' : 'transparent',
                borderLeft: selectedLevel === l.level ? `4px solid ${l.color}` : '4px solid transparent',
              }}
            >
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Space>
                  <AlertTriangle size={18} color={l.color} />
                  <strong style={{ color: l.color }}>{l.label}</strong>
                  <span style={{ fontSize: 12, color: '#64748b' }}>{l.labelEn}</span>
                  <Tag color={l.color}>P{l.priority}</Tag>
                </Space>
                <Space>
                  <span style={{ fontSize: 12, color: '#475569' }}>
                    <Clock size={10} /> {l.responseDeadline}min
                  </span>
                  <span style={{ fontSize: 12 }}>
                    {t('w9e.criticalLevelSelector.thisMonth')} <strong>{levelCounts[l.level] ?? 0}</strong>
                  </span>
                  <ChevronRight size={14} color="#94a3b8" />
                </Space>
              </Space>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, marginLeft: 26 }}>{l.description}</div>
            </div>
          ))}
        </Card>
      )}

      {showKPI && kpi && (
        <Card size="small" title={t('w9e.criticalLevelSelector.distribution')} style={{ marginTop: 12 }}>
          <Space orientation="vertical" style={{ width: '100%' }} size={6}>
            {LEVEL_ORDER.map((lv) => {
              const meta = orderedLevels.find((l) => l.level === lv);
              if (!meta) return null;
              const v = levelCounts[lv] ?? 0;
              const pct = totalThisMonth > 0 ? Math.round((v / totalThisMonth) * 100) : 0;
              return (
                <div key={lv}>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space>
                      <Badge color={meta.color} />
                      <span style={{ fontSize: 12 }}>{meta.label}</span>
                    </Space>
                    <span style={{ fontSize: 12 }}>
                      {v} / {totalThisMonth} ({pct}%)
                    </span>
                  </Space>
                  <Progress
                    percent={pct}
                    showInfo={false}
                    strokeColor={meta.color}
                    size="small"
                  />
                </div>
              );
            })}
          </Space>
        </Card>
      )}
    </div>
  );
};

export default CriticalValueLevelSelector;
