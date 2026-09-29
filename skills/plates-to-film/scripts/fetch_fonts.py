#!/usr/bin/env python3
"""下载 Google Fonts 的 latin woff2 到 <项目>/assets/fonts，并把 @font-face 追加进 fonts.css。

技能已自带 13 款常用字体（assets/fonts）。只有新类型需要新字体时才用它。
用法：python3 fetch_fonts.py <项目目录> "Special+Elite" "Anton" "Rubik+Mono+One:wght@400"
字体本地化是为了渲染确定、离线。
"""
import re, sys, urllib.request
from pathlib import Path

OUT = Path(sys.argv[1]) / "assets" / "fonts"
OUT.mkdir(parents=True, exist_ok=True)
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36"
css_out = []
for fam in sys.argv[2:]:
    req = urllib.request.Request(f"https://fonts.googleapis.com/css2?family={fam}&display=block", headers={"User-Agent": UA})
    css = urllib.request.urlopen(req, timeout=30).read().decode()
    for block in re.findall(r"/\* latin \*/\s*@font-face \{(.*?)\}", css, re.S):
        name = re.search(r"font-family: '([^']+)'", block).group(1)
        style = re.search(r"font-style: (\w+)", block).group(1)
        weight = re.search(r"font-weight: (\d+)", block).group(1)
        url = re.search(r"url\((https://[^)]+\.woff2)\)", block).group(1)
        fname = f"{name.replace(' ', '')}-{weight}{'i' if style == 'italic' else ''}.woff2"
        (OUT / fname).write_bytes(urllib.request.urlopen(url, timeout=30).read())
        css_out.append(f"@font-face {{ font-family: '{name}'; font-style: {style}; font-weight: {weight}; font-display: block; src: url('{fname}') format('woff2'); }}")
        print("got", fname, "→ family:", name)
with open(OUT / "fonts.css", "a") as f:
    f.write("\n".join(css_out) + "\n")
