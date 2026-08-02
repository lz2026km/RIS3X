// [v3.0.6.8-92] Phase 2: 隐形矫治模拟
// 对标: Planmeca Align + 3Shape Trios Ortho + Invisalign
import React, { useState, useEffect, useRef } from "react";
import {
  Card,
  Space,
  Tag,
  Button,
  Row,
  Col,
  Statistic,
  message,
  Badge,
  Progress,
  Steps,
  Slider,
} from "antd";
import {
  Activity,
  Eye,
  Save,
  CheckCircle2,
  RotateCcw,
  BarChart3,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Layers,
  Box,
} from "lucide-react";

export const DentalAlignerPage: React.FC = () => {
  const [plans, setPlans] = useState<any[]>([]);
  const [current, setCurrent] = useState<any>(null);
  const [stages, setStages] = useState<any[]>([]);
  const [progress, setProgress] = useState<any>(null);
  const [currentStage, setCurrentStage] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<"list" | "detail">("list");
  const animationRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetch("/api/v1/dental/ortho/aligner-plans")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setPlans(d.data || []);
      })
      .catch((err) => {
        console.error("[F04]", err);
      });
  }, []);

  const handleSelect = async (p: any) => {
    setCurrent(p);
    setCurrentStage(p.currentStage || 0);
    setMode("detail");
    try {
      const [sr, pr] = await Promise.all([
        fetch(`/api/v1/dental/ortho/aligner-plans/${p.id}/stages`).then((r) =>
          r.json(),
        ),
        fetch(`/api/v1/dental/ortho/aligner-plans/${p.id}/progress`).then((r) =>
          r.json(),
        ),
      ]);
      if (sr.success) setStages(sr.data || []);
      if (pr.success) setProgress(pr.data);
    } catch (e) {
      console.warn("[F03] Error:", (e as Error)?.message);
    }
  };

  const stageData = stages.find((s: any) => s.stage === currentStage);
  const movements = stageData?.toothMovements || [];

  // Simple Canvas animation for tooth position visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || mode !== "detail") return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width,
      h = canvas.height;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#0a0a1a";
      ctx.fillRect(0, 0, w, h);

      // Draw arch wire
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = -60; i <= 60; i++) {
        const x = w / 2 + i;
        const y = h / 2 + Math.sin(i * 0.04) * 40;
        if (i === -60) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      // Lower arch
      ctx.beginPath();
      for (let i = -60; i <= 60; i++) {
        const x = w / 2 + i;
        const y = h / 2 + 80 + Math.sin(i * 0.04 + 0.5) * 35;
        if (i === -60) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Draw teeth as circles
      const toothPositions = [
        { x: -45, y: -15 },
        { x: -30, y: -5 },
        { x: -15, y: 0 },
        { x: 0, y: 2 },
        { x: 15, y: 0 },
        { x: 30, y: -5 },
        { x: 45, y: -15 },
      ];
      movements.forEach((m: any, i: number) => {
        if (i >= toothPositions.length) return;
        const base = toothPositions[i]!;
        const tx = base.x + m.dx * 3;
        const ty = base.y + m.dy * 3;
        const size = 12 + (i >= 4 ? 2 : 0);

        ctx.save();
        ctx.translate(w / 2 + tx, h / 2 + ty - 20);
        ctx.rotate(m.rotation * 0.01);
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fillStyle = [11, 21, 31, 41].includes(m.toothNo)
          ? "#52c41a"
          : "#1677ff";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.font = "7px monospace";
        ctx.textAlign = "center";
        ctx.fillText(String(m.toothNo), 0, 3);
        ctx.restore();
      });

      ctx.fillStyle = "#666";
      ctx.font = "10px monospace";
      ctx.fillText(`Stage ${currentStage + 1}/${stages.length}`, 4, 12);
    };

    draw();

    if (playing) {
      animationRef.current = window.setTimeout(() => {
        setCurrentStage((prev) => (prev + 1) % Math.max(stages.length, 1));
      }, 800);
    }
    return () => {
      if (animationRef.current) clearTimeout(animationRef.current);
    };
  }, [currentStage, stages, movements, playing, mode]);

  if (mode === "list") {
    return (
      <div style={{ padding: 24, background: "#f5f5f5", minHeight: "100vh" }}>
        <Space style={{ marginBottom: 16 }}>
          <Activity size={20} color="#1677ff" />
          <span style={{ fontSize: 18, fontWeight: 600 }}>
            隐形矫治方案中心
          </span>
          <Tag color="cyan">v3.0.6.8-92</Tag>
          <Tag color="blue">Planmeca Align 对标</Tag>
          <Tag color="purple">Invisalign 对标</Tag>
        </Space>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={4}>
            <Card size="small">
              <Statistic title="总方案" value={plans.length} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic
                title="治疗中"
                value={
                  plans.filter((p: any) => p.status === "in-progress").length
                }
                valueStyle={{ color: "#1677ff" }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic
                title="已完成"
                value={
                  plans.filter((p: any) => p.status === "completed").length
                }
                valueStyle={{ color: "#52c41a" }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic
                title="待开始"
                value={plans.filter((p: any) => p.status === "pending").length}
                valueStyle={{ color: "#faad14" }}
              />
            </Card>
          </Col>
        </Row>
        <Row gutter={[12, 12]}>
          {plans.map((p: any) => (
            <Col span={8} key={p.id}>
              <Card
                size="small"
                hoverable
                onClick={() => handleSelect(p)}
                style={{
                  cursor: "pointer",
                  borderLeft: `4px solid ${p.status === "completed" ? "#52c41a" : p.status === "in-progress" ? "#1677ff" : "#faad14"}`,
                }}
              >
                <Space
                  style={{ justifyContent: "space-between", width: "100%" }}
                >
                  <Tag color="blue">{p.patientName}</Tag>
                  <Badge
                    status={
                      p.status === "completed"
                        ? "success"
                        : p.status === "in-progress"
                          ? "processing"
                          : "default"
                    }
                    text={p.status}
                  />
                </Space>
                <div style={{ marginTop: 4, fontSize: 12, color: "#999" }}>
                  {p.diagnosis?.slice(0, 40)}...
                  <br />
                  阶段 {p.currentStage}/{p.totalStages} | 每副{" "}
                  {p.wearDaysPerStage}天 | {p.doctor}
                </div>
                {p.status === "in-progress" && (
                  <Progress
                    percent={Math.round((p.currentStage / p.totalStages) * 100)}
                    size="small"
                    style={{ marginTop: 4 }}
                  />
                )}
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    );
  }

  const progressPct = progress
    ? Math.round((progress.currentStage / progress.totalStages) * 100)
    : 0;

  return (
    <div style={{ padding: 16, background: "#f5f5f5", minHeight: "100vh" }}>
      <Space style={{ marginBottom: 12 }}>
        <Button icon={<RotateCcw size={14} />} onClick={() => setMode("list")}>
          返回
        </Button>
        <Layers size={18} color="#1677ff" />
        <span style={{ fontSize: 16, fontWeight: 600 }}>
          {current?.patientName} - 隐形矫治方案
        </span>
        <Tag color="cyan">v3.0.6.8-92</Tag>
        <Tag color="blue">
          {current?.currentStage}/{current?.totalStages} 阶段
        </Tag>
        <Badge
          status={current?.status === "in-progress" ? "processing" : "default"}
          text={current?.status}
        />
      </Space>
      <Row gutter={12}>
        <Col span={16}>
          <Card
            size="small"
            title={
              <Space>
                <Box size={14} />
                3D 牙移动模拟
              </Space>
            }
            extra={
              <Space>
                <Button
                  size="small"
                  icon={<SkipBack size={10} />}
                  onClick={() => setCurrentStage(Math.max(0, currentStage - 1))}
                  disabled={currentStage <= 0}
                />
                <Button
                  size="small"
                  icon={playing ? <Pause size={10} /> : <Play size={10} />}
                  type={playing ? "primary" : "default"}
                  onClick={() => setPlaying(!playing)}
                />
                <Button
                  size="small"
                  icon={<SkipForward size={10} />}
                  onClick={() =>
                    setCurrentStage(
                      Math.min(stages.length - 1, currentStage + 1),
                    )
                  }
                  disabled={currentStage >= stages.length - 1}
                />
                <Slider
                  value={currentStage}
                  min={0}
                  max={Math.max(stages.length - 1, 1)}
                  step={1}
                  onChange={(v) => setCurrentStage(v)}
                  style={{ width: 120, margin: "0 8px" }}
                />
              </Space>
            }
          >
            <canvas
              ref={canvasRef}
              width={480}
              height={320}
              style={{ width: "100%", height: 280, borderRadius: 8 }}
            />
          </Card>
          <Card
            size="small"
            title={
              <Space>
                <BarChart3 size={14} />
                阶段详情
              </Space>
            }
            style={{ marginTop: 8 }}
          >
            <Row gutter={8}>
              <Col span={6}>
                <Statistic
                  title="阶段编号"
                  value={`${currentStage + 1}/${stages.length}`}
                />
              </Col>
              <Col span={6}>
                <Statistic title="牙齿移动数" value={movements.length} />
              </Col>
              <Col span={6}>
                <Statistic
                  title="佩戴天数"
                  value={current?.wearDaysPerStage || 7}
                  suffix="天"
                />
              </Col>
              <Col span={6}>
                <Statistic title="完成度" value={progressPct} suffix="%" />
              </Col>
            </Row>
            {movements.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {movements.slice(0, 8).map((m: any) => (
                  <Tag key={m.toothNo} color="blue" style={{ marginBottom: 2 }}>
                    #{m.toothNo}: dx={m.dx.toFixed(1)} dy={m.dy.toFixed(1)} rot=
                    {m.rotation.toFixed(1)}°
                  </Tag>
                ))}
              </div>
            )}
          </Card>
        </Col>
        <Col span={8}>
          <Card
            size="small"
            title={
              <Space>
                <Eye size={14} />
                治疗概览
              </Space>
            }
          >
            {progress && (
              <>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "#999" }}>依从性 </span>
                  <Progress
                    percent={Math.round(progress.patientCompliance * 100)}
                    size="small"
                    strokeColor={
                      progress.patientCompliance > 0.85 ? "#52c41a" : "#faad14"
                    }
                  />
                </div>
                <Tag
                  color={
                    progress.trackingQuality === "good"
                      ? "green"
                      : progress.trackingQuality === "fair"
                        ? "orange"
                        : "red"
                  }
                >
                  {progress.trackingQuality === "good"
                    ? "追踪良好"
                    : progress.trackingQuality === "fair"
                      ? "一般"
                      : "需警惕"}
                </Tag>
                <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
                  当前阶段已佩戴: {progress.lastStageWornDays}天<br />
                  下一阶段: {progress.nextStageDate}
                </div>
                {progress.refinementSuggested && (
                  <Tag color="red" style={{ marginTop: 4 }}>
                    建议精调 ({progress.refinementCount}次)
                  </Tag>
                )}
              </>
            )}
          </Card>
          <Card
            size="small"
            title={
              <Space>
                <Save size={14} />
                附件 & IPR
              </Space>
            }
            style={{ marginTop: 8 }}
          >
            <div style={{ fontSize: 12 }}>
              <b>附件 ({current?.attachments?.length || 0}个)</b>
              {current?.attachments?.map((a: any, i: number) => (
                <Tag key={i} color="purple" style={{ margin: 2 }}>
                  #{a.toothNo} {a.type}
                </Tag>
              ))}
            </div>
            <div style={{ marginTop: 6, fontSize: 12 }}>
              <b>IPR (邻面去釉)</b>
              {current?.ipr?.map((i: any, idx: number) => (
                <Tag key={idx} color="orange" style={{ margin: 2 }}>
                  #{i.toothNo} {i.amount}mm
                </Tag>
              ))}
            </div>
          </Card>
          <Card size="small" title="操作" style={{ marginTop: 8 }}>
            <Space direction="vertical" style={{ width: "100%" }}>
              <Button
                block
                icon={<CheckCircle2 size={14} />}
                onClick={async () => {
                  await fetch(
                    `/api/v1/dental/ortho/aligner-plans/${current.id}/approve`,
                    { method: "POST" },
                  );
                  message.success("方案已审批");
                }}
              >
                审批方案
              </Button>
              <Button
                block
                icon={<Save size={14} />}
                onClick={async () => {
                  await fetch(
                    `/api/v1/dental/ortho/aligner-plans/${current.id}/order-lab`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        lab: "AlignTech",
                        quantity: 6,
                        shippingMethod: "express",
                      }),
                    },
                  );
                  message.success("已提交加工厂");
                }}
              >
                提交加工 (6副)
              </Button>
            </Space>
          </Card>
          <Steps
            direction="vertical"
            size="small"
            current={currentStage}
            items={stages
              .slice(0, Math.min(8, stages.length))
              .map((_: any, i: number) => ({
                title: `第${i + 1} 副`,
                description: i <= currentStage ? "已佩戴" : "待佩戴",
              }))}
            style={{ marginTop: 8 }}
          />
        </Col>
      </Row>
    </div>
  );
};
export default DentalAlignerPage;
