'use client';

/**
 * Settings - profile, appearance, revision scheduling, AI status and all data
 * management (export, import, backup slots, sample data, reset).
 *
 * The Gemini key is never editable here: it lives in the server environment and
 * the UI only reports whether the server has one.
 */
import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, Database, Download, HardDriveDownload, Upload } from 'lucide-react';
import type { ThemePreference } from '@/lib/types';
import { APP_NAME, SCHEMA_VERSION } from '@/lib/constants';
import { useActions, useSnapshot, useTracker } from '@/lib/store/tracker-store';
import { repositories, estimateStorageBytes, type BackupRow } from '@/lib/repositories';
import { fetchAiStatus, testAiConnection, type AiStatus } from '@/lib/ai/client';
import { formatDate, formatMinutes, todayISO } from '@/lib/date';
import { Badge, Button, Card, CardContent, Field, Input, ProgressBar, Segmented, Stat, Switch, Textarea } from '@/components/ui/primitives';
import { ConfirmDialog } from '@/components/ui/dialog';
import { useTheme } from '@/components/layout/theme-provider';
import { DEFAULT_REVISION_INTERVALS } from '@/lib/calculations/revision';

const BACKUP_SLOTS = [1, 2, 3];

export function SettingsScreen(): React.JSX.Element {
  const snapshot = useSnapshot();
  const actions = useActions();
  const { notify, storageAvailable } = useTracker();
  const { theme, resolved, setTheme } = useTheme();
  const [status, setStatus] = React.useState<AiStatus | null>(null);
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<string | null>(null);
  const [backups, setBackups] = React.useState<BackupRow[]>([]);
  const [bytes, setBytes] = React.useState<number | null>(null);
  const [importText, setImportText] = React.useState('');
  const [importBusy, setImportBusy] = React.useState(false);
  const [confirmReset, setConfirmReset] = React.useState(false);
  const [profile, setProfile] = React.useState(snapshot.settings.profile);

  const refreshStorage = React.useCallback(async () => {
    try {
      const [rows, size] = await Promise.all([repositories.backups.list(), estimateStorageBytes()]);
      setBackups(rows.slice().sort((a, b) => a.slot - b.slot));
      setBytes(size);
    } catch {
      setBackups([]);
    }
  }, []);

  React.useEffect(() => {
    // IndexedDB is external to React, so the first read lands in state here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshStorage();
  }, [refreshStorage]);

  React.useEffect(() => {
    let cancelled = false;
    void fetchAiStatus().then((result) => {
      if (!cancelled) setStatus(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const download = () => {
    const json = actions.exportJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `jee-tracker-export-${todayISO()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    notify('Export downloaded', 'success');
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-0.5 text-[12.5px] text-ink-muted">
          {APP_NAME} · schema v{SCHEMA_VERSION} · {storageAvailable ? 'storing data in IndexedDB on this device' : 'running in memory (IndexedDB unavailable)'}
        </p>
      </header>

      <section aria-label="Storage summary" className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Stat label="Records" value={
          Object.keys(snapshot.progress).length +
          snapshot.tasks.length +
          snapshot.lectures.length +
          snapshot.sessions.length +
          snapshot.revisions.length +
          snapshot.questions.length +
          snapshot.mistakes.length +
          snapshot.tests.length
        } hint="Across every store" icon={<Database />} />
        <Stat label="Database size" value={bytes === null ? '-' : bytes > 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`} hint="Estimated from stored records" />
        <Stat label="Last updated" value={formatDate(snapshot.meta.updatedAt.slice(0, 10), 'short')} hint={`Installed ${formatDate(snapshot.meta.installedAt.slice(0, 10), 'short')}`} />
        <Stat
          label="AI"
          value={status === null ? '…' : status.available ? 'Gemini' : 'Rules only'}
          tone={status?.available ? 'success' : 'default'}
          hint={status?.available ? status.model : 'Deterministic coach from stored data'}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardContent className="space-y-4">
            <h2 className="text-[15px] font-semibold">Appearance</h2>
            <Field label="Theme" htmlFor="theme-select" hint={`Currently showing the ${resolved} theme.`}>
              <Segmented<ThemePreference>
                ariaLabel="Theme"
                value={theme}
                onChange={setTheme}
                options={[
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                  { value: 'system', label: 'System' },
                ]}
              />
            </Field>
            <Switch
              checked={snapshot.settings.showInsights}
              onCheckedChange={(checked) => actions.updateSettings({ showInsights: checked })}
              label="Show data insights"
              description="Displays the “facts from your data” list on the dashboard."
            />
            <Switch
              checked={snapshot.settings.compact}
              onCheckedChange={(checked) => actions.updateSettings({ compact: checked })}
              label="Compact layout"
              description="Tighter row spacing in long lists and tables."
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4">
            <h2 className="text-[15px] font-semibold">Profile &amp; exam</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" htmlFor="set-name">
                <Input id="set-name" value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} />
              </Field>
              <Field label="Exam label" htmlFor="set-exam">
                <Input id="set-exam" value={profile.examLabel} onChange={(event) => setProfile({ ...profile, examLabel: event.target.value })} />
              </Field>
              <Field label="JEE Main date" htmlFor="set-main">
                <Input id="set-main" type="date" value={profile.mainDate} onChange={(event) => setProfile({ ...profile, mainDate: event.target.value })} />
              </Field>
              <Field label="JEE Advanced date" htmlFor="set-advanced">
                <Input id="set-advanced" type="date" value={profile.advancedDate} onChange={(event) => setProfile({ ...profile, advancedDate: event.target.value })} />
              </Field>
              <Field label="Daily target (minutes)" htmlFor="set-daily">
                <Input
                  id="set-daily"
                  type="number"
                  min={30}
                  step={30}
                  value={profile.dailyTargetMin}
                  onChange={(event) => setProfile({ ...profile, dailyTargetMin: Math.max(30, Number(event.target.value) || 0) })}
                />
              </Field>
              <Field label="Weekly target (minutes)" htmlFor="set-weekly">
                <Input
                  id="set-weekly"
                  type="number"
                  min={60}
                  step={60}
                  value={snapshot.settings.weeklyTargetMin}
                  onChange={(event) => actions.updateSettings({ weeklyTargetMin: Math.max(60, Number(event.target.value) || 0) })}
                />
              </Field>
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11.5px] text-ink-muted">
                Target: {formatMinutes(profile.dailyTargetMin)} per day ({formatMinutes(profile.dailyTargetMin * 7)} per week).
              </p>
              <Button
                variant="primary"
                onClick={() => {
                  actions.updateSettings({ profile });
                  notify('Profile saved', 'success');
                }}
              >
                Save profile
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4">
            <h2 className="text-[15px] font-semibold">Revision scheduling</h2>
            <Switch
              checked={snapshot.settings.revision.autoSchedule}
              onCheckedChange={(checked) => actions.updateSettings({ revision: { autoSchedule: checked } })}
              label="Automatic spaced revision"
              description="Queue the next revision when a topic is completed or a revision is done."
            />
            <Field label="Intervals (days between revisions)" htmlFor="set-intervals" hint="Five steps, in days. The default ladder is 1 / 3 / 7 / 16 / 35.">
              <div id="set-intervals" className="flex flex-wrap gap-2">
                {snapshot.settings.revision.intervals.map((value, index) => (
                  <Input
                    key={index}
                    type="number"
                    min={1}
                    max={180}
                    aria-label={`Revision interval ${index + 1} in days`}
                    className="w-20"
                    value={value}
                    onChange={(event) => {
                      const intervals = [...snapshot.settings.revision.intervals];
                      intervals[index] = Math.max(1, Number(event.target.value) || 1);
                      actions.updateSettings({ revision: { intervals } });
                    }}
                  />
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => actions.updateSettings({ revision: { intervals: [...DEFAULT_REVISION_INTERVALS] } })}
                >
                  Reset to default
                </Button>
              </div>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4">
            <h2 className="text-[15px] font-semibold">AI coach</h2>
            <div className="rounded-[10px] border border-line bg-surface-2 p-3 text-[12.5px]">
              {status === null ? (
                <p>Checking the server…</p>
              ) : status.available ? (
                <p>
                  Gemini is configured on the server (model <strong>{status.model}</strong>). The API key is read from the
                  server environment (<code>GEMINI_API_KEY</code>) and is never sent to this browser.
                </p>
              ) : (
                <p>
                  {status.reason === 'disabled'
                    ? 'AI is disabled on this deployment (AI_ENABLED=false).'
                    : status.reason === 'no-key'
                      ? 'No GEMINI_API_KEY is set on the server.'
                      : 'The AI service could not be reached.'}{' '}
                  The <Link href="/coach" className="font-medium text-brand hover:underline">rule-based coach</Link> works
                  entirely from your stored data, offline included.
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                loading={testing}
                onClick={async () => {
                  setTesting(true);
                  setTestResult(null);
                  const result = await testAiConnection();
                  setTestResult(result.ok ? `Connected · ${result.message.slice(0, 60)}` : `Failed · ${result.message.slice(0, 120)}`);
                  setTesting(false);
                }}
              >
                Test connection
              </Button>
              <Button variant="ghost" onClick={() => void fetchAiStatus().then(setStatus)}>
                Recheck status
              </Button>
            </div>
            {testResult ? <p className="text-[12px] text-ink-muted">{testResult}</p> : null}
            <p className="text-[11.5px] text-ink-subtle">
              Deployments set these on the server: <code>GEMINI_API_KEY</code>, optional <code>GEMINI_MODEL</code> and{' '}
              <code>AI_ENABLED=false</code> to switch AI off entirely.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <h2 className="text-[15px] font-semibold">Data management</h2>
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="space-y-2 rounded-[10px] border border-line p-3">
              <p className="text-[13px] font-medium">Export &amp; import</p>
              <p className="text-[11.5px] text-ink-muted">
                A full JSON export of every store. Import accepts the app&apos;s own export, the legacy
                <code> jee-pcm-tracker </code> export and a raw legacy state object.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={download}>
                  <Download aria-hidden className="size-3.5" />
                  Export JSON
                </Button>
                <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[10px] border border-line bg-surface-2 px-2.5 text-[13px] font-medium">
                  <Upload aria-hidden className="size-3.5" />
                  Choose file
                  <input
                    type="file"
                    accept="application/json,.json"
                    className="sr-only"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      setImportBusy(true);
                      try {
                        const text = await file.text();
                        const result = await actions.importJson(text);
                        notify(`Imported ${Object.values(result.counts).reduce((total, count) => total + count, 0)} records`, 'success');
                        void refreshStorage();
                      } catch (error) {
                        notify(error instanceof Error ? error.message : 'Import failed', 'error');
                      }
                      setImportBusy(false);
                      event.target.value = '';
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="space-y-2 rounded-[10px] border border-line p-3">
              <p className="text-[13px] font-medium">Backup slots</p>
              <p className="text-[11.5px] text-ink-muted">Three in-app snapshots, stored in IndexedDB next to your data.</p>
              <ul className="space-y-1.5">
                {BACKUP_SLOTS.map((slot) => {
                  const row = backups.find((entry) => entry.slot === slot);
                  return (
                    <li key={slot} className="flex items-center justify-between gap-2 text-[12.5px]">
                      <span className="min-w-0">
                        <span className="block font-medium">Slot {slot}</span>
                        <span className="block truncate text-[11px] text-ink-muted">
                          {row ? `${formatDate(row.createdAt.slice(0, 10), 'short')} · ${row.records} records` : 'empty'}
                        </span>
                      </span>
                      <span className="flex shrink-0 gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            await actions.backupToSlot(slot);
                            await refreshStorage();
                            notify(`Backup saved to slot ${slot}`, 'success');
                          }}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!row}
                          onClick={async () => {
                            await actions.restoreSlot(slot);
                            notify(`Restored slot ${slot}`, 'success');
                          }}
                        >
                          Restore
                        </Button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="space-y-2 rounded-[10px] border border-line p-3">
              <p className="text-[13px] font-medium">Sample data</p>
              <p className="text-[11.5px] text-ink-muted">
                Load a clearly-labelled demonstration dataset to explore every screen, or clear it again. Real tracking
                always starts from an empty tracker.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    await actions.loadSampleData();
                    notify('Sample data loaded (clearly labelled)', 'success');
                  }}
                >
                  <HardDriveDownload aria-hidden className="size-3.5" />
                  Load sample
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!snapshot.meta.sampleDataLoaded}
                  onClick={async () => {
                    await actions.clearSampleData();
                    notify('Sample data cleared');
                  }}
                >
                  Clear sample
                </Button>
              </div>
              {snapshot.meta.sampleDataLoaded ? <Badge tone="warn">Sample data is currently loaded</Badge> : null}
            </div>
          </div>

          <div className="space-y-2 rounded-[10px] border border-danger/30 bg-danger/5 p-3">
            <p className="flex items-center gap-2 text-[13px] font-medium text-danger">
              <AlertTriangle aria-hidden className="size-4" />
              Danger zone
            </p>
            <p className="text-[11.5px] text-ink-muted">
              Resetting deletes every stored record on this device. Export first if you might want the data back.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="danger" onClick={() => setConfirmReset(true)}>
                Reset all data
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await actions.resetAll(true);
                  notify('Data reset, profile kept');
                }}
              >
                Reset but keep profile
              </Button>
            </div>
          </div>

          <details className="rounded-[10px] border border-line p-3">
            <summary className="cursor-pointer text-[13px] font-medium">Import from pasted JSON</summary>
            <div className="mt-2 space-y-2">
              <Textarea
                rows={5}
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                aria-label="Paste exported JSON"
                placeholder='{"app":"jee-command-center", …}'
              />
              <Button
                size="sm"
                variant="primary"
                loading={importBusy}
                disabled={!importText.trim()}
                onClick={async () => {
                  setImportBusy(true);
                  try {
                    const result = await actions.importJson(importText);
                    notify(`Imported ${Object.values(result.counts).reduce((total, count) => total + count, 0)} records`, 'success');
                    setImportText('');
                    void refreshStorage();
                  } catch (error) {
                    notify(error instanceof Error ? error.message : 'Import failed', 'error');
                  }
                  setImportBusy(false);
                }}
              >
                Import pasted JSON
              </Button>
            </div>
          </details>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h2 className="text-[15px] font-semibold">Syllabus provenance</h2>
          <p className="text-[12.5px] text-ink-muted">
            Main: {snapshot.syllabusMeta.mainSource} ({snapshot.syllabusMeta.mainYear}). Advanced:{' '}
            {snapshot.syllabusMeta.advancedSource} ({snapshot.syllabusMeta.advancedYear}). Retrieved{' '}
            {snapshot.syllabusMeta.retrieved}.
          </p>
          {snapshot.syllabusMeta.note ? <p className="text-[11.5px] text-ink-subtle">{snapshot.syllabusMeta.note}</p> : null}
          <div className="flex flex-wrap gap-3 text-[12.5px]">
            <a href={snapshot.syllabusMeta.mainUrl} target="_blank" rel="noreferrer" className="font-medium text-brand hover:underline">
              JEE Main syllabus source
            </a>
            <a href={snapshot.syllabusMeta.advancedUrl} target="_blank" rel="noreferrer" className="font-medium text-brand hover:underline">
              JEE Advanced syllabus source
            </a>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h2 className="text-[15px] font-semibold">Storage health</h2>
          <p className="text-[12.5px] text-ink-muted">
            {storageAvailable
              ? 'IndexedDB is available: your tracker works offline and survives reloads. Use Export regularly if the data matters.'
              : 'IndexedDB is blocked (private browsing or a hardened browser). Changes will be lost when this tab closes - export your data instead.'}
          </p>
          {bytes !== null ? (
            <div>
              <div className="flex items-center justify-between text-[11.5px] text-ink-muted">
                <span>Approximate usage</span>
                <span>{Math.round(bytes / 1024)} KB</span>
              </div>
              <ProgressBar value={Math.min(100, (bytes / (50 * 1024 * 1024)) * 100)} tone="brand" label="Estimated storage usage" />
              <p className="mt-1 text-[11px] text-ink-subtle">
                Shown against a 50 MB reference; browsers typically allow far more per origin.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Reset all tracker data?"
        message="This deletes progress, tasks, lectures, sessions, revisions, questions, mistakes and tests from this device. Exported backups are unaffected."
        confirmLabel="Delete everything"
        destructive
        onConfirm={async () => {
          await actions.resetAll(false);
          notify('All data reset', 'success');
        }}
      />
    </div>
  );
}
