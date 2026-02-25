#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <url> <output-file>"
  echo "Env: OFFLINE_CAPTURE_MODE=rendered|raw (default: rendered)"
  echo "     OFFLINE_RENDER_VIEWPORT=WIDTH,HEIGHT (default: 1920,18000)"
  echo "     OFFLINE_RENDER_AUTOTUNE=0|1 (default: 1)"
  echo "     OFFLINE_RENDER_RETRY_VIEWPORT=WIDTH,HEIGHT (default: 1920,30000)"
  echo "     OFFLINE_RENDER_RETRY_WAIT_MS=<ms> (default: 12000)"
  exit 1
fi

url="$1"
output_file="$2"
capture_mode="${OFFLINE_CAPTURE_MODE:-rendered}"
render_wait_ms="${OFFLINE_RENDER_WAIT_MS:-7000}"
render_viewport="${OFFLINE_RENDER_VIEWPORT:-1920,18000}"
render_autotune="${OFFLINE_RENDER_AUTOTUNE:-1}"
render_retry_wait_ms="${OFFLINE_RENDER_RETRY_WAIT_MS:-12000}"
render_retry_viewport="${OFFLINE_RENDER_RETRY_VIEWPORT:-1920,30000}"

mkdir -p "$(dirname "$output_file")"

if [[ "$capture_mode" == "raw" ]]; then
  curl -L --silent --show-error "$url" -o "$output_file"
else
  capture_rendered() {
    local viewport="$1"
    local wait_ms="$2"
    local target_file="$3"
    google-chrome \
      --headless \
      --disable-gpu \
      --hide-scrollbars \
      --window-size="${viewport}" \
      --run-all-compositor-stages-before-draw \
      --virtual-time-budget="${wait_ms}" \
      --dump-dom \
      "$url" > "$target_file"
  }

  estimate_capture_quality() {
    local target_file="$1"
    local skeleton_count heading_count bytes
    skeleton_count="$(grep -Eo 'aria-hidden="true" class="min-h-\[[^"]+' "$target_file" | wc -l | tr -d ' ')"
    heading_count="$(grep -Eo '<h[1-6][ >]' "$target_file" | wc -l | tr -d ' ')"
    bytes="$(wc -c < "$target_file" | tr -d ' ')"
    echo "${skeleton_count:-0}:${heading_count:-0}:${bytes:-0}"
  }

  # Render JS-heavy pages before snapshot so offline extraction tests use real DOM, not empty #root shells.
  capture_rendered "$render_viewport" "$render_wait_ms" "$output_file"

  if [[ "$render_autotune" == "1" ]]; then
    IFS=':' read -r base_skeleton_count base_heading_count base_bytes <<< "$(estimate_capture_quality "$output_file")"

    # If a page still looks placeholder-heavy with low heading coverage, retry with larger viewport/wait.
    if (( base_skeleton_count >= 3 && base_heading_count <= 18 )); then
      retry_file="$(mktemp "${output_file##*/}.retry.XXXXXX")"
      capture_rendered "$render_retry_viewport" "$render_retry_wait_ms" "$retry_file"
      IFS=':' read -r retry_skeleton_count retry_heading_count retry_bytes <<< "$(estimate_capture_quality "$retry_file")"

      min_acceptable_headings=$(( base_heading_count / 2 ))
      if (( min_acceptable_headings < 4 )); then
        min_acceptable_headings=4
      fi
      min_acceptable_bytes=$(( base_bytes * 75 / 100 ))

      if (( retry_heading_count >= min_acceptable_headings && retry_bytes >= min_acceptable_bytes )) && \
         { (( retry_heading_count > base_heading_count )) || (( retry_skeleton_count < base_skeleton_count && retry_heading_count >= base_heading_count )); }; then
        mv "$retry_file" "$output_file"
        echo "Auto-tuned rendered capture (skeleton ${base_skeleton_count}->${retry_skeleton_count}, headings ${base_heading_count}->${retry_heading_count}, bytes ${base_bytes}->${retry_bytes})"
      else
        rm -f "$retry_file"
      fi
    fi
  fi
fi

bytes="$(wc -c < "$output_file" | tr -d ' ')"
echo "Saved fixture: $output_file ($bytes bytes, mode=$capture_mode)"
