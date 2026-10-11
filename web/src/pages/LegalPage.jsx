import '../styles/legal.css';
/**
 * LegalPage — public legal documents (Data Privacy, Terms of Use).
 * One component renders both documents; the route picks which via `doc`.
 */
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const DOCS = {
  privacy: {
    title: 'Data Privacy Notice',
    updated: 'October 2026',
    intro:
      'Nexam is an exam-building workspace for instructors. This notice explains what information the service handles, why, and the choices you have.',
    sections: [
      {
        h: 'What we collect',
        items: [
          'Account details — your name, email address, and a hashed password.',
          'Content you create — subjects, questions, TOS blueprints, exams, and their results.',
          'Materials you upload — PDFs, documents, URLs, or pasted text used to ground question generation.',
          'Exam results you record — scores and item analysis, including any student identifiers you choose to enter.',
          'Technical data — basic request logs needed to keep the service secure and reliable.',
        ],
      },
      {
        h: 'How we use it',
        items: [
          'To provide the workspace: store, organize, and render your content back to you.',
          'To ground AI features: uploaded materials are chunked and embedded so generated questions can cite your sources.',
          'To check originality: approved questions form an institution-wide, read-only similarity bank.',
          'To analyze results: item analysis and exam statistics computed from data you entered.',
        ],
      },
      {
        h: 'What we never do',
        items: [
          'Sell or rent your data to anyone.',
          'Show your private drafts, materials, or results to other instructors.',
          'Use your content to train models outside this service.',
        ],
      },
      {
        h: 'Sharing',
        items: [
          'Approved questions become part of a shared, institution-wide read-only bank; other instructors may reuse them.',
          'AI providers receive only the text chunks needed to draft a question — never your account details or student data.',
          'We disclose data only if required by law or your institution’s policies.',
        ],
      },
      {
        h: 'Security',
        items: [
          'Passwords are stored hashed; sessions use short-lived signed tokens.',
          'Uploaded files and student PII are stored encrypted at rest.',
          'Access is scoped: every private record belongs to your instructor account and the API enforces that on each request.',
        ],
      },
      {
        h: 'Your choices',
        items: [
          'Edit or delete your content at any time — deleting a material removes its chunks and embeddings.',
          'Rejected questions stay in your private queue only; they are never added to the shared bank.',
          'Request account deletion or a copy of your data from your administrator.',
        ],
      },
      {
        h: 'Contact',
        p: 'Questions about this notice or your data? Contact your institution’s Nexam administrator.',
      },
    ],
  },
  terms: {
    title: 'Terms of Use',
    updated: 'October 2026',
    intro:
      'By using Nexam you agree to these terms. They cover who may use the service, what you can do with it, and what to expect.',
    sections: [
      {
        h: 'Who may use it',
        p: 'Nexam is for faculty and instructors only. Accounts are issued by your institution; do not share your credentials or let others act through your account.',
      },
      {
        h: 'Your content',
        items: [
          'You keep ownership of everything you create and upload.',
          'You grant the service permission to store, process, and display that content so the features work (chunking, embeddings, similarity checks, rendering).',
          'Approving a question adds it to the institution’s shared, read-only bank. You can reject or delete your own drafts at any time.',
        ],
      },
      {
        h: 'Acceptable use',
        items: [
          'Only upload content you have the right to use.',
          'Do not upload unlawful, harmful, or misleading material.',
          'Do not attempt to access other instructors’ data, probe the API, or disrupt the service.',
        ],
      },
      {
        h: 'AI-assisted drafting',
        items: [
          'Generated questions are drafts — you review, edit, and approve them before they are used.',
          'Every AI draft is grounded in your uploaded materials and must cite its evidence before approval.',
          'You are responsible for the accuracy and appropriateness of the exams you finalize and distribute.',
        ],
      },
      {
        h: 'Availability',
        p: 'The service is provided “as is.” We aim for reliability but do not guarantee uninterrupted availability. Back up exams and results you depend on.',
      },
      {
        h: 'Changes & termination',
        p: 'We may update these terms; continued use means acceptance. Accounts may be suspended for misuse. You may stop using the service at any time.',
      },
      {
        h: 'Liability',
        p: 'To the extent permitted by law, the institution and its service providers are not liable for indirect damages arising from use of the service.',
      },
    ],
  },
};

export default function LegalPage({ doc = 'privacy' }) {
  const d = DOCS[doc] || DOCS.privacy;
  return (
    <div className="legal-page">
      <header className="legal-top">
        <Link to="/" className="legal-brand">
          <img src="/favicon.png" alt="" />
          <span>nexam</span>
        </Link>
        <Link to="/login" className="legal-back"><ArrowLeft size={14} /> Back to sign in</Link>
      </header>

      <main className="legal-doc">
        <h1>{d.title}</h1>
        <p className="legal-updated">Last updated: {d.updated}</p>
        <p className="legal-intro">{d.intro}</p>

        {d.sections.map((s) => (
          <section key={s.h} className="legal-section">
            <h2>{s.h}</h2>
            {s.p && <p>{s.p}</p>}
            {s.items && (
              <ul>
                {s.items.map((it) => <li key={it}>{it}</li>)}
              </ul>
            )}
          </section>
        ))}

        <footer className="legal-foot">
          <Link to="/terms" className={doc === 'terms' ? 'is-active' : ''}>Terms of Use</Link>
          <span aria-hidden="true">·</span>
          <Link to="/privacy" className={doc === 'privacy' ? 'is-active' : ''}>Data Privacy</Link>
          <span aria-hidden="true">·</span>
          <Link to="/login">Sign in</Link>
        </footer>
      </main>
    </div>
  );
}
