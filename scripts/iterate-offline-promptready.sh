#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

source_url="${1:-https://promptready.app/}"
fixture_path="${2:-tests/fixtures/offline-corpus/promptready-homepage.html}"
source_title="${OFFLINE_SOURCE_TITLE:-PromptReady - One-click clean Markdown from any page}"
tmp_fixture="$(mktemp "${TMPDIR:-/tmp}/promptready-homepage.capture.XXXXXX.html")"

cleanup() {
  if [[ -f "$tmp_fixture" ]]; then
    rm -f "$tmp_fixture"
  fi
}
trap cleanup EXIT

OFFLINE_CAPTURE_MODE="${OFFLINE_CAPTURE_MODE:-rendered}" \
bash scripts/capture-fixture.sh "$source_url" "$tmp_fixture"

appears_unrendered_shell=false
if grep -q '<div id="root"></div>' "$tmp_fixture" && ! grep -qi 'Cleaner input\. Better model output\.' "$tmp_fixture"; then
  appears_unrendered_shell=true
fi

if [[ "$appears_unrendered_shell" == "true" ]]; then
  echo "Captured HTML appears to be an unrendered SPA shell; preserving existing fixture at $fixture_path"
  if [[ ! -s "$fixture_path" ]]; then
    echo "No existing fixture available for fallback: $fixture_path" >&2
    exit 1
  fi
else
  mv "$tmp_fixture" "$fixture_path"
  tmp_fixture=""
fi

OFFLINE_SOURCE_URL="$source_url" \
OFFLINE_FIXTURE_FILE="$fixture_path" \
OFFLINE_SOURCE_TITLE="$source_title" \
OFFLINE_DUMP_DIR="${OFFLINE_DUMP_DIR-output/offline-dumps}" \
npm run test:offline:promptready
