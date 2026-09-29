/* overlay.js — lyrics + HUD drawn on a 2D canvas above the 3D city.
 * draw(ctx, t, info) is a pure function of t (info comes from city3d.renderAt).
 */
(function (root) {
  "use strict";
  var clamp = function (x, a, b) { return x < (a || 0) ? a || 0 : x > (b === undefined ? 1 : b) ? (b === undefined ? 1 : b) : x; };
  var smooth = function (t) { t = clamp(t); return t * t * (3 - 2 * t); };
  var easeOut = function (t) { t = clamp(t); return 1 - Math.pow(1 - t, 3); };
  function bsearch(arr, t) { var lo = 0, hi = arr.length; while (lo < hi) { var m = (lo + hi) >> 1; if (arr[m] <= t) lo = m + 1; else hi = m; } return lo; }

  var LABEL = { intro: "INTRO", verse1: "VERSE I", pre1: "PRE-CHORUS", chorus1: "CHORUS", verse2: "VERSE II",
    pre2: "PRE-CHORUS", chorus2: "CHORUS", bridge: "BRIDGE", final: "FINAL CHORUS", outro: "OUTRO" };
  var TEXT = "#f2f5ff", ACCENT = "#ffb24f", HUD = "rgba(170,198,255,0.78)";
  var FONT = function (s) { return "800 " + s + "px 'Big Shoulders Display'"; };
  var MONO = "300 21px 'IBM Plex Mono'";

  function create(opts) {
    var SONG = opts.song, W = opts.width || 1920, H = opts.height || 1080, DUR = SONG.duration;
    var LY = SONG.lyrics, FADE = 0.25;
    function win(i) {
      var ln = LY[i], nx = LY[i + 1];
      var out = nx ? Math.min(nx.start - FADE - 0.02, ln.end + 1.8) : ln.end + 2.4;
      return [ln.start - 0.02, Math.max(out, ln.start + 0.3)];
    }
    function isHook(ln) { return /^just drive$/i.test(ln.text); }

    function drawLine(c, t, i) {
      var ln = LY[i], w = win(i);
      if (t < w[0] || t > w[1] + FADE) return;
      var outA = 1 - smooth((t - w[1]) / FADE), hook = isHook(ln);
      var fs = hook ? 230 : 110;
      c.font = FONT(fs); c.letterSpacing = (hook ? 0.02 : 0.01) * fs + "px";
      var words = ln.words.map(function (wd) { return { wd: wd, txt: wd.text.toUpperCase(), w: c.measureText(wd.text.toUpperCase()).width }; });
      var space = c.measureText(" ").width, maxW = W * 0.62;
      // lay out lines
      var rows = [[]], rowW = [0];
      words.forEach(function (o) {
        var r = rows.length - 1;
        if (rowW[r] + o.w > maxW && rows[r].length) { rows.push([]); rowW.push(0); r++; }
        rows[r].push(o); rowW[r] += o.w + space;
      });
      var x0 = 120, y0 = 250;
      if (hook) y0 = H * 0.38 + fs * 0.33;
      c.textBaseline = "alphabetic";
      rows.forEach(function (row, ri) {
        var x = hook ? (W - (rowW[ri] - space)) / 2 : x0, y = y0 + ri * fs * 1.0;
        row.forEach(function (o) {
          var p = clamp((t - o.wd.start) / (hook ? 0.12 : 0.2));
          if (p > 0) {
            var active = t >= o.wd.start && t < o.wd.end + 0.08;
            var a = easeOut(p) * outA;
            var dy = hook ? 0 : (1 - easeOut(p)) * fs * 0.22;
            var sc = hook ? 1 + 0.25 * (1 - easeOut(p)) : 1;
            c.save();
            c.globalAlpha = a;
            c.translate(x + o.w / 2, y + dy); c.scale(sc, sc);
            c.shadowColor = "rgba(0,0,0,0.55)"; c.shadowBlur = 28;
            c.fillStyle = active ? ACCENT : TEXT;
            c.textAlign = "center"; c.fillText(o.txt, 0, 0);
            c.restore();
          }
          x += o.w + space;
        });
      });
      c.letterSpacing = "0px";
    }

    // tracking reticle: the camera is always hunting the runner
    function drawReticle(c, t, info) {
      if (!info || !info.pac) return;
      var st = info.track, P = info.pac, endA = 1 - smooth((t - 180) / 4);
      c.save(); c.font = MONO; c.textAlign = "right";
      var label = st === "lost" ? "○ SIGNAL LOST" : st === "acquire" ? "◎ REACQUIRING" : "● TRACKING";
      var blink = st === "lost" ? (Math.floor(t * 6) % 2 ? 1 : 0.35) : 1;
      c.globalAlpha = blink * endA; c.fillStyle = st === "track" ? HUD : ACCENT;
      c.fillText(label, W - 120, 144);
      if (st !== "lost" && P.on && endA > 0) {
        var k = st === "acquire" ? 1.9 - 0.9 * ((t * 7) % 1) : 1;
        var r = Math.max(34, P.r * 2.6) * k, L = r * 0.45;
        c.globalAlpha = (st === "acquire" ? 0.6 : 0.85) * endA;
        c.strokeStyle = st === "acquire" ? ACCENT : HUD; c.lineWidth = 2;
        c.beginPath();
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (q) {
          var x = P.x + q[0] * r, y = P.y + q[1] * r;
          c.moveTo(x, y - q[1] * L); c.lineTo(x, y); c.lineTo(x - q[0] * L, y);
        });
        c.stroke();
        c.textAlign = "left"; c.fillStyle = HUD;
        c.fillText("TGT-01", P.x + r + 12, P.y - r + 16);
      }
      c.restore();
    }

    function draw(c, t, info) {
      c.clearRect(0, 0, W, H);
      drawReticle(c, t, info);
      for (var i = 0; i < LY.length; i++) drawLine(c, t, i);
      // HUD
      var mins = Math.floor((t / DUR) * 227), hh = 2 + Math.floor(mins / 60), mm = mins % 60;
      c.font = MONO; c.fillStyle = HUD; c.textAlign = "right";
      c.fillText("0" + hh + ":" + ("0" + mm).slice(-2) + " AM", W - 120, 110);
      c.textAlign = "left"; c.fillText("2AM IN YOUR CAR", 120, 110);
      var sec = "outro"; SONG.sections.forEach(function (s) { if (t >= s.start && t < s.end) sec = s.id; });
      var bar = bsearch(SONG.downbeats, t);
      if (info) {
        c.fillText(["BAR " + ("0" + bar).slice(-2) + "/" + SONG.downbeats.length,
          "BUILDINGS " + ("00" + info.built).slice(-3) + "/" + info.total,
          "SCORE " + ("000000" + info.score).slice(-6), LABEL[sec]].join("   ·   "), 120, H - 60);
      }
      // end title
      var ta = smooth((t - 186.5) / 2.2);
      if (ta > 0) {
        c.globalAlpha = ta; c.textAlign = "center"; c.fillStyle = TEXT; c.font = FONT(150); c.letterSpacing = "2px";
        c.shadowColor = "rgba(0,0,0,0.4)"; c.shadowBlur = 30;
        c.fillText("2AM IN YOUR CAR", W / 2, H * 0.2);
        c.shadowBlur = 0; c.letterSpacing = "0px";
        c.font = MONO; c.fillStyle = HUD;
        c.fillText((info ? info.total : "") + " BUILDINGS  ·  ONE NIGHT  ·  ONE SONG", W / 2, H * 0.2 + 56);
        c.globalAlpha = 1; c.textAlign = "left";
      }
      var fin = 1 - smooth(t / 1.0), fout = smooth((t - (DUR - 1.5)) / 1.5);
      if (fin > 0 || fout > 0) { c.fillStyle = "rgba(0,0,0," + Math.max(fin, fout) + ")"; c.fillRect(0, 0, W, H); }
    }
    return { draw: draw };
  }
  root.Overlay2D = { create: create };
})(window);
