import { useCallback, useMemo, useState } from 'react';
import { GEO_LEVELS, sanitizePlaces, type GeoLevel, type Place } from '@/core/places';
import {
  applyFilters,
  collectLevelValues,
  collectTags,
  matchesGeo,
  type GeoSelection,
  visibleLevels,
} from '@/core/search';
import rawPlaces from '@/data/places.json';
import PlaceMap from '@/components/PlaceMap';

const ALL_PLACES: Place[] = sanitizePlaces(rawPlaces);

const LEVEL_LABEL: Record<GeoLevel, string> = {
  country: '国家',
  province: '省份',
  city: '城市',
};

export default function App() {
  const [query, setQuery] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [geo, setGeo] = useState<GeoSelection>({});
  const [focused, setFocused] = useState<Place | null>(null);

  // Geographic scope first: tab rows and tag pills are computed from the
  // scope, NOT from the search result — otherwise picking one tag hides
  // every other pill (a real interaction bug from running_page).
  const inScope = useMemo(
    () => ALL_PLACES.filter((p) => matchesGeo(p, geo)),
    [geo]
  );
  const levels = useMemo(() => visibleLevels(inScope), [inScope]);
  const allTags = useMemo(() => collectTags(inScope), [inScope]);
  const visible = useMemo(
    () => applyFilters(ALL_PLACES, query, tags, geo),
    [query, tags, geo]
  );

  const selectLevel = (level: GeoLevel, value: string | undefined) => {
    // Setting a level clears every deeper level.
    const next: GeoSelection = {};
    for (const l of GEO_LEVELS) {
      if (l === level) break;
      if (geo[l]) next[l] = geo[l];
    }
    if (value) next[level] = value;
    setGeo(next);
    setFocused(null);
  };

  const toggleTag = (tag: string) => {
    setTags((cur) =>
      cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag]
    );
    setFocused(null);
  };

  const onFocus = useCallback((p: Place) => setFocused(p), []);

  return (
    <div className="app">
      <aside className="side">
        <header className="side__header">
          <h1>Places</h1>
          <p className="muted">{ALL_PLACES.length} 个地点</p>
        </header>

        {levels.map((level) => {
          // Options for a level come from the scope narrowed by the levels
          // above it only, so siblings stay clickable after one is chosen.
          const parentScope = ALL_PLACES.filter((p) =>
            GEO_LEVELS.every(
              (l) =>
                GEO_LEVELS.indexOf(l) >= GEO_LEVELS.indexOf(level) ||
                !geo[l] ||
                p[l] === geo[l]
            )
          );
          const options = collectLevelValues(parentScope, level);
          return (
            <nav className="tabs" key={level} aria-label={LEVEL_LABEL[level]}>
              <span className="tabs__label">{LEVEL_LABEL[level]}</span>
              <button
                type="button"
                className={'tab' + (geo[level] ? '' : ' tab--active')}
                onClick={() => selectLevel(level, undefined)}
              >
                全部
              </button>
              {options.map((v) => (
                <button
                  type="button"
                  key={v}
                  className={'tab' + (geo[level] === v ? ' tab--active' : '')}
                  onClick={() => selectLevel(level, v)}
                >
                  {v}
                </button>
              ))}
            </nav>
          );
        })}

        <input
          className="search"
          type="search"
          placeholder="搜索 名称 / 标签 / 描述，空格分隔多个词"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setFocused(null);
          }}
        />

        <div className="pills">
          {allTags.map((tag) => (
            <button
              type="button"
              key={tag}
              className={'pill' + (tags.includes(tag) ? ' pill--active' : '')}
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>

        <ol className="list">
          {visible.map((p) => (
            <li
              key={p.name + p.wgs84.join(',')}
              className={'card' + (p === focused ? ' card--focused' : '')}
              onClick={() => setFocused(p === focused ? null : p)}
            >
              <div className="card__title">{p.name}</div>
              <div className="muted card__geo">
                {GEO_LEVELS.map((l) => p[l])
                  .filter(Boolean)
                  .filter((v, i, a) => a.indexOf(v) === i)
                  .join(' · ')}
              </div>
              {p.desc && <div className="card__desc">{p.desc}</div>}
              <div className="card__tags">
                {p.tags.map((t) => (
                  <span key={t} className="chip">
                    {t}
                  </span>
                ))}
                {p.link && (
                  <a
                    href={p.link}
                    target="_blank"
                    rel="noreferrer noopener"
                    onClick={(e) => e.stopPropagation()}
                  >
                    链接 ↗
                  </a>
                )}
              </div>
            </li>
          ))}
          {visible.length === 0 && <li className="muted">没有匹配的地点</li>}
        </ol>
      </aside>
      <main className="main">
        <PlaceMap places={visible} focused={focused} onFocus={onFocus} />
      </main>
    </div>
  );
}
