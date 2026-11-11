import { describe, expect, it } from 'vitest';
import { sanitizePlaces, type Place } from './places';
import {
  applyFilters,
  collectLevelValues,
  collectTags,
  matchesPlace,
  parseQuery,
  visibleLevels,
} from './search';
import rawPlaces from '@/data/places.json';

const P = (over: Partial<Place> & { name: string }): Place => ({
  wgs84: [116.4, 39.9],
  tags: [],
  ...over,
});

const beijing = P({
  name: '尖沙咀食饭公司',
  country: '中国',
  province: '北京',
  city: '北京',
  tags: ['美食', '港式'],
  desc: '港式茶餐厅',
});
const hangzhou = P({
  name: '西湖',
  country: '中国',
  province: '浙江',
  city: '杭州',
  tags: ['风景'],
});
const tokyo = P({
  name: '築地',
  country: '日本',
  city: '东京',
  tags: ['美食', '海鲜'],
});
const all = [beijing, hangzhou, tokyo];

describe('places.json', () => {
  it('is well-formed: every row survives sanitize', () => {
    expect(Array.isArray(rawPlaces)).toBe(true);
    expect(sanitizePlaces(rawPlaces)).toHaveLength(rawPlaces.length);
  });
});

describe('sanitizePlaces', () => {
  it('drops rows without a name or a valid position, keeps the rest', () => {
    const out = sanitizePlaces([
      { name: 'ok', wgs84: [1, 2], tags: ['a', 'a', ' '] },
      { name: '', wgs84: [1, 2] },
      { name: 'bad lon', wgs84: [200, 2] },
      { name: 'meters not degrees', wgs84: [12966061, 4831783] },
      null,
      'junk',
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].tags).toEqual(['a']);
  });
  it('keeps only http(s) links', () => {
    const out = sanitizePlaces([
      { name: 'a', wgs84: [1, 2], link: 'https://x.y' },
      { name: 'b', wgs84: [1, 2], link: 'javascript:alert(1)' },
      { name: 'c', wgs84: [1, 2], link: null },
    ]);
    expect(out.map((p) => p.link)).toEqual(['https://x.y', undefined, undefined]);
  });
});

describe('search', () => {
  it('parseQuery: whitespace split, lowercase, empties dropped', () => {
    expect(parseQuery('  美食  Hong\tKong ')).toEqual(['美食', 'hong', 'kong']);
  });
  it('terms are AND-combined substrings over name/tags/desc', () => {
    expect(matchesPlace(beijing, ['港式', '茶餐'], [])).toBe(true);
    expect(matchesPlace(beijing, ['港式', '西湖'], [])).toBe(false);
    expect(matchesPlace(beijing, ['尖沙'], [])).toBe(true);
  });
  it('link is not searchable', () => {
    const p = P({ name: 'x', link: 'https://secret-host.example' });
    expect(matchesPlace(p, ['secret'], [])).toBe(false);
  });
  it('required tags are hard filters', () => {
    expect(matchesPlace(tokyo, [], ['美食'])).toBe(true);
    expect(matchesPlace(tokyo, [], ['美食', '港式'])).toBe(false);
  });
  it('collectTags ranks by frequency then pinyin', () => {
    expect(collectTags(all)).toEqual(['美食', '风景', '港式', '海鲜']);
  });
  it('geo selection narrows; unset levels mean all', () => {
    expect(applyFilters(all, '', [], { country: '中国' })).toHaveLength(2);
    expect(applyFilters(all, '', [], { country: '中国', city: '杭州' })).toEqual([
      hangzhou,
    ]);
    expect(applyFilters(all, '美食', [], { country: '中国' })).toEqual([beijing]);
  });
  it('collectLevelValues skips places lacking the level', () => {
    expect(collectLevelValues(all, 'province')).toEqual(['北京', '浙江']);
  });
  it('visibleLevels collapses municipality city==province, keeps mixed', () => {
    expect(visibleLevels([beijing])).toEqual(['country', 'province']);
    expect(visibleLevels([beijing, hangzhou])).toEqual([
      'country',
      'province',
      'city',
    ]);
    // Foreign place without a province: province row hidden, city shown.
    expect(visibleLevels([tokyo])).toEqual(['country', 'city']);
  });
});
