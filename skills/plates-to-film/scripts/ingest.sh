#!/usr/bin/env bash
# 把用户的素材收进项目，并做好引擎要用的东西。
# 用法：ingest.sh <素材目录> <项目目录>
#  - 图片 P01.png… → assets/src/（按文件名排序；非 Pxx 命名的会按顺序改名为 P01…，并打印对照表）
#  - 视频 V01.mp4… → assets/src/，并按 30fps、1280x720 抽帧到 assets/frames/Vxx/001.jpg…
#    （WebGL 里没法可靠逐帧采样 <video>，所以一律抽帧、按需预载）
#  - 输出 assets/frames/manifest.json：每段视频的帧数（引擎里 frameOf 的上限要按它改）
#  - 输出 _review/plates.jpg 和 _review/Vxx.jpg：素材总览，给自己看构图、找屏幕和留白位置
set -euo pipefail
IFS=$'\n'   # 文件名里可能有空格
SRC="$1"; P="$2"; mkdir -p "$P/assets/src" "$P/assets/frames" "$P/_review"
i=0
for f in $(ls "$SRC" | grep -iE '\.(png|jpe?g|webp)$' | sort); do
  i=$((i+1)); n=$(printf "P%02d" $i); ext="${f##*.}"
  if [ "$ext" = png ]; then cp "$SRC/$f" "$P/assets/src/$n.png"; else ffmpeg -loglevel error -y -i "$SRC/$f" "$P/assets/src/$n.png"; fi
  echo "$f → $n.png"
done
j=0; echo "{" > "$P/assets/frames/manifest.json"; first=1
for f in $(ls "$SRC" | grep -iE '\.(mp4|mov|webm)$' | sort); do
  j=$((j+1)); n=$(printf "V%02d" $j)
  cp "$SRC/$f" "$P/assets/src/$n.mp4"; mkdir -p "$P/assets/frames/$n"
  ffmpeg -loglevel error -y -i "$SRC/$f" -vf "fps=30,scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720" -q:v 3 "$P/assets/frames/$n/%03d.jpg"
  c=$(ls "$P/assets/frames/$n" | wc -l | tr -d ' ')
  [ $first = 1 ] || echo "," >> "$P/assets/frames/manifest.json"; first=0
  printf '  "%s": %s' "$n" "$c" >> "$P/assets/frames/manifest.json"
  ffmpeg -loglevel error -y -i "$SRC/$f" -vf "fps=1.2,scale=384:-1,tile=6x1" -frames:v 1 "$P/_review/$n.jpg"
  echo "$f → $n.mp4（$c 帧）  $(ffprobe -v error -select_streams v -show_entries stream=width,height,r_frame_rate -of csv=p=0 "$SRC/$f")"
done
echo "" >> "$P/assets/frames/manifest.json"; echo "}" >> "$P/assets/frames/manifest.json"
[ $i -gt 0 ] && ffmpeg -loglevel error -y -pattern_type glob -i "$P/assets/src/P*.png" -vf "scale=480:-1,tile=4x$(( (i+3)/4 ))" -frames:v 1 "$P/_review/plates.jpg"
echo "图片 $i 张，视频 $j 段。总览：$P/_review/"
