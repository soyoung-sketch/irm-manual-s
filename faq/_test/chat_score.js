// node chat_score.js <results.json> — 정답률 집계 + 틀린 것 목록
const fs = require("fs"); const R = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const norm = s => String(s || "").replace(/\s+/g, "");
let inS = 0, top1 = 0, top3 = 0, falseNone = 0, oos = 0, oosOk = 0, oosWrong = [];
const fails = [];
R.forEach(r => {
  const exp = (r.expect || []).map(norm);
  if (!exp.length) { oos++; if (["none", "cs", "hello", "chat", "thanks"].includes(r.kind)) oosOk++; else oosWrong.push(`${r.q} → ${r.kind}:${r.top}`); return; }
  inS++;
  const t = norm(r.top), l = (r.list || []).map(norm);
  const ok1 = (r.kind === "menu" || r.kind === "maybe" || r.kind === "faq") && exp.includes(t);
  const ok3 = ok1 || l.slice(0, 4).some(x => exp.includes(x));
  if (ok1) top1++; if (ok3) top3++;
  if (r.kind === "none") falseNone++;
  if (!ok1) fails.push(`[${r.intent}] ${r.q}\n     기대: ${r.expect.join(", ")}\n     결과: ${r.kind} ${r.top} ${r.sc || ""} | ${l.slice(0, 4).join(" / ")}`);
});
console.log(`매뉴얼 안 질문 ${inS}개: 1순위 정답 ${top1} (${(100 * top1 / inS).toFixed(1)}%), 4순위 안 ${top3} (${(100 * top3 / inS).toFixed(1)}%), 못 찾음 처리 ${falseNone}`);
console.log(`매뉴얼 밖 질문 ${oos}개: 고객센터 안내 ${oosOk} (${oos ? (100 * oosOk / oos).toFixed(1) : 0}%)`);
if (process.argv.includes("-v")) { console.log("\n--- 틀린 것 ---\n" + fails.join("\n")); console.log("\n--- 매뉴얼 밖인데 답함 ---\n" + oosWrong.join("\n")); }
