import {
  BarChart3,
  BookOpen,
  Bot,
  CalendarDays,
  FileWarning,
  FlaskConical,
  Gauge,
  LayoutDashboard,
  ListChecks,
  Layers,
  Repeat,
  Search,
  Settings,
  Timer,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  description: string;
  /** Shown in the mobile bottom bar. */
  primaryMobile?: boolean;
}

export const NAV_PRIMARY: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, description: "Today's command centre", primaryMobile: true },
  { href: '/syllabus', label: 'Syllabus', icon: BookOpen, description: 'JEE Main + Advanced tree', primaryMobile: true },
  { href: '/planner', label: 'Planner', shortLabel: 'Plan', icon: CalendarDays, description: 'Daily and weekly plan', primaryMobile: true },
  { href: '/revision', label: 'Revision', icon: Repeat, description: 'Spaced revision queue', primaryMobile: true },
];

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Plan',
    items: [
      { href: '/planner', label: 'Planner', icon: CalendarDays, description: 'Daily and weekly plan' },
      { href: '/backlog', label: 'Backlog', icon: Layers, description: 'Carried-over work and debt' },
      { href: '/revision', label: 'Revision', icon: Repeat, description: 'Spaced revision queue' },
      { href: '/timer', label: 'Study timer', icon: Timer, description: 'Track real study time' },
    ],
  },
  {
    title: 'Track',
    items: [
      { href: '/syllabus', label: 'Syllabus', icon: BookOpen, description: 'Chapters, topics and subtopics' },
      { href: '/lectures', label: 'Lectures', icon: ListChecks, description: 'Lecture library and progress' },
      { href: '/questions', label: 'Questions', icon: FlaskConical, description: 'DPP, PYQ and practice logs' },
      { href: '/tests', label: 'Mock tests', icon: Gauge, description: 'Scores, accuracy, analysis' },
      { href: '/mistakes', label: 'Mistake book', icon: FileWarning, description: 'Errors worth never repeating' },
    ],
  },
  {
    title: 'Insights',
    items: [
      { href: '/analytics', label: 'Analytics', icon: BarChart3, description: 'Progress, time and performance' },
      { href: '/coach', label: 'AI coach', icon: Bot, description: 'Data-grounded analysis and plans' },
      { href: '/search', label: 'Search', icon: Search, description: 'Find anything you have tracked' },
    ],
  },
  {
    title: 'System',
    items: [
      { href: '/settings', label: 'Settings', icon: Settings, description: 'Profile, data, appearance, AI' },
    ],
  },
];

export const NAV_ALL: NavItem[] = [...NAV_PRIMARY, ...NAV_SECTIONS.flatMap((section) => section.items)].filter(
  (item, index, all) => all.findIndex((entry) => entry.href === item.href) === index,
);

/** Mobile "More" sheet: everything that is not in the bottom bar. */
export const NAV_MORE: NavItem[] = NAV_ALL.filter((item) => !item.primaryMobile);

export function isActivePath(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function titleForPath(pathname: string): string {
  const match = NAV_ALL.filter((item) => isActivePath(pathname, item.href)).sort((a, b) => b.href.length - a.href.length)[0];
  return match?.label ?? 'JEE Command Center';
}
