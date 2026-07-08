/**
 * G005 放射RIS系统 v3.0.6.5 - 医学词汇管理器
 * 30 升级点:自定义词典 / 拼音提示 / 权重调整 / 索引缓存
 */

import { MEDICAL_VOCABULARY } from '../../data/voice/medicalVocabulary';
import type { MedicalTerm, VocabCategory, CustomDictionary } from '../../types/voice';

const STORAGE_KEY = 'g005-voice-vocab-dictionaries';
const USAGE_KEY = 'g005-voice-vocab-usage';

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined' || !window.localStorage) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* noop */
  }
}

function newId(): string {
  return 'dict-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 9999).toString(36);
}

export class VocabularyManager {
  private dictionaries: CustomDictionary[] = [];
  private usageCount: Record<string, number> = {};
  private termIndex: Map<string, MedicalTerm> = new Map();
  private pinyinIndex: Map<string, Set<string>> = new Map();
  private initialIndex: Map<string, Set<string>> = new Map();

  constructor() {
    this.load();
    this.rebuildIndex();
  }

  private load(): void {
    this.dictionaries = readJson<CustomDictionary[]>(STORAGE_KEY, []);
    this.usageCount = readJson<Record<string, number>>(USAGE_KEY, {});
  }

  private persist(): void {
    writeJson(STORAGE_KEY, this.dictionaries);
    writeJson(USAGE_KEY, this.usageCount);
  }

  private rebuildIndex(): void {
    this.termIndex.clear();
    this.pinyinIndex.clear();
    this.initialIndex.clear();
    const all = this.getAllTerms();
    all.forEach((term) => {
      if (!term.enabled) return;
      this.termIndex.set(term.term, term);
      (term.synonyms ?? []).forEach((s) => this.termIndex.set(s, term));
      if (term.pinyin) {
        const norm = term.pinyin.replace(/\s+/g, '').toLowerCase();
        if (!this.pinyinIndex.has(norm)) this.pinyinIndex.set(norm, new Set());
        this.pinyinIndex.get(norm)!.add(term.id);
      }
      if (term.pinyinInitials) {
        const norm = term.pinyinInitials.toLowerCase();
        if (!this.initialIndex.has(norm)) this.initialIndex.set(norm, new Set());
        this.initialIndex.get(norm)!.add(term.id);
      }
    });
  }

  // ---------- 公共 API ----------

  getAllTerms(): MedicalTerm[] {
    const custom: MedicalTerm[] = [];
    this.dictionaries.forEach((d) => {
      if (d.active) custom.push(...d.terms.filter((t) => t.enabled));
    });
    return [...MEDICAL_VOCABULARY.filter((t) => t.enabled), ...custom];
  }

  getTermsByCategory(category: VocabCategory): MedicalTerm[] {
    return this.getAllTerms().filter((t) => t.category === category);
  }

  getTermsByModality(modality: string): MedicalTerm[] {
    return this.getAllTerms().filter((t) => t.modality.includes(modality as never));
  }

  getTermsByBodyPart(bodyPart: string): MedicalTerm[] {
    return this.getAllTerms().filter((t) => t.bodyPart.includes(bodyPart));
  }

  search(query: string, limit = 20): MedicalTerm[] {
    if (!query) return [];
    const q = query.trim().toLowerCase();
    const all = this.getAllTerms();
    const results: Array<{ term: MedicalTerm; score: number }> = [];
    all.forEach((term) => {
      let score = 0;
      if (term.term.toLowerCase() === q) score += 100;
      if (term.term.toLowerCase().includes(q)) score += 50;
      if (term.fullTerm.toLowerCase().includes(q)) score += 40;
      if ((term.pinyin ?? '').replace(/\s+/g, '').toLowerCase().includes(q.replace(/\s+/g, ''))) score += 60;
      if ((term.pinyinInitials ?? '').toLowerCase().startsWith(q)) score += 70;
      if (term.en && term.en.toLowerCase().includes(q)) score += 30;
      (term.synonyms ?? []).forEach((s) => {
        if (s.toLowerCase().includes(q)) score += 20;
      });
      if (score > 0) {
        score += term.weight * 0.1;
        score += Math.log2((term.usageCount ?? 0) + 1) * 2;
        results.push({ term, score });
      }
    });
    return results.sort((a, b) => b.score - a.score).slice(0, limit).map((r) => r.term);
  }

  findByExactTerm(text: string): MedicalTerm | undefined {
    return this.termIndex.get(text);
  }

  recordUsage(termId: string): void {
    this.usageCount[termId] = (this.usageCount[termId] ?? 0) + 1;
    const dictTerm = this.dictionaries.flatMap((d) => d.terms).find((t) => t.id === termId);
    if (dictTerm) {
      dictTerm.usageCount = (dictTerm.usageCount ?? 0) + 1;
      dictTerm.lastUsedAt = new Date().toISOString();
    } else {
      const sysTerm = MEDICAL_VOCABULARY.find((t) => t.id === termId);
      if (sysTerm) {
        sysTerm.usageCount = (sysTerm.usageCount ?? 0) + 1;
        sysTerm.lastUsedAt = new Date().toISOString();
      }
    }
    this.persist();
  }

