#!/usr/bin/env python3
"""parse-place.py — turn a pasted map URL (or bare @coords) into one places record.

WHY THIS IS NOT TRIVIAL
-----------------------
Chinese map providers disagree on BOTH the projection and the datum, so the same
restaurant has three different coordinates and the raw numbers are not comparable:

    provider        projected (what the URL shows)   geographic datum
    map.baidu.com   BD09MC  (Baidu's own mercator)   BD-09
    amap.com        EPSG:3857 web mercator           GCJ-02
    mapbox / OSM    EPSG:3857 web mercator           WGS-84

Measured for 尖沙咀食饭公司(北京首店), straight from its Baidu URL:

    BD-09   116.474841, 39.955524     <- the pasted value
    GCJ-02  116.468242, 39.949844       846 m away
    WGS-84  116.462094, 39.948515      1337 m away

Two consequences:

1. Reading a Baidu URL as if it were EPSG:3857 lands 21 km off. (It looks
   plausible -- still inside Beijing -- which is exactly why it is dangerous.)
2. Mixing providers without recording which one a coordinate came from silently
   corrupts the dataset by ~850 m per point.

So: every record stores the provider it came from, its native coordinate, AND
wgs84 as the canonical value. Renderers read wgs84 (or gcj02 for a Chinese
basemap); nothing downstream has to re-derive a datum.

Usage
-----
    ./parse-place.py '<paste a map.baidu.com or amap URL>'
    ./parse-place.py --tags 美食 --country 中国 --province 北京 --city 北京 '<url>'
    ./parse-place.py --source amap '尖沙咀食饭公司/@116.47,39.95,19z'
    ./parse-place.py --selftest

--source is auto-detected from a URL host; required for a bare '@a,b' paste.
"""
import argparse
import json
import math
import re
import sys
from urllib.parse import unquote

# ----------------------------------------------------------------- projections
R_MERC = 6378137.0
MERC_MAX = 20037508.342789
X_PI = math.pi * 3000.0 / 180.0
_A = 6378245.0
_EE = 0.00669342162296594323

# Baidu Mercator (BD09MC) -> BD09 lat/lon. Piecewise polynomial; NOT EPSG:3857.
MCBAND = [12890594.86, 8362377.87, 5591021.0, 3481989.83, 1678043.12, 0.0]
MC2LL = [
    [1.410526172116255e-8, 0.00000898305509648872, -1.9939833816331, 200.9824383106796,
     -187.2403703815547, 91.6087516669843, -23.38765649603339, 2.57121317296198,
     -0.03801003308653, 17337981.2],
    [-7.435856389565537e-9, 0.000008983055097726239, -0.78625201886289, 96.32687599759846,
     -1.85204757529826, -59.36935905485877, 47.40033549296737, -16.50741931063887,
     2.28786674699375, 10260144.86],
    [-3.030883460898826e-8, 0.00000898305509983578, 0.30071316287616, 59.74293618442277,
     7.357984074871, -25.38371002664745, 13.45380521110908, -3.29883767235584,
     0.32710905363475, 6856817.37],
    [-1.981981304930552e-8, 0.000008983055099779535, 0.03278182852591, 40.31678527705744,
     0.65659298677277, -4.44255534477492, 0.85341911805263, 0.12923347998204,
     -0.04625736007561, 4482777.06],
    [3.09191371068437e-9, 0.000008983055096812155, 0.00006995724062, 23.10934304144901,
     -0.00023663490511, -0.6321817810242, -0.00663494467273, 0.03430082397953,
     -0.00466043876332, 2555164.4],
    [2.890871144776878e-9, 0.000008983055095805407, -3.068298e-8, 7.47137025468032,
     -0.00000353937994, -0.02145144861037, -0.00001234426596, 0.00010322952773,
     -0.00000323890364, 826088.5],
]


def bd09mc_to_bd09(x, y):
    """Baidu projected metres -> BD-09 (lat, lon)."""
    ax, ay = abs(x), abs(y)
    coef = next(MC2LL[i] for i, band in enumerate(MCBAND) if ay >= band)
    lon = coef[0] + coef[1] * ax
    t = ay / coef[9]
    lat = (coef[2] + coef[3] * t + coef[4] * t ** 2 + coef[5] * t ** 3
           + coef[6] * t ** 4 + coef[7] * t ** 5 + coef[8] * t ** 6)
    return (lat if y >= 0 else -lat), (lon if x >= 0 else -lon)


