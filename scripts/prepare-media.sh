#!/usr/bin/env bash

set -euo pipefail

die() {
  printf 'prepare-media: %s\n' "$*" >&2
  exit 1
}

require_tool() {
  local tool_name="$1"
  local resolved_path

  resolved_path="$(command -v "$tool_name" 2>/dev/null || true)"
  [[ -n "$resolved_path" ]] || die "required tool '$tool_name' was not found on PATH"
  printf '%s' "$resolved_path"
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

[[ "$#" -le 1 ]] || die 'usage: scripts/prepare-media.sh [source-root]'
SOURCE_ROOT_INPUT="${1:-$REPO_ROOT}"
[[ -d "$SOURCE_ROOT_INPUT" ]] || die "source root does not exist: $SOURCE_ROOT_INPUT"
SOURCE_ROOT="$(cd "$SOURCE_ROOT_INPUT" && pwd)"

# Tool resolution is intentionally explicit so a missing prerequisite names the
# executable to install: ffmpeg, ffprobe, gs (Ghostscript), or cwebp (libwebp).
FFMPEG="$(require_tool ffmpeg)"
FFPROBE="$(require_tool ffprobe)"
GS="$(require_tool gs)"
CWEBP="$(require_tool cwebp)"

VIDEO_DIR="$REPO_ROOT/docs/assets/videos"
POSTER_DIR="$REPO_ROOT/docs/assets/images/posters"
IMAGE_DIR="$REPO_ROOT/docs/assets/images"

SOURCE_FILES=(
  'A_Highlight_Varied_pose_experiment/Pour_Water_Highlight.mp4'
  'Four_main_task/Hand_Over.mp4'
  'Four_main_task/Open_Box.mp4'
  'Four_main_task/Pour_Water.mp4'
  'Four_main_task/open_drawer_compressed.mp4'
  'Cross_object_experiment/Open_Box_01.mp4'
  'Cross_object_experiment/Open_Box_02.mp4'
  'Cross_object_experiment/Open_Box_03.mp4'
  'Cross_object_experiment/Open_Box_04.mp4'
  'Cross_object_experiment/Open_Box_05.mp4'
  'Cross_object_experiment/open_drawer.mp4'
  'Varied_pose_experiment/Pour_Water_01.mp4'
  'Varied_pose_experiment/Pour_Water_02.mp4'
  'Varied_pose_experiment/open_drawer.mp4'
  'Squat_and_manipulation_experiment/Pour_Water_01.mp4'
  'Squat_and_manipulation_experiment/Pour_Water_02.mp4'
)

SLUGS=(
  'highlight-pour-water'
  'main-hand-over'
  'main-open-box'
  'main-pour-water'
  'main-open-drawer'
  'cross-object-open-box-01'
  'cross-object-open-box-02'
  'cross-object-open-box-03'
  'cross-object-open-box-04'
  'cross-object-open-box-05'
  'cross-object-open-drawer'
  'varied-pose-pour-water-01'
  'varied-pose-pour-water-02'
  'varied-pose-open-drawer'
  'squat-pour-water-01'
  'squat-pour-water-02'
)

POSTER_TIMES=(
  '18.32'
  '3.50'
  '4.68'
  '4.37'
  '4.96'
  '3.33'
  '3.38'
  '3.55'
  '4.00'
  '3.48'
  '7.95'
  '3.33'
  '3.02'
  '3.12'
  '4.37'
  '2.87'
)

EXPECTED_VIDEO_COUNT=16
[[ "${#SOURCE_FILES[@]}" -eq "$EXPECTED_VIDEO_COUNT" ]] || die 'internal source mapping count is not 16'
[[ "${#SLUGS[@]}" -eq "$EXPECTED_VIDEO_COUNT" ]] || die 'internal slug mapping count is not 16'
[[ "${#POSTER_TIMES[@]}" -eq "$EXPECTED_VIDEO_COUNT" ]] || die 'internal poster timestamp count is not 16'

PDF_SOURCE="$SOURCE_ROOT/RoboReact_Agentic_Skill_.pdf"
[[ -f "$PDF_SOURCE" ]] || die "required input is missing: $PDF_SOURCE"

for relative_path in "${SOURCE_FILES[@]}"; do
  input_path="$SOURCE_ROOT/$relative_path"
  [[ -f "$input_path" ]] || die "required input is missing: $input_path"
done

mkdir -p "$VIDEO_DIR" "$POSTER_DIR" "$IMAGE_DIR"

TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/roboreact-media.XXXXXX")"
cleanup() {
  rm -rf -- "$TEMP_DIR"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

printf 'Preparing %d videos from %s\n' "$EXPECTED_VIDEO_COUNT" "$SOURCE_ROOT"

for ((index = 0; index < EXPECTED_VIDEO_COUNT; index += 1)); do
  source_path="$SOURCE_ROOT/${SOURCE_FILES[$index]}"
  slug="${SLUGS[$index]}"
  poster_time="${POSTER_TIMES[$index]}"
  video_output="$VIDEO_DIR/$slug.mp4"
  poster_frame="$TEMP_DIR/$slug.png"
  poster_output="$POSTER_DIR/$slug.webp"

  printf '  [%02d/%02d] %s\n' "$((index + 1))" "$EXPECTED_VIDEO_COUNT" "$slug"

  "$FFMPEG" -nostdin -hide_banner -loglevel error -y \
    -i "$source_path" \
    -map 0:v:0 -an -sn -dn \
    -map_metadata -1 \
    -c:v libx264 -profile:v high -preset medium -crf 22 \
    -pix_fmt yuv420p -movflags +faststart \
    "$video_output"

  "$FFMPEG" -nostdin -hide_banner -loglevel error -y \
    -i "$source_path" -ss "$poster_time" \
    -map 0:v:0 -frames:v 1 -an -sn -dn \
    "$poster_frame"

  "$CWEBP" -quiet -q 84 -m 6 "$poster_frame" -o "$poster_output"
done

printf 'Rendering and cropping paper figures\n'

"$GS" -q -dSAFER -dBATCH -dNOPAUSE \
  -sDEVICE=pngalpha -r288 \
  -dFirstPage=1 -dLastPage=1 \
  -sOutputFile="$TEMP_DIR/page-1.png" \
  "$PDF_SOURCE"

"$GS" -q -dSAFER -dBATCH -dNOPAUSE \
  -sDEVICE=pngalpha -r288 \
  -dFirstPage=3 -dLastPage=3 \
  -sOutputFile="$TEMP_DIR/page-3.png" \
  "$PDF_SOURCE"

"$FFMPEG" -nostdin -hide_banner -loglevel error -y \
  -i "$TEMP_DIR/page-1.png" \
  -vf 'crop=1040:590:1240:830' -frames:v 1 \
  "$TEMP_DIR/teaser-crop.png"

"$FFMPEG" -nostdin -hide_banner -loglevel error -y \
  -i "$TEMP_DIR/page-3.png" \
  -vf 'crop=2045:975:200:170' -frames:v 1 \
  "$TEMP_DIR/pipeline-crop.png"

"$CWEBP" -quiet -lossless -z 9 "$TEMP_DIR/teaser-crop.png" -o "$IMAGE_DIR/teaser.webp"
"$CWEBP" -quiet -lossless -z 9 "$TEMP_DIR/pipeline-crop.png" -o "$IMAGE_DIR/pipeline.webp"

mp4_count="$(find "$VIDEO_DIR" -maxdepth 1 -type f -name '*.mp4' -print | wc -l | tr -d '[:space:]')"
poster_count="$(find "$POSTER_DIR" -maxdepth 1 -type f -name '*.webp' -print | wc -l | tr -d '[:space:]')"

[[ "$mp4_count" -eq "$EXPECTED_VIDEO_COUNT" ]] || die "expected exactly 16 MP4 outputs, found $mp4_count in $VIDEO_DIR"
[[ "$poster_count" -eq "$EXPECTED_VIDEO_COUNT" ]] || die "expected exactly 16 poster WebPs, found $poster_count in $POSTER_DIR"

for slug in "${SLUGS[@]}"; do
  video_output="$VIDEO_DIR/$slug.mp4"
  poster_output="$POSTER_DIR/$slug.webp"

  [[ -s "$video_output" ]] || die "video output is missing or empty: $video_output"
  [[ -s "$poster_output" ]] || die "poster output is missing or empty: $poster_output"

  codec_name="$("$FFPROBE" -v error -select_streams v:0 -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 "$video_output")"
  pixel_format="$("$FFPROBE" -v error -select_streams v:0 -show_entries stream=pix_fmt -of default=noprint_wrappers=1:nokey=1 "$video_output")"
  profile="$("$FFPROBE" -v error -select_streams v:0 -show_entries stream=profile -of default=noprint_wrappers=1:nokey=1 "$video_output")"

  [[ "$codec_name" == 'h264' ]] || die "$slug has codec '$codec_name', expected h264"
  [[ "$pixel_format" == 'yuv420p' ]] || die "$slug has pixel format '$pixel_format', expected yuv420p"
  [[ "$profile" == 'High' ]] || die "$slug has profile '$profile', expected High"
done

[[ -s "$IMAGE_DIR/teaser.webp" ]] || die 'teaser figure is missing or empty'
[[ -s "$IMAGE_DIR/pipeline.webp" ]] || die 'pipeline figure is missing or empty'

printf 'Media preparation complete: %d H.264 videos, %d posters, and 2 paper figures.\n' \
  "$mp4_count" "$poster_count"
