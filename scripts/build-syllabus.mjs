#!/usr/bin/env node
/**
 * Build the typed syllabus bundle for the app from the official-source data.
 *
 * Input  : legacy/src/data/{physics_a,physics_b,chem_a,chem_b,math}.json
 *          (compact form; every subtopic string is taken verbatim from the
 *           official NTA JEE Main 2026 and JEE Advanced 2026 syllabus PDFs)
 * Output : src/data/syllabus.json
 *
 * The decode rules are a faithful port of the original Python builder
 * (legacy/build_syllabus.py) so ids stay stable and previously exported user
 * data keeps pointing at the same nodes.
 *
 *   node scripts/build-syllabus.mjs [--check]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LEGACY_DATA = join(ROOT, 'legacy', 'src', 'data');
const OUT = join(ROOT, 'src', 'data', 'syllabus.json');

const MARKERS = { b: { jm: true, ja: true }, m: { jm: true, ja: false }, a: { jm: false, ja: true } };

const slug = (text) =>
  text
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[/]/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-') || 'x';

function decodeChapter(raw, subjectCode, index) {
  let jm = false;
  let ja = false;
  const topics = (raw.topics ?? []).map((t, ti) => {
    const marker = MARKERS[t.e];
    if (!marker) throw new Error(`unknown marker "${t.e}" in ${raw.n}`);
    let tjm = marker.jm;
    let tja = marker.ja;
    const id = `${subjectCode}.c${index}.t${ti}`;
    const subs = (t.subs ?? []).map((s, si) => {
      const [mark, ...rest] = String(s).split(': ');
      const m = MARKERS[String(mark).trim()];
      if (!m) throw new Error(`unknown subtopic marker "${mark}" in ${raw.n} > ${t.n}`);
      const name = rest.join(': ').trim();
      tjm = tjm || m.jm;
      tja = tja || m.ja;
      return { id: `${id}.s${si}`, name, jm: m.jm, ja: m.ja, slug: slug(name) };
    });
    jm = jm || tjm;
    ja = ja || tja;
    const topic = { id, name: t.n, jm: tjm, ja: tja, slug: slug(t.n) };
    if (t.note) topic.note = t.note;
    topic.subs = subs;
    return topic;
  });
  const chapter = {
    id: `${subjectCode}.c${index}`,
    name: raw.n,
    unit: raw.unit ?? '',
    jm,
    ja,
    slug: slug(raw.n),
    topics,
  };
  for (const key of ['srcJM', 'srcJA', 'note']) if (raw[key]) chapter[key] = raw[key];
  return chapter;
}

function loadSubject(files, subjectCode) {
  const chapters = [];
  for (const file of files) {
    const raw = JSON.parse(readFileSync(join(LEGACY_DATA, file), 'utf8'));
    for (const c of raw.chapters ?? []) chapters.push(decodeChapter(c, subjectCode, chapters.length));
  }
  return chapters;
}

const subjects = [
  { name: 'Physics', code: 'phy', files: ['physics_a.json', 'physics_b.json'] },
  { name: 'Chemistry', code: 'chem', files: ['chem_a.json', 'chem_b.json'] },
  { name: 'Mathematics', code: 'math', files: ['math.json'] },
].map(({ name, code, files }) => ({ name, code, chapters: loadSubject(files, code) }));

const meta = JSON.parse(readFileSync(join(LEGACY_DATA, 'syllabus.full.json'), 'utf8')).meta;

const syllabus = { meta, subjects };

// ---------------------------------------------------------------- validation
const seen = new Set();
let chapters = 0;
let topics = 0;
let subtopics = 0;
let jm = 0;
let ja = 0;
let both = 0;

for (const subject of syllabus.subjects) {
  if (!subject.chapters.length) throw new Error(`${subject.name} has no chapters`);
  for (const chapter of subject.chapters) {
    chapters += 1;
    if (seen.has(chapter.id)) throw new Error(`duplicate id ${chapter.id}`);
    seen.add(chapter.id);
    if (!chapter.topics.length) throw new Error(`${chapter.id} has no topics`);
    for (const topic of chapter.topics) {
      topics += 1;
      if (seen.has(topic.id)) throw new Error(`duplicate id ${topic.id}`);
      seen.add(topic.id);
      if (!topic.subs.length) throw new Error(`${topic.id} has no subtopics`);
      for (const sub of topic.subs) {
        subtopics += 1;
        if (seen.has(sub.id)) throw new Error(`duplicate id ${sub.id}`);
        seen.add(sub.id);
        if (!sub.name.trim()) throw new Error(`${sub.id} has an empty name`);
        if (sub.jm && sub.ja) both += 1;
        if (sub.jm) jm += 1;
        if (sub.ja) ja += 1;
      }
    }
  }
}

// Verified against the official 2026 documents on 2026-09-24. A rebuild may add
// chapters but must never silently lose them.
const expected = {
  Physics: { chapters: 21, topics: 72, subtopics: 284 },
  Chemistry: { chapters: 30, topics: 100, subtopics: 394 },
  Mathematics: { chapters: 15, topics: 31, subtopics: 165 },
};

const stats = syllabus.subjects.map((s) => ({
  subject: s.name,
  chapters: s.chapters.length,
  topics: s.chapters.reduce((a, c) => a + c.topics.length, 0),
  subtopics: s.chapters.reduce((a, c) => a + c.topics.reduce((b, t) => b + t.subs.length, 0), 0),
}));

// The counts above are a guard against silent data loss during a rebuild.
for (const row of stats) {
  const exp = expected[row.subject];
  if (exp && (row.chapters < exp.chapters || row.topics < exp.topics || row.subtopics < exp.subtopics)) {
    throw new Error(
      `syllabus shrank for ${row.subject}: ${JSON.stringify(row)} < ${JSON.stringify(exp)}`,
    );
  }
}

if (process.argv.includes('--check')) {
  if (!existsSync(OUT)) throw new Error('src/data/syllabus.json is missing - run without --check');
  const current = JSON.parse(readFileSync(OUT, 'utf8'));
  if (JSON.stringify(current) !== JSON.stringify(syllabus)) {
    throw new Error('src/data/syllabus.json is out of date - re-run npm run build:syllabus');
  }
  console.log('syllabus bundle is up to date');
} else {
  writeFileSync(OUT, JSON.stringify(syllabus));
  console.log('wrote', OUT);
}

console.log(
  `subjects=${syllabus.subjects.length} chapters=${chapters} topics=${topics} subtopics=${subtopics} ` +
    `(JM leaves ${jm}, JA leaves ${ja}, both ${both})`,
);
for (const row of stats) {
  console.log(`  ${row.subject.padEnd(12)} chapters=${row.chapters} topics=${row.topics} subtopics=${row.subtopics}`);
}
