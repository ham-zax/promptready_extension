#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

capture_mode="${OFFLINE_CAPTURE_MODE:-raw}"
render_wait_ms="${OFFLINE_RENDER_WAIT_MS:-14000}"

capture() {
  local url="$1"
  local output_file="$2"
  OFFLINE_CAPTURE_MODE="$capture_mode" OFFLINE_RENDER_WAIT_MS="$render_wait_ms" \
    bash scripts/capture-fixture.sh "$url" "$output_file"
}

mkdir -p tests/fixtures/offline-corpus/news

capture 'https://timesofindia.indiatimes.com/india/pm-modi-israel-visit-live-updates-knesset-parliament-netanyahu-india-israel-address-defence-agreement-latest-news/liveblog/128776409.cms' 'tests/fixtures/offline-corpus/news/toi-liveblog.html'
capture 'https://www.bbc.com/news/articles/cx2g3vmde0eo?at_medium=RSS&at_campaign=rss' 'tests/fixtures/offline-corpus/news/bbc-world-article.html'
capture 'https://www.theguardian.com/global-development/2026/feb/25/zambia-us-health-aid-deal-exploitation-mining-concessions-data-sharing-targets' 'tests/fixtures/offline-corpus/news/guardian-world-article.html'
capture 'https://indianexpress.com/article/india/bilateral-talks-today-pacts-on-table-pm-modi-in-israel-to-strengthen-ties-10552207/' 'tests/fixtures/offline-corpus/news/indianexpress-article.html'
capture 'https://www.aljazeera.com/news/2026/2/25/cuban-border-agents-fire-upon-florida-tagged-speedboat-killing-four?traffic_source=rss' 'tests/fixtures/offline-corpus/news/aljazeera-news-article.html'

echo 'News fixture refresh complete.'
