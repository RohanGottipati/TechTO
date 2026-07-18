"""Build routes.geojson from the TTC GTFS feed (open.toronto.ca, ttc-routes-and-schedules).

Keeps rail modes only: subway (route_type 1) and streetcar/LRT (route_type 0),
excluding the 300-series Blue Night duplicates. Per route and direction, the
shape serving the most trips is taken as the representative pattern, then
Douglas-Peucker simplified (~6 m tolerance).
"""
import csv, json
from collections import Counter, defaultdict

GTFS = "gtfs"
KEEP_TYPES = {"0", "1"}

routes = {}
for r in csv.DictReader(open(f"{GTFS}/routes.txt")):
    if r["route_type"] in KEEP_TYPES and not r["route_short_name"].startswith("3"):
        routes[r["route_id"]] = r

# shape usage per (route, direction)
usage = defaultdict(Counter)
for t in csv.DictReader(open(f"{GTFS}/trips.txt")):
    rid = t["route_id"]
    if rid in routes and t["shape_id"]:
        usage[(rid, t.get("direction_id", "0"))][t["shape_id"]] += 1

wanted_shapes = {}
for key, counter in usage.items():
    sid, _ = counter.most_common(1)[0]
    wanted_shapes.setdefault(sid, []).append(key)

pts = defaultdict(list)
for row in csv.DictReader(open(f"{GTFS}/shapes.txt")):
    sid = row["shape_id"]
    if sid in wanted_shapes:
        pts[sid].append((int(row["shape_pt_sequence"]),
                         round(float(row["shape_pt_lon"]), 6),
                         round(float(row["shape_pt_lat"]), 6)))

def simplify(coords, tol):
    # iterative Douglas-Peucker on lon/lat (fine at city scale)
    if len(coords) < 3:
        return coords
    keep = [False] * len(coords)
    keep[0] = keep[-1] = True
    stack = [(0, len(coords) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = coords[a]; bx, by = coords[b]
        dx, dy = bx - ax, by - ay
        seg2 = dx * dx + dy * dy
        dmax, imax = 0.0, -1
        for i in range(a + 1, b):
            px, py = coords[i]
            if seg2 == 0:
                d2 = (px - ax) ** 2 + (py - ay) ** 2
            else:
                t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / seg2))
                d2 = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2
            if d2 > dmax:
                dmax, imax = d2, i
        if dmax > tol * tol:
            keep[imax] = True
            stack.append((a, imax)); stack.append((imax, b))
    return [c for c, k in zip(coords, keep) if k]

MODE = {"1": "subway", "0": "streetcar"}
features = []
for (rid, direction), counter in sorted(usage.items()):
    if direction != "0" and ("0" in [d for r2, d in usage if r2 == rid]):
        continue  # one direction per route is enough for display
    sid, _ = counter.most_common(1)[0]
    seq = sorted(pts[sid])
    coords = [[lon, lat] for _, lon, lat in seq]
    coords = simplify(coords, 0.00006)
    r = routes[rid]
    short = r["route_short_name"]
    mode = "lrt" if short in ("5", "6") else MODE[r["route_type"]]
    features.append({
        "type": "Feature",
        "properties": {
            "route": short,
            "name": r["route_long_name"],
            "mode": mode,
            "gtfs_color": "#" + r["route_color"],
        },
        "geometry": {"type": "LineString", "coordinates": coords},
    })

features.sort(key=lambda f: (f["properties"]["mode"], f["properties"]["route"]))
fc = {"type": "FeatureCollection", "features": features}
with open("routes.geojson", "w") as f:
    json.dump(fc, f, separators=(",", ":"))
total = sum(len(f["geometry"]["coordinates"]) for f in features)
print(f"{len(features)} routes, {total} points")
for f in features:
    p = f["properties"]
    print(p["mode"], p["route"], p["name"], len(f["geometry"]["coordinates"]))
