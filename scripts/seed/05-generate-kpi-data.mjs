import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_FILE = join(__dirname, '..', '..', 'src', 'data', 'kpiHistory.ts');

// ── helpers ──
const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round = (v, d = 0) => Number(v.toFixed(d));

const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;
const fmtDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Seasonal factor (-1..1, peaks in Dec/Jan, troughs in Jun/Jul)
function seasonalFactor(month) {
  return -Math.cos(((month) / 12) * Math.PI * 2);
}

// Year progress 0..1 for trend calculations (2024-01-01 = 0, 2026-12-31 = 1)
function yearProgress(date) {
  const start = new Date(2024, 0, 1);
  const end = new Date(2026, 11, 31);
  return (date - start) / (end - start);
}

function dailyBase(date) {
  const w = isWeekend(date);
  const month = date.getMonth();
  const base = w ? randInt(80, 150) : randInt(200, 380);
  const seasonal = seasonalFactor(month) * 25;
  const growth = 1 + (date.getFullYear() - 2024) * 0.08;
  const noise = rand(-15, 15);
  return Math.max(20, Math.round((base + seasonal + noise) * growth));
}

function dailyRevenue(date) {
  const w = isWeekend(date);
  const base = w ? randInt(30000, 100000) : randInt(100000, 500000);
  const growth = 1 + (date.getFullYear() - 2024) * 0.06;
  return Math.round(base * growth * rand(0.85, 1.15));
}

// ── KPI generator map ──
// Each generator: (date) => { daily: number, monthly?: number, ... }
const KPI_GENERATORS = {};

// ── Volume ──
KPI_GENERATORS['kpi-001'] = (date) => ({ value: dailyBase(date) });
KPI_GENERATORS['kpi-002'] = (date, ctx) => {
  const w = isWeekend(date);
  const base = w ? randInt(25, 50) : randInt(65, 120);
  const growth = 1 + (date.getFullYear() - 2024) * 0.07;
  return { value: Math.round(base * growth * rand(0.85, 1.15)) };
};
KPI_GENERATORS['kpi-003'] = (date) => ({ value: dailyBase(date) });
KPI_GENERATORS['kpi-004'] = (date) => {
  const w = isWeekend(date);
  const base = w ? 15 : dailyBase(date) * 0.12;
  const noise = rand(-8, 12);
  return { value: Math.max(0, Math.round(base + noise)) };
};
KPI_GENERATORS['kpi-005'] = (date) => {
  const total = dailyBase(date);
  const ctPct = randInt(30, 38);
  const mrPct = randInt(15, 22);
  const drPct = randInt(32, 42);
  const mgPct = randInt(3, 6);
  const dsaPct = randInt(1, 3);
  const other = 100 - ctPct - mrPct - drPct - mgPct - dsaPct;
  return {
    value: total,
    CT: Math.round(total * ctPct / 100),
    MR: Math.round(total * mrPct / 100),
    DR: Math.round(total * drPct / 100),
    MG: Math.round(total * mgPct / 100),
    DSA: Math.round(total * dsaPct / 100),
    other: Math.round(total * other / 100),
  };
};

// ── Timeliness ──
KPI_GENERATORS['kpi-010'] = (date) => {
  const w = isWeekend(date);
  const progress = yearProgress(date);
  const target = 35 - progress * 10; // 35min -> 25min over 3 years
  const base = w ? target - randInt(3, 8) : target + randInt(-5, 8);
  return { value: clamp(round(base + rand(-3, 3), 1), 10, 60) };
};
KPI_GENERATORS['kpi-011'] = (date) => {
  const w = isWeekend(date);
  const base = w ? randInt(8, 16) : randInt(10, 22);
  return { value: clamp(round(base + rand(-3, 3), 1), 5, 35) };
};
KPI_GENERATORS['kpi-012'] = (date) => {
  const progress = yearProgress(date);
  const base = 88 + progress * 10; // 88% -> 98% over 3 years
  const w = isWeekend(date);
  const adj = w ? 1 : -1;
  return { value: clamp(round(base + adj * rand(1, 3) + rand(-3, 3), 1), 82, 99.5) };
};
KPI_GENERATORS['kpi-013'] = (date) => {
  const vol = dailyBase(date);
  const rate = 1.5 + rand(0, 4);
  return { value: Math.max(0, Math.round(vol * rate / 100)) };
};
KPI_GENERATORS['kpi-014'] = (date) => {
  const progress = yearProgress(date);
  const target = 25 - progress * 8;
  const base = target + rand(-5, 6);
  return { value: clamp(round(base + rand(-2, 2), 1), 8, 45) };
};

