import pool from '../src/config/db.js';
import { rebuildQuestionsIndex } from '../src/services/vectorStore.js';
import { embedTextFor, INSTITUTION_QUESTION_INDEX } from '../src/services/questionIndex.js';

// --space=gemini|local|both — rebuild one provider's index or both. 'local'
// backfills the outage mirror; 'gemini' reconciles the primary after an
// outage-era write gap.
const spaceArg = process.argv.find((arg) => arg.startsWith('--space='));
const space = ['gemini', 'local'].includes(spaceArg?.split('=')[1])
  ? spaceArg.split('=')[1]
  : 'both';

// Canonical index set — must match the write path (questionIndex.js): every
// active objective question is a comparison target, including unverified
// bypassed actives (they're in circulation; a re-typed copy should flag).
const [questions] = await pool.query(
  `SELECT * FROM questions WHERE status = 'active'
   AND type IN ('mcq','true_false','matching','identification')`
);
const result = await rebuildQuestionsIndex(
  INSTITUTION_QUESTION_INDEX,
  questions.map((question) => ({ id: question.id, text: embedTextFor(question) })),
  space
);

console.log(JSON.stringify({ collection: INSTITUTION_QUESTION_INDEX, space, ...result }, null, 2));
await pool.end();
