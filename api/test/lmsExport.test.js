/**
 * lmsExport.test.js — GIFT/XML export + round-trip tests (node --test).
 * Run: node --test test/lmsExport.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toGIFT, toCanvasXML, parseGIFT, parseCanvasXML, parseMoodleXML, normalizeImportItem } from '../src/services/lmsExport.js';

const MCQ = {
  type: 'mcq',
  stem: 'What is the capital of France?',
  options: ['Mumbai', 'Paris', 'London', 'Berlin'],
  answer: 'Paris',
};

test('GIFT: mcq emits all options with = marker on the correct one', () => {
  const out = toGIFT([MCQ]);
  assert.match(out, /=Paris/);
  assert.match(out, /~Mumbai/);
  assert.match(out, /~London/);
  assert.match(out, /~Berlin/);
  // the historical bug joined the wrong var and produced 'A B C D' fragments
  assert.doesNotMatch(out, /\{=A ~B ~C ~D\}/);
});

test('GIFT: letter answer resolves to option text', () => {
  const out = toGIFT([{ ...MCQ, answer: 'B' }]);
  assert.match(out, /=Paris/);
});

test('GIFT: multi-word options survive round-trip', () => {
  const q = { ...MCQ, stem: 'Largest US city?', options: ['New York', 'Los Angeles', 'Chicago'], answer: 'New York' };
  const out = toGIFT([q]);
  const parsed = parseGIFT(out);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].type, 'mcq');
  assert.equal(parsed[0].answer, 'New York');
  assert.ok(parsed[0].options.includes('Los Angeles'));
  assert.equal(parsed[0].options.length, 3);
});

test('GIFT: true_false round-trips', () => {
  const q = { type: 'true_false', stem: 'The sky is blue.', answer: 'True' };
  const out = toGIFT([q]);
  assert.match(out, /TRUE|T\}/i);
  const parsed = parseGIFT(out);
  assert.equal(parsed[0].type, 'true_false');
});

test('GIFT: matching round-trips with premise->option pairs', () => {
  const q = { type: 'matching', stem: 'Match planets', options: ['Sun', 'Mercury', 'Venus', 'Earth'], answer: '1-B, 2-A, 3-D, 4-C' };
  const out = toGIFT([q]);
  const parsed = parseGIFT(out);
  assert.equal(parsed[0].type, 'matching');
});

test('GIFT: identification is NOT misread as 1-option mcq', () => {
  const q = { type: 'identification', stem: 'First US president?', answer: 'Washington' };
  const out = toGIFT([q]);
  const parsed = parseGIFT(out);
  assert.equal(parsed[0].type, 'identification');
});

test('XML: entities escaped on export, decoded on import', () => {
  const q = { ...MCQ, stem: 'A & B <tag> "quoted"', answer: 'Paris' };
  const out = toCanvasXML([q]);
  assert.match(out, /&amp;/);
  assert.doesNotMatch(out, /<tag>/);
  const parsed = parseCanvasXML(out);
  assert.equal(parsed[0].stem, 'A & B <tag> "quoted"');
});

test('XML: mcq round-trips with answer resolved', () => {
  const parsed = parseCanvasXML(toCanvasXML([MCQ]));
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].type, 'mcq');
  assert.equal(parsed[0].answer, 'Paris');
});

// Canvas-native QTI: <varequal> holds the response_label ident (not an index),
// and respident names the response field — the old parser indexed by respident
// and produced blank answers.
const CANVAS_NATIVE = `<?xml version="1.0"?>
<questestinterop><assessment><section ident="root">
<item ident="q1"><itemmetadata/>
<presentation><material><mattext>Capital of France?</mattext></material>
<response_lid ident="r1"><render_choice>
<response_label ident="a"><material><mattext>Paris</mattext></material></response_label>
<response_label ident="b"><material><mattext>Lyon</mattext></material></response_label>
</render_choice></response_lid></presentation>
<resprocessing><respcondition><conditionvar><varequal respident="r1">a</varequal></conditionvar></respcondition></resprocessing>
</item>
<item ident="q2"><itemmetadata/>
<presentation><material><mattext>Water boils at 100C.</mattext></material>
<response_lid ident="r2"><render_choice>
<response_label ident="t"><material><mattext>True</mattext></material></response_label>
<response_label ident="f"><material><mattext>False</mattext></material></response_label>
</render_choice></response_lid></presentation>
<resprocessing><respcondition><conditionvar><varequal respident="r2">t</varequal></conditionvar></respcondition></resprocessing>
</item>
</section></assessment></questestinterop>`;

test('XML: Canvas-native varequal resolves via response_label ident', () => {
  const parsed = parseCanvasXML(CANVAS_NATIVE);
  assert.equal(parsed[0].type, 'mcq');
  assert.equal(parsed[0].answer, 'Paris');
});

test('XML: true_false resolves the ident, not a regex on respident', () => {
  const parsed = parseCanvasXML(CANVAS_NATIVE);
  assert.equal(parsed[1].type, 'true_false');
  assert.equal(parsed[1].answer, 'True');
});

test('normalizeImportItem: matching converts to lettered pool + premise stem', () => {
  const parsed = parseGIFT('::M:: Match capitals.\n{ =France -> Paris\n  =Japan -> Tokyo\n  =Egypt -> Cairo }');
  const { data } = normalizeImportItem(parsed[0], 0);
  assert.equal(data.type, 'matching');
  assert.equal(data.options.length, 3);
  assert.ok(data.options.includes('Paris') && data.options.includes('Tokyo') && data.options.includes('Cairo'));
  assert.match(data.answer, /^1-[A-C],2-[A-C],3-[A-C]$/);
  // France is premise 1 and Paris is its match — the letter must line up.
  assert.equal(data.answer[2], 'ABC'[data.options.indexOf('Paris')]);
  assert.match(data.stem, /1\. France\n2\. Japan\n3\. Egypt/);
});

test('normalizeImportItem: mcq skips when answer resolves to no option', () => {
  const { skip } = normalizeImportItem({ type: 'mcq', stem: 'S?', options: ['a', 'b'], answer: 'z' }, 4);
  assert.match(skip, /#5/);
});

test('normalizeImportItem: letter answers on MCQ pass resolution', () => {
  const { data } = normalizeImportItem({ type: 'mcq', stem: 'S?', options: ['a', 'b'], answer: 'B' }, 0);
  assert.equal(data.type, 'mcq');
});

test('normalizeImportItem: matching pool over 5 choices is skipped (OMR A–E)', () => {
  const q = {
    type: 'matching', stem: 'M',
    options: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'],
    answer: '1-m1, 2-m2, 3-m3, 4-m4, 5-m5, 6-m6',
  };
  const { skip } = normalizeImportItem(q, 0);
  assert.match(skip, /at most 5/);
});

// Real Moodle question-bank export: <quiz> root, <question type="…">,
// CDATA-wrapped HTML, fraction="100" marks the correct option, and
// type="category" entries are structural (skipped silently).
const MOODLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<quiz>
  <question type="category">
    <category><text>$course$/top/Program/Post-Test</text></category>
  </question>
  <question type="multichoice">
    <name><text>Post-Test 01</text></name>
    <questiontext format="html"><text><![CDATA[<p>What is the primary purpose of the program?</p>]]></text></questiontext>
    <answer fraction="0" format="html"><text><![CDATA[To evaluate teachers for promotion]]></text></answer>
    <answer fraction="100" format="html"><text><![CDATA[To help beginning teachers adjust]]></text></answer>
    <answer fraction="0" format="html"><text><![CDATA[To replace school-based development]]></text></answer>
  </question>
  <question type="truefalse">
    <name><text>Post-Test 31</text></name>
    <questiontext format="html"><text><![CDATA[<p>Mentoring is optional.</p>]]></text></questiontext>
    <answer fraction="0" format="html"><text><![CDATA[True]]></text></answer>
    <answer fraction="100" format="html"><text><![CDATA[False]]></text></answer>
  </question>
  <question type="shortanswer">
    <name><text>Post-Test 40</text></name>
    <questiontext format="html"><text><![CDATA[<p>The standards document is called:</p>]]></text></questiontext>
    <answer fraction="100" format="html"><text><![CDATA[PPST]]></text></answer>
  </question>
  <question type="essay">
    <name><text>Post-Test 50</text></name>
    <questiontext format="html"><text><![CDATA[<p>Reflect on your practice.</p>]]></text></questiontext>
  </question>
</quiz>`;

test('Moodle XML: categories skipped, multichoice resolves fraction=100', () => {
  const parsed = parseMoodleXML(MOODLE_XML);
  assert.equal(parsed.length, 4); // 5 question nodes, 1 category
  assert.equal(parsed[0].type, 'mcq');
  assert.equal(parsed[0].stem, 'What is the primary purpose of the program?');
  assert.equal(parsed[0].answer, 'To help beginning teachers adjust');
  assert.equal(parsed[0].options.length, 3);
});

test('Moodle XML: truefalse resolves fraction-marked False', () => {
  const parsed = parseMoodleXML(MOODLE_XML);
  assert.equal(parsed[1].type, 'true_false');
  assert.equal(parsed[1].answer, 'False');
});

test('Moodle XML: shortanswer becomes identification; essay survives for skip-reporting', () => {
  const parsed = parseMoodleXML(MOODLE_XML);
  assert.equal(parsed[2].type, 'identification');
  assert.equal(parsed[2].answer, 'PPST');
  assert.equal(parsed[3].type, 'moodle_essay');
  assert.match(normalizeImportItem(parsed[3], 3).skip, /unsupported type/);
});

// Character references left behind by one-layer decoding ("school&#x27;s").
test('Moodle XML: hex and named HTML entities inside CDATA decode to text', () => {
  const xml = `<quiz><question type="multichoice">
    <questiontext format="html"><text><![CDATA[<p>If a teacher&rsquo;s learner is at risk, the teacher should:</p>]]></text></questiontext>
    <answer fraction="100" format="html"><text><![CDATA[Follow the school&#x27;s established procedures]]></text></answer>
    <answer fraction="0" format="html"><text><![CDATA[Ignore it &amp; move on]]></text></answer>
  </question></quiz>`;
  const [q] = parseMoodleXML(xml);
  assert.equal(q.stem, 'If a teacher’s learner is at risk, the teacher should:');
  assert.deepEqual(q.options, ["Follow the school's established procedures", 'Ignore it & move on']);
  assert.equal(q.answer, "Follow the school's established procedures");
});

test('Moodle XML: escaped HTML without CDATA strips tags after the XML layer', () => {
  const xml = `<quiz><question type="truefalse">
    <questiontext format="html"><text>&lt;p&gt;It&amp;#39;s &amp;lt;b&amp;gt; that bolds text.&lt;/p&gt;</text></questiontext>
    <answer fraction="100"><text>True</text></answer>
    <answer fraction="0"><text>False</text></answer>
  </question></quiz>`;
  const [q] = parseMoodleXML(xml);
  // One decode per layer: the author's literal "&lt;b&gt;" survives as "<b>" text.
  assert.equal(q.stem, "It's <b> that bolds text.");
});

test('Canvas XML: escaped rich text is unwrapped; plain text keeps literal entities', () => {
  const rich = `<questestinterop><item ident="1"><presentation><material>
    <mattext texttype="text/html">&lt;p&gt;Follow the school&amp;#x27;s procedure&lt;/p&gt;</mattext></material>
    <response_lid ident="r"><render_choice>
      <response_label ident="a"><material><mattext>Yes</mattext></material></response_label>
      <response_label ident="b"><material><mattext>No</mattext></material></response_label>
    </render_choice></response_lid></presentation>
    <resprocessing><respcondition><conditionvar><varequal respident="r">a</varequal></conditionvar></respcondition></resprocessing>
  </item></questestinterop>`;
  assert.equal(parseCanvasXML(rich)[0].stem, "Follow the school's procedure");

  const literal = { ...MCQ, stem: 'What does &nbsp; mean in HTML?', answer: 'Paris' };
  assert.equal(parseCanvasXML(toCanvasXML([literal]))[0].stem, 'What does &nbsp; mean in HTML?');
});
