'use client';

/**
 * Application shell: persistent sidebar on desktop, bottom navigation plus a
 * "more" sheet on mobile. Also owns the first-run setup and the storage-health
 * banner, both of which act on real data.
 */
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertTriangle, ChevronRight, Flame, Menu, Moon, Sun, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMinutes, todayISO } from '@/lib/date';
import { APP_NAME } from '@/lib/constants';
import { useTracker } from '@/lib/store/tracker-store';
import { Button, Card, CardContent, Field, Input, ProgressBar, Skeleton, Switch } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/dialog';
import { InstallPrompt, UpdateToast } from '@/components/layout/pwa';
import { useTheme } from '@/components/layout/theme-provider';
import { NAV_MORE, NAV_PRIMARY, NAV_SECTIONS, isActivePath, titleForPath, type NavItem } from '@/components/layout/nav-config';
import { streakInfo, studyTimeSummary } from '@/lib/calculations/analytics';

export function AppShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { ready, error, storageAvailable, snapshot, actions } = useTracker();
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = React.useState(false);

  const showOnboarding = ready && !snapshot.meta.onboarded;

  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[16.5rem_minmax(0,1fr)]">
      <Sidebar pathname={pathname} />
      <div className="flex min-h-dvh flex-col">
        <MobileTopBar pathname={pathname} onOpenMore={() => setMoreOpen(true)} />
        {!storageAvailable && error ? (
          <div role="alert" className="no-print flex items-start gap-2 border-b border-danger/30 bg-danger/10 px-4 py-2 text-[12.5px] text-danger">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
            <p>{error}</p>
          </div>
        ) : null}
        <main id="main" className="mx-auto w-full max-w-[104rem] flex-1 px-3 pb-24 pt-4 sm:px-5 lg:pb-10 lg:pt-6">
          {ready ? (
            children
          ) : (
            <LoadingShell />
          )}
        </main>
        <div className="no-print mx-auto w-full max-w-[104rem] space-y-2 px-3 pb-4 sm:px-5 lg:pb-6">
          <InstallPrompt />
          <UpdateToast />
        </div>
      </div>
      <BottomNav pathname={pathname} onOpenMore={() => setMoreOpen(true)} />
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} pathname={pathname} />
      <FirstRunDialog open={showOnboarding} onDone={() => actions.markOnboarded()} />
    </div>
  );
}

/* ----------------------------------------------------------------- sidebar */

function Sidebar({ pathname }: { pathname: string }): React.JSX.Element {
  const { index, snapshot, clock } = useTracker();
  const time = React.useMemo(() => studyTimeSummary(index, todayISO()), [index]);
  const streak = React.useMemo(() => streakInfo(index), [index]);
  const running = snapshot.timer.running;
  const elapsed = React.useMemo(() => elapsedMinutes(snapshot.timer.startedAt, snapshot.timer.pausedMs, clock), [snapshot.timer, clock]);

  return (
    <aside className="no-print hidden border-r border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <Logo />
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold leading-tight">{APP_NAME}</p>
          <p className="truncate text-[11.5px] text-ink-muted">{snapshot.settings.profile.examLabel || 'JEE preparation'}</p>
        </div>
      </div>

      <nav aria-label="Sections" className="scroll-x flex-1 space-y-4 overflow-y-auto px-2 pb-3">
        <ul className="space-y-0.5">
          {NAV_PRIMARY.map((item) => (
            <li key={item.href}>
              <NavLink item={item} active={isActivePath(pathname, item.href)} />
            </li>
          ))}
        </ul>
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="px-2.5 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-ink-subtle">{section.title}</p>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.href}>
                  <NavLink item={item} active={isActivePath(pathname, item.href)} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-2 border-t border-line p-3">
        {running ? (
          <Link href="/timer" className="flex items-center gap-2 rounded-[10px] border border-brand/40 bg-brand-soft px-2.5 py-2 text-[12.5px] font-medium text-brand">
            <Timer aria-hidden className="size-3.5" />
            <span className="flex-1 truncate">Recording · {formatMinutes(elapsed)}</span>
            <ChevronRight aria-hidden className="size-3.5" />
          </Link>
        ) : null}
        <div className="rounded-[10px] border border-line p-2.5">
          <div className="flex items-center justify-between text-[11.5px] text-ink-muted">
            <span>Today</span>
            <span className="font-semibold tabular text-ink">{formatMinutes(time.today)}</span>
          </div>
          <ProgressBar
            className="mt-1.5"
            value={snapshot.settings.profile.dailyTargetMin ? (time.today / snapshot.settings.profile.dailyTargetMin) * 100 : 0}
            label="Study time against today's target"
            tone={time.today >= snapshot.settings.profile.dailyTargetMin ? 'success' : 'brand'}
          />
          <div className="mt-1.5 flex items-center justify-between text-[11.5px] text-ink-muted">
            <span className="inline-flex items-center gap-1">
              <Flame aria-hidden className={cn('size-3', streak.current > 0 && 'text-warn')} />
              {streak.current}-day streak
            </span>
            <span>{formatMinutes(snapshot.settings.profile.dailyTargetMin)} goal</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }): React.JSX.Element {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13px] transition-colors',
        active ? 'bg-brand-soft font-semibold text-brand' : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
      )}
    >
      <Icon aria-hidden className="size-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

/* ------------------------------------------------------------ mobile chrome */

