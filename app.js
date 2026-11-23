(() => {
  const ROUND = 10;
  const LEVELS = [0.5, 0.6, 0.7, 0.8, 0.9, 0.99];
  const KEY = "calibrate.v1";
  const REPO = "https://github.com/ohenemanaf/CALIBRATE";
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
  const MAX_LOSS = -points(0.99, false);
  const pct = (x) => Math.round(x * 100) + "%";
  const fmtConf = (c) => (c === 0.99 ? "99%" : pct(c));
  const signed = (n) => (n > 0 ? "+" + n : n < 0 ? "−" + Math.abs(n) : "0");

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
    if (go.dataset.go === "play-start") return startRound();
    show(go.dataset.go);
  });

  function renderHome() {
    const n = db.rounds.length;
    $("homeHint").textContent = n
      ? `${n} round${n > 1 ? "s" : ""} played. Claims you haven't seen come first.`
      : `10 claims, about 3 minutes.`;
  }

  // ---------- round ----------
  let round = null;
  let pick = null, conf = null;

  function pickClaims() {
    const ids = window.CLAIMS.map((_, i) => i);
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

  function renderTicks() {
    $("ticks").innerHTML = Array.from({ length: ROUND }, (_, i) => {
      const a = round.answers[i];
      return `<li class="${a ? (a.correct ? "right" : "wrong") : i === round.idx ? "now" : ""}"></li>`;
    }).join("");
  }

  function setRadio(group, btn) {
    group.querySelectorAll('[role="radio"]').forEach((b) => b.setAttribute("aria-checked", String(b === btn)));
  }

  function renderQuestion() {
    const c = window.CLAIMS[round.ids[round.idx]];
    pick = null; conf = null;
    $("claim").textContent = c.t;
    $("qnum").textContent = `Claim ${round.idx + 1} of ${ROUND}`;
    const total = round.answers.reduce((s, a) => s + a.pts, 0);
    $("runScore").textContent = round.idx ? `Score ${signed(total)}` : "";
    renderTicks();
    document.querySelectorAll("#tf button, #conf button").forEach((b) => { b.setAttribute("aria-checked", "false"); b.disabled = false; });
    $("conf").classList.remove("set");
    renderStakes();
    $("reveal").hidden = true;
    $("lockBtn").hidden = false;
    $("lockBtn").disabled = true;
    $("nextBtn").hidden = true;
  }

  const LABELS = { 0.5: "A pure guess", 0.6: "A slight lean", 0.7: "Fairly sure", 0.8: "Quite sure", 0.9: "Very sure", 0.99: "Certain" };
  function renderStakes() {
    if (conf === null) {
      $("winBar").style.width = $("loseBar").style.width = "0";
      $("stakesText").textContent = "Pick a confidence level to see what's at stake.";
      return;
    }
    const win = points(conf, true), lose = -points(conf, false);
    $("winBar").style.width = (win / MAX_LOSS) * 50 + "%";
    $("loseBar").style.width = (lose / MAX_LOSS) * 50 + "%";
    $("stakesText").innerHTML = conf === 0.5
      ? `${LABELS[conf]}: nothing to win or lose.`
      : `${LABELS[conf]}. Right <span class="w">${signed(win)}</span>, wrong <span class="l">${signed(-lose)}</span>`;
  }

  $("tf").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b || b.disabled) return;
    pick = b.dataset.v === "true";
    setRadio($("tf"), b);
    $("lockBtn").disabled = conf === null;
  });
  $("conf").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b || b.disabled) return;
    conf = parseFloat(b.dataset.c);
    setRadio($("conf"), b);
    const i = LEVELS.indexOf(conf);
    $("needle").style.left = ((i + 0.5) / LEVELS.length) * 100 + "%";
    $("conf").classList.add("set");
    renderStakes();
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
    $("reveal").className = "reveal " + (correct ? "right" : "wrong");
    $("verdict").textContent = `${correct ? "Right" : "Wrong"}. It's ${c.a ? "true" : "false"}. ${signed(pts)} points`;
    $("why").textContent = c.w;
    $("src").innerHTML = sourceLinks(c);
    $("reveal").hidden = false;
    $("lockBtn").hidden = true;
    $("nextBtn").hidden = false;
    $("nextBtn").textContent = round.idx + 1 === ROUND ? "See results" : "Next claim";
    const total = round.answers.reduce((s, a) => s + a.pts, 0);
    $("runScore").textContent = `Score ${signed(total)}`;
    renderTicks();
    $("nextBtn").focus({ preventScroll: true });
  });

  $("nextBtn").addEventListener("click", () => {
    round.idx++;
    if (round.idx < ROUND) return renderQuestion();
    finishRound();
  });

  // Keyboard: T/F, 1-6 for confidence, Enter to lock in / continue.
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
    $("rScore").textContent = signed(score);
    $("rSummary").innerHTML = `You were right on <b>${right} of ${a.length}</b> claims, at <b>${pct(avgConf)}</b> average confidence.`;
    setVerdict($("rVerdict"), avgConf, right / a.length, a.length);
    $("rChart").innerHTML = chart(a);
    $("rList").innerHTML = a.map((x) => {
      const c = window.CLAIMS[x.i];
      const cls = x.pts > 0 ? "right" : x.pts < 0 ? "wrong" : "zero";
      return `<li>
        <span class="bar ${x.correct ? "right" : "wrong"}" aria-hidden="true"></span>
        <div>
          <div class="txt">${esc(c.t)}</div>
          <div class="sub">${x.correct ? "Right" : "Wrong"}: you said ${x.pick ? "true" : "false"} at ${fmtConf(x.conf)}. It's ${c.a ? "true" : "false"}.<a href="${wikiUrl(c.s)}" target="_blank" rel="noopener">Source</a></div>
        </div>
        <span class="pts ${cls}">${signed(x.pts)}</span>
      </li>`;
    }).join("");
    round.share = `Calibrate: right on ${right}/${a.length} claims at ${pct(avgConf)} average confidence, score ${score}.`;
    show("results");
  }

  function setVerdict(el, avgConf, acc, n) {
    const gap = avgConf - acc;
    const small = n < 30 ? " With this few answers, treat it as a first reading." : "";
    if (gap > 0.08) {
      el.className = "callout over";
      el.innerHTML = `<b>Overconfident</b>Your confidence averaged ${pct(avgConf)}, but you were right ${pct(acc)} of the time. When a claim feels familiar but you can't say why, try a lower setting.${small}`;
    } else if (gap < -0.08) {
      el.className = "callout";
      el.innerHTML = `<b>Underconfident</b>You were right ${pct(acc)} of the time but claimed only ${pct(avgConf)}. You know more than you think, so trust your first read a little more.${small}`;
    } else {
      el.className = "callout good";
      el.innerHTML = `<b>Well calibrated</b>Your confidence (${pct(avgConf)}) closely matched your accuracy (${pct(acc)}). That's rarer than you'd think.${small}`;
    }
  }

  // ---------- calibration chart (inline SVG on graph paper) ----------
  function buckets(answers) {
    return LEVELS.map((l) => {
      const xs = answers.filter((a) => a.conf === l);
      return { l, n: xs.length, right: xs.filter((a) => a.correct).length, acc: xs.length ? xs.filter((a) => a.correct).length / xs.length : null };
    });
  }
  function chart(answers) {
    const W = 600, H = 320, L = 46, R = 18, T = 14, B = 44;
    const x = (c) => L + ((c - 0.5) / 0.49) * (W - L - R);
    const y = (p) => T + (1 - p) * (H - T - B);
    let g = "";
    // graph paper: minor lines every 5%, major every 25% / at each level
    for (let k = 0; k <= 20; k++) {
      const p = k / 20, major = k % 5 === 0;
      g += `<line class="grid${major ? " major" : ""}" x1="${L}" x2="${W - R}" y1="${y(p)}" y2="${y(p)}"/>`;
      if (major) g += `<text x="${L - 10}" y="${y(p) + 4}" text-anchor="end">${pct(p)}</text>`;
    }
    LEVELS.forEach((l) => {
      g += `<line class="grid major" x1="${x(l)}" x2="${x(l)}" y1="${T}" y2="${H - B}"/>`;
      g += `<text x="${x(l)}" y="${H - B + 18}" text-anchor="middle">${fmtConf(l)}</text>`;
    });
    // overconfidence zone: below the diagonal
    g += `<polygon class="zone" points="${x(0.5)},${y(0.5)} ${x(0.99)},${y(0.99)} ${x(0.99)},${y(0)} ${x(0.5)},${y(0)}"/>`;
    g += `<line class="ideal" x1="${x(0.5)}" y1="${y(0.5)}" x2="${x(0.99)}" y2="${y(0.99)}"/>`;
    g += `<text class="axis-title" x="${(L + W - R) / 2}" y="${H - 6}" text-anchor="middle">Your confidence</text>`;
    g += `<text class="axis-title" transform="translate(12 ${(T + H - B) / 2}) rotate(-90)" text-anchor="middle">Actually right</text>`;
    const pts = buckets(answers).filter((b) => b.n);
    if (pts.length > 1) g += `<polyline class="line" points="${pts.map((b) => `${x(b.l)},${y(b.acc)}`).join(" ")}"/>`;
    pts.forEach((b) => {
      const r = Math.min(4.5 + Math.sqrt(b.n) * 1.8, 11);
      g += `<circle class="dot" cx="${x(b.l)}" cy="${y(b.acc)}" r="${r}"><title>${fmtConf(b.l)} confidence: right ${b.right} of ${b.n} (${pct(b.acc)})</title></circle>`;
    });
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Calibration chart: how often you were right at each confidence level">${g}</svg>
      <div class="legend"><span><i></i>You</span><span><i class="ideal"></i>Perfect calibration</span><span><i class="zone"></i>Overconfident zone</span><span>Bigger dot, more answers</span></div>`;
  }

  // ---------- stats ----------
  function renderStats() {
    const all = db.rounds.flatMap((r) => r.answers);
    $("sEmpty").hidden = !!all.length;
    $("sBody").hidden = !all.length;
    if (!all.length) return;
    const avgConf = all.reduce((s, a) => s + a.conf, 0) / all.length;
    const acc = all.filter((a) => a.correct).length / all.length;
    const best = Math.max(...db.rounds.map((r) => r.score));
    const n = db.rounds.length;
    $("sSummary").innerHTML = `<b>${n}</b> round${n > 1 ? "s" : ""}, <b>${all.length}</b> answers, best score <b>${signed(best)}</b>.`;
    setVerdict($("sVerdict"), avgConf, acc, all.length);
    $("sChart").innerHTML = chart(all);
    $("sTable").innerHTML = `<tr><th>You said</th><th>Answers</th><th>Actually right</th><th>Difference</th></tr>` +
      buckets(all).filter((b) => b.n).map((b) => {
        const gap = Math.round((b.acc - b.l) * 100);
        const cls = Math.abs(gap) <= 10 ? "good" : gap < 0 ? "over" : "under";
        const word = Math.abs(gap) <= 10 ? "on target" : gap < 0 ? "too sure" : "too cautious";
        return `<tr><td>${fmtConf(b.l)}</td><td>${b.n}</td><td>${pct(b.acc)}</td><td class="gap ${cls}">${signed(gap)} pts, ${word}</td></tr>`;
      }).join("");
  }

  $("resetBtn").addEventListener("click", () => {
    if (!confirm("Clear all your rounds from this browser? This can't be undone.")) return;
    db = { rounds: [], seen: {} };
    save();
    renderStats();
  });

  // ---------- sources ----------
  function wikiUrl(title) {
    return "https://en.wikipedia.org/wiki/" + encodeURIComponent(title.replace(/ /g, "_")).replace(/%2C/g, ",");
  }
  function sourceLinks(c) {
    const issue = `${REPO}/issues/new?title=${encodeURIComponent("Claim check: " + c.t)}&body=${encodeURIComponent(
      `Claim: ${c.t}\nApp says: ${c.a ? "true" : "false"}\nSource: ${wikiUrl(c.s)}\n\nWhat's wrong:\n`)}`;
    return `<a href="${wikiUrl(c.s)}" target="_blank" rel="noopener">Source: ${esc(c.s)} (Wikipedia)</a>` +
      `<a href="${issue}" target="_blank" rel="noopener">Report a mistake</a>`;
  }

  // ---------- misc ----------
  function esc(s) { return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.h); toast.h = setTimeout(() => (t.hidden = true), 1800);
  }
  $("shareBtn").addEventListener("click", async () => {
    const text = `${round.share} How well calibrated are you? ${location.href.split(/[?#]/)[0]}`;
    try { await navigator.clipboard.writeText(text); toast("Result copied"); }
    catch (_) { prompt("Copy your result:", text); }
  });
  $("startBtn").addEventListener("click", startRound);
  $("againBtn").addEventListener("click", startRound);

  renderHome();
})();
