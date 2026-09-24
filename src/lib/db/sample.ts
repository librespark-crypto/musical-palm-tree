/**
 * Optional, clearly-labelled SAMPLE data.
 *
 * Real tracking starts from an empty tracker - the app never invents stats.
 * This generator exists purely so a new user can walk through every analytics
 * screen before they have logged a month of work. It is deterministic (seeded
 * PRNG) so the same build always produces the same demonstration dataset, and
 * the UI always shows a "sample data" banner while it is loaded.
 */
import { addDays, todayISO } from '@/lib/date';
import { withIndex } from '@/lib/calculations/derive';
import { scheduleDateFor } from '@/lib/calculations/revision';
import { allSubtopics, nodeById, subjects } from '@/lib/syllabus';
import { uid } from '@/lib/utils';
import { emptyProgress } from '@/lib/calculations/progress';
import type {
  Confidence,
  ExamScope,
  Lecture,
  Mistake,
  QuestionLog,
  RevisionRecord,
  StudySession,
  StudyTask,
  SubjectCode,
  TestRecord,
  TopicProgress,
  UserSettings,
} from '@/lib/types';

function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SampleDataset {
  progress: Record<string, { jm?: TopicProgress; ja?: TopicProgress }>;
  tasks: StudyTask[];
  lectures: Lecture[];
  sessions: StudySession[];
  revisions: RevisionRecord[];
  questions: QuestionLog[];
  mistakes: Mistake[];
  tests: TestRecord[];
  settings: Partial<UserSettings>;
}

const SUBJECT_PLAN: Record<SubjectCode, { chapters: number; doneChance: number }> = {
  phy: { chapters: 12, doneChance: 0.62 },
  chem: { chapters: 16, doneChance: 0.55 },
  math: { chapters: 9, doneChance: 0.5 },
};

