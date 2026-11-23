// Verifies every claim's source: the Wikipedia article must exist and contain
// each evidence phrase. Run: node scripts/check-sources.mjs
// Prints context around each phrase so a human can confirm it supports the claim.
import { readFileSync, writeFileSync } from "node:fs";
import vm from "node:vm";

const src = readFileSync(new URL("../questions.js", import.meta.url), "utf8");
const ctx = { window: {} };
vm.runInNewContext(src, ctx);
const claims = ctx.window.CLAIMS;
const showContext = process.argv.includes("--context");

const t = claims.filter((c) => c.a).length;
console.log(`${claims.length} claims (${t} true, ${claims.length - t} false)`);

const dupes = claims.map((c) => c.t).filter((x, i, a) => a.indexOf(x) !== i);
if (dupes.length) console.log("DUPLICATE claims:", dupes);

// Articles are cached on disk (gitignored) so re-runs don't hammer the API.
const CACHE_FILE = new URL("./.wiki-cache.json", import.meta.url);
const fresh = process.argv.includes("--fresh");
let cache = {};
try { if (!fresh) cache = JSON.parse(readFileSync(CACHE_FILE, "utf8")); } catch {}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function article(title) {
  if (title in cache) return cache[title];
  const url = "https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&formatversion=2&titles=" + encodeURIComponent(title);
  for (let attempt = 0; attempt < 6; attempt++) {
    await sleep(attempt ? 20000 * attempt : 2500);
    const res = await fetch(url, { headers: { "User-Agent": "CalibrateSourceCheck/1.0" } });
    const body = await res.text();
    if (!body.startsWith("{")) continue; // rate-limited: back off and retry
    const page = JSON.parse(body).query.pages[0];
    cache[title] = page.missing ? null : { title: page.title, text: page.extract || "" };
    writeFileSync(CACHE_FILE, JSON.stringify(cache));
    return cache[title];
  }
  throw new Error(`Wikipedia kept refusing "${title}"`);
}

let bad = 0;
for (const [i, c] of claims.entries()) {
  if (!c.s || !c.e?.length) { console.log(`#${i} MISSING source/evidence: ${c.t}`); bad++; continue; }
  const page = await article(c.s);
  if (!page) { console.log(`#${i} NO ARTICLE "${c.s}": ${c.t}`); bad++; continue; }
  if (page.title !== c.s) console.log(`#${i} note: "${c.s}" redirects to "${page.title}"`);
  const lower = page.text.toLowerCase();
  for (const e of c.e) {
    const at = lower.indexOf(e.toLowerCase());
    if (at < 0) { console.log(`#${i} MISSING "${e}" in "${c.s}": ${c.t}`); bad++; }
    else if (showContext) console.log(`#${i} [${c.s}] …${page.text.slice(Math.max(0, at - 120), at + 160).replace(/\s+/g, " ")}…`);
  }
}
console.log(bad ? `${bad} problem(s)` : "All sources check out.");
process.exit(bad ? 1 : 0);
