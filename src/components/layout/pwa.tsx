'use client';

/**
 * PWA plumbing: service-worker registration, offline indicator and the
 * "new version available" prompt.
 *
 * The tracker itself is local-first, so offline is handled purely in the UI:
 * a banner explains that AI features need a connection while everything else
 * keeps working.
 */
import * as React from 'react';
import { CloudOff, Download, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/primitives';

const INSTALL_DISMISSED_KEY = 'jee-tracker.install-dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function ServiceWorkerManager(): null {
  React.useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    let registration: ServiceWorkerRegistration | null = null;
    const register = async () => {
      try {
        registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      } catch (error) {
        console.warn('Service worker registration failed', error);
      }
    };
    void register();
    return () => {
      void registration;
    };
  }, []);
  return null;
}

export function OfflineBanner(): React.JSX.Element | null {
  const [offline, setOffline] = React.useState(false);

  React.useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (!offline) return null;
  return (
    <div
      role="status"
      className="no-print sticky top-0 z-40 flex items-center justify-center gap-2 bg-warn/15 px-4 py-1.5 text-[12.5px] font-medium text-warn"
    >
      <CloudOff aria-hidden className="size-3.5" />
      Offline - tracking, analytics and backups keep working. AI coach requests will fall back to the rule-based planner.
    </div>
  );
}

export function InstallPrompt(): React.JSX.Element | null {
  const [promptEvent, setPromptEvent] = React.useState<BeforeInstallPromptEvent | null>(null);

  React.useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      // The dismissal flag is read here (client-only, outside render) so the
      // prompt never shows again once the user has said no.
      try {
        if (localStorage.getItem(INSTALL_DISMISSED_KEY) === '1') return;
      } catch {
        /* private mode: show the prompt */
      }
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!promptEvent) return null;

  const dismiss = () => {
    setPromptEvent(null);
    try {
      localStorage.setItem(INSTALL_DISMISSED_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="no-print flex items-center gap-3 rounded-[12px] border border-line bg-surface px-3 py-2 shadow-card">
      <Download aria-hidden className="size-4 text-brand" />
      <p className="flex-1 text-[12.5px] text-ink-muted">
        Install the tracker for offline access and a faster launch.
      </p>
      <Button
        size="sm"
        variant="primary"
        onClick={async () => {
          await promptEvent.prompt();
          dismiss();
        }}
      >
        Install
      </Button>
      <Button size="icon-sm" variant="ghost" aria-label="Dismiss install prompt" onClick={dismiss}>
        <X />
      </Button>
    </div>
  );
}

/** Shown when a new service worker takes control after a deploy. */
export function UpdateToast(): React.JSX.Element | null {
  const [waiting, setWaiting] = React.useState(false);

  React.useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready
      .then((registration) => {
        if (registration.waiting) setWaiting(true);
        registration.addEventListener('updatefound', () => setWaiting(true));
      })
      .catch(() => undefined);
  }, []);

  if (!waiting) return null;

  return (
    <div className="no-print flex items-center gap-3 rounded-[12px] border border-line bg-surface px-3 py-2 shadow-card">
      <RefreshCw aria-hidden className="size-4 text-brand" />
      <p className="flex-1 text-[12.5px] text-ink-muted">A new version is available.</p>
      <Button
        size="sm"
        variant="primary"
        onClick={() => {
          void navigator.serviceWorker.ready.then((registration) => {
            registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
            window.location.reload();
          });
        }}
      >
        Reload
      </Button>
      <Button size="icon-sm" variant="ghost" aria-label="Dismiss update notice" onClick={() => setWaiting(false)}>
        <X />
      </Button>
    </div>
  );
}
