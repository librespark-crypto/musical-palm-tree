/**
 * Default records used when the database is empty and by "reset tracker".
 */
import { APP_NAME, SCHEMA_VERSION } from '@/lib/constants';
import { DEFAULT_REVISION_INTERVALS } from '@/lib/calculations/revision';
import { addDays, todayISO } from '@/lib/date';
import type { AppMeta, StudyTask, TimerState, UserSettings } from '@/lib/types';

export function defaultSettings(): UserSettings {
  const today = todayISO();
  return {
    profile: {
      name: '',
      examLabel: 'JEE 2027',
      mainDate: addDays(today, 210),
      advancedDate: addDays(today, 330),
      dailyTargetMin: 420,
    },
    revision: { autoSchedule: true, intervals: [...DEFAULT_REVISION_INTERVALS] },
    ai: { serverKeyAvailable: false, model: 'gemini-2.5-flash', lastCheckedAt: null, legacyKeyRemoved: false },
    theme: 'system',
    showInsights: true,
    compact: false,
    weeklyTargetMin: 2400,
  };
}

export function defaultMeta(): AppMeta {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    installedAt: now,
    updatedAt: now,
    lastBacklogSweep: null,
    onboarded: false,
    sampleDataLoaded: false,
    migration: null,
  };
}

export function defaultTimer(): TimerState {
  return {
    running: false,
    startedAt: null,
    pausedMs: 0,
    mode: 'Theory',
    subject: 'phy',
    exam: 'jm',
    chapterId: null,
    topicId: null,
    subtopicId: null,
    taskId: null,
  };
}

export const APP_TITLE = APP_NAME;

/** Task template used by the planner's quick-add chips. */
export function taskTemplate(partial: Partial<StudyTask> & Pick<StudyTask, 'title'>): StudyTask {
  const now = new Date().toISOString();
  return {
    id: `task-${Math.random().toString(36).slice(2, 8)}`,
    title: partial.title,
    type: partial.type ?? 'Topic study',
    link: partial.link ?? 'custom',
    status: partial.status ?? 'pending',
    priority: partial.priority ?? 'medium',
    exam: partial.exam ?? 'jm',
    subject: partial.subject ?? null,
    chapterId: partial.chapterId ?? null,
    topicId: partial.topicId ?? null,
    subtopicId: partial.subtopicId ?? null,
    plannedFor: partial.plannedFor ?? todayISO(),
    deadline: partial.deadline ?? null,
    estMin: partial.estMin ?? 45,
    actualMin: partial.actualMin ?? 0,
    notes: partial.notes ?? '',
    inBacklog: partial.inBacklog ?? false,
    backlogSince: partial.backlogSince ?? null,
    origin: partial.origin ?? 'manual',
    createdAt: now,
    updatedAt: now,
    completedAt: partial.completedAt ?? null,
  };
}
