import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tag, Button, Space, Input, Table, Badge } from "antd";
import { Image, Search, Eye } from "lucide-react";
import EyeLateralityBadge from "@/components/eye/EyeLateralityBadge";
import { MOCK_EYE_STUDIES } from "@/data/eyePacsMock";
import { PageContainer, PageHeader } from "@/components/common";

const MODALITY_LABELS: Record<string, string> = {
  oct_a: "OCTA",  corneal_endothelium: "角膜内皮",  tear_film: "泪膜",  fundus_autofluorescence: "眼底自发荧光",  fundus_photo: "眼底彩照",
  oct: "OCT",
  ffa: "FFA",
  icga: "ICGA",
  visual_field: "视野",
  topography: "角膜地形图",
  pentacam: "Pentacam",
  iol_master: "IOL Master",
  ubm: "UBM",
  slit_lamp: "裂隙灯",
  borderline: "临界",
  cup_to_disc_ratio: "杯盘比",
  rim_width: "视盘缘宽度",
  arteriovenous_ratio: "动静脉比",
  abnormal: "异常",
  v6: "v6",
  text: "文本",
  findings_multi: "多发发现",
  images: "图像",
  productivity: "生产力",
  clinical: "临床",
  operational: "运营",
  financial: "财务",
  critical_value: "危急值",
  pending_review: "待审核",
};

const PacsStudyListPage: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const studies = search
    ? MOCK_EYE_STUDIES.filter(
        (s) => s.patientName.includes(search) || s.patientId.includes(search),
      )
    : MOCK_EYE_STUDIES;

  const columns = [
    { title: "患者", dataIndex: "patientName", key: "patientName", width: 90 },
    { title: "ID", dataIndex: "patientId", key: "patientId", width: 80 },
    {
      title: "眼别",
      dataIndex: "eyeSide",
      key: "eyeSide",
      width: 80,
      render: (v: string) => (
        <EyeLateralityBadge eyeSide={v as any} size="small" />
      ),
    },
    {
      title: "检查类型",
      dataIndex: "modality",
      key: "modality",
      width: 100,
      render: (v: string) => (
        <Tag color="cyan" style={{ fontSize: 12 }}>
          {MODALITY_LABELS[v] || v}
        </Tag>
      ),
    },
    {
      title: "检查日期",
      dataIndex: "studyDate",
      key: "studyDate",
      width: 140,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: "设备",
      dataIndex: "device",
      key: "device",
      width: 160,
      ellipsis: true,
    },
    {
      title: "影像数",
      dataIndex: "images",
      key: "images",
      width: 70,
      render: (v: any[]) => <Tag>{v.length}</Tag>,
    },
    {
      title: "危急",
      dataIndex: "criticalFlag",
      key: "criticalFlag",
      width: 50,
      render: (v: boolean) => v && <Badge dot color="#ef4444" />,
    },
    {
      title: "",
      key: "action",
      width: 80,
      render: (_, record) => (
        <Space size={4}>
          <Button
            size="small"
            type="primary"
            icon={<Eye className="v4-icon" />}
            onClick={() => navigate(`/eye/pacs/viewer?studyId=${record.id}`)}
          >
            查看
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer background="slate" maxWidth="full" padding={16} testId="pacs-study-list-page">
      <PageHeader
        title="眼科影像中心 (PACS)"
        icon={<Image className="v4-icon" style={{ width: 24, height: 24, color: "#1677ff" }} />}
        variant="inline"
        actions={
          <>
            <Tag color="blue">{studies.length} 个检查</Tag>
            <Input
              prefix={<Search className="v4-icon" />}
              placeholder="搜索患者/ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 240 }}
            />
          </>
        }
      />

      <Table
        dataSource={studies}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={false}
      />
    </PageContainer>
  );
};

export default PacsStudyListPage;
