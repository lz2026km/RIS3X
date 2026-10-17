/**
 * [G005 v3.0.6.16-5] 数据源回退横幅
 *
 * 生产环境 (VITE_ALLOW_DEMO_FALLBACK=false) 下, 若后端接口失败, 页面会"保持
 * 演示数据"——本横幅把这件事**显式暴露**给用户, 避免静默展示假数据。
 *
 * 演示环境 (allowDemoFallback()===true) 不渲染 (回退是预期行为)。
 * 生产环境一旦发生接口失败即渲染, 可展开查看受影响的端点, 支持关闭。
 */
import { useEffect, useState } from 'react';
import { Alert, Button, Collapse, Tag } from 'antd';
import { AlertTriangle } from 'lucide-react';
import {
  getDemoFallbackRecords,
  subscribeDemoFallback,
  clearDemoFallbackRecords,
  type DemoFallbackRecord,
} from '../../services/api/client';
import { t } from '../../i18n/appI18n';

export function DemoFallbackBanner() {
  const [records, setRecords] = useState<DemoFallbackRecord[]>(() => getDemoFallbackRecords());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setRecords(getDemoFallbackRecords());
    return subscribeDemoFallback((next) => {
      setRecords(next);
      if (next.length > 0) setDismissed(false);
    });
  }, []);

  if (dismissed || records.length === 0) return null;

  return (
    <Alert
      type="warning"
      showIcon
      icon={<AlertTriangle size={16} />}
      style={{ margin: 'var(--space-2, 8px) var(--space-4, 16px)' }}
      data-testid="demo-fallback-banner"
      message={
        <span>
          {t('demoFallback.title', { count: records.length })}
          <Button
            type="link"
            size="small"
            onClick={() => {
              clearDemoFallbackRecords();
              setDismissed(true);
            }}
            data-testid="demo-fallback-dismiss"
          >
            {t('demoFallback.dismiss')}
          </Button>
        </span>
      }
      description={
        <Collapse
          ghost
          size="small"
          items={[
            {
              key: 'detail',
              label: t('demoFallback.detailLabel'),
              children: (
                <div style={{ maxHeight: 200, overflow: 'auto' }}>
                  {records.slice(0, 50).map((r) => (
                    <div key={`${r.url}|${r.code}`} style={{ fontSize: 12, marginBottom: 2 }}>
                      <Tag color="red">{r.code}</Tag>
                      <span style={{ fontFamily: 'monospace' }}>{r.url}</span>
                    </div>
                  ))}
                  {records.length > 50 && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {t('demoFallback.more', { count: records.length - 50 })}
                    </div>
                  )}
                </div>
              ),
            },
          ]}
        />
      }
    />
  );
}

export default DemoFallbackBanner;