// ── Quality ──
KPI_GENERATORS['kpi-020'] = (date) => {
  const progress = yearProgress(date);
  const base = 78 + progress * 12; // 78% -> 90%
  const noise = rand(-4, 4);
  return { value: clamp(round(base + noise, 1), 65, 98) };
};
KPI_GENERATORS['kpi-021'] = (date) => {
  const progress = yearProgress(date);
  const base = 84 + progress * 10; // 84 -> 94
  return { value: clamp(round(base + rand(-3, 3), 1), 72, 99) };
};
KPI_GENERATORS['kpi-022'] = (date) => {
  const vol = dailyBase(date);
  const progress = yearProgress(date);
  const rate = (3 - progress * 1.5) / 100;
  return { value: Math.max(0, Math.round(vol * rate * rand(0.5, 1.5))) };
};
KPI_GENERATORS['kpi-023'] = (date) => {
  const progress = yearProgress(date);
  const base = 90 + progress * 6; // 90% -> 96%
  return { value: clamp(round(base + rand(-2, 2), 1), 80, 99.5) };
};

// ── Safety ──
KPI_GENERATORS['kpi-030'] = (date) => {
  const progress = yearProgress(date);
  const base = 92 + progress * 7; // 92% -> 99%
  return { value: clamp(round(base + rand(-3, 2), 1), 82, 100) };
};
KPI_GENERATORS['kpi-031'] = (date) => {
  const w = isWeekend(date);
  const base = w ? randInt(3, 8) : randInt(1, 6);
  const month = date.getMonth();
  const seasonal = seasonalFactor(month) * 2;
  return { value: Math.max(0, Math.round(base + seasonal + rand(-1, 2))) };
};
KPI_GENERATORS['kpi-032'] = (date) => {
  // Rare events: 0-3 per day, most days 0
  if (Math.random() > 0.15) return { value: 0 };
  return { value: randInt(1, 3) };
};
KPI_GENERATORS['kpi-033'] = (date) => {
  const progress = yearProgress(date);
  const base = Math.max(0.1, 1.8 - progress * 0.8);
  return { value: clamp(round(base + rand(-0.3, 0.5), 2), 0.05, 4) };
};

// ── Utilization ──
KPI_GENERATORS['kpi-040'] = (date) => {
  const w = isWeekend(date);
  if (w) return { value: clamp(round(rand(20, 42), 1), 15, 50) };
  return { value: clamp(round(rand(70, 96), 1), 55, 99) };
};
KPI_GENERATORS['kpi-041'] = (date) => {
  const w = isWeekend(date);
  const base = w ? randInt(5, 12) : randInt(18, 32);
  const growth = 1 + (date.getFullYear() - 2024) * 0.05;
  return { value: Math.round(base * growth * rand(0.85, 1.15)) };
};
KPI_GENERATORS['kpi-042'] = (date) => {
  const w = isWeekend(date);
  const base = w ? randInt(12, 22) : randInt(6, 14);
  return { value: clamp(round(base + rand(-3, 3), 1), 3, 30) };
};
KPI_GENERATORS['kpi-043'] = (date) => {
  if (Math.random() > 0.08) return { value: round(rand(0, 1.5), 2) };
  return { value: round(rand(1.5, 6), 2) };
};

// ── Efficiency ──
KPI_GENERATORS['kpi-050'] = (date) => {
  const progress = yearProgress(date);
  const base = 30 + progress * 50;
  return { value: clamp(round(base + rand(-5, 5), 1), 15, 95) };
};
KPI_GENERATORS['kpi-051'] = (date) => {
  const progress = yearProgress(date);
  const base = 40 + progress * 35; // 40% -> 75%
  return { value: clamp(round(base + rand(-4, 4), 1), 28, 90) };
};
KPI_GENERATORS['kpi-052'] = (date) => {
  const progress = yearProgress(date);
  const base = 15 + progress * 40;
  return { value: clamp(round(base + rand(-3, 5), 1), 5, 85) };
};
KPI_GENERATORS['kpi-053'] = (date) => {
  const progress = yearProgress(date);
  const base = 8 + progress * 25;
  return { value: clamp(round(base + rand(-3, 4), 1), 2, 50) };
};

// ── Finance ──
KPI_GENERATORS['kpi-060'] = (date) => ({ value: dailyRevenue(date) });
KPI_GENERATORS['kpi-061'] = (date) => {
  const base = 52 + rand(-8, 10);
  return { value: clamp(round(base, 1), 30, 75) };
};
KPI_GENERATORS['kpi-062'] = (date) => {
  const base = 18 + rand(-5, 7);
  return { value: clamp(round(base, 1), 5, 38) };
};