  // ---------- 自定义词典 ----------

  listDictionaries(): CustomDictionary[] {
    return [...this.dictionaries];
  }

  getDictionary(id: string): CustomDictionary | undefined {
    return this.dictionaries.find((d) => d.id === id);
  }

  createDictionary(input: Omit<CustomDictionary, 'id' | 'createdAt' | 'updatedAt' | 'terms'>): CustomDictionary {
    const dict: CustomDictionary = {
      ...input,
      id: newId(),
      terms: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.dictionaries.push(dict);
    this.persist();
    this.rebuildIndex();
    return dict;
  }

  updateDictionary(id: string, patch: Partial<CustomDictionary>): CustomDictionary | null {
    const dict = this.dictionaries.find((d) => d.id === id);
    if (!dict) return null;
    Object.assign(dict, patch, { updatedAt: new Date().toISOString() });
    this.persist();
    this.rebuildIndex();
    return dict;
  }

  deleteDictionary(id: string): boolean {
    const idx = this.dictionaries.findIndex((d) => d.id === id);
    if (idx < 0) return false;
    this.dictionaries.splice(idx, 1);
    this.persist();
    this.rebuildIndex();
    return true;
  }

  addTermToDictionary(dictId: string, term: Omit<MedicalTerm, 'id' | 'createdAt' | 'usageCount'>): MedicalTerm | null {
    const dict = this.dictionaries.find((d) => d.id === dictId);
    if (!dict) return null;
    const t: MedicalTerm = {
      ...term,
      id: 'ct-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 9999).toString(36),
      createdAt: new Date().toISOString(),
      usageCount: 0,
    };
    dict.terms.push(t);
    dict.updatedAt = new Date().toISOString();
    this.persist();
    this.rebuildIndex();
    return t;
  }

  removeTermFromDictionary(dictId: string, termId: string): boolean {
    const dict = this.dictionaries.find((d) => d.id === dictId);
    if (!dict) return false;
    const idx = dict.terms.findIndex((t) => t.id === termId);
    if (idx < 0) return false;
    dict.terms.splice(idx, 1);
    dict.updatedAt = new Date().toISOString();
    this.persist();
    this.rebuildIndex();
    return true;
  }

  // ---------- 提升权重 / 提示 ----------

  getVocabularyHints(lang: string, limit = 50): string[] {
    return this.getAllTerms()
      .filter((t) => t.pinyin)
      .sort((a, b) => b.weight * 1.0 + b.usageCount * 0.01 - (a.weight + a.usageCount * 0.01))
      .slice(0, limit)
      .map((t) => t.term);
  }

  boostTerm(termId: string, weightDelta: number): void {
    const sysTerm = MEDICAL_VOCABULARY.find((t) => t.id === termId);
    if (sysTerm) {
      sysTerm.weight = Math.max(0, Math.min(200, sysTerm.weight + weightDelta));
      return;
    }
    this.dictionaries.forEach((d) => {
      d.terms.forEach((t) => {
        if (t.id === termId) t.weight = Math.max(0, Math.min(200, t.weight + weightDelta));
      });
    });
    this.persist();
  }

  // ---------- 统计 ----------

  getStats(): { total: number; byCategory: Record<string, number>; byModality: Record<string, number> } {
    const all = this.getAllTerms();
    const byCategory: Record<string, number> = {};
    const byModality: Record<string, number> = {};
    all.forEach((t) => {
      byCategory[t.category] = (byCategory[t.category] ?? 0) + 1;
      t.modality.forEach((m) => { byModality[m] = (byModality[m] ?? 0) + 1; });
    });
    return { total: all.length, byCategory, byModality };
  }

  export(): string {
    return JSON.stringify({ dictionaries: this.dictionaries, usageCount: this.usageCount }, null, 2);
  }

  import(json: string): { added: number; updated: number } {
    let added = 0;
    let updated = 0;
    try {
      const parsed = JSON.parse(json) as { dictionaries?: CustomDictionary[]; usageCount?: Record<string, number> };
      (parsed.dictionaries ?? []).forEach((d) => {
        const exist = this.dictionaries.find((x) => x.id === d.id);
        if (exist) { Object.assign(exist, d); updated++; }
        else { this.dictionaries.push(d); added++; }
      });
      Object.assign(this.usageCount, parsed.usageCount ?? {});
      this.persist();
      this.rebuildIndex();
    } catch {
      /* noop */
    }
    return { added, updated };
  }
}

export const vocabularyManager = new VocabularyManager();
