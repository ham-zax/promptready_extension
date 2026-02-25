#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

source_url="${1:-https://promptready.app/}"
fixture_path="${2:-tests/fixtures/offline-corpus/promptready-homepage.html}"
source_title="${OFFLINE_SOURCE_TITLE:-PromptReady - One-click clean Markdown from any page}"

OFFLINE_CAPTURE_MODE="${OFFLINE_CAPTURE_MODE:-rendered}" \
bash scripts/capture-fixture.sh "$source_url" "$fixture_path"

OFFLINE_SOURCE_URL="$source_url" \
OFFLINE_FIXTURE_FILE="$fixture_path" \
OFFLINE_SOURCE_TITLE="$source_title" \
npm run test:offline:promptready
