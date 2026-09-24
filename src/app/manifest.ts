import type { MetadataRoute } from 'next';
import { APP_NAME } from '@/lib/constants';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} - JEE Main + Advanced tracker`,
    short_name: 'JEE Tracker',
    description:
      'Local-first JEE Main and JEE Advanced preparation workspace: syllabus tracking, study planner, backlog, spaced revision, mock tests, mistake book, analytics and an AI coach.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#f7f6f3',
    theme_color: '#0f766e',
    categories: ['education', 'productivity'],
    lang: 'en',
    dir: 'ltr',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Start a study session', short_name: 'Timer', url: '/timer' },
      { name: "Today's plan", short_name: 'Planner', url: '/planner' },
      { name: 'Revisions due', short_name: 'Revision', url: '/revision' },
    ],
  };
}
