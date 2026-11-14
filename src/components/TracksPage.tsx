import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { exportCard } from '../utils/exportCard';
import { RouteMap } from './RouteMap';
import type { Activity } from '../types';
import { getAvailableYears } from '../hooks/useActivities';
import { useLocale } from '../hooks/useLocale';
import { useAnnotations } from '../core/hooks/useAnnotations';
import {
  collectTags,
  matchesAnnotation,
  parseQuery,
} from '../core/annotations';
import { parseLocation } from '../core/placesAsActivities';

type SportType = 'Place';
const trackPlaceholders = Array.from({ length: 40 }, (_, id) => ({
  id,
  delay: id * 20,
}));

interface TracksPageProps {
  activities: Activity[];
  filter: string;
  dark?: boolean;
  onBack: () => void;
  onSelectActivity?: (a: Activity | null) => void;
}

/** country · province · city with consecutive duplicates removed. */
function whereLabel(loc: string | null): string {
  const { country, province, city } = parseLocation(loc);
  const parts: string[] = [];
  for (const value of [country, province, city]) {
    if (value && parts[parts.length - 1] !== value) parts.push(value);
  }
  return parts.join(' · ');
}

const PLACE_COLOR = '#f97316';

const TrackThumb = memo(function TrackThumb({
  activity,
  note,
  selected,
  onClick,
}: {
  activity: Activity;
  note?: string;
  selected: boolean;
  onClick: (activity: Activity) => void;
}) {
  // Square tile: a circle wastes its corners and forced 9px text. 120px
  // square with 13px text keeps 3-4 lines of a Chinese shop name legible.
  const size = 120;
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={activity.name}
      className={`track-thumb group relative cursor-pointer rounded-lg transition-all ${selected ? 'ring-2 ring-[var(--color-accent)] ring-offset-1 ring-offset-[var(--color-bg)]' : ''}`}
      onClick={() => onClick(activity)}
      title={note ? `${activity.name} — ${note}` : activity.name}
    >
      <span
        style={{ width: size, height: size, backgroundColor: PLACE_COLOR }}
        className={`flex items-center justify-center rounded-lg p-2.5 text-center text-[13px] leading-snug font-semibold text-white transition-opacity ${selected ? 'opacity-100' : 'opacity-85 group-hover:opacity-100'}`}
      >
        <span className="line-clamp-4 break-all">{activity.name}</span>
      </span>
    </button>
  );
});

