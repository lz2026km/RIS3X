import { api } from "./client";

export interface SmartAuthSessionDto {
  id: string;
  userId: string;
  username: string;
  role: string;
  deviceId: string;
  deviceType: string;
  ip: string;
  loginAt: string;
  lastActivityAt: string;
  expiresAt: string;
  active: boolean;
}
export interface SmartAuthPolicyDto {
  id: string;
  name: string;
  description?: string;
  rules: SmartAuthRuleDto[];
  enabled: boolean;
  priority: number;
  createdAt: string;
}
export interface SmartAuthRuleDto {
  attribute: string;
  operator: string;
  value: string;
  action: "ALLOW" | "DENY" | "MFA" | "OTP";
}
export interface SmartAuthMfaDto {
  userId: string;
  method: "TOTP" | "SMS" | "EMAIL";
  challenge: string;
  expiresAt: string;
}
export interface SmartAuthVerifyDto {
  sessionId: string;
  code: string;
  method: "TOTP" | "SMS" | "EMAIL";
}

export const smartAuthApi = {
  listSessions: (params?: { userId?: string; active?: boolean }) => {
    const sp = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) sp.set(k, String(v));
      });
    }
    return api.get<SmartAuthSessionDto[]>(
      `/smart-auth/sessions?${sp.toString()}`,
    );
  },
  revokeSession: (id: string) => api.delete(`/smart-auth/sessions/${id}`),
  listPolicies: () => api.get<SmartAuthPolicyDto[]>("/smart-auth/policies"),
  createPolicy: (data: Partial<SmartAuthPolicyDto>) =>
    api.post<SmartAuthPolicyDto>("/smart-auth/policies", data),
  updatePolicy: (id: string, data: Partial<SmartAuthPolicyDto>) =>
    api.put<SmartAuthPolicyDto>(`/smart-auth/policies/${id}`, data),
  deletePolicy: (id: string) => api.delete(`/smart-auth/policies/${id}`),
  requestMfa: (dto: SmartAuthMfaDto) =>
    api.post<{ challengeId: string }>("/smart-auth/mfa/request", dto),
  verifyMfa: (dto: SmartAuthVerifyDto) =>
    api.post<{ verified: boolean; token?: string }>(
      "/smart-auth/mfa/verify",
      dto,
    ),
  getStatus: () =>
    api.get<{
      enabled: boolean;
      sessionCount: number;
      policyCount: number;
      mfaRequired: boolean;
    }>("/smart-auth/status"),
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
