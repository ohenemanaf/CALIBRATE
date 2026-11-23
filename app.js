(() => {
  const ROUND = 10;
  const LEVELS = [0.5, 0.6, 0.7, 0.8, 0.9, 0.99];
  const KEY = "calibrate.v1";
  const $ = (id) => document.getElementById(id);

  // ---------- storage (never trusted to exist) ----------
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d && Array.isArray(d.rounds)) return d;
    } catch (_) {}
    return { rounds: [], seen: {} };
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (_) {}
  }
  let db = load();

  // ---------- scoring ----------
  // Rescaled Brier: 0 for a 50% guess, +100 right at 100%, -300 wrong at 100%.
  const points = (conf, correct) => Math.round(100 * (1 - 4 * Math.pow((correct ? 1 : 0) - conf, 2)));
  const pct = (x) => Math.round(x * 100) + "%";
  const fmtConf = (c) => (c === 0.99 ? "99%" : pct(c));

  // ---------- views ----------
  const views = ["home", "play", "results", "stats", "about"];
  function show(name) {
    views.forEach((v) => ($(v).hidden = v !== name));
    if (name === "stats") renderStats();
    if (name === "home") renderHome();
    window.scrollTo(0, 0);
  }
  document.addEventListener("click", (e) => {
    const go = e.target.closest("[data-go]");
    if (!go) return;
    e.preventDefault();
    const midRound = round && !round.done && !$("play").hidden;
    if (midRound && round.answers.length > 0 &&
        !confirm("Leave this round? Your answers so far won't be saved.")) return;
    if (midRound) round = null;
    show(go.dataset.go);
  });

  function renderHome() {
    const n = db.rounds.length;
    $("homeHint").textContent = n
      ? `You've played ${n} round${n > 1 ? "s" : ""}. New claims are picked first.`
      : `${window.CLAIMS.length} claims about science, history, nature and the world.`;
  }

  // ---------- round ----------
  let round = null;
  let pick = null, conf = null;

  function pickClaims() {
    const ids = window.CLAIMS.map((_, i) => i);
    // Shuffle, then prefer the least-seen claims.
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    ids.sort((a, b) => (db.seen[a] || 0) - (db.seen[b] || 0));
    return ids.slice(0, ROUND);
  }

  function startRound() {
    round = { ids: pickClaims(), idx: 0, answers: [], done: false };
    show("play");
    renderQuestion();
  }

  function renderQuestion() {
    const c = window.CLAIMS[round.ids[round.idx]];
    pick = null; conf = null;
    $("claim").textContent = c.t;
    $("qnum").textContent = `Claim ${round.idx + 1} of ${ROUND}`;
    const total = round.answers.reduce((s, a) => s + a.pts, 0);
    $("runScore").textContent = round.idx ? `Score ${total}` : "";
    $("bar").style.width = (round.idx / ROUND) * 100 + "%";
    document.querySelectorAll("#tf button, #conf button").forEach((b) => { b.classList.remove("on"); b.disabled = false; });
    $("confNote").textContent = "50% means a pure guess.";
    $("reveal").hidden = true;
    $("lockBtn").hidden = false;
    $("lockBtn").disabled = true;
    $("nextBtn").hidden = true;
  }

  // Built from the real formula so the numbers can never drift.
  const LABELS = { 0.6: "A slight lean", 0.7: "Fairly sure", 0.8: "Quite sure", 0.9: "Very sure", 0.99: "Certain" };
  const NOTES = { 0.5: "A pure guess: no points won or lost." };
  LEVELS.slice(1).forEach((l) => {
    NOTES[l] = `${LABELS[l]}. Right: +${points(l, true)} · Wrong: ${points(l, false)}`.replace("-", "−");
  });

  $("tf").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b || b.disabled) return;
    pick = b.dataset.v === "true";
    $("tf").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    $("lockBtn").disabled = conf === null;
  });
  $("conf").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b || b.disabled) return;
    conf = parseFloat(b.dataset.c);
    $("conf").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    $("confNote").textContent = NOTES[conf];
    $("lockBtn").disabled = pick === null;
  });

  $("lockBtn").addEventListener("click", () => {
    if (pick === null || conf === null) return;
    const i = round.ids[round.idx];
    const c = window.CLAIMS[i];
    const correct = pick === c.a;
    const pts = points(conf, correct);
    round.answers.push({ i, pick, conf, correct, pts });
    document.querySelectorAll("#tf button, #conf button").forEach((b) => (b.disabled = true));
    const v = $("verdict");
    v.className = "verdict " + (correct ? "good" : "bad");
    v.textContent = `${correct ? "Correct" : "Wrong"}: it's ${c.a ? "true" : "false"} · ${pts > 0 ? "+" : ""}${pts}`.replace("-", "−");
    $("why").textContent = c.w;
    $("reveal").hidden = false;
    $("lockBtn").hidden = true;
    $("nextBtn").hidden = false;
    $("nextBtn").textContent = round.idx + 1 === ROUND ? "See results" : "Next";
    $("bar").style.width = ((round.idx + 1) / ROUND) * 100 + "%";
    $("nextBtn").focus();
  });

  $("nextBtn").addEventListener("click", () => {
    round.idx++;
    if (round.idx < ROUND) return renderQuestion();
    finishRound();
  });

  // Keyboard: T/F, 1-6 for confidence, Enter to lock / next.
  document.addEventListener("keydown", (e) => {
    if ($("play").hidden || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === "t" || k === "f") $("tf").querySelector(`[data-v="${k === "t"}"]`).click();
    else if (k >= "1" && k <= "6") $("conf").querySelectorAll("button")[+k - 1].click();
    else if (k === "enter" && document.activeElement.tagName !== "BUTTON") {
      if (!$("lockBtn").hidden && !$("lockBtn").disabled) $("lockBtn").click();
      else if (!$("nextBtn").hidden) $("nextBtn").click();
    }
  });

  function finishRound() {
    round.done = true;
    const a = round.answers;
    const score = a.reduce((s, x) => s + x.pts, 0);
    db.rounds.push({ at: Date.now(), score, answers: a.map(({ i, conf, correct }) => ({ i, conf, correct })) });
    a.forEach((x) => (db.seen[x.i] = (db.seen[x.i] || 0) + 1));
    save();

    const right = a.filter((x) => x.correct).length;
    const avgConf = a.reduce((s, x) => s + x.conf, 0) / a.length;
    $("rScore").textContent = String(score).replace("-", "−");
    $("rCorrect").textContent = `${right}/${a.length}`;
    $("rConf").textContent = pct(avgConf);
    setVerdict($("rVerdict"), avgConf, right / a.length, a.length);
    $("rChart").innerHTML = chart(a);
    $("rList").innerHTML = a.map((x) => {
      const c = window.CLAIMS[x.i];
      const cls = x.pts > 0 ? "good" : x.pts < 0 ? "bad" : "zero";
      return `<li>
        <span class="mark ${x.correct ? "good" : "bad"}">${x.correct ? "✓" : "✗"}</span>
        <div><div class="txt">${esc(c.t)}</div><div class="sub">You said ${x.pick ? "true" : "false"} at ${fmtConf(x.conf)}. It's ${c.a ? "true" : "false"}.</div></div>
        <span class="pill ${cls}">${x.pts > 0 ? "+" : ""}${String(x.pts).replace("-", "−")}</span>
      </li>`;
    }).join("");
    round.share = `Calibrate: ${right}/${a.length} correct at ${pct(avgConf)} average confidence, score ${score}.`;
    show("results");
  }

  function setVerdict(el, avgConf, acc, n) {
    const gap = avgConf - acc;
    const small = n < 30 ? " (This is a small sample, so play more rounds for a reliable read.)" : "";
    if (gap > 0.08) {
      el.className = "callout over";
      el.innerHTML = `<b>You were overconfident.</b>Your average confidence was ${pct(avgConf)} but you were right ${pct(acc)} of the time. Try lowering your confidence when you're unsure.${small}`;
    } else if (gap < -0.08) {
      el.className = "callout";
      el.innerHTML = `<b>You were underconfident.</b>You were right ${pct(acc)} of the time but only claimed ${pct(avgConf)}. You know more than you think, so trust yourself a bit more.${small}`;
    } else {
      el.className = "callout good";
      el.innerHTML = `<b>Well calibrated.</b>Your confidence (${pct(avgConf)}) closely matched your accuracy (${pct(acc)}). That's rarer than you'd think.${small}`;
    }
  }

  // ---------- calibration chart (inline SVG) ----------
  function buckets(answers) {
    return LEVELS.map((l) => {
      const xs = answers.filter((a) => a.conf === l);
      return { l, n: xs.length, acc: xs.length ? xs.filter((a) => a.correct).length / xs.length : null };
    });
  }
  function chart(answers) {
    const W = 600, H = 300, L = 44, R = 16, T = 14, B = 36;
    const x = (c) => L + ((c - 0.5) / 0.5) * (W - L - R);
    const y = (p) => T + (1 - p) * (H - T - B);
    let g = "";
    [0, 0.25, 0.5, 0.75, 1].forEach((p) => {
      g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(p)}" y2="${y(p)}"/>`;
      g += `<text x="${L - 8}" y="${y(p) + 4}" text-anchor="end">${pct(p)}</text>`;
    });
    LEVELS.forEach((l) => (g += `<text x="${x(l)}" y="${H - B + 18}" text-anchor="middle">${fmtConf(l)}</text>`));
    g += `<text x="${(L + W - R) / 2}" y="${H - 2}" text-anchor="middle">Your confidence</text>`;
    g += `<line class="ideal" x1="${x(0.5)}" y1="${y(0.5)}" x2="${x(0.99)}" y2="${y(0.99)}"/>`;
    const pts = buckets(answers).filter((b) => b.n);
    if (pts.length > 1) g += `<polyline class="line" points="${pts.map((b) => `${x(b.l)},${y(b.acc)}`).join(" ")}"/>`;
    pts.forEach((b) => {
      const r = Math.min(4 + Math.sqrt(b.n) * 1.8, 11);
      g += `<circle class="dot" cx="${x(b.l)}" cy="${y(b.acc)}" r="${r}"><title>${fmtConf(b.l)} confidence: right ${b.acc * b.n} of ${b.n} (${pct(b.acc)})</title></circle>`;
    });
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Calibration chart: actual accuracy at each confidence level">${g}</svg>
      <div class="legend"><span><i></i>Your actual accuracy</span><span><i class="d"></i>Perfect calibration</span><span>Bigger dot = more answers</span></div>`;
  }

  // ---------- stats ----------
  function renderStats() {
    const all = db.rounds.flatMap((r) => r.answers);
    $("sEmpty").hidden = !!all.length;
    $("sBody").hidden = !all.length;
    if (!all.length) return;
    $("sRounds").textContent = db.rounds.length;
    $("sAnswers").textContent = all.length;
    $("sBest").textContent = Math.max(...db.rounds.map((r) => r.score));
    const avgConf = all.reduce((s, a) => s + a.conf, 0) / all.length;
    const acc = all.filter((a) => a.correct).length / all.length;
    setVerdict($("sVerdict"), avgConf, acc, all.length);
    $("sChart").innerHTML = chart(all);
    $("sTable").innerHTML = `<tr><th>You said</th><th>Answers</th><th>Actually right</th><th>Gap</th></tr>` +
      buckets(all).filter((b) => b.n).map((b) => {
        const gap = Math.round((b.acc - b.l) * 100);
        const cls = Math.abs(gap) <= 10 ? "good" : gap < 0 ? "bad" : "zero";
        return `<tr><td>${fmtConf(b.l)}</td><td>${b.n}</td><td>${pct(b.acc)}</td><td><span class="pill ${cls}">${gap > 0 ? "+" : ""}${String(gap).replace("-", "−")} pts</span></td></tr>`;
      }).join("");
  }

  $("resetBtn").addEventListener("click", () => {
    if (!confirm("Clear all your rounds from this browser? This can't be undone.")) return;
    db = { rounds: [], seen: {} };
    save();
    renderStats();
  });

  // ---------- misc ----------
  function esc(s) { return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.h); toast.h = setTimeout(() => (t.hidden = true), 1800);
  }
  $("shareBtn").addEventListener("click", async () => {
    const text = `${round.share} How well calibrated are you? ${location.href.split("#")[0]}`;
    try { await navigator.clipboard.writeText(text); toast("Result copied"); }
    catch (_) { prompt("Copy your result:", text); }
  });
  $("startBtn").addEventListener("click", startRound);
  $("againBtn").addEventListener("click", startRound);

  renderHome();
})();
