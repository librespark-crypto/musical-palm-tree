'use client';

/**
 * AI coach.
 *
 * Three things live here:
 *   1. a chat with the server-side Gemini route (the key never reaches the browser)
 *   2. a one-click analysis of the stored data
 *   3. a deterministic plan built from stored facts, which works with no network,
 *      no key and no quota - and which the AI can improve on when it is available.
 *
 * Recommended items turn into real tasks when accepted, so the plan is actionable
 * rather than decorative.
 */
import * as React from 'react';
import Link from 'next/link';
import { Bot, Check, ListPlus, Plus, RefreshCw, Send, Sparkles, Trash2, Wand2, X } from 'lucide-react';
import type { AiPlanItem, ExamScope, TrackerSnapshot } from '@/lib/types';
import { SUBJECT_LABELS } from '@/lib/constants';
import { useActions, useDerivedIndex, useSnapshot, useTracker } from '@/lib/store/tracker-store';
import { buildRulePlan, planItemNodeLabel, rulePlanHeadline } from '@/lib/ai/rules';
import { buildAiContext } from '@/lib/ai/context';
import { AI_ERROR_COPY, askCoach, fetchAiStatus, type AiStatus } from '@/lib/ai/client';
import { buildInsights } from '@/lib/calculations/insights';
import { formatMinutes } from '@/lib/date';
import { Badge, Button, Card, CardContent, EmptyState, Field, Segmented, Select, Skeleton, Textarea } from '@/components/ui/primitives';
import { useExamScope } from '@/lib/hooks/use-exam-scope';
import { cn } from '@/lib/utils';

