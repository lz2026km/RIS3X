/**
 * [ClinicalConfig] App 启动时一次性 bootstrap：
 *  - 加载所有 config 模块并通过 zod 校验
 *  - 成功：渲染 children
 *  - 失败：渲染 <ConfigurationErrorPage/>（Epic 风格：失败不让应用启动）
 */
import React, { useEffect, useState, type ReactNode } from "react";
import { Result, Button, Typography, Space, Alert } from "antd";
import { RotateCw, Bug } from "lucide-react";
import { THEME_TOKENS } from "../common/ThemeTokens";
import { loadAll, getBootError, reloadModule, listModules } from "@/config/clinicalConfig/bootstrap";

const { Paragraph, Text } = Typography;

type BootState = "pending" | "ready" | "error";

export const ConfigBootstrapper: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<BootState>("pending");
  const [err, setErr] = useState<Error | null>(null);

  const doLoad = async () => {
    setState("pending");
    setErr(null);
    await loadAll();
    const e = getBootError();
    if (e) {
      setErr(e);
      setState("error");
    } else {
      setState("ready");
    }
  };

  useEffect(() => {
    void doLoad();
  }, []);

  if (state === "ready") return <>{children}</>;
  if (state === "pending") {
    return (
      <div style={{ display: "grid", placeItems: "center", background: "#f0f2f5" }}>
        <Space orientation="vertical" align="center" size={12}>
          <Text type="secondary">正在加载临床配置…</Text>
        </Space>
      </div>
    );
  }
  return <ConfigurationErrorPage error={err!} onRetry={doLoad} />;
};

const ConfigurationErrorPage: React.FC<{ error: Error; onRetry: () => void }> = ({ error, onRetry }) => {
  return (
    <div style={{ display: "grid", placeItems: "center", background: "#fff2f0", padding: 24 }}>
      <Result
        status="error"
        icon={<Bug size={48} />}
        title="临床配置加载失败"
        subTitle="应用启动失败：clinicalConfig 模块加载或校验未通过"
        extra={[
          <Button key="retry" type="primary" icon={<RotateCw />} onClick={onRetry}>
            重试
          </Button>,
        ]}
        style={{ maxWidth: 720, background: THEME_TOKENS.bgCard, padding: 24, borderRadius: 8 }}
      >
        <Alert
          type="error"
          showIcon
          title={error.message}
          style={{ textAlign: "left", marginBottom: 12 }}
        />
        <Paragraph style={{ textAlign: "left" }}>
          <Text strong>Modules registered ({listModules().length}):</Text>
        </Paragraph>
        <ul style={{ textAlign: "left" }}>
          {listModules().map((m) => (
            <li key={m.id}>
              <Text code>{m.id}</Text> ({m.schemaVersion}) — {m.label}
            </li>
          ))}
        </ul>
        <Paragraph style={{ textAlign: "left", marginTop: 12 }}>
          <Text type="secondary">
            修复方法：检查 <Text code>src/config/clinicalConfig/defaults/</Text> 下对应 JSON，
            或修正 zod schema 后重试。
          </Text>
        </Paragraph>
      </Result>
    </div>
  );
};

/** Admin UI 保存配置后调用，重新加载某个模块 */
export async function reloadConfigModule(id: keyof typeof listModules extends () => infer _R ? string : string): Promise<void> {
  void id;
  // 阶段 1 仅支持 gradingScales
  await reloadModule("gradingScales");
}