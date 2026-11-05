// 채팅 도우미 넣기: faq/자주묻는질문.md(질문·답변) + faq/chat_engine.js(엔진) → index.html 의 AI_CHAT:BEGIN~END 사이
// 사용: node faq/build_faq.js            (s 폴더에서)
//       node faq/build_faq.js --check    (index.html 은 그대로 두고 몇 개 읽혔는지만)
const fs = require("fs"), path = require("path");
const DIR = __dirname, HTML = path.join(DIR, "..", "index.html");
const MD = path.join(DIR, "자주묻는질문.md"), ENGINE = path.join(DIR, "chat_engine.js");
const MARK = "<!-- 여기부터 실제 질문·답변";

function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function inline(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>"); }
function answerHtml(lines) {
  const out = []; let list = null;
  const close = () => { if (list) { out.push(`<${list.tag} class="ai-faq-list">` + list.items.map(t => `<li>${t}</li>`).join("") + `</${list.tag}>`); list = null; } };
  lines.forEach(l => {
    const t = l.trim();
    let m;
    if (!t) { close(); return; }
    if ((m = t.match(/^(\d+)[.)]\s+(.*)$/))) { if (!list || list.tag !== "ol") { close(); list = { tag: "ol", items: [] }; } list.items.push(inline(m[2])); return; }
    if ((m = t.match(/^[-*]\s+(.*)$/))) { if (!list || list.tag !== "ul") { close(); list = { tag: "ul", items: [] }; } list.items.push(inline(m[1])); return; }
    close(); out.push(`<p>${inline(t)}</p>`);
  });
  close();
  return out.join("");
}
function parse(md) {
  const at = md.indexOf(MARK);
  let body = at >= 0 ? md.slice(md.indexOf("\n", at) + 1) : md;
  body = body.replace(/<!--[\s\S]*?-->/g, "").replace(/```[\s\S]*?```/g, "");
  const faqs = [];
  body.split(/^## /m).slice(1).forEach(block => {
    const lines = block.split(/\r?\n/);
    const q = lines.shift().replace(/^Q[.:]?\s*/, "").trim();
    if (!q) return;
    const f = { q, alt: [], menu: [], tags: [] }, ans = [];
    lines.forEach(l => {
      let m;
      if ((m = l.match(/^\s*-\s*다르게 묻는 말\s*[:：]\s*(.*)$/))) f.alt = m[1].split("/").map(s => s.trim()).filter(Boolean);
      else if ((m = l.match(/^\s*-\s*관련 메뉴\s*[:：]\s*(.*)$/))) f.menu = m[1].split(/[,，]/).map(s => s.trim()).filter(Boolean);
      else if ((m = l.match(/^\s*-\s*낱말\s*[:：]\s*(.*)$/))) f.tags = m[1].split(/[,，]/).map(s => s.trim()).filter(Boolean);
      else if (/^---+\s*$/.test(l)) return;
      else ans.push(l);
    });
    f.a = answerHtml(ans);
    if (f.a) faqs.push(f);
  });
  return faqs;
}

const faqs = parse(fs.readFileSync(MD, "utf8"));
console.log(`자주 묻는 질문 ${faqs.length}개 읽음`);
if (process.argv.includes("--check")) { faqs.forEach((f, i) => console.log(`${i + 1}. ${f.q}  (다른 말 ${f.alt.length} · 메뉴 ${f.menu.join(", ") || "-"})`)); process.exit(0); }

const engine = fs.readFileSync(ENGINE, "utf8").replace("/*FAQ_DATA*/", "const AI_FAQ = " + JSON.stringify(faqs, null, 1).replace(/<\/script/gi, "<\\/script") + ";");
let html = fs.readFileSync(HTML, "utf8");
const B = "// ===== AI_CHAT:BEGIN (faq/build_faq.js 가 만듦 — 여기 직접 고치지 말고 faq/chat_engine.js·자주묻는질문.md 를 고친 뒤 다시 돌리기) =====";
const E = "// ===== AI_CHAT:END =====";
const i = html.indexOf("// ===== AI_CHAT:BEGIN"), j = html.indexOf(E);
if (i < 0 || j < 0) { console.error("index.html 에 AI_CHAT:BEGIN/END 표시가 없습니다."); process.exit(1); }
html = html.slice(0, i) + B + "\n" + engine.trim() + "\n" + html.slice(j);
fs.writeFileSync(HTML, html);
console.log("index.html 에 넣음");
