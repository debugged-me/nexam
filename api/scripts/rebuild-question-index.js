import pool from '../src/config/db.js';
import { rebuildQuestionsIndex } from '../src/services/vectorStore.js';
import { embedTextFor } from '../src/services/questionIndex.js';

const [subjects] = await pool.query(`SELECT DISTINCT subject_id FROM questions`);

const rebuilt = [];
for (const { subject_id: subjectId } of subjects) {
  const [questions] = await pool.query(
    `SELECT * FROM questions WHERE subject_id = :subjectId AND status = 'active'
     AND type IN ('mcq','true_false','matching','identification')
     AND similarity_checked_at IS NOT NULL AND similarity_error IS NULL
     AND similarity_flag = 'none'`,
    { subjectId }
  );
  const result = await rebuildQuestionsIndex(subjectId, questions.map((question) => ({
    id: question.id,
    text: embedTextFor(question),
  })));
  rebuilt.push({ subjectId, indexed: result.indexed, backupCreated: result.backupCreated });
}

console.log(JSON.stringify({ subjects: rebuilt.length, rebuilt }, null, 2));
await pool.end();
