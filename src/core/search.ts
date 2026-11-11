/**
 * Search and filtering, ported from running_page's annotation search:
 *  - whitespace-separated terms are AND-combined;
 *  - each term is a case-insensitive substring match against name, tags and
 *    desc ("三里" finds "三里屯"); `link` is not searched;
 *  - clicked tag pills are hard filters (the place must carry every one).
 */
import { GEO_LEVELS, type GeoLevel, type Place } from './places';

/** Split a raw query into lowercase terms; whitespace separated, AND-combined. */
export function parseQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term !== '');
}

export function matchesPlace(
  place: Place,
  terms: readonly string[],
  requiredTags: readonly string[]
): boolean {
  if (!requiredTags.every((tag) => place.tags.includes(tag))) return false;
  if (terms.length === 0) return true;
  const haystack = [place.name, ...place.tags, place.desc ?? '']
    .join('\n')
    .toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

/**
 * Geographic selection, one value per level. A level that is unset means
 * "all". Setting a level clears the deeper ones (handled by the caller).
 */
export type GeoSelection = Partial<Record<GeoLevel, string>>;

export function matchesGeo(place: Place, selection: GeoSelection): boolean {
  return GEO_LEVELS.every(
    (level) => !selection[level] || place[level] === selection[level]
  );
}

/**
 * Distinct values present at `level` among `places`, most frequent first.
 * `undefined` entries (places without that level) are dropped: the UI
 * skips a level that has no values rather than showing an empty tab.
 */
export function collectLevelValues(
  places: readonly Place[],
  level: GeoLevel
): string[] {
  return rankByCount(places.map((p) => p[level]).filter(isString));
}

/** Distinct tags among `places`, most used first. */
export function collectTags(places: readonly Place[]): string[] {
  return rankByCount(places.flatMap((p) => p.tags));
}

/**
 * Levels worth showing as a tab row for the current geographic scope.
 * A level is hidden when it has no values, or when every place in scope
 * repeats its parent level's value at this level — the municipality case
 * (北京 > 北京) collapses to one row.
 */
export function visibleLevels(placesInScope: readonly Place[]): GeoLevel[] {
  const out: GeoLevel[] = [];
  for (let i = 0; i < GEO_LEVELS.length; i++) {
    const level = GEO_LEVELS[i];
    const parent = i > 0 ? GEO_LEVELS[i - 1] : undefined;
    const withValue = placesInScope.filter((p) => isString(p[level]));
    if (withValue.length === 0) continue;
    const collapsed =
      parent !== undefined && withValue.every((p) => p[level] === p[parent]);
    if (!collapsed) out.push(level);
  }
  return out;
}

export function applyFilters(
  places: readonly Place[],
  query: string,
  requiredTags: readonly string[],
  selection: GeoSelection
): Place[] {
  const terms = parseQuery(query);
  return places.filter(
    (p) => matchesGeo(p, selection) && matchesPlace(p, terms, requiredTags)
  );
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function rankByCount(values: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh'))
    .map(([v]) => v);
}
