import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve('src/data');
const TARGET_EXT = '.json';
const INCLUDE_HISTORY = process.argv.includes('--include-history');

const PATTERNS = [
  '\u00e2\u20ac\u2122', // â€™
  '\u00e2\u20ac\u02dc', // â€˜
  '\u00e2\u20ac\u0153', // â€œ
  '\u00e2\u20ac\u009d', // â€
  '\u00e2\u20ac\u201c', // â€“
  '\u00e2\u20ac\u201d', // â€”
  '\u00e2\u20ac\u00a6', // â€¦
  '\u00c2', // Â
  '\u0393\u00c7\u00d6', // ΓÇÖ
  '\u0393\u00c7\u00a3', // ΓÇ£
  '\u0393\u00c7\u00a5', // ΓÇ¥
  '\u00c3\u00a9', // Ã©
  '\u00c3\u00a8', // Ã¨
  '\u00c3\u00a2', // Ã¢
  '\ufffd' // replacement char
];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
      continue;
    }
    if (entry.isFile() && full.endsWith(TARGET_EXT)) {
      files.push(full);
    }
  }

  return files;
}

function findPatternHits(text) {
  return PATTERNS.filter((pattern) => text.includes(pattern));
}

function rel(filePath) {
  return path.relative(process.cwd(), filePath).replaceAll('\\', '/');
}

function shouldCheck(filePath) {
  const relative = rel(filePath);
  if (!INCLUDE_HISTORY && relative.startsWith('src/data/history/')) {
    return false;
  }
  return true;
}

async function main() {
  const files = await walk(ROOT);
  const hits = [];

  for (const file of files) {
    if (!shouldCheck(file)) {
      continue;
    }
    const content = await readFile(file, 'utf8');
    const found = findPatternHits(content);
    if (found.length > 0) {
      hits.push({ file, found });
    }
  }

  if (hits.length === 0) {
    const scope = INCLUDE_HISTORY ? 'all src/data JSON files' : 'live src/data JSON files (excluding history snapshots)';
    console.log(`Mojibake check passed: no known corruption patterns found in ${scope}.`);
    return;
  }

  console.error('Mojibake check failed. Corruption patterns detected:');
  for (const hit of hits) {
    console.error(`- ${rel(hit.file)} -> ${hit.found.join(', ')}`);
  }

  process.exitCode = 1;
}

main().catch((error) => {
  console.error('Mojibake check crashed:', error);
  process.exitCode = 1;
});