export function buildSampleData(): SampleDataset {
  const random = seededRandom(20260924);
  const today = todayISO();
  const now = () => new Date().toISOString();

  const progress: SampleDataset['progress'] = {};

  for (const subject of subjects) {
    const plan = SUBJECT_PLAN[subject.code];
    subject.chapters.slice(0, plan.chapters).forEach((chapter) => {
      chapter.topics.forEach((topic) => {
        const roll = random();
        const mode = roll < plan.doneChance ? 'done' : roll < plan.doneChance + 0.18 ? 'learning' : 'none';
        if (mode === 'none') return;
        topic.subs.forEach((sub) => {
          for (const exam of ['jm', 'ja'] as ExamScope[]) {
            if (!sub[exam]) continue;
            const blank = emptyProgress();
            const entry: TopicProgress =
              mode === 'learning'
                ? {
                    ...blank,
                    status: 'learning',
                    theory: random() < 0.7 ? 'done' : 'partial',
                    lecture: random() < 0.6 ? 'done' : 'partial',
                    dpp: random() < 0.3 ? 'partial' : 'none',
                    confidence: 3 as Confidence,
                    lastStudied: addDays(today, -Math.floor(random() * 21)),
                    timeMin: Math.round(random() * 180),
                  }
                : {
                    ...blank,
                    status: random() < 0.12 ? 'weak' : 'completed',
                    weak: false,
                    theory: 'done',
                    lecture: random() < 0.9 ? 'done' : 'partial',
                    dpp: random() < 0.8 ? 'done' : 'partial',
                    pyq: random() < 0.6 ? 'done' : 'partial',
                    practice: random() < 0.55 ? 'done' : 'partial',
                    revisionCount: Math.floor(random() * 4),
                    confidence: (3 + Math.floor(random() * 3)) as Confidence,
                    lastStudied: addDays(today, -Math.floor(random() * 30)),
                    timeMin: Math.round(60 + random() * 400),
                  };
            if (entry.status === 'weak') entry.weak = true;
            progress[sub.id] = { ...(progress[sub.id] ?? {}), [exam]: entry };
          }
        });
      });
    });
  }

  /* ------------------------------------------------------------ lectures */
  const lectures: Lecture[] = [];
  const lectureChapters = [
    ...(subjects.find((s) => s.code === 'phy')?.chapters.slice(0, 6) ?? []),
    ...(subjects.find((s) => s.code === 'chem')?.chapters.slice(0, 6) ?? []),
    ...(subjects.find((s) => s.code === 'math')?.chapters.slice(0, 5) ?? []),
  ];
  for (const chapter of lectureChapters) {
    const subject = subjects.find((s) => s.chapters.includes(chapter));
    if (!subject) continue;
    for (let index = 0; index < 3; index += 1) {
      const statusRoll = random();
      const status = statusRoll < 0.55 ? 'completed' : statusRoll < 0.75 ? 'in_progress' : 'not_started';
      const durationMin = 45 + Math.round(random() * 40);
      const topic = chapter.topics[Math.min(index, chapter.topics.length - 1)];
      lectures.push({
        id: uid('lec'),
        title: `${chapter.name} - lecture ${index + 1}`,
        subject: subject.code,
        chapterId: chapter.id,
        topicId: topic?.id ?? null,
        exam: random() < 0.3 ? 'both' : 'jm',
        number: index + 1,
        durationMin,
        watchedMin: status === 'completed' ? durationMin : status === 'in_progress' ? Math.round(durationMin / 2) : 0,
        status,
        source: 'Coaching batch',
        date: addDays(today, -Math.floor(random() * 45)),
        notes: '',
        createdAt: now(),
        updatedAt: now(),
      });
    }
  }

  /* ------------------------------------------------------------ sessions */
  const sessions: StudySession[] = [];
  const subjectCodes: SubjectCode[] = ['phy', 'chem', 'math'];
  for (let dayOffset = 45; dayOffset >= 0; dayOffset -= 1) {
    if (random() < 0.18) continue; // rest day
    const date = addDays(today, -dayOffset);
    const blocks = 1 + Math.floor(random() * 3);
    for (let block = 0; block < blocks; block += 1) {
      const subject = subjectCodes[Math.floor(random() * subjectCodes.length)] ?? 'phy';
      const minutes = 45 + Math.round(random() * 90);
      const start = `${date}T${String(6 + block * 3 + Math.floor(random() * 2)).padStart(2, '0')}:00:00.000Z`;
      sessions.push({
        id: uid('ses'),
        start,
        end: new Date(new Date(start).getTime() + minutes * 60000).toISOString(),
        minutes,
        mode: random() < 0.4 ? 'Theory' : random() < 0.7 ? 'Practice' : 'PYQ',
        subject,
        exam: 'jm',
        chapterId: null,
        topicId: null,
        subtopicId: null,
        taskId: null,
        origin: 'timer',
        notes: '',
        createdAt: now(),
      });
    }
  }

  /* ------------------------------------------------------------ questions */
  const questions: QuestionLog[] = [];
  const loggedSubtopics = allSubtopics.filter((sub) => progress[sub.id]?.jm).slice(0, 120);
  for (let index = 0; index < 70; index += 1) {
    const sub = loggedSubtopics[Math.floor(random() * loggedSubtopics.length)];
    if (!sub) break;
    const node = nodeById(sub.id);
    if (!node?.chapter) continue;
    const attempted = 8 + Math.floor(random() * 22);
    const accuracy = 0.4 + random() * 0.5;
    const correct = Math.round(attempted * accuracy);
    const wrong = attempted - correct;
    questions.push({
      id: uid('q'),
      date: addDays(today, -Math.floor(random() * 45)),
      source: random() < 0.4 ? 'PYQ' : random() < 0.75 ? 'DPP' : 'Practice',
      subject: node.subject.code,
      chapterId: node.chapter.id,
      topicId: node.topic?.id ?? null,
      subtopicId: sub.id,
      nodeId: sub.id,
      exam: random() < 0.25 ? 'ja' : 'jm',
      difficulty: random() < 0.35 ? 'easy' : random() < 0.8 ? 'moderate' : 'hard',
      attempted,
      correct,
      wrong,
      unattempted: Math.floor(random() * 3),
      timeMin: attempted * (1 + Math.round(random() * 2)),
      accuracy: Math.round((correct / attempted) * 100),
      notes: '',
      createdAt: now(),
    });
  }

  /* ------------------------------------------------------------ mistakes */
  const mistakes: Mistake[] = [];
  const mistakeTypes: Mistake['mistakeType'][] = ['Conceptual', 'Calculation', 'Formula', 'Silly mistake', 'Misread question', 'Time pressure'];
  for (let index = 0; index < 26; index += 1) {
    const sub = loggedSubtopics[Math.floor(random() * loggedSubtopics.length)];
    if (!sub) break;
    const node = nodeById(sub.id);
    if (!node?.chapter) continue;
    const statusRoll = random();
    mistakes.push({
      id: uid('err'),
      date: addDays(today, -Math.floor(random() * 40)),
      subject: node.subject.code,
      chapterId: node.chapter.id,
      topicId: node.topic?.id ?? null,
      subtopicId: sub.id,
      nodeId: sub.id,
      exam: random() < 0.3 ? 'ja' : 'jm',
      source: 'Mock Test',
      questionText: `${node.name} - ${sub.name}: sign/limit slip while evaluating the final step.`,
      mistakeType: mistakeTypes[Math.floor(random() * mistakeTypes.length)] ?? 'Calculation',
      whatWentWrong: 'Rushed the last algebraic step instead of substituting the constraint first.',
      correctConcept: 'Substitute the constraint before differentiating; check the sign convention at the end.',
      status: statusRoll < 0.45 ? 'open' : statusRoll < 0.8 ? 'revised' : 'mastered',
      revisions: Math.floor(random() * 3),
      lastRevised: statusRoll < 0.45 ? null : addDays(today, -Math.floor(random() * 20)),
      image: null,
      voiceNote: null,
      createdAt: now(),
      updatedAt: now(),
    });
  }

  /* --------------------------------------------------------- study tasks */
  const tasks: StudyTask[] = [];
  for (let dayOffset = 6; dayOffset >= -3; dayOffset -= 1) {
    const date = addDays(today, -dayOffset);
    const count = 2 + Math.floor(random() * 3);
    for (let index = 0; index < count; index += 1) {
      const sub = loggedSubtopics[Math.floor(random() * loggedSubtopics.length)];
      const node = sub ? nodeById(sub.id) : null;
      const status: StudyTask['status'] = dayOffset > 0 ? 'completed' : dayOffset === 0 ? (random() < 0.5 ? 'completed' : 'pending') : random() < 0.4 ? 'pending' : 'completed';
      tasks.push({
        id: uid('task'),
        title: node ? `${node.name} - ${node.subtopic?.name ?? node.topic?.name ?? ''}`.slice(0, 72) : 'Revision session',
        type: random() < 0.35 ? 'Lecture' : random() < 0.7 ? 'PYQ' : 'Revision',
        link: node ? 'subtopic' : 'custom',
        status,
        priority: random() < 0.35 ? 'high' : random() < 0.8 ? 'medium' : 'low',
        exam: 'jm',
        subject: node?.subject.code ?? null,
        chapterId: node?.chapter?.id ?? null,
        topicId: node?.topic?.id ?? null,
        subtopicId: sub?.id ?? null,
        plannedFor: date,
        deadline: null,
        estMin: 30 + Math.round(random() * 60),
        actualMin: status === 'completed' ? 30 + Math.round(random() * 60) : 0,
        notes: '',
        inBacklog: dayOffset < 0 && status !== 'completed',
        backlogSince: dayOffset < 0 && status !== 'completed' ? today : null,
        origin: 'manual',
        createdAt: now(),
        updatedAt: now(),
        completedAt: status === 'completed' ? `${date}T18:00:00.000Z` : null,
      });
    }
  }

  /* ----------------------------------------------------------- revisions */
  const snapshotStub = {
    subjects,
    syllabusMeta: { mainYear: 2026, advancedYear: 2026, mainSource: '', mainUrl: '', advancedSource: '', advancedUrl: '', retrieved: '', note: '' },
    progress,
    tasks: [],
    lectures: [],
    sessions: [],
    revisions: [],
    questions: [],
    mistakes: [],
    tests: [],
    chats: [],
    activeChatId: null,
    lastPlan: null,
    settings: { profile: { name: '', examLabel: '', mainDate: today, advancedDate: today, dailyTargetMin: 420 }, revision: { autoSchedule: true, intervals: [1, 3, 7, 16, 35] }, ai: { serverKeyAvailable: false, model: '', lastCheckedAt: null, legacyKeyRemoved: false }, theme: 'system' as const, showInsights: true, compact: false, weeklyTargetMin: 2400 },
    timer: { running: false, startedAt: null, pausedMs: 0, mode: 'Theory' as const, subject: 'phy' as const, exam: 'jm' as const, chapterId: null, topicId: null, subtopicId: null, taskId: null },
    meta: { schemaVersion: 2, installedAt: now(), updatedAt: now(), lastBacklogSweep: null, onboarded: true, sampleDataLoaded: true, migration: null },
  };
  const index = withIndex(snapshotStub);

  const revisions: RevisionRecord[] = [];
  const completedSubtopics = allSubtopics.filter((sub) => progress[sub.id]?.jm?.status === 'completed');
  for (const sub of completedSubtopics.slice(0, 90)) {
    const node = nodeById(sub.id);
    if (!node?.chapter) continue;
    const completedCount = progress[sub.id]?.jm?.revisionCount ?? 0;
    for (let step = 1; step <= Math.max(1, completedCount); step += 1) {
      const rawOffset = step * 3 - Math.floor(random() * 5);
      const scheduledFor = addDays(today, -rawOffset);
      const done = rawOffset > 2 && step < Math.max(1, completedCount);
      revisions.push({
        id: uid('rev'),
        nodeId: sub.id,
        chapterId: node.chapter.id,
        topicId: node.topic?.id ?? null,
        subtopicId: sub.id,
        chapterName: node.chapter.name,
        topicName: node.topic?.name ?? node.chapter.name,
        subject: node.subject.code,
        exam: 'jm',
        index: step,
        scheduledFor,
        completedAt: done ? `${addDays(scheduledFor, Math.floor(random() * 2))}T20:00:00.000Z` : null,
        completedOn: done ? addDays(scheduledFor, Math.floor(random() * 2)) : null,
        confidence: done ? ((3 + Math.floor(random() * 3)) as TopicProgress['confidence']) : null,
        note: '',
        auto: true,
        createdAt: now(),
      });
    }
  }
  // A few revisions due today / upcoming so the workflow screens have content.
  for (const sub of completedSubtopics.slice(0, 12)) {
    const node = nodeById(sub.id);
    if (!node?.chapter) continue;
    revisions.push({
      id: uid('rev'),
      nodeId: sub.id,
      chapterId: node.chapter.id,
      topicId: node.topic?.id ?? null,
      subtopicId: sub.id,
      chapterName: node.chapter.name,
      topicName: node.topic?.name ?? node.chapter.name,
      subject: node.subject.code,
      exam: 'jm',
      index: 3,
      scheduledFor: random() < 0.5 ? today : scheduleDateFor(3),
      completedAt: null,
      completedOn: null,
      confidence: null,
      note: '',
      auto: true,
      createdAt: now(),
    });
  }
  void index;

  /* --------------------------------------------------------------- tests */
  const tests: TestRecord[] = [];
  for (let index2 = 0; index2 < 6; index2 += 1) {
    const date = addDays(today, -((6 - index2) * 9));
    const base = 0.45 + index2 * 0.04 + random() * 0.05;
    const subject = () => {
      const max = 100;
      const attempted = 22 + Math.floor(random() * 3);
      const correct = Math.max(4, Math.round(attempted * (base + (random() - 0.5) * 0.16)));
      return {
        score: correct * 4 - (attempted - correct),
        max,
        attempted,
        correct,
        wrong: attempted - correct,
        unattempted: 25 - attempted,
        accuracy: Math.round((correct / attempted) * 100),
      };
    };
    const phy = subject();
    const chem = subject();
    const math = subject();
    const attempted = phy.attempted + chem.attempted + math.attempted;
    const correct = phy.correct + chem.correct + math.correct;
    tests.push({
      id: uid('test'),
      name: index2 < 3 ? `Full mock ${index2 + 1}` : `Advanced pattern mock ${index2 - 2}`,
      date,
      exam: index2 < 4 ? 'jm' : 'ja',
      durationMin: index2 < 4 ? 180 : 180,
      score: phy.score + chem.score + math.score,
      maxMarks: 300,
      attempted,
      correct,
      wrong: attempted - correct,
      unattempted: 75 - attempted,
      accuracy: Math.round((correct / attempted) * 100),
      percentile: index2 < 4 ? Math.min(99.9, Math.round((60 + index2 * 5 + random() * 5) * 10) / 10) : null,
      rank: index2 < 4 ? 4000 - index2 * 450 : null,
      subjects: { phy, chem, math },
      notes: index2 === 5 ? 'Ran out of time in the last 15 minutes of Mathematics.' : '',
      createdAt: now(),
      updatedAt: now(),
    });
  }

  return {
    progress,
    lectures,
    sessions,
    questions,
    mistakes,
    tasks,
    revisions,
    tests,
    settings: {
      profile: {
        name: 'Sample Student',
        examLabel: 'JEE 2027',
        mainDate: addDays(today, 118),
        advancedDate: addDays(today, 236),
        dailyTargetMin: 480,
      },
      weeklyTargetMin: 2700,
    },
  };
}
