import React, { useState } from 'react'
import { Tabs, Typography, Tag, Space } from 'antd'
import { GitCompare, Search } from 'lucide-react'
import { t } from '../../i18n/appI18n'
import ReportComparePanel from './ReportComparePanel'
import ReportSearchV2Panel from './ReportSearchV2Panel'

const { Text } = Typography

/**
 * [v3.0.6.11-101 Wave 8A] 报告 V2 收尾: 报告对比 V2 (F16) + 报告检索 V2 (自然语言 + 跨机构)
 * 本页两个 Tab: 报告对比 V2 / 报告检索 V2 (内部面板自带数据加载/表格/统计)
 */
const ReportComparePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('compare')

  return (
    <div style={{ padding: 24, background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <GitCompare size={20} color="#2563eb" />
        <Text style={{ fontSize: 18, fontWeight: 600 }}>{t('w8.reportCompare.title')}</Text>
        <Tag color="blue">{t('w8.reportCompare.waveTag')}</Tag>
        <Tag>{t('w8.reportCompare.subtitle')}</Tag>
      </Space>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'compare',
            label: (
              <Space size={6}>
                <GitCompare size={14} color="#2563eb" />
                <span>{t('w8.reportCompare.tabCompare')}</span>
              </Space>
            ),
            children: <ReportComparePanel />,
          },
          {
            key: 'search',
            label: (
              <Space size={6}>
                <Search size={14} color="#7c3aed" />
                <span>{t('w8.reportCompare.tabSearch')}</span>
              </Space>
            ),
            children: <ReportSearchV2Panel />,
          },
        ]}
      />
    </div>
  )
}

export default ReportComparePage
