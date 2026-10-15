/**
 * googleForms — export an assembled exam to a self-grading Google Forms
 * quiz. Entirely browser-side: a forms.body-scoped GIS token calls the
 * Forms API directly; the API then stores the resulting links on the exam.
 *
 * Type mapping:
 *   mcq            → graded RADIO (option text as the answer value)
 *   true_false     → graded RADIO True/False
 *   identification → graded short-answer (exact match)
 *   matching       → ungraded short-answer listing the premises — the stored
 *     model keeps only premises + letter answers, so there is no right-column
 *     text to build a grid from; the instructor grades these by hand.
 */
import { requestGoogleToken } from './googleDrive.js';

export const FORMS_SCOPE = 'https://www.googleapis.com/auth/forms.body';
const API = 'https://forms.googleapis.com/v1/forms';

/** forms.body-scoped token — consent prompt on first use, silent after. */
export function requestFormsToken(clientId, hint) {
  return requestGoogleToken(clientId, { scope: FORMS_SCOPE, hint });
}

async function formsPost(token, path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Google Forms API error (${res.status})`);
  return data;
}

/** Strip a leading "A) "/"B. " label so option text stands alone. */
function stripLetter(opt) {
  return String(opt || '').replace(/^[A-Z][).]\s*/i, '').trim();
}

/** Resolve a stored MCQ answer (letter or option text) to an option index. */
function correctIndex(options, answer) {
  const a = String(answer || '').trim();
  if (/^[A-Za-z]$/.test(a)) {
    const i = a.toUpperCase().charCodeAt(0) - 65;
    return i < options.length ? i : -1;
  }
  return options.findIndex((o) => o === a || stripLetter(o) === stripLetter(a));
}

function grading(points, correctValues, explanation) {
  const g = { pointValue: points };
  if (correctValues?.length) g.correctAnswers = { answers: correctValues.map((v) => ({ value: v })) };
  if (explanation) g.generalFeedback = { text: explanation };
  return g;
}

function createItem(index, title, question, description) {
  const item = { title, questionItem: { question } };
  if (description) item.description = description;
  return { createItem: { item, location: { index } } };
}

/**
 * Build the batchUpdate requests for one question. Returns
 * { request, graded } — ungraded items (matching) count toward `manual`.
 */
function questionRequest(q, index) {
  const meta = [q.topic, q.bloom].filter(Boolean).join(' · ');
  const pts = Number(q.points) > 0 ? Number(q.points) : 1;

  if (q.type === 'mcq') {
    const opts = (Array.isArray(q.options) ? q.options : []).map(stripLetter).filter(Boolean);
    if (!opts.length) return null;
    const ci = correctIndex(q.options.map((o) => String(o)), q.answer);
    const correct = ci >= 0 ? [opts[ci]] : null;
    return {
      graded: true,
      request: createItem(index, q.stem, {
        required: true,
        grading: grading(pts, correct, q.explanation),
        choiceQuestion: { type: 'RADIO', options: opts.map((v) => ({ value: v })), shuffle: true },
      }, meta),
    };
  }

  if (q.type === 'true_false') {
    const isTrue = /^t/i.test(String(q.answer || '').trim());
    return {
      graded: true,
      request: createItem(index, q.stem, {
        required: true,
        grading: grading(pts, [isTrue ? 'True' : 'False'], q.explanation),
        choiceQuestion: { type: 'RADIO', options: [{ value: 'True' }, { value: 'False' }] },
      }, meta),
    };
  }

  if (q.type === 'identification') {
    const answer = String(q.answer || '').trim();
    return {
      graded: Boolean(answer),
      request: createItem(index, q.stem, {
        required: true,
        grading: grading(pts, answer ? [answer] : null, q.explanation),
        textQuestion: {},
      }, meta),
    };
  }

  if (q.type === 'matching') {
    const premises = (Array.isArray(q.options) ? q.options : [])
      .map((o, i) => `${i + 1}. ${stripLetter(o)}`).join('\n');
    return {
      graded: false,
      request: createItem(index, q.stem, {
        required: true,
        textQuestion: { paragraph: false },
      }, `Matching — ${premises}\nWrite the matching letters in order (e.g. B,A,D,C). Graded manually.`),
    };
  }

  return null; // unsupported type — skipped, reported by the caller
}

/**
 * Create a quiz in the signed-in user's Google Drive.
 * @returns {Promise<{formId, responderUri, editUrl, total, graded, manual}>}
 */
export async function createFormsQuiz(token, { title, questions }) {
  const form = await formsPost(token, '', { info: { title, documentTitle: title } });

  const requests = [
    { updateSettings: { settings: { quizSettings: { isQuiz: true } }, updateMask: 'quizSettings.isQuiz' } },
  ];
  let graded = 0;
  let manual = 0;
  questions.forEach((q) => {
    const built = questionRequest(q, requests.length - 1); // index counts items only
    if (!built) return;
    requests.push(built.request);
    if (built.graded) graded += 1; else manual += 1;
  });
  await formsPost(token, `/${form.formId}:batchUpdate`, { requests });

  return {
    formId: form.formId,
    responderUri: form.responderUri,
    editUrl: `https://docs.google.com/forms/d/${form.formId}/edit`,
    total: questions.length,
    graded,
    manual,
  };
}
