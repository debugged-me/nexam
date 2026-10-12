import pool from '../src/config/db.js';
import { rebuildChunksIndex } from '../src/services/vectorStore.js';

// --space=gemini|local|both — same contract as rebuild-question-index.js.
// Rebuilds every subject's material-chunk index from material_chunks, one
// provider space at a time.
const spaceArg = process.argv.find((arg) => arg.startsWith('--space='));
const space = ['gemini', 'local'].includes(spaceArg?.split('=')[1])
  ? spaceArg.split('=')[1]
  : 'both';

const [subjects] = await pool.query(`SELECT DISTINCT subject_id FROM material_chunks`);
for (const { subject_id } of subjects) {
  const [chunks] = await pool.query(
    `SELECT id, material_id, ordinal, text FROM material_chunks WHERE subject_id = :sid ORDER BY ordinal`,
    { sid: subject_id }
  );
  const result = await rebuildChunksIndex(
    subject_id,
    chunks.map((c) => ({ id: c.id, materialId: c.material_id, ordinal: c.ordinal, text: c.text })),
    space
  );
  const line = Object.entries(result)
    .map(([p, r]) => `${p}: ${r.error ? `ERROR ${r.error}` : `${r.indexed} indexed`}`)
    .join(' | ');
  console.log(`${subject_id} — ${line}`);
}
await pool.end();
