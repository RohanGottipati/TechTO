"""Build public/data/neighbourhoods.geojson.

Inputs (download next to this script):
- neighbourhoods_raw.geojson : open.toronto.ca package `neighbourhoods`,
  resource "Neighbourhoods - 4326.geojson" (158 boundaries, WGS84).
- profiles.xlsx : open.toronto.ca package `neighbourhood-profiles`,
  2021 workbook (hd2021_census_profile sheet). Needs openpyxl.

Joins 2021 Census population and median 2020 household income onto each
boundary by zero-padded neighbourhood code, rounds coordinates to 6 decimals
and simplifies rings with Douglas-Peucker at ~4 m tolerance.
"""
import json

import openpyxl

TOL = 0.00004


def read_census(path="profiles.xlsx"):
    wb = openpyxl.load_workbook(path, read_only=True)
    ws = wb["hd2021_census_profile"]
    names = nums = pop = income = None
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        label = str(row[0]).strip() if row[0] else ""
        if i == 0:
            names = row[1:]
        elif i == 1:
            nums = row[1:]
        elif i == 3:  # "Total - Age groups ..." = 2021 population
            pop = row[1:]
        elif label.startswith("Median total income of household in 2020"):
            income = row[1:]
        if pop is not None and income is not None:
            break
    out = {}
    for j, num in enumerate(nums):
        if num is None:
            continue
        code = str(num).zfill(3)
        out[code] = {
            "name": str(names[j]),
            "population": int(float(pop[j])),
            "income": int(float(income[j])) if income[j] not in (None, "") else None,
        }
    return out


def simplify(coords, tol):
    if len(coords) < 5:
        return coords
    keep = [False] * len(coords)
    keep[0] = keep[-1] = True
    stack = [(0, len(coords) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = coords[a]
        bx, by = coords[b]
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
            stack.append((a, imax))
            stack.append((imax, b))
    out = [c for c, k in zip(coords, keep) if k]
    return out if len(out) >= 4 else coords


def main():
    fc = json.load(open("neighbourhoods_raw.geojson"))
    census = read_census()

    def clean(rings):
        return [
            simplify([[round(x, 6), round(y, 6)] for x, y in ring], TOL)
            for ring in rings
        ]

    feats = []
    for f in fc["features"]:
        p = f["properties"]
        code = str(p["AREA_SHORT_CODE"]).zfill(3)
        c = census.get(code)
        geom = f["geometry"]
        if geom["type"] == "Polygon":
            geom = {"type": "Polygon", "coordinates": clean(geom["coordinates"])}
        else:
            geom = {
                "type": "MultiPolygon",
                "coordinates": [clean(poly) for poly in geom["coordinates"]],
            }
        feats.append(
            {
                "type": "Feature",
                "id": int(code),
                "properties": {
                    "code": code,
                    "name": p["AREA_NAME"],
                    "population": c["population"] if c else None,
                    "income": c["income"] if c else None,
                },
                "geometry": geom,
            }
        )

    feats.sort(key=lambda f: f["id"])
    json.dump(
        {"type": "FeatureCollection", "features": feats},
        open("neighbourhoods.geojson", "w"),
        separators=(",", ":"),
    )
    print(len(feats), "neighbourhoods written")


if __name__ == "__main__":
    main()
