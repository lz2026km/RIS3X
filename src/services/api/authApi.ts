/**
 * G005 RIS v3.0.6.11-79 - auth 端点封装
 * 对齐 backend/src/auth/auth.controller.ts:
 *   POST /auth/login   -> login()
 *   POST /auth/refresh -> refresh()
 *   GET  /auth/me      -> getMe()
 *   POST /auth/logout  -> logout()
 *   POST /auth/change-password -> changePassword()
 */
import { api } from "./client";

export interface AuthLoginData {
  token: string;
  expiresAt?: number;
  userId?: string;
  userName?: string;
  role?: string;
  title?: string;
  refreshToken?: string;
}

/** GET /auth/me 返回体 (backend AuthService.me) */
export interface AuthMeDto {
  id: string;
  username: string;
  role: string;
  fullName: string;
  totpEnabled: boolean;
  department?: string;
}

export interface ChangePasswordResult {
  ok: boolean;
}

export const authApi = {
  login: (username: string, password: string) =>
    api.post<AuthLoginData>("/auth/login", { username, password }),

  // 后端 POST /auth/refresh 使用当前有效 Bearer token, 无需请求体
  refresh: () => api.post<AuthLoginData>("/auth/refresh"),

  getMe: () => api.get<AuthMeDto>("/auth/me"),

  logout: () => api.post<void>("/auth/logout"),

  changePassword: (oldPassword: string, newPassword: string) =>
    api.post<ChangePasswordResult>("/auth/change-password", {
      oldPassword,
      newPassword,
    }),
};