export function TracksPage({
  activities,
  onBack,
  dark,
  onSelectActivity,
}: TracksPageProps) {
  const { locale } = useLocale();
  const allYears = useMemo(() => getAvailableYears(activities), [activities]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [sportFilter, setSportFilter] = useState<SportType | null>(null);
  const [query, setQuery] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const annotations = useAnnotations();
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(
    null
  );
  const [sortBy, setSortBy] = useState<'date' | 'name'>('date');

  // Export
  const captureRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState('');
  const [exportUrl, setExportUrl] = useState('');
  const previewRef = useRef<HTMLDivElement>(null);

  // Year pagination
  const MAX_YEARS = 10;
  const [yearPage, setYearPage] = useState(0);
  const totalYearPages = Math.ceil(allYears.length / MAX_YEARS);
  const visibleYears = allYears.slice(
    yearPage * MAX_YEARS,
    yearPage * MAX_YEARS + MAX_YEARS
  );

  const hasSport = (t: SportType) => activities.some((a) => a.type === t);

  // Filtered base (year + type)
  const base = useMemo(
    () =>
      activities.filter((a) => {
        if (
          selectedYear !== null &&
          new Date(a.start_date_local).getFullYear() !== selectedYear
        )
          return false;
        if (sportFilter !== null && a.type !== sportFilter) return false;
        return true;
      }),
    [activities, selectedYear, sportFilter]
  );

  // Tags present in the current year/type selection, most used first.
  const allTags = useMemo(
    () =>
      collectTags(
        annotations,
        base.map((a) => a.start_date_local)
      ),
    [annotations, base]
  );

  const searchTerms = useMemo(() => parseQuery(query), [query]);

  const searched = useMemo(() => {
    if (searchTerms.length === 0 && activeTags.length === 0) return base;
    return base.filter((a) =>
      matchesAnnotation(
        annotations,
        a.start_date_local,
        searchTerms,
        activeTags
      )
    );
  }, [base, annotations, searchTerms, activeTags]);

  // Every place carries a (degenerate) polyline, so the wall shows them all.
  const withPolyline = useMemo(
    () => searched.filter((a) => a.summary_polyline),
    [searched]
  );

  // The card on the left describes one place: the one clicked, or the only one
  // left after filtering.
  const focusedActivity =
    selectedActivity ?? (withPolyline.length === 1 ? withPolyline[0] : null);
  const focusedDate = focusedActivity
    ? new Date(focusedActivity.start_date_local).toLocaleDateString(
        locale === 'zh' ? 'zh-CN' : 'en-US',
        { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }
      )
    : '';
  const focusedLink = focusedActivity
    ? (annotations[focusedActivity.start_date_local]?.link ?? '')
    : '';

  // Cluster places by proximity — defer heavy work to a worker.
  type Cluster = { representative: Activity; count: number };
  const [clusteredTracks, setClusteredTracks] = useState<Cluster[]>([]);
  const [clusteredInput, setClusteredInput] = useState<Activity[] | null>(null);
  const clustering = clusteredInput !== withPolyline;

  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/clusterTracks.worker.ts', import.meta.url),
      { type: 'module' }
    );
    worker.onmessage = ({
      data,
    }: MessageEvent<{ index: number; count: number }[]>) => {
      setClusteredTracks(
        data.map(({ index, count }) => ({
          representative: withPolyline[index],
          count,
        }))
      );
      setClusteredInput(withPolyline);
    };
    worker.onerror = () => {
      setClusteredTracks(
        withPolyline.map((representative) => ({ representative, count: 1 }))
      );
      setClusteredInput(withPolyline);
    };
    worker.postMessage(
      withPolyline.map(({ summary_polyline, start_date_local, distance }) => ({
        summary_polyline,
        start_date_local,
        distance,
      }))
    );
    return () => worker.terminate();
  }, [withPolyline]);

  const sortedTracks = useMemo(
    () =>
      [...clusteredTracks].sort((a, b) =>
        sortBy === 'name'
          ? a.representative.name.localeCompare(b.representative.name, 'zh')
          : new Date(b.representative.start_date_local).getTime() -
            new Date(a.representative.start_date_local).getTime()
      ),
    [clusteredTracks, sortBy]
  );

  const handleSelectTrack = useCallback(
    (a: Activity) => {
      const next = selectedActivity?.run_id === a.run_id ? null : a;
      setSelectedActivity(next);
      onSelectActivity?.(next);
      if (next && window.matchMedia('(max-width: 1023px)').matches) {
        requestAnimationFrame(() =>
          previewRef.current?.scrollIntoView({
            block: 'start',
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)')
              .matches
              ? 'instant'
              : 'smooth',
          })
        );
      }
    },
    [selectedActivity, onSelectActivity]
  );

  const selectedWhere = selectedActivity
    ? whereLabel(selectedActivity.location_country)
    : '';
  const selectedNote = selectedActivity
    ? (annotations[selectedActivity.start_date_local]?.note ?? '')
    : '';
  const selectedTags = selectedActivity
    ? (annotations[selectedActivity.start_date_local]?.tags ?? [])
    : [];

  const allSportTabs: { label: string; value: SportType; color: string }[] = [
    {
      label: locale === 'zh' ? '地点' : 'Place',
      value: 'Place',
      color: PLACE_COLOR,
    },
  ];

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6">
      {/* Top bar: back + title */}
      <div className="mb-5 flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex shrink-0 items-center gap-1.5 text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          {locale === 'zh' ? '返回' : 'Back'}
        </button>
        <h1 className="shrink-0 text-lg font-bold">
          {locale === 'zh' ? '地点墙' : 'Place Wall'}
        </h1>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[340px_1fr]">
        {/* Left: detail + map */}
        <div
          ref={previewRef}
          className="flex scroll-mt-28 flex-col gap-4 lg:sticky lg:top-24"
        >
          {/* Focus card: one line date, one line link (blank when absent) */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <p className="text-[10px] tracking-wider text-[var(--color-muted)] uppercase">
              {locale === 'zh' ? '日期' : 'Date'}
            </p>
            <p className="min-h-[1.75rem] font-mono text-lg font-bold">
              {focusedDate || '\u00a0'}
            </p>
            <p className="mt-3 text-[10px] tracking-wider text-[var(--color-muted)] uppercase">
              {locale === 'zh' ? '链接' : 'Link'}
            </p>
            {focusedLink ? (
              <a
                href={focusedLink}
                target="_blank"
                rel="noopener noreferrer"
                className="block min-h-[1.25rem] truncate text-sm text-[var(--color-accent)] underline underline-offset-2"
                title={focusedLink}
              >
                {focusedLink}
              </a>
            ) : (
              <p className="min-h-[1.25rem] text-sm">{'\u00a0'}</p>
            )}
          </div>

          {/* Place detail — only when a single place is selected */}
          {selectedActivity && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[10px] tracking-wider text-[var(--color-muted)] uppercase">
                  {locale === 'zh' ? '已选地点' : 'Selected'}
                </p>
                <button
                  aria-label={
                    locale === 'zh' ? '清除选中地点' : 'Clear selected place'
                  }
                  onClick={() => {
                    setSelectedActivity(null);
                    onSelectActivity?.(null);
                  }}
                  className="text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <dl className="space-y-2">
                <div>
                  <dt className="text-[9px] tracking-wider text-[var(--color-muted)] uppercase">
                    {locale === 'zh' ? '名称' : 'Name'}
                  </dt>
                  <dd className="text-sm font-semibold">
                    {selectedActivity.name}
                  </dd>
                </div>
                {selectedWhere && (
                  <div>
                    <dt className="text-[9px] tracking-wider text-[var(--color-muted)] uppercase">
                      {locale === 'zh' ? '位置' : 'Where'}
                    </dt>
                    <dd className="text-xs text-[var(--color-muted)]">
                      {selectedWhere}
                    </dd>
                  </div>
                )}
                {selectedNote && (
                  <div>
                    <dt className="text-[9px] tracking-wider text-[var(--color-muted)] uppercase">
                      {locale === 'zh' ? '备注' : 'Note'}
                    </dt>
                    <dd className="text-xs text-[var(--color-text)]">
                      {selectedNote}
                    </dd>
                  </div>
                )}
                {selectedTags.length > 0 && (
                  <div>
                    <dt className="text-[9px] tracking-wider text-[var(--color-muted)] uppercase">
                      {locale === 'zh' ? '标签' : 'Tags'}
                    </dt>
                    <dd className="mt-1 flex flex-wrap gap-1">
                      {selectedTags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-[var(--color-border)] px-2 py-0.5 text-xs text-[var(--color-muted)]"
                        >
                          {tag}
                        </span>
                      ))}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          <RouteMap
            activities={withPolyline}
            allActivities={activities}
            selectedActivity={selectedActivity}
            dark={dark}
            onClearSelection={() => {
              setSelectedActivity(null);
              onSelectActivity?.(null);
            }}
            onSelectActivity={(a) => {
              setSelectedActivity(a);
              onSelectActivity?.(a);
            }}
          />
        </div>

        {/* Right: place grid with year filter inside */}
        <div className="min-w-0">
          <div
            ref={captureRef}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4"
          >
            {/* Year pills + type filter */}
            <div className="mb-4 flex flex-wrap items-center gap-1.5 border-b border-[var(--color-border)] pb-3">
              {totalYearPages > 1 && (
                <button
                  aria-label={locale === 'zh' ? '较新的年份' : 'Newer years'}
                  onClick={() => setYearPage((p) => Math.max(0, p - 1))}
                  disabled={yearPage === 0}
                  className="px-1 text-base leading-none text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)] disabled:opacity-30"
                >
                  ‹
                </button>
              )}
              <button
                aria-pressed={selectedYear === null}
                onClick={() => {
                  setExportUrl('');
                  setExportMessage('');
                  setSelectedYear(null);
                  setSelectedActivity(null);
                  onSelectActivity?.(null);
                }}
                className={`rounded-full px-3 py-1 text-xs font-medium ${selectedYear === null ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]' : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'}`}
              >
                {locale === 'zh' ? '全部' : 'All'}
              </button>
              {visibleYears.map((yr) => (
                <button
                  key={yr}
                  aria-pressed={selectedYear === yr}
                  onClick={() => {
                    setExportUrl('');
                    setExportMessage('');
                    setSelectedYear(yr);
                    setSelectedActivity(null);
                    onSelectActivity?.(null);
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${selectedYear === yr ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]' : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'}`}
                >
                  {yr}
                </button>
              ))}
              {totalYearPages > 1 && (
                <button
                  onClick={() =>
                    setYearPage((p) => Math.min(totalYearPages - 1, p + 1))
                  }
                  aria-label={locale === 'zh' ? '较早的年份' : 'Older years'}
                  disabled={yearPage === totalYearPages - 1}
                  className="px-1 text-base leading-none text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)] disabled:opacity-30"
                >
                  ›
                </button>
              )}
              {/* Type filter — right side */}
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  aria-pressed={sportFilter === null}
                  onClick={() => {
                    setExportUrl('');
                    setExportMessage('');
                    setSportFilter(null);
                    setSelectedActivity(null);
                    onSelectActivity?.(null);
                  }}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${sportFilter === null ? 'border-transparent bg-[var(--color-accent)] text-[var(--color-on-accent)]' : 'border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]'}`}
                >
                  {locale === 'zh' ? '全部' : 'All'}
                </button>
                {allSportTabs
                  .filter((t) => hasSport(t.value))
                  .map(({ label, value, color }) => (
                    <button
                      key={value}
                      aria-pressed={sportFilter === value}
                      onClick={() => {
                        setExportUrl('');
                        setExportMessage('');
                        setSportFilter(value);
                        setSelectedActivity(null);
                        onSelectActivity?.(null);
                      }}
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${sportFilter === value ? 'border-transparent text-white' : 'border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]'}`}
                      style={
                        sportFilter === value ? { backgroundColor: color } : {}
                      }
                    >
                      {label}
                    </button>
                  ))}
                <span className="mx-1 h-3 w-px bg-[var(--color-border)]" />
                <button
                  onClick={async () => {
                    if (!captureRef.current || exporting) return;
                    setExporting(true);
                    setExportMessage('');
                    try {
                      setExportUrl(
                        await exportCard(
                          captureRef.current,
                          `places-${selectedYear ?? 'all'}.png`
                        )
                      );
                      setExportMessage(
                        locale === 'zh' ? '图片已生成' : 'Image ready'
                      );
                    } catch (err) {
                      console.error('Export failed:', err);
                      setExportMessage(
                        locale === 'zh'
                          ? '导出失败，请重试'
                          : 'Export failed. Please retry.'
                      );
                    } finally {
                      setExporting(false);
                    }
                  }}
                  data-export-hidden
                  disabled={exporting || clustering || !clusteredTracks.length}
                  className="flex h-6 w-6 items-center justify-center rounded text-[var(--color-muted)] transition-all hover:text-[var(--color-text)] disabled:opacity-50"
                  title={locale === 'zh' ? '导出图片' : 'Export as image'}
                >
                  {exporting ? (
                    <svg
                      className="h-3.5 w-3.5 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {exportMessage && (
              <p
                role="status"
                data-export-hidden
                className="mb-3 text-xs text-[var(--color-muted)]"
              >
                {exportMessage}
                {exportUrl && (
                  <a
                    href={exportUrl}
                    download={`places-${selectedYear ?? 'all'}.png`}
                    className="ml-3 underline"
                  >
                    {locale === 'zh' ? '下载图片' : 'Download image'}
                  </a>
                )}
              </p>
            )}
            {/* Tag search. */}
            <div data-export-hidden className="mb-3 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setExportUrl('');
                    setExportMessage('');
                    setSelectedActivity(null);
                    onSelectActivity?.(null);
                  }}
                  placeholder={
                    locale === 'zh'
                      ? '搜索标签或备注，空格分隔多个词'
                      : 'Search tags or notes, space separates terms'
                  }
                  aria-label={
                    locale === 'zh' ? '搜索标签或备注' : 'Search tags or notes'
                  }
                  className="min-w-0 flex-1 rounded-full border border-[var(--color-border)] bg-transparent px-3 py-1 text-xs text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent)] focus:outline-none"
                />
                {(query !== '' || activeTags.length > 0) && (
                  <button
                    onClick={() => {
                      setQuery('');
                      setActiveTags([]);
                      setExportUrl('');
                      setExportMessage('');
                      setSelectedActivity(null);
                      onSelectActivity?.(null);
                    }}
                    className="rounded-full px-2 py-1 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-text)]"
                  >
                    {locale === 'zh' ? '清除' : 'Clear'}
                  </button>
                )}
              </div>
              {allTags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {allTags.map((tag) => {
                    const on = activeTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        aria-pressed={on}
                        onClick={() => {
                          setActiveTags((prev) =>
                            prev.includes(tag)
                              ? prev.filter((t) => t !== tag)
                              : [...prev, tag]
                          );
                          setExportUrl('');
                          setExportMessage('');
                          setSelectedActivity(null);
                          onSelectActivity?.(null);
                        }}
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${on ? 'border-transparent bg-[var(--color-accent)] text-[var(--color-on-accent)]' : 'border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]'}`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {clustering ? (
              <div className="flex flex-wrap gap-1">
                {trackPlaceholders.map((placeholder) => (
                  <div
                    key={placeholder.id}
                    className="h-[120px] w-[120px] animate-pulse rounded-lg bg-[var(--color-border)]"
                    style={{ animationDelay: `${placeholder.delay}ms` }}
                  />
                ))}
              </div>
            ) : clusteredTracks.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--color-muted)]">
                {locale === 'zh' ? '暂无地点' : 'No places found'}
              </p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {sortedTracks.map(({ representative: a, count }) => (
                  <div key={a.run_id} className="track-cell relative">
                    <TrackThumb
                      activity={a}
                      note={annotations[a.start_date_local]?.note}
                      selected={selectedActivity?.run_id === a.run_id}
                      onClick={handleSelectTrack}
                    />
                    {(annotations[a.start_date_local]?.tags?.length ?? 0) >
                      0 && (
                      <span
                        className="absolute top-1 left-1 h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]"
                        title={[
                          annotations[a.start_date_local]?.tags?.join(' · '),
                          annotations[a.start_date_local]?.note,
                        ]
                          .filter(Boolean)
                          .join('\n')}
                      />
                    )}
                    {count > 1 && (
                      <span className="pointer-events-none absolute right-1 bottom-1 rounded bg-[var(--color-bg)]/80 px-1 py-0.5 text-[9px] leading-none font-bold text-[var(--color-muted)]">
                        ×{count}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Legend + sort */}
            {!clustering && clusteredTracks.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-[var(--color-border)] pt-3 text-xs text-[var(--color-muted)]">
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: PLACE_COLOR }}
                  />
                  {locale === 'zh' ? '地点' : 'Place'}
                </span>
                <div className="ml-auto flex items-center gap-1">
                  <span>
                    {clusteredTracks.length}{' '}
                    {locale === 'zh' ? '个地点' : 'places'}
                  </span>
                  <span className="mx-1.5 text-[var(--color-border)]">·</span>
                  <button
                    aria-pressed={sortBy === 'date'}
                    onClick={() => setSortBy('date')}
                    className={`transition-colors ${sortBy === 'date' ? 'font-medium text-[var(--color-text)]' : 'hover:text-[var(--color-text)]'}`}
                  >
                    {locale === 'zh' ? '时间' : 'Date'}
                  </button>
                  <span className="text-[var(--color-border)]">/</span>
                  <button
                    aria-pressed={sortBy === 'name'}
                    onClick={() => setSortBy('name')}
                    className={`transition-colors ${sortBy === 'name' ? 'font-medium text-[var(--color-text)]' : 'hover:text-[var(--color-text)]'}`}
                  >
                    {locale === 'zh' ? '名称' : 'Name'}
                  </button>
                </div>
              </div>
            )}
          </div>
          {/* end place grid card */}
        </div>
        {/* end right column */}
      </div>
    </div>
  );
}
