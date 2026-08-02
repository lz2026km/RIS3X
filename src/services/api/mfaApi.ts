import { api } from "./client";

export interface TotpSetupResponse {
  secret: string;
  qrCodeUrl?: string;
}

export interface TotpVerifyResponse {
  verified: boolean;
  backupCodes?: string[];
}

export const mfaApi = {
  verifyTotp: (token: string) =>
    api.post<TotpVerifyResponse>("/auth/totp/verify", { token }),

  setupTotp: () => api.post<TotpSetupResponse>("/auth/totp/setup"),

  disableTotp: (token: string) =>
    api.post<void>("/auth/totp/disable", { token }),
};
