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
        findCatchBlocks(full);
      }
    }
  } catch (e) {}
}

function findCatchBlocks(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/catch\s*\(/.test(line)) {
      // Build the block
      let block = '';
      let braceCount = 0;
      let found = false;
      let endLine = i;
      for (let j = i; j < Math.min(i + 15, lines.length); j++) {
        block += lines[j] + '\n';
        for (const ch of lines[j]) {
          if (ch === '{') { braceCount++; found = true; }
          if (ch === '}') braceCount--;
        }
        if (found && braceCount === 0) {
          endLine = j;
          break;
        }
      }
      // Extract just the body content between { and }
      const fullBlock = block.trim();
      const bodyMatch = fullBlock.match(/catch\s*\([^)]*\)\s*\{([\s\S]*)\}/);
      if (bodyMatch) {
        const body = bodyMatch[1].trim();
        // Check if empty or only whitespace
        if (body === '' || body === '// silent' || body === '/* silent */' || body === '// noop' || /^\s*$/.test(body)) {
          console.log(`${filePath}:${i + 1}: EMPTY - ${fullBlock.replace(/\n/g, ' ').substring(0, 200)}`);
        }
      }
    }
  }
}

console.log("=== Empty/comment-only catch blocks in src ===");
walk('E:/opencode work/FS 3X/G005-RISv-3.0.0/src');
