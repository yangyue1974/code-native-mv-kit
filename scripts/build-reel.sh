#!/usr/bin/env bash
# 04 · 样片合集：开场 10s → NIGHT+ 30s → 转场 2s → 案卷 0214 30s = 72s
# Sample reel: opener → NIGHT+ → bridge → CASE FILE 0214.
#
# 开场和转场的画面取自两部成片本身，所以先要有两部成片：本脚本会在缺少时自动渲染它们。
# The opener and bridge are cut from the two finished films, so those are rendered first if missing.
#   bash scripts/setup.sh && bash scripts/build-reel.sh
set -euo pipefail
R="$(cd "$(dirname "$0")/.." && pwd)"; X="$R/examples"; E="$X/reel"; SK="$R/skills/plates-to-film"
HF="npx --yes hyperframes@0.8.82"
[ -d "$X/night-plus/assets/frames/V05" ] || { echo "先运行 / run first: bash scripts/setup.sh"; exit 1; }

# 1. the two films
NP="$X/night-plus/renders/night-plus.mp4"; CF="$X/case-0214/renders/case-0214.mp4"
[ -f "$NP" ] || (cd "$X/night-plus" && $HF render -o renders/night-plus.mp4 -q delivery -f 30 --workers 4)
[ -f "$CF" ] || (cd "$X/case-0214" && $HF render -o renders/case-0214.mp4 -q delivery -f 30 --workers 4)

# 2. assets for the reel: song, fonts, vendor, raw plates + clip frames, frames lifted from the films
mkdir -p "$E/assets/audio" "$E/assets/frames/NP" "$E/assets/frames/CF"
rm -rf "$E/assets/vendor" "$E/assets/fonts"; cp -R "$SK/assets/vendor" "$SK/assets/fonts" "$E/assets/"; cp "$E/fonts/"*.woff2 "$E/assets/fonts/"
cp "$R/media/song/2AM in Your Car.mp3" "$E/assets/audio/track.mp3"; cp "$R/media/song/song-data.js" "$E/assets/"
rm -rf "$E/assets/src"; cp -R "$X/night-plus/assets/src" "$E/assets/src"
for v in V01 V02 V03 V04 V05; do rm -rf "$E/assets/frames/$v"; cp -R "$X/night-plus/assets/frames/$v" "$E/assets/frames/$v"; done
cp "$SK/scripts/serve_nocache.py" "$E/serve_nocache.py"
ex() { # film tag start end → frames named by frame index (t*30)
  local f0 n; f0=$(python3 -c "print(round($3*30))"); n=$(python3 -c "print(round(($4-$3)*30)+1)")
  ffmpeg -loglevel error -y -ss "$(python3 -c "print($f0/30)")" -i "$1" -frames:v "$n" -start_number "$f0" -q:v 2 "$E/assets/frames/$2/%04d.jpg"; }
for r in "3.5 7.0" "9.1 9.44" "12.3 12.64" "14.3 14.64" "16.9 17.24" "4.5 5.0"; do ex "$NP" NP $r; done
for r in "4.1 7.6" "0.25 0.6" "9.0 9.34" "13.0 13.34" "17.4 17.74" "4.5 5.0"; do ex "$CF" CF $r; done
echo "✓ reel assets"

# 3. covers (3:4, 9:16) use one frame of her from each film
mkdir -p "$E/covers/img" "$E/covers/fonts"; rm -rf "$E/covers/vendor"; cp -R "$SK/assets/vendor" "$E/covers/vendor"
cp "$SK/assets/fonts/"{BigShouldersDisplay-800,IBMPlexMono-500,Michroma-400,CourierPrime-700,PermanentMarker-400}.woff2 "$E/fonts/"NotoSansSC-*-cover.woff2 "$E/covers/fonts/"
ffmpeg -loglevel error -y -ss 4.9 -i "$NP" -frames:v 1 "$E/covers/img/np_4.9.png"; ffmpeg -loglevel error -y -ss 4.9 -i "$CF" -frames:v 1 "$E/covers/img/cf_4.9.png"

# 4. render opener, bridge, covers; then join the four parts (no gaps: the music runs straight through)
mkdir -p "$E/renders"
(cd "$E/intro" && $HF render -o "$E/renders/intro-10s.mp4" -q delivery -f 30 --workers 4)
(cd "$E/bridge" && $HF render -o "$E/renders/bridge-2s.mp4" -q delivery -f 30 --workers 4)
for d in c34 c916; do (cd "$E/covers/$d" && $HF snapshot --at 0.5 --no-end --describe false -o "$E/renders/cover-$d" >/dev/null); done
ffmpeg -loglevel error -y -i "$E/renders/intro-10s.mp4" -i "$NP" -i "$E/renders/bridge-2s.mp4" -i "$CF" \
  -filter_complex "[0:v][0:a][1:v][1:a][2:v][2:a][3:v][3:a]concat=n=4:v=1:a=1[v][a]" -map "[v]" -map "[a]" \
  -c:v libx264 -crf 17 -preset slow -pix_fmt yuv420p -r 30 -c:a aac -b:a 320k -ar 48000 -movflags +faststart "$E/renders/sample-reel-72s.mp4"
echo "✓ $E/renders/sample-reel-72s.mp4"
