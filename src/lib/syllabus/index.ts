/**
 * Typed access to the official JEE Main 2026 + JEE Advanced 2026 syllabus.
 *
 * The data itself lives in `src/data/syllabus.json`, generated from the official
 * source documents by `scripts/build-syllabus.mjs`. Nothing here invents or
 * rewords a single subtopic: this module only indexes what the documents say.
 */
import raw from '@/data/syllabus.json';
import type { Chapter, ExamScope, Subject, SubjectCode, Subtopic, Syllabus, SyllabusMeta, SyllabusNode, Topic } from '@/lib/types';

const data = raw as Syllabus;

export const syllabus: Syllabus = data;
export const syllabusMeta: SyllabusMeta = data.meta;
export const subjects: Subject[] = data.subjects;

export const subjectByCode: Record<string, Subject> = {};
export const subjectByName: Record<string, Subject> = {};
for (const subject of subjects) {
  subjectByCode[subject.code] = subject;
  subjectByName[subject.name] = subject;
}

const nodeIndex = new Map<string, SyllabusNode>();
const chapterList: Chapter[] = [];
const topicList: Topic[] = [];
const subtopicList: Subtopic[] = [];

for (const subject of subjects) {
  nodeIndex.set(subject.code, {
    id: subject.code,
    kind: 'subject',
    name: subject.name,
    slug: subject.code,
    jm: subject.chapters.some((chapter) => chapter.jm),
    ja: subject.chapters.some((chapter) => chapter.ja),
    subject,
    chapter: null,
    topic: null,
    subtopic: null,
  });
  for (const chapter of subject.chapters) {
    chapterList.push(chapter);
    nodeIndex.set(chapter.id, {
      id: chapter.id,
      kind: 'chapter',
      name: chapter.name,
      slug: chapter.slug,
      jm: chapter.jm,
      ja: chapter.ja,
      subject,
      chapter,
      topic: null,
      subtopic: null,
    });
    for (const topic of chapter.topics) {
      topicList.push(topic);
      nodeIndex.set(topic.id, {
        id: topic.id,
        kind: 'topic',
        name: topic.name,
        slug: topic.slug,
        jm: topic.jm,
        ja: topic.ja,
        subject,
        chapter,
        topic,
        subtopic: null,
      });
      for (const subtopic of topic.subs) {
        subtopicList.push(subtopic);
        nodeIndex.set(subtopic.id, {
          id: subtopic.id,
          kind: 'subtopic',
          name: subtopic.name,
          slug: subtopic.slug,
          jm: subtopic.jm,
          ja: subtopic.ja,
          subject,
          chapter,
          topic,
          subtopic,
        });
      }
    }
  }
}

export const allChapters: readonly Chapter[] = chapterList;
export const allTopics: readonly Topic[] = topicList;
export const allSubtopics: readonly Subtopic[] = subtopicList;

export function nodeById(id: string | null | undefined): SyllabusNode | null {
  if (!id) return null;
  return nodeIndex.get(id) ?? null;
}

export function hasNode(id: string | null | undefined): boolean {
  return !!id && nodeIndex.has(id);
}

export function subjectOf(id: string | null | undefined): Subject | null {
  return nodeById(id)?.subject ?? null;
}

export function chapterOf(id: string | null | undefined): Chapter | null {
  return nodeById(id)?.chapter ?? null;
}

export function topicOf(id: string | null | undefined): Topic | null {
  return nodeById(id)?.topic ?? null;
}

/** Human readable path, e.g. `Physics › Units and Measurements › Units …`. */
export function pathLabel(id: string | null | undefined, depth: 'chapter' | 'topic' | 'subtopic' = 'topic'): string {
  const node = nodeById(id);
  if (!node) return '';
  const parts = [node.subject.name];
  if (node.chapter) parts.push(node.chapter.name);
  if (depth !== 'chapter' && node.topic) parts.push(node.topic.name);
  if (depth === 'subtopic' && node.subtopic) parts.push(node.subtopic.name);
  return parts.join(' › ');
}

/** Subtopics under a node that exist in the given exam scope. */
/** Topics directly under a node - works for subjects, chapters and topics. */
function topicsUnder(node: SyllabusNode): Topic[] {
  if (node.kind === 'topic') return node.topic ? [node.topic] : [];
  if (node.kind === 'chapter') return node.chapter ? node.chapter.topics : [];
  return node.subject.chapters.flatMap((chapter) => chapter.topics);
}

export function leavesOf(nodeId: string | null | undefined, exam: ExamScope): Subtopic[] {
  const node = nodeById(nodeId);
  if (!node) return [];
  if (node.kind === 'subtopic') return node.subtopic && node.subtopic[exam] ? [node.subtopic] : [];
  const out: Subtopic[] = [];
  for (const topic of topicsUnder(node)) {
    for (const sub of topic.subs) if (sub[exam]) out.push(sub);
  }
  return out;
}

