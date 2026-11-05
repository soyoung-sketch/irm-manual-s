// 채팅 도우미 시험: node faq/_test/run_test.js [-v]  (s 폴더에서, 엣지 브라우저를 화면 없이 띄워 questions.json 을 모두 물어봄)
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const D = __dirname, Q = JSON.parse(fs.readFileSync(path.join(D, "questions.json"), "utf8"));
const js = path.join(D, "_eval_run.js"), out = path.join(D, "_eval_result.json");
fs.writeFileSync(js, fs.readFileSync(path.join(D, "eval_tpl.js"), "utf8").replace("__Q__", JSON.stringify(Q.map(x => ({ q: x.q, expect: x.expect, intent: x.intent })))));
const url = "file:///" + path.join(D, "..", "..", "index.html").split(path.sep).join("/");
execFileSync(process.execPath, [path.join(D, "cdp_eval.js"), url, out, "@" + js, "4000"], { stdio: "inherit" });
execFileSync(process.execPath, [path.join(D, "chat_score.js"), out].concat(process.argv.includes("-v") ? ["-v"] : []), { stdio: "inherit" });
