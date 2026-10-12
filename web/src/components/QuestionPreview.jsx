/**
 * QuestionPreview — a question as students would read it, with the correct
 * answer marked. Shared by the Question bank and Shared bank preview sheets.
 *
 *   <QuestionPreview question={q} />
 *
 * Handles every objective type: multiple choice (correct option ticked),
 * true/false, matching (each premise with its response letter) and
 * identification, labelled "Fill in the blank". Text goes through RichText
 * so LaTeX math is typeset.
 */
import { AlertTriangle, Check } from 'lucide-react';
import RichText from './RichText.jsx';
import { cleanOptionText, matchingLetters, resolveAnswerIndex, trueFalseAnswer } from '../lib/questionAnswers.js';

function Missing({ children }) {
  return <li className="qp-warn"><AlertTriangle size={14} aria-hidden="true" /> {children}</li>;
}

function Body({ question }) {
  const options = Array.isArray(question.options) ? question.options : [];

  if (question.type === 'mcq') {
    const correct = resolveAnswerIndex(options, question.answer);
    return (
      <ol className="qp-options">
        {options.map((opt, i) => (
          <li key={i} className={i === correct ? 'is-correct' : undefined}>
            <span className="qp-letter">{String.fromCharCode(65 + i)}</span>
            <RichText className="qp-text" text={cleanOptionText(opt)} />
            {i === correct && <span className="qp-mark"><Check size={14} aria-hidden="true" /> Correct</span>}
          </li>
        ))}
        {correct < 0 && <Missing>No option matches the stored answer{question.answer ? ` (“${question.answer}”)` : ''}.</Missing>}
      </ol>
    );
  }

  if (question.type === 'true_false') {
    const answer = trueFalseAnswer(question.answer);
    return (
      <ol className="qp-options qp-options--tf">
        {['True', 'False'].map((v) => (
          <li key={v} className={answer === v ? 'is-correct' : undefined}>
            <span className="qp-letter">{v[0]}</span>
            <span className="qp-text">{v}</span>
            {answer === v && <span className="qp-mark"><Check size={14} aria-hidden="true" /> Correct</span>}
          </li>
        ))}
        {!answer && <Missing>No answer recorded.</Missing>}
      </ol>
    );
  }

  if (question.type === 'matching') {
    const letters = matchingLetters(question.answer, options.length);
    return (
      <ol className="qp-options qp-options--match">
        {options.map((premise, i) => (
          <li key={i}>
            <span className="qp-letter">{i + 1}</span>
            <RichText className="qp-text" text={cleanOptionText(premise)} />
            <span className={`qp-match${letters[i] ? '' : ' is-missing'}`}>{letters[i] || '—'}</span>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <div className="qp-answer">
      <span className="qp-label">Expected answer</span>
      {question.answer ? <RichText as="p" text={question.answer} /> : <p className="is-missing">None recorded.</p>}
    </div>
  );
}

export default function QuestionPreview({ question }) {
  return (
    <div className="qp">
      <RichText as="p" className="qp-stem" text={question.stem} />
      <Body question={question} />
      {question.explanation && (
        <div className="qp-explanation">
          <span className="qp-label">Explanation</span>
          <RichText as="p" text={question.explanation} />
        </div>
      )}
    </div>
  );
}
