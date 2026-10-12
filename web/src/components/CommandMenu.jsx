import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import {
  Search, ArrowUp, ArrowDown, CornerDownLeft, X,
  FileText, ClipboardList, BookOpen, Plus, Upload, CheckCircle,
  FileQuestion, FileUp,
} from 'lucide-react';
import { COMMAND_ITEMS } from './navigation.js';
import api from '../lib/api.js';

/** Command palette — page navigation, real create actions (deep links), and
 *  fuzzy search over the instructor's own exams / blueprints / subjects. */

const GROUP_LABELS = {
  home: 'Home',
  Workspace: 'Workspace',
  Assessment: 'Assessment',
  Institution: 'Institution',
};
const GROUP_ORDER = ['quick', 'home', 'Workspace', 'Assessment', 'Institution'];

// Items without a `group` (Build an exam, Account settings) lead the list.
const GROUPED = (() => {
  const map = new Map(GROUP_ORDER.map((g) => [g, []]));
  for (const item of COMMAND_ITEMS) {
    map.get(item.group && GROUP_LABELS[item.group] ? item.group : 'quick').push(item);
  }
  return [...map.entries()].filter(([, items]) => items.length);
})();

// Create/action items — every `to` is a real deep link the target page
// already honors (?new=1 opens the create modal, ?upload=1 the uploader,
// ?status= the filter).
const ACTIONS = [
  { key: 'act-question', label: 'New question', description: 'Open the question editor', icon: Plus, to: '/questions?new=1' },
  { key: 'act-blueprint', label: 'New blueprint', description: 'Start a table of specifications', icon: Plus, to: '/tos?new=1' },
  { key: 'act-subject', label: 'New subject', description: 'Create a subject', icon: Plus, to: '/subjects?new=1' },
  { key: 'act-exam', label: 'New exam', description: 'Assemble an exam manually', icon: Plus, to: '/exams/new' },
  { key: 'act-upload', label: 'Upload material', description: 'Add a reference file', icon: Upload, to: '/materials?upload=1' },
  { key: 'act-import', label: 'Import questions', description: 'Bulk-add questions from a file or paste', icon: FileUp, to: '/questions?import=1' },
  { key: 'act-drafts', label: 'Review drafts', description: 'Questions waiting for approval', icon: CheckCircle, to: '/questions?status=draft' },
];

