#!/usr/bin/env python3
"""Align the supplied lyric sheet to sung word timestamps -> assets/lyrics.json.

Sources, merged into one timed word stream:
  - assets/transcript.json               Parakeet over the full mix (most of the song)
  - assets/transcript-whisper-72.json    whisper medium.en, 72-106s (verse 2, missed by Parakeet)
  - assets/transcript-parakeet-132.json  Parakeet, 132-150s vocal-band filtered (bridge onset)
  - assets/transcript-whisper-170.json   whisper medium.en, 170-194s (outro "Tonight"s)

The sheet's text always wins; transcript words only donate timing. Sheet words
with no matching transcript word are interpolated inside their gap. Lines the
ASR could not hear at all carry `"estimated": true`.
"""
# TEMPLATE from "2AM in Your Car": edit load_words() sources, the sung-repeat inserts,
# WINDOWS (one (start,end) per section instance) and ESTIMATES for each new song.


import json
import re
from difflib import SequenceMatcher
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
A = ROOT / "assets"


def norm(t: str) -> str:
    t = t.lower().replace("’", "'")
    t = re.sub(r"[^a-z0-9']", "", t)
    return {"am": "2am", "2": "2am", "a.m.": "2am", "i'm": "i"}.get(t, t)


def load_words(path: Path, offset: float = 0.0, lo: float = -1, hi: float = 1e9):
    d = json.loads(path.read_text())
    words = d if isinstance(d, list) else d["words"]
    out = []
    for w in words:
        txt = w["text"].strip()
        if not re.search(r"[A-Za-z0-9]", txt):  # drop ♪ / 🎵Music🎵 tokens
            continue
        s, e = w["start"] + offset, w["end"] + offset
        e = max(e, s + 0.15)  # ASR occasionally emits end < start
        if lo <= s < hi:
            out.append({"t": norm(txt), "start": s, "end": e})
    return out


stream = (
    load_words(A / "transcript.json", hi=72.9)
    + load_words(A / "transcript-whisper-72.json", 72, lo=72.9, hi=103.5)
    + load_words(A / "transcript.json", lo=103.5, hi=141.5)
    + load_words(A / "transcript-parakeet-132.json", 132, lo=141.5, hi=148.0)
    + load_words(A / "transcript.json", lo=148.0, hi=172.8)
    + load_words(A / "transcript-whisper-170.json", 170, lo=171.8)
)
stream.sort(key=lambda w: w["start"])
# "2 a.m." -> one token
merged = []
for w in stream:
    if merged and merged[-1]["t"] == "2am" and w["t"] == "2am":
        merged[-1]["end"] = w["end"]
        continue
    merged.append(w)
stream = merged

# ── the lyric sheet as SUNG (repeats the recording adds are inserted here) ──
sheet = [l.strip() for l in (A / "lyrics.txt").read_text().splitlines()]
lines, section = [], None
for l in sheet[1:]:
    if not l:
        continue
    m = re.match(r"\[(.+)\]", l)
    if m:
        section = m.group(1)
        continue
    lines.append({"section": section, "text": l})

# Sung extras heard in the recording: chorus endings repeat "Tonight".
def insert_after(pred, new_lines):
    for i, ln in enumerate(lines):
        if pred(i, ln):
            lines[i + 1 : i + 1] = new_lines
            return

tonight_idx = [i for i, ln in enumerate(lines) if ln["text"] == "Tonight"]
# chorus 1 & chorus 2: one "Tonight" on the sheet, two sung
for i in reversed(tonight_idx[:2]):
    lines.insert(i + 1, {"section": lines[i]["section"], "text": "Tonight"})
# outro: two on the sheet, three sung
lines.append({"section": "Final Chorus", "text": "Tonight"})

