// ----- 채팅 도우미(브라우저 안에서만 — 서버·외부 전송 없음) -----
// 질문 말투를 걷어내고 핵심어만 → ① 회사 자주 묻는 질문(AI_FAQ) ② 메뉴얼 카드에서 답 만들기 ③ 못 찾으면 고객센터 안내.
// 원본: faq/chat_engine.js → node faq/build_faq.js 가 index.html 의 AI_CHAT:BEGIN~END 사이에 넣는다.
const AI_CS = { name: "아이리젠 고객센터", tel: "", hours: "" }; // 전화번호·상담 시간이 정해지면 채운다
/*FAQ_DATA*/

let aiIndex = null;
function aiStripTags(s) { return (s || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&"); }
function aiNorm(s) { return aiStripTags(s).toLowerCase().replace(/[\s·,()\[\]/.\-_+~!?:;"'’‘“”…※<>]+/g, ""); }
function aiBig(s) { const b = {}; for (let i = 0; i < s.length - 1; i++) { const g = s.substr(i, 2); b[g] = (b[g] || 0) + 1; } return b; }
// 한글 음절 → 자모 분해(음절 안 오타 보정용)
function aiJamo(s) {
  const L = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
  const V = ["ㅏ","ㅐ","ㅑ","ㅒ","ㅓ","ㅔ","ㅕ","ㅖ","ㅗ","ㅘ","ㅙ","ㅚ","ㅛ","ㅜ","ㅝ","ㅞ","ㅟ","ㅠ","ㅡ","ㅢ","ㅣ"];
  const T = ["","ㄱ","ㄲ","ㄳ","ㄴ","ㄵ","ㄶ","ㄷ","ㄹ","ㄺ","ㄻ","ㄼ","ㄽ","ㄾ","ㄿ","ㅀ","ㅁ","ㅂ","ㅄ","ㅅ","ㅆ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
  let out = "";
  for (const ch of s) {
    const code = ch.charCodeAt(0) - 0xAC00;
    if (code >= 0 && code < 11172) out += L[Math.floor(code / 588)] + V[Math.floor((code % 588) / 28)] + T[code % 28];
    else out += ch;
  }
  return out;
}
// 포함 비율: 질의 bigram 중 대상에 들어 있는 비율(0~1)
function aiCover(q, t) { let qt = 0, hit = 0; for (const k in q) { qt += q[k]; if (t[k]) hit += Math.min(q[k], t[k]); } return qt ? hit / qt : 0; }
// 근사 부분일치(편집거리): 질의를 대상의 substring 으로 볼 때 최소 편집수
function aiFuzzyContain(q, t) {
  const m = q.length, n = t.length;
  if (!m) return 0;
  let prev = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    const cur = new Array(n + 1);
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = q[i - 1] === t[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j - 1] + cost, prev[j] + 1, cur[j - 1] + 1);
    }
    prev = cur;
  }
  let best = Infinity;
  for (let j = 0; j <= n; j++) best = Math.min(best, prev[j]);
  return best;
}

// ── 질문 말투 걷어내기 ──
// 긴 것부터: 붙여 쓴 질문("발주어떻게해야해")도 이 말들을 빼면 핵심어만 남는다
const AI_FILLER = ["어떻게해야하나요","어떻게해야되나요","어떻게해야돼요","어떻게해야해요","어떻게해야해","어떻게해야","어떻게하나요","어떻게하면","어떻게해요","어떻게해","어떻게","어떡해요","어떡해","어케",
  "하는방법","하는법","방법좀","방법","알려주세요","알려줘요","알려줘","가르쳐주세요","가르쳐줘","궁금합니다","궁금해요","궁금해",
  "하고싶어요","하고싶은데","하고싶어","보고싶어요","보고싶은데","보고싶어","고싶어요","고싶은데","고싶어","싶어요","싶은데","싶어",
  "하는방법","는방법","는법","하려면","으려면","려면","하려고","보려면","보는법","하면되나요","해야하나요","해야되나요","해야해요","해야해","해야돼","해야","할수있나요","할수있어요","할수있어","할수있","가능한가요","가능해요","가능",
  "어디서해요","어디서하나요","어디서","어디에","어디야","어딨어요","어딨어","어디있나요","어디있어요","어디",
  "뭐예요","뭐에요","뭔가요","뭐야","무엇인가요","무엇","무슨뜻","뜻이","뜻",
  "안되는데요","안되는데","안돼요","안되요","안돼","안됨","안되","되나요","돼요","되요",
  "지우고싶어요","지우고싶어","지우고","지워주세요","지워줘","지워","지우려면","없애고","없애","고치고싶어","고치려면","고치고","고쳐야","고쳐","바꾸고싶어","바꾸려면","되돌리고싶어","되돌리려면","되돌리고","되돌릴수있나","되돌릴","살리고싶어","살리려면","살리고",
  "잘못해서","잘못했는데","잘못했어요","잘못했어","잘못","실수로","실수해서","실수","엉뚱하게","엉뚱한","엉뚱","착각해서","착각","사람한테","사람에게","줬어요","줬는데","줬어",
  "하나요","했는데","했어요","해주세요","해줘","해요","합니다","하는데","하면","할때","하기","좀","요좀","왜","제가","저","우리","거","것","그","이거","그거","이건","좀요","요"];
// 띄어 쓴 낱말 끝의 조사
const AI_JOSA = /(별로는|별로|에서는|에서|으로는|으로|에는|에게|한테|까지|부터|처럼|이랑|랑|하고|은|는|이|가|을|를|에|로|도|만|의|요)$/;
// 같은 뜻 낱말(왼쪽 말이 나오면 오른쪽 메뉴얼 용어로도 찾는다)
const AI_SYN = [
  [["주문","오더"], ["발주"]], [["거래처"], ["매입처","매출처"]], [["납품업체","공급업체","업체"], ["매입처"]], [["도매처","도매거래처","납품한","주문받"], ["매출처","주문서"]],
  [["회원","단골"], ["매출처","회원"]], [["손님","고객"], ["회원"]], [["가격","값","금액"], ["단가","판매가"]], [["가격표","프라이스카드","쇼카드","가격판"], ["가격표","pop"]],
  [["라벨","스티커"], ["바코드인쇄","라벨"]], [["환불"], ["환불","반품"]], [["안맞","틀려","차이","틀림","다르"], ["재고조정","재고실사"]],
  [["재고조사","실사"], ["재고실사"]], [["버리","버림","버린","버렸","유통기한지난"], ["폐기"]], [["직원","알바","아르바이트","캐셔","계산원"], ["사원","계산원"]],
  [["퇴사","그만둔","그만뒀"], ["사원","권한"]], [["못보게","막기","막아","제한"], ["권한","제한"]], [["세일","원플러스원","1+1","2+1","덤"], ["행사"]],
  [["문자"], ["sms"]], [["팩스"], ["fax"]], [["외상","미수"], ["미수금"]], [["수금","돈받"], ["미수금입금","수금"]],
  [["잘팔리","많이팔린","인기"], ["순위"]], [["나눠","쪼개","나누어팔"], ["소분"]], [["매대","진열","선반"], ["매대","로케이션"]],
  [["스캔","찍"], ["바코드읽기","상품찍기"]], [["앱","어플","핸디","단말기"], ["pda"]], [["포스","계산대"], ["포스","pos"]],
  [["신상품","새상품","상품추가","상품등록"], ["상품등록"]], [["유통기한","유효기간","소비기한"], ["유효일"]], [["사입"], ["매입"]],
  [["계산서"], ["세금계산서"]], [["카드"], ["카드결제"]], [["현금영수증"], ["현금영수증"]], [["엑셀","액셀"], ["엑셀"]],
  [["외국인","택스리펀","텍스리펀","택스프리"], ["환급"]], [["비번","비밀번호","로그인"], ["로그인","비밀번호"]], [["마감"], ["마감"]],
  [["뽑","출력","프린트","프린터"], ["인쇄"]], [["보내","발송"], ["전송"]], [["들어온","입고된","받은물건"], ["입고","매입"]],
  [["팔린","판거","판매된","팔았"], ["판매","매출"]], [["들여온","사온","사입한"], ["매입"]], [["돌려받","돌려줘"], ["반품","회수"]],
  [["넣어주","넣어줘","충전","적립해","쌓아"], ["지급"]], [["빼","깎"], ["차감"]], [["만들","생성","새로추가"], ["등록","추가"]],
  [["아이디","계정"], ["사원","아이디"]], [["자주쓰","즐겨","고정"], ["즐겨찾기"]], [["올리","업로드"], ["업로드"]],
  [["메모","코멘트"], ["메모"]], [["분류"], ["카테고리","분류"]], [["그룹"], ["카테고리","그룹"]], [["합친","합치"], ["통합"]],
  [["송금","대금","물건값"], ["채무","지급"]], [["안팔린","안팔리","미판매"], ["미판매"]], [["진열위치","매대위치"], ["로케이션"]],
  [["지정안","미지정"], ["미지정"]], [["재료","세트상품","소요량","레시피"], ["소요량"]], [["마진","손님수","객수","하루매출","일일매출","일보"], ["영업일보"]],
  [["발주한거","발주내역","발주한것"], ["발주현황"]], [["지급한금액","지급내역","지급통계"], ["채무지급현황"]],
  [["등급","골드","vip","적립률","적립제외","적립안"], ["등급"]], [["글씨","글자크기","폰트"], ["폰트"]], [["연령","나이"], ["연령별"]],
  [["카드매출","현금매출","결제수단","카드현금","결제금액"], ["결제수단별"]], [["먹은","먹었","비품","소모품","직원용","내부사용"], ["자가사용"]],
  [["판매중지","안파는","단종"], ["판매상태","판매중지"]], [["첫화면","메인화면","홈화면"], ["home"]],
];
// 어디에나 나오는 낱말 — 찾는 힘을 약하게(주제가 아니라 할 일을 가리키는 말)
const AI_GENERIC = ["상품","입력","등록","조회","확인","보기","처리","설정","관리","화면","메뉴","방법","하기","목록","내역","정보","버튼","사용","관련","기능","프로그램","irm","erp","전산","오늘","지금","새로","다시","전부","모두","한번에","일괄"];
const AI_INTENT = [
  ["error", /(안\s*(돼|되|나와|나오|보여|보이|떠|뜨|먹|열려|열리|눌|찍|들어|맞)|오류|에러|error|떠요|뜹니다|뜨는데|떴어|나와요|막혀|막혔|실패|없습니다|않습니다|못\s*(해|하|찾)|멈췄|먹통|이상해)/i],
  ["where", /(어디|어느\s*(메뉴|화면|곳|탭)|위치|어딨|찾아야)/],
  ["what", /(뭐(예|에|야|지|죠)|뭔가|무엇|무슨\s*뜻|뜻이|의미|이란|차이)/],
  ["how", /(어떻게|어케|어떡|방법|하는\s*법|하려면|순서|절차|하고\s*싶|할\s*수\s*있|가능)/],
];
// 메뉴얼이 다루지 않는 일(기계 고장·요금·계약·설치 일정·다른 회사 프로그램 등) → 고객센터로
const AI_OUT = /(전원|고장|깜빡|먹통|부팅|종이\s*(가|이)?\s*(걸|안\s*나)|용지|프린터\s*(가|에서|기)|모니터\s*(가|화면)|인터넷|와이파이|wifi|랜선|공유기|설치\s*(기사|일정|날짜|비용)|기사님|방문\s*(해|일정|가능)|요금|자동이체|계약|해지|약정|비용|청구|부가세\s*신고|종합소득세|4대\s*보험|배달앱|배민|쿠팡이츠|요기요|다른\s*(회사|업체)|타사|비교하면|데이터.{0,8}옮겨|이전해\s*주)/i;
function aiIntent(q) { for (const [k, re] of AI_INTENT) if (re.test(q)) return k; return "how"; }
function aiStripFiller(s) {
  let t = s;
  for (const f of AI_FILLER) if (f.length >= 2) t = t.split(f).join(" ");
  return t;
}
function aiKeywords(q) {
  const raw = aiStripTags(q).toLowerCase().replace(/[?!.,~…"'“”‘’()]/g, " ");
  const vocab = aiBuildIndex().vocab;
  const words = raw.split(/\s+/).filter(Boolean).map(w => {
    let x = aiStripFiller(w).trim();
    if (x.includes(" ")) return x.split(/\s+/);
    const orig = x;
    if (x.length > 1) x = x.replace(AI_JOSA, "");
    if (x.length >= 3) x = x.replace(/(하는|하고|해서|하면|하려|했는|했어|하기|되는|되고|돼서|됐어|했|해|하)$/, "") || x;
    if (x.length >= 3 && /[한할함된될]$/.test(x) && vocab.includes(x.slice(0, -1))) x = x.slice(0, -1);   // '등록한'·'지급한' → 메뉴얼 낱말
    if (x !== orig && orig.length >= 3 && /가$/.test(orig) && vocab.includes(orig)) x = orig;   // '판매가'처럼 조사 같은 글자로 끝나는 메뉴얼 낱말은 그대로
    return [x];
  }).flat().map(w => w.replace(/[^0-9a-z가-힣+]/g, "")).map(w => aiSegment(w, vocab)).flat().map(w => w.length >= 3 ? w.replace(/별$/, "") : w).filter(w => w && !AI_FILLER.includes(w));
  const out = [];
  words.forEach(w => { if (w.length >= 2 || /[0-9a-z]/.test(w) || ["돈","값","표","앱"].includes(w)) { if (!out.includes(w)) out.push(w); } });
  return out;
}
// 띄어 쓰지 않은 긴 낱말("오늘카드현금결제금액") → 메뉴얼 낱말·같은 뜻 말로 앞에서부터 가장 길게 맞춰 쪼갬
function aiSegment(w, vocab) {
  if (w.length < 5 || vocab.includes(w)) return [w];
  const dict = new Set(vocab.concat(...AI_SYN.map(x => x[0])));
  const out = []; let i = 0, rest = "";
  while (i < w.length) {
    let hit = "";
    for (let L = Math.min(8, w.length - i); L >= 2; L--) { const p = w.substr(i, L); if (dict.has(p)) { hit = p; break; } }
    if (hit) { if (rest) { out.push(rest); rest = ""; } out.push(hit); i += hit.length; }
    else { rest += w[i]; i++; }
  }
  if (rest) out.push(rest);
  return out.length > 1 ? out : [w];
}
function aiSynFor(w) {
  const add = [];
  AI_SYN.forEach(([from, to]) => { if (from.some(f => w.includes(f) || (w.length >= 2 && f.startsWith(w) && w.length >= f.length - 1))) to.forEach(t => { if (t !== w && !add.includes(t)) add.push(t); }); });
  return add;
}

// ── 메뉴얼 → 검색 목록(메뉴마다 카드 단위) ──
function aiCleanHtml(s) {
  return String(s || "")
    .replace(/<b class=['"]dlink['"] onclick=(["'])((?:(?!\1).)*)\1>(.*?)<\/b>/g, (m, qt, fn, txt) => /^openSub\(/.test(fn) ? m : `<b>${txt}</b>`)
    .replace(/🔗\s*<b>[^<]*(보기|바로가기)<\/b>/g, "")
    .replace(/^%%/, "");
}
function aiCards(d) {
  const cards = [];
  (d || []).forEach(it => {
    const lines = []; let title = "";
    const push = s => { if (typeof s === "string" && s !== "⬇" && s !== "---" && aiStripTags(s).trim()) lines.push(s); };
    if (it.type === "note") push(it.text);
    else if (it.type === "step") { title = it.title || ""; push(it.body); (it.subs || []).forEach(push); }
    else if (it.type === "bullet") { title = it.title || ""; (it.subs || []).forEach(push); (it.flow || []).forEach(push); }
    else if (it.type === "section") { title = it.label || ""; (it.subs || []).forEach(push); }
    else if (it.type === "flow") (it.steps || []).forEach(push);
    else if (it.type === "pair") (it.items || []).forEach(pi => { push(pi.title ? "<b>" + pi.title + "</b>" : ""); (pi.subs || []).forEach(push); });
    else if (it.type === "qa") { title = it.q || ""; push(it.a); (it.subs || []).forEach(push); }
    else { title = it.title || it.label || ""; push(it.text); push(it.body); (it.subs || []).forEach(push); }
    if (!title && !lines.length) return;
    const plain = aiStripTags(title + " " + lines.join(" "));
    cards.push({ type: it.type, num: it.num || "", ystar: !!it.ystar, title, lines, n: aiNorm(plain), tn: aiNorm(title) });
  });
  return cards;
}
function aiSimTips(pg) {
  const sim = typeof SIM !== "undefined" ? SIM[pg] : null; if (!sim || !sim.screens) return "";
  let t = "";
  Object.values(sim.screens).forEach(sc => (sc.btns || []).forEach(b => { if (b.tip) t += " " + aiStripTags(b.tip); }));
  return t;
}
function aiBuildIndex() {
  if (aiIndex) return aiIndex;
  aiIndex = [];
  NAVSECS().forEach(ch => {
    if (ch.hidden) return;
    let grp = "";
    (ch.subs || []).forEach(sub => {
      if (sub.type === "divider") { grp = sub.title || ""; return; }
      const title = (sub.title || "").replace(/<br\s*\/?>/gi, " ");
      const pages = (sub.pages || []).map((pg, i) => {
        const label = (sub.pageLabels || [])[i] || "";
        const subtitle = (sub.subtitles || {})[pg] || "";
        const cards = aiCards(DESCS[pg]);
        const head = label + " | " + subtitle + " | " + cards.map(c => aiStripTags(c.title)).join(" | ");
        return { pg, i, label, subtitle, cards, acts: aiActsOf(cards), ln: aiNorm(label), hn: aiNorm(head), n: aiNorm(label + " " + subtitle + " " + cards.map(c => c.title + " " + c.lines.join(" ")).join(" ") + " " + aiSimTips(pg)) };
      });
      const titleN = aiNorm(title), grpN = aiNorm(grp + ch.title);
      const headN = pages.map(p => p.hn).join("|");                         // 탭 이름·쪽 소제목·카드 제목
      const hayN = titleN + grpN + pages.map(p => p.n).join("");
      aiIndex.push({ ch, sub, grp, title, titleN, grpN, headN, hayN, pages, titleBig: aiBig(titleN), hayBig: aiBig(hayN), titleJamo: aiJamo(titleN), hq: ch.id === "s-ch8" });
    });
  });
  // 낱말 목록(띄어 쓴 제목·탭·카드 제목 낱말) — 조사 떼기 판단용
  const voc = new Set();
  aiIndex.forEach(it => [it.title].concat(it.pages.map(p => p.label + " " + p.subtitle + " " + p.cards.map(c => aiStripTags(c.title)).join(" "))).join(" ").split(/[\s·,()/\[\]>|]+/).forEach(w => { w = aiNorm(w); if (w.length >= 2) voc.add(w); }));
  aiIndex.vocab = [...voc];
  aiIndex.df = {};
  return aiIndex;
}
// 몇 개 메뉴에 나오는 낱말인가 → 흔한 낱말일수록 약하게(0.2~1)
function aiIdf(t) {
  const idx = aiBuildIndex();
  if (idx.df[t] == null) idx.df[t] = idx.filter(it => it.hayN.includes(t)).length;
  const df = idx.df[t], N = idx.length;
  if (!df) return 1;
  return Math.min(1, Math.max(0.2, Math.log(N / df) / Math.log(N / 3)));
}
// 낱말 하나가 대상에 얼마나 맞나(0~1): 메뉴 이름 > 탭·카드 제목 > 묶음 이름 > 본문
function aiTermScore(a, it) {
  if (!a) return 0;
  if (it.titleN.includes(a)) return 1;
  let sc = 0;
  if (it.headN.includes(a)) sc = 0.8;
  else if (it.grpN.includes(a)) sc = 0.64;
  else { const cnt = it.hayN.split(a).length - 1; if (cnt) sc = Math.min(0.62, 0.46 + 0.04 * cnt); }
  if (a.length >= 2) {
    const ab = aiBig(a);
    sc = Math.max(sc, 0.82 * aiCover(ab, it.titleBig), 0.42 * aiCover(ab, it.hayBig));
    if (a.length >= 3) { const aj = aiJamo(a); const jf = 1 - aiFuzzyContain(aj, it.titleJamo) / aj.length; if (jf >= 0.78) sc = Math.max(sc, 0.9 * jf); }
  }
  return sc;
}
function aiSlotScore(slot, it) {
  let best = aiTermScore(slot.w, it);
  slot.syn.forEach(s => { best = Math.max(best, 0.88 * aiTermScore(s, it)); });
  return best;
}
const AI_HOW_T = /(등록|입력|설정|작성|발급|전송|지급|관리|켜기|하기|결제|찍기|설치|로그인)/;
const AI_LOOK_T = /(조회|현황|목록|내역|원장|통계|순위)/;
const AI_LOOK_Q = /(조회|확인|현황|목록|내역|보기|봐|보려|보고|보는|찾아보|얼마나|몇|통계|합계|매출액)/;
const AI_FIX_Q = /(취소|수정|삭제|되돌|복구|고치|바꾸|변경|반려|보류|완료처리|승인)/;
// ── 실수 바로잡기: 질문의 '할 일'(취소·수정·되돌리기…)과 메뉴얼 카드의 '가능한 작업' 줄을 맞춘다 ──
const AI_ACT = [
  ["취소", /취소/], ["수정", /(수정|고치|고쳐|바꾸|바꿔|변경|틀리게|틀렸)/], ["되돌리기", /(되돌|복구|원래대로|살려|다시\s*살)/],
  ["삭제", /(삭제|지우|지워|없애)/], ["반려", /반려/], ["인쇄", /(인쇄|출력|뽑)/],
];
const AI_MISTAKE = /(잘못|실수|엉뚱|틀리게|틀렸|잘\s*못\s*(눌|넣|입력|등록|잡)|착각)/;
function aiActKey(label) { const t = aiStripTags(label); for (const [k, re] of AI_ACT) if (re.test(t)) return k; return ""; }
function aiActsOf(cards) {
  const acts = [];
  cards.forEach(c => c.lines.concat(c.title ? [c.title] : []).forEach(l => {
    let m = l.match(/^\s*<b>([^<]{1,10})<\/b>\s*:\s*/), key = "";
    if (m) key = aiActKey(m[1]);
    else { const b = l.match(/class=['"]ui-btn['"]>([^<]{1,12})<\/span>/); if (b && /(로|으로|을|를)\s/.test(aiStripTags(l))) key = aiActKey(b[1]); }
    if (!key) return;
    const plain = aiStripTags(l);
    // '수정 버튼으로 고칠 수 있습니다(매입처는 수정불가)'처럼 할 수 있는 말이 같이 있으면 '못 함'이 아님
    const neg = /(할\s*수\s*없|사용할\s*수\s*없|불가|안\s*됩니다|못\s*합니다|비활성)/.test(plain), pos = /(수\s*있습니다|고칩니다|합니다\s*\(|버튼으로|(로|으로)\s+\S+(합니다|엽니다|고칩니다|처리))/.test(plain);
    acts.push({ key, html: aiLine(l), cannot: neg && !pos });
  }));
  return acts;
}
function aiActKeys(q) {
  const keys = AI_ACT.filter(([k, re]) => re.test(q)).map(([k]) => k).filter(k => k !== "인쇄" || /(인쇄|출력)/.test(q));
  if (!keys.length && AI_MISTAKE.test(q)) return { keys: ["수정", "취소", "되돌리기", "삭제"], mistake: true, q };
  return { keys, mistake: AI_MISTAKE.test(q), q };
}
// 등록 화면의 '수정'(예: 판매가 수정)은 문서를 바로잡는 일이 아니라서 뺀다
function aiHasAct(it, keys) { return !/(등록|입력|작성|발급)$/.test(it.title) && it.pages.some(p => p.acts.some(a => keys.includes(a.key) && !a.cannot)); }
// 알림 문구를 그대로 붙여 물을 때: 메뉴얼 안에 같은 글이 있는지
function aiPhrase(q) {
  const p = aiNorm(q.replace(/(라고|이라고|이라는|라는|하고|가|이)?\s*(떠요|뜹니다|뜨는데|떴어요|떴는데|나와요|나오는데|나옵니다|메시지|메세지|알림|창이|문구)[\s\S]*$/, ""));
  return p.length >= 6 ? p : "";
}
function aiRank(q) {
  const idx = aiBuildIndex();
  const kws = aiKeywords(q);
  const intent = aiIntent(q), phrase = intent === "error" ? aiPhrase(q) : "";
  if (!kws.length && !phrase) return { kws, slots: [], list: [], intent };
  let slots = kws.map(w => { const syn = aiSynFor(w); return { w, syn, wt: (AI_GENERIC.includes(w) ? 0.35 : 1) * Math.max(aiIdf(w), ...syn.map(aiIdf)) }; });
  // 메뉴얼 어디에도 없는 낱말(말끝·군말)은 빼기 — 다 빠지면 그대로
  slots.forEach(s => { s.best = Math.max(0, ...idx.map(it => aiSlotScore(s, it))); });
  const kept = slots.filter(s => s.best >= 0.35);
  // 메뉴얼에 없는 낱말이 섞여 있으면(메뉴얼 밖 질문일 수 있음) 확신을 낮춘다
  const qAll0 = aiNorm(q), lost = slots.filter(s => s.best < 0.35 && s.w.length >= 2 && !AI_SYN.some(([from]) => from.some(f => s.w.includes(f) || f.includes(s.w)))).length;
  const known = kept.length ? kept.length / (kept.length + lost) : 0;
  if (kept.length) slots = kept;
  // 질문 전체에서 찾는 같은 뜻 말(띄어 써서 낱말이 갈라진 경우: "재고가 안 맞아요" → 안맞)
  const qAll = aiNorm(q), boost = [];
  AI_SYN.forEach(([from, to]) => { if (from.some(f => f.length >= 2 && qAll.includes(f))) to.forEach(t => { if (!boost.includes(t)) boost.push(t); }); });
  const phraseMiss = phrase.length >= 8 && !idx.some(it => it.hayN.includes(phrase));
  const wantHq = /본사/.test(q), look = AI_LOOK_Q.test(q), fix = AI_FIX_Q.test(q), act = aiActKeys(q);
  const qn = aiNorm(aiStripFiller(q));
  const list = idx.map(it => {
    const ss = slots.map(s => aiSlotScore(s, it));
    const wsum = slots.reduce((a, s) => a + s.wt, 0) || 1;
    const wavg = slots.length ? ss.reduce((a, v, i) => a + v * slots[i].wt, 0) / wsum : 0;
    const wcut = Math.min(0.3, Math.max(...slots.map(s => s.wt)));
    const strong = Math.max(0, ...ss.filter((v, i) => slots[i].wt >= wcut));
    let sc = slots.length ? 0.65 * wavg + 0.35 * (strong || wavg) : 0;
    if (ss.length > 1 && Math.min(...ss.filter((v, i) => slots[i].wt >= 0.6).concat([1])) < 0.3) sc *= 0.9; // 뚜렷한 주제 낱말이 전혀 안 맞으면 깎기
    sc += 0.12 * aiCover(it.titleBig, aiBig(qn));                            // 메뉴 이름 글자가 질문에 많이 들어 있으면
    let ev = strong * (0.7 + 0.3 * known);                                   // 이 메뉴가 답이라는 근거의 세기
    sc *= 0.85 + 0.15 * known;
    if (phraseMiss && strong < 0.99) ev *= 0.8;
    if (boost.some(t => it.titleN.includes(t))) { sc += 0.12; ev = Math.max(ev, 0.8); }
    if (phrase && it.hayN.includes(phrase)) { sc += 0.5; ev = 1; }
    if (qn.length >= 3 && it.titleN === qn && !(act.mistake && /(등록|입력|작성|발급)$/.test(it.title))) sc += 0.2;                      // 메뉴 이름 그대로
    if (it.titleN.startsWith(slots.length ? slots[0].w : "\u0000")) sc += 0.02;
    sc -= 0.002 * it.titleN.length;
    if (look && AI_LOOK_T.test(it.title)) sc += 0.08 + (/(조회|현황|목록|내역)/.test(q) && new RegExp(q.match(/(조회|현황|목록|내역)/)[1]).test(it.title) ? 0.06 : 0);
    if (look && /^(pos|pda)/.test(it.ch.id) && /(매출|합계|통계|얼마|몇|금액)/.test(q)) sc -= 0.1;
    else if (fix && /조회/.test(it.title)) sc += 0.07;
    else if (!look && !fix && intent !== "what" && AI_HOW_T.test(it.title)) sc += 0.05;
    if (it.hq && !wantHq) sc -= 0.06;
    if (wantHq && it.hq) sc += 0.05;
    if (/^s-prep/.test(it.sub.id)) sc -= 0.1;                                // 준비 중인 쪽은 뒤로
    if (act.keys.length) {                                                   // 바로잡는 일: 그 버튼이 있는 화면(보통 조회)으로
      if (aiHasAct(it, act.keys)) sc += act.mistake ? 0.16 : 0.14;
      else if (/(등록|입력|작성|발급)$/.test(it.title)) sc -= act.mistake ? 0.12 : 0.08;
      else if (act.mistake) sc -= 0.06;
    }
    return { it, sc, ss, ev };
  }).filter(x => x.sc > 0.2).sort((a, b) => b.sc - a.sc);
  // 같은 화면(본사관리 복사본 등)이 겹치면 하나만
  const seen = new Set(), out = [];
  list.forEach(x => { const k = x.it.title + "|" + (x.it.sub.pages || []).join(","); if (!seen.has(k)) { seen.add(k); out.push(x); } });
  return { kws, slots, list: out, intent, phrase, phraseMiss, act };
}
// 메뉴 안에서 질문에 가장 맞는 탭·카드 고르기(메뉴 이름에 이미 들어 있는 낱말은 빼고)
function aiFocus(it, slots, intent, phrase) {
  const rest = slots.filter(s => !it.titleN.includes(s.w) && !s.syn.some(y => it.titleN.includes(y)));
  const terms = rest.map(s => [s.w, ...s.syn]);
  let best = null;
  it.pages.forEach(p => {
    if (terms.length && p.ln) { const hit = terms.filter(ts => ts.some(t => p.ln.includes(t) || t.includes(p.ln))).length; if (hit) { const sc = 1.2 * hit / terms.length; if (!best || sc > best.sc) best = { sc, page: p, card: null }; } }
    p.cards.forEach(c => {
      let sc = 0;
      if (terms.length) terms.forEach(ts => { if (ts.some(t => c.tn.includes(t))) sc += 1; else if (ts.some(t => c.n.includes(t))) sc += 0.6; });
      sc = terms.length ? sc / terms.length : 0;
      if (intent === "error" && c.type === "qa") sc += 0.35;
      if (phrase && c.n.includes(phrase)) sc += 2;
      if (sc > 0.45 && (!best || sc > best.sc)) best = { sc, page: p, card: c };
    });
  });
  return best;
}

// ── 답 만들기 ──
function aiPathHtml(it) { return `${grpBadge(it.ch)}${aiEsc(it.ch.title)}${it.grp ? " › " + aiEsc(it.grp) : ""} › <b>${aiEsc(it.title)}</b>`; }
function aiLine(s) { return aiCleanHtml(s).replace(/^%%/, ""); }
function aiStepTitle(t) { return aiStripTags(t).replace(/^[^\p{L}\p{N}]+/u, "").trim(); }
function aiFirstLine(c) { const l = c.lines.find(x => !/^📌/.test(aiStripTags(x).trim())); return l ? aiLine(l).replace(/^\s*\d+\.\s+/, "") : ""; }
function aiSummary(it) {
  const p0 = it.pages[0];
  const n = p0 && p0.cards.find(c => c.type === "note" && !c.title);
  return n ? aiLine(n.lines[0]) : (p0 && p0.subtitle ? aiEsc(p0.subtitle) + "." : "");
}
function aiStepsHtml(p, max) {
  const st = p.cards.filter(c => c.type === "step" && /^\d+$/.test(String(c.num)));
  if (!st.length) return "";
  let h = `<ol class="ai-steps">`;
  st.slice(0, max).forEach(c => { const f = aiFirstLine(c); h += `<li><b>${aiEsc(aiStepTitle(c.title))}</b>${f ? `<span>${f}</span>` : ""}</li>`; });
  h += `</ol>`;
  if (st.length > max) h += `<div class="ai-more">…그 밖에 ${st.length - max}단계가 더 있어요.</div>`;
  return h;
}
function aiCardHtml(c) {
  let h = `<div class="ai-focus">`;
  if (c.title) h += `<div class="ai-focus-t">${c.type === "qa" ? "Q. " : ""}${c.type === "qa" ? aiEsc(aiStripTags(c.title)) : aiEsc(aiStepTitle(c.title))}</div>`;
  c.lines.slice(0, 7).forEach(l => { const s = aiStripTags(l).trim(); if (/^📌/.test(s)) h += `<div class="ai-focus-g">${aiEsc(s)}</div>`; else h += `<div class="ai-focus-l">${aiLine(l)}</div>`; });
  return h + `</div>`;
}
function aiActsHtml(it, pageIdx) {
  const cid = it.ch.id, sid = it.sub.id;
  let h = `<div class="ai-acts"><button class="ai-act main" onclick="aiGo('${cid}','${sid}',${pageIdx || 0})">이 화면으로 이동 →</button>`;
  if (videoForSub(it.sub)) h += `<button class="ai-act vid" onclick="playSubVideo('${sid}')">▶ 강의 영상</button>`;
  return h + `</div>`;
}
function aiCsHtml(lead) {
  const tel = AI_CS.tel ? ` <a class="ai-tel" href="tel:${AI_CS.tel.replace(/[^0-9]/g, "")}">📞 ${aiEsc(AI_CS.tel)}</a>` : "";
  return `${lead ? `<div class="ai-cs-lead">${lead}</div>` : ""}<div class="ai-cs"><b>${aiEsc(AI_CS.name)}</b>로 문의해 주세요.${tel}${AI_CS.hours ? `<div class="ai-cs-h">상담 시간 ${aiEsc(AI_CS.hours)}</div>` : ""}</div>`;
}
function aiChipsHtml(items, label) {
  if (!items.length) return "";
  return `<div class="ai-chips-l">${label}</div><div class="ai-chips">` + items.map(x => `<button class="ai-chip" onclick="${x.on}">${x.t}</button>`).join("") + `</div>`;
}
// 바로잡는 답: "○○는 △△ 화면의 □□ 탭에서 [취소]" — 탭마다 할 수 있는 것·없는 것
function aiActAnswer(it, act, confident) {
  const keys = act.keys, rows = [], cannot = [];
  it.pages.forEach(p => p.acts.filter(a => keys.includes(a.key)).forEach(a => {
    const tab = (p.label || it.title).replace(/^\d+\s*/, "");
    if (a.cannot) { if (!cannot.includes(tab)) cannot.push(tab); return; }
    const same = rows.find(r => r.html === a.html);
    if (same) { if (!same.tabs.includes(tab)) same.tabs.push(tab); } else rows.push({ tabs: [tab], html: a.html, key: a.key, i: p.i });
  }));
  const shown = rows.slice(0, 5);
  const verbs = [...new Set(shown.map(r => r.key))];
  let h = confident ? "" : `<div class="ai-lead">혹시 이 화면을 찾으세요?</div>`;
  h += `<div class="ai-ans-head">${grpBadge(it.ch)}${aiEsc(it.title)}</div><div class="ai-path">📍 ${aiPathHtml(it)}</div>`;
  { // 질문에 단계(탭) 이름이 있으면 그 단계에서 되는지부터
    const qn = aiNorm(act.q || ""), named = it.pages.map(p => (p.label || "").replace(/^\d+\s*/, "")).filter(t => t.length >= 2 && qn.includes(aiNorm(t)) && !keys.some(k => aiNorm(t) === aiNorm(k)));
    const no = named.filter(t => cannot.includes(t)), yes = named.filter(t => rows.some(r => r.tabs.includes(t)));
    if (no.length) h += `<div class="ai-verdict no">⚠️ <b>${no.map(aiEsc).join("·")}</b> 단계에서는 ${verbs.join("·") || keys[0]}할 수 없어요.</div>`;
    else if (yes.length) h += `<div class="ai-verdict yes">✅ <b>${yes.map(aiEsc).join("·")}</b> 단계에서 할 수 있어요.</div>`;
  }
  h += `<div class="ai-sum">${act.mistake ? "잘못 처리한 건 걱정 마세요 🙂 " : ""}<b>${aiEsc(it.title)}</b>에서 <b>${verbs.join("·")}</b>할 수 있어요.</div>`;
  if (/(조회|목록)/.test(it.title)) h += `<ol class="ai-steps"><li><b>문서가 있는 탭을 누릅니다</b><span>아래 표의 탭</span></li><li><b>목록에서 그 문서를 체크합니다</b></li><li><b>${verbs.map(v => `<span class='ui-btn'>${v}</span>`).join(" / ")} 버튼을 누릅니다</b><span>확인창이 나오면 [예]를 누릅니다.</span></li></ol>`;
  h += `<div class="ai-actrows">` + shown.map(r => `<div class="ai-actrow"><span class="ai-acttab">${r.tabs.map(aiEsc).join(" · ")}</span><span class="ai-actline">${r.html}</span></div>`).join("") + `</div>`;
  if (cannot.length) h += `<div class="ai-more">⚠️ <b>${cannot.map(aiEsc).join("·")}</b> 탭에서는 ${verbs.join("·")}할 수 없어요.</div>`;
  h += `<div class="ai-more">※ 버튼이 켜져 있어도 다음 단계로 넘어간 문서는 막힐 수 있어요. 안 되면 고객센터로 문의해 주세요.</div>`;
  h += aiActsHtml(it, shown.length ? shown[0].i : 0);
  return h;
}
function aiMenuAnswer(x, slots, intent, confident, phrase, act) {
  const it = x.it, f = aiFocus(it, slots, intent, phrase);
  if (act && act.keys.length && aiHasAct(it, act.keys)) return aiActAnswer(it, act, confident);
  let h = "";
  if (!confident) h += `<div class="ai-lead">혹시 이 화면을 찾으세요?</div>`;
  h += `<div class="ai-ans-head">${grpBadge(it.ch)}${aiEsc(it.title)}</div><div class="ai-path">📍 ${aiPathHtml(it)}</div>`;
  const sum = aiSummary(it);
  if (sum) h += `<div class="ai-sum">${sum}</div>`;
  let pageIdx = 0;
  if (f && f.page && f.page.i > 0 && f.page.label) { pageIdx = f.page.i; h += `<div class="ai-tabhit">👉 <b>${aiEsc(f.page.label)}</b> 탭${f.page.subtitle ? " — " + aiEsc(f.page.subtitle) : ""}</div>`; }
  if (f && f.card && !(f.card.type === "note" && aiLine(f.card.lines[0]) === sum)) h += aiCardHtml(f.card);
  else {
    const p = f && f.page ? f.page : it.pages[0];
    const steps = p ? aiStepsHtml(p, intent === "where" ? 3 : 5) : "";
    if (steps) h += steps;
    else if (it.pages.length > 1 && it.pages.some(pp => pp.label)) h += `<div class="ai-tabs"><b>탭</b> ` + it.pages.filter(pp => pp.label).map(pp => `<span>${aiEsc(pp.label.replace(/^\d+\s*/, ""))}</span>`).join(" → ") + `</div>`;
    else if (p) { const c = p.cards.find(cc => cc.type !== "note" && cc.lines.length); if (c) h += aiCardHtml(c); }
  }
  { // 다음 단계 안내(마지막 안내 카드에 다른 화면 바로가기가 있으면)
    const p = f && f.page ? f.page : it.pages[0];
    const nx = p && p.cards.filter(c => c.type === "note" && !c.title).slice(1).reverse().find(c => /openSub\(/.test(c.lines[0] || ""));
    if (nx && !(f && f.card === nx)) h += `<div class="ai-next">➡ ${aiLine(nx.lines[0])}</div>`;
  }
  if (it.pages.length > 1 && it.pages.some(pp => pp.label) && aiStepsHtml(it.pages[0], 5) && !(f && f.page && f.page.i > 0)) h += `<div class="ai-tabs"><b>탭</b> ` + it.pages.filter(pp => pp.label).map(pp => `<span>${aiEsc(pp.label.replace(/^\d+\s*/, ""))}</span>`).join(" → ") + `</div>`;
  h += aiActsHtml(it, pageIdx);
  return h;
}
function aiFaqRank(q, slots) {
  if (typeof AI_FAQ === "undefined" || !AI_FAQ.length) return null;
  const qn = aiNorm(aiStripFiller(q));
  let best = null;
  AI_FAQ.forEach(f => {
    if (!f._n) { f._qs = [f.q].concat(f.alt || []).map(s => aiNorm(aiStripFiller(s))); f._n = aiNorm((f.tags || []).join(" ") + " " + f.a); f._big = f._qs.map(aiBig); }
    let sc = 0;
    if (f._qs.some(s => s && (s === qn || (qn.length >= 4 && (s.includes(qn) || qn.includes(s)))))) sc = 1;
    else if (slots.length) {
      const per = slots.map(sl => { const ts = [sl.w, ...sl.syn]; let v = 0; ts.forEach((t, i) => { const k = i ? 0.88 : 1; if (f._qs.some(s => s.includes(t))) v = Math.max(v, k); else if (f._n.includes(t)) v = Math.max(v, 0.5 * k); else if (t.length >= 2) v = Math.max(v, 0.7 * k * Math.max(...f._big.map(b => aiCover(aiBig(t), b)))); }); return v; });
      sc = per.reduce((a, b) => a + b, 0) / per.length;
      if (per.length > 1 && Math.min(...per) < 0.3) sc *= 0.8;
    }
    if (!best || sc > best.sc) best = { f, sc };
  });
  return best;
}
function aiFaqAnswer(f) {
  let h = `<div class="ai-faq-badge">자주 묻는 질문</div><div class="ai-ans-head">${aiEsc(f.q)}</div><div class="ai-faq-a">${f.a}</div>`;
  const idx = aiBuildIndex();
  const links = (f.menu || []).map(t => idx.find(it => it.title === t || it.sub.id === t)).filter(Boolean);
  if (links.length) h += `<div class="ai-acts">` + links.map(it => `<button class="ai-act" onclick="aiGo('${it.ch.id}','${it.sub.id}',0)">${aiEsc(it.title)} 화면 →</button>`).join("") + `</div>`;
  return h;
}
function aiAsk(t) { const i = document.getElementById("aiChatInput"); if (i) { i.value = t; aiChatSend(); } }
// 질문 하나 → 답(html) — 화면 없이도 돌릴 수 있게(시험용) 나눠 둠
function aiAnswer(q) {
  const qs = q.trim();
  if (/^(안녕|하이|hi|hello|ㅎㅇ)/i.test(qs)) return { kind: "hello", html: "안녕하세요! 😊 궁금한 걸 평소 말투로 물어보세요. 메뉴얼에서 찾아 바로 답해 드릴게요." };
  if (/(고마|감사|땡큐|thank)/i.test(qs) && qs.length < 15) return { kind: "thanks", html: "도움이 됐다니 다행이에요! 😊 더 궁금한 게 있으면 언제든 물어보세요." };
  if (/(점심|저녁\s*메뉴|날씨|심심|배고프|뭐\s*먹지|놀아|사랑해|ㅋㅋㅋ)/.test(qs)) return { kind: "chat", html: "저는 IRM 메뉴얼 도우미라 그건 잘 몰라요 😅 프로그램 쓰다가 궁금한 게 생기면 언제든 물어보세요!" };
  if (/(고객센터|상담원|상담사|전화번호|연락처|사람이랑|직원이랑\s*통화)/.test(qs)) return { kind: "cs", html: aiCsHtml("상담원과 직접 이야기하고 싶으시면") };
  const r = aiRank(qs), intent = r.intent || aiIntent(qs);
  if (AI_OUT.test(qs) && !(r.list[0] && r.list[0].ev >= 0.99 && r.list[0].sc >= 1)) {
    const near = r.list.slice(0, 2).filter(x => x.sc >= 0.6 && x.ev >= 0.75).map(x => ({ t: aiEsc(x.it.title), on: `aiShowMenu('${x.it.ch.id}','${x.it.sub.id}')` }));
    return { kind: "none", top: "", html: aiCsHtml("이 내용은 메뉴얼이 아니라 <b>고객센터</b>에서 직접 도와드려야 해요. 🙏") + aiChipsHtml(near, "메뉴얼에서 관련 화면") };
  }
  const faq = aiFaqRank(qs, r.slots);
  const top = r.list[0];
  const others = r.list.slice(1, 4).filter(x => x.sc >= 0.4 && x.ev >= 0.6);
  const chips = others.map(x => ({ t: aiEsc(x.it.title), on: `aiShowMenu('${x.it.ch.id}','${x.it.sub.id}')` }));
  if (faq && faq.sc >= 0.78 && (!top || faq.sc >= top.sc - 0.12)) {
    let html = aiFaqAnswer(faq.f);
    html += `<div class="ai-foot">해결이 안 되셨나요? <a href="javascript:void(0)" onclick="aiAppendMsg('bot', aiCsHtml(''))">고객센터 안내</a></div>`;
    return { kind: "faq", faq: faq.f.q, top: top ? top.it.title : "", html };
  }
  if (top && !r.phraseMiss && top.sc >= 0.55 && top.ev >= 0.5 && (top.ev < 0.65 || top.sc < 0.45)) {
    let html = aiMenuAnswer(top, r.slots, intent, false, r.phrase, r.act);
    html += aiChipsHtml(chips, "다른 후보");
    html += aiCsHtml("이 화면이 아니라면");
    return { kind: "maybe", top: top.it.title, sc: +top.sc.toFixed(2), intent, html, list: r.list.slice(0, 4).map(x => x.it.title + ":" + x.sc.toFixed(2)) };
  }
  if (!top || top.sc < 0.45 || top.ev < 0.65) {
    let html = aiCsHtml(`음… 메뉴얼에서 딱 맞는 답을 찾지 못했어요. 😥`);
    const near = r.list.slice(0, 3).filter(x => x.sc >= 0.4 && x.ev >= 0.6).map(x => ({ t: aiEsc(x.it.title), on: `aiShowMenu('${x.it.ch.id}','${x.it.sub.id}')` }));
    if (near.length) html += aiChipsHtml(near, "혹시 이 화면인가요?");
    return { kind: "none", top: top ? top.it.title : "", sc: top ? top.sc : 0, html };
  }
  const confident = top.sc >= 0.62 && top.ev >= 0.72;
  let html = aiMenuAnswer(top, r.slots, intent, confident, r.phrase, r.act);
  html += aiChipsHtml(chips, confident ? "이것도 찾으셨나요?" : "다른 후보");
  html += `<div class="ai-foot">해결이 안 되셨나요? <a href="javascript:void(0)" onclick="aiAppendMsg('bot', aiCsHtml(''))">고객센터 안내</a></div>`;
  return { kind: confident ? "menu" : "maybe", top: top.it.title, sc: +top.sc.toFixed(2), intent, html, list: r.list.slice(0, 4).map(x => x.it.title + ":" + x.sc.toFixed(2)) };
}
function aiShowMenu(chId, subId) {
  const it = aiBuildIndex().find(x => x.ch.id === chId && x.sub.id === subId);
  if (!it) return;
  aiAppendMsg("bot", aiMenuAnswer({ it, sc: 1 }, [], "how", true));
}
function aiChatSend() {
  const inp = document.getElementById("aiChatInput");
  const q = inp.value.trim();
  if (!q) return;
  inp.value = "";
  aiAppendMsg("user", aiEsc(q));
  const typing = document.createElement("div");
  typing.className = "ai-msg bot ai-typing"; typing.innerHTML = "<span></span><span></span><span></span>";
  const b = document.getElementById("aiChatBody"); b.appendChild(typing); b.scrollTop = b.scrollHeight;
  setTimeout(() => {
    typing.remove();
    let res;
    try { res = aiAnswer(q); } catch (e) { console.error(e); res = { html: aiCsHtml("답을 찾다가 문제가 생겼어요. 😥") }; }
    aiAppendMsg("bot", res.html);
  }, 420);
}
