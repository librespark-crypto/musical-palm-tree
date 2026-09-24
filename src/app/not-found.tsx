import Link from 'next/link';

export default function NotFound(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-xl py-12 text-center">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-subtle">404</p>
      <h1 className="mt-1 text-xl font-semibold">That page does not exist</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
        The link may point at a topic from an older syllabus revision, or the URL may be mistyped.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link href="/" className="inline-flex h-9.5 items-center rounded-[10px] bg-brand px-4 text-sm font-medium text-brand-ink">
          Dashboard
        </Link>
        <Link
          href="/syllabus"
          className="inline-flex h-9.5 items-center rounded-[10px] border border-line bg-surface-2 px-4 text-sm font-medium"
        >
          Syllabus
        </Link>
      </div>
    </div>
  );
}
