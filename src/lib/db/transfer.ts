/**
 * Export / import / backup.
 *
 * The export envelope is versioned and human-readable, so a user can keep a
 * plain JSON file of years of preparation and re-import it later. Import
 * understands three shapes:
 *   1. the current envelope            (`app: 'jee-command-center'`)
 *   2. the legacy envelope             (`app: 'jee-pcm-tracker'`, `state`)
 *   3. a bare legacy state object      (detected by its `progress` + `profile`)
 * so data from the original single-file tracker is never stranded.
 */
import { SCHEMA_VERSION } from '@/lib/constants';
import type { ExportEnvelope, TrackerSnapshot } from '@/lib/types';
import { migrateLegacyState, type LegacyMigrationResult } from '@/lib/db/migration';
import { uid } from '@/lib/utils';

export interface ImportResult {
  kind: 'backup' | 'legacy';
  counts: Record<string, number>;
  notes: string[];
  skipped: string[];
  data: {
    progress?: LegacyMigrationResult['progress'];
    tasks?: TrackerSnapshot['tasks'];
    lectures?: TrackerSnapshot['lectures'];
    sessions?: TrackerSnapshot['sessions'];
    revisions?: TrackerSnapshot['revisions'];
    questions?: TrackerSnapshot['questions'];
    mistakes?: TrackerSnapshot['mistakes'];
    tests?: TrackerSnapshot['tests'];
    chats?: TrackerSnapshot['chats'];
    settings?: Partial<TrackerSnapshot['settings']>;
    timer?: Partial<TrackerSnapshot['timer']>;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function countRecords(snapshotData: Partial<TrackerSnapshot>): Record<string, number> {
  return {
    progressNodes: Object.keys(snapshotData.progress ?? {}).length,
    tasks: snapshotData.tasks?.length ?? 0,
    lectures: snapshotData.lectures?.length ?? 0,
    sessions: snapshotData.sessions?.length ?? 0,
    revisions: snapshotData.revisions?.length ?? 0,
    questions: snapshotData.questions?.length ?? 0,
    mistakes: snapshotData.mistakes?.length ?? 0,
    tests: snapshotData.tests?.length ?? 0,
    chats: snapshotData.chats?.length ?? 0,
  };
}

export function buildExportEnvelope(snapshot: TrackerSnapshot): ExportEnvelope {
  return {
    app: 'jee-command-center',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: snapshot,
  };
}

export function serializeExport(snapshot: TrackerSnapshot): string {
  return JSON.stringify(buildExportEnvelope(snapshot), null, 1);
}

export function exportFilename(prefix = 'jee-tracker'): string {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `${prefix}-${stamp}.json`;
}

/** Parses any supported payload. Throws with a readable message when it is not one. */
export function parseImport(text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (!isRecord(parsed)) throw new Error('That file does not contain tracker data.');

  const notes: string[] = [];

  // 1. Current envelope.
  if (parsed.app === 'jee-command-center' && isRecord(parsed.data)) {
    const data = parsed.data as Partial<TrackerSnapshot>;
    const version = typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : SCHEMA_VERSION;
    if (version > SCHEMA_VERSION) {
      throw new Error(
        `This backup was written by a newer version of the app (schema ${version}). Update the app before importing it.`,
      );
    }
    return {
      kind: 'backup',
      counts: countRecords(data),
      notes,
      skipped: [],
      data: {
        progress: data.progress as LegacyMigrationResult['progress'],
        tasks: data.tasks ?? [],
        lectures: data.lectures ?? [],
        sessions: data.sessions ?? [],
        revisions: data.revisions ?? [],
        questions: data.questions ?? [],
        mistakes: data.mistakes ?? [],
        tests: data.tests ?? [],
        chats: data.chats ?? [],
        settings: data.settings,
        timer: data.timer,
      },
    };
  }

  // 2 + 3. Legacy payloads.
  const legacySource = parsed.app === 'jee-pcm-tracker' && isRecord(parsed.state) ? parsed.state : parsed;
  const looksLegacy = isRecord(legacySource) && ('progress' in legacySource || 'profile' in legacySource || 'sessions' in legacySource);
  if (!looksLegacy) {
    throw new Error('That file is not a JEE tracker backup (no tracker data found inside).');
  }
  const migration = migrateLegacyState(legacySource);
  notes.push(...migration.notes);
  notes.push('Legacy export detected - records were converted to the current data model.');
  return {
    kind: 'legacy',
    counts: migration.counts,
    notes,
    skipped: migration.skipped,
    data: {
      progress: migration.progress,
      tasks: migration.tasks,
      lectures: migration.lectures,
      sessions: migration.sessions,
      revisions: migration.revisions,
      questions: migration.questions,
      mistakes: migration.mistakes,
      tests: migration.tests,
      chats: migration.chats,
      settings: migration.settings,
      timer: migration.timer,
    },
  };
}

/** Compact envelope used by the in-browser backup slots. */
export function serializeBackup(snapshot: TrackerSnapshot): { payload: string; bytes: number; records: number } {
  const env = buildExportEnvelope(snapshot);
  const payload = JSON.stringify(env);
  return { payload, bytes: payload.length, records: Object.values(countRecords(snapshot)).reduce((a, b) => a + b, 0) };
}

export function backupId(slot: number): string {
  return `backup-${slot}`;
}

export function newBackupSlotId(): string {
  return uid('backup');
}

export function downloadNameFor(slot: number): string {
  return exportFilename(`jee-backup-slot${slot}`);
}
