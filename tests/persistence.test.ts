/**
 * IndexedDB + migration + transfer tests.
 *
 * `fake-indexeddb/auto` installs a spec-compliant IndexedDB into the Node
 * globals, so the repository layer is exercised exactly as the browser does it
 * (open → upgrade → write → read → clear).
 */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearAllData, repositories } from '@/lib/repositories';
import { migrateLegacyState, scanLegacyStorage, schemaVersionOf } from '@/lib/db/migration';
import { buildSampleData } from '@/lib/db/sample';
import { buildExportEnvelope, parseImport, serializeBackup, serializeExport } from '@/lib/db/transfer';
import { defaultMeta, defaultSettings, defaultTimer } from '@/lib/db/defaults';
import { withIndex } from '@/lib/calculations/derive';
import { overallAnalytics } from '@/lib/calculations/analytics';
import { SCHEMA_VERSION } from '@/lib/constants';
import { dayOffset, mistake, progressRow, session, snapshot, task, testRecord, TODAY } from './helpers';

const SUB = 'phy.c0.t0.s0';

beforeEach(async () => {
  await clearAllData();
});

describe('entity repositories', () => {
  it('round-trips records through IndexedDB', async () => {
    const a = task({ title: 'Kinematics DPP' });
    const b = task({ title: 'Rotational motion PYQ' });
    await repositories.tasks.putMany([a, b]);

    expect((await repositories.tasks.list()).length).toBe(2);
    expect((await repositories.tasks.get(a.id))?.title).toBe('Kinematics DPP');

    const all = await repositories.tasks.list();
    expect(all.map((row) => row.title).sort()).toEqual(['Kinematics DPP', 'Rotational motion PYQ']);

    await repositories.tasks.remove([a.id]);
    expect((await repositories.tasks.list()).length).toBe(1);

    await repositories.tasks.clear();
    expect((await repositories.tasks.list()).length).toBe(0);
  });

  it('overwrites on putOne with the same id', async () => {
    const record = task({ title: 'First' });
    await repositories.tasks.put(record);
    await repositories.tasks.put({ ...record, title: 'Renamed' });
    expect((await repositories.tasks.list()).length).toBe(1);
    expect((await repositories.tasks.get(record.id))?.title).toBe('Renamed');
  });
});

describe('progress repository', () => {
  it('stores both exam scopes of one node as a single row', async () => {
    await repositories.progress.putRows([
      { nodeId: SUB, jm: progressRow({ status: 'completed', revisionCount: 2 }), ja: progressRow({ theory: 'done' }) },
    ]);

    const map = await repositories.progress.map();
    expect(map[SUB]?.jm?.status).toBe('completed');
    expect(map[SUB]?.jm?.revisionCount).toBe(2);
    expect(map[SUB]?.ja?.theory).toBe('done');
    expect(map[SUB]?.ja?.status).toBe('not_started');
  });

  it('drops rows on demand', async () => {
    await repositories.progress.putRows([{ nodeId: SUB, jm: progressRow() }]);
    await repositories.progress.remove([SUB]);
    expect(await repositories.progress.list()).toHaveLength(0);
  });
});

describe('singleton stores', () => {
  it('keeps one settings document', async () => {
    expect(await repositories.settings.get()).toBeUndefined();
    await repositories.settings.set(defaultSettings());
    const settings = await repositories.settings.get();
    expect(settings?.profile.dailyTargetMin).toBe(420);
  });

  it('stores meta, timer and the last AI plan', async () => {
    await repositories.meta.set(defaultMeta());
    await repositories.timer.set(defaultTimer());
    expect((await repositories.meta.get())?.schemaVersion).toBe(SCHEMA_VERSION);
    expect((await repositories.timer.get())?.running).toBe(false);
  });
});

describe('export + import', () => {
  const data = snapshot({
    progress: { [SUB]: { jm: progressRow({ status: 'completed' }) } },
    tasks: [task({ title: 'Exported task' })],
    sessions: [session({ minutes: 75 })],
  });

  it('writes an envelope that imports back unchanged', () => {
    const envelope = buildExportEnvelope(data);
    expect(envelope.app).toBe('jee-command-center');
    expect(envelope.schemaVersion).toBe(SCHEMA_VERSION);

    const text = serializeExport(data);
    const imported = parseImport(text);
    expect(imported.kind).toBe('backup');
    expect(imported.counts.tasks).toBe(1);
    expect(imported.counts.sessions).toBe(1);
    expect(imported.data.tasks?.[0]?.title).toBe('Exported task');
    expect(imported.data.progress?.[SUB]?.jm?.status).toBe('completed');
  });

  it('rejects files that are not tracker data', () => {
    expect(() => parseImport('not json at all')).toThrow(/valid JSON/);
    expect(() => parseImport('{"hello":"world"}')).toThrow(/not a JEE tracker backup/);
  });

  it('refuses a backup from a newer schema', () => {
    expect(() =>
      parseImport(JSON.stringify({ app: 'jee-command-center', schemaVersion: SCHEMA_VERSION + 5, data: {} })),
    ).toThrow(/newer version/);
  });

  it('produces a compact backup payload with its record count', () => {
    const backup = serializeBackup(data);
    expect(backup.records).toBeGreaterThan(0);
    expect(backup.bytes).toBeGreaterThan(0);
    expect(JSON.parse(backup.payload).data.tasks).toHaveLength(1);
  });
});

