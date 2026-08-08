import { api } from "./client";

// [G005 W1-C] 已删除 /smart-auth/* 孤儿段 (listSessions/revokeSession/policies/mfa/status 共 9 方法):
//   后端仅存在 fhir/smart-auth.controller (@Controller('fhir/r4')),
//   /smart-auth/sessions、/smart-auth/policies、/smart-auth/mfa/*、/smart-auth/status 均无对应端点。
// 保留 5 个真实端点方法: getSmartConfiguration / authorize / getToken / revokeToken / introspectToken (SmartAuthPage 在用)。

export const smartAuthApi = {
  // [v3.0.6.11-50] 对接后端 POST /fhir/r4/auth/introspect (fhir/smart-auth.controller)
  introspectToken: (token: string) =>
    api.post<{ active: boolean; scope?: string; sub?: string; exp?: number }>(
      "/fhir/r4/auth/introspect",
      { token },
    ),
  // [G005 W2] SMART on FHIR 授权流程 (fhir/smart-auth.controller)
  getSmartConfiguration: () =>
    api.get<{
      authorization_endpoint: string;
      token_endpoint: string;
      capabilities: string[];
      scopes_supported?: string[];
    }>("/fhir/r4/.well-known/smart-configuration"),
  authorize: (params: {
    client_id: string;
    redirect_uri: string;
    scope: string;
    state?: string;
    patient?: string;
    encounter?: string;
    user_id?: string;
  }) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "") sp.set(k, String(v));
    });
    return api.get<{ redirectUrl: string }>(
      `/fhir/r4/auth/authorize?${sp.toString()}`,
    );
  },
  getToken: (code: string, clientId: string) =>
    api.post<{
      access_token: string;
      token_type: string;
      expires_in: number;
      scope: string;
      patient?: string;
      need_patient_banner?: boolean;
    }>("/fhir/r4/auth/token", { code, client_id: clientId }),
  revokeToken: (token: string) =>
    api.post<{ success: boolean }>("/fhir/r4/auth/revoke", { token }),
};
