/**
 * G005 放射RIS系统 v3.0.6.1 - GE Centricity 典型病例教学库入口
 * 对标:GE Teaching Files / RADLEX - 影像所见 / 诊断 / 教学要点 案例库
 */
import React, { useState, useEffect } from 'react'
import { Card, Table, Statistic, Row, Col, Tag, Progress, Empty } from 'antd'

interface TeachingCase {
  id: string
  title: string
  modality: string
  bodyPart: string
  diagnosis: string
  imagingFindings: string
  teachingPoints: string[]
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
  views: number
  likes: number
  tags: string[]
  createdAt: string
  author: string
}

const MOCK_CASES: TeachingCase[] = [
  {
    id: 'TC001',
    title: '不典型肺错构瘤伴爆米花样钙化',
    modality: 'CT',
    bodyPart: '胸部',
    diagnosis: '肺错构瘤(chondroid hamartoma)',
    imagingFindings: '右肺下叶背段边界清晰结节,直径约 1.8 cm,内见典型爆米花样钙化及脂肪密度,边缘光滑,无毛刺、无胸膜凹陷征。',
    teachingPoints: ['爆米花样钙化 + 脂肪密度 = 错构瘤典型征象', '无需活检,可年度随访', '与硬化性肺细胞瘤、类癌鉴别要点'],
    difficulty: 'INTERMEDIATE',
    views: 234,
    likes: 18,
    tags: ['孤立结节', '钙化', '良性'],
    createdAt: '2024-05-12',
    author: '陈医师',
  },
  {
    id: 'TC002',
    title: '脑静脉窦血栓形成 MRV 表现',
    modality: 'MR',
    bodyPart: '头颅',
    diagnosis: '上矢状窦静脉血栓(CVST)',
    imagingFindings: 'MRV 显示上矢状窦、双侧横窦血流信号缺失;SWI 见皮层静脉多发点状低信号;T1 等信号、T2 高信号血栓填充。',
    teachingPoints: ['产褥期女性突发头痛需警惕 CVST', 'MRV + SWI 联合诊断敏感性高', 'D-二聚体升高、眼底水肿支持诊断'],
    difficulty: 'ADVANCED',
    views: 156,
    likes: 22,
    tags: ['急诊', '脑血管', 'SWI'],
    createdAt: '2024-04-08',
    author: '林医师',
  },
  {
    id: 'TC003',
    title: '肝脏局灶性结节增生(FNH) EOB-MRI 表现',
    modality: 'MR',
    bodyPart: '腹部',
    diagnosis: 'FNH(局灶性结节增生)',
    imagingFindings: '肝右叶 S6 段边界欠清结节,T2 等信号,动脉期明显强化,门脉期及延迟期呈等信号;肝胆期病灶呈等/稍高信号(典型 FNH 表现);中央可见星状瘢痕。',
    teachingPoints: ['EOB-MRI 肝胆期摄取是 FNH 关键证据', '中央星状瘢痕 + T2 高信号', '与 HCC、肝腺瘤鉴别要点'],
    difficulty: 'INTERMEDIATE',
    views: 89,
    likes: 7,
    tags: ['肝脏', 'EOB-MRI', '良性'],
    createdAt: '2024-06-01',
    author: '黄医师',
  },
  {
    id: 'TC004',
    title: '急性主动脉夹层 Stanford A 型 CTA',
    modality: 'CT',
    bodyPart: '胸腹主动脉',
    diagnosis: 'Stanford A 型主动脉夹层',
    imagingFindings: '升主动脉见内膜片,真假双腔,假腔大于真腔;累及主动脉弓及降主动脉,累及左锁骨下动脉开口;心包少量积液。',
    teachingPoints: ['Stanford A 型需急诊外科手术', 'CTA 是首选影像检查', '心包积液提示可能破裂,死亡率极高'],
    difficulty: 'ADVANCED',
    views: 412,
    likes: 56,
    tags: ['危急值', '血管', '急诊'],
    createdAt: '2024-03-20',
    author: '陈医师',
  },
  {
    id: 'TC005',
    title: '新生儿缺血缺氧性脑病(HIE) MRI 分度',
    modality: 'MR',
    bodyPart: '头颅',
    diagnosis: '新生儿 HIE 中度',
    imagingFindings: '双侧大脑半球皮层及皮层下白质 DWI 高信号,ADC 值减低;累及中央沟周围、基底节区;MRS 可见 Lac 峰升高。',
    teachingPoints: ['DWI 在 HIE 早期敏感性最高(24-72h)', '基底节/丘脑受累提示中-重度', '预后评估需结合 MRS 与临床'],
    difficulty: 'BEGINNER',
    views: 78,
    likes: 5,
    tags: ['新生儿', 'DWI', '急诊'],
    createdAt: '2024-06-10',
    author: '黄医师',
  },
  {
    id: 'TC006',
    title: '胰腺导管腺癌(PDAC) 胰腺期增强表现',
    modality: 'CT',
    bodyPart: '腹部',
    diagnosis: '胰腺导管腺癌(胰头)',
    imagingFindings: '胰头部低密度肿块,直径约 3.2 cm,胰腺期强化明显低于周围胰腺实质;主胰管扩张(5 mm);胆总管轻度扩张;周围脂肪间隙模糊,肠系膜上静脉可疑受侵。',
    teachingPoints: ['胰腺期低强化是 PDAC 关键征象', '主胰管截断 + 双管征', '可切除性评估需关注血管侵犯'],
    difficulty: 'INTERMEDIATE',
    views: 167,
    likes: 14,
    tags: ['胰腺', '肿瘤', '增强'],
    createdAt: '2024-05-25',
    author: '林医师',
  },
]

