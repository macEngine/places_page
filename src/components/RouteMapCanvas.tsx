import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as polyline from '@mapbox/polyline';
import type { Activity } from '../types';
import { useLocale } from '../hooks/useLocale';
import './RouteMap.css';

export interface RouteMapProps {
  activities: Activity[];
  allActivities?: Activity[];
  selectedActivity?: Activity | null;
  dark?: boolean;
  onClearSelection?: () => void;
}

// Token-free CARTO vector basemaps (MapLibre). running_page needed a Mapbox
// token even for third-party tiles; MapLibre is the token-free fork.
const LIGHT_STYLE =
  'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
const DARK_STYLE =
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const reduceMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A place's WGS-84 position, decoded from its degenerate route polyline. */
function pointOf(activity: Activity): [number, number] | null {
  if (!activity.summary_polyline) return null;
  try {
    const coords = polyline.decode(activity.summary_polyline);
    if (coords.length === 0) return null;
    const [lat, lng] = coords[0];
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return [lng, lat];
  } catch {
    return null;
  }
}

function accentColor(): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-accent')
    .trim();
  return value || '#0c4a6e';
}

export function RouteMapCanvas({
  activities,
  selectedActivity,
  dark,
  onClearSelection,
}: RouteMapProps) {
  const { locale } = useLocale();
  const zh = locale === 'zh';
  const panelRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const styleReadyRef = useRef(false);
  const cameraRef = useRef<maplibregl.CameraOptions | null>(null);
  const fittedRef = useRef<unknown>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading'
  );

  const selectedId = selectedActivity?.run_id ?? null;

  const points = useMemo(
    () =>
      activities
        .map((activity) => ({ activity, lngLat: pointOf(activity) }))
        .filter(
          (p): p is { activity: Activity; lngLat: [number, number] } =>
            p.lngLat !== null
        ),
    [activities]
  );

  const featureData = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: points.map(({ activity, lngLat }) => ({
        type: 'Feature' as const,
        properties: {
          selected: activity.run_id === selectedId,
          name: activity.name,
        },
        geometry: { type: 'Point' as const, coordinates: lngLat },
      })),
    }),
    [points, selectedId]
  );

  const bounds = useMemo(() => {
    const b = new maplibregl.LngLatBounds();
    for (const { lngLat } of points) b.extend(lngLat);
    return b;
  }, [points]);

  const fitPlaces = useCallback(() => {
    const map = mapRef.current;
    if (!map || bounds.isEmpty()) return;
    map.fitBounds(bounds, {
      padding: { top: 35, bottom: 35, left: 35, right: 65 },
      maxZoom: selectedActivity ? 15 : 13,
      duration: reduceMotion() ? 0 : 500,
    });
  }, [bounds, selectedActivity]);

  const circleColor = (): maplibregl.ExpressionSpecification => [
    'case',
    ['get', 'selected'],
    accentColor(),
    '#f97316',
  ];

  const draw = useCallback(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;
    const source = map.getSource('places') as
      | maplibregl.GeoJSONSource
      | undefined;
    if (source) {
      source.setData(featureData);
    } else {
      map.addSource('places', { type: 'geojson', data: featureData });
      map.addLayer({
        id: 'place-circles',
        type: 'circle',
        source: 'places',
        paint: {
          'circle-radius': ['case', ['get', 'selected'], 9, 6],
          'circle-color': circleColor(),
          'circle-stroke-width': 2,
          'circle-stroke-color': 'rgba(255,255,255,0.85)',
          'circle-opacity': 0.9,
        },
      });
    }
    map.setPaintProperty('place-circles', 'circle-color', circleColor());
    if (fittedRef.current !== featureData) {
      fittedRef.current = featureData;
      const selected = points.find((p) => p.activity.run_id === selectedId);
      if (selected) {
        map.flyTo({
          center: selected.lngLat,
          zoom: 14,
          duration: reduceMotion() ? 0 : 600,
        });
      } else {
        fitPlaces();
      }
    }
  }, [featureData, points, selectedId, fitPlaces]);

  useEffect(() => {
    if (!containerRef.current || !panelRef.current) return;
    styleReadyRef.current = false;
    setStatus('loading');
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: dark === false ? LIGHT_STYLE : DARK_STYLE,
      center: [116.4, 39.9],
      zoom: 3,
      attributionControl: false,
      ...cameraRef.current,
    });
    mapRef.current = map;
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      'top-right'
    );
    map.addControl(
      new maplibregl.FullscreenControl({ container: panelRef.current }),
      'top-right'
    );
    map.addControl(
      new maplibregl.ScaleControl({ unit: 'metric', maxWidth: 90 }),
      'bottom-left'
    );
    const onStyleLoad = () => {
      styleReadyRef.current = true;
      fittedRef.current = null;
      draw();
    };
    const onIdle = () => setStatus('ready');
    const onError = () => setStatus('error');
    map.on('style.load', onStyleLoad);
    map.on('idle', onIdle);
    map.on('error', onError);
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(containerRef.current);
    return () => {
      cameraRef.current = {
        center: map.getCenter(),
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
      };
      observer.disconnect();
      map.off('style.load', onStyleLoad);
      map.off('idle', onIdle);
      map.off('error', onError);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    let frame = 0;
    const onFullscreen = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        mapRef.current?.resize();
        fitPlaces();
      });
    };
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('fullscreenchange', onFullscreen);
    };
  }, [fitPlaces]);

  return (
    <section
      ref={panelRef}
      className="route-map"
      aria-label={zh ? '地点地图' : 'Place map'}
    >
      <div className="route-map-header">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">
            {zh ? '地点地图' : 'Place map'}
          </h2>
          <p
            className="truncate text-xs text-[var(--color-muted)]"
            title={selectedActivity?.name}
          >
            {selectedActivity
              ? selectedActivity.name
              : `${points.length.toLocaleString()} ${zh ? '个地点' : 'places'}`}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {selectedActivity && onClearSelection && (
            <button className="route-map-action" onClick={onClearSelection}>
              {zh ? '返回总览' : 'Overview'}
            </button>
          )}
          <button
            className="route-map-action"
            disabled={!points.length}
            onClick={fitPlaces}
            title={zh ? '将所有地点放入视野' : 'Fit all places'}
          >
            {zh ? '定位地点' : 'Fit places'}
          </button>
        </div>
      </div>
      <div className="route-map-body">
        <div ref={containerRef} className="h-full w-full" />
        {!points.length && (
          <div className="route-map-empty" role="status">
            {zh ? '当前筛选没有地点' : 'No places to show'}
          </div>
        )}
      </div>
      <div className="route-map-footer">
        <span role="status" aria-live="polite">
          {status === 'error'
            ? zh
              ? '底图加载失败'
              : 'Basemap failed to load'
            : status === 'loading'
              ? zh
                ? '正在加载地图…'
                : 'Loading map…'
              : zh
                ? '底图 · CARTO'
                : 'Basemap · CARTO'}
        </span>
      </div>
    </section>
  );
}
