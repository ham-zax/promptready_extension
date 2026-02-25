# Trafilatura Service

Self-hosted extraction fallback service for PromptReady.

## Endpoints

1. `GET /health`
2. `POST /extract`

## Request (`POST /extract`)

```json
{
  "url": "https://example.com/article",
  "html": "<html>...</html>",
  "output": "markdown",
  "includeMetadata": true,
  "title": "Optional title override"
}
```

## Response

```json
{
  "success": true,
  "markdown": "...",
  "metadata": {
    "title": "...",
    "url": "...",
    "author": "...",
    "date": "..."
  },
  "warnings": [],
  "diagnostics": {
    "provider": "trafilatura",
    "elapsedMs": 42
  }
}
```

## Run Locally

```bash
cd services/trafilatura
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8089
```

## Docker

```bash
docker build -t promptready-trafilatura .
docker run --rm -p 8089:8089 promptready-trafilatura
```
