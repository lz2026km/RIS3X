/**
 * G005 RIS v3.0.6.11-79 - 用户中心 (W1-B, P0)
 * 个人资料卡 (authApi.getMe) + 修改密码 (authApi.changePassword) + TOTP 安全状态 + 退出登录 (authApi.logout)
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { authApi, type AuthMeDto } from "../../services/api/authApi";
import { logout as clearLocalSession } from "../../utils/auth";
import { useAuth } from "../../hooks/useAuth";
import { roleLabel } from "../../services/auth/roleUtils";

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
      setError(res.error?.message ?? "获取用户信息失败");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  const handleChangePassword = async (values: PasswordFormValues) => {
    if (values.newPassword !== values.confirmPassword) {
      antdMessage.error("两次输入的新密码不一致");
      return;
    }
    setChanging(true);
    try {
      const res = await authApi.changePassword(
        values.oldPassword,
        values.newPassword,
      );
      if (res.success && res.data?.ok) {
        antdMessage.success("密码修改成功，请使用新密码重新登录");
        form.resetFields();
        // 后端 change-password 会递增 tokenVersion, 当前 token 已失效, 强制重新登录
        await handleLogout(true);
      } else {
        antdMessage.error(res.error?.message ?? "密码修改失败");
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
        antdMessage.warning(res.error?.message ?? "登出请求失败，已清理本地会话");
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
    me?.department || localUser?.department || "放射科";
  const role = me?.role || localUser?.role || "—";

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
        <Spin size="large" tip="加载用户信息...">
          <div style={{ minWidth: 200, minHeight: 80 }} />
        </Spin>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <Title
        level={3}
        style={{ display: "flex", alignItems: "center", gap: 8 }}
      >
        <UserRound size={22} /> 个人中心
      </Title>

      {error && (
        <Alert
          type="error"
          showIcon
          message="加载失败"
          description={error}
          action={
            <Button size="small" onClick={() => void loadMe()}>
              重试
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={16}>
        <Col xs={24} lg={10}>
          <Card
            style={{ borderRadius: 8, marginBottom: 16 }}
            title="个人资料"
            extra={
              me?.totpEnabled ? (
                <Tag color="green">TOTP 已启用</Tag>
              ) : (
                <Tag color="orange">TOTP 未启用</Tag>
              )
            }
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
                marginBottom: 20,
              }}
            >
              <Avatar
                size={72}
                style={{ background: "#2563eb", fontSize: 30 }}
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
              <Descriptions.Item label="用户名">
                {me?.username ?? localUser?.username ?? "—"}
              </Descriptions.Item>
              <Descriptions.Item label="科室">
                {department}
              </Descriptions.Item>
              <Descriptions.Item label="角色">
                {roleLabel(role)}
              </Descriptions.Item>
              <Descriptions.Item label="用户ID">
                <Text code>{me?.id ?? localUser?.id ?? "—"}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="TOTP 双因素认证">
                {me?.totpEnabled ? "已启用" : "未启用"}
              </Descriptions.Item>
            </Descriptions>
            <Divider />
            <Popconfirm
              title="确认退出登录？"
              description="退出后需重新登录才能继续使用系统。"
              okText="退出"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              onConfirm={() => void handleLogout()}
            >
              <Button
                danger
                block
                icon={<LogOut size={16} />}
                loading={loggingOut}
              >
                退出登录
              </Button>
            </Popconfirm>
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card
            style={{ borderRadius: 8, marginBottom: 16 }}
            title={
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <KeyRound size={16} /> 修改密码
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
                label="旧密码"
                rules={[{ required: true, message: "请输入旧密码" }]}
              >
                <Input.Password
                  prefix={<Lock size={14} />}
                  placeholder="请输入当前密码"
                  autoComplete="current-password"
                />
              </Form.Item>
              <Form.Item
                name="newPassword"
                label="新密码"
                rules={[
                  { required: true, message: "请输入新密码" },
                  { min: 8, message: "新密码长度至少 8 位" },
                  { max: 128, message: "新密码长度不能超过 128 位" },
                ]}
              >
                <Input.Password
                  prefix={<KeyRound size={14} />}
                  placeholder="至少 8 位"
                  autoComplete="new-password"
                />
              </Form.Item>
              <Form.Item
                name="confirmPassword"
                label="确认新密码"
                dependencies={["newPassword"]}
                rules={[
                  { required: true, message: "请再次输入新密码" },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue("newPassword") === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error("两次输入的新密码不一致"));
                    },
                  }),
                ]}
              >
                <Input.Password
                  prefix={<KeyRound size={14} />}
                  placeholder="再次输入新密码"
                  autoComplete="new-password"
                />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={changing}>
                确认修改
              </Button>
            </Form>
          </Card>

          <Card
            style={{ borderRadius: 8 }}
            title={
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ShieldCheck size={16} /> 安全信息
              </span>
            }
          >
            <Descriptions column={1} size="small">
              <Descriptions.Item label="TOTP 双因素认证">
                {me?.totpEnabled ? (
                  <Tag color="green">已启用</Tag>
                ) : (
                  <Tag color="orange">未启用</Tag>
                )}
              </Descriptions.Item>
            </Descriptions>
            <Text type="secondary" style={{ fontSize: 12 }}>
              修改密码后所有已登录会话将失效，请重新登录。
            </Text>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
