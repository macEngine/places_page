/**
 * Adapter: present hand-entered places as the running_page `Activity` shape so
 * the ported dashboard components run unchanged where possible. There is no
 * activities.json here — `src/data/places.json` is the only data source.
 */
import polyline from '@mapbox/polyline';
import rawPlaces from '@/data/places.json';
import { sanitizePlaces, sortByAddedDesc, type Place } from './places';
import type { Activity } from './types';

const FALLBACK_DATE = '2000-01-01';
const MUNICIPALITIES = new Set(['北京', '上海', '天津', '重庆']);
const SUFFIXED = /(省|市|自治区|特别行政区)$/;

/**
 * running_page keys per-activity data on `start_date_local`; a place carries
 * only a date, so noon local time gives it a stable timestamp key.
 */
export function placeStartDateLocal(place: Place): string {
  const date =
    place.added && /^\d{4}-\d{2}-\d{2}$/.test(place.added)
      ? place.added
      : FALLBACK_DATE;
  return `${date} 12:00:00`;
}

/**
 * Suffix a Chinese province the way running_page's source data does, so
 * `extractProvince()` resolves it and the footprint map lights it up: the four
 * municipalities take 市, every other province takes 省, names that already
 * carry a suffix are left alone, and non-China provinces are untouched.
 */
export function normalizeProvince(
  province: string | undefined,
  country: string | undefined
): string | undefined {
  if (!province) return province;
  if (country && country !== '中国') return province;
  if (SUFFIXED.test(province)) return province;
  return province + (MUNICIPALITIES.has(province) ? '市' : '省');
}

/** Python-dict-style location string, matching running_page's activities.json. */
export function placeLocationCountry(place: Place): string {
  const [lon, lat] = place.wgs84;
  const parts = [`'latitude': ${lat}`, `'longitude': ${lon}`];
  if (place.country) parts.push(`'country': '${place.country}'`);
  const province = normalizeProvince(place.province, place.country);
  if (province) parts.push(`'province': '${province}'`);
  if (place.city) parts.push(`'city': '${place.city}'`);
  return `{${parts.join(', ')}}`;
}

/** Inverse of {@link placeLocationCountry}, for the columns that show WHERE. */
export function parseLocation(loc: string | null): {
  country?: string;
  province?: string;
  city?: string;
} {
  if (!loc || !loc.startsWith('{')) return {};
  try {
    const d = JSON.parse(
      loc.replace(/'/g, '"').replace(/None/g, 'null')
    ) as Record<string, unknown>;
    const out: { country?: string; province?: string; city?: string } = {};
    if (typeof d.country === 'string') out.country = d.country;
    if (typeof d.province === 'string') out.province = d.province;
    if (typeof d.city === 'string') out.city = d.city;
    return out;
  } catch {
    return {};
  }
}

/** A degenerate two-point polyline at the place, so route code paths decode it. */
export function placeSummaryPolyline(place: Place): string {
  const [lon, lat] = place.wgs84;
  return polyline.encode([
    [lat, lon],
    [lat, lon],
  ]);
}

export function placeToActivity(place: Place, index: number): Activity {
  const local = placeStartDateLocal(place);
  return {
    run_id: index + 1,
    name: place.name,
    distance: 0,
    moving_time: '0:00:00',
    type: 'Place',
    subtype: place.tags[0] ?? 'Place',
    start_date: local,
    start_date_local: local,
    location_country: placeLocationCountry(place),
    summary_polyline: placeSummaryPolyline(place),
    average_heartrate: null,
    average_speed: 0,
    elevation_gain: null,
    source: 'places',
    streak: 0,
  };
}

/** Sanitized places, newest first — the canonical order the UI reads. */
export function getPlaces(): Place[] {
  return sortByAddedDesc(sanitizePlaces(rawPlaces));
}

let cache: Activity[] | null = null;

export function getActivityData(): Activity[] {
  cache ??= getPlaces().map(placeToActivity);
  return cache;
}
