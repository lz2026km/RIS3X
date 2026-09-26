/**
 * G005 放射RIS系统 v3.0.6.5 - AI Marketplace Service (全 mock)
 * A5-AI-ORCH / 80 点
 *
 * 算法市场：浏览/安装/卸载/评分
 */

import { AI_MARKETPLACE_ALGORITHMS } from '../../../data/aiMarketplace';
import type {
  AIAlgorithm,
  AIMarketplaceFilter,
  AIMarketplaceInstall,
  AIMarketplaceListing,
  AIMarketplaceRating,
} from '../../../types/ai/orchestrator';

function uuid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const _installs: AIMarketplaceInstall[] = AI_MARKETPLACE_ALGORITHMS.filter((a) => a.installed).map((a) => ({
  id: uuid('inst'),
  algorithmId: a.id,
  userId: 'current',
  installedAt: '2026-01-15T00:00:00Z',
  config: {},
  status: 'active' as const,
}));

const _ratings: AIMarketplaceRating[] = [];

export class MarketplaceService {
  async listAlgorithms(filters: AIMarketplaceFilter = {}): Promise<AIMarketplaceListing[]> {
    await delay(120);
    let arr = [...AI_MARKETPLACE_ALGORITHMS];
    if (filters.type) arr = arr.filter((a) => a.type === filters.type);
    if (filters.modality) arr = arr.filter((a) => a.modality.includes(filters.modality ?? ''));
    if (filters.bodyPart) {
      const bp = filters.bodyPart.toLowerCase();
      arr = arr.filter((a) => a.bodyParts.some((b) => b.toLowerCase().includes(bp)));
    }
    if (filters.status) arr = arr.filter((a) => a.status === filters.status);
    if (filters.free) arr = arr.filter((a) => a.pricing.model === 'free');
    if (filters.minRating !== undefined) arr = arr.filter((a) => a.ratingAvg >= filters.minRating!);
    if (filters.search) {
      const s = filters.search.toLowerCase();
      arr = arr.filter(
        (a) => a.name.toLowerCase().includes(s) || a.vendor.toLowerCase().includes(s) || a.tags.some((t) => t.toLowerCase().includes(s)),
      );
    }
    arr.sort((a, b) => b.ratingAvg * b.ratingCount - a.ratingAvg * a.ratingCount);
    return arr.map((a, i) => ({
      algorithm: a,
      rank: i + 1,
      trending: a.installCount > 500,
      featured: i < 5,
      installTrend: Math.round(a.installCount * 0.05 * Math.random()),
    }));
  }

  async getAlgorithm(id: string): Promise<AIAlgorithm | null> {
    await delay(60);
    return AI_MARKETPLACE_ALGORITHMS.find((a) => a.id === id) ?? null;
  }

  async install(id: string, config: Record<string, unknown> = {}): Promise<AIMarketplaceInstall> {
    await delay(500 + Math.random() * 800);
    const algo = AI_MARKETPLACE_ALGORITHMS.find((a) => a.id === id);
    if (!algo) throw new Error('算法不存在');
    algo.installed = true;
    algo.installCount += 1;
    const existing = _installs.find((i) => i.algorithmId === id);
    if (existing) {
      existing.status = 'active';
      existing.config = config;
      return existing;
    }
    const inst: AIMarketplaceInstall = {
      id: uuid('inst'),
      algorithmId: id,
      userId: 'current',
      installedAt: new Date().toISOString(),
      config,
      status: 'active',
    };
    _installs.push(inst);
    return inst;
  }

  async uninstall(id: string): Promise<{ success: boolean; uninstalledAt: string }> {
    await delay(300);
    const algo = AI_MARKETPLACE_ALGORITHMS.find((a) => a.id === id);
    if (algo) algo.installed = false;
    const inst = _installs.find((i) => i.algorithmId === id);
    if (inst) inst.status = 'uninstalled';
    return { success: true, uninstalledAt: new Date().toISOString() };
  }

  async listInstalled(): Promise<AIMarketplaceInstall[]> {
    await delay(100);
    return _installs.filter((i) => i.status === 'active');
  }

  async rate(id: string, score: number, comment: string = ''): Promise<AIMarketplaceRating> {
    await delay(200);
    if (score < 1 || score > 5) throw new Error('评分必须在 1-5');
    const algo = AI_MARKETPLACE_ALGORITHMS.find((a) => a.id === id);
    if (algo) {
      const newCount = algo.ratingCount + 1;
      algo.ratingAvg = (algo.ratingAvg * algo.ratingCount + score) / newCount;
      algo.ratingCount = newCount;
    }
    const r: AIMarketplaceRating = {
      id: uuid('rate'),
      algorithmId: id,
      userId: 'current',
      userName: '当前用户',
      score,
      comment,
      createdAt: new Date().toISOString(),
    };
    _ratings.push(r);
    return r;
  }

  async listRatings(algorithmId: string): Promise<AIMarketplaceRating[]> {
    await delay(100);
    return _ratings.filter((r) => r.algorithmId === algorithmId);
  }

  async getCategories(): Promise<{ id: string; label: string; count: number }[]> {
    await delay(40);
    const map = new Map<string, number>();
    for (const a of AI_MARKETPLACE_ALGORITHMS) {
      map.set(a.type, (map.get(a.type) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([id, count]) => ({ id, label: id, count }));
  }

  async getFeatured(): Promise<AIMarketplaceListing[]> {
    const all = await this.listAlgorithms();
    return all.filter((l) => l.featured).slice(0, 6);
  }

  async getTrending(): Promise<AIMarketplaceListing[]> {
    const all = await this.listAlgorithms();
    return all.filter((l) => l.trending).slice(0, 6);
  }
}

export const marketplaceService = new MarketplaceService();