export function CoachScreen(): React.JSX.Element {
  const snapshot = useSnapshot();
  const index = useDerivedIndex();
  const actions = useActions();
  const { notify } = useTracker();
  const [exam, setExam] = useExamScope('jm');
  const [status, setStatus] = React.useState<AiStatus | null>(null);
  const [question, setQuestion] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [availableMinutes, setAvailableMinutes] = React.useState(snapshot.settings.profile.dailyTargetMin);

  const chat = snapshot.chats.find((entry) => entry.id === snapshot.activeChatId) ?? null;
  const insights = React.useMemo(() => buildInsights(index, 6), [index]);
  const livePlan = React.useMemo(
    () => buildRulePlan(snapshot, { exam, availableMinutes }),
    [snapshot, exam, availableMinutes],
  );
  // A server-generated plan (when Gemini ran) takes precedence; otherwise the
  // deterministic plan computed from the current data is shown.
  const rulePlan = snapshot.lastPlan?.source === 'gemini' ? snapshot.lastPlan : livePlan;

  React.useEffect(() => {
    let cancelled = false;
    void fetchAiStatus().then((result) => {
      if (!cancelled) setStatus(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const send = React.useCallback(
    async (mode: 'chat' | 'analyze', text: string) => {
      setBusy(true);
      setError(null);
      const chatId = chat?.id ?? actions.createChat();
      actions.appendMessage(chatId, { role: 'user', text });
      const history = (chat?.messages ?? []).slice(-8).map((message) => ({ role: message.role, text: message.text }));
      const result = await askCoach({
        mode,
        question: text,
        history,
        context: buildAiContext(snapshot, exam),
      });
      if (result.ok) {
        actions.appendMessage(chatId, { role: 'model', text: result.text });
      } else {
        setError(AI_ERROR_COPY[result.code]);
        actions.appendMessage(chatId, {
          role: 'model',
          text: `The AI service is unavailable right now (${result.message}). Here is the deterministic analysis from your own data instead:\n\n${insights
            .map((insight) => `• ${insight.text}`)
            .join('\n')}`,
        });
      }
      setBusy(false);
    },
    [actions, chat, exam, insights, snapshot],
  );

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Bot aria-hidden className="size-5 text-ink-subtle" />
            AI coach
          </h1>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">
            Answers are grounded in your stored records. Recommendations turn into real tasks; the rule-based plan works
            without a network or an API key.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<ExamScope>
            ariaLabel="Exam scope"
            value={exam}
            onChange={setExam}
            options={[
              { value: 'jm', label: 'JEE Main' },
              { value: 'ja', label: 'JEE Advanced' },
            ]}
          />
          <Button variant="secondary" loading={busy} onClick={() => void send('analyze', 'Analyse my preparation and tell me exactly what to fix first.')}>
            <Wand2 aria-hidden className="size-4" />
            Analyse my data
          </Button>
        </div>
      </header>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="flex items-center gap-2 text-[12.5px]">
            {status === null ? (
              <Skeleton className="h-4 w-56" />
            ) : status.available ? (
              <>
                <Badge tone="success">Gemini connected</Badge>
                <span className="text-ink-muted">model {status.model}</span>
              </>
            ) : (
              <>
                <Badge tone="warn">Rule-based mode</Badge>
                <span className="text-ink-muted">
                  {status.reason === 'disabled'
                    ? 'AI is switched off on this deployment (AI_ENABLED=false).'
                    : status.reason === 'no-key'
                      ? 'No server-side GEMINI_API_KEY is configured.'
                      : 'The AI service could not be reached.'}{' '}
                  Everything below still works from your stored data.
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => void fetchAiStatus().then(setStatus)}>
              <RefreshCw aria-hidden className="size-3.5" />
              Recheck
            </Button>
            <Link href="/settings" className="text-[12.5px] font-medium text-brand hover:underline">
              AI settings
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card className="flex flex-col">
          <CardContent className="flex min-h-[26rem] flex-1 flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[15px] font-semibold">Chat</h2>
              <div className="flex items-center gap-1">
                <Select
                  aria-label="Saved conversations"
                  className="h-8 w-44"
                  value={chat?.id ?? ''}
                  onChange={(event) => {
                    if (event.target.value) actions.selectChat(event.target.value);
                  }}
                >
                  <option value="">{snapshot.chats.length ? 'Select a conversation' : 'No conversations yet'}</option>
                  {snapshot.chats.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.title}
                    </option>
                  ))}
                </Select>
                <Button size="sm" variant="ghost" onClick={() => actions.createChat()}>
                  <Plus aria-hidden className="size-3.5" />
                  New
                </Button>
                {chat ? (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => actions.clearChat(chat.id)}>
                      Clear
                    </Button>
                    <Button size="icon-sm" variant="ghost" aria-label="Delete conversation" onClick={() => actions.deleteChat(chat.id)}>
                      <Trash2 />
                    </Button>
                  </>
                ) : null}
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto rounded-[10px] border border-line bg-surface-2/50 p-3">
              {!chat || chat.messages.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-[13px] text-ink-muted">
                    Ask about a concept, paste a question, or ask for a study plan. Try one of these:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      'Explain rotational motion collisions at JEE Advanced level.',
                      'Which three topics should I fix this week, and why?',
                      'Give me a hint (not the solution) for a tough definite-integral problem.',
                      'How should I pace a 3-hour mock test to protect accuracy?',
                    ].map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => setQuestion(prompt)}
                        className="rounded-full border border-line px-2.5 py-1 text-[12px] text-ink-muted transition-colors hover:border-brand hover:text-brand"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                chat.messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      'max-w-[92%] whitespace-pre-wrap rounded-[12px] px-3 py-2 text-[13px] leading-relaxed',
                      message.role === 'user' ? 'ml-auto bg-brand text-brand-ink' : 'bg-surface text-ink shadow-card',
                    )}
                  >
                    {message.text}
                  </div>
                ))
              )}
              {busy ? <Skeleton className="h-16 w-3/4" /> : null}
            </div>

            {error ? (
              <p role="status" className="rounded-[10px] border border-warn/40 bg-warn/10 px-3 py-2 text-[12.5px] text-warn">
                {error}
              </p>
            ) : null}

            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                const text = question.trim();
                if (!text || busy) return;
                setQuestion('');
                void send('chat', text);
              }}
            >
              <Field label="Your question" htmlFor="coach-question">
                <Textarea
                  id="coach-question"
                  rows={3}
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Ask anything JEE-related, or ask what to do next…"
                />
              </Field>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11.5px] text-ink-subtle">
                  Requests go through this app&apos;s server route; your records are sent as a summary of stored data only.
                </p>
                <Button type="submit" variant="primary" loading={busy} disabled={!question.trim()}>
                  <Send aria-hidden className="size-4" />
                  Send
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="flex items-center gap-2 text-[15px] font-semibold">
                    <Sparkles aria-hidden className="size-4 text-ink-subtle" />
                    Plan for {exam === 'jm' ? 'JEE Main' : 'JEE Advanced'}
                  </h2>
                  <p className="mt-0.5 text-[12.5px] text-ink-muted">{rulePlanHeadline(index)}</p>
                </div>
                <Badge tone={snapshot.lastPlan?.source === 'gemini' ? 'brand' : 'neutral'}>
                  {snapshot.lastPlan?.source === 'gemini' ? 'AI generated' : 'Built from your data'}
                </Badge>
              </div>

              <Field label="Minutes available today" htmlFor="coach-minutes">
                <input
                  id="coach-minutes"
                  type="range"
                  min={60}
                  max={840}
                  step={30}
                  value={availableMinutes}
                  onChange={(event) => setAvailableMinutes(Number(event.target.value))}
                  className="w-full accent-[var(--c-brand)]"
                />
              </Field>
              <p className="text-[12px] text-ink-muted">
                {formatMinutes(availableMinutes)} available · plan uses {formatMinutes(rulePlan.usedMinutes)}
              </p>

              {rulePlan.items.length === 0 ? (
                <EmptyState
                  title="Nothing outstanding"
                  description="No overdue revisions, no backlog and no weak topics flagged - either you are in great shape or there is not enough data yet."
                  action={
                    <Link href="/syllabus" className="inline-flex h-8 items-center rounded-[10px] bg-brand px-2.5 text-[13px] font-medium text-brand-ink">
                      Add syllabus progress
                    </Link>
                  }
                />
              ) : (
                <ul className="space-y-2">
                  {rulePlan.items.map((item, position) => (
                    <PlanRow
                      key={`${item.title}-${position}`}
                      item={item}
                      onAccept={() => {
                        actions.addTask({
                          title: item.title,
                          type: item.type,
                          exam: item.exam,
                          priority: item.priority,
                          subject: item.subject,
                          topicId: item.topicId,
                          estMin: item.estMin,
                          notes: item.reason,
                          link: item.topicId ? 'topic' : 'custom',
                          origin: 'ai',
                        });
                        notify('Added to today\'s plan', 'success');
                      }}
                      onReject={() => actions.setLastPlan({ ...rulePlan, items: rulePlan.items.filter((_, index2) => index2 !== position) })}
                    />
                  ))}
                </ul>
              )}

              <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const plan = buildRulePlan(snapshot, { exam, availableMinutes });
                    actions.setLastPlan(plan);
                    notify(`Plan refreshed with ${plan.items.length} items`);
                  }}
                >
                  <RefreshCw aria-hidden className="size-3.5" />
                  Rebuild plan
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    for (const item of rulePlan.items) {
                      actions.addTask({
                        title: item.title,
                        type: item.type,
                        exam: item.exam,
                        priority: item.priority,
                        subject: item.subject,
                        topicId: item.topicId,
                        estMin: item.estMin,
                        notes: item.reason,
                        link: item.topicId ? 'topic' : 'custom',
                        origin: 'ai',
                      });
                    }
                    notify(`${rulePlan.items.length} tasks added to today`, 'success');
                  }}
                >
                  <ListPlus aria-hidden className="size-3.5" />
                  Add all to today
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2">
              <h2 className="text-[15px] font-semibold">What your data says</h2>
              {insights.length === 0 ? (
                <p className="text-[12.5px] text-ink-muted">Not enough recorded activity to draw conclusions yet.</p>
              ) : (
                <ul className="space-y-2">
                  {insights.map((insight) => (
                    <li key={insight.id} className="flex gap-2 text-[12.5px] leading-relaxed">
                      <span
                        aria-hidden
                        className={cn(
                          'mt-1.5 size-1.5 shrink-0 rounded-full',
                          insight.tone === 'warn' && 'bg-warn',
                          insight.tone === 'good' && 'bg-success',
                          insight.tone === 'neutral' && 'bg-ink-subtle',
                        )}
                      />
                      <span className="text-ink-muted">{insight.text}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[11.5px] text-ink-subtle">
                These facts are computed locally from {Object.keys(snapshot.progress).length} tracked nodes,{' '}
                {snapshot.sessions.length} sessions and {snapshot.tests.length} tests.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PlanRow({ item, onAccept, onReject }: { item: AiPlanItem; onAccept(): void; onReject(): void }): React.JSX.Element {
  return (
    <li className="rounded-[10px] border border-line p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-medium leading-snug">{item.title}</p>
          <p className="mt-0.5 text-[11.5px] text-ink-muted">
            {item.subject ? SUBJECT_LABELS[item.subject] : 'General'} · {item.type} · {formatMinutes(item.estMin)} ·{' '}
            {item.exam.toUpperCase()}
            {planItemNodeLabel(item) ? ` · ${planItemNodeLabel(item)}` : ''}
          </p>
        </div>
        <Badge tone={item.priority === 'high' ? 'danger' : item.priority === 'medium' ? 'warn' : 'neutral'}>{item.priority}</Badge>
      </div>
      <p className="mt-1 text-[11.5px] text-ink-muted">{item.reason}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant="primary" onClick={onAccept}>
          <Check aria-hidden className="size-3.5" />
          Add to today
        </Button>
        <Button size="sm" variant="ghost" onClick={onReject}>
          <X aria-hidden className="size-3.5" />
          Not now
        </Button>
        {item.topicId ? (
          <Link href={`/topic/${item.topicId}?exam=${item.exam}`} className="text-[12px] font-medium text-brand hover:underline">
            Open topic
          </Link>
        ) : null}
      </div>
    </li>
  );
}

/** Kept exported for tests: the plan must always be derivable from a snapshot. */
export function planFor(snapshot: TrackerSnapshot, options: { exam?: ExamScope; availableMinutes?: number } = {}) {
  return buildRulePlan(snapshot, options);
}
