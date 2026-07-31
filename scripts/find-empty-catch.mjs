import fs from 'fs';
import path from 'path';

function walk(dir) {
  try {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const full = path.join(dir, item);
      const stat = fs.statSync(full);
      if (stat.isDirectory() && !full.includes('node_modules') && !full.includes('.git')) {
        walk(full);
      } else if (/\.(ts|tsx)$/.test(item)) {
        findEmptyCatch(full);
      }
    }
  } catch (e) {}
}

function findEmptyCatch(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/catch\s*\(/.test(line)) {
      // Build the block by collecting lines until braces balance
      let block = '';
      let braceCount = 0;
      let found = false;
      for (let j = i; j < Math.min(i + 10, lines.length); j++) {
        block += lines[j] + '\n';
        for (const ch of lines[j]) {
          if (ch === '{') { braceCount++; found = true; }
          if (ch === '}') braceCount--;
        }
        if (found && braceCount === 0) {
          const trimmed = block.replace(/\s+/g, ' ').trim();
          // Check if it's an empty catch block (only whitespace inside braces)
          const match = trimmed.match(/catch\s*\([^)]*\)\s*\{\s*\}/);
          if (match) {
            console.log(`${filePath}:${i + 1}: ${trimmed}`);
          }
          break;
        }
      }
    }
  }
}

// Walk both pages and services
console.log("=== Empty catch blocks in src/pages ===");
walk('E:/opencode work/FS 3X/G005-RISv-3.0.0/src/pages');
console.log("\n=== Empty catch blocks in src/services ===");
walk('E:/opencode work/FS 3X/G005-RISv-3.0.0/src/services');
console.log("\n=== Empty catch blocks in ALL src ===");
walk('E:/opencode work/FS 3X/G005-RISv-3.0.0/src');
