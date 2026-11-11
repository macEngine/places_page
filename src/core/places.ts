/**
 * The place record. `src/data/places.json` is the single source of truth:
 * places are entered by hand (via tools/parse-place.py), nothing regenerates
 * the file, so tags/notes live inline — no side-car annotations file needed.
 *
 * Coordinates: three datums are stored per place because Chinese map vendors
 * each use their own offset datum (BD-09 for Baidu, GCJ-02 for Amap/Tencent)
 * and the same spot differs by ~0.5-1.3 km between them. The page renders on
 * a WGS-84 basemap, so `wgs84` is what the UI reads; the others are kept so
 * the basemap can be swapped later without re-entering data.
 */
export interface Place {
  name: string;
  /** [lon, lat] */
  wgs84: [number, number];
  gcj02?: [number, number];
  bd09?: [number, number];
  zoom?: number;
  /** Geographic hierarchy for the tab navigation; empty levels are skipped. */
  country?: string;
  province?: string;
  city?: string;
  /** Flat, free-form labels; a place can carry many. Searchable. */
  tags: string[];
  /** http(s) only; shown, not searchable. */
  link?: string;
  /** Short description. Searchable. */
  desc?: string;
  /** Where the record came from; kept for provenance, ignored by the UI. */
  _source?: unknown;
}

/** Levels of the geographic hierarchy, in drill-down order. */
export const GEO_LEVELS = ['country', 'province', 'city'] as const;
export type GeoLevel = (typeof GEO_LEVELS)[number];

function isLonLat(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((n) => typeof n === 'number' && Number.isFinite(n)) &&
    Math.abs(value[0]) <= 180 &&
    Math.abs(value[1]) <= 90
  );
}

/** Accept only absolute http(s) URLs; anything else becomes "no link". */
export function sanitizeLink(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? trimmed
      : undefined;
  } catch {
    return undefined;
  }
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== ''
    ? value.trim()
    : undefined;
}

/**
 * Keep only well-formed records so one bad row cannot take out the rest.
 * A place needs at least a name and a valid WGS-84 position.
 */
export function sanitizePlaces(raw: unknown): Place[] {
  if (!Array.isArray(raw)) return [];
  const out: Place[] = [];
  for (const value of raw) {
    if (!value || typeof value !== 'object') continue;
    const entry = value as Record<string, unknown>;
    const name = optionalString(entry.name);
    if (!name || !isLonLat(entry.wgs84)) continue;
    const tags = Array.isArray(entry.tags)
      ? entry.tags
          .filter((t): t is string => typeof t === 'string' && t.trim() !== '')
          .map((t) => t.trim())
      : [];
    const place: Place = {
      name,
      wgs84: entry.wgs84,
      tags: Array.from(new Set(tags)),
    };
    if (isLonLat(entry.gcj02)) place.gcj02 = entry.gcj02;
    if (isLonLat(entry.bd09)) place.bd09 = entry.bd09;
    if (typeof entry.zoom === 'number' && Number.isFinite(entry.zoom)) {
      place.zoom = entry.zoom;
    }
    for (const level of GEO_LEVELS) {
      const v = optionalString(entry[level]);
      if (v) place[level] = v;
    }
    const link = sanitizeLink(entry.link);
    if (link) place.link = link;
    const desc = optionalString(entry.desc);
    if (desc) place.desc = desc;
    if (entry._source !== undefined) place._source = entry._source;
    out.push(place);
  }
  return out;
}
