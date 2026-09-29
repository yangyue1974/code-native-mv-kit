#!/usr/bin/env bash
# 新建一个“素材片”项目。
# 用法：new_project.sh <项目目录> <shot|desk> <歌曲mp3> <song-data.js>
#   shot = 镜头引擎（NIGHT+ 那种：整屏素材 + 推拉甩 + 转场 + 印刷涂层）
#   desk = 桌面引擎（案卷那种：Canvas2D 摆放照片/卡片 + 银盐涂层 + 手绘层）
set -euo pipefail
SK="$(cd "$(dirname "$0")/.." && pwd)"
P="$1"; KIND="$2"; MP3="$3"; SONG="$4"
mkdir -p "$P"/{assets/src,assets/frames,assets/audio,.hyperframes,renders,scripts}
cp -R "$SK/assets/vendor" "$P/assets/"
cp -R "$SK/assets/fonts" "$P/assets/"
cp "$SK/scripts/serve_nocache.py" "$P/scripts/"
cp "$MP3" "$P/assets/audio/track.mp3"
cp "$SONG" "$P/assets/song-data.js"
if [ "$KIND" = shot ]; then EX=night-plus; ENG=nightplus.js; else EX=case-0214; ENG=casefile.js; fi
cp "$SK/assets/examples/$EX/$ENG" "$P/assets/$ENG"
cp "$SK/assets/examples/$EX/index.html" "$P/index.html"
cp "$SK/assets/examples/$EX/preview.html" "$P/.hyperframes/preview.html"
echo "建好了：$P（引擎 $ENG，来自示例 $EX）"
echo "下一步：ingest.sh <素材目录> $P ；然后改 $ENG 顶部的 SONG_OFFSET / 镜头表，改 index.html 的 data-media-start"
