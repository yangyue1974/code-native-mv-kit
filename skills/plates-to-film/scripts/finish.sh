#!/usr/bin/env bash
# 渲染后收尾：出压缩预览版（CRF 20，体积约原片 40%），从成片本身抽 10 帧拼联系表，核对时长、音轨和响度。
# 用法：finish.sh <原片.mp4>
set -euo pipefail
M="$1"; D="$(dirname "$M")"; B="$(basename "$M" .mp4)"
ffmpeg -y -loglevel error -i "$M" -c:v libx264 -crf 20 -preset slow -pix_fmt yuv420p -c:a aac -b:a 256k -movflags +faststart "$D/$B (预览版).mp4"
N=$(ffprobe -v error -count_packets -select_streams v -show_entries stream=nb_read_packets -of csv=p=0 "$M")
SEL=$(python3 -c "n=$N; print('+'.join(f'eq(n\\\\,{int(n*(k+0.5)/10)})' for k in range(10)))")
ffmpeg -y -loglevel error -i "$M" -vf "select='$SEL',scale=480:-1,tile=2x5" -frames:v 1 "$D/$B 联系表.jpg"
ffprobe -v error -show_entries stream=codec_type,duration -of csv=p=0 "$M"
ffmpeg -i "$M" -af volumedetect -f null - 2>&1 | grep -E "mean_volume|max_volume" || true
ls -la "$D"
