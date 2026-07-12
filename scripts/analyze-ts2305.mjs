import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

const output = execSync('npx tsc --noEmit --pretty false 2>&1', { encoding: 'utf8' });
const lines = output.split('\n').filter(l => l.includes('error TS2305'));

const modules = {};
for (const line of lines) {
  const m = line.match(/Module '([^']+)' has no exported member '([^']+)'/);
  if (m) {
    const [, mod, member] = m;
    if (!modules[mod]) modules[mod] = new Set();
    modules[mod].add(member);
  }
}

// Also handle TS2307 (missing module)
const lines2307 = output.split('\n').filter(l => l.includes('error TS2307'));
const missingModules = new Set();
for (const line of lines2307) {
  const m = line.match(/Cannot find module '([^']+)'/);
  if (m) {
    missingModules.add(m[1]);
  }
}

console.log('=== TS2305: Missing exports per module ===');
for (const [mod, members] of Object.entries(modules)) {
  console.log(`\n--- ${mod} ---`);
  for (const member of members) {
    console.log(`  ${member}`);
  }
}

console.log('\n=== TS2307: Missing modules ===');
for (const mod of missingModules) {
  console.log(`  ${mod}`);
}

// Generate stub files for internal modules
const root = 'E:\\opencode work\\FS 3X\\G005-RISv-3.0.0';
const internalModules = Object.entries(modules).filter(([mod]) => mod.startsWith('.') || mod.startsWith('src/'));
for (const [mod, members] of internalModules) {
  // Resolve relative path to absolute
  let absPath = mod;
  // Check if this is a relative path - need to find actual file
  // For now, just 
  console.log(`\nNeed to fix: ${mod} -> ${[...members].join(', ')}`);
}

// Special cases
const special = {
  './performance': ['debounce', 'throttle'],
  'antd': ['Gauge'],
  'lucide-react': ['Prescription', 'Tooth'],
};
console.log('\n=== Special cases ===');
for (const [mod, members] of Object.entries(special)) {
  console.log(`${mod}: ${members.join(', ')}`);
}
