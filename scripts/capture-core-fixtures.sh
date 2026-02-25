#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

capture_mode="${OFFLINE_CAPTURE_MODE:-rendered}"
render_wait_ms="${OFFLINE_RENDER_WAIT_MS:-12000}"

capture() {
  local url="$1"
  local output_file="$2"
  OFFLINE_CAPTURE_MODE="$capture_mode" OFFLINE_RENDER_WAIT_MS="$render_wait_ms" \
    bash scripts/capture-fixture.sh "$url" "$output_file"
}

mkdir -p tests/fixtures/offline-corpus

capture 'https://promptready.app/' 'tests/fixtures/offline-corpus/promptready-homepage.html'
capture 'https://mindsdb.com/' 'tests/fixtures/offline-corpus/mindsdb-homepage.html'
capture 'https://old.reddit.com/r/programming/top/?t=month' 'tests/fixtures/offline-corpus/reddit-programming-top.html'
capture 'https://github.com/trending' 'tests/fixtures/offline-corpus/github-trending.html'

echo 'Core fixture refresh complete.'
