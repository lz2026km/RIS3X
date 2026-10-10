/**
 * G005 RIS v3.0.6.11-79 - 用户中心 (W1-B, P0)
 * 个人资料卡 (authApi.getMe) + 修改密码 (authApi.changePassword) + TOTP 安全状态 + 退出登录 (authApi.logout)
 */
import { useAuth } from "../../hooks/useAuth";
import { authApi, type AuthMeDto } from "../../services/api/authApi";
import { roleLabel } from "../../services/auth/roleUtils";
import { logout as clearLocalSession } from "../../utils/auth";
import {
  Avatar,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Form,
  Input,
  Popconfirm,
  Row,
  Spin,
  Tag,
  Typography,
  Alert,
  message as antdMessage,
} from "antd";
import {
  UserRound,
  KeyRound,
  ShieldCheck,
  LogOut,
  Lock,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw } from 'lucide-react'
import { t } from "../../i18n/appI18n";

const { Title, Text } = Typography;

interface PasswordFormValues {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function UserCenterPage() {
  const navigate = useNavigate();
  const { user: localUser } = useAuth();
  const [me, setMe] = useState<AuthMeDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [form] = Form.useForm<PasswordFormValues>();

  const loadMe = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await authApi.getMe();
    if (res.success && res.data) {
      setMe(res.data);
    } else {
      setError(res.error?.message ?? t("userCenter.loadUserInfoFailed"));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  const handleChangePassword = async (values: PasswordFormValues) => {
    if (values.newPassword !== values.confirmPassword) {
      antdMessage.error(t("userCenter.passwordMismatch"));
      return;
    }
    setChanging(true);
    try {
      const res = await authApi.changePassword(
        values.oldPassword,
        values.newPassword,
      );
      if (res.success && res.data?.ok) {
        antdMessage.success(t("userCenter.passwordChanged"));
        form.resetFields();
        // 后端 change-password 会递增 tokenVersion, 当前 token 已失效, 强制重新登录
        await handleLogout(true);
      } else {
        antdMessage.error(res.error?.message ?? t("userCenter.passwordChangeFailed"));
      }
    } finally {
      setChanging(false);
    }
  };

  const handleLogout = async (silent = false) => {
    setLoggingOut(true);
    if (!silent) {
      const res = await authApi.logout();
      if (!res.success) {
        antdMessage.warning(res.error?.message ?? t("userCenter.logoutFailed"));
      }
    }
    try {
      localStorage.removeItem("ris_current_user");
    } catch {
      /* noop */
    }
    clearLocalSession();
    navigate("/login", { replace: true });
  };

  const displayName = me?.fullName || localUser?.name || me?.username || "—";
  const department =
    me?.department || localUser?.department || t("userCenter.defaultDepartment");
  const role = me?.role || localUser?.role || "—";

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 'var(--space-20, 80px)' }}>
        <Spin size="large" tip={t("userCenter.loadingUserInfo")}>
          <div style={{ minWidth: 200, minHeight: 80 }} />
        </Spin>
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--space-6, 24px)', maxWidth: 960, margin: "0 auto" }}>
      <Title
        level={3}
        style={{ display: "flex", alignItems: "center", gap: 'var(--space-2, 8px)' }}
      >
        <UserRound size={22} /> {t("userCenter.title")}
      </Title>

      {error && (
        <Alert
          type="error"
          showIcon
          message={t("userCenter.loadFailed")}
          description={error}
          action={<Button size="small" onClick={() => void loadMe()}><RefreshCw size={14} /> 
              {t("userCenter.retry")}
            </Button>
          }
          style={{ marginBottom: 'var(--space-4, 16px)' }}
        />
      )}

      <Row gutter={16}>
        <Col xs={24} lg={10}>
          <Card
            style={{ borderRadius: 8, marginBottom: 'var(--space-4, 16px)' }}
            title={t("userCenter.profile")}
            extra={
              me?.totpEnabled ? (
                <Tag color="green">{t("userCenter.totpEnabled")}</Tag>
              ) : (
                <Tag color="orange">{t("userCenter.totpDisabled")}</Tag>
              )
            }
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 'var(--space-3, 12px)',
                marginBottom: 'var(--space-5, 20px)',
              }}
            >
              <Avatar
                size={72}
                style={{ background: "var(--color-primary-600)", fontSize: 30 }}
              >
                {displayName.slice(0, 1)}
              </Avatar>
              <div style={{ textAlign: "center" }}>
                <Title level={4} style={{ margin: 0 }}>
                  {displayName}
                </Title>
                <Tag color="blue" style={{ marginTop: 6 }}>
                  {roleLabel(role)}
                </Tag>
              </div>
            </div>
            <Descriptions column={1} size="small">
              <Descriptions.Item label={t("userCenter.username")}>
                {me?.username ?? localUser?.username ?? "—"}
              </Descriptions.Item>
              <Descriptions.Item label={t("userCenter.department")}>
                {department}
              </Descriptions.Item>
              <Descriptions.Item label={t("userCenter.role")}>
                {roleLabel(role)}
              </Descriptions.Item>
              <Descriptions.Item label={t("userCenter.userId")}>
                <Text code>{me?.id ?? localUser?.id ?? "—"}</Text>
              </Descriptions.Item>
              <Descriptions.Item label={t("userCenter.totpLabel")}>
                {me?.totpEnabled ? t("userCenter.totpEnabled") : t("userCenter.totpDisabled")}
              </Descriptions.Item>
            </Descriptions>
            <Divider />
            <Popconfirm
              title={t("userCenter.logoutConfirm")}
              description={t("userCenter.logoutConfirmDesc")}
              okText={t("userCenter.logoutOk")}
              cancelText={t("userCenter.cancel")}
              okButtonProps={{ danger: true }}
              onConfirm={() => void handleLogout()}
            >
              <Button
                danger
                block
                icon={<LogOut size={16} />}
                loading={loggingOut}
              >
                {t("userCenter.logout")}
              </Button>
            </Popconfirm>
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card
            style={{ borderRadius: 8, marginBottom: 'var(--space-4, 16px)' }}
            title={
              <span style={{ display: "flex", alignItems: "center", gap: 'var(--space-2, 8px)' }}>
                <KeyRound size={16} /> {t("userCenter.changePassword")}
              </span>
            }
          >
            <Form<PasswordFormValues>
              form={form}
              layout="vertical"
              onFinish={(v) => void handleChangePassword(v)}
            >
              <Form.Item
                name="oldPassword"
                label={t("userCenter.oldPassword")}
                rules={[{ required: true, message: t("userCenter.oldPasswordRequired") }]}
              >
                <Input.Password
                  prefix={<Lock size={14} />}
                  placeholder={t("userCenter.currentPasswordPlaceholder")}
                  autoComplete="current-password"
                />
              </Form.Item>
              <Form.Item
                name="newPassword"
                label={t("userCenter.newPassword")}
                rules={[
                  { required: true, message: t("userCenter.newPasswordRequired") },
                  { min: 8, message: t("userCenter.newPasswordMin") },
                  { max: 128, message: t("userCenter.newPasswordMax") },
                ]}
              >
                <Input.Password
                  prefix={<KeyRound size={14} />}
                  placeholder={t("userCenter.newPasswordPlaceholder")}
                  autoComplete="new-password"
                />
              </Form.Item>
              <Form.Item
                name="confirmPassword"
                label={t("userCenter.confirmNewPassword")}
                dependencies={["newPassword"]}
                rules={[
                  { required: true, message: t("userCenter.confirmNewPasswordRequired") },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue("newPassword") === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error(t("userCenter.passwordMismatch")));
                    },
                  }),
                ]}
              >
                <Input.Password
                  prefix={<KeyRound size={14} />}
                  placeholder={t("userCenter.confirmNewPasswordPlaceholder")}
                  autoComplete="new-password"
                />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={changing}>
                {t("userCenter.confirmChange")}
              </Button>
            </Form>
          </Card>

          <Card
            style={{ borderRadius: 8 }}
            title={
              <span style={{ display: "flex", alignItems: "center", gap: 'var(--space-2, 8px)' }}>
                <ShieldCheck size={16} /> {t("userCenter.securityInfo")}
              </span>
            }
          >
            <Descriptions column={1} size="small">
              <Descriptions.Item label={t("userCenter.totpLabel")}>
                {me?.totpEnabled ? (
                  <Tag color="green">{t("userCenter.totpEnabled")}</Tag>
                ) : (
                  <Tag color="orange">{t("userCenter.totpDisabled")}</Tag>
                )}
              </Descriptions.Item>
            </Descriptions>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t("userCenter.sessionInvalidated")}
            </Text>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
