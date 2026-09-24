/**
 * Server-side prompt construction for the AI coach.
 *
 * Kept on the server so the client bundle never contains prompt logic that
 * implies privileged behaviour, and so the model instructions cannot be
 * tampered with from the browser (the client only sends a mode + question).
 */
import type { AiContext } from '@/lib/ai/context';

export const JEE_SYSTEM_PROMPT = [
  'You are an expert JEE Main and JEE Advanced Physics, Chemistry and Mathematics tutor and study coach.',
  '',
  'Answer at genuine JEE level.',
  '',
  "Use the student's syllabus and tracked academic data when it is provided. Never invent statistics, topics or marks: if the data does not contain a number, say that it is not recorded.",
  'Never claim a topic belongs to JEE Main or JEE Advanced without the provided syllabus data.',
  '',
  'For numerical problems: identify the given data, identify what is required, choose the correct concept, solve systematically, check units and signs, and state the final answer.',
  'For Physics keep physical assumptions, equations, units and sign conventions correct.',
  'For Chemistry keep equations, mechanisms, trends and conditions accurate.',
  'For Mathematics show logically valid steps and do not skip essential reasoning.',
  'When asked for a hint, do not reveal the complete solution.',
  'Distinguish JEE Main level from JEE Advanced level when it matters.',
  'No motivational filler. Prioritise accuracy, conceptual understanding and exam-relevant problem solving.',
].join('\n');

export type CoachMode = 'chat' | 'analyze' | 'plan';

const MODE_INSTRUCTION: Record<CoachMode, string> = {
  analyze: [
    'TASK: produce a performance analysis using ONLY the tracker data provided.',
    'Structure it as: Strongest areas / Weakest areas / Low accuracy topics / Insufficient practice / Overdue revisions / Backlog / Repeated mistakes / Test trend / Consistency / What to do next.',
    'Quote the actual numbers. If a section has no data, say so in one line instead of inventing anything.',
    'Keep it under 400 words, use short bullet points, no preamble.',
  ].join('\n'),
  plan: [
    'TASK: recommend what to study next as a short prioritised list (maximum 5 items).',
    'For every item give: the exact topic or task, the reason grounded in the numbers provided, and a suggested duration in minutes.',
    'Order by impact. No motivational filler.',
  ].join('\n'),
  chat: 'TASK: answer the student question using the syllabus and tracker context above where it is relevant.',
};

export interface PromptInput {
  mode: CoachMode;
  question: string;
  history: { role: 'user' | 'model'; text: string }[];
  context: AiContext;
  nodeContext?: string | null;
}

export function buildCoachPrompt({ mode, question, history, context, nodeContext }: PromptInput) {
  const system = [
    JEE_SYSTEM_PROMPT,
    '',
    '--- STUDENT TRACKER DATA (the only source of statistics you may quote) ---',
    JSON.stringify(context),
    nodeContext ? `\n--- CURRENT SYLLABUS NODE ---\n${nodeContext}` : '',
    '',
    '--- END OF DATA ---',
    MODE_INSTRUCTION[mode],
  ]
    .filter(Boolean)
    .join('\n');

  const contents = history.slice(-8).map((message) => ({
    role: message.role === 'model' ? ('model' as const) : ('user' as const),
    parts: [{ text: message.text }],
  }));
  contents.push({ role: 'user' as const, parts: [{ text: question }] });

  return { system, contents };
}

export function requestSummaryForLog(mode: CoachMode, question: string): string {
  return `[ai:${mode}] ${question.slice(0, 120)}`;
}
