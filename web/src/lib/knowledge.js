/** Historical AI-knowledge rows remain identifiable so the UI can explain why
 * they are blocked. New generation never creates this grounding mode. */

export const isKnowledgeQuestion = (q) => q?.source === 'ai' && q?.ai_grounding === 'knowledge';
