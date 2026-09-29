#!/usr/bin/env python3
"""从 song-data.js 里取出一个片段的精确时间（全部换算成“片内时间” v = 歌曲时间 − 起点）。

用法：
  segment_timing.py <song-data.js> --list                 # 列出段落和每句歌词，帮你挑 30 秒
  segment_timing.py <song-data.js> <起点秒> [时长=30]     # 打印这一段的拍点、强拍、逐词、底鼓、段落
剪辑时的对位优先级：钩子词的起点 > 强拍 > 底鼓 > 普通拍。
"""
import json, sys

s = open(sys.argv[1]).read()
S = json.loads(s[s.index("{"): s.rindex("}") + 1])
if sys.argv[2] == "--list":
    print(f"时长 {S['duration']:.1f}s  bpm {S.get('bpm')}")
    for sec in S["sections"]:
        print(f"[{sec['start']:7.2f} – {sec['end']:7.2f}] {sec['id']}")
    for l in S["lyrics"]:
        print(f"  {l['start']:7.2f}  {l['text']}")
    sys.exit()
t0 = float(sys.argv[2]); dur = float(sys.argv[3]) if len(sys.argv) > 3 else 30.0
inwin = lambda t: t0 - 0.5 <= t <= t0 + dur + 0.5
f = lambda xs: " ".join(f"{x - t0:.2f}" for x in xs if inwin(x))
print(f"片段：歌曲 {t0} → {t0 + dur}（片内 0 → {dur}）")
print("段落：", [(x["id"], round(x["start"] - t0, 2)) for x in S["sections"] if x["end"] > t0 and x["start"] < t0 + dur])
print("拍点：", f(S["beats"]))
print("强拍：", f(S["downbeats"]))
print("底鼓：", f([e["t"] for e in S["events"] if e["d"] == "k"]))
print("军鼓：", f([e["t"] for e in S["events"] if e["d"] == "s"]))
print("逐词：")
for l in S["lyrics"]:
    if inwin(l["start"]):
        print("  " + "  ".join(f"{w['text']}@{w['start'] - t0:.2f}" for w in l["words"]))
