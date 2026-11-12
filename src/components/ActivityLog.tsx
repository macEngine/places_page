import { useState, useMemo } from 'react';
import type { Activity, SportFilter } from '../types';
import { useLocale } from '../hooks/useLocale';
import { useAnnotations } from '../core/hooks/useAnnotations';
import { parseLocation } from '../core/placesAsActivities';

interface ActivityLogProps {
  activities: Activity[];
  years: number[];
  year: number | null;
  setYear: (y: number | null) => void;
  selectedActivity?: Activity | null;
  onSelectActivity?: (a: Activity | null) => void;
  filter?: SportFilter;
}

const PAGE_SIZE = 16;

/** country · province · city with consecutive duplicates removed. */
function whereLabel(loc: string | null): string {
  const { country, province, city } = parseLocation(loc);
  const parts: string[] = [];
  for (const value of [country, province, city]) {
    if (value && parts[parts.length - 1] !== value) parts.push(value);
  }
  return parts.join(' · ');
}

export function ActivityLog({
  activities,
  years,
  year,
  setYear,
  selectedActivity,
  onSelectActivity,
}: ActivityLogProps) {
  const { t, locale } = useLocale();
  const annotations = useAnnotations();
  const [page, setPage] = useState(0);

  const sorted = useMemo(
    () =>
      [...activities].sort(
        (a, b) =>
          new Date(b.start_date_local).getTime() -
          new Date(a.start_date_local).getTime()
      ),
    [activities]
  );
  const selectedId = selectedActivity?.run_id;
  const [previousSelection, setPreviousSelection] = useState(selectedId);
  const [previousSorted, setPreviousSorted] = useState(sorted);
  if (previousSelection !== selectedId || previousSorted !== sorted) {
    setPreviousSelection(selectedId);
    setPreviousSorted(sorted);
    const idx = sorted.findIndex((a) => a.run_id === selectedId);
    if (idx >= 0) {
      setPage(Math.floor(idx / PAGE_SIZE));
    } else {
      setPage(
        Math.min(page, Math.max(0, Math.ceil(sorted.length / PAGE_SIZE) - 1))
      );
    }
  }

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageData = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div
      aria-label={t('activityLog')}
      role="region"
      className="activity-log-card rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 sm:p-6"
    >
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{t('activityLog')}</h2>
        <span className="text-sm text-[var(--color-muted)]">
          {t('showing')} {sorted.length ? page * PAGE_SIZE + 1 : 0}-
          {Math.min((page + 1) * PAGE_SIZE, sorted.length)} {t('of')}{' '}
          {sorted.length}
        </span>
      </div>

      {/* Year tabs */}
      <div
        role="group"
        aria-label={locale === 'zh' ? '地点年份' : 'Place year'}
        className="mb-5 flex flex-wrap items-center gap-2"
      >
        <button
          aria-pressed={year === null}
          onClick={() => {
            onSelectActivity?.(null);
            setYear(null);
            setPage(0);
          }}
          className={`rounded-full px-3 py-1 text-xs font-medium ${year === null ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]' : 'bg-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]'}`}
        >
          {t('all')}
        </button>
        {years.map((y) => (
          <button
            key={y}
            aria-pressed={year === y}
            onClick={() => {
              onSelectActivity?.(null);
              setYear(y);
              setPage(0);
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium ${year === y ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]' : 'bg-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]'}`}
          >
            {y}
          </button>
        ))}
      </div>

      <p className="table-scroll-hint mb-2 text-xs text-[var(--color-muted)]">
        {locale === 'zh'
          ? '左右滑动查看更多，点击记录在地图上定位'
          : 'Swipe for more; select a place to locate it on the map'}
      </p>
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-muted)]">
              <th className="pb-3 font-medium">{t('date')}</th>
              <th className="pb-3 font-medium">{t('type')}</th>
              <th className="pb-3 font-medium">{t('name')}</th>
              <th className="pb-3 font-medium">{t('where')}</th>
              <th className="pb-3 font-medium">{t('tags')}</th>
              <th className="pb-3 font-medium">{t('note')}</th>
              <th className="pb-3 font-medium">{t('link')}</th>
            </tr>
          </thead>
          <tbody>
            {!pageData.length && (
              <tr>
                <td
                  colSpan={7}
                  className="py-10 text-center text-[var(--color-muted)]"
                >
                  {locale === 'zh' ? '暂无地点' : 'No places yet'}
                </td>
              </tr>
            )}
            {pageData.map((a) => {
              const note = annotations[a.start_date_local];
              const tags = note?.tags ?? [];
              const type = tags[0] ?? '—';
              return (
                <tr
                  key={a.run_id}
                  tabIndex={onSelectActivity ? 0 : undefined}
                  aria-selected={selectedActivity?.run_id === a.run_id}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelectActivity?.(
                        selectedActivity?.run_id === a.run_id ? null : a
                      );
                    }
                  }}
                  onClick={() =>
                    onSelectActivity?.(
                      selectedActivity?.run_id === a.run_id ? null : a
                    )
                  }
                  className={`cursor-pointer border-b border-[var(--color-border)]/30 transition-colors ${
                    selectedActivity?.run_id === a.run_id
                      ? 'border-l-2 border-l-[var(--color-accent)] bg-[var(--color-accent)]/10'
                      : 'hover:bg-[var(--color-bg)]'
                  }`}
                >
                  <td className="py-3 text-[var(--color-muted)]">
                    {a.start_date_local.slice(0, 10)}
                  </td>
                  <td className="py-3">
                    <span className="text-[var(--color-muted)]">{type}</span>
                  </td>
                  <td className="py-3">{a.name || t('name')}</td>
                  <td className="py-3 text-[var(--color-muted)]">
                    {whereLabel(a.location_country) || '—'}
                  </td>
                  <td className="py-3">
                    {tags.length ? (
                      <span className="flex flex-wrap gap-1">
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-[var(--color-border)] px-2 py-0.5 text-xs text-[var(--color-muted)]"
                          >
                            {tag}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="text-[var(--color-muted)]">—</span>
                    )}
                  </td>
                  <td className="max-w-[16rem] truncate py-3 text-[var(--color-muted)]">
                    {note?.note || '—'}
                  </td>
                  <td className="py-3">
                    {note?.link ? (
                      <a
                        href={note.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        className="text-[var(--color-accent)]"
                        title={note.link}
                      >
                        ↗
                      </a>
                    ) : (
                      <span className="text-[var(--color-muted)]">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border)] pt-4">
        <button
          aria-label={locale === 'zh' ? '上一页' : 'Previous page'}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className="text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)] disabled:opacity-30"
        >
          ←
        </button>
        <span className="text-sm text-[var(--color-muted)]">
          {t('page')} {totalPages ? page + 1 : 0} {t('pageOf')} {totalPages}{' '}
          {t('pages')}
        </span>
        <button
          aria-label={locale === 'zh' ? '下一页' : 'Next page'}
          onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          disabled={page >= totalPages - 1}
          className="text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)] disabled:opacity-30"
        >
          →
        </button>
      </div>
    </div>
  );
}
