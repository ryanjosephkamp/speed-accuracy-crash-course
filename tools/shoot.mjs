// Opens built pages in headless Chrome, at phone width and at desktop width, by day and by night, scrolls each
// page to the end so every plate wakes, and records what a reader would meet: console errors and uncaught
// exceptions, plates that failed to draw, sideways scroll, and a picture of each plate.
//
//   node tools/shoot.mjs [--port 8770] [--out shots] [--width 390] [--both-widths] [--local key=value] kernel/ index.html
//
// --local sets a localStorage entry before each page loads (for example cc-map-view=path), and may repeat.
//
// It serves docs/ itself on the port. Chrome is found at its usual macOS place, or set CHROME. Pictures go to
// <out>/<page>-<width>-<theme>-<plate>.png. Exits 1 on any console error, exception, or failed plate.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, extname, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const flag = (k) => { const i = args.indexOf(k); if (i < 0) return false; args.splice(i, 1); return true; };
const PORT = +opt("--port", 8770);
const OUT = resolve(opt("--out", join(ROOT, "shots")));
const WIDTH = +opt("--width", 390);
const BOTH = flag("--both-widths");
const LOCAL = [];
for (let v; (v = opt("--local", null)) !== null;) LOCAL.push(v.split("="));
const pages = args.length ? args : ["index.html"];
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
  ".woff2": "font/woff2", ".png": "image/png", ".json": "application/json", ".webp": "image/webp", ".txt": "text/plain" };
const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const f = join(ROOT, "docs", p);
  if (!f.startsWith(join(ROOT, "docs")) || !existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": TYPES[extname(f)] || "application/octet-stream" });
  res.end(readFileSync(f));
}).listen(PORT);

const prof = mkdtempSync(join(tmpdir(), "shoot-"));
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
  `--user-data-dir=${prof}`, "--remote-debugging-port=0", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
const wsUrl = await new Promise((ok, no) => {
  let buf = "";
  const t = setTimeout(() => no(new Error("Chrome did not start")), 20000);
  chrome.stderr.on("data", (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(t); ok(m[1]); } });
});
const ws = new WebSocket(wsUrl);
await new Promise((ok) => ws.addEventListener("open", ok));
let nextId = 1;
const waiting = new Map(), listeners = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && waiting.has(m.id)) { const { ok, no } = waiting.get(m.id); waiting.delete(m.id); m.error ? no(new Error(m.error.message)) : ok(m.result); }
  else listeners.forEach((f) => f(m));
});
const send = (method, params = {}, sessionId) => new Promise((ok, no) => {
  const id = nextId++; waiting.set(id, { ok, no });
  ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
const S = (m, p) => send(m, p, sessionId);
const problems = [];
let current = "";
listeners.push((m) => {
  if (m.sessionId !== sessionId) return;
  if (m.method === "Runtime.exceptionThrown") problems.push(`${current}: exception: ${m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text}`);
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") problems.push(`${current}: console.error: ${m.params.args.map((a) => a.value ?? a.description).join(" ")}`);
  if (m.method === "Log.entryAdded" && m.params.entry.level === "error") problems.push(`${current}: ${m.params.entry.source}: ${m.params.entry.text} ${m.params.entry.url || ""}`);
});
await S("Runtime.enable"); await S("Log.enable"); await S("Page.enable");
if (LOCAL.length) await S("Page.addScriptToEvaluateOnNewDocument", { source: `try { ${LOCAL.map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)});`).join(" ")} } catch (e) {}` });
const evalJS = async (expr) => (await S("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result.value;

mkdirSync(OUT, { recursive: true });
const report = [];
for (const page of pages) {
  for (const width of BOTH ? [390, 1280] : [WIDTH]) {
    for (const theme of ["light", "dark"]) {
      current = `${page} ${width}px ${theme}`;
      await S("Emulation.setDeviceMetricsOverride", { width, height: 860, deviceScaleFactor: 2, mobile: width < 768 });
      await S("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: theme }, { name: "prefers-reduced-motion", value: "reduce" }] });
      await S("Page.navigate", { url: `http://localhost:${PORT}/${page}` });
      await sleep(1500);
      // walk down the page so every plate wakes, then wait for the solver
      const H = await evalJS("document.documentElement.scrollHeight");
      for (let y = 0; y < H; y += 500) { await evalJS(`window.scrollTo(0, ${y})`); await sleep(120); }
      await sleep(6000);
      const info = await evalJS(`(() => {
        const plates = [...document.querySelectorAll("figure.plate-live, .strip, .cmap, #hero-proof")].map((f) => {
          const r = f.getBoundingClientRect();
          return { id: f.id || f.className, fail: !!f.querySelector(".plate-fail"), empty: !!f.querySelector(".demo-root") && !f.querySelector(".demo-root").children.length,
            x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height };
        });
        return { plates, sideways: document.documentElement.scrollWidth > innerWidth + 1, scrollWidth: document.documentElement.scrollWidth,
          rawTex: (document.body.innerText.match(/\\\\(frac|mathbb|tau|varepsilon|operatorname)/g) || []).length,
          unfilled: (document.body.innerHTML.match(/\\{\\{[^}]+\\}\\}/g) || []) };
      })()`);
      if (info.sideways) problems.push(`${current}: sideways scroll (${info.scrollWidth}px wide)`);
      if (info.rawTex) problems.push(`${current}: ${info.rawTex} pieces of raw TeX in the text`);
      if (info.unfilled.length) problems.push(`${current}: unfilled tokens ${info.unfilled.slice(0, 5).join(" ")}`);
      for (const p of info.plates) {
        if (p.fail) problems.push(`${current}: ${p.id} shows its failure message`);
        if (p.empty) problems.push(`${current}: ${p.id} drew nothing`);
        if (!p.w || !p.h) continue;
        const shot = await S("Page.captureScreenshot", { format: "png", captureBeyondViewport: true,
          clip: { x: p.x, y: p.y, width: p.w, height: Math.min(p.h, 4000), scale: 1 } });
        const name = `${page.replace(/\/?index\.html$|\/$/g, "").replace(/\W+/g, "_") || "contents"}-${width}-${theme}-${p.id.replace(/\W+/g, "_")}.png`;
        writeFileSync(join(OUT, name), Buffer.from(shot.data, "base64"));
      }
      report.push(`${current}: ${info.plates.length} plates`);
    }
  }
}
console.log(report.join("\n"));
console.log(problems.length ? `\n${problems.length} problems:\n` + problems.join("\n") : "\nno console errors, exceptions, failed plates, raw TeX, or sideways scroll");
console.log(`pictures in ${OUT}`);
ws.close(); chrome.kill(); server.close();
try { rmSync(prof, { recursive: true, force: true }); } catch (e) { /* Chrome may still hold it */ }
process.exit(problems.length ? 1 : 0);
