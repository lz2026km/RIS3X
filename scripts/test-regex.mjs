import { execSync } from 'child_process';

let out;
try {
  out = execSync('npx tsc --noEmit --pretty false', { encoding: 'utf8', cwd: 'E:\\opencode work\\FS 3X\\G005-RISv-3.0.0', stdio: 'pipe' });
} catch(e) {
  out = e.stdout;
}

const line = out.split('\n').find(l => l.includes('error TS2305'));
console.log('RAW:', JSON.stringify(line));

// Try different regex patterns
const patterns = [
  /Module "([^"]+)" has no exported member '([^']+)'/,
  /Module '([^']+)' has no exported member '([^']+)'/,
  /Module '"([^']+)"' has no exported member '([^']+)'/,
];

for (const p of patterns) {
  const m = line.match(p);
  console.log(p.toString() + ' => ' + (m ? 'MATCH: ' + m[1] + ' -> ' + m[2] : 'NO MATCH'));
}
