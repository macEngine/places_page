import { useEffect, useMemo, useState } from 'react';
import { GEO_LEVELS, placeKey, sortByAddedDesc, type Place } from '@/core/places';
import { applyFilters, collectTags, type GeoSelection } from '@/core/search';
import { navigate } from '@/core/router';
import GeoTabs from '@/components/GeoTabs';

const PAGE_SIZE = 16;

export function geoPath(p: Place): string {
  return GEO_LEVELS.map((l) => p[l])
    .filter((v): v is string => Boolean(v))
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(' · ');
}

interface Props {
  all: readonly Place[];
}

export default function HomePage({ all }: Props) {
  const [geo, setGeo] = useState<GeoSelection>({});
  const [page, setPage] = useState(0);

  const rows = useMemo(
    () => sortByAddedDesc(applyFilters(all, '', [], geo)),
    [all, geo]
  );
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  useEffect(() => {
    setPage((p) => Math.min(p, totalPages - 1));
  }, [totalPages]);
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const stats = useMemo(() => {
    const uniq = (xs: (string | undefined)[]) =>
      new Set(xs.filter((x): x is string => Boolean(x))).size;
    return {
      places: all.length,
      countries: uniq(all.map((p) => p.country)),
      cities: uniq(all.map((p) => p.city ?? p.province)),
      tags: collectTags(all).length,
    };
  }, [all]);

  const open = (p: Place) => navigate({ page: 'wall', focus: placeKey(p) });

  return (
    <div className="page">
      <div className="stats">
        <Stat label="Places" value={stats.places} />
        <Stat label="Countries" value={stats.countries} />
        <Stat label="Cities" value={stats.cities} />
        <Stat label="Tags" value={stats.tags} />
      </div>

      <section className="card card--pad">
        <div className="log__head">
          <h2 className="log__title">Place Log</h2>
          <span className="log__showing">
            Showing {rows.length ? page * PAGE_SIZE + 1 : 0}-
            {Math.min((page + 1) * PAGE_SIZE, rows.length)} of {rows.length}
          </span>
        </div>

        <GeoTabs
          all={all}
          geo={geo}
          variant="solid"
          onChange={(g) => {
            setGeo(g);
            setPage(0);
          }}
        />

        <div className="log__scroll">
          <table className="log">
            <thead>
              <tr>
                <th>Date</th>
                <th>Name</th>
                <th>Where</th>
                <th>Tags</th>
                <th>Note</th>
                <th>Link</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="log__empty">
                    No places yet
                  </td>
                </tr>
              )}
              {pageRows.map((p) => (
                <tr key={placeKey(p)} onClick={() => open(p)}>
                  <td className="muted mono">{p.added ?? '—'}</td>
                  <td className="log__name">{p.name}</td>
                  <td className="muted">{geoPath(p)}</td>
                  <td>
                    <span className="log__tags">
                      {p.tags.map((t) => (
                        <span key={t} className="chip">
                          {t}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="muted log__note">{p.desc ?? ''}</td>
                  <td>
                    {p.link && (
                      <a
                        className="log__link"
                        href={p.link}
                        target="_blank"
                        rel="noreferrer noopener"
                        onClick={(e) => e.stopPropagation()}
                      >
                        ↗
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="pager">
            <button
              type="button"
              className="pager__btn"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              ‹
            </button>
            <span className="muted">
              {page + 1} / {totalPages}
            </span>
            <button
              type="button"
              className="pager__btn"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              ›
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="stat__value">{value}</div>
    </div>
  );
}
