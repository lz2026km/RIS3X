import React, { useState } from 'react'
import { Tabs, Typography, Tag, Space } from 'antd'
import { ShieldAlert, Users, Star } from 'lucide-react'
import { t } from '../../i18n/appI18n'
import SecondReadPanel from './SecondReadPanel'
import ConsultationV2Panel from './ConsultationV2Panel'
import PeerReviewPanel from './PeerReviewPanel'

const { Text } = Typography

/**
 * [v3.0.6.11-101 Wave 7C] 报告 V2 — AI 二次检出 V2 (F14) + 委员会会诊 V2 (F6) + 报告互评 (F9)
 * 三面板合一页三 Tab: 定稿前 AI 复查 / 多人合议会诊 / 科室互评
 * @deprecated [v3.0.6.11-104 Wave 5A] 报告书写入口已收敛至 ReportWritePage; 旧路由 /report-v2/workbench redirect → /write-report。
 *   子面板(SecondReadPanel/ConsultationV2Panel/PeerReviewPanel)保留供 ReportWritePage 复用，本页保留仅作参考/回退。
 */
const ReportV2Page: React.FC = () => {
  const [activeTab, setActiveTab] = useState('second-read')

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <ShieldAlert size={20} color="var(--color-primary-600)" />
        <Text style={{ fontSize: 18, fontWeight: 600 }}>{t('reportV2.title')}</Text>
        <Tag color="blue">{t('reportV2.wave')}</Tag>
        <Tag>{t('reportV2.subtitle')}</Tag>
      </Space>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'second-read',
            label: (
              <Space size={6}>
                <ShieldAlert size={14} color="var(--color-primary-600)" />
                <span>{t('reportV2.tabSecondRead')}</span>
              </Space>
            ),
            children: <SecondReadPanel />,
          },
          {
            key: 'consultation',
            label: (
              <Space size={6}>
                <Users size={14} color="#7c3aed" />
                <span>{t('reportV2.tabConsultation')}</span>
              </Space>
            ),
            children: <ConsultationV2Panel />,
          },
          {
            key: 'peer-review',
            label: (
              <Space size={6}>
                <Star size={14} color="var(--color-warning-500)" />
                <span>{t('reportV2.tabPeerReview')}</span>
              </Space>
            ),
            children: <PeerReviewPanel />,
          },
        ]}
      />
    </div>
  )
}

export default ReportV2Page
