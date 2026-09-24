import type { Metadata, Viewport } from 'next';
import './globals.css';
import { APP_NAME } from '@/lib/constants';
import { ThemeProvider, themeBootstrapScript } from '@/components/layout/theme-provider';
import { TrackerProvider } from '@/lib/store/tracker-store';
import { AppShell } from '@/components/layout/app-shell';
import { Toaster } from '@/components/ui/toaster';
import { OfflineBanner, ServiceWorkerManager } from '@/components/layout/pwa';

const DESCRIPTION =
  'Local-first JEE Main and JEE Advanced preparation workspace: the full syllabus, study planner, backlog, spaced revision, mock test analysis, mistake book, analytics and an AI coach grounded in your own data.';

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: `${APP_NAME} - JEE Main + Advanced tracker`,
    template: `%s · ${APP_NAME}`,
  },
  description: DESCRIPTION,
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'JEE Tracker', statusBarStyle: 'default' },
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  formatDetection: { telephone: false, address: false, email: false },
  openGraph: {
    title: `${APP_NAME} - JEE Main + Advanced tracker`,
    description: DESCRIPTION,
    type: 'website',
    siteName: APP_NAME,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f5f2' },
    { media: '(prefers-color-scheme: dark)', color: '#0c1116' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies the stored theme before first paint - no flash of the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="min-h-dvh antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:shadow-pop"
        >
          Skip to content
        </a>
        <ThemeProvider>
          <TrackerProvider>
            <OfflineBanner />
            <AppShell>{children}</AppShell>
            <Toaster />
            <ServiceWorkerManager />
          </TrackerProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
