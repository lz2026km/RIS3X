/**
 * G005 RIS v3.0.6.16-6 — 报告分发 API
 *
 * 背景: `ReportDeliveryPage` 此前用裸 `fetch('/api/v1/dist/tasks')` 调 3 个端点,
 * 绕过统一 client (拦截器/鉴权/演示回退/契约门禁均失效)。统一收口到此。
 */
import { api } from "./client";

export interface DistTaskDto {
  id: string;
  tenantId?: string;
  reportId: string;
  channel: string;
  target: string;
  recipient?: string | null;
  status: "pending" | "sending" | "sent" | "failed" | string;
  error?: string | null;
  retryCount?: number;
  sentAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface DistChannelDto {
  id: string;
  name: string;
  type: string;
  status: string;
  taskCount?: number;
}

export const distApi = {
  listTasks: (params?: {
    status?: string;
    channel?: string;
    reportId?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    if (params?.channel) sp.set("channel", params.channel);
    if (params?.reportId) sp.set("reportId", params.reportId);
    const qs = sp.toString();
    return api.get<DistTaskDto[]>(`/dist/tasks${qs ? `?${qs}` : ""}`);
  },
  getTask: (id: string) =>
    api.get<DistTaskDto>(`/dist/tasks/${encodeURIComponent(id)}`),
  createTask: (data: {
    reportId: string;
    channel: string;
    target?: string;
    recipient?: string;
  }) => api.post<DistTaskDto>("/dist/tasks", data),
  retryTask: (id: string) =>
    api.post<DistTaskDto>(`/dist/tasks/${encodeURIComponent(id)}/retry`),
  listChannels: () => api.get<DistChannelDto[]>("/dist/channels"),
};
