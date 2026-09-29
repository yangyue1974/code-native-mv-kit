#!/usr/bin/env python3
"""plates — 素材自动化流水线：image2（OpenRouter）画图，可灵（kling CLI）出视频。

一个项目 = 一个目录，里面一份 shots.toml（镜头表）。流水线把每个镜头变成候选 → 联系表 → 选定 → 成品，
成品按 P01.png / V01.mp4 命名放进 out 目录，直接交给 plates-to-film 的 ingest.sh。

  plates init                      在当前目录生成 shots.toml 模板
  plates plan  [镜头…]             列出将要生成什么、预计花多少（不花钱）
  plates images [镜头…] --yes      生成图片候选（image2）。不加 --yes 只预览，不花钱
  plates videos [镜头…] --yes      生成视频候选（可灵，首帧 = 选定的图）。不加 --yes 只预览
  plates sheet [镜头…]             重新拼联系表 review/<镜头>.jpg
  plates pick P03=2 V02=1 …        选定候选，复制到 out/
  plates status                    每个镜头的进度和总花费
  plates ledger                    花费明细
  plates setkey                    把剪贴板里的 OpenRouter key 存进私密文件（不显示内容），然后清空剪贴板

花钱的命令一律要 --yes；提交后的任务不能取消。OpenRouter key 从环境变量 OPENROUTER_API_KEY 或
~/.config/plate-pipeline/openrouter.key 读取，绝不打印。
"""
import argparse, base64, concurrent.futures as cf, io, json, os, shutil, subprocess, sys, time, tomllib, urllib.error, urllib.request
from datetime import datetime
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path.cwd()
KEY_FILE = Path.home() / ".config/plate-pipeline/openrouter.key"
OR_URL = "https://openrouter.ai/api/v1/images"
KLING = ["kling"]
KTAGS = ["--skill-name", "kling-cli", "--skill-version", "0.2.0"]
FONT = "/System/Library/Fonts/Hiragino Sans GB.ttc"

TEMPLATE = '''# 镜头表。image 镜头用 image2 生成，video 镜头用可灵以某张选定的图为首帧生成。
[project]
name = "新项目"
out = "sucai"            # 成品目录：P01.png / V01.mp4，交给 ingest.sh
# 每条图片提示词前面都会自动加上 style；character = true 的镜头再加上 character 和定妆照参考图
style = """照片级写实的高端广告大片，35毫米变形宽银幕镜头拍摄，16:9，画面里不要任何文字、标志和水印。"""
character = """女主角：……（年龄、发型、饰品、服装、妆容、神情，每次一字不差）"""
character_refs = []      # 定妆照路径，或已选定的镜头 id（如 "P03"）

[defaults.image]
model = "openai/gpt-image-2"
aspect = "16:9"
quality = "medium"       # low | medium | high
n = 3

[defaults.video]
model = "kling-video-v4_0_flash"
duration = 5
resolution = "720p"
n = 1

[[shot]]
id = "P01"
kind = "image"
note = "对应歌词 / 用途"
prompt = """……"""

[[shot]]
id = "V01"
kind = "video"
from = "P01"             # 首帧：P01 的选定图
prompt = """只写运动和机位，一句一件事。"""
'''


# ── project ──────────────────────────────────────────────────────────────
def load():
    f = ROOT / "shots.toml"
    if not f.exists():
        sys.exit("当前目录没有 shots.toml。先运行：plates init")
    cfg = tomllib.loads(f.read_text())
    cfg.setdefault("defaults", {})
    shots = cfg.get("shot", [])
    ids = [s["id"] for s in shots]
    if len(ids) != len(set(ids)):
        sys.exit("shots.toml 里有重复的镜头 id")
    return cfg, {s["id"]: s for s in shots}


def out_dir(cfg):
    d = ROOT / cfg["project"].get("out", "sucai"); d.mkdir(exist_ok=True); return d


def cand_dir(sid):
    d = ROOT / "candidates" / sid; d.mkdir(parents=True, exist_ok=True); return d


def candidates(sid):
    d = ROOT / "candidates" / sid
    return sorted(p for p in d.glob(f"{sid}_*") if p.suffix in (".png", ".jpg", ".mp4") and ".strip" not in p.name) if d.exists() else []


