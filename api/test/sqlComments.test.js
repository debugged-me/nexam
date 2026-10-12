// Guards a silent mysql2 failure: named placeholders (`:topic`) are parsed
// without understanding SQL comments, so an apostrophe inside a `-- …` line
// opens a phantom string literal and every placeholder after it stops
// binding. Blueprint assembly once returned every question for every cell
// because of a single "instructor's" in a comment.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

function jsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return jsFiles(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });
}

test('no SQL comment line contains an apostrophe', () => {
  const offenders = [];
  for (const file of jsFiles(srcDir)) {
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (/^\s*--.*'/.test(line)) offenders.push(`${path.relative(srcDir, file)}:${i + 1}`);
    });
  }
  assert.deepEqual(offenders, [], `SQL comments with apostrophes break named placeholders: ${offenders.join(', ')}`);
});
