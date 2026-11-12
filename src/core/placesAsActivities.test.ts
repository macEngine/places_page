import { describe, expect, it } from 'vitest';
import polyline from '@mapbox/polyline';
import { type Place } from './places';
import {
  getActivityData,
  normalizeProvince,
  placeStartDateLocal,
  placeSummaryPolyline,
  placeToActivity,
} from './placesAsActivities';
import { getCachedAnnotations } from './annotations';

const P = (over: Partial<Place> & { name: string }): Place => ({
  wgs84: [116.4, 39.9],
  tags: [],
  ...over,
});

describe('normalizeProvince', () => {
  it('suffixes the four municipalities with 市', () => {
    expect(normalizeProvince('北京', '中国')).toBe('北京市');
    expect(normalizeProvince('上海', '中国')).toBe('上海市');
    expect(normalizeProvince('天津', '中国')).toBe('天津市');
    expect(normalizeProvince('重庆', '中国')).toBe('重庆市');
  });
  it('suffixes other Chinese provinces with 省', () => {
    expect(normalizeProvince('浙江', '中国')).toBe('浙江省');
    expect(normalizeProvince('广东', '中国')).toBe('广东省');
  });
  it('leaves already-suffixed names alone', () => {
    expect(normalizeProvince('北京市', '中国')).toBe('北京市');
    expect(normalizeProvince('内蒙古自治区', '中国')).toBe('内蒙古自治区');
  });
  it('leaves non-China provinces untouched', () => {
    expect(normalizeProvince('東京都', '日本')).toBe('東京都');
    expect(normalizeProvince('California', 'USA')).toBe('California');
  });
});

describe('placeStartDateLocal', () => {
  it('builds noon-local from `added`', () => {
    expect(placeStartDateLocal(P({ name: 'a', added: '2026-11-11' }))).toBe(
      '2026-11-11 12:00:00'
    );
  });
  it('falls back when `added` is missing', () => {
    expect(placeStartDateLocal(P({ name: 'a' }))).toBe('2000-01-01 12:00:00');
  });
});

describe('placeSummaryPolyline', () => {
  it('decodes back to the place point', () => {
    const place = P({ name: 'a', wgs84: [116.462094, 39.948515] });
    const coords = polyline.decode(placeSummaryPolyline(place));
    expect(coords.length).toBeGreaterThanOrEqual(2);
    const [lat, lng] = coords[0];
    // polyline precision 5 rounds to ~1e-5 degrees
    expect(lat).toBeCloseTo(39.948515, 4);
    expect(lng).toBeCloseTo(116.462094, 4);
  });
});

describe('placeToActivity', () => {
  it('maps a place into the Activity shape', () => {
    const a = placeToActivity(
      P({
        name: '西湖',
        wgs84: [120.15, 30.25],
        country: '中国',
        province: '浙江',
        city: '杭州',
        tags: ['风景'],
        added: '2026-01-02',
      }),
      0
    );
    expect(a.run_id).toBe(1);
    expect(a.type).toBe('Place');
    expect(a.subtype).toBe('风景');
    expect(a.distance).toBe(0);
    expect(a.source).toBe('places');
    expect(a.start_date_local).toBe('2026-01-02 12:00:00');
    expect(a.location_country).toContain("'province': '浙江省'");
    expect(a.location_country).toContain("'city': '杭州'");
  });

  it('getActivityData maps every place to a unique run_id', () => {
    const data = getActivityData();
    const ids = new Set(data.map((a) => a.run_id));
    expect(ids.size).toBe(data.length);
  });
});

describe('annotations from places', () => {
  it('keys tags / note / link by start_date_local', () => {
    const map = getCachedAnnotations() ?? {};
    const entry = map['2026-11-11 12:00:00'];
    expect(entry).toBeDefined();
    expect(entry.tags).toEqual(['美食', '港式']);
    expect(entry.note).toBe('港式茶餐厅，北京首店');
    // places.json link is null → dropped
    expect(entry.link).toBeUndefined();
  });
});