def picked(cfg, sid):
    for ext in (".png", ".mp4"):
        p = out_dir(cfg) / f"{sid}{ext}"
        if p.exists():
            return p
    return None


def ledger_add(**rec):
    rec["time"] = datetime.now().isoformat(timespec="seconds")
    with open(ROOT / "ledger.jsonl", "a") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")


def ledger():
    f = ROOT / "ledger.jsonl"
    return [json.loads(l) for l in f.read_text().splitlines() if l.strip()] if f.exists() else []


def image_opts(cfg, s):
    d = {"model": "openai/gpt-image-2", "aspect": "16:9", "quality": "medium", "n": 3}
    d.update(cfg["defaults"].get("image", {})); d.update({k: s[k] for k in ("model", "aspect", "quality", "n") if k in s}); return d


def video_opts(cfg, s):
    d = {"model": "kling-video-v4_0_flash", "duration": 5, "resolution": "720p", "n": 1}
    d.update(cfg["defaults"].get("video", {})); d.update({k: s[k] for k in ("model", "duration", "resolution", "n", "aspect") if k in s}); return d


def pick_targets(shots, want, kind):
    sel = [shots[i] for i in want] if want else [s for s in shots.values()]
    bad = [i for i in want if i not in shots]
    if bad:
        sys.exit(f"没有这些镜头：{bad}")
    return [s for s in sel if s.get("kind", "image") == kind]


# ── cost estimates (from what this project has actually spent) ───────────
def est_image(cfg, o):
    recs = [r for r in ledger() if r.get("engine") == "openrouter" and r.get("model") == o["model"] and r.get("quality") == o["quality"] and r.get("images")]
    if not recs:
        return None
    return sum(r["cost"] for r in recs) / sum(r["images"] for r in recs)


def est_video(cfg, o):
    recs = [r for r in ledger() if r.get("engine") == "kling" and r.get("model") == o["model"] and r.get("resolution") == o["resolution"] and r.get("seconds")]
    if not recs:
        return 6.0 if (o["model"], o["resolution"]) == ("kling-video-v4_0_flash", "720p") else None   # measured 2026-09-29
    return sum(r["credits"] for r in recs) / sum(r["seconds"] for r in recs)


# ── image2 via OpenRouter ────────────────────────────────────────────────
def or_key():
    k = os.environ.get("OPENROUTER_API_KEY") or (KEY_FILE.read_text().strip() if KEY_FILE.exists() else "")
    if not k:
        sys.exit(f"找不到 OpenRouter key：请设置 OPENROUTER_API_KEY，或写入 {KEY_FILE}")
    return k


def ref_url(cfg, ref):
    """a reference is a shot id (its picked image) or a file path; sent as a downsized JPEG data URL"""
    p = picked(cfg, ref) if not Path(ref).suffix else (ROOT / ref)
    if not p or not Path(p).exists():
        sys.exit(f"参考图不存在：{ref}（镜头 id 需要先 pick）")
    im = Image.open(p).convert("RGB"); im.thumbnail((1536, 1536))
    b = io.BytesIO(); im.save(b, "JPEG", quality=90)
    return "data:image/jpeg;base64," + base64.b64encode(b.getvalue()).decode()


def build_prompt(cfg, s):
    parts = [cfg["project"].get("style", "").strip()]
    if s.get("character"):
        parts.append(cfg["project"].get("character", "").strip())
    parts.append(s["prompt"].strip())
    return "\n".join(p for p in parts if p)


def refs_for(cfg, s):
    refs = list(s.get("refs", []))
    if s.get("character"):
        refs = list(cfg["project"].get("character_refs", [])) + refs
    return refs


