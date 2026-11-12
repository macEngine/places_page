import type { Activity } from '../types';

export type SummaryPeriod = 'year' | 'month' | 'week' | 'day' | 'life';

// Use the recorded local calendar date, independent of the viewer's timezone.
export function summaryKey(date: string, period: SummaryPeriod): string {
  if (period === 'life') return 'Life';
  if (period === 'year') return date.slice(0, 4);
  if (period === 'month') return date.slice(0, 7);
  if (period === 'day') return date.slice(0, 10);
  const day = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7));
  const year = day.getUTCFullYear();
  const week = Math.ceil(
    ((day.getTime() - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7
  );
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function summarize(activities: Activity[]) {
  return { count: activities.length };
}

export function groupSummary(activities: Activity[], period: SummaryPeriod) {
  const groups = new Map<string, Activity[]>();
  for (const activity of activities) {
    const key = summaryKey(activity.start_date_local, period);
    const group = groups.get(key) ?? [];
    group.push(activity);
    groups.set(key, group);
  }
  return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a));
}

/** Count of places per bucket within the period. */
export function summaryChart(
  activities: Activity[],
  period: SummaryPeriod,
  key: string
) {
  const buckets = new Map<string, number>();
  const bucketFor = (a: Activity) => {
    const date = a.start_date_local.slice(0, 10);
    if (period === 'life') return date.slice(0, 4);
    if (period === 'year') return date.slice(5, 7);
    if (period === 'month') return date.slice(8, 10);
    if (period === 'week')
      return String(((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1);
    return a.start_date_local.slice(11, 16);
  };
  let length = 0;
  if (period === 'year') length = 12;
  if (period === 'month')
    length = new Date(
      Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0)
    ).getUTCDate();
  if (period === 'week') length = 7;
  for (let i = 1; i <= length; i++)
    buckets.set(period === 'week' ? String(i) : String(i).padStart(2, '0'), 0);
  for (const activity of activities) {
    const bucket = bucketFor(activity);
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, count]) => ({ label, count }));
}