describe('legacy migration', () => {
  const legacyState = {
    progress: {
      [SUB]: {
        jm: {
          status: 'Completed',
          weak: true,
          theory: 'done',
          lecture: 'partial',
          dpp: 'none',
          pyq: 'done',
          practice: 'none',
          revisionCount: 2,
          confidence: 4,
          lastStudied: dayOffset(-3),
          timeMin: 120,
          note: 'watch sign conventions',
        },
      },
    },
    tasks: [
      {
        id: 'legacy-task-1',
        title: 'Finish Rotational Motion',
        type: 'Lecture',
        subject: 'Physics',
        status: 'Pending',
        priority: 'High',
        plannedFor: dayOffset(-4),
        estMin: 60,
        nodeId: SUB,
      },
      { title: '' },
    ],
    lectures: [{ title: 'Work Power Energy L1', subject: 'Physics', durationMin: 90, watchedMin: 30, status: 'In Progress' }],
    sessions: [{ subject: 'Chemistry', start: `${dayOffset(-1)}T15:00:00.000Z`, minutes: 50, mode: 'DPP' }],
    questions: [{ subject: 'Mathematics', date: dayOffset(-2), source: 'DPP', attempted: 20, correct: 16 }],
    errors: [
      {
        subject: 'Physics',
        date: dayOffset(-5),
        questionText: 'Block on wedge',
        mistakeType: 'Conceptual',
        note: 'forgot pseudo force',
        status: 'Revised',
      },
      { subject: 'Unknown' },
    ],
    tests: [
      {
        name: 'Legacy Mock 1',
        date: dayOffset(-7),
        score: 150,
        maxMarks: 300,
        subjects: { phy: { score: 40, max: 100, attempted: 25, correct: 20 }, chem: { score: 50, max: 100 }, math: { score: 60, max: 100 } },
      },
    ],
    profile: { name: 'Aspirant', examLabel: 'JEE 2027', mainDate: '2027-01-22', advancedDate: '2027-05-17', dailyTargetMin: 480 },
    settings: { apiKey: 'AIza-legacy-key', model: 'gemini-2.5-flash', autoRevision: true },
    timer: { running: true, startedAt: `${TODAY}T09:00:00.000Z`, subject: 'Physics', mode: 'Theory' },
    ai: { chats: [{ title: 'Old chat', messages: [{ role: 'user', text: 'hi', ts: `${TODAY}T09:00:00.000Z` }] }] },
  };

  const result = migrateLegacyState(legacyState);

  it('converts legacy progress into the typed model', () => {
    // "Completed" is kept as the status; the weak flag is what marks it fragile.
    expect(result.progress[SUB]?.jm?.status).toBe('completed');
    expect(result.progress[SUB]?.jm?.weak).toBe(true);
    expect(result.progress[SUB]?.jm?.theory).toBe('done');
    expect(result.progress[SUB]?.jm?.lecture).toBe('partial');
    expect(result.progress[SUB]?.jm?.confidence).toBe(4);
    expect(result.progress[SUB]?.jm?.note).toBe('watch sign conventions');
    expect(result.progress[SUB]?.jm?.timeMin).toBe(120);
  });

  it('carries the records across and skips the broken ones', () => {
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]?.type).toBe('Lecture');
    expect(result.tasks[0]?.status).toBe('pending');
    expect(result.tasks[0]?.priority).toBe('high');
    expect(result.tasks[0]?.subject).toBe('phy');
    expect(result.tasks[0]?.origin).toBe('migration');

    expect(result.lectures).toHaveLength(1);
    expect(result.lectures[0]?.status).toBe('in_progress');
    expect(result.sessions[0]?.subject).toBe('chem');
    expect(result.sessions[0]?.mode).toBe('DPP');
    expect(result.questions[0]?.subject).toBe('math');
    expect(result.questions[0]?.accuracy).toBe(80);
    expect(result.mistakes).toHaveLength(1);
    expect(result.mistakes[0]?.whatWentWrong).toBe('forgot pseudo force');
    expect(result.mistakes[0]?.status).toBe('revised');
    expect(result.tests).toHaveLength(1);
    expect(result.tests[0]?.score).toBe(150);
    expect(result.skipped.length).toBe(2);
  });

  it('never copies the legacy API key but tells the user about it', () => {
    expect(result.settings.ai?.legacyKeyRemoved).toBe(true);
    expect(result.settings.ai?.serverKeyAvailable).toBe(false);
    expect(result.notes.join(' ')).toMatch(/NOT copied/);
    expect(JSON.stringify(result)).not.toContain('AIza-legacy-key');
  });

  it('stops a legacy timer rather than guessing elapsed time', () => {
    expect(result.timer.running).toBe(false);
    expect(result.timer.startedAt).toBeNull();
    expect(result.timer.subject).toBe('phy');
  });

  it('keeps legacy chat history', () => {
    expect(result.chats).toHaveLength(1);
    expect(result.chats[0]?.messages[0]?.text).toBe('hi');
  });

  it('reports the conversion counts', () => {
    expect(result.counts.progressNodes).toBe(1);
    expect(result.counts.tasks).toBe(1);
    expect(result.counts.tests).toBe(1);
    expect(result.counts.mistakes).toBe(1);
  });

  it('returns an empty result for junk input', () => {
    const empty = migrateLegacyState(null);
    expect(empty.found).toBe(false);
    expect(empty.tasks).toHaveLength(0);
  });
});

