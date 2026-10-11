/**
 * insights.test.js — unit tests for the analytics insight-derivation rules.
 */
import { describe, it, expect } from 'vitest';
import { buildInsights, bloomGroupRate, LOWER_ORDER, HIGHER_ORDER } from './insights.js';

describe('bloomGroupRate', () => {
  const blooms = [
    { bloom: 'remember', correct_count: 80, responses: 100 },
    { bloom: 'understand', correct_count: 60, responses: 100 },
    { bloom: 'analyze', correct_count: 30, responses: 100 },
  ];

  it('weights by responses, not levels', () => {
    // (80+60)/200 = 70%
    expect(bloomGroupRate(blooms, LOWER_ORDER)).toBeCloseTo(70);
    expect(bloomGroupRate(blooms, HIGHER_ORDER)).toBeCloseTo(30);
  });

  it('returns null when no matching responses', () => {
    expect(bloomGroupRate(blooms, ['create'])).toBeNull();
    expect(bloomGroupRate([], LOWER_ORDER)).toBeNull();
    expect(bloomGroupRate(null, LOWER_ORDER)).toBeNull();
  });
});

describe('buildInsights', () => {
  it('is silent with no data', () => {
    expect(buildInsights({})).toEqual([]);
    expect(buildInsights({ themes: [], bloomLevels: [] })).toEqual([]);
  });

  it('ignores topics with fewer than 3 responses', () => {
    const out = buildInsights({
      themes: [{ topic: 'Noise', correctRate: 10, responses: 2 }],
    });
    expect(out).toEqual([]);
  });

  it('flags the weakest topic below 60%', () => {
    const out = buildInsights({
      themes: [
        { topic: 'Weak', correctRate: 41, responses: 34 },
        { topic: 'Strong', correctRate: 88, responses: 20 },
      ],
    });
    expect(out.some((i) => i.tone === 'warn' && i.text.includes('Weak') && i.text.includes('41%'))).toBe(true);
    expect(out.some((i) => i.tone === 'good' && i.text.includes('Strong'))).toBe(true);
  });

  it('does not double-report a single topic as both weak and strong', () => {
    const out = buildInsights({
      themes: [{ topic: 'Only', correctRate: 90, responses: 10 }],
    });
    expect(out.filter((i) => i.text.includes('Only'))).toHaveLength(1);
    expect(out[0].tone).toBe('good');
  });

  it('detects the higher-order gap at ≥10 pts', () => {
    const out = buildInsights({
      bloomLevels: [
        { bloom: 'remember', correct_count: 80, responses: 100 },
        { bloom: 'analyze', correct_count: 50, responses: 100 },
      ],
    });
    const gap = out.find((i) => i.icon === 'layers');
    expect(gap).toBeTruthy();
    expect(gap.tone).toBe('warn');
    expect(gap.text).toContain('30 pts');
  });

  it('praises higher-order strength at ≥10 pts above lower-order', () => {
    const out = buildInsights({
      bloomLevels: [
        { bloom: 'remember', correct_count: 40, responses: 100 },
        { bloom: 'create', correct_count: 75, responses: 100 },
      ],
    });
    const gap = out.find((i) => i.icon === 'layers');
    expect(gap.tone).toBe('good');
  });

  it('stays quiet on small bloom gaps', () => {
    const out = buildInsights({
      bloomLevels: [
        { bloom: 'remember', correct_count: 70, responses: 100 },
        { bloom: 'analyze', correct_count: 65, responses: 100 },
      ],
    });
    expect(out.find((i) => i.icon === 'layers')).toBeUndefined();
  });

  it('reports pass rate per the 75% threshold', () => {
    const bad = buildInsights({ stats: { total_scans: 20, passing_count: 5 } });
    expect(bad.some((i) => i.tone === 'warn' && i.text.includes('25%'))).toBe(true);

    const good = buildInsights({ stats: { total_scans: 20, passing_count: 18 } });
    expect(good.some((i) => i.tone === 'good' && i.text.includes('90%'))).toBe(true);
  });

  it('flags non-equivalent parallel sets at ≥8 pts', () => {
    const out = buildInsights({
      setComparison: [
        { set_label: 'A', avg_score: 78 },
        { set_label: 'B', avg_score: 64 },
      ],
    });
    expect(out.some((i) => i.text.includes('Set A') && i.text.includes('78.0%') && i.text.includes('64.0%'))).toBe(true);
  });

  it('accepts equivalent sets silently', () => {
    const out = buildInsights({
      setComparison: [
        { set_label: 'A', avg_score: 70 },
        { set_label: 'B', avg_score: 68 },
      ],
    });
    expect(out.some((i) => i.text.includes('Set A averages'))).toBe(false);
  });

  it('reads trend direction at ≥3 pts', () => {
    const trend = [
      { avg_score: 60 }, { avg_score: 62 }, // older half
      { avg_score: 75 }, { avg_score: 77 }, // recent half
    ];
    const out = buildInsights({ trend });
    const t = out.find((i) => i.icon === 'up');
    expect(t).toBeTruthy();
    expect(t.tone).toBe('good');
    expect(t.text).toContain('trending up');
  });

  it('needs ≥4 scan days before drawing a trend', () => {
    const out = buildInsights({ trend: [{ avg_score: 50 }, { avg_score: 90 }] });
    expect(out.find((i) => i.icon === 'up' || i.icon === 'down')).toBeUndefined();
  });

  it('warns about pending reviews with correct pluralization', () => {
    expect(buildInsights({ pendingReviews: 1 })[0].text).toContain('sheet is');
    expect(buildInsights({ pendingReviews: 3 })[0].text).toContain('sheets are');
  });
});
