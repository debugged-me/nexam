/**
 * DetailsModal — read-only record view.
 * Used as the "Read more" / "View details" target wherever list rows truncate
 * text, so the full value is always one click away. `fields` values may be
 * strings, numbers, or JSX (e.g. a StatusPill); empty values are skipped.
 */
import Modal from './Modal.jsx';

export default function DetailsModal({ open, title, subtitle, fields = [], onClose }) {
  const rows = fields.filter((f) => f.value !== undefined && f.value !== null && f.value !== '');
  return (
    <Modal open={open} title={title} subtitle={subtitle} onClose={onClose}>
      <dl className="detail-list">
        {rows.map((f) => (
          <div className="detail-list-row" key={f.label}>
            <dt>{f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
