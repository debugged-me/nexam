const BLOOM_ORDER = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];

/** Integer allocation with largest remainders; result always sums to total. */
export function largestRemainder(total, weights, keys = Object.keys(weights)) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const normalized = keys.map((key) => Math.max(0, Number(weights[key]) || 0));
  const weightTotal = normalized.reduce((sum, value) => sum + value, 0);
  if (safeTotal > 0 && weightTotal <= 0) throw new Error('Allocation weights must contain a positive value.');
  const exact = normalized.map((weight) => safeTotal * weight / (weightTotal || 1));
  const result = exact.map(Math.floor);
  let remaining = safeTotal - result.reduce((sum, value) => sum + value, 0);
  const order = exact.map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let i = 0; i < remaining; i++) result[order[i % order.length].index]++;
  return Object.fromEntries(keys.map((key, index) => [key, result[index]]));
}

function allocateWithCaps(total, caps, keys) {
  const available = keys.reduce((sum, key) => sum + caps[key], 0);
  if (total > available) throw new Error('TOS allocation exceeds remaining Bloom capacity.');
  if (total === 0) return Object.fromEntries(keys.map((key) => [key, 0]));
  const exact = keys.map((key) => total * caps[key] / available);
  const allocated = exact.map((value, index) => Math.min(caps[keys[index]], Math.floor(value)));
  let remaining = total - allocated.reduce((sum, value) => sum + value, 0);
  while (remaining > 0) {
    const candidates = keys.map((key, index) => ({
      index,
      room: caps[key] - allocated[index],
      fraction: exact[index] - Math.floor(exact[index]),
    })).filter((candidate) => candidate.room > 0)
      .sort((a, b) => b.fraction - a.fraction || b.room - a.room || a.index - b.index);
    if (!candidates.length) throw new Error('Unable to complete TOS allocation.');
    allocated[candidates[0].index]++;
    remaining--;
  }
  return Object.fromEntries(keys.map((key, index) => [key, allocated[index]]));
}

/**
 * Build an exact topic × Bloom matrix. Row totals equal topic item_count and
 * column totals equal the TOS Bloom allocation.
 */
export function buildTosMatrix(topics, bloomWeights, totalItems) {
  const total = Number(totalItems) || 0;
  const topicTotal = topics.reduce((sum, topic) => sum + Number(topic.item_count || 0), 0);
  if (!topics.length) throw new Error('TOS has no topics.');
  if (topicTotal !== total) throw new Error(`Topic allocations total ${topicTotal}; expected ${total}.`);

  const bloomTargets = largestRemainder(total, bloomWeights, BLOOM_ORDER);
  const remaining = { ...bloomTargets };
  const slots = [];
  topics.forEach((topic, topicIndex) => {
    const rowTotal = Number(topic.item_count || 0);
    const row = topicIndex === topics.length - 1
      ? { ...remaining }
      : allocateWithCaps(rowTotal, remaining, BLOOM_ORDER);
    const rowSum = BLOOM_ORDER.reduce((sum, bloom) => sum + row[bloom], 0);
    if (rowSum !== rowTotal) throw new Error(`Could not allocate topic "${topic.title}" exactly.`);
    for (const bloom of BLOOM_ORDER) {
      remaining[bloom] -= row[bloom];
      if (row[bloom] > 0) slots.push({ topic: topic.title, bloom, count: row[bloom] });
    }
  });
  if (BLOOM_ORDER.some((bloom) => remaining[bloom] !== 0)) {
    throw new Error('TOS matrix did not consume every Bloom allocation.');
  }
  return { slots, bloomTargets };
}

export function validateAlignedQuestions(questions, topics, bloomWeights, totalItems) {
  const { slots } = buildTosMatrix(topics, bloomWeights, totalItems);
  const actual = new Map();
  for (const question of questions) {
    const key = `${question.topic || ''}\u0000${question.bloom || ''}`;
    actual.set(key, (actual.get(key) || 0) + 1);
  }
  const shortages = [];
  for (const slot of slots) {
    const key = `${slot.topic}\u0000${slot.bloom}`;
    const count = actual.get(key) || 0;
    if (count !== slot.count) shortages.push({ ...slot, actual: count });
    actual.delete(key);
  }
  const unexpected = [...actual.entries()].filter(([, count]) => count > 0)
    .map(([key, count]) => {
      const [topic, bloom] = key.split('\u0000');
      return { topic, bloom, count };
    });
  return {
    ok: questions.length === Number(totalItems) && shortages.length === 0 && unexpected.length === 0,
    shortages,
    unexpected,
  };
}

export { BLOOM_ORDER };