def epsg3857_to_lonlat(x, y):
    return math.degrees(math.atan(math.sinh(y / R_MERC))), x / R_MERC * 180.0 / math.pi


# ------------------------------------------------------------ datum conversion
def _out_of_china(lat, lon):
    return not (73.66 < lon < 135.05 and 3.86 < lat < 53.55)


def _tf_lat(x, y):
    r = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * math.sqrt(abs(x))
    r += (20.0 * math.sin(6.0 * x * math.pi) + 20.0 * math.sin(2.0 * x * math.pi)) * 2.0 / 3.0
    r += (20.0 * math.sin(y * math.pi) + 40.0 * math.sin(y / 3.0 * math.pi)) * 2.0 / 3.0
    r += (160.0 * math.sin(y / 12.0 * math.pi) + 320 * math.sin(y * math.pi / 30.0)) * 2.0 / 3.0
    return r


def _tf_lon(x, y):
    r = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * math.sqrt(abs(x))
    r += (20.0 * math.sin(6.0 * x * math.pi) + 20.0 * math.sin(2.0 * x * math.pi)) * 2.0 / 3.0
    r += (20.0 * math.sin(x * math.pi) + 40.0 * math.sin(x / 3.0 * math.pi)) * 2.0 / 3.0
    r += (150.0 * math.sin(x / 12.0 * math.pi) + 300.0 * math.sin(x / 30.0 * math.pi)) * 2.0 / 3.0
    return r


def _gcj_delta(lat, lon):
    d_lat, d_lon = _tf_lat(lon - 105.0, lat - 35.0), _tf_lon(lon - 105.0, lat - 35.0)
    rad = lat / 180.0 * math.pi
    magic = math.sin(rad)
    magic = 1 - _EE * magic * magic
    sq = math.sqrt(magic)
    return ((d_lat * 180.0) / ((_A * (1 - _EE)) / (magic * sq) * math.pi),
            (d_lon * 180.0) / (_A / sq * math.cos(rad) * math.pi))


def wgs84_to_gcj02(lat, lon):
    if _out_of_china(lat, lon):
        return lat, lon
    d = _gcj_delta(lat, lon)
    return lat + d[0], lon + d[1]


def gcj02_to_wgs84(lat, lon):
    """Iterated inverse: 1 pass is ~1 m off, 3 passes is sub-millimetre."""
    if _out_of_china(lat, lon):
        return lat, lon
    w_lat, w_lon = lat, lon
    for _ in range(3):
        g_lat, g_lon = wgs84_to_gcj02(w_lat, w_lon)
        w_lat += lat - g_lat
        w_lon += lon - g_lon
    return w_lat, w_lon


def bd09_to_gcj02(lat, lon):
    x, y = lon - 0.0065, lat - 0.006
    z = math.sqrt(x * x + y * y) - 0.00002 * math.sin(y * X_PI)
    th = math.atan2(y, x) - 0.000003 * math.cos(x * X_PI)
    return z * math.sin(th), z * math.cos(th)


def gcj02_to_bd09(lat, lon):
    z = math.sqrt(lon * lon + lat * lat) + 0.00002 * math.sin(lat * X_PI)
    th = math.atan2(lat, lon) + 0.000003 * math.cos(lon * X_PI)
    return z * math.sin(th) + 0.006, z * math.cos(th) + 0.0065


def haversine_m(lat1, lon1, lat2, lon2):
    p = math.pi / 180
    d_lat, d_lon = (lat2 - lat1) * p, (lon2 - lon1) * p
    h = (math.sin(d_lat / 2) ** 2
         + math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin(d_lon / 2) ** 2)
    return 2 * 6371000 * math.asin(math.sqrt(h))


# ---------------------------------------------------------------------- parsing
COORD_RE = re.compile(r"@\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)(?:\s*,\s*(\d+(?:\.\d+)?)z)?")
UID_RE = re.compile(r"[?&]uid=([0-9a-zA-Z]+)")
SOURCES = ("baidu", "amap", "wgs84")


