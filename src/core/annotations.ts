/**
 * Per-place tags, notes and links, keyed the way running_page keyed its
 * annotations: on `start_date_local`. running_page loaded these from a
 * side-car JSON file over fetch; here they come straight from the place
 * records (`tags` -> tags, `desc` -> note, `link` -> link), built once and
 * synchronously, so the tracks page tag search and pills work without a fetch.
 */
import { getPlaces, placeStartDateLocal, sameDaySeq } from './placesAsActivities';

export interface Annotation {
  /** Free-form labels, e.g. ["美食", "港式"]. Searchable. */
  tags?: string[];
  /** Free-form note for this place. Searchable. */
  note?: string;
  /** External link for this place. Shown, not searchable. http(s) only. */
  link?: string;
}

/** key: Activity.start_date_local, e.g. "2026-11-11 12:00:00" */
export type AnnotationMap = Record<string, Annotation>;

export const EMPTY_ANNOTATIONS: AnnotationMap = Object.freeze(
  {}
) as AnnotationMap;

/** Accept only absolute http(s) URLs; anything else becomes "no link". */
export function sanitizeLink(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (trimmed === '') return '';
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:' ? trimmed : '';
  } catch {
    return '';
  }
}

function build(): AnnotationMap {
  const out: AnnotationMap = {};
  const places = getPlaces();
  const seq = sameDaySeq(places);
  for (const place of places) {
    const key = placeStartDateLocal(place, seq.get(place) ?? 0);
    const tags = place.tags ?? [];
    const note = place.desc ?? '';
    const link = sanitizeLink(place.link);
    if (tags.length === 0 && note.trim() === '' && link === '') continue;
    out[key] = link === '' ? { tags, note } : { tags, note, link };
  }
  return out;
}

let cache: AnnotationMap | null = null;

export function loadAnnotations(): Promise<AnnotationMap> {
  cache ??= build();
  return Promise.resolve(cache);
}

export function getCachedAnnotations(): AnnotationMap | null {
  cache ??= build();
  return cache;
}

/** Collect the distinct tags used by the given keys, most used first. */
export function collectTags(
  annotations: AnnotationMap,
  keys: readonly string[]
): string[] {
  const counts = new Map<string, number>();
  for (const key of keys) {
    for (const tag of annotations[key]?.tags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag);
}

/**
 * True when the annotation for `key` satisfies every search term and carries
 * every required tag. Terms are matched as case-insensitive substrings against
 * the tags and the note, so "三里" finds "三里屯".
 */
export function matchesAnnotation(
  annotations: AnnotationMap,
  key: string,
  terms: readonly string[],
  requiredTags: readonly string[]
): boolean {
  const entry = annotations[key];
  if (requiredTags.length > 0) {
    const tags = entry?.tags ?? [];
    if (!requiredTags.every((tag) => tags.includes(tag))) return false;
  }
  if (terms.length === 0) return true;
  const haystack = [...(entry?.tags ?? []), entry?.note ?? '']
    .join('\n')
    .toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

/** Split a raw query into lowercase terms; whitespace separated, AND-combined. */
export function parseQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term !== '');
}
