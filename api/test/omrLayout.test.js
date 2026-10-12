/** OMR sheet auto-fit layout — layoutFor must keep every item on the sheet
 * by growing rows and shrinking pitch, and report the geometry the scanner
 * will read back from the QR `ly` block. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutFor } from '../src/services/omrService.js';

const mcq = () => ({ type: 'mcq', options: JSON.stringify(['A', 'B', 'C', 'D']) });
const tf = () => ({ type: 'true_false' });
const matching = (n = 5) => ({ type: 'matching', options: JSON.stringify(Array.from({ length: n }, (_, i) => `P${i}`)) });

test('layoutFor keeps the default grid for a small exam', () => {
  const layout = layoutFor(Array.from({ length: 20 }, mcq));
  assert.equal(layout.rowsPerCol, 25);
  assert.equal(layout.rowH, 30);
  assert.equal(new Set(layout.assignments.map((r) => r.item)).size, 20);
});

test('layoutFor fits 50 items plus matching rows by shrinking pitch', () => {
  // 50 items where one is a 5-premise matching → 54 grid rows needed.
  const questions = Array.from({ length: 50 }, (_, i) => (i === 8 ? matching(5) : mcq()));
  const layout = layoutFor(questions);
  assert.ok(layout.rowsPerCol >= 27, `expected ≥27 rows/col, got ${layout.rowsPerCol}`);
  assert.ok(layout.rowH <= 30 && layout.rowH >= 24, `pitch in [24,30], got ${layout.rowH}`);
  assert.ok(layout.rowH * layout.rowsPerCol <= 750, 'grid must stay inside GRID_Y→GRID_BOTTOM');
  const rendered = new Set(layout.assignments.map((r) => r.item));
  assert.equal(rendered.size, 50);
  // Matching never splits across a column boundary.
  const matchRows = layout.assignments.filter((r) => r.item === 9);
  assert.equal(matchRows.length, 5);
  assert.equal(new Set(matchRows.map((r) => r.col)).size, 1);
});

test('layoutFor reports unrenderable items for extreme sets', () => {
  // 70 items with several matching blocks — beyond even the pitch floor.
  const questions = Array.from({ length: 70 }, (_, i) => (i % 10 === 0 ? matching(8) : mcq()));
  const layout = layoutFor(questions);
  const rendered = new Set(layout.assignments.map((r) => r.item)).size;
  assert.ok(rendered < 70, 'extreme set should still report overflow');
  assert.ok(layout.rowH >= 24, 'pitch never goes below the legibility floor');
});