def detect_source(text):
    t = text.lower()
    if "map.baidu.com" in t or "baidu.com" in t:
        return "baidu"
    if "amap.com" in t or "gaode" in t or "autonavi" in t:
        return "amap"
    if "google.com/maps" in t or "openstreetmap" in t or "mapbox" in t:
        return "wgs84"
    return None


def extract_name(text, at_pos):
    """Baidu POI URLs look like .../poi/<urlencoded name>/@...  -- take the last path
    segment before '@' and url-decode it. A bare paste uses whatever precedes '@'."""
    head = text[:at_pos].rstrip("/").rstrip()
    seg = head.rsplit("/", 1)[-1] if "/" in head else head
    name = unquote(seg).strip()
    # a leftover scheme/host means there was no name segment at all
    if not name or name.startswith("http") or "." in name and " " not in name and len(name) < 4:
        return None
    return name


def parse(pasted, source=None):
    pasted = pasted.strip()
    src = source or detect_source(pasted)
    if src is None:
        raise ValueError(
            "cannot tell which map this came from -- pass --source baidu|amap|wgs84. "
            "This matters: the same place differs by ~850 m between Baidu and Amap.")
    if src not in SOURCES:
        raise ValueError(f"--source must be one of {SOURCES}, got {src!r}")

    m = COORD_RE.search(pasted)
    if not m:
        raise ValueError(f"no '@<a>,<b>' coordinate found in: {pasted[:80]!r}")
    a, b = float(m.group(1)), float(m.group(2))
    zoom = float(m.group(3)) if m.group(3) else None
    name = extract_name(pasted, m.start())
    uid = UID_RE.search(pasted).group(1) if UID_RE.search(pasted) else None

    degrees = abs(a) <= 90 and abs(b) <= 180
    if degrees:
        projected, native_lat, native_lon = "degrees", a, b
    else:
        if abs(a) > MERC_MAX or abs(b) > MERC_MAX:
            raise ValueError(f"coordinate out of mercator range: {a},{b}")
        if src == "baidu":
            projected = "bd09mc"
            native_lat, native_lon = bd09mc_to_bd09(a, b)
        else:
            projected = "epsg3857"
            native_lat, native_lon = epsg3857_to_lonlat(a, b)

    # native datum -> the other two
    if src == "baidu":
        bd = (native_lat, native_lon)
        gcj = bd09_to_gcj02(*bd)
        wgs = gcj02_to_wgs84(*gcj)
    elif src == "amap":
        gcj = (native_lat, native_lon)
        wgs = gcj02_to_wgs84(*gcj)
        bd = gcj02_to_bd09(*gcj)
    else:
        wgs = (native_lat, native_lon)
        gcj = wgs84_to_gcj02(*wgs)
        bd = gcj02_to_bd09(*gcj)

    return {
        "name": name,
        "wgs84": [round(wgs[1], 6), round(wgs[0], 6)],   # canonical; [lon, lat] GeoJSON order
        "gcj02": [round(gcj[1], 6), round(gcj[0], 6)],
        "bd09": [round(bd[1], 6), round(bd[0], 6)],
        "zoom": zoom,
        "country": None, "province": None, "city": None,
        "tags": [], "link": None, "desc": None,
        "_source": {
            "provider": src,
            "projection": projected,
            "poi_uid": uid,
            "raw": pasted,
            "offset_from_wgs84_m": {
                "bd09": round(haversine_m(*wgs, *bd), 1),
                "gcj02": round(haversine_m(*wgs, *gcj), 1),
            },
        },
    }


# --------------------------------------------------------------------- selftest
REAL = ("https://map.baidu.com/poi/%E5%B0%96%E6%B2%99%E5%92%80%E9%A3%9F%E9%A5%AD%E5%85%AC%E5%8F%B8"
        "(%E5%8C%97%E4%BA%AC%E9%A6%96%E5%BA%97)/@12966061.027176145,4831783.63568623,19z"
        "?uid=5988913a09b3c1cc7adbd208&ugc_type=3&querytype=detailConInfo&da_src=shareurl")