def gen_image(cfg, s, key):
    o = image_opts(cfg, s)
    body = {"model": o["model"], "prompt": build_prompt(cfg, s), "aspect_ratio": o["aspect"], "quality": o["quality"], "n": o["n"]}
    refs = refs_for(cfg, s)
    if refs:
        body["input_references"] = [{"type": "image_url", "image_url": {"url": ref_url(cfg, r)}} for r in refs]
    req = urllib.request.Request(OR_URL, data=json.dumps(body).encode(), method="POST", headers={
        "Authorization": f"Bearer {key}", "Content-Type": "application/json", "X-Title": "plate-pipeline"})
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=600) as r:
            res = json.loads(r.read())
    except urllib.error.HTTPError as e:
        return s["id"], f"失败 HTTP {e.code}：{e.read().decode(errors='replace')[:300]}"
    except Exception as e:
        return s["id"], f"失败：{e}"
    data = res.get("data", [])
    batch = 1 + max([int(p.stem.split("_")[1]) for p in candidates(s["id"])] or [0])
    for k, item in enumerate(data, 1):
        ext = ".jpg" if "jpeg" in item.get("media_type", "") else ".png"
        (cand_dir(s["id"]) / f"{s['id']}_{batch}_{k}{ext}").write_bytes(base64.b64decode(item["b64_json"]))
    cost = (res.get("usage") or {}).get("cost", 0) or 0
    ledger_add(engine="openrouter", model=o["model"], quality=o["quality"], shot=s["id"], images=len(data), cost=cost, refs=len(refs))
    make_sheet(s["id"])
    return s["id"], f"{len(data)} 张，${cost:.3f}，{time.time() - t0:.0f} 秒"


# ── Kling video via the official CLI ─────────────────────────────────────
def kling(args, timeout=900):
    r = subprocess.run(KLING + args + KTAGS, capture_output=True, text=True, timeout=timeout)
    try:
        return json.loads(r.stdout)
    except json.JSONDecodeError:
        return {"ok": False, "body": (r.stderr or r.stdout)[-400:]}


def gen_video(cfg, s):
    o = video_opts(cfg, s)
    first = s.get("image") or s.get("from")
    img = picked(cfg, first) if first and not Path(first).suffix else (ROOT / first if first else None)
    if not img or not Path(img).exists():
        return s["id"], f"没有首帧：{first}（先 pick 这张图）"
    args = ["image_to_video", "--model", o["model"], "--image", str(img), "--duration", str(o["duration"]), "--resolution", o["resolution"]]
    if o["n"] > 1:
        args += ["--imageCount", str(o["n"])]
    if s.get("tail"):
        tail = picked(cfg, s["tail"]) if not Path(s["tail"]).suffix else ROOT / s["tail"]
        args = [a for a in args if a not in ("--image", str(img))] + ["--input", f"first_image={img}", "--input", f"tail_image={tail}"]
    args += ["--rationale", f"plate-pipeline shot {s['id']}", s["prompt"].strip()]
    sub = kling(args)
    b = sub.get("body", {}) if isinstance(sub.get("body"), dict) else {}
    gid = b.get("generationId") or b.get("generation_id")
    if not sub.get("ok") or not gid:
        return s["id"], f"提交失败：{json.dumps(sub.get('body'), ensure_ascii=False)[:300]}"
    credits = b.get("creditsConsumed") or 0
    ledger_add(engine="kling", model=o["model"], resolution=o["resolution"], shot=s["id"], seconds=o["duration"] * o["n"], credits=credits, generationId=gid)
    res = kling(["query_tasks", gid, "--poll", "900"], timeout=960)
    rb = res.get("body", {})
    r = rb["generations"][0]["result"] if "generations" in rb else rb
    status = (r.get("status") or "").upper()
    works = [w for w in r.get("works", []) if (w.get("urlWithoutWatermark") or w.get("url"))]
    if status not in ("COMPLETED", "SUCCEED", "PARTIAL_COMPLETED") or not works:
        return s["id"], f"未完成（{status or '超时'}），任务 {gid[:12]}… 已扣 {credits} 灵感值；可稍后用 kling query_tasks 取回"
    batch = 1 + max([int(p.stem.split("_")[1]) for p in candidates(s["id"])] or [0])
    for k, w in enumerate(works, 1):
        urllib.request.urlretrieve(w.get("urlWithoutWatermark") or w["url"], cand_dir(s["id"]) / f"{s['id']}_{batch}_{k}.mp4")
    make_sheet(s["id"])
    return s["id"], f"{len(works)} 段，{credits} 灵感值"


