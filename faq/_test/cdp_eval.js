// 사용: node cdp_eval.js <url> <out.json> "<자바스크립트 식>" [기다림ms] — 페이지에서 식을 돌려 값을 JSON 파일로
const { spawn } = require("child_process"); const fs = require("fs"); const http = require("http");
let [, , url, out, JS = "", WAIT = "3500"] = process.argv; if (JS.startsWith("@")) JS = fs.readFileSync(JS.slice(1), "utf8");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", PORT = 9700 + Math.floor(Math.random() * 200);
const ed = spawn(EDGE, ["--headless", "--disable-gpu", "--no-first-run", "--user-data-dir=D:/tmp/edge_cdp_prof1", `--remote-debugging-port=${PORT}`, `--window-size=${process.env.W||1440},${process.env.H||900}`, "about:blank"], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = p => new Promise((res, rej) => http.get({ host: "127.0.0.1", port: PORT, path: p }, r => { let b = ""; r.on("data", d => b += d); r.on("end", () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on("error", rej));
(async () => {
  let tabs; for (let i = 0; i < 40; i++) { try { tabs = await getJSON("/json"); break; } catch (e) { await sleep(250); } }
  const t = tabs.find(x => x.type === "page"); const ws = new WebSocket(t.webSocketDebuggerUrl); let id = 0; const pend = {};
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } };
  await new Promise(r => ws.onopen = r);
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  const errs = [];
  await send("Runtime.enable"); ws.addEventListener("message", m => { const d = JSON.parse(m.data); if (d.method === "Runtime.exceptionThrown") errs.push(JSON.stringify(d.params.exceptionDetails).slice(0, 400)); });
  await send("Network.enable"); await send("Network.setCacheDisabled", { cacheDisabled: true });
  await send("Page.enable"); await send("Page.navigate", { url }); await sleep(+WAIT);
  const r = await send("Runtime.evaluate", { expression: JS, awaitPromise: true, returnByValue: true });
  if (r.result && r.result.exceptionDetails) console.log("JS error", JSON.stringify(r.result.exceptionDetails).slice(0, 600));
  else fs.writeFileSync(out, JSON.stringify(r.result && r.result.result && r.result.result.value, null, 1));
  if (errs.length) console.log("page errors:", errs.slice(0, 3).join("\n"));
  console.log("done", out);
  ws.close(); ed.kill(); process.exit(0);
})().catch(e => { console.error(e); ed.kill(); process.exit(1); });