def selftest():
    ok = True

    def chk(label, got, want, tol=None):
        nonlocal ok
        good = abs(got - want) <= tol if tol is not None else got == want
        ok &= good
        print(f"  [{'PASS' if good else 'FAIL'}] {label}: {got!r}" + ("" if good else f"  (want {want!r})"))

    print("1. the real Baidu URL")
    r = parse(REAL)
    chk("provider auto-detected", r["_source"]["provider"], "baidu")
    chk("projection", r["_source"]["projection"], "bd09mc")
    chk("name url-decoded", r["name"], "尖沙咀食饭公司(北京首店)")
    chk("poi uid captured", r["_source"]["poi_uid"], "5988913a09b3c1cc7adbd208")
    chk("zoom", r["zoom"], 19.0)
    chk("bd09 lon", r["bd09"][0], 116.474841, 1e-5)
    chk("bd09 lat", r["bd09"][1], 39.955524, 1e-5)
    chk("gcj02 lon", r["gcj02"][0], 116.468242, 1e-4)
    chk("gcj02 lat", r["gcj02"][1], 39.949844, 1e-4)
    chk("wgs84 lon", r["wgs84"][0], 116.462094, 1e-4)
    chk("wgs84 lat", r["wgs84"][1], 39.948515, 1e-4)
    chk("lat is central Beijing (39.9x), not 39.7x", round(r["bd09"][1], 1), 40.0, 0.06)

    print("2. Baidu mercator is NOT EPSG:3857 (the bug this script exists for)")
    wrong_lat, wrong_lon = epsg3857_to_lonlat(12966061.027176145, 4831783.63568623)
    d = haversine_m(r["bd09"][1], r["bd09"][0], wrong_lat, wrong_lon)
    chk("misreading it costs >20 km", d > 20000, True)
    print(f"         (measured {d/1000:.1f} km)")

    print("3. datum round-trips close")
    bd = (39.955524, 116.474841)
    g = bd09_to_gcj02(*bd); back = gcj02_to_bd09(*g)
    chk("bd->gcj->bd  < 1 m", haversine_m(*bd, *back), 0.0, 1.0)
    w = gcj02_to_wgs84(*g); back2 = wgs84_to_gcj02(*w)
    chk("gcj->wgs->gcj < 0.01 m", haversine_m(*g, *back2), 0.0, 0.01)

    print("4. amap source takes the EPSG:3857 path")
    r2 = parse("x/@12966061.027176145,4831783.63568623,19z", source="amap")
    chk("projection", r2["_source"]["projection"], "epsg3857")
    chk("differs from the baidu read", abs(r2["gcj02"][1] - r["gcj02"][1]) > 0.1, True)

    print("5. degrees input detected, not read as metres")
    r3 = parse("Somewhere/@39.9,116.4,15z", source="amap")
    chk("projection", r3["_source"]["projection"], "degrees")

    print("6. outside China there is no GCJ/BD offset")
    r4 = parse("Tokyo/@35.68,139.76,12z", source="wgs84")
    chk("gcj offset == 0", r4["_source"]["offset_from_wgs84_m"]["gcj02"], 0.0, 0.01)

    print("7. unknown provider is refused instead of guessed")
    try:
        parse("@12966061.0,4831783.6,19z")
        chk("raised ValueError", False, True)
    except ValueError:
        chk("raised ValueError", True, True)

    print("8. garbage is rejected")
    try:
        parse("no coordinate", source="baidu")
        chk("raised ValueError", False, True)
    except ValueError:
        chk("raised ValueError", True, True)

    print("\n" + ("ALL PASS" if ok else "FAILURES ABOVE"))
    return 0 if ok else 1


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pasted", nargs="?", help="map URL, or 'name/@a,b,Nz'")
    ap.add_argument("--source", choices=SOURCES, help="which map it came from (auto from URL)")
    ap.add_argument("--country"); ap.add_argument("--province"); ap.add_argument("--city")
    ap.add_argument("--tags", nargs="*", default=[])
    ap.add_argument("--link"); ap.add_argument("--desc")
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()

    if a.selftest:
        sys.exit(selftest())
    if not a.pasted:
        ap.error("pass a map URL / '@a,b' string, or --selftest")

    rec = parse(a.pasted, source=a.source)
    for k in ("country", "province", "city", "link", "desc"):
        if getattr(a, k) is not None:
            rec[k] = getattr(a, k)
    rec["tags"] = a.tags
    print(json.dumps(rec, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
