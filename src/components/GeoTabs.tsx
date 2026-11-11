import { GEO_LEVELS, type GeoLevel, type Place } from '@/core/places';
import { collectLevelValues, type GeoSelection, visibleLevels } from '@/core/search';

const LEVEL_LABEL: Record<GeoLevel, string> = {
  country: '国家',
  province: '省份',
  city: '城市',
};

interface Props {
  all: readonly Place[];
  geo: GeoSelection;
  onChange: (next: GeoSelection) => void;
  /** 'line' = pills on a divider row (Wall page); 'solid' = grey pills (Home log). */
  variant?: 'line' | 'solid';
}

/**
 * One row of pills per visible geographic level. Options for a level come
 * from the scope narrowed by the levels above it only, so sibling values stay
 * clickable after one is chosen. Selecting a level clears deeper levels.
 */
export default function GeoTabs({ all, geo, onChange, variant = 'line' }: Props) {
  const inScope = all.filter((p) =>
    GEO_LEVELS.every((l) => !geo[l] || p[l] === geo[l])
  );
  const levels = visibleLevels(inScope);

  const select = (level: GeoLevel, value: string | undefined) => {
    const next: GeoSelection = {};
    for (const l of GEO_LEVELS) {
      if (l === level) break;
      if (geo[l]) next[l] = geo[l];
    }
    if (value) next[level] = value;
    onChange(next);
  };

  const cls = variant === 'solid' ? 'tab tab--solid' : 'tab';

  return (
    <>
      {levels.map((level) => {
        const idx = GEO_LEVELS.indexOf(level);
        const parentScope = all.filter((p) =>
          GEO_LEVELS.every((l, i) => i >= idx || !geo[l] || p[l] === geo[l])
        );
        const options = collectLevelValues(parentScope, level);
        return (
          <div
            className={'toolbar' + (variant === 'solid' ? ' toolbar--plain' : '')}
            key={level}
            role="tablist"
            aria-label={LEVEL_LABEL[level]}
          >
            {variant === 'line' && (
              <span className="toolbar__label">{LEVEL_LABEL[level]}</span>
            )}
            <button
              type="button"
              className={cls + (geo[level] ? '' : ' tab--active')}
              onClick={() => select(level, undefined)}
            >
              All
            </button>
            {options.map((v) => (
              <button
                type="button"
                key={v}
                className={cls + (geo[level] === v ? ' tab--active' : '')}
                onClick={() => select(level, v)}
              >
                {v}
              </button>
            ))}
          </div>
        );
      })}
    </>
  );
}