function MobileTopBar({ pathname, onOpenMore }: { pathname: string; onOpenMore(): void }): React.JSX.Element {
  const { theme, resolved, setTheme } = useTheme();
  return (
    <header className="no-print sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-surface/95 px-3 py-2 backdrop-blur lg:hidden">
      <Logo />
      <h1 className="min-w-0 flex-1 truncate text-[14.5px] font-semibold">{titleForPath(pathname)}</h1>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} theme`}
        onClick={() => setTheme(theme === 'dark' || (theme === 'system' && resolved === 'dark') ? 'light' : 'dark')}
      >
        {resolved === 'dark' ? <Sun /> : <Moon />}
      </Button>
      <Button size="icon-sm" variant="ghost" aria-label="Open all sections" onClick={onOpenMore}>
        <Menu />
      </Button>
    </header>
  );
}

function BottomNav({ pathname, onOpenMore }: { pathname: string; onOpenMore(): void }): React.JSX.Element {
  return (
    <nav
      aria-label="Primary"
      className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/97 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {NAV_PRIMARY.map((item) => {
          const active = isActivePath(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-1 py-2 text-[10.5px] font-medium',
                  active ? 'text-brand' : 'text-ink-muted',
                )}
              >
                <Icon aria-hidden className="size-4.5" />
                <span className="truncate">{item.shortLabel ?? item.label}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={onOpenMore}
            className="flex w-full flex-col items-center gap-0.5 px-1 py-2 text-[10.5px] font-medium text-ink-muted"
          >
            <Menu aria-hidden className="size-4.5" />
            <span>More</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

function MoreSheet({
  open,
  onOpenChange,
  pathname,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  pathname: string;
}): React.JSX.Element {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="All sections" description="Everything in the tracker">
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {NAV_MORE.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => onOpenChange(false)}
                className={cn(
                  'flex items-start gap-2.5 rounded-[10px] border p-2.5',
                  active ? 'border-brand/40 bg-brand-soft' : 'border-line hover:bg-surface-2',
                )}
              >
                <Icon aria-hidden className={cn('mt-0.5 size-4', active ? 'text-brand' : 'text-ink-subtle')} />
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium">{item.label}</span>
                  <span className="block truncate text-[11.5px] text-ink-muted">{item.description}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}

/* ------------------------------------------------------------- first run */

function FirstRunDialog({ open, onDone }: { open: boolean; onDone(): void }): React.JSX.Element {
  const { snapshot, actions } = useTracker();
  const [name, setName] = React.useState(snapshot.settings.profile.name);
  const [examLabel, setExamLabel] = React.useState(snapshot.settings.profile.examLabel || 'JEE 2027');
  const [mainDate, setMainDate] = React.useState(snapshot.settings.profile.mainDate);
  const [advancedDate, setAdvancedDate] = React.useState(snapshot.settings.profile.advancedDate);
  const [dailyHours, setDailyHours] = React.useState(Math.round((snapshot.settings.profile.dailyTargetMin / 60) * 2) / 2);
  const [withSample, setWithSample] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  return (
    <Modal
      open={open}
      onOpenChange={() => undefined}
      size="md"
      title="Set up your tracker"
      description="These values drive the countdown, the daily goal and the progress maths. You can change them later in Settings."
      footer={
        <Button
          variant="primary"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            actions.updateSettings({
              profile: {
                name: name.trim(),
                examLabel: examLabel.trim() || 'JEE',
                mainDate,
                advancedDate,
                dailyTargetMin: Math.max(30, Math.round(dailyHours * 60)),
              },
            });
            if (withSample) await actions.loadSampleData();
            onDone();
            setBusy(false);
          }}
        >
          Start tracking
        </Button>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Your name" htmlFor="setup-name">
            <Input id="setup-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Optional" />
          </Field>
          <Field label="Target exam label" htmlFor="setup-exam">
            <Input id="setup-exam" value={examLabel} onChange={(event) => setExamLabel(event.target.value)} placeholder="JEE 2027" />
          </Field>
          <Field label="JEE Main date" htmlFor="setup-main">
            <Input id="setup-main" type="date" value={mainDate} onChange={(event) => setMainDate(event.target.value)} />
          </Field>
          <Field label="JEE Advanced date" htmlFor="setup-advanced">
            <Input id="setup-advanced" type="date" value={advancedDate} onChange={(event) => setAdvancedDate(event.target.value)} />
          </Field>
        </div>
        <Field label="Daily study-time goal (hours)" htmlFor="setup-hours" hint="Used for the streak, the daily target bar and the planner's workload warning.">
          <Input
            id="setup-hours"
            type="number"
            min={1}
            max={14}
            step={0.5}
            value={dailyHours}
            onChange={(event) => setDailyHours(Number(event.target.value) || 6)}
          />
        </Field>
        <Card className="bg-surface-2">
          <CardContent className="p-3">
            <Switch
              checked={withSample}
              onCheckedChange={setWithSample}
              label="Load the labelled sample dataset"
              description="Shows every screen with realistic data (clearly marked as sample). Your real records start empty so nothing is invented."
            />
          </CardContent>
        </Card>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------- helpers */

function Logo(): React.JSX.Element {
  return (
    <span
      aria-hidden
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-brand text-[13px] font-bold text-brand-ink"
    >
      JEE
    </span>
  );
}

function LoadingShell(): React.JSX.Element {
  return (
    <div aria-busy className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-7 w-64" />
      </div>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
      <p className="text-center text-[12.5px] text-ink-muted">Opening your local database…</p>
    </div>
  );
}

export function elapsedMinutes(startedAt: string | null, pausedMs: number, nowMs: number): number {
  if (!startedAt) return 0;
  const start = new Date(startedAt).getTime();
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.floor((nowMs - start - pausedMs) / 60000));
}
