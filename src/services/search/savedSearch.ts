import type { SavedSearch } from './types';

const STORAGE_KEY = 'g005:saved-searches';

function load(): SavedSearch[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function save(searches: SavedSearch[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(searches));
}

export const savedSearchService = {
  list(): SavedSearch[] {
    return load();
  },

  save(search: Omit<SavedSearch, 'id' | 'createdAt' | 'updatedAt'>): SavedSearch {
    const searches = load();
    const saved: SavedSearch = {
      ...search,
      id: `ss-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    searches.unshift(saved);
    save(searches);
    return saved;
  },

  update(id: string, updates: Partial<SavedSearch>): SavedSearch | null {
    const searches = load();
    const idx = searches.findIndex(s => s.id === id);
    if (idx < 0) return null;
    const current = searches[idx]!;
    const updated: SavedSearch = { ...current, ...updates, updatedAt: new Date().toISOString() };
    searches[idx] = updated;
    save(searches);
    return updated;
  },

  delete(id: string): boolean {
    const searches = load();
    const idx = searches.findIndex(s => s.id === id);
    if (idx < 0) return false;
    searches.splice(idx, 1);
    save(searches);
    return true;
  },
};
