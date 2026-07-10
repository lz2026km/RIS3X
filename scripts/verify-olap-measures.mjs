// 验证脚本: 调用所有 13 个 measure, 确保从 kpiHistory 返回非零值
// 运行: pnpm exec tsx scripts/verify-olap-measures.mjs
const { aggregateFromKpiHistory, METRICS } = await import(
  '../src/services/mockBackend/olapHandlers.ts'
);
const { KPI_HISTORY } = await import('../src/data/kpiHistory.ts');

const allMeasures = METRICS.map((m) => m.id);
const kpiIds = Object.keys(KPI_HISTORY);
console.log(`KPI_HISTORY: ${kpiIds.length} KPIs, ${kpiIds.reduce((s, k) => s + (KPI_HISTORY[k]?.length || 0), 0)} daily records\n`);

console.log(`Testing ${allMeasures.length} measures (monthly granularity):\n`);
console.log('| # | Measure                | Source  | Rows | NonZero | Sample Value |');
console.log('|---|------------------------|---------|------|---------|--------------|');

let pass = 0;
let fail = 0;
allMeasures.forEach((measure, idx) => {
  const result = aggregateFromKpiHistory({
    measures: [measure],
    dimensions: ['date'],
    granularity: 'monthly',
  });
  const rows = result.rows;
  const nonZero = rows.filter((r) => Number(r[measure]) > 0).length;
  const lastRow = rows[rows.length - 1];
  const sample = lastRow ? Number(lastRow[measure]).toFixed(2) : 'N/A';
  const ok = nonZero > 0;
  if (ok) pass++; else fail++;
  const tag = ok ? '✅' : '❌';
  console.log(`| ${String(idx + 1).padStart(2)} | ${measure.padEnd(22)} | ${result.source.padEnd(7)} | ${String(rows.length).padStart(4)} | ${String(nonZero).padStart(7)} | ${sample.padStart(12)} | ${tag}`);
});

console.log(`\nResult: ${pass} passed, ${fail} failed (out of ${allMeasures.length})`);
process.exit(fail === 0 ? 0 : 1);
