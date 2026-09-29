#!/usr/bin/env bash
# 把三个示例补齐成可以直接预览和渲染的项目。
# Fill the three examples with the shared song, plates, fonts and vendored libraries so they preview and render.
#   bash scripts/setup.sh
# 需要 / requires: ffmpeg, node 18+ (for `npx hyperframes`), python3
set -euo pipefail
R="$(cd "$(dirname "$0")/.." && pwd)"
SK="$R/skills/plates-to-film"
command -v ffmpeg >/dev/null || { echo "需要 ffmpeg / ffmpeg is required (brew install ffmpeg)"; exit 1; }

for ex in 2am-city night-plus case-0214; do
  E="$R/examples/$ex"; mkdir -p "$E/assets/audio"
  rm -rf "$E/assets/vendor" "$E/assets/fonts"
  cp -R "$SK/assets/vendor" "$SK/assets/fonts" "$E/assets/"
  cp "$R/media/song/2AM in Your Car.mp3" "$E/assets/audio/track.mp3"
  cp "$R/media/song/song-data.js" "$E/assets/song-data.js"
  cp "$SK/scripts/serve_nocache.py" "$E/serve_nocache.py"
  echo "✓ $ex: song, fonts, vendor"
done
cp "$R/media/song/lyrics.txt" "$R/examples/2am-city/assets/lyrics.txt"
ln -sfn ../assets "$R/examples/2am-city/cover/assets"

# the two plate films: images + 30fps frame sequences extracted from the clips
for ex in night-plus case-0214; do
  E="$R/examples/$ex"
  if [ ! -d "$E/assets/frames/V05" ]; then bash "$SK/scripts/ingest.sh" "$R/media/plates" "$E" >/dev/null; fi
  echo "✓ $ex: 16 plates, 5 clips → frames"
done
echo
echo "完成。预览 / Preview:"
echo "  cd examples/case-0214 && python3 serve_nocache.py 8726   →  http://127.0.0.1:8726/.hyperframes/preview.html"
echo "渲染 / Render:"
echo "  cd examples/case-0214 && npx --yes hyperframes@0.8.82 render -o renders/case-0214.mp4 -q delivery -f 30"
