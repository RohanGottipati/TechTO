# TechTO transit-core (FastAPI stub)

Minimal Phase-3+ service surface from the TechTO spec:

- `GET /health`
- `GET /ready`
- `GET /v1/network`
- `GET /v1/cohorts`
- `POST /v1/optimize/bounded-search` (proxies to Next `/api/optimization/search`,
  which is not implemented in the Next app yet, so this returns an upstream error)

## Run

```bash
cd services/transit-core
python -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn app.main:app --reload --port 8000
```

The service resolves the Next app base URL from `NEXT_PUBLIC_TRANSIT_API_BASE_URL`,
then `TECHTO_NEXT_BASE_URL`, then `http://localhost:3000`. `/network` and
`/cohorts` return placeholder payloads; the Next app does not call this service.
