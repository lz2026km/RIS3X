import { useState } from "react";
import { THEME_TOKENS } from "../../components/common/ThemeTokens";
import {
  Card,
  Button,
  Typography,
  Alert,
  Input,
  Space,
  Tag,
  Descriptions,
  Divider,
  List,
  Switch,
  Steps,
  Modal,
} from "antd";
import { Shield, Smartphone, Key, QrCode, CheckCircle, Copy, Mail, MessageSquare, Eye, EyeOff, Clock, AlertTriangle } from 'lucide-react';
import { mfaApi } from "../../services/api/mfaApi";
import { message as antdMessage } from "antd";
import { t } from "../../i18n/appI18n";
import { StatCard, StatCardGrid } from "../../components/common";

const { Title, Text, Paragraph } = Typography;

export default function MfaSetupPage() {
  const [step, setStep] = useState(0);
  const [method, setMethod] = useState<"totp" | "sms" | "email">("totp");
  const [code, setCode] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [secret, setSecret] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [disableOpen, setDisableOpen] = useState(false);

  const handleStart = async () => {
    if (method !== "totp") {
      setStep(1);
      return;
    }
    setVerifying(true);
    const res = await mfaApi.setupTotp();
    setVerifying(false);
    if (res.success && res.data) {
      setSecret(res.data.secret);
      setStep(1);
    } else {
      antdMessage.error(res.error?.message || t("mfaSetup.getSecretFailed"));
    }
  };

  const handleVerify = async () => {
    if (!code || code.length < 6) {
      antdMessage.warning(t("mfaSetup.enterCode"));
      return;
    }
    setVerifying(true);
    try {
      const res = await mfaApi.verifyTotp(code);
      if (res.success && res.data?.verified) {
        setResult({ success: true, message: t("mfaSetup.verifySuccess") });
        setEnabled(true);
        setBackupCodes(res.data.backupCodes || []);
        setStep(3);
        antdMessage.success(t("mfaSetup.verifyPassed"));
      } else {
        setResult({
          success: false,
          message: res.error?.message || t("mfaSetup.invalidCode"),
        });
      }
    } catch {
      setResult({ success: false, message: t("mfaSetup.verifyFailed") });
    } finally {
      setVerifying(false);
    }
  };

  const handleToggle = async (checked: boolean) => {
    if (checked) {
      handleStart();
    } else {
      setDisableOpen(true);
    }
  };

  const handleDisable = async () => {
    if (!code || code.length < 6) {
      antdMessage.warning(t("mfaSetup.enterCurrentCode"));
      return;
    }
    setVerifying(true);
    try {
      const res = await mfaApi.disableTotp(code);
      if (res.success) {
        setEnabled(false);
        setStep(0);
        setSecret("");
        setCode("");
        setDisableOpen(false);
        antdMessage.success(t("mfaSetup.disabled"));
      } else {
        antdMessage.error(res.error?.message || t("mfaSetup.disableFailed"));
      }
    } finally {
      setVerifying(false);
    }
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join("\n"));
    antdMessage.success(t("mfaSetup.backupCopied"));
  };

  return (
    <div style={{ padding: 'var(--space-6, 24px)', maxWidth: 800, margin: "0 auto" }}>
      <Title
        level={3}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 'var(--space-2, 8px)',
          marginBottom: 'var(--space-4, 16px)',
        }}
      >
        <Shield size={22} /> {t("mfaSetup.title")}
      </Title>

      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <StatCard
          title={t("mfaSetup.currentStatus")}
          value={enabled ? t("mfaSetup.enabledTag") : t("mfaSetup.disabledTag")}
          color={enabled ? "success" : "error"}
          icon={enabled ? <Shield size={14} /> : <AlertTriangle size={14} />}
        />
        <StatCard
          title={t("mfaSetup.authMethod")}
          value={enabled ? 1 : 0}
          suffix={t("mfaSetup.methodUnit")}
          icon={<Key size={14} />}
        />
        <StatCard
          title={t("mfaSetup.lastUsed")}
          value={enabled ? t("mfaSetup.recent") : t("mfaSetup.never")}
          icon={<Clock size={14} />}
        />
      </StatCardGrid>

      <Card style={{ borderRadius: 8, marginBottom: 'var(--space-4, 16px)' }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 'var(--space-4, 16px)',
          }}
        >
          <Text strong style={{ fontSize: 14 }}>
            {t("mfaSetup.enableDisableMfa")}
          </Text>
          <Switch checked={enabled} onChange={handleToggle} />
        </div>

        <Steps
          current={step}
          style={{ marginBottom: 'var(--space-6, 24px)' }}
          items={[
            { title: t("mfaSetup.selectMethod"), icon: <Shield size={14} /> },
            { title: t("mfaSetup.configureKey"), icon: <Key size={14} /> },
            { title: t("mfaSetup.verify"), icon: <CheckCircle size={14} /> },
            { title: t("mfaSetup.done"), icon: <Smartphone size={14} /> },
          ]}
        />

        {step === 0 && (
          <div>
            <Paragraph type="secondary" style={{ marginBottom: 'var(--space-4, 16px)' }}>
              {t("mfaSetup.chooseMethod")}
            </Paragraph>
            <Space orientation="vertical" style={{ width: "100%" }}>
              <Button
                size="large"
                block
                type={method === "totp" ? "primary" : "default"}
                icon={<QrCode size={16} />}
                onClick={() => setMethod("totp")}
              >
                {t("mfaSetup.totpAuthenticator")}
              </Button>
              <Button
                size="large"
                block
                type={method === "sms" ? "primary" : "default"}
                icon={<MessageSquare size={16} />}
                onClick={() => setMethod("sms")}
              >
                {t("mfaSetup.smsCode")}
              </Button>
              <Button
                size="large"
                block
                type={method === "email" ? "primary" : "default"}
                icon={<Mail size={16} />}
                onClick={() => setMethod("email")}
              >
                {t("mfaSetup.emailCode")}
              </Button>
            </Space>
            <Divider />
            <Button type="primary" onClick={handleStart}>
              {t("mfaSetup.nextStep")}
            </Button>
          </div>
        )}

        {step === 1 && (
          <div>
            <Alert
              title={t("mfaSetup.scanHint")}
              type="info"
              showIcon
              style={{ marginBottom: 'var(--space-4, 16px)' }}
            />
            {method === "totp" && (
              <div
                style={{
                  textAlign: "center",
                  padding: 'var(--space-4, 16px)',
                  background: "var(--bg-card)",
                  borderRadius: 8,
                  marginBottom: 'var(--space-4, 16px)',
                }}
              >
                <div style={{ fontSize: 48, marginBottom: 'var(--space-3, 12px)' }}></div>
                <div
                  style={{
                    display: "inline-block",
                    padding: "12px 24px",
                    background: THEME_TOKENS.bgCard,
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    marginBottom: 'var(--space-3, 12px)',
                  }}
                >
                  {showSecret ? (
                    <Text code style={{ fontSize: 18, letterSpacing: 2 }}>
                      {secret || "—"}
                    </Text>
                  ) : (
                    <Text code style={{ fontSize: 18, letterSpacing: 2 }}>
                      {secret
                        ? `${secret.substring(0, 4)}••••••${secret.substring(secret.length - 4)}`
                        : "••••••"}
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
                    {t("mfaSetup.toggleSecretLabel", { action: showSecret ? t("mfaSetup.hide") : t("mfaSetup.show") })}
                  </Button>
                  <Button
                    type="link"
                    size="small"
                    icon={<Copy size={14} />}
                    onClick={() => {
                      navigator.clipboard.writeText(secret);
                      antdMessage.success(t("mfaSetup.keyCopied"));
                    }}
                  >
                    {t("mfaSetup.copyKey")}
                  </Button>
                </div>
                <Paragraph style={{ marginTop: 'var(--space-2, 8px)' }}>
                  <Text type="secondary">
                    {t("mfaSetup.inputSecretHint")}
                  </Text>
                </Paragraph>
              </div>
            )}
            {method === "sms" && (
              <Alert
                title={t("mfaSetup.smsSent")}
                type="success"
                showIcon
              />
            )}
            {method === "email" && (
              <Alert
                title={t("mfaSetup.emailSent")}
                type="success"
                showIcon
              />
            )}
            <Space>
              <Input
                placeholder={t("mfaSetup.enterCodePlaceholder")}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={6}
                style={{ width: 180 }}
              />
              <Button type="primary" onClick={handleVerify} loading={verifying}>
                {t("mfaSetup.verify")}
              </Button>
            </Space>
            {result && (
              <Alert
                type={result.success ? "success" : "error"}
                title={result.message}
                showIcon
                style={{ marginTop: 'var(--space-3, 12px)' }}
              />
            )}
          </div>
        )}

        {step === 3 && (
          <div>
            <Alert
              title={t("mfaSetup.enabledSuccess")}
              type="success"
              showIcon
              icon={<CheckCircle size={16} />}
              style={{ marginBottom: 'var(--space-4, 16px)' }}
            />
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label={t("mfaSetup.authMethod")}>
                <Tag color="blue">{method.toUpperCase()}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t("mfaSetup.status")}>
                <Tag color="green">{t("mfaSetup.enabledTag")}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t("mfaSetup.registeredAt")}>{t("mfaSetup.currentSession")}</Descriptions.Item>
              <Descriptions.Item label={t("mfaSetup.lastUsed")}>{t("mfaSetup.currentSession")}</Descriptions.Item>
            </Descriptions>
            <Divider />
            <Title
              level={5}
              style={{ display: "flex", alignItems: "center", gap: 'var(--space-2, 8px)' }}
            >
              {t("mfaSetup.backupCodesTitle")} <Tag color="orange">{t("mfaSetup.keepSafe")}</Tag>
            </Title>
            <Paragraph>
              <Text type="secondary">
                {t("mfaSetup.backupCodesHint")}
              </Text>
            </Paragraph>
            <List
              size="small"
              bordered
              dataSource={backupCodes}
              renderItem={(c: string) => (
                <List.Item>
                  <Text code>{c}</Text>
                </List.Item>
              )}
              style={{ maxWidth: 400, marginBottom: 'var(--space-4, 16px)' }}
            />
            <Space>
              <Button icon={<Copy size={14} />} onClick={copyBackupCodes}>
                {t("mfaSetup.copyBackupCodes")}
              </Button>
            </Space>
          </div>
        )}
      </Card>

      <Modal
        title={t("mfaSetup.disableMfaTitle")}
        open={disableOpen}
        okText={t("mfaSetup.confirmDisable")}
        okButtonProps={{ danger: true }}
        confirmLoading={verifying}
        onCancel={() => setDisableOpen(false)}
        onOk={handleDisable}
      >
        <Paragraph>
          {t("mfaSetup.disableHint")}
        </Paragraph>
        <Input
          placeholder={t("mfaSetup.enterCodePlaceholder")}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={6}
          autoFocus
        />
      </Modal>
    </div>
  );
}
