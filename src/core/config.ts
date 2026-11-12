/**
 * Static configuration for the places dashboard.
 *
 * running_page loaded this from a build-time config.yml (`@config`); places_page
 * has no such file, so the handful of values the ported components read are
 * defined here directly.
 */
import type { Locale } from './i18n';

export const DEFAULT_LOCALE: Locale = 'zh';
export const DEFAULT_THEME: 'light' | 'dark' | 'system' = 'system';

/** Avatar shown in ProfileCard; empty renders the placeholder silhouette. */
export const AVATAR = '';

export interface PlaceGoals {
  year: number;
  month: number;
  week: number;
}

/** Targets for the "N / goal places" progress cards on the home grid. */
export const PLACE_GOALS: PlaceGoals = {
  year: 100,
  month: 10,
  week: 3,
};
