#!/usr/bin/env python3
"""Pack audiomap + per-frame bands + aligned lyrics into assets/song-data.js.

Everything the city engine reads at render time lives in this one global
(`window.SONG`), so compositions stay deterministic and fetch-free.
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
A = ROOT / "assets"

am = json.loads((A / "audiomap.json").read_text())
ad = json.loads((A / "audio-data.json").read_text())
ly = json.loads((A / "lyrics.json").read_text())

fps = ad["fps"]
frames = ad["frames"]


def frame_at(t):
    return frames[max(0, min(len(frames) - 1, int(round(t * fps))))]


# Sections as heard (ASR anchors + energy phases), used for camera + palette arcs.
SECTIONS = [
    ("intro", 0.0, 2.7),
    ("verse1", 2.7, 43.1),
    ("pre1", 43.1, 52.9),
    ("chorus1", 52.9, 82.5),
    ("verse2", 82.5, 103.5),
    ("pre2", 103.5, 114.0),
    ("chorus2", 114.0, 141.5),
    ("bridge", 141.5, 152.9),
    ("final", 152.9, 172.7),
    ("outro", 172.7, round(ad["duration"], 3)),
]

beats = am["grid"]["beats_sec"]
song = {
    "duration": round(ad["duration"], 3),
    "fps": fps,
    "bpm": am["tempo"]["bpm"],
    "beats": [round(b, 3) for b in beats],
    "downbeats": [round(b, 3) for b in am["grid"]["downbeats_sec"]],
    # 16-band spectrum snapshot at each beat: the building's DNA
    "beatBands": [[round(v, 3) for v in frame_at(b)["bands"]] for b in beats],
    # per-frame loudness for ambient breathing (quantised to keep the file small)
    "rms": [round(f["rms"], 3) for f in frames],
    "events": [
        {"t": round(e["t"], 3), "d": e["drum"][0], "g": e["grid"][0], "e": round(e["energy"], 2)}
        for e in am["events"]
    ],
    "sections": [{"id": s, "start": a, "end": b} for s, a, b in SECTIONS],
    "lyrics": [
        {
            "section": ln["section"],
            "text": ln["text"],
            "start": ln["start"],
            "end": ln["end"],
            "words": ln["words"],
            **({"estimated": True} if ln.get("estimated") else {}),
        }
        for ln in ly["lines"]
    ],
}

out = A / "song-data.js"
out.write_text("window.SONG = " + json.dumps(song, separators=(",", ":")) + ";\n")
print(f"wrote {out} ({out.stat().st_size // 1024} KB): {len(song['beats'])} beats, "
      f"{len(song['events'])} events, {len(song['lyrics'])} lyric lines")