// ── Satisfaction (monthly-granular, same daily value for a month) ──
const monthlyCache = {};
KPI_GENERATORS['kpi-070'] = (date) => {
  const key = `${date.getFullYear()}-${date.getMonth()}`;
  if (!monthlyCache[key + '-070']) {
    const progress = yearProgress(date);
    monthlyCache[key + '-070'] = clamp(round(82 + progress * 12 + rand(-3, 3), 1), 70, 99);
  }
  return { value: monthlyCache[key + '-070'] };
};
KPI_GENERATORS['kpi-071'] = (date) => {
  const key = `${date.getFullYear()}-${date.getMonth()}`;
  if (!monthlyCache[key + '-071']) {
    const progress = yearProgress(date);
    monthlyCache[key + '-071'] = clamp(round(78 + progress * 12 + rand(-3, 3), 1), 65, 98);
  }
  return { value: monthlyCache[key + '-071'] };
};
KPI_GENERATORS['kpi-072'] = (date) => {
  const key = `${date.getFullYear()}-${date.getMonth()}`;
  if (!monthlyCache[key + '-072']) {
    monthlyCache[key + '-072'] = randInt(0, 5);
  }
  return { value: monthlyCache[key + '-072'] };
};

// ── Experience ──
KPI_GENERATORS['kpi-080'] = (date) => {
  const vol = dailyBase(date);
  const progress = yearProgress(date);
  const rate = 30 + progress * 50;
  return { value: Math.round(vol * rate / 100 * rand(0.8, 1.2)) };
};
KPI_GENERATORS['kpi-081'] = (date) => {
  const progress = yearProgress(date);
  const base = 72 + progress * 22;
  return { value: clamp(round(base + rand(-3, 3), 1), 50, 99) };
};
KPI_GENERATORS['kpi-082'] = (date) => {
  const progress = yearProgress(date);
  const base = 80 + progress * 16;
  return { value: clamp(round(base + rand(-2, 2), 1), 60, 100) };
};
KPI_GENERATORS['kpi-083'] = (date) => {
  const progress = yearProgress(date);
  const base = 50 + progress * 35;
  return { value: clamp(round(base + rand(-4, 4), 1), 30, 98) };
};

// ── Main ──
const KPI_IDS = Object.keys(KPI_GENERATORS);
console.log(`Generating data for ${KPI_IDS.length} KPIs over 3 years...`);

const startTime = Date.now();
const result = {};

const startDate = new Date(2024, 0, 1);
const endDate = new Date(2026, 11, 31);

let totalDays = 0;
let totalRecords = 0;
let totalYears = 0;

for (const kpiId of KPI_IDS) {
  const days = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    const gen = KPI_GENERATORS[kpiId];
    const data = gen(new Date(current));
    const entry = { date: fmtDate(current), value: data.value };
    // Include extra fields if present (for pie/bar/line chart support)
    for (const [k, v] of Object.entries(data)) {
      if (k !== 'value') entry[k] = v;
    }
    days.push(entry);
    current.setDate(current.getDate() + 1);
  }
  result[kpiId] = days;
  totalDays = days.length;
  totalRecords += days.length;
}

// Compute monthly aggregation (add _monthly field)
for (const kpiId of KPI_IDS) {
  const days = result[kpiId];
  const monthlyMap = {};
  for (const d of days) {
    const monthKey = d.date.slice(0, 7);
    if (!monthlyMap[monthKey]) {
      monthlyMap[monthKey] = { sum: 0, count: 0, min: Infinity, max: -Infinity };
    }
    monthlyMap[monthKey].sum += d.value;
    monthlyMap[monthKey].count++;
    monthlyMap[monthKey].min = Math.min(monthlyMap[monthKey].min, d.value);
    monthlyMap[monthKey].max = Math.max(monthlyMap[monthKey].max, d.value);
  }
  for (const d of days) {
    const monthKey = d.date.slice(0, 7);
    const m = monthlyMap[monthKey];
    d._monthly = {
      avg: round(m.sum / m.count, 1),
      min: m.min,
      max: m.max,
      total: Math.round(m.sum),
    };
  }
}

const fileContent = `// GENERATED by scripts/seed/05-generate-kpi-data.mjs
// Generated at: ${new Date().toISOString()}
// KPIs: ${KPI_IDS.length}, Days: ${totalDays}, Total records: ${totalRecords}

export interface KpiDayData {
  date: string;
  value: number;
  [key: string]: unknown;
  _monthly?: {
    avg: number;
    min: number;
    max: number;
    total: number;
  };
}

export const KPI_HISTORY: Record<string, KpiDayData[]> = ${JSON.stringify(result, null, 2)};
`;

writeFileSync(OUT_FILE, fileContent, 'utf-8');

const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
const stats = { kpis: KPI_IDS.length, records: totalRecords, days: totalDays };
console.log(`Done. KPIs: ${stats.kpis}, Daily records: ${stats.records}, Days per KPI: ${stats.days}`);
console.log(`Output: ${OUT_FILE}`);
console.log(`File size: ${(Buffer.byteLength(fileContent, 'utf-8') / 1024 / 1024).toFixed(2)} MB`);
console.log(`Elapsed: ${elapsed}s`);
