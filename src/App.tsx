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
import { useTheme } from '@/core/theme';
import rawPlaces from '@/data/places.json';
import Header from '@/components/Header';
import PlaceMap from '@/components/PlaceMap';

const ALL_PLACES: Place[] = sanitizePlaces(rawPlaces);

const LEVEL_LABEL: Record<GeoLevel, string> = {
  country: '国家',
  province: '省份',
  city: '城市',
};

function geoPath(p: Place): string {
  return GEO_LEVELS.map((l) => p[l])
    .filter((v): v is string => Boolean(v))
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(' · ');
}

export default function App() {
  const { theme, toggle } = useTheme();
  const [query, setQuery] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [geo, setGeo] = useState<GeoSelection>({});
  const [focused, setFocused] = useState<Place | null>(null);
  const [fitKey, setFitKey] = useState(0);

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
    <>
      <Header theme={theme} onToggleTheme={toggle} />
      <div className="page">
        <h1 className="page__title">Place Wall</h1>
        <div className="layout">
          <aside className="side">
            {/* Selected place details — mirrors running_page's DATE / LINK card */}
            <section className="card card--pad">
              <div className="label">Name</div>
              <div className="info__value info__value--big">{focused?.name ?? ''}</div>
              <div className="label">Where</div>
              <div className="info__value">{focused ? geoPath(focused) : ''}</div>
              <div className="label">Note</div>
              <div className="info__value">{focused?.desc ?? ''}</div>
              <div className="label">Tags</div>
              <div className="info__value info__tags">
                {focused?.tags.map((t) => (
                  <span key={t} className="chip">
                    {t}
                  </span>
                ))}
              </div>
              <div className="label">Link</div>
              <div className="info__value">
                {focused?.link && (
                  <a
                    className="info__link"
                    href={focused.link}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {focused.link}
                  </a>
                )}
              </div>
            </section>

            <section className="card">
              <div className="mapcard__head">
                <div>
                  <div className="mapcard__title">Place map</div>
                  <div className="mapcard__sub">
                    {visible.length} {visible.length === 1 ? 'place' : 'places'}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setFocused(null);
                    setFitKey((k) => k + 1);
                  }}
                >
                  Fit places
                </button>
              </div>
              <div className="mapcard__body">
                <PlaceMap
                  places={visible}
                  focused={focused}
                  onFocus={onFocus}
                  fitKey={fitKey}
                />
              </div>
              <div className="mapcard__foot">Basemap · CARTO / OpenStreetMap</div>
            </section>
          </aside>

          <main className="main">
            <section className="card card--pad">
              {levels.map((level) => {
                // Options for a level come from the scope narrowed by the
                // levels above it only, so siblings stay clickable.
                const idx = GEO_LEVELS.indexOf(level);
                const parentScope = ALL_PLACES.filter((p) =>
                  GEO_LEVELS.every(
                    (l, i) => i >= idx || !geo[l] || p[l] === geo[l]
                  )
                );
                const options = collectLevelValues(parentScope, level);
                return (
                  <div className="toolbar" key={level} role="tablist">
                    <span className="toolbar__label">{LEVEL_LABEL[level]}</span>
                    <button
                      type="button"
                      className={'tab' + (geo[level] ? '' : ' tab--active')}
                      onClick={() => selectLevel(level, undefined)}
                    >
                      All
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
                  </div>
                );
              })}

              <input
                className="search"
                type="search"
                placeholder="Search name, tags or notes, space separates terms"
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

              {visible.length === 0 ? (
                <div className="empty">No places match</div>
              ) : (
                <div className="wall">
                  {visible.map((p) => {
                    const active = p === focused;
                    return (
                      <div className="cell" key={p.name + p.wgs84.join(',')}>
                        <button
                          type="button"
                          className={'bubble' + (active ? ' bubble--active' : '')}
                          title={[p.name, p.desc].filter(Boolean).join(' — ')}
                          onClick={() => setFocused(active ? null : p)}
                        >
                          <span>{p.name}</span>
                        </button>
                        {p.tags.length > 0 && <i className="cell__dot" />}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="foot">
                <span className="foot__legend">
                  <i /> tagged
                </span>
                <span className="foot__right">
                  {visible.length} {visible.length === 1 ? 'place' : 'places'}
                </span>
              </div>
            </section>
          </main>
        </div>
      </div>
    </>
  );
}
