import { describe, expect, it } from 'vitest';
import { popupHtml } from './placePopup';
import { getActivityData } from './placesAsActivities';
import { getCachedAnnotations } from './annotations';

// Real data: the first place that has at least one tag.
const tagged = getActivityData().find(
  (a) => (getCachedAnnotations()?.[a.start_date_local]?.tags?.length ?? 0) > 0
)!;
const tags = getCachedAnnotations()![tagged.start_date_local].tags!;

describe('popupHtml tags', () => {
  it('renders plain spans by default (no tag filter on the page)', () => {
    const html = popupHtml(tagged, false);
    expect(html).toContain(`<span>${tags[0]}</span>`);
    expect(html).not.toContain('class="place-popup-tag"');
  });

  it('renders buttons carrying data-tag when clickable', () => {
    const html = popupHtml(tagged, true, { clickableTags: true });
    for (const t of tags) {
      expect(html).toContain(
        `<button type="button" class="place-popup-tag" data-tag="${t}" aria-pressed="false"`
      );
    }
    expect(html).not.toContain(`<span>${tags[0]}</span>`);
  });

  it('marks active tags with aria-pressed=true', () => {
    const html = popupHtml(tagged, true, {
      clickableTags: true,
      activeTags: [tags[0]],
    });
    expect(html).toContain(`data-tag="${tags[0]}" aria-pressed="true"`);
    if (tags.length > 1) {
      expect(html).toContain(`data-tag="${tags[1]}" aria-pressed="false"`);
    }
  });
});
