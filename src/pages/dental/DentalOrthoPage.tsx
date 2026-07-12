import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, message } from 'antd';
import { DentalPageLayout } from './DentalShared';

export const DentalOrthoPage: React.FC = () => {
  const [plans, setPlans] = useState<any[]>([]);
  useEffect(() => { fetch('/api/v1/dental/ortho/plans').then(r=>r.json()).then(d=>{if(d.success)setPlans(d.data)}).catch(()=>{}); }, []);
  return (
    <DentalPageLayout header={{ title: '正畸' }}>
      <Table dataSource={plans} rowKey="id" columns={[
        {title:'患者',dataIndex:'patientName'},{title:'诊断',dataIndex:'diagnosis'},{title:'计划',dataIndex:'plan'},
        {title:'费用',render:(_,t:any)=>'¥'+t.cost},{title:'状态',dataIndex:'status',render:(s:string)=><Tag>{s}</Tag>},
        {title:'',render:(_,t:any)=><Button size="small" onClick={()=>message.info('进度查询')}>进度</Button>},
      ]} pagination={false} />
    </DentalPageLayout>
  );
};

export default DentalOrthoPage;