export default function CommandMenu({ open, onClose }) {
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');
  // The menu mounts when opened, so api.peek is already warm when the lists
  // were visited this session — seed from cache, then fill gaps lazily.
  const [work, setWork] = useState(() => ({
    exams: api.peek('/exams')?.exams,
    tos: api.peek('/tos')?.tos,
    subjects: api.peek('/subjects')?.subjects,
    questions: api.peek('/questions?')?.questions ?? api.peek('/questions')?.questions,
  }));
  const navigate = useNavigate();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open) {
      dialog.showModal();
      inputRef.current?.focus();
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        dialog.close();
        document.body.style.overflow = previous;
      };
    }
  }, [open]);

  // Own-content search — fetch whichever lists weren't already cached.
  const needsFetch = !work.exams || !work.tos || !work.subjects || !work.questions;
  useEffect(() => {
    if (!open || !needsFetch) return;
    Promise.allSettled([api.get('/exams'), api.get('/tos'), api.get('/subjects'), api.get('/questions')])
      .then(([e, t, s, q]) => setWork((cur) => ({
        exams: e.status === 'fulfilled' ? e.value?.exams : (cur.exams || []),
        tos: t.status === 'fulfilled' ? t.value?.tos : (cur.tos || []),
        subjects: s.status === 'fulfilled' ? s.value?.subjects : (cur.subjects || []),
        questions: q.status === 'fulfilled' ? q.value?.questions : (cur.questions || []),
      })));
  }, [open, needsFetch]);

  function choose(item) {
    onClose();
    navigate(item.to);
  }

  // Content results only surface once the user is actually searching — the
  // resting palette stays a page navigator.
  const searching = query.trim().length >= 1;
  const workItems = searching && work ? [
    ...(work.exams || []).slice(0, 8).map((e) => ({
      key: `exam-${e.id}`, label: e.title, description: `Exam · ${e.subject_name || e.subject || ''}`.replace(/ · $/, ''),
      icon: FileText, to: `/exams/${e.id}`, keywords: ['exam', e.subject_name || e.subject || ''],
    })),
    ...(work.tos || []).slice(0, 6).map((t) => ({
      key: `tos-${t.id}`, label: t.title, description: `Blueprint · ${t.subject_name || t.subject || ''}`.replace(/ · $/, ''),
      icon: ClipboardList, to: `/tos/${t.id}`, keywords: ['blueprint', 'tos', t.subject_name || t.subject || ''],
    })),
    ...(work.subjects || []).slice(0, 6).map((s) => ({
      key: `subject-${s.id}`, label: s.name, description: 'Subject — open its question bank',
      icon: BookOpen, to: `/questions?subject_id=${s.id}`, keywords: ['subject', s.code || ''],
    })),
    // Questions are capped at 80 mounted items — enough to cover a typical
    // bank — so the palette stays light while stems remain searchable.
    ...(work.questions || []).slice(0, 80).map((q) => ({
      key: `question-${q.id}`,
      label: (q.stem || '').length > 80 ? `${q.stem.slice(0, 80)}…` : (q.stem || 'Untitled question'),
      description: `Question · ${q.subject_name || ''}${q.topic ? ` · ${q.topic}` : ''}`,
      icon: FileQuestion, to: `/questions?focus=${q.id}`,
      keywords: ['question', q.topic || '', q.bloom || '', q.subject_name || ''],
    })),
  ] : [];

  return (
    <dialog
      ref={dialogRef}
      className="command-dialog"
      aria-label="Go to a page"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <Command className="command-surface" label="Go to a page" loop>
        <div className="command-search">
          <Search size={20} aria-hidden="true" />
          <Command.Input
            ref={inputRef}
            value={query}
            onValueChange={setQuery}
            placeholder="Jump to a page, action, exam, blueprint…"
            aria-label="Search pages, actions, and your work"
          />
          <button
            type="button"
            className="command-close"
            aria-label="Close quick navigation"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <Command.List id="command-results" className="command-results" aria-label="Pages">
          <Command.Empty className="command-empty">
            Nothing matches “{query}”. Try a page, action, exam, or subject.
          </Command.Empty>
          {workItems.length > 0 && (
            <Command.Group heading="Your work">
              {workItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Command.Item
                    key={item.key}
                    value={item.label}
                    keywords={item.keywords}
                    onSelect={() => choose(item)}
                    className="command-option"
                  >
                    <span className="command-icon">
                      <Icon size={18} />
                    </span>
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>
                    <CornerDownLeft size={15} className="command-enter" aria-hidden="true" />
                  </Command.Item>
                );
              })}
            </Command.Group>
          )}
          <Command.Group heading="Actions">
              {ACTIONS.map((item) => {
                const Icon = item.icon;
                return (
                  <Command.Item
                    key={item.key}
                    value={item.label}
                    keywords={[item.description]}
                    onSelect={() => choose(item)}
                    className="command-option"
                  >
                    <span className="command-icon">
                      <Icon size={18} />
                    </span>
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>
                    <CornerDownLeft size={15} className="command-enter" aria-hidden="true" />
                  </Command.Item>
                );
              })}
          </Command.Group>
          {GROUPED.map(([group, items]) => (
            <Command.Group
              key={group}
              heading={group === 'quick' ? 'Quick actions' : GROUP_LABELS[group]}
            >
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <Command.Item
                    key={item.key}
                    value={item.label}
                    keywords={[item.description || '', GROUP_LABELS[item.group] || '']}
                    onSelect={() => choose(item)}
                    className="command-option"
                  >
                    <span className="command-icon">
                      <Icon size={18} />
                    </span>
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>
                    <CornerDownLeft size={15} className="command-enter" aria-hidden="true" />
                  </Command.Item>
                );
              })}
            </Command.Group>
          ))}
        </Command.List>
        <footer className="command-footer">
          <span>
            <ArrowUp size={12} />
            <ArrowDown size={12} /> to navigate
          </span>
          <span>
            <CornerDownLeft size={12} /> to open
          </span>
          <span>
            <kbd>esc</kbd> to close
          </span>
        </footer>
      </Command>
    </dialog>
  );
}
