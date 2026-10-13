/**
 * AI-knowledge questions — drafted from the model's general knowledge because
 * no uploaded lesson covered their blueprint cell. A second AI provider
 * fact-checked them, but the server requires the instructor's explicit
 * confirmation ({ confirmKnowledge: true }) before any approval.
 */
import { BookCheck } from 'lucide-react';

export const isKnowledgeQuestion = (q) => q?.source === 'ai' && q?.ai_grounding === 'knowledge';

/** True when the API refused an approval pending that confirmation. */
export const needsKnowledgeConfirm = (err) => err?.payload?.code === 'knowledge_confirmation_required';

/** Ask once for `count` questions; resolves true when the instructor confirms. */
export function confirmKnowledge(confirm, count = 1) {
  const many = count > 1;
  return confirm(
    `${many ? `${count} of these questions were` : 'This question was'} written from AI knowledge, not from your uploaded materials. ` +
    `A second AI fact-checked ${many ? 'them' : 'it'}, but only you can confirm the keyed ${many ? 'answers are' : 'answer is'} correct for your course. ` +
    'Approve only after checking against your lessons or textbook.',
    {
      title: many ? 'Confirm AI-knowledge answers' : 'Confirm an AI-knowledge answer',
      confirmText: many ? 'I checked them — approve' : 'I checked it — approve',
      danger: false,
      icon: BookCheck,
      tone: 'accent',
    },
  );
}