# ── review ───────────────────────────────────────────────────────────────
def thumb(p):
    if p.suffix == ".mp4":   # a strip of 4 frames stands in for a clip
        tmp = p.with_suffix(".strip.jpg")
        if not tmp.exists():
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(p), "-vf", "fps=1,scale=480:-1,tile=4x1", "-frames:v", "1", str(tmp)])
        return Image.open(tmp)
    return Image.open(p)


def make_sheet(sid):
    cs = [c for c in candidates(sid)]
    if not cs:
        return None
    video = cs[0].suffix == ".mp4"
    tw = 1920 if video else 800
    ims = [thumb(c).convert("RGB") for c in cs]
    ims = [im.resize((tw, int(tw * im.height / im.width))) for im in ims]
    cols = 1 if video else 3
    th = max(im.height for im in ims)
    rows = (len(ims) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * tw, rows * (th + 8)), "black")
    dr = ImageDraw.Draw(sheet); font = ImageFont.truetype(FONT, 40)
    for i, (im, c) in enumerate(zip(ims, cs)):
        x, y = (i % cols) * tw, (i // cols) * (th + 8)
        sheet.paste(im, (x, y))
        dr.rectangle([x, y, x + 150, y + 56], fill=(0, 0, 0)); dr.text((x + 12, y + 6), f"{sid}={i + 1}", font=font, fill=(255, 255, 0))
    (ROOT / "review").mkdir(exist_ok=True)
    out = ROOT / "review" / f"{sid}.jpg"; sheet.save(out, quality=85)
    return out


# ── commands ─────────────────────────────────────────────────────────────
def cmd_init(a):
    f = ROOT / "shots.toml"
    if f.exists():
        sys.exit("shots.toml 已存在，不覆盖")
    f.write_text(TEMPLATE); print("已生成 shots.toml")


def cmd_plan(a):
    cfg, shots = load()
    tot_usd, tot_cr, unknown = 0.0, 0.0, []
    print(f"{'镜头':6} {'类型':4} {'模型':26} {'数量':>4} {'预计':>12}  说明")
    for s in pick_targets(shots, a.ids, "image"):
        o = image_opts(cfg, s); e = est_image(cfg, o)
        cost = f"${e * o['n']:.2f}" if e is not None else "首次实测"
        tot_usd += (e or 0) * o["n"]; unknown += [s["id"]] if e is None else []
        refs = refs_for(cfg, s)
        print(f"{s['id']:6} 图片 {o['model']:26} {o['n']:>4} {cost:>12}  {o['quality']} {o['aspect']}{'  参考图×' + str(len(refs)) if refs else ''}  {s.get('note', '')}")
    for s in pick_targets(shots, a.ids, "video"):
        o = video_opts(cfg, s); e = est_video(cfg, o); sec = o["duration"] * o["n"]
        cost = f"{e * sec:.0f} 灵感值" if e is not None else "首次实测"
        tot_cr += (e or 0) * sec; unknown += [s["id"]] if e is None else []
        print(f"{s['id']:6} 视频 {o['model']:26} {o['n']:>4} {cost:>12}  {o['duration']}s {o['resolution']} 首帧={s.get('from') or s.get('image')}  {s.get('note', '')}")
    print(f"\n合计约：图片 ${tot_usd:.2f}，视频 {tot_cr:.0f} 灵感值" + (f"（{', '.join(unknown)} 没有历史单价，首次运行后才知道）" if unknown else ""))


def run_parallel(fn, items, workers=3):
    with cf.ThreadPoolExecutor(workers) as ex:
        for sid, msg in ex.map(fn, items):
            print(f"  {sid}: {msg}", flush=True)


def cmd_images(a):
    cfg, shots = load()
    todo = pick_targets(shots, a.ids, "image")
    if not a.ids:
        todo = [s for s in todo if not candidates(s["id"])]
    if not todo:
        return print("没有要生成的图片镜头（已有候选的镜头需点名重做，如：plates images P03 --yes）")
    if not a.yes:
        a.ids = [s["id"] for s in todo]; cmd_plan(a); return print("\n预览模式，没有花钱。确认后加 --yes 执行。")
    key = or_key()
    print(f"生成 {len(todo)} 个图片镜头…", flush=True)
    run_parallel(lambda s: gen_image(cfg, s, key), todo)


def cmd_videos(a):
    cfg, shots = load()
    todo = pick_targets(shots, a.ids, "video")
    if not a.ids:
        todo = [s for s in todo if not candidates(s["id"])]
    if not todo:
        return print("没有要生成的视频镜头")
    if not a.yes:
        a.ids = [s["id"] for s in todo]; cmd_plan(a); return print("\n预览模式，没有花钱。确认后加 --yes 执行（提交后不能取消）。")
    print(f"生成 {len(todo)} 个视频镜头（每个 2–8 分钟）…", flush=True)
    run_parallel(lambda s: gen_video(cfg, s), todo)


def cmd_sheet(a):
    cfg, shots = load()
    for sid in a.ids or list(shots):
        p = make_sheet(sid)
        if p:
            print(p.relative_to(ROOT))


def cmd_pick(a):
    cfg, shots = load()
    for item in a.picks:
        sid, _, k = item.partition("=")
        cs = candidates(sid)
        if sid not in shots or not k.isdigit() or not 1 <= int(k) <= len(cs):
            sys.exit(f"无效：{item}（{sid} 有 {len(cs)} 个候选）")
        src = cs[int(k) - 1]
        dst = out_dir(cfg) / (f"{sid}.mp4" if src.suffix == ".mp4" else f"{sid}.png")
        if src.suffix == ".jpg":
            Image.open(src).save(dst)
        else:
            shutil.copy2(src, dst)
        print(f"{sid} ← {src.name}")


def cmd_status(a):
    cfg, shots = load()
    for s in shots.values():
        cs, p = candidates(s["id"]), picked(cfg, s["id"])
        print(f"{s['id']:6} {'视频' if s.get('kind') == 'video' else '图片'}  候选 {len(cs):>2}  {'✓ 已选' if p else '· 未选'}  {s.get('note', '')}")
    L = ledger()
    print(f"\n已花：图片 ${sum(r.get('cost', 0) for r in L if r['engine'] == 'openrouter'):.2f}，视频 {sum(r.get('credits', 0) for r in L if r['engine'] == 'kling'):.0f} 灵感值")


def cmd_setkey(a):
    k = subprocess.run(["pbpaste"], capture_output=True, text=True).stdout.strip()
    if not k.startswith("sk-or-") or len(k) < 30 or any(c.isspace() for c in k):
        sys.exit("剪贴板里不是 OpenRouter key（应以 sk-or- 开头）。请重新复制后再试。")
    KEY_FILE.parent.mkdir(parents=True, exist_ok=True)
    KEY_FILE.write_text(k + "\n"); KEY_FILE.chmod(0o600)
    subprocess.run(["pbcopy"], input="", text=True)
    print(f"已保存到 {KEY_FILE}（仅你可读），剪贴板已清空。key 以 sk-or- 开头，共 {len(k)} 位。")


def cmd_ledger(a):
    for r in ledger():
        amt = f"${r['cost']:.3f}" if r["engine"] == "openrouter" else f"{r['credits']} 灵感值"
        print(f"{r['time']}  {r['shot']:6} {r['model']:26} {amt}")


def main():
    ap = argparse.ArgumentParser(prog="plates", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="cmd", required=True)
    sp.add_parser("init").set_defaults(fn=cmd_init)
    for name, fn in (("plan", cmd_plan), ("sheet", cmd_sheet)):
        p = sp.add_parser(name); p.add_argument("ids", nargs="*"); p.set_defaults(fn=fn)
    for name, fn in (("images", cmd_images), ("videos", cmd_videos)):
        p = sp.add_parser(name); p.add_argument("ids", nargs="*"); p.add_argument("--yes", action="store_true"); p.set_defaults(fn=fn)
    p = sp.add_parser("pick"); p.add_argument("picks", nargs="+"); p.set_defaults(fn=cmd_pick)
    sp.add_parser("status").set_defaults(fn=cmd_status)
    sp.add_parser("ledger").set_defaults(fn=cmd_ledger)
    sp.add_parser("setkey").set_defaults(fn=cmd_setkey)
    a = ap.parse_args(); a.fn(a)


if __name__ == "__main__":
    main()
