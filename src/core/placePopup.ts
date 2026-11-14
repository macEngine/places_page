/**
 * Shared popup body for a place: used by the map (MapLibre Popup, HTML string)
 * and by the wall tiles (hover popover). Same fields as the Wall detail cards:
 * name / where / note / tags / date / link. All values are escaped.
 */
import type { Activity } from './types';
import { getCachedAnnotations } from './annotations';
import { parseLocation } from './placesAsActivities';

function esc(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Popup body: the same fields as the detail cards on the Place Wall (date,
 * link, name, where, note, tags), so hovering a dot answers "what is this?"
 * without leaving the map.
 */
export function popupHtml(a: Activity, zh: boolean): string {
  const ann = getCachedAnnotations()?.[a.start_date_local];
  const loc = parseLocation(a.location_country);
  const where = [loc.country, loc.province, loc.city]
    .filter((v): v is string => Boolean(v))
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join(' · ');
  const date = a.start_date_local.slice(0, 10);
  const L = (k: string) => `<div class="place-popup-label">${k}</div>`;
  const rows: string[] = [];
  rows.push(`<div class="place-popup-name">${esc(a.name)}</div>`);
  if (where) rows.push(L(zh ? '位置' : 'WHERE') + `<div>${esc(where)}</div>`);
  if (ann?.note) rows.push(L(zh ? '备注' : 'NOTE') + `<div>${esc(ann.note)}</div>`);
  if (ann?.tags?.length) {
    rows.push(
      L(zh ? '标签' : 'TAGS') +
        `<div class="place-popup-tags">${ann.tags
          .map((t) => `<span>${esc(t)}</span>`)
          .join('')}</div>`
    );
  }
  rows.push(L(zh ? '日期' : 'DATE') + `<div class="font-mono">${esc(date)}</div>`);
  if (ann?.link) {
    rows.push(
      L(zh ? '链接' : 'LINK') +
        `<a class="place-popup-link" href="${esc(ann.link)}" target="_blank" rel="noreferrer noopener">${esc(ann.link)}</a>`
    );
  }
  return `<div class="place-popup">${rows.join('')}</div>`;
}

