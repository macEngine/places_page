import { useEffect, useState } from 'react';

/**
 * Hash routing (#/ and #/wall) so GitHub Pages never has to serve a deep
 * path — a project site only knows index.html.
 */
export type Route = { page: 'home' } | { page: 'wall'; focus?: string };

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#/, '');
  const [path, qs] = h.split('?');
  if (path === '/wall') {
    const focus = new URLSearchParams(qs ?? '').get('focus') ?? undefined;
    return { page: 'wall', focus };
  }
  return { page: 'home' };
}

export function hrefFor(route: Route): string {
  if (route.page === 'wall') {
    return route.focus
      ? `#/wall?focus=${encodeURIComponent(route.focus)}`
      : '#/wall';
  }
  return '#/';
}

export function navigate(route: Route) {
  window.location.hash = hrefFor(route);
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