/** Subtopics under a node regardless of scope (used for "unmarked" checks). */
export function allLeavesOf(nodeId: string | null | undefined): Subtopic[] {
  const node = nodeById(nodeId);
  if (!node) return [];
  if (node.kind === 'subtopic') return node.subtopic ? [node.subtopic] : [];
  return topicsUnder(node).flatMap((topic) => topic.subs);
}

/**
 * The node id itself plus every id below it (subtopics, their topics and their
 * chapter). Aggregates such as "questions solved in this chapter" must count
 * records logged against any descendant, not only the node itself.
 */
export function subtreeNodeIds(nodeId: string | null | undefined): string[] {
  const node = nodeById(nodeId);
  if (!node) return [];
  if (node.kind === 'subtopic') return node.subtopic ? [node.subtopic.id] : [];
  const ids = new Set<string>([node.id]);
  if (node.chapter) ids.add(node.chapter.id);
  for (const leaf of allLeavesOf(node.id)) {
    ids.add(leaf.id);
    const leafNode = nodeById(leaf.id);
    if (leafNode?.topic) ids.add(leafNode.topic.id);
    if (leafNode?.chapter) ids.add(leafNode.chapter.id);
  }
  if (node.kind === 'topic' && node.topic) {
    for (const sub of node.topic.subs) ids.add(sub.id);
  }
  return [...ids];
}

export function isInScope(id: string | null | undefined, exam: ExamScope): boolean {
  const node = nodeById(id);
  if (!node) return false;
  return node[exam];
}

export interface SyllabusCounts {
  subjects: number;
  chapters: number;
  topics: number;
  subtopics: number;
  /** Subtopics that exist in the JEE Main syllabus. */
  jmLeaves: number;
  /** Subtopics that exist in the JEE Advanced syllabus. */
  jaLeaves: number;
  bothLeaves: number;
}

export const syllabusCounts: SyllabusCounts = (() => {
  let jmLeaves = 0;
  let jaLeaves = 0;
  let bothLeaves = 0;
  for (const sub of subtopicList) {
    if (sub.jm) jmLeaves += 1;
    if (sub.ja) jaLeaves += 1;
    if (sub.jm && sub.ja) bothLeaves += 1;
  }
  return {
    subjects: subjects.length,
    chapters: chapterList.length,
    topics: topicList.length,
    subtopics: subtopicList.length,
    jmLeaves,
    jaLeaves,
    bothLeaves,
  };
})();

export function countsForSubject(code: SubjectCode, exam: ExamScope): { chapters: number; topics: number; leaves: number } {
  const subject = subjectByCode[code];
  if (!subject) return { chapters: 0, topics: 0, leaves: 0 };
  let leaves = 0;
  let topics = 0;
  for (const chapter of subject.chapters) {
    for (const topic of chapter.topics) {
      topics += 1;
      for (const sub of topic.subs) if (sub[exam]) leaves += 1;
    }
  }
  return { chapters: subject.chapters.length, topics, leaves };
}

export interface SyllabusSearchResults {
  chapters: { id: string; name: string; subject: string; code: SubjectCode }[];
  topics: { id: string; name: string; chapter: string; subject: string; code: SubjectCode }[];
  subtopics: { id: string; name: string; topic: string; chapter: string; subject: string; code: SubjectCode }[];
}

const SEARCH_LIMIT = 40;

export function searchSyllabus(query: string, limit = SEARCH_LIMIT): SyllabusSearchResults {
  const needle = query.trim().toLowerCase();
  const results: SyllabusSearchResults = { chapters: [], topics: [], subtopics: [] };
  if (needle.length < 2) return results;
  for (const subject of subjects) {
    for (const chapter of subject.chapters) {
      if (chapter.name.toLowerCase().includes(needle) && results.chapters.length < limit) {
        results.chapters.push({ id: chapter.id, name: chapter.name, subject: subject.name, code: subject.code });
      }
      for (const topic of chapter.topics) {
        if (topic.name.toLowerCase().includes(needle) && results.topics.length < limit) {
          results.topics.push({ id: topic.id, name: topic.name, chapter: chapter.name, subject: subject.name, code: subject.code });
        }
        for (const sub of topic.subs) {
          if (sub.name.toLowerCase().includes(needle) && results.subtopics.length < limit) {
            results.subtopics.push({
              id: sub.id,
              name: sub.name,
              topic: topic.name,
              chapter: chapter.name,
              subject: subject.name,
              code: subject.code,
            });
          }
        }
      }
    }
  }
  return results;
}

/** Sibling navigation used by the topic screen (prev/next subtopic). */
export function siblingLeaves(nodeId: string, exam: ExamScope): Subtopic[] {
  const node = nodeById(nodeId);
  const topic = node?.topic;
  if (!topic) return [];
  return topic.subs.filter((s) => s[exam]);
}
