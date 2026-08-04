#!/usr/bin/env bash
set -euo pipefail

usage() {
  printf 'Usage: %s SOURCE_MATERIAL_ROOT\n' "$(basename "$0")" >&2
}

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

if [[ "$#" -ne 1 ]]; then
  usage
  exit 2
fi

for tool in ffmpeg ffprobe cwebp; do
  command -v "$tool" >/dev/null 2>&1 || die "required tool not found: $tool"
done

source_root=$1
[[ -d "$source_root" ]] || die "source material root is not a directory: $source_root"

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo_root=$(cd -- "$script_dir/.." && pwd)
output_dir="$repo_root/docs/assets/images/hero"
mkdir -p "$output_dir"

scratch_dir=$(mktemp -d "${TMPDIR:-/tmp}/hero-filmstrips.XXXXXX")
cleanup() {
  rm -rf "$scratch_dir"
}
trap cleanup EXIT INT TERM

FILTER='scale=320:200:force_original_aspect_ratio=increase,crop=320:200,setsar=1'

render_strip() {
  local output_name=$1
  local source_folder=$2
  local frame_count=$3
  local expected_height=$4

  local folder="$source_root/$source_folder"
  local generated_dir="$folder/generated_reference_images"
  local keyframe_dir="$folder/keyframe_images"

  [[ -d "$generated_dir" ]] || die "missing generated_reference_images directory: $generated_dir"
  [[ -d "$keyframe_dir" ]] || die "missing keyframe_images directory: $keyframe_dir"

  local -a inputs=()
  local index padded generated keyframe

  for ((index = 0; index < frame_count; index += 1)); do
    printf -v padded '%03d' "$index"
    generated="$generated_dir/gen_ref_${padded}.png"
    keyframe="$keyframe_dir/kf${padded}_src${padded}.png"
    [[ -f "$generated" ]] || die "missing generated frame: $generated"
    [[ -f "$keyframe" ]] || die "missing keyframe: $keyframe"
    inputs+=("$generated" "$keyframe")
  done

  local temp_png="$scratch_dir/${output_name}.png"
  local temp_webp="$scratch_dir/${output_name}.webp"
  local final_webp="$output_dir/${output_name}.webp"
  local filter_complex=''
  local -a ffmpeg_args=()

  for input in "${inputs[@]}"; do
    ffmpeg_args+=(-i "$input")
  done

  for ((index = 0; index < ${#inputs[@]}; index += 1)); do
    filter_complex+="[${index}:v]${FILTER}[v${index}];"
  done

  for ((index = 0; index < ${#inputs[@]}; index += 1)); do
    filter_complex+="[v${index}]"
  done
  filter_complex+="vstack=inputs=${#inputs[@]}[out]"

  ffmpeg -hide_banner -loglevel error -y \
    "${ffmpeg_args[@]}" \
    -filter_complex "$filter_complex" \
    -map '[out]' \
    -frames:v 1 \
    "$temp_png"

  cwebp -quiet -q 62 -m 6 -metadata none "$temp_png" -o "$temp_webp"

  local probe
  probe=$(ffprobe -v error -select_streams v:0 \
    -show_entries stream=codec_name,width,height \
    -of csv=p=0:s=x "$temp_webp")
  [[ "$probe" == "webpx320x${expected_height}" ]] || \
    die "unexpected output stream for ${output_name}.webp: $probe"

  mv "$temp_webp" "$final_webp"
  printf '%s %s\n' "$final_webp" "$probe"
}

render_strip sequence-cup-tray 20260626_161027 15 6000
render_strip sequence-open-box 20260723_190045 14 5600
render_strip sequence-drawer-object 20260725_203953 15 6000
render_strip sequence-small-box 20260725_214552 15 6000

webp_count=$(find "$output_dir" -maxdepth 1 -type f -name '*.webp' | wc -l | tr -d '[:space:]')
[[ "$webp_count" == "4" ]] || die "expected exactly 4 WebP files in $output_dir, found $webp_count"
