# Map data provenance

Static geodata in `public/data/` is derived from Toronto open data. Regenerate
with the scripts here (plain Python 3; `build_neighbourhoods.py` needs
`openpyxl` for the census workbook).

## `public/data/ttc-routes.geojson`

Source: TTC Routes and Schedules (GTFS), open.toronto.ca package
`ttc-routes-and-schedules`. `build_routes.py` keeps rail modes only (subway
lines 1/2/4, LRT lines 5/6, streetcars 501-512; the 300-series night routes
duplicate the same streets), picks the shape serving the most trips per route,
and simplifies it with Douglas-Peucker at ~6 m tolerance.

## `public/data/ttc-bus-routes.geojson`

Same GTFS package, `build_bus_routes.py`. Keeps bus routes (route_type 3),
excluding the three-digit 300-series Blue Night routes that duplicate a
daytime route's streets under a different number (night routes are
distinguished from legitimate two-digit 30-39 daytime routes by requiring
exactly three digits). Same shape-selection and simplification as above.

## `public/data/neighbourhoods.geojson`

Sources, both from open.toronto.ca:

- `neighbourhoods` package, "Neighbourhoods - 4326.geojson": the 158 official
  neighbourhood boundaries, simplified at ~4 m tolerance.
- `neighbourhood-profiles` package, 2021 workbook: 2021 Census population
  ("Total - Age groups" row) and median 2020 household income per
  neighbourhood, joined on the zero-padded neighbourhood code.

Run `build_neighbourhoods.py` with the raw downloads alongside it; both scripts
print the paths they expect at the top of the file.
