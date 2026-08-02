/**
 * G005 放射RIS系统 v3.0.6.1 - GE Teaching Files 教学文件管理
 */
import React, { useState } from 'react'
import { Card, Tabs, Row, Col, Statistic, Space, Input } from 'antd'
import { GraduationCap, Search, Bookmark, Plus } from 'lucide-react'
import { CaseLibrary } from './CaseLibrary'
import { CaseEditor } from './CaseEditor'
import { AnnotationTool } from './AnnotationTool'

export interface TeachingCase {
  id: string
  title: string
  modality: string
  bodyPart: string
  diagnosis: string
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
  views: number
  likes: number
  tags: string[]
  createdAt: string
  author: string
}

const MOCK_CASES: TeachingCase[] = [
  { id: 'TC001', title: '不典型肺错构瘤', modality: 'CT', bodyPart: '胸部', diagnosis: '错构瘤', difficulty: 'INTERMEDIATE', views: 234, likes: 18, tags: ['孤立结节', '钙化'], createdAt: '2024-05-12', author: '陈医师' },
  { id: 'TC002', title: '脑静脉窦血栓', modality: 'MR', bodyPart: '头颅', diagnosis: '静脉窦血栓', difficulty: 'ADVANCED', views: 156, likes: 22, tags: ['急诊', '脑血管'], createdAt: '2024-04-08', author: '林医师' },
  { id: 'TC003', title: '肝脏 FNH', modality: 'MR', bodyPart: '腹部', diagnosis: '局灶性结节增生', difficulty: 'INTERMEDIATE', views: 89, likes: 7, tags: ['肝脏', '良性'], createdAt: '2024-06-01', author: '黄医师' },
]

export const TeachingFiles: React.FC = () => {
  const [activeTab, setActiveTab] = useState('library')
  const [keyword, setKeyword] = useState('')
  const [selected, setSelected] = useState<TeachingCase | null>(null)

  return (
    <div data-testid="teaching-files">
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="案例总数" value={MOCK_CASES.length} prefix={<GraduationCap size={14} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="总浏览"
              value={MOCK_CASES.reduce((s, c) => s + c.views, 0)}
              prefix={<Bookmark size={14} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="本月新增"
              value={3}
              styles={{ content: {  color: '#16a34a'  } }}
              prefix={<Plus size={14} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Input
              size="small"
              prefix={<Search size={12} />}
              placeholder="搜索案例"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </Card>
        </Col>
      </Row>

      <Card size="small" title={<Space><GraduationCap size={14} />教学案例库</Space>}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'library',
              label: '案例库',
              children: <CaseLibrary cases={MOCK_CASES} keyword={keyword} onSelect={setSelected} />,
            },
            {
              key: 'editor',
              label: '案例编辑',
              children: selected
                ? <CaseEditor caseData={selected} />
                : <CaseEditor caseData={null} />,
            },
            {
              key: 'annotation',
              label: '标注工具',
              children: <AnnotationTool />,
            },
          ]}
        />
      </Card>
    </div>
  )
}

export default TeachingFiles