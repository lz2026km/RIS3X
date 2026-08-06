import { v4 as uuid } from 'uuid';
import type { ShareLink, ShareLinkStatus, ShareLinkScope, ShareLinkEncryption } from '../../types/portal';

const LINK_STORE = new Map<string, ShareLink>();

export class ShareLinkService {
  async createLink(params: {
    scope: ShareLinkScope;
    resourceIds: string[];
    resourceSummary: string;
    patientId: string;
    patientName: string;
    doctorId: string;
    doctorName: string;
    expiresInHours?: number;
    maxOpens?: number;
    maxDownloads?: number;
    passwordProtected?: boolean;
    passwordHint?: string;
    requirePhone?: boolean;
    requireIdCard?: boolean;
    requireFace?: boolean;
    deviceLock?: boolean;
    notifyOnOpen?: boolean;
    notifyOnDownload?: boolean;
    ipWhitelist?: string[];
    encryption?: ShareLinkEncryption;
  }): Promise<ShareLink> {
    const id = `sl-${uuid().slice(0, 8)}`;
    const shortCode = Math.random().toString(36).slice(2, 10).toUpperCase();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (params.expiresInHours ?? 24) * 3600000).toISOString();
    const link: ShareLink = {
      id,
      shortCode,
      shortUrl: `https://r.hospital.cn/r/${shortCode}`,
      qrPayload: Buffer.from(JSON.stringify({ id, shortCode, exp: expiresAt })).toString('base64'),
      encryption: params.encryption ?? 'AES-256-GCM',
      encryptionKeyId: `kms-${uuid().slice(0, 8)}`,
      scope: params.scope,
      resourceIds: params.resourceIds,
      resourceSummary: params.resourceSummary,
      patientId: params.patientId,
      patientName: params.patientName,
      doctorId: params.doctorId,
      doctorName: params.doctorName,
      status: 'active',
      createdAt: now.toISOString(),
      expiresAt,
      maxOpens: params.maxOpens ?? 5,
      maxDownloads: params.maxDownloads ?? 3,
      currentOpens: 0,
      currentDownloads: 0,
      requirePhone: params.requirePhone ?? false,
      requireIdCard: params.requireIdCard ?? false,
      requireFace: params.requireFace ?? false,
      passwordProtected: params.passwordProtected ?? false,
      passwordHint: params.passwordHint,
      watermark: `患者:${params.patientName}`,
      ipWhitelist: params.ipWhitelist,
      deviceLock: params.deviceLock ?? false,
      notifyOnOpen: params.notifyOnOpen ?? true,
      notifyOnDownload: params.notifyOnDownload ?? false,
      auditLog: [],
    };
    LINK_STORE.set(id, link);
    return link;
  }

  async getLink(id: string): Promise<ShareLink | undefined> {
    return LINK_STORE.get(id);
  }

  async resolveLink(shortCode: string): Promise<ShareLink | undefined> {
    for (const link of LINK_STORE.values()) {
      if (link.shortCode === shortCode) return link;
    }
    return undefined;
  }

  async listLinks(filters?: {
    patientId?: string;
    doctorId?: string;
    status?: ShareLinkStatus;
  }): Promise<ShareLink[]> {
    let list = [...LINK_STORE.values()];
    if (filters?.patientId) list = list.filter(l => l.patientId === filters.patientId);
    if (filters?.doctorId) list = list.filter(l => l.doctorId === filters.doctorId);
    if (filters?.status) list = list.filter(l => l.status === filters.status);
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async recordOpen(id: string, ip: string, userAgent?: string, deviceFingerprint?: string): Promise<ShareLink> {
    const link = LINK_STORE.get(id);
    if (!link) throw new Error(`Link ${id} not found`);
    link.currentOpens += 1;
    link.lastOpenedAt = new Date().toISOString();
    link.lastOpenedIp = ip;
    link.auditLog.push({
      id: `aud-${uuid().slice(0, 8)}`,
      linkId: id,
      occurredAt: new Date().toISOString(),
      action: 'opened',
      ip,
      userAgent,
      deviceFingerprint,
      result: 'success',
    });
    if (link.currentOpens >= link.maxOpens) link.status = 'exhausted';
    LINK_STORE.set(id, link);
    return link;
  }

  async recordDownload(id: string, ip: string): Promise<ShareLink> {
    const link = LINK_STORE.get(id);
    if (!link) throw new Error(`Link ${id} not found`);
    link.currentDownloads += 1;
    link.auditLog.push({
      id: `aud-${uuid().slice(0, 8)}`,
      linkId: id,
      occurredAt: new Date().toISOString(),
      action: 'downloaded',
      ip,
      result: 'success',
    });
    if (link.currentDownloads >= link.maxDownloads) link.status = 'exhausted';
    LINK_STORE.set(id, link);
    return link;
  }

  async revokeLink(id: string): Promise<ShareLink> {
    const link = LINK_STORE.get(id);
    if (!link) throw new Error(`Link ${id} not found`);
    link.status = 'revoked';
    link.auditLog.push({
      id: `aud-${uuid().slice(0, 8)}`,
      linkId: id,
      occurredAt: new Date().toISOString(),
      action: 'revoked',
      ip: 'system',
      result: 'success',
    });
    LINK_STORE.set(id, link);
    return link;
  }
}

export const shareLinkService = new ShareLinkService();
