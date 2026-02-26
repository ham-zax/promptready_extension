#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

refresh_fixtures="${REFRESH_FIXTURES:-0}"
refresh_news="${REFRESH_NEWS:-0}"
iteration_root="${OFFLINE_ITERATION_ROOT:-output/offline-iterations}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
run_dir="${iteration_root}/${timestamp}"
dump_dir="${OFFLINE_DUMP_DIR:-${run_dir}/dumps}"
summary_path="${run_dir}/summary.json"
summary_markdown_path="${run_dir}/summary.md"

if [[ "$refresh_fixtures" == "1" ]]; then
  bash scripts/capture-core-fixtures.sh
fi

if [[ "$refresh_news" == "1" ]]; then
  bash scripts/capture-news-fixtures.sh
fi

mkdir -p "$dump_dir"

previous_summary=""
if [[ -d "$iteration_root" ]]; then
  mapfile -t existing_summaries < <(find "$iteration_root" -mindepth 2 -maxdepth 2 -type f -name 'summary.json' | sort)
  if [[ "${#existing_summaries[@]}" -gt 0 ]]; then
    previous_summary="${existing_summaries[${#existing_summaries[@]}-1]}"
  fi
fi

export OFFLINE_DUMP_DIR="$dump_dir"

npm run test:offline:promptready
npm run test:offline:corpus
npm run test:offline:news

report_args=(--current "$dump_dir" --out "$summary_path" --md-out "$summary_markdown_path")
if [[ -n "$previous_summary" ]]; then
  report_args+=(--previous "$previous_summary")
fi

node scripts/offline-iteration-report.mjs "${report_args[@]}"
ln -sfn "$run_dir" "${iteration_root}/latest"

echo "Offline corpus iteration complete."
echo "Run directory: $run_dir"
echo "Summary: $summary_path"
echo "Report: $summary_markdown_path"