const DIFFICULTY_META: Record<TeachingCase['difficulty'], { color: string; label: string }> = {
  BEGINNER: { color: 'green', label: '初级' },
  INTERMEDIATE: { color: 'blue', label: '中级' },
  ADVANCED: { color: 'red', label: '高级' },
}

const Teach: React.FC = () => {
  const [tick, setTick] = useState<number>(0)
  const [filterDifficulty, setFilterDifficulty] = useState<string>('ALL')
  const [filterModality, setFilterModality] = useState<string>('ALL')

  useEffect(() => {
    const t = window.setInterval(() => setTick((x) => x + 1), 60000)
    return () => window.clearInterval(t)
  }, [])

  const total = MOCK_CASES.length
  const totalViews = MOCK_CASES.reduce((s, c) => s + c.views, 0)
  const totalLikes = MOCK_CASES.reduce((s, c) => s + c.likes, 0)
  const newThisMonth = MOCK_CASES.filter((c) => c.createdAt >= '2024-06-01').length
  const avgViews = total ? Math.round(totalViews / total) : 0

  const filteredCases = MOCK_CASES.filter((c) => {
    if (filterDifficulty !== 'ALL' && c.difficulty !== filterDifficulty) return false
    if (filterModality !== 'ALL' && c.modality !== filterModality) return false
    return true
  })

  const difficultyStats = (['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const).map((d) => {
    const items = MOCK_CASES.filter((c) => c.difficulty === d)
    return {
      key: d,
      count: items.length,
      pct: total ? Math.round((items.length / total) * 100) : 0,
    }
  })

  const modalityStats = ['CT', 'MR', 'DR'].map((m) => {
    const items = MOCK_CASES.filter((c) => c.modality === m)
    return {
      modality: m,
      count: items.length,
      pct: total ? Math.round((items.length / total) * 100) : 0,
    }
  })

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
    {
      title: '案例标题',
      dataIndex: 'title',
      key: 'title',
      width: 240,
      render: (t: string) => <strong>{t}</strong>,
    },
    {
      title: '检查',
      key: 'exam',
      width: 130,
      render: (_: unknown, r: TeachingCase) => (
        <Tag color="blue">
          {r.modality} {r.bodyPart}
        </Tag>
      ),
    },
    { title: '诊断', dataIndex: 'diagnosis', key: 'diagnosis', width: 200 },
    {
      title: '难度',
      dataIndex: 'difficulty',
      key: 'difficulty',
      width: 90,
      render: (d: TeachingCase['difficulty']) => <Tag color={DIFFICULTY_META[d].color}>{DIFFICULTY_META[d].label}</Tag>,
    },
    {
      title: '教学要点',
      key: 'points',
      width: 260,
      render: (_: unknown, r: TeachingCase) => (
        <ul style={{ paddingLeft: 16, margin: 0, fontSize: 12, color: '#475569' }}>
          {r.teachingPoints.map((p, idx) => (
            <li key={idx}>{p}</li>
          ))}
        </ul>
      ),
    },
    {
      title: '标签',
      key: 'tags',
      width: 180,
      render: (_: unknown, r: TeachingCase) => (
        <span>
          {r.tags.map((t) => (
            <Tag key={t} color="geekblue">
              {t}
            </Tag>
          ))}
        </span>
      ),
    },
    {
      title: '互动',
      key: 'interact',
      width: 150,
      render: (_: unknown, r: TeachingCase) => (
        <div style={{ fontSize: 12 }}>
          <div>👁 浏览 {r.views}</div>
          <div>👍 点赞 {r.likes}</div>
        </div>
      ),
    },
    { title: '作者', dataIndex: 'author', key: 'author', width: 90 },
    { title: '创建日期', dataIndex: 'createdAt', key: 'createdAt', width: 110 },
  ]

  return (
    <div data-testid="teach-root">
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={5}>
          <Card size="small">
            <Statistic title="案例总数" value={total} valueStyle={{ color: '#3b82f6' }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic title="总浏览" value={totalViews} valueStyle={{ color: '#16a34a' }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic title="总点赞" value={totalLikes} valueStyle={{ color: '#f59e0b' }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic title="平均浏览" value={avgViews} valueStyle={{ color: '#8b5cf6' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="本月新增" value={newThisMonth} valueStyle={{ color: '#dc2626' }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={8}>
          <Card size="small" title="难度分布">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {difficultyStats.map((d) => (
                <div key={d.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                    <Tag color={DIFFICULTY_META[d.key as TeachingCase['difficulty']].color}>
                      {DIFFICULTY_META[d.key as TeachingCase['difficulty']].label}
                    </Tag>
                    <span style={{ color: '#64748b' }}>{d.count} 例 ({d.pct}%)</span>
                  </div>
                  <Progress percent={d.pct} size="small" showInfo={false} />
                </div>
              ))}
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title="模态分布">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {modalityStats.map((m) => (
                <div key={m.modality}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                    <Tag color="blue">{m.modality}</Tag>
                    <span style={{ color: '#64748b' }}>{m.count} 例 ({m.pct}%)</span>
                  </div>
                  <Progress percent={m.pct} size="small" showInfo={false} strokeColor="#3b82f6" />
                </div>
              ))}
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title="筛选器">
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>难度</div>
              <select
                value={filterDifficulty}
                onChange={(e) => setFilterDifficulty(e.target.value)}
                style={{ width: '100%', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4 }}
              >
                <option value="ALL">全部难度</option>
                <option value="BEGINNER">初级</option>
                <option value="INTERMEDIATE">中级</option>
                <option value="ADVANCED">高级</option>
              </select>
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>检查模态</div>
              <select
                value={filterModality}
                onChange={(e) => setFilterModality(e.target.value)}
                style={{ width: '100%', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4 }}
              >
                <option value="ALL">全部模态</option>
                <option value="CT">CT</option>
                <option value="MR">MR</option>
                <option value="DR">DR</option>
              </select>
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>教学库同步 tick={tick}</div>
          </Card>
        </Col>
      </Row>

      <Card size="small" title="典型病例库">
        <Table<TeachingCase>
          rowKey="id"
          size="small"
          dataSource={filteredCases}
          columns={columns}
          pagination={{ pageSize: 8 }}
          locale={{ emptyText: <Empty description="暂无匹配病例" /> }}
          scroll={{ x: 1400 }}
          expandable={{
            expandedRowRender: (record) => (
              <div style={{ padding: 8, background: '#f8fafc', borderRadius: 4 }}>
                <div style={{ fontSize: 12, color: '#0f172a', marginBottom: 6 }}>
                  <strong>影像所见:</strong>{record.imagingFindings}
                </div>
                <div style={{ fontSize: 12, color: '#0f172a' }}>
                  <strong>最终诊断:</strong>
                  <Tag color="purple" style={{ marginLeft: 6 }}>
                    {record.diagnosis}
                  </Tag>
                </div>
              </div>
            ),
          }}
        />
      </Card>
    </div>
  )
}

export default Teach