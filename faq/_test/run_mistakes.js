// 실수·막힘 질문 시험: node faq/_test/run_mistakes.js [-v]  (questions_mistakes.json — 메뉴·탭·'안 되는 단계' 알려 주는지)
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const D = __dirname, Q = JSON.parse(fs.readFileSync(path.join(D, "questions_mistakes.json"), "utf8"));
const js = path.join(D, "_eval_m_run.js"), out = path.join(D, "_eval_m_result.json");
fs.writeFileSync(js, `(function(){const Q=${JSON.stringify(Q.map(x => ({ q: x.q, expect: x.expect, tab: x.expect_tab, no: /^불가/.test(x.note || "") })))};const d=document.createElement("div");
return Q.map(x=>{const r=aiAnswer(x.q);d.innerHTML=r.html;const txt=d.textContent;const v=d.querySelector(".ai-verdict");return {q:x.q,expect:x.expect,tab:x.tab,no:x.no,kind:r.kind,top:r.top||"",list:(r.list||[]).map(s=>s.replace(/:[0-9.]+$/,"")),tabHit:!!x.tab&&txt.includes(x.tab),noHit:x.no&&/(할 수 없|안내가 없)/.test(txt)&&(!x.tab||txt.includes(x.tab)),verdict:v?v.textContent:""};});})()`);
const url = "file:///" + path.join(D, "..", "..", "index.html").split(path.sep).join("/");
execFileSync(process.execPath, [path.join(D, "cdp_eval.js"), url, out, "@" + js, "4000"], { stdio: "inherit" });
execFileSync(process.execPath, [path.join(D, "score_mistakes.js")].concat(process.argv.includes("-v") ? ["-v"] : []), { stdio: "inherit" });
