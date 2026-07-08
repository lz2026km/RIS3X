import { useState } from "react";
import {
  Card, Button, Typography, Alert, Input, Space, Tag, Descriptions,
  Divider, List, Switch, message, Steps, Row, Col, Statistic,
} from "antd";
import {
  Shield, Smartphone, Key, QrCode, CheckCircle, Copy, RefreshCw,
  Mail, MessageSquare, Eye, EyeOff, Clock, AlertTriangle,
} from "lucide-react";
import { mfaService, displaySecret } from "../../services/security";
import type { MfaEnrollment } from "../../types/security";

const { Title, Text, Paragraph } = Typography;

const MOCK_ENROLLMENT: MfaEnrollment = {
  userId: "current-user",
  methods: ["totp", "sms"],
  primaryMethod: "totp",
  totpSecret: "JBSWY3DPEHPK3PXP",
  phoneNumber: "138****1234",
  email: "user@hospital.cn",
  backupCodes: ["A1B2C3", "D4E5F6", "G7H8I9", "J0K1L2", "M3N4O5"],
  enrolledAt: "2026-06-01T08:00:00.000Z",
  lastUsedAt: "2026-07-08T08:00:00.000Z",
  enabled: true,
};

export default function MfaSetupPage() {
  const [step, setStep] = useState(0);
  const [method, setMethod] = useState<"totp" | "sms" | "email">("totp");
  const [code, setCode] = useState("");
  const [enrollment, setEnrollment] = useState<MfaEnrollment>(MOCK_ENROLLMENT);
  const [enabled, setEnabled] = useState(enrollment.enabled);
  const [showSecret, setShowSecret] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [verifying, setVerifying] = useState(false);

  const secret = enrollment.totpSecret || "JBSWY3DPEHPK3PXP";

  const handleStart = () => {
    if (method === "totp") setStep(1);
    else setStep(1);
  };

  const handleVerify = async () => {
    if (!code || code.length < 6) {
      message.warning("请输入 6 位验证码");
      return;
    }
    setVerifying(true);
    try {
      const challenge = mfaService.issueChallenge({ userId: enrollment.userId, method, ipAddress: "127.0.0.1" });
      const r = await mfaService.verifyChallenge(challenge.challengeId, code);
      if (r.success) {
        setResult({ success: true, message: "验证成功！MFA 已启用" });
        setEnrollment({ ...enrollment, enabled: true });
        setEnabled(true);
        setStep(3);
        message.success("MFA 验证通过");
      } else {
        setResult({ success: false, message: r.reason ?? "验证码错误" });
      }
    } catch {
      setResult({ success: false, message: "验证失败，请重试" });
    } finally {
      setVerifying(false);
    }
  };

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    setEnrollment({ ...enrollment, enabled: checked });
    message.success(checked ? "MFA 已启用" : "MFA 已禁用");
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(enrollment.backupCodes.join("\n"));
    message.success("备用码已复制");
  };

  const regenerateCodes = () => {
    const newCodes = mfaService.regenerateBackupCodes(enrollment.userId);
    if (newCodes) {
      setEnrollment({ ...enrollment, backupCodes: newCodes });
      message.success("备用码已重新生成");
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <Title level={3} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <Shield size={22} /> 多因素认证 (MFA) 设置
      </Title>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="当前状态"
              value={enabled ? "已启用" : "未启用"}
              valueStyle={{ color: enabled ? "#059669" : "#dc2626" }}
              prefix={enabled ? <Shield size={14} /> : <AlertTriangle size={14} />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic title="认证方式" value={enrollment.methods.length} suffix={`种`} prefix={<Key size={14} />} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="上次使用"
              value={enrollment.lastUsedAt ? new Date(enrollment.lastUsedAt).toLocaleDateString() : "从未"}
              prefix={<Clock size={14} />}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ borderRadius: 8, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <Text strong style={{ fontSize: 15 }}>启用/禁用 MFA</Text>
          <Switch checked={enabled} onChange={handleToggle} />
        </div>

        <Steps
          current={enabled && step > 0 ? step : 0}
          style={{ marginBottom: 24 }}
          items={[
            { title: "选择方式", icon: <Shield size={14} /> },
            { title: "配置密钥", icon: <Key size={14} /> },
            { title: "验证", icon: <CheckCircle size={14} /> },
            { title: "完成", icon: <Smartphone size={14} /> },
          ]}
        />

        {step === 0 && (
          <div>
            <Paragraph type="secondary" style={{ marginBottom: 16 }}>
              选择一个 MFA 方式来增强账户安全性
            </Paragraph>
            <Space direction="vertical" style={{ width: "100%" }}>
              <Button
                size="large" block
                type={method === "totp" ? "primary" : "default"}
                icon={<QrCode size={16} />}
                onClick={() => setMethod("totp")}
              >
                TOTP 验证器 (Google / Microsoft Authenticator)
              </Button>
              <Button
                size="large" block
                type={method === "sms" ? "primary" : "default"}
                icon={<MessageSquare size={16} />}
                onClick={() => setMethod("sms")}
              >
                短信验证码
              </Button>
              <Button
                size="large" block
                type={method === "email" ? "primary" : "default"}
                icon={<Mail size={16} />}
                onClick={() => setMethod("email")}
              >
                邮件验证码
              </Button>
            </Space>
            <Divider />
            <Button type="primary" onClick={handleStart} disabled={!enabled}>下一步</Button>
          </div>
        )}

        {step === 1 && (
          <div>
            <Alert
              message="使用 TOTP 验证器扫描或手动输入密钥"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            {method === "totp" && (
              <div style={{ textAlign: "center", padding: 16, background: "#fafafa", borderRadius: 8, marginBottom: 16 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📱</div>
                <div
                  style={{
                    display: "inline-block",
                    padding: "12px 24px",
                    background: "#fff",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    marginBottom: 12,
                  }}
                >
                  {showSecret ? (
                    <Text code style={{ fontSize: 18, letterSpacing: 2 }}>{displaySecret(secret)}</Text>
                  ) : (
                    <Text code style={{ fontSize: 18, letterSpacing: 2 }}>
                      {secret.substring(0, 4)}••••••{secret.substring(secret.length - 4)}
                    </Text>
                  )}
                </div>
                <div>
                  <Button
                    type="link"
                    size="small"
                    icon={showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                    onClick={() => setShowSecret(!showSecret)}
                  >
                    {showSecret ? "隐藏" : "显示"}密钥
                  </Button>
                  <Button
                    type="link"
                    size="small"
                    icon={<Copy size={14} />}
                    onClick={() => { navigator.clipboard.writeText(secret); message.success("密钥已复制"); }}
                  >
                    复制密钥
                  </Button>
                </div>
                <Paragraph style={{ marginTop: 8 }}>
                  <Text type="secondary">在验证器应用中输入此密钥或扫描二维码</Text>
                </Paragraph>
              </div>
            )}
            {method === "sms" && (
              <Alert message="短信验证码已发送至 {enrollment.phoneNumber}" type="success" showIcon />
            )}
            {method === "email" && (
              <Alert message="验证码已发送至 {enrollment.email}" type="success" showIcon />
            )}
            <Space>
              <Input
                placeholder="输入 6 位验证码"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={6}
                style={{ width: 180 }}
              />
              <Button type="primary" onClick={handleVerify} loading={verifying}>验证</Button>
            </Space>
            {result && (
              <Alert
                type={result.success ? "success" : "error"}
                message={result.message}
                showIcon
                style={{ marginTop: 12 }}
              />
            )}
          </div>
        )}

        {step === 3 && (
          <div>
            <Alert
              message="MFA 已成功启用"
              type="success"
              showIcon
              icon={<CheckCircle size={16} />}
              style={{ marginBottom: 16 }}
            />
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="认证方式">
                <Tag color="blue">{method.toUpperCase()}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color="green">已启用</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="注册时间">
                {new Date(enrollment.enrolledAt).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="上次使用">
                {enrollment.lastUsedAt ? new Date(enrollment.lastUsedAt).toLocaleString() : "从未使用"}
              </Descriptions.Item>
            </Descriptions>
            <Divider />
            <Title level={5} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              备用恢复码 <Tag color="orange">请妥善保管</Tag>
            </Title>
            <Paragraph><Text type="secondary">每个代码只能使用一次，建议保存到安全位置</Text></Paragraph>
            <List
              size="small"
              bordered
              dataSource={enrollment.backupCodes}
              renderItem={(c: string) => <List.Item><Text code>{c}</Text></List.Item>}
              style={{ maxWidth: 400, marginBottom: 16 }}
            />
            <Space>
              <Button icon={<Copy size={14} />} onClick={copyBackupCodes}>复制备用码</Button>
              <Button icon={<RefreshCw size={14} />} onClick={regenerateCodes}>重新生成</Button>
            </Space>
          </div>
        )}
      </Card>
    </div>
  );
}