# Section instances -> time windows (from the audiomap's energy phases + ASR anchors).
# Aligning inside each window keeps repeated choruses from matching the wrong pass.
WINDOWS = [(0, 43.0), (43.0, 52.5), (52.5, 82.0), (82.0, 103.5), (103.5, 114.0),
           (114.0, 141.5), (141.5, 152.5), (152.5, 194.1)]
inst, prev = -1, None
for ln in lines:
    if ln["section"] != prev:
        inst += 1
        prev = ln["section"]
    ln["window"] = WINDOWS[inst]

tokens = []  # (line_idx, word_text)
for li, ln in enumerate(lines):
    for w in ln["text"].split():
        tokens.append((li, w))

timing = [None] * len(tokens)
for win in WINDOWS:
    idx = [k for k, (li, _) in enumerate(tokens) if lines[li]["window"] == win]
    sub = [w for w in stream if win[0] <= w["start"] < win[1]]
    a = [norm(tokens[k][1]) for k in idx]
    b = [w["t"] for w in sub]
    for blk in SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks():
        for q in range(blk.size):
            w = sub[blk.b + q]
            timing[idx[blk.a + q]] = (w["start"], w["end"])

# Estimated anchors for words no engine heard (see BRIEF notes).
# Chorus 2 "Tonight" x2: same spacing as chorus 1 (0.7s after the line, then +4.5s).
ESTIMATES = {}
t2 = [i for i, ln in enumerate(lines) if ln["text"] == "Tonight"][2:4]
for li, (s, e) in zip(t2, [(134.0, 136.2), (138.8, 141.0)]):
    ESTIMATES[li] = (s, e)
for ti, (li, _) in enumerate(tokens):
    if li in ESTIMATES and timing[ti] is None:
        timing[ti] = ESTIMATES[li]
        lines[li]["estimated"] = True

# Interpolate remaining gaps by character weight.
n = len(tokens)
i = 0
while i < n:
    if timing[i] is not None:
        i += 1
        continue
    j = i
    while j < n and timing[j] is None:
        j += 1
    win = lines[tokens[i][0]]["window"]
    left = timing[i - 1][1] if i > 0 else 0.0
    left = max(left, win[0]) if lines[tokens[i - 1][0]]["window"] != win else left
    right = timing[j][0] if j < n else left + 2.0
    right = min(right, win[1]) if j < n and lines[tokens[j][0]]["window"] != win else right
    span = max(right - left, 0.2 * (j - i))
    weights = [len(tokens[k][1]) + 1 for k in range(i, j)]
    tot = sum(weights)
    cur = left
    for k, wgt in zip(range(i, j), weights):
        d = span * wgt / tot
        timing[k] = (cur, cur + d * 0.9)
        cur += d
        lines[tokens[k][0]].setdefault("interpolated_words", 0)
        lines[tokens[k][0]]["interpolated_words"] += 1
    i = j

# Monotonic: a word never starts before the previous one ends.
for k in range(1, n):
    s0, e0 = timing[k]
    if s0 < timing[k - 1][1]:
        timing[k] = (timing[k - 1][1], max(e0, timing[k - 1][1] + 0.15))

for li, ln in enumerate(lines):
    ws = [(w, timing[k]) for k, (l2, w) in enumerate(tokens) if l2 == li]
    ln["words"] = [{"text": w, "start": round(s, 3), "end": round(e, 3)} for w, (s, e) in ws]
    ln.pop("window", None)
    ln["start"] = ln["words"][0]["start"]
    ln["end"] = ln["words"][-1]["end"]

out = {"source": "assets/lyrics.txt aligned to parakeet+whisper timestamps", "lines": lines}
(A / "lyrics.json").write_text(json.dumps(out, indent=1, ensure_ascii=False))
for ln in lines:
    flag = " ~EST" if ln.get("estimated") else (f" ~{ln['interpolated_words']}interp" if ln.get("interpolated_words") else "")
    print(f"{ln['start']:7.2f}-{ln['end']:7.2f} [{ln['section'][:12]:12}] {ln['text']}{flag}")
