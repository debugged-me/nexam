/**
 * ExportDialog — shared "print or export" sheet.
 *
 * Rendered as a right-side Modal sheet (the same chrome as detail panels)
 * so export feels like part of the workspace instead of a stock dialog.
 * The page owns the scope state and renders its fields inside the `Scope`
 * section via children; `count`/`noun` report the live match back.
 *
 * Every format uses the existing machinery — print goes through the
 * page's print-doc + window.print(), files through lib/exports.js.
 */
import { useState } from 'react';
import { Check, Download, FileSpreadsheet, FileText, Printer } from 'lucide-react';
import Modal from './Modal.jsx';

const FORMATS = [
  { id: 'print', label: 'Print / PDF', hint: 'Paper-ready report via the print dialog', icon: Printer },
  { id: 'xlsx', label: 'Excel workbook', hint: 'Styled .xlsx — titles, filters, tinted cells', icon: FileSpreadsheet },
  { id: 'csv', label: 'CSV file', hint: 'Plain comma-separated export for records', icon: FileText },
];

const CTA = {
  print: { label: 'Print report', icon: Printer },
  xlsx: { label: 'Download .xlsx', icon: FileSpreadsheet },
  csv: { label: 'Download .csv', icon: FileText },
};

export default function ExportDialog({ title, subtitle, count = 0, noun = 'row', hint, onRun, onClose, children }) {
  const [fmt, setFmt] = useState('print');
  const C = CTA[fmt];

  return (
    <Modal
      open
      side
      title={title}
      subtitle={subtitle}
      icon={Download}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={() => onRun(fmt)} disabled={count === 0}>
            <C.icon size={15} aria-hidden="true" /> {C.label}
          </button>
        </>
      )}
    >
      <div className="exp">
        <div className="form-section-title">Format</div>
        <div className="exp-fmts" role="radiogroup" aria-label="Format">
          {FORMATS.map(({ id, label, hint: h, icon: Icon }) => (
            <button
              type="button"
              key={id}
              role="radio"
              aria-checked={fmt === id}
              className={`exp-fmt${fmt === id ? ' is-on' : ''}`}
              onClick={() => setFmt(id)}
            >
              <span className="exp-fmt-ico"><Icon size={16} aria-hidden="true" /></span>
              <span className="exp-fmt-body">
                <span className="exp-fmt-name">{label}</span>
                <span className="exp-fmt-hint">{h}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="form-section-title">Scope</div>
        {children}

        <div className="exp-count">
          <span className="exp-count-n">{count}</span>
          <span>{count === 1 ? noun : `${noun}s`} will be included</span>
        </div>
        {hint && <p className="meta-sm text-muted">{hint}</p>}
      </div>
    </Modal>
  );
}

/**
 * ExportSections — multi-select rows for report-style exports (analytics
 * overview and exam reports), where the scope is which sections ship.
 * defs: [{ id, label, rows }] — rows drives the count and disables empty
 * sections. value/onChange: array of enabled ids.
 */
export function ExportSections({ defs, value, onChange }) {
  return (
    <div className="exp-secs">
      {defs.map(({ id, label, rows }) => {
        const on = value.includes(id);
        return (
          <button
            type="button"
            key={id}
            role="checkbox"
            aria-checked={on}
            disabled={!rows}
            className={`exp-sec${on ? ' is-on' : ''}`}
            onClick={() => onChange(on ? value.filter((x) => x !== id) : [...value, id])}
          >
            <span className="exp-sec-check"><Check size={12} aria-hidden="true" /></span>
            <span className="exp-sec-name">{label}</span>
            <span className="exp-sec-n">{rows} row{rows === 1 ? '' : 's'}</span>
          </button>
        );
      })}
    </div>
  );
}
