#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

refresh_fixtures="${REFRESH_FIXTURES:-0}"
refresh_news="${REFRESH_NEWS:-0}"

if [[ "$refresh_fixtures" == "1" ]]; then
  bash scripts/capture-core-fixtures.sh
fi

if [[ "$refresh_news" == "1" ]]; then
  bash scripts/capture-news-fixtures.sh
fi

npm run test:offline:promptready
npm run test:offline:corpus
npm run test:offline:news

echo 'Offline corpus iteration complete.'
