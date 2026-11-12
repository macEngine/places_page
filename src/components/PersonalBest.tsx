import { memo } from 'react';
import type { Activity } from '../types';
import { useLocale } from '../hooks/useLocale';
import { getPlaces } from '../core/placesAsActivities';

interface PersonalBestProps {
  activities: Activity[];
  onSelectActivity?: (a: Activity | null) => void;
}

function rank(values: string[], limit = 5): [string, number][] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh'))
    .slice(0, limit);
}

export const PersonalBest = memo(function PersonalBest({}: PersonalBestProps) {
  const { locale } = useLocale();
  const places = getPlaces();

  const topTags = rank(places.flatMap((p) => p.tags));
  const topCities = rank(
    places.map((p) => p.city).filter((c): c is string => !!c)
  );

  if (topTags.length === 0 && topCities.length === 0) return null;

  const section = (title: string, rows: [string, number][]) =>
    rows.length > 0 && (
      <div>
        <p className="mb-1 text-[10px] tracking-wider text-[var(--color-muted)] uppercase">
          {title}
        </p>
        <div className="divide-y divide-[var(--color-border)]">
          {rows.map(([label, count]) => (
            <div
              key={label}
              className="flex items-center justify-between gap-3 py-1.5 text-left"
            >
              <span className="truncate text-xs text-[var(--color-text)]">
                {label}
              </span>
              <span className="font-mono text-xs font-bold text-[var(--color-accent)]">
                {count}
              </span>
            </div>
          ))}
        </div>
      </div>
    );

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 hover:border-[var(--color-accent)]/30 hover:bg-[var(--color-accent)]/5 hover:shadow-[var(--color-accent)]/5 hover:shadow-lg">
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <svg
          className="h-4 w-4 text-[var(--color-accent)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
          />
        </svg>
        {locale === 'zh' ? '最常去' : 'Most visited'}
      </h3>

      <div className="grid grid-cols-2 gap-4">
        {section(locale === 'zh' ? '标签' : 'Tags', topTags)}
        {section(locale === 'zh' ? '城市' : 'Cities', topCities)}
      </div>
    </div>
  );
});
