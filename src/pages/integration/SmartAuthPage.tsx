import React, { useState, useEffect, useCallback } from "react";
import {
  Card, Space, Tag, Button, Form, Input, Select, Checkbox, Alert, Descriptions, Typography, message,
} from "antd";
import { ShieldCheck, KeyRound, RefreshCw, LogOut, SearchCheck, FileJson } from "lucide-react";
import { smartAuthApi } from "../../services/api/smartAuthApi";
import { fhirApi, type FhirPatient, type SmartConfiguration } from "../../services/api/fhirApi";
import { t } from '../../i18n/appI18n';

const { Text } = Typography;

const SCOPE_OPTIONS = [
  { label: "openid", value: "openid" },
  { label: "fhirUser", value: "fhirUser" },
  { label: "patient/*.read", value: "patient/*.read" },
  { label: "patient/*.write", value: "patient/*.write" },
  { label: "launch", value: "launch" },
  { label: "launch/patient", value: "launch/patient" },
];

interface AuthForm {
  clientId: string;
  redirectUri: string;
  state: string;
  patientId?: string;
  scopes: string[];
}

interface TokenInfo {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  scope: string;
  patient?: string;
}

export const SmartAuthPage: React.FC = () => {
  const [form] = Form.useForm<AuthForm>();
  const [config, setConfig] = useState<SmartConfiguration | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  const [patients, setPatients] = useState<FhirPatient[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(false);

  const [authCode, setAuthCode] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [introspectLoading, setIntrospectLoading] = useState(false);
  const [revokeLoading, setRevokeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [introspect, setIntrospect] = useState<{ active: boolean; scope?: string; sub?: string; exp?: number } | null>(null);

  const fetchConfig = useCallback(async () => {
    setConfigLoading(true);
    setConfigError(null);
    try {
      const res = await smartAuthApi.getSmartConfiguration();
      if (res.success && res.data) {
        setConfig(res.data);
      } else {
        setConfigError(res.error?.message ?? t('smartAuth.configLoadFailed'));
      }
    } catch {
      setConfigError(t('smartAuth.configLoadFailed'));
    }
    setConfigLoading(false);
  }, []);

  const fetchPatients = useCallback(async () => {
    setPatientsLoading(true);
    try {
      const res = await fhirApi.searchPatient({ _count: "20" });
      if (res.success && res.data) {
        const bundle = res.data as { entry?: { resource: FhirPatient }[] };
        setPatients((bundle.entry ?? []).map((e) => e.resource));
      }
    } catch {
      setPatients([]);
    }
    setPatientsLoading(false);
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchPatients();
  }, [fetchConfig, fetchPatients]);

  const handleAuthorize = async () => {
    setError(null);
    try {
      const values = await form.validateFields();
      setAuthLoading(true);
      const res = await smartAuthApi.authorize({
        client_id: values.clientId,
        redirect_uri: values.redirectUri,
        scope: values.scopes.join(" "),
        state: values.state,
        patient: values.patientId,
      });
      if (res.success && res.data) {
        const match = res.data.redirectUrl.match(/[?&]code=([^&]+)/);
        const code = match ? decodeURIComponent(match[1] ?? "") : null;
        if (code) {
          setAuthCode(code);
          message.success(t('smartAuth.authSuccess'));
        } else {
          setAuthCode(null);
          setError(t('smartAuth.noCode'));
        }
      } else {
        setError(res.error?.message ?? t('smartAuth.authFailed'));
      }
    } catch (err: unknown) {
      if ((err as { errorFields?: unknown })?.errorFields) return;
      setError(t('smartAuth.authRequestFailed'));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleToken = async () => {
    if (!authCode) { message.warning(t('smartAuth.authorizeFirst')); return; }
    setError(null);
    setTokenLoading(true);
    try {
      const values = form.getFieldsValue();
      const res = await smartAuthApi.getToken(authCode, values.clientId);
      if (res.success && res.data) {
        setTokenInfo({
          accessToken: res.data.access_token,
          tokenType: res.data.token_type,
          expiresIn: res.data.expires_in,
          scope: res.data.scope,
          patient: res.data.patient,
        });
        setIntrospect(null);
        message.success(t('smartAuth.tokenSuccess'));
      } else {
        setError(res.error?.message ?? t('smartAuth.tokenFailed'));
      }
    } catch {
      setError(t('smartAuth.tokenFailed'));
    }
    setTokenLoading(false);
  };

  const handleIntrospect = async () => {
    if (!tokenInfo) { message.warning(t('smartAuth.getTokenFirst')); return; }
    setError(null);
    setIntrospectLoading(true);
    try {
      const res = await smartAuthApi.introspectToken(tokenInfo.accessToken);
      if (res.success && res.data) {
        setIntrospect(res.data);
        if (res.data.active) {
          message.success(t('smartAuth.introspectPassed'));
        } else {
          message.warning(t('smartAuth.tokenExpired'));
        }
      } else {
        setError(res.error?.message ?? t('smartAuth.introspectFailed'));
      }
    } catch {
      setError(t('smartAuth.introspectRequestFailed'));
    }
    setIntrospectLoading(false);
  };

  const handleRevoke = async () => {
    if (!tokenInfo) { message.warning(t('smartAuth.getTokenFirst')); return; }
    setError(null);
    setRevokeLoading(true);
    try {
      const res = await smartAuthApi.revokeToken(tokenInfo.accessToken);
      if (res.success) {
        message.success(t('smartAuth.tokenRevoked'));
        setTokenInfo(null);
        setIntrospect(null);
        setAuthCode(null);
      } else {
        setError(res.error?.message ?? t('smartAuth.revokeFailed'));
      }
    } catch {
      setError(t('smartAuth.revokeRequestFailed'));
    }
    setRevokeLoading(false);
  };

  return (
    <div style={{ padding: 24, background: "var(--bg-primary)",}}>
      <Space style={{ marginBottom: 16 }} wrap>
        <ShieldCheck size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('smartAuth.title')}</span>
        <Tag color="blue">SMART on FHIR</Tag>
        <Tag color="green">R4</Tag>
      </Space>

      {error && <Alert type="error" showIcon message={error} closable onClose={() => setError(null)} style={{ marginBottom: 16 }} />}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 16, marginBottom: 16 }}>
        <Card
          size="small"
          title={<Space><FileJson size={14} />{t('smartAuth.configTitle')}</Space>}
          extra={<Button size="small" icon={<RefreshCw size={12} />} onClick={fetchConfig} loading={configLoading}>{t('smartAuth.refresh')}</Button>}
        >
          {configError && <Alert type="warning" showIcon message={configError} style={{ marginBottom: 12 }} />}
          {config ? (
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label={t('smartAuth.authorizationEndpoint')}>{config.authorization_endpoint || "-"}</Descriptions.Item>
              <Descriptions.Item label={t('smartAuth.tokenEndpoint')}>{config.token_endpoint || "-"}</Descriptions.Item>
              <Descriptions.Item label={t('smartAuth.capabilities')}>
                <Space wrap size={4}>
                  {(config.capabilities ?? []).map((c) => <Tag key={c} color="cyan">{c}</Tag>)}
                </Space>
              </Descriptions.Item>
            </Descriptions>
          ) : !configError ? <Text type="secondary">{t('smartAuth.loading')}</Text> : null}
        </Card>

        <Card size="small" title={<Space><KeyRound size={14} />{t('smartAuth.authParams')}</Space>}>
          <Form form={form} layout="vertical" size="small" initialValues={{
            clientId: "g005-ris-web",
            redirectUri: "https://app.g005.local/callback",
            state: `st-${Date.now()}`,
            scopes: ["openid", "fhirUser", "patient/*.read"],
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Form.Item label={t('smartAuth.clientId')} name="clientId" rules={[{ required: true }]}>
                <Input placeholder="g005-ris-web" />
              </Form.Item>
              <Form.Item label={t('smartAuth.redirectUri')} name="redirectUri" rules={[{ required: true }]}>
                <Input placeholder="https://app.g005.local/callback" />
              </Form.Item>
              <Form.Item label={t('smartAuth.patientContext')} name="patientId">
                <Select
                  placeholder={t('smartAuth.selectPatient')}
                  allowClear
                  showSearch
                  loading={patientsLoading}
                  optionFilterProp="label"
                  options={patients.map((p) => ({
                    value: p.id ?? "",
                    label: `${p.name?.[0]?.given?.[0] ?? ""} ${p.name?.[0]?.family ?? ""} (${p.id ?? ""})`,
                  }))}
                />
              </Form.Item>
              <Form.Item label={t('smartAuth.state')} name="state">
                <Input placeholder={t('smartAuth.statePlaceholder')} />
              </Form.Item>
            </div>
            <Form.Item label={t('smartAuth.scopes')} name="scopes" rules={[{ required: true, message: t('smartAuth.scopeRequired') }]}>
              <Checkbox.Group options={SCOPE_OPTIONS} />
            </Form.Item>
            <Button type="primary" icon={<ShieldCheck size={14} />} loading={authLoading} onClick={handleAuthorize}>
              {t('smartAuth.step1')}
            </Button>
          </Form>
        </Card>
      </div>

      <Card
        size="small"
        title={<Space><KeyRound size={14} />{t('smartAuth.flow')}</Space>}
        extra={authCode && <Tag color="green">code: {authCode}</Tag>}
        style={{ marginBottom: 16 }}
      >
        <Space wrap size={12}>
          <Button
            icon={<RefreshCw size={14} />}
            loading={tokenLoading}
            disabled={!authCode}
            onClick={handleToken}
          >
            {t('smartAuth.step2')}
          </Button>
          <Button
            icon={<SearchCheck size={14} />}
            loading={introspectLoading}
            disabled={!tokenInfo}
            onClick={handleIntrospect}
          >
            {t('smartAuth.step3')}
          </Button>
          <Button
            danger
            icon={<LogOut size={14} />}
            loading={revokeLoading}
            disabled={!tokenInfo}
            onClick={handleRevoke}
          >
            {t('smartAuth.step4')}
          </Button>
        </Space>

        {tokenInfo && (
          <Descriptions column={1} size="small" bordered style={{ marginTop: 16 }}>
            <Descriptions.Item label="access_token">
              <Text code style={{ wordBreak: "break-all" }}>{tokenInfo.accessToken}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="token_type">{tokenInfo.tokenType}</Descriptions.Item>
            <Descriptions.Item label="expires_in">{tokenInfo.expiresIn}s</Descriptions.Item>
            <Descriptions.Item label={t('smartAuth.scope')}>{tokenInfo.scope}</Descriptions.Item>
            <Descriptions.Item label={t('smartAuth.patientContext')}>{tokenInfo.patient || "-"}</Descriptions.Item>
          </Descriptions>
        )}

        {introspect && (
          <Descriptions column={2} size="small" bordered style={{ marginTop: 16 }}>
            <Descriptions.Item label={t('smartAuth.status')}>
              <Tag color={introspect.active ? "green" : "red"}>{String(introspect.active)}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t('smartAuth.subject')}>{introspect.sub || "-"}</Descriptions.Item>
            <Descriptions.Item label={t('smartAuth.scope')}>{introspect.scope || "-"}</Descriptions.Item>
            <Descriptions.Item label={t('smartAuth.expiresAt')}>
              {introspect.exp ? new Date(introspect.exp * 1000).toLocaleString() : "-"}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Card>
    </div>
  );
};

export default SmartAuthPage;
