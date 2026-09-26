import pool from '../src/config/db.js';
import { rebuildQuestionsIndex } from '../src/services/vectorStore.js';
import { embedTextFor, INSTITUTION_QUESTION_INDEX } from '../src/services/questionIndex.js';

const [questions] = await pool.query(
  `SELECT * FROM questions WHERE status = 'active'
   AND type IN ('mcq','true_false','matching','identification')
   AND similarity_checked_at IS NOT NULL AND similarity_error IS NULL
   AND similarity_flag = 'none'`
);
const result = await rebuildQuestionsIndex(
  INSTITUTION_QUESTION_INDEX,
  questions.map((question) => ({ id: question.id, text: embedTextFor(question) }))
);

console.log(JSON.stringify({
  collection: INSTITUTION_QUESTION_INDEX,
  indexed: result.indexed,
  backupCreated: result.backupCreated,
}, null, 2));
await pool.end();
