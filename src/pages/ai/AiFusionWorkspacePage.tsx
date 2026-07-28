// [v3.0.6.8-76] 多模态AI融合工作台
import React, { useState, useEffect, useCallback } from 'react';
import { Card, Space, Tag, Table, Button, Row, Col, Statistic, Tabs, Badge, Progress, List, Tooltip, Segmented, message, Spin, Empty } from 'antd';
import { Brain, Eye, Activity, Layers, BarChart3, Crosshair, FileText, Image, Share2, Download, Sparkles } from 'lucide-react';
import { aiFusionWorkspaceApi, type FusionStudy, type AiInsight } from '../../services/api/aiFusionWorkspaceApi';

export const AiFusionWorkspacePage: React.FC = () => {
  const [modality, setModality] = useState('cbct');
  const [studies, setStudies] = useState<FusionStudy[]>([]);
  const [aiInsights, setAiInsights] = useState<AiInsight[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [studiesRes, insightsRes] = await Promise.all([
        aiFusionWorkspaceApi.getStudies(),
        aiFusionWorkspaceApi.getInsights(),
      ])
      if (studiesRes.success && Array.isArray(studiesRes.data)) {
        setStudies(studiesRes.data)
      }
      if (insightsRes.success && Array.isArray(insightsRes.data)) {
        setAiInsights(insightsRes.data)
      }
    } catch {
      message.warning('融合工作台数据加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])
  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Brain size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>Multi-modal AI Fusion Workspace</span>
        <Tag color="cyan">v3.0.6.8-76</Tag>
        <Tag color="purple">Late Fusion</Tag>
        <Tag color="volcano">Cross-Attention</Tag>
        {loading && <Spin size="small" />}
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card size="small"><Statistic title="Fusion Studies" value={studies.length} prefix={<Layers size={14}/>} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="AI Insights" value={aiInsights.length} prefix={<Sparkles size={14}/>} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Actionable Alerts" value={aiInsights.filter(i=>i.actionable).length} valueStyle={{color:'#ff4d4f'}} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Avg Fusion Score" value={studies.length > 0 ? (studies.reduce((a,s)=>a+s.fusionScore,0)/studies.length*100).toFixed(0) : '0'} suffix="%" /></Card></Col>
      </Row>
      <Segmented value={modality} onChange={setModality as any}
        options={[
          {value:'cbct', label:' CBCT'},{value:'oct', label:' OCT'},{value:'fundus', label:' Fundus'},
          {value:'fusion', label:' Fusion Overlay'},
        ]} style={{marginBottom:16}} />
      <Row gutter={16} style={{marginBottom:16}}>
        <Col span={16}>
          <Card size="small" style={{height:300,display:'flex',alignItems:'center',justifyContent:'center',background:'#000',color:'#fff'}}>
            {'[ Multi-modal Fusion Canvas Area ]'}
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title={<Space><BarChart3 size={14}/>AI Insights</Space>} style={{height:300}}>
            <List dataSource={aiInsights} renderItem={(item:any)=><List.Item style={{padding:'6px 0'}}><Tooltip title={`${item.source}: ${(item.confidence*100).toFixed(0)}%`}>
              <Space><Tag color={item.type==='lesion'?'red':item.type==='vessel'?'blue':item.type==='measurement'?'green':'orange'}>{item.type}</Tag>
              <span style={{fontSize:12}}>{item.finding}</span>
              {item.actionable && <Badge status="error" />}</Space></Tooltip></List.Item>} />
          </Card>
        </Col>
      </Row>
      <Card size="small" title={<Space><FileText size={14}/>Fusion Studies</Space>} extra={<Button icon={<Share2 size={12}/>} onClick={() => message.warning('功能建设中')}>Export Fusion Report</Button>}>
        <Table dataSource={studies} rowKey="id" pagination={false}
          columns={[
            {title:'Patient',dataIndex:'patient'},{title:'Modalities',dataIndex:'modalities'},
            {title:'Fusion Score',dataIndex:'fusionScore',render:(s:number)=><Progress percent={Math.round(s*100)} size="small" strokeColor={s>0.9?'#52c41a':s>0.8?'#faad14':'#ff4d4f'} />},
            {title:'Findings',dataIndex:'findings'},
            {title:'AI Alerts',dataIndex:'aiAlerts',render:(a:number)=><Badge count={a} size="small" />},
            {title:'Status',dataIndex:'status',render:(s:string)=><Badge status={s==='complete'?'success':'processing'} text={s} />},
            {title:'Date',dataIndex:'date'},
            {title:'Action',render:()=><Space><Button size="small" onClick={() => message.warning('功能建设中')}><Eye size={10}/>View</Button><Button size="small" onClick={() => message.warning('功能建设中')}><Download size={10}/>Download</Button></Space>},
          ]} />
      </Card>
    </div>
  );
};
export default AiFusionWorkspacePage;