describe('legacy storage scan', () => {
  it('finds the primary state and the numbered backup slots', () => {
    const store = new Map<string, string>([
      ['jee-tracker-v1', JSON.stringify({ progress: {} })],
      ['jee-tracker-backup-2', JSON.stringify({ at: `${TODAY}T10:00:00.000Z`, state: { progress: {} } })],
      ['something-else', 'ignore me'],
    ]);
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
      key: (index: number) => [...store.keys()][index] ?? null,
      get length() {
        return store.size;
      },
    } as Storage;

    const scan = scanLegacyStorage(storage);
    expect(scan.primary).not.toBeNull();
    expect(scan.backups).toHaveLength(1);
    expect(scan.backups[0]?.slot).toBe(2);
    expect(schemaVersionOf(scan.primary)).toBe(0);
    expect(schemaVersionOf({ schemaVersion: 2 })).toBe(2);
  });

  it('handles a missing storage object', () => {
    expect(scanLegacyStorage(undefined)).toEqual({ primary: null, backups: [] });
  });
});

describe('legacy import through the transfer layer', () => {
  it('accepts the old export envelope shape', () => {
    const payload = JSON.stringify({
      app: 'jee-pcm-tracker',
      state: { progress: { [SUB]: { jm: { status: 'Learning' } } }, tasks: [{ title: 'Old task' }] },
    });
    const imported = parseImport(payload);
    expect(imported.kind).toBe('legacy');
    expect(imported.data.tasks?.[0]?.title).toBe('Old task');
    expect(imported.notes.join(' ')).toMatch(/Legacy export detected/);
  });

  it('accepts a bare legacy state object', () => {
    const imported = parseImport(JSON.stringify({ progress: {}, profile: { name: 'A' } }));
    expect(imported.kind).toBe('legacy');
  });
});

describe('sample data', () => {
  it('builds a dataset that exercises every screen', () => {
    const sample = buildSampleData();
    expect(sample.tasks.length).toBeGreaterThan(5);
    expect(sample.lectures.length).toBeGreaterThan(5);
    expect(sample.sessions.length).toBeGreaterThan(5);
    expect(sample.revisions.length).toBeGreaterThan(5);
    expect(sample.questions.length).toBeGreaterThan(5);
    expect(sample.mistakes.length).toBeGreaterThan(0);
    expect(sample.tests.length).toBeGreaterThan(0);
    expect(Object.keys(sample.progress).length).toBeGreaterThan(20);
  });

  it('produces real analytics when assembled into a snapshot', () => {
    const sample = buildSampleData();
    const index = withIndex(
      snapshot({
        progress: sample.progress,
        tasks: sample.tasks,
        lectures: sample.lectures,
        sessions: sample.sessions,
        revisions: sample.revisions,
        questions: sample.questions,
        mistakes: sample.mistakes,
        tests: sample.tests,
      }),
    );
    const overall = overallAnalytics(index);
    expect(overall.jm.completed).toBeGreaterThan(0);
    expect(overall.studyTime.total).toBeGreaterThan(0);
    expect(overall.questions.attempted).toBeGreaterThan(0);
    expect(overall.tests.count).toBeGreaterThan(0);
    expect(overall.mistakes.total).toBeGreaterThan(0);
  });
});

describe('reset', () => {
  it('clears every collection', async () => {
    await repositories.tasks.putMany([task(), task()]);
    await repositories.sessions.putMany([session()]);
    await repositories.revisions.putMany([]);
    await repositories.progress.putRows([{ nodeId: SUB, jm: progressRow() }]);
    await repositories.settings.set(defaultSettings());

    await clearAllData();

    expect((await repositories.tasks.list()).length).toBe(0);
    expect(await (await repositories.sessions.list()).length).toBe(0);
    expect(await repositories.progress.list()).toHaveLength(0);
    expect(await repositories.settings.get()).toBeUndefined();
  });
});

describe('test records survive storage', () => {
  it('keeps the subject split intact', async () => {
    const record = testRecord({
      name: 'Storage Test',
      score: 200,
      maxMarks: 300,
    });
    await repositories.tests.put(record);
    const stored = await repositories.tests.get(record.id);
    expect(stored?.name).toBe('Storage Test');
    expect(stored?.subjects.phy.attempted).toBe(record.subjects.phy.attempted);
    expect(mistake({}).id).toBeTruthy();
  });
});
