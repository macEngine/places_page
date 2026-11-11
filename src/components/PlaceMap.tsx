import { useEffect, useRef } from 'react';
import maplibregl, { type LngLatBoundsLike } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Place } from '@/core/places';

/**
 * Basemap: Carto Voyager vector style via MapLibre GL.
 * - No token needed (MapLibre is the token-free fork of mapbox-gl; running_page
 *   got bitten by mapbox-gl demanding a token even for third-party tiles).
 * - WGS-84, so `place.wgs84` is rendered as-is. Switching to Amap/Baidu later
 *   means reading `gcj02`/`bd09` instead — the data already carries both.
 */
const STYLE_URL = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

interface Props {
  places: readonly Place[];
  focused: Place | null;
  onFocus: (place: Place) => void;
  /** Bump to re-fit the view to all visible places (the "Fit" button). */
  fitKey?: number;
}

export default function PlaceMap({ places, focused, onFocus, fitKey }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    if (!container.current) return;
    const m = new maplibregl.Map({
      container: container.current,
      style: STYLE_URL,
      center: [116.4, 39.9],
      zoom: 3,
      attributionControl: false,
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }));
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  // Re-render markers whenever the visible set changes.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    for (const marker of markers.current) marker.remove();
    markers.current = places.map((place) => {
      const el = document.createElement('button');
      el.className = 'marker' + (place === focused ? ' marker--focused' : '');
      el.title = place.name;
      el.type = 'button';
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onFocus(place);
      });
      return new maplibregl.Marker({ element: el })
        .setLngLat(place.wgs84)
        .addTo(m);
    });
  }, [places, focused, onFocus]);

  // Fit to the visible set, or fly to the focused place.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (focused) {
      m.flyTo({
        center: focused.wgs84,
        zoom: Math.min(focused.zoom ?? 15, 17),
        duration: 800,
      });
      return;
    }
    if (places.length === 0) return;
    if (places.length === 1) {
      m.jumpTo({ center: places[0].wgs84, zoom: 13 });
      return;
    }
    const bounds = places.reduce(
      (b, p) => b.extend(p.wgs84),
      new maplibregl.LngLatBounds(places[0].wgs84, places[0].wgs84)
    );
    m.fitBounds(bounds as LngLatBoundsLike, { padding: 40, maxZoom: 13 });
  }, [places, focused, fitKey]);

  return <div ref={container} className="map" />;
}
