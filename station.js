// The listening station in the browser: a port of src/components/turntable.tsx and the player logic of
// src/app/listen/[id].tsx, same proportions (assets/turntable/PROPORTIONS.md), same behaviours:
//   - the platter turns whenever the arm is off its rest: playing, or in your hand;
//   - take the headshell and the sound stops at once; let go and the needle lands, then the music starts a beat later,
//     from that point of that band; near a gap it lands on the start of the track;
//   - press play and the arm lifts, swings to the band and lands; skip and it lifts, moves, lands again;
//   - as a track plays the arm creeps inward; pause, or the end of the side, and it lifts and returns slowly;
//   - 33/45 changes the real speed, pitch and all; Flip turns the record over.
// One record, Gil Scott-Heron's Pieces Of A Man (Flying Dutchman, 1971): the tracklist is Discogs release 430690,
// the 30-second previews come from Apple's catalogue at load (no key), as in the app.
(function () {
  var TRACKS = [
    ["A1", "The Revolution Will Not Be Televised", "2:59"], ["A2", "Save The Children", "4:55"], ["A3", "Lady Day And John Coltrane", "3:10"],
    ["A4", "Home Is Where The Hatred Is", "3:15"], ["A5", "When You Are Who You Are", "3:01"], ["A6", "I Think I'll Call It Morning", "3:45"],
    ["B1", "Pieces Of A Man", "4:22"], ["B2", "A Sign Of The Ages", "4:05"], ["B3", "Or Down You Fall", "3:08"], ["B4", "The Needle's Eye", "4:01"], ["B5", "The Prisoner", "8:39"]
  ].map(function (t) { var m = /^(\d+):(\d{2})$/.exec(t[2]); return { position: t[0], title: t[1], secs: Number(m[1]) * 60 + Number(m[2]), url: null }; });
  var SIDES = [{ name: "A", idx: [0, 1, 2, 3, 4, 5] }, { name: "B", idx: [6, 7, 8, 9, 10] }];
  // geometry.json, the render's panel coordinates
  var G = { base: { x: 157, y: 32, w: 940, h: 1196, pivotX: 611.748, pivotY: 611.546 }, bearing: { x: 468.75, y: 454.55, w: 328, h: 328 }, arm: { x: 278, y: 16, w: 746, h: 1883, pivotX: 847, pivotY: 25, stylusDx: -511, stylusDy: 1871 } };
  var PIVOT_DX = 1.1, PIVOT_DY = -0.62, ARM_LEN = 1.35, BASE_W = 0.59, REST_R = 1.02;
  var HEAD_GRAB = 56, SNAP = 0.035, LIFT_MS = 220, SWING_MS = 520, LAND_MS = 200, RETURN_MS = 1100;

  var deck = document.getElementById("deck"), platterEl = document.getElementById("platter"), armEl = document.getElementById("arm"), baseEl = document.getElementById("base"), capEl = document.getElementById("cap");
  var nowEl = document.getElementById("now"), playBtn = document.getElementById("play"), flipBtn = document.getElementById("flip"), rpmBtn = document.getElementById("rpm");
  var PLAY = '<svg viewBox="0 0 24 24"><path d="M7 5v14l12-7z"/></svg>', PAUSE = '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>';

  // ---- geometry, as the app's `g`, for the deck's current size ----
  var g = null, edges = [];
  function layout() {
    var width = deck.clientWidth, height = deck.clientHeight, EDGE = 8;
    var R12 = 0.9 * ((height - 2 * EDGE) / 2), R = R12;
    var BASE_IN = 0.25;
    var px = width - BASE_IN * R12, cx = px - PIVOT_DX * R12, cy = height / 2, py = cy + PIVOT_DY * R12;
    var rOuter = R * 0.94, rInner = R * 0.37, rLabel = R * 0.3;
    var dc = Math.hypot(cx - px, cy - py), L = ARM_LEN * R12;
    var v0x = G.arm.stylusDx, v0y = G.arm.stylusDy, as = L / Math.hypot(v0x, v0y);
    var theta0 = (Math.atan2(-v0x, v0y) * 180) / Math.PI;
    var base = Math.atan2(px - cx, cy - py);
    var phi = function (r) { return Math.acos(Math.max(-1, Math.min(1, (L * L + dc * dc - r * r) / (2 * L * dc)))); };
    var angleFor = function (r) { return ((base - phi(r)) * 180) / Math.PI - theta0; };
    var arm = { x: px - (G.arm.pivotX - G.arm.x) * as, y: py - (G.arm.pivotY - G.arm.y) * as, w: G.arm.w * as, h: G.arm.h * as };
    var bs = (BASE_W * R12) / G.base.w;
    var baseRect = { x: px - (G.base.pivotX - G.base.x) * bs, y: py - (G.base.pivotY - G.base.y) * bs, w: G.base.w * bs, h: G.base.h * bs };
    var cap = { x: px - arm.x - (G.base.pivotX - G.bearing.x) * bs, y: py - arm.y - (G.base.pivotY - G.bearing.y) * bs, w: G.bearing.w * bs, h: G.bearing.h * bs };
    g = { R: R, cx: cx, cy: cy, rOuter: rOuter, rInner: rInner, rLabel: rLabel, px: px, py: py, dc: dc, L: L, base: base, theta0: theta0, aOuter: angleFor(rOuter), aInner: angleFor(rInner), aRest: angleFor(Math.min(REST_R * R12, L + dc - 1)), v0x: v0x * as, v0y: v0y * as, arm: arm, baseRect: baseRect, cap: cap };
    baseEl.style.left = baseRect.x + "px"; baseEl.style.top = baseRect.y + "px"; baseEl.style.width = baseRect.w + "px"; baseEl.style.height = baseRect.h + "px";
    armEl.style.left = arm.x + "px"; armEl.style.top = arm.y + "px"; armEl.style.width = arm.w + "px"; armEl.style.height = arm.h + "px";
    armEl.style.transformOrigin = (px - arm.x) + "px " + (py - arm.y) + "px";
    capEl.style.left = cap.x + "px"; capEl.style.top = cap.y + "px"; capEl.style.width = cap.w + "px"; capEl.style.height = cap.h + "px";
    platterEl.style.left = (cx - R) + "px"; platterEl.style.top = (cy - R) + "px"; platterEl.style.width = (R * 2) + "px"; platterEl.style.height = (R * 2) + "px";
    drawRecord();
    paint();
  }
  // Bands, outer to inner, one per track of the side, sized by duration (the app's `bands` + `edges`).
  function drawRecord() {
    var idx = SIDES[side].idx, shares = idx.map(function (i) { return Math.max(30, TRACKS[i].secs); });
    var total = shares.reduce(function (a, b) { return a + b; }, 0);
    edges = [g.rOuter]; var acc = 0;
    shares.forEach(function (sh) { acc += sh / total; edges.push(g.rOuter - acc * (g.rOuter - g.rInner)); });
    var h = "", R = g.R;
    var ring = function (r, extra) { return '<div style="width:' + (r * 2) + 'px;height:' + (r * 2) + 'px;left:' + (R - r) + 'px;top:' + (R - r) + 'px;' + extra + '"></div>'; };
    edges.slice(0, -1).forEach(function (r, i) { h += ring(r, "background:" + (i % 2 ? "#161616" : "#171717")); });
    edges.slice(1, -1).forEach(function (r) { h += ring(r, "border:1px solid #282828"); });
    for (var r = R - 5; r > g.rInner; r -= 7) h += ring(r, "border:1px solid #1D1D1D"); // the groove texture, over the bands
    h += ring(g.rInner, "background:#121212");
    h += '<div class="label" style="width:' + (g.rLabel * 2) + 'px;height:' + (g.rLabel * 2) + 'px;left:' + (R - g.rLabel) + 'px;top:' + (R - g.rLabel) + 'px"><img src="cover.jpg" alt=""><div class="spindle"></div></div>';
    platterEl.innerHTML = h;
  }
  function angleOf(r) { var c = Math.max(-1, Math.min(1, (g.L * g.L + g.dc * g.dc - r * r) / (2 * g.L * g.dc))); return ((g.base - Math.acos(c)) * 180) / Math.PI - g.theta0; }
  function radiusOf(a) { var phiNow = g.base - ((a + g.theta0) * Math.PI) / 180; return Math.sqrt(Math.max(0, g.L * g.L + g.dc * g.dc - 2 * g.L * g.dc * Math.cos(phiNow))); }
  function bandAt(r) {
    if (r > g.rOuter + 8 || r < g.rInner - 10) return null;
    var rr = Math.max(g.rInner, Math.min(g.rOuter, r));
    for (var i = 0; i < edges.length - 1; i++) if (rr <= edges[i] + 0.01 && rr >= edges[i + 1] - 0.01) {
      var within = (edges[i] - rr) / Math.max(1, edges[i] - edges[i + 1]);
      return { index: i, within: within < SNAP ? 0 : Math.min(0.97, within) };
    }
    return null;
  }
  function radiusFor(at) { var i = Math.max(0, Math.min(edges.length - 2, at.index)); return edges[i] + (edges[i + 1] - edges[i]) * Math.max(0, Math.min(1, at.within)); }

  // ---- animation: shared values with timing, sequence and delay, as Reanimated gave the app ----
  var ease = { linear: function (t) { return t; }, inOutCubic: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }, outCubic: function (t) { return 1 - Math.pow(1 - t, 3); }, inCubic: function (t) { return t * t * t; } };
  var vals = { spin: 0, arm: 0, lift: 0, slide: 0 };
  var anims = {};
  function to(key, target, ms, easing, delay) { // withDelay(delay, withTiming(target, ms, easing))
    anims[key] = { from: null, target: target, ms: ms, easing: easing || ease.inOutCubic, t0: performance.now() + (delay || 0) };
  }
  function seq(key, steps) { // withSequence: each step {target, ms, easing, delay}
    anims[key] = { steps: steps.slice(), t0: performance.now() };
  }
  function cancel(key) { delete anims[key]; }
  var spinning = false, spinLast = 0, spinRun = null; // run-down after stop
  var rpm = 33;
  function tick(now) {
    Object.keys(anims).forEach(function (k) {
      var a = anims[k];
      if (a.steps) { // sequence
        var s = a.steps[0];
        if (!s) { delete anims[k]; return; }
        if (s.from == null) { if (now < a.t0 + (s.delay || 0)) return; s.from = vals[k]; s.t0 = now; }
        var p = Math.min(1, (now - s.t0) / s.ms);
        vals[k] = s.from + (s.target - s.from) * (s.easing || ease.inOutCubic)(p);
        if (p >= 1) { a.steps.shift(); a.t0 = now; if (!a.steps.length) delete anims[k]; }
        return;
      }
      if (now < a.t0) return;
      if (a.from == null) a.from = vals[k];
      var q = Math.min(1, (now - a.t0) / a.ms);
      vals[k] = a.from + (a.target - a.from) * a.easing(q);
      if (q >= 1) delete anims[k];
    });
    if (spinning) { vals.spin += ((now - spinLast) / (60000 / (rpm === 45 ? 45 : 33.333))) * 360; }
    else if (spinRun) { var p2 = Math.min(1, (now - spinRun.t0) / 1400); vals.spin = spinRun.from + 55 * ease.outCubic(p2); if (p2 >= 1) spinRun = null; }
    spinLast = now;
    paint();
    requestAnimationFrame(tick);
  }
  function paint() {
    if (!g) return;
    platterEl.style.transform = "translateX(" + vals.slide + "px) rotate(" + (vals.spin % 360) + "deg)";
    armEl.style.transform = "rotate(" + vals.arm + "deg) scale(" + (1 + 0.025 * vals.lift) + ")";
  }
  function startSpin() { if (spinning) return; spinning = true; spinRun = null; spinLast = performance.now(); }
  function stopSpin() { if (!spinning) return; spinning = false; spinRun = { from: vals.spin, t0: performance.now() }; }

  // ---- the player ----
  var audio = new Audio(); audio.preload = "auto";
  try { audio.preservesPitch = false; audio.mozPreservesPitch = false; audio.webkitPreservesPitch = false; } catch (e) {}
  var side = 0, index = 0, loadedUrl = null, loadSeq = 0, playing = false;
  var lastIndex = -1, holdUntil = 0, holdHome = 0, inHand = false, notPlayingTimer = null, settledPlaying = false;
  function sideIdx() { return SIDES[side].idx; }
  function playable() { return sideIdx().filter(function (i) { return TRACKS[i].url; }); }
  function sidePos(i) { return sideIdx().indexOf(i); }
  function rate() { var native = 33; return rpm === native ? 1 : rpm === 45 ? 1.35 : 0.74; }
  function setPlaying(p) {
    playing = p;
    playBtn.innerHTML = p ? PAUSE : PLAY; playBtn.setAttribute("aria-label", p ? "Pause" : "Play");
    if (p) { clearTimeout(notPlayingTimer); settledPlaying = true; follow(); }
    else { clearTimeout(notPlayingTimer); notPlayingTimer = setTimeout(function () { settledPlaying = false; follow(); }, 700); }
  }
  function load(i, play, within) { // the app's `load`: replace, wait for the metadata, seek, then play
    var t = TRACKS[i]; if (!t || !t.url) return;
    var mySeq = ++loadSeq, fresh = loadedUrl !== t.url;
    if (fresh) { audio.pause(); audio.src = t.url; loadedUrl = t.url; audio.load(); }
    var start = function () {
      if (mySeq !== loadSeq) return;
      var dur = audio.duration || 30;
      var go = function () { if (mySeq !== loadSeq) return; if (play) audio.play().catch(function () {}); };
      if (within != null && within > 0) { audio.currentTime = within * dur; go(); }
      else if (within === 0 && !fresh) { audio.currentTime = 0; go(); }
      else go();
    };
    if (!fresh && audio.readyState >= 1) { start(); return; }
    var t0 = Date.now();
    var poll = function () { if (mySeq !== loadSeq) return; if (audio.readyState >= 1 && audio.duration > 0) start(); else if (Date.now() - t0 < 4000) setTimeout(poll, 50); else start(); };
    setTimeout(poll, 50);
  }
  function go(i, keep, within) { index = i; audio.playbackRate = rate(); load(i, true, keep ? within : 0); showNow(); }
  function next() { var p = playable(), after = p.filter(function (i) { return i > index; })[0]; if (after != null) go(after); else { audio.pause(); setPlaying(false); } }
  function prev() { var p = playable(); if (audio.currentTime > 3) { audio.currentTime = 0; return; } var before = p.filter(function (i) { return i < index; }).slice(-1)[0]; if (before != null) go(before); else audio.currentTime = 0; }
  function toggle() {
    var t = TRACKS[index];
    if (!t.url) { var f = playable()[0]; if (f != null) go(f); return; }
    if (loadedUrl !== t.url) load(index, true);
    else if (!audio.paused) audio.pause();
    else if (audio.duration && audio.currentTime >= audio.duration - 0.05) { audio.currentTime = 0; audio.play().catch(function () {}); }
    else audio.play().catch(function () {});
  }
  function showNow() { var t = TRACKS[index]; nowEl.textContent = t ? t.position + " · " + t.title : ""; }
  audio.addEventListener("play", function () { setPlaying(true); });
  audio.addEventListener("playing", function () { setPlaying(true); });
  audio.addEventListener("pause", function () { setPlaying(false); });
  audio.addEventListener("ended", function () { next(); });
  audio.addEventListener("timeupdate", follow);

  // ---- the arm follows the music, unless it is in the hand (the app's effect, run on every status tick) ----
  function follow() {
    if (!g || inHand) return;
    if (Date.now() < holdHome) return;
    if (Date.now() < holdUntil) { if (playing) startSpin(); return; }
    var at = { index: Math.max(0, sidePos(index)), within: audio.duration ? Math.min(1, audio.currentTime / audio.duration) : 0 };
    if (!settledPlaying) {
      if (playing) return; // back before the pause counted
      if (lastIndex !== -1) {
        seq("lift", [{ target: 1, ms: LIFT_MS }, { target: 0, ms: LAND_MS, delay: RETURN_MS }]);
        to("arm", g.aRest, RETURN_MS, ease.inOutCubic, LIFT_MS);
      } else to("arm", g.aRest, 300);
      lastIndex = -1; stopSpin(); return;
    }
    startSpin();
    var target = angleOf(radiusFor(at.index !== lastIndex ? { index: at.index, within: 0 } : at));
    if (at.index !== lastIndex) {
      lastIndex = at.index;
      seq("lift", [{ target: 1, ms: LIFT_MS }, { target: 0, ms: LAND_MS, delay: SWING_MS }]);
      to("arm", target, SWING_MS, ease.inOutCubic, LIFT_MS);
    } else to("arm", target, 260, ease.linear);
  }

  // ---- the hand ----
  var grabStart = 0, fingerStart = 0, pointerId = null;
  function headshell() { var a = (vals.arm * Math.PI) / 180; return { x: g.px + g.v0x * Math.cos(a) - g.v0y * Math.sin(a), y: g.py + g.v0x * Math.sin(a) + g.v0y * Math.cos(a) }; }
  function local(e) { var r = deck.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  deck.addEventListener("pointerdown", function (e) {
    if (!g) return;
    var p = local(e), h = headshell();
    if (Math.hypot(p.x - h.x, p.y - h.y) <= HEAD_GRAB) {
      pointerId = e.pointerId; deck.setPointerCapture(e.pointerId); deck.classList.add("grabbing");
      inHand = true; cancel("lift"); to("lift", 1, 160, ease.outCubic);
      grabStart = vals.arm; fingerStart = Math.atan2(p.y - g.py, p.x - g.px);
      cancel("arm"); startSpin();
      loadSeq++; audio.pause(); // the needle is up: the sound stops at once, and a pending load must not press play
      e.preventDefault();
      return;
    }
    // a tap on a band, as in the app
    var hit = bandAt(Math.hypot(p.x - g.cx, p.y - g.cy));
    if (hit) { lastIndex = -1; holdUntil = Date.now() + 1600; onDrop(hit); }
  });
  deck.addEventListener("pointermove", function (e) {
    if (pointerId !== e.pointerId || !inHand) return;
    var p = local(e), now = Math.atan2(p.y - g.py, p.x - g.px);
    var delta = ((now - fingerStart) * 180) / Math.PI;
    if (delta > 180) delta -= 360; if (delta < -180) delta += 360;
    vals.arm = Math.max(g.aRest - 4, Math.min(g.aInner + 1, grabStart + delta));
  });
  function release(e) {
    if (pointerId !== e.pointerId) return;
    pointerId = null; deck.classList.remove("grabbing"); inHand = false;
    to("lift", 0, LAND_MS, ease.outCubic);
    var a = vals.arm, hit = a >= g.aOuter - 2 ? bandAt(radiusOf(a)) : null;
    if (!hit) { to("arm", g.aRest, RETURN_MS * 0.7); stopSpin(); lastIndex = -1; return; }
    to("arm", angleOf(radiusFor(hit)), 140, ease.linear);
    lastIndex = hit.index; holdUntil = Date.now() + 1600;
    onDrop(hit);
  }
  deck.addEventListener("pointerup", release);
  deck.addEventListener("pointercancel", release);
  function onDrop(hit) { // the app's onDrop: the band under the stylus, from that point, a beat later
    var i = sideIdx()[hit.index]; if (i == null) return;
    if (!TRACKS[i].url) { var near = playable()[0]; if (near != null) go(near); return; }
    setTimeout(function () { go(i, true, hit.within); }, 180);
  }

  // ---- controls ----
  playBtn.addEventListener("click", toggle);
  document.getElementById("next").addEventListener("click", next);
  document.getElementById("prev").addEventListener("click", prev);
  rpmBtn.addEventListener("click", function () { rpm = rpm === 33 ? 45 : 33; rpmBtn.textContent = String(rpm); audio.playbackRate = rate(); });
  flipBtn.addEventListener("click", function () { // turn the record over: the arm goes home, the record slides out and back
    audio.pause();
    side = (side + 1) % SIDES.length; flipBtn.textContent = "Side " + SIDES[side].name;
    holdHome = Date.now() + 1200; lastIndex = -1;
    seq("lift", [{ target: 1, ms: LIFT_MS }, { target: 0, ms: LAND_MS, delay: RETURN_MS }]);
    to("arm", g.aRest, RETURN_MS, ease.inOutCubic, LIFT_MS);
    stopSpin();
    seq("slide", [{ target: -(g.cx + g.R + 24), ms: 420, easing: ease.inCubic }, { target: 0, ms: 640, easing: ease.outCubic }]);
    setTimeout(drawRecord, 420);
    var f = playable()[0]; index = f != null ? f : sideIdx()[0]; showNow();
  });

  // ---- previews from Apple's catalogue, matched to the Discogs tracklist by title (src/lib/previews.ts) ----
  function norm(s) { return s.toLowerCase().replace(/\(.*?\)|\[.*?\]/g, "").replace(/[^a-z0-9]+/g, " ").trim(); }
  function similar(a, b) { var x = norm(a), y = norm(b); if (!x || !y) return 0; if (x === y) return 1; if ((x.indexOf(y) >= 0 || y.indexOf(x) >= 0) && Math.min(x.length, y.length) / Math.max(x.length, y.length) >= 0.6) return 0.85; var xs = x.split(" "), ys = y.split(" "); var hit = ys.filter(function (w) { return xs.indexOf(w) >= 0; }).length; return hit / Math.max(xs.length, ys.length); }
  fetch("https://itunes.apple.com/search?term=" + encodeURIComponent("Gil Scott-Heron Pieces of a Man") + "&entity=song&limit=50&country=FR").then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
    var songs = ((j && j.results) || []).filter(function (s) { return s.previewUrl && /pieces of a man/i.test(s.collectionName || ""); });
    var used = {};
    TRACKS.forEach(function (t) {
      var best = songs.map(function (s) { return { s: s, score: similar(s.trackName, t.title) }; }).filter(function (c) { return c.score >= 0.6 && !used[c.s.previewUrl]; }).sort(function (a, b) { return b.score - a.score; })[0];
      if (best) { t.url = best.s.previewUrl; used[best.s.previewUrl] = 1; }
    });
    var f = playable()[0]; if (f != null) index = f; showNow();
    document.getElementById("hint").style.opacity = playable().length ? 0.9 : 0;
  }).catch(function () {});

  // ---- go ----
  layout();
  vals.arm = g.aRest; vals.slide = -(g.cx + g.R + 20);
  to("slide", 0, 720, ease.outCubic, 120); // the record slides in from the left
  showNow();
  window.addEventListener("resize", function () { var a = vals.arm - g.aRest; layout(); vals.arm = g.aRest + a; });
  requestAnimationFrame(function (now) { spinLast = now; tick(now); });
})();
