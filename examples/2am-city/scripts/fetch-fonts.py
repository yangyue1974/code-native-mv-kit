#!/usr/bin/env python3
"""Download latin woff2 cuts from Google Fonts into assets/fonts + write assets/fonts/fonts.css.

Local @font-face keeps renders deterministic and offline (no build-time fetch).
"""

import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "fonts"
OUT.mkdir(parents=True, exist_ok=True)
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36"

FAMILIES = [
    "Big+Shoulders+Display:wght@300;500;800",
    "Newsreader:ital,opsz,wght@0,6..72,300;1,6..72,300;1,6..72,500",
    "Doto:wght@400;900",
    "IBM+Plex+Mono:wght@300;500",
]

css_out = []
for fam in FAMILIES:
    req = urllib.request.Request(f"https://fonts.googleapis.com/css2?family={fam}&display=block", headers={"User-Agent": UA})
    css = urllib.request.urlopen(req, timeout=30).read().decode()
    for block in re.findall(r"/\* latin \*/\s*@font-face \{(.*?)\}", css, re.S):
        name = re.search(r"font-family: '([^']+)'", block).group(1)
        style = re.search(r"font-style: (\w+)", block).group(1)
        weight = re.search(r"font-weight: (\d+)", block).group(1)
        url = re.search(r"url\((https://[^)]+\.woff2)\)", block).group(1)
        fname = f"{name.replace(' ', '')}-{weight}{'i' if style == 'italic' else ''}.woff2"
        (OUT / fname).write_bytes(urllib.request.urlopen(url, timeout=30).read())
        css_out.append(
            f"@font-face {{ font-family: '{name}'; font-style: {style}; font-weight: {weight}; "
            f"font-display: block; src: url('{fname}') format('woff2'); }}"
        )
        print("got", fname)

(OUT / "fonts.css").write_text("\n".join(css_out) + "\n")
