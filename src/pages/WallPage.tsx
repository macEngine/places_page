import { useCallback, useEffect, useMemo, useState } from 'react';
import { placeKey, sortByAddedDesc, type Place } from '@/core/places';
import { applyFilters, collectTags, matchesGeo, type GeoSelection } from '@/core/search';
import GeoTabs from '@/components/GeoTabs';
import PlaceMap from '@/components/PlaceMap';
import { geoPath } from '@/pages/HomePage';

interface Props {
  all: readonly Place[];
  /** placeKey() of a place to focus on arrival (from the Home log). */
  focusKey?: string;
}

export default function WallPage({ all, focusKey }: Props) {
  const [query, setQuery] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [geo, setGeo] = useState<GeoSelection>({});
  const [fitKey, setFitKey] = useState(0);

  // Default selection: the most recently added place, so the detail card is
  // never empty on arrival. A ?focus= from the Home log overrides it.
  const latest = useMemo(() => sortByAddedDesc(all)[0] ?? null, [all]);
  const [focused, setFocused] = useState<Place | null>(
    () => all.find((p) => placeKey(p) === focusKey) ?? latest
  );
  useEffect(() => {
    if (focusKey) {
      const hit = all.find((p) => placeKey(p) === focusKey);
      if (hit) setFocused(hit);
    }
  }, [focusKey, all]);

  // Tag pills are computed from the geographic scope, NOT from the search
  // result — otherwise picking one tag hides every other pill.
  const inScope = useMemo(() => all.filter((p) => matchesGeo(p, geo)), [all, geo]);
  const allTags = useMemo(() => collectTags(inScope), [inScope]);
  const visible = useMemo(
    () => applyFilters(all, query, tags, geo),
    [all, query, tags, geo]
  );

  // If a filter hides the focused place, fall back to the newest visible one.
  useEffect(() => {
    if (focused && !visible.includes(focused)) {
      setFocused(sortByAddedDesc(visible)[0] ?? null);
    }
  }, [visible, focused]);

  const toggleTag = (tag: string) =>
    setTags((cur) =>
      cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag]
    );
  const onFocus = useCallback((p: Place) => setFocused(p), []);
  const count = `${visible.length} ${visible.length === 1 ? 'place' : 'places'}`;

  return (
    <div className="page">
      <h1 className="page__title">Place Wall</h1>
      <div className="layout">
        <aside className="side">
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
            <div className="label">Added</div>
            <div className="info__value mono">{focused?.added ?? ''}</div>
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
                <div className="mapcard__sub">{count}</div>
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
              <PlaceMap places={visible} focused={focused} onFocus={onFocus} fitKey={fitKey} />
            </div>
            <div className="mapcard__foot">Basemap · CARTO / OpenStreetMap</div>
          </section>
        </aside>

        <main className="main">
          <section className="card card--pad">
            <GeoTabs all={all} geo={geo} onChange={setGeo} />

            <input
              className="search"
              type="search"
              placeholder="Search name, tags or notes, space separates terms"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
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
                    <div className="cell" key={placeKey(p)}>
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
              <span className="foot__right">{count}</span>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
