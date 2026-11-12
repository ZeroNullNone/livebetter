const PERF = { on:false, log(){}, mark(){} };

/* ---------- 个人行动清单与私人笔记存储 (LocalStorage) ---------- */
const TRACKER_KEY = 'htlb-my-tracker-v1';
let MY = { status:{}, saved:{}, notes:{} };
try {
  const raw = JSON.parse(localStorage.getItem(TRACKER_KEY) || '{}');
  MY = { status: raw.status || {}, saved: raw.saved || {}, notes: raw.notes || {} };
} catch (e) {}
function saveMy(){
  try { localStorage.setItem(TRACKER_KEY, JSON.stringify(MY)); } catch (e) {}
  updateMyCounts();
  if (view==='mine' && recordKind && readerTopic()) renderRecords();
}
function updateMyCounts(){
  let todo = 0, done = 0, skip = 0, saved = 0, noted = 0;
  for (const v of Object.values(MY.status)){
    if (v === 'todo') todo++;
    else if (v === 'done') done++;
    else if (v === 'skip') skip++;
  }
  for (const v of Object.values(MY.saved)) if (v) saved++;
  for (const v of Object.values(MY.notes)) if (v && String(v).trim()) noted++;
  document.getElementById('c-todo').textContent = todo;
  document.getElementById('c-done').textContent = done;
  document.getElementById('c-saved').textContent = saved;
  document.getElementById('c-noted').textContent = noted;
  document.getElementById('c-skip').textContent = skip;
  document.querySelectorAll('[data-record]').forEach(el => el.textContent = ({todo,done,skip,saved,noted})[el.dataset.record]);
}

/* ---------- 自动识别是否为「马来西亚本地制度/物价」条目 ---------- */
const MY_SCOPE_RE = /RM\s?\d|马币|令吉|马来西亚|999|NSRC|997|15555|Befrienders|15999|Klinik Kesihatan|政府诊所|政府医院|医药卡|Medical Card|EPF|KWSP|SOCSO|PERKESO|EIS|SIP|LHDN|MyTax|PIDM|TTPM|消费人索偿|KPDN|SIRIM|NPRA|Meditag|SSM|Sdn Bhd|JPN|国民登记局|报生纸|MyKad|MyKid|雇用法令|Employment Act|劳工局|JTK|工业关系局|JPP|工业法庭|Industrial Court|HDA|Schedule [GH]|印花税|Stamping|PDPA|MCMC|PTPTN|SPM|STPM|统考|MQA|JKM|OKU|STR|推事庭|小额索偿|高庭|刑法典|钱驴|SemakMule|遗嘱法令|Amanah Raya|PUSPAKOM|Wisma Putra|PeKa B40/i;

/* ---------- 解析 README 与正文 ---------- */
function parseReadme(md){
  const lines = md.split(/\r?\n/);
  const sections = [];
  let sec = null, entry = null;
  const flush = () => { if (entry && sec) { sec.entries.push(entry); } entry = null; };
  for (const raw of lines){
    const line = raw.trimEnd();
    let m;
    if ((m = /^#{1,2} (\d+)\. (.+)$/.exec(line))) { flush(); sec = {n:m[1], title:m[2].trim(), intro:[], entries:[]}; sections.push(sec); continue; }
    if (/^#{1,2} /.test(line)) { flush(); sec = null; continue; }
    if (!sec) continue;
    if ((m = /^### (\d+)\. (.+)$/.exec(line))) { flush(); entry = {sec:sec.n, n:m[1], title:m[2].trim(), cost:'', human:'', gain:'', grade:'', src:'', note:'', money:'', time:'', will:'', level:'', lens:'', who:[]}; continue; }
    if ((m = /^\x3c!--\s*成本标签:\s*(.*?)\s*-->/.exec(line)) && entry){
      for (const kv of m[1].split(/\s+/)){ const [k,v] = kv.split('='); if(k==='钱') entry.money=v; if(k==='时间') entry.time=v; if(k==='毅力') entry.will=v; if(k==='收益') entry.level=v; if(k==='口径') entry.lens=v; if(k==='人群') entry.who=v.split(',').map(g => g.split('+')); }
      continue;
    }
    if (entry){
      if ((m = /^- 成本：(.*)$/.exec(line))) entry.cost = m[1];
      else if ((m = /^- 说人话：(.*)$/.exec(line))) entry.human = m[1];
      else if ((m = /^- 收益：(.*)$/.exec(line))) entry.gain = m[1];
      else if ((m = /^- 证据等级：\s*([ABC])(.*)/.exec(line))) { entry.grade = m[1]; entry.gradeNote = m[2].trim(); }
      else if ((m = /^- 来源：(.*)$/.exec(line))) entry.src = m[1];
      else if ((m = /^- 备注：(.*)$/.exec(line))) entry.note = m[1];
      continue;
    }
    if (line) sec.intro.push(line);
  }
  flush();
  for (const s of sections) for (const e of s.entries){
    e.dispute = /^争议/.test(e.note);
    e.todo = /待核实|TODO/.test(e.src + e.gain + e.note + e.cost);
    e.cs = (COST_W.money[e.money] ?? 0) + (COST_W.time[e.time] ?? 0) + (COST_W.will[e.will] ?? 0);
    e.ratio = e.level === '大' ? (e.cs === 0 ? '极高' : (e.cs <= 2 ? '高' : '一般'))
            : e.level === '中' ? (e.cs === 0 ? '高' : '一般') : '一般';
    const fullText = [e.title, e.human, e.cost, e.gain, e.note, e.src].join('\n');
    e.scope = MY_SCOPE_RE.test(fullText) ? 'my' : 'global';
    e.hay = (fullText + '\n' + e.grade).replace(/\*\*/g, '').replace(/\\([*_])/g, '$1').toLowerCase();
  }
  return sections;
}

/* ---------- 术语表 ---------- */
let GLOSS = [];
function parseGlossary(md){
  const m = /^## 读懂数字[^\n]*\n([\s\S]*?)(?=^## |$)/m.exec(md);
  if (!m) return [];
  const rows = [];
  for (const line of m[1].split(/\r?\n/)){
    const c = /^\|\s*(.+?)\s*\|\s*(.+?)\s*\|$/.exec(line);
    if (!c || c[1] === '术语' || /^-+$/.test(c[1])) continue;
    for (const t of c[1].split('、')){
      const term = t.trim(); if (!term) continue;
      rows.push({term, meaning: c[2], latin: /^[A-Za-z0-9%. ]+$/.test(term)});
    }
  }
  rows.sort((a,b) => b.term.length - a.term.length);
  const escRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const alt = (list) => list.map(g => escRe(g.term)).join('|');
  const parts = [];
  const latin = rows.filter(g => g.latin), cjk = rows.filter(g => !g.latin);
  if (latin.length) parts.push(`(?<![A-Za-z0-9])(?:${alt(latin)})(?![A-Za-z0-9])`);
  if (cjk.length) parts.push(`(?:${alt(cjk)})`);
  GLOSS_RE = parts.length ? new RegExp(parts.join('|'), 'g') : null;
  GLOSS_BY = Object.fromEntries(rows.map(g => [g.term, g]));
  return rows;
}
let GLOSS_RE = null, GLOSS_BY = {};
function termify(root){
  if (!GLOSS_RE) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = []; let n; while ((n = walker.nextNode())) if (!n.parentElement.closest('a,abbr')) nodes.push(n);
  for (const node of nodes){
    const s = node.nodeValue;
    GLOSS_RE.lastIndex = 0;
    if (!GLOSS_RE.test(s)) continue;
    GLOSS_RE.lastIndex = 0;
    const frag = document.createDocumentFragment(); let pos = 0, m;
    while ((m = GLOSS_RE.exec(s))){
      const g = GLOSS_BY[m[0]]; if (!g) continue;
      if (m.index > pos) frag.appendChild(document.createTextNode(s.slice(pos, m.index)));
      const ab = document.createElement('abbr'); ab.className = 'term'; ab.textContent = m[0]; ab.title = g.meaning; ab.tabIndex = 0; ab.dataset.term = g.term;
      frag.appendChild(ab); pos = m.index + m[0].length;
    }
    if (pos < s.length) frag.appendChild(document.createTextNode(s.slice(pos)));
    node.parentNode.replaceChild(frag, node);
  }
}
function showTerm(ab){
  const pop = document.getElementById('pop');
  pop.querySelector('b').textContent = ab.dataset.term;
  pop.querySelector('span').textContent = ab.title;
  pop.hidden = false;
  const r = ab.getBoundingClientRect(); const w = Math.min(360, innerWidth - 24);
  let x = r.left + r.width/2 - w/2; x = Math.max(12, Math.min(x, innerWidth - w - 12));
  pop.style.width = w + 'px'; pop.style.left = x + 'px';
  const below = r.bottom + 8 + pop.offsetHeight < innerHeight;
  pop.style.top = (below ? r.bottom + 8 : r.top - 8 - pop.offsetHeight) + scrollY + 'px';
}

/* ---------- 文本渲染：链接 + 高亮 ---------- */
const URL_RE = /<?(https?:\/\/[A-Za-z0-9\-._~:\/?#\[\]@!$&'()*+,=%]+)>?/g;
function trimUrl(u){
  let t = '';
  for (;;){
    const ch = u.slice(-1);
    const unbalanced = ch === ')' && (u.split('(').length < u.split(')').length);
    if (!/[）。,，]/.test(ch) && !unbalanced) break;
    t = ch + t; u = u.slice(0, -1);
  }
  return [u, t];
}
const REPO_BLOB = 'https://github.com/ZeroNullNone/livebetter/blob/main/';
const MD_LINK_RE = /\[([^\]\n]+)\]\(([^)\s]+)\)/;
const BOLD_RE = /\*\*((?:\\\*|[^*\n])+)\*\*/;
const unescMd = (s) => s.replace(/\\([*_])/g, '$1');
const LINK_RE = new RegExp([MD_LINK_RE.source, URL_RE.source, BOLD_RE.source].join('|'), 'g');
function hrefOf(p){
  if (/^(https?:|mailto:|#)/.test(p)) return p;
  return REPO_BLOB + p.replace(/^(\.\.?\/)+/, '').split('/').map(encodeURIComponent).join('/');
}
function mkLink(href, text){
  const a = document.createElement('a'); a.href = href; a.target = '_blank'; a.rel = 'noopener'; a.textContent = text;
  return a;
}
function renderText(el, text, terms, withTerms = true, urlsLast = false){
  el.textContent = '';
  const held = [];
  let justHeld = false;
  let last = 0; LINK_RE.lastIndex = 0; let m;
  const pushText = (s) => {
    if (!s) return;
    if (justHeld && /^[\s、,，]+$/.test(s)) return;
    justHeld = false;
    xrefInto(el, unescMd(s), terms);
  };
  while ((m = LINK_RE.exec(text))){
    pushText(text.slice(last, m.index));
    last = m.index + m[0].length;
    if (m[4] !== undefined){
      const b = document.createElement('strong'); highlightInto(b, unescMd(m[4]), terms); el.appendChild(b); justHeld = false;
      continue;
    }
    if (m[3]){
      const [u, tail] = trimUrl(m[3]);
      const a = mkLink(u, u.replace(/^https?:\/\//, '').replace(/\/$/, ''));
      a.className = 'url';
      if (urlsLast){ held.push(a); justHeld = true; } else el.appendChild(a);
      pushText(tail);
      continue;
    }
    el.appendChild(mkLink(hrefOf(m[2]), m[1])); justHeld = false;
  }
  pushText(text.slice(last));
  for (const a of held) el.appendChild(a);
  if (withTerms) termify(el);
}

const GAIN_MIN_LEN = 300, GAIN_MIN_CHUNK = 25;
const GAIN_TOPIC_START = [
  /^[^，。「」《》：；（）的]{1,12}看(《|[^，。「」的]{0,10}法[：「（第])/,
  /^《[^》]{2,40}》/,
  /^(?!该|本|此|这|同|上述|但|而|所以|因此|并且|也)[一-龥]{1,12}法(第[一二三四五六七八九十百零]+条|「)/,
  /^(另一|另有一|还有一|再一|又一)(项|篇)/,
  /^(国内|国外|国内外|马来西亚)也有/,
  /^案例[一二三四五六七八九十]/,
  /^(同一天|同一试验|同一指南|同一研究)/,
  /^(美国|英国|欧洲|世界卫生组织|WHO|中国|马来西亚|卫生部)[^，。]{0,20}(指南|共识|建议|学会)/,
  /^(先说|再说|最后说|先看|再看|最后看)/,
  /^一(项|篇)[^，。]{0,20}(试验|研究|综述|分析|调查)/,
  /^(芬兰|北欧|英国|美国|日本|韩国|瑞典|丹麦|挪威|德国|法国|澳大利亚|加拿大|荷兰|台湾|香港|马来西亚|新加坡)[^，。]{0,25}(研究|数据库|试验|队列|调查)/,
];
function splitGain(text){
  if (!text || text.length < GAIN_MIN_LEN) return [text];
  const sentences = []; let buf = '', depth = 0;
  for (const c of text){
    if ('「『《（'.includes(c)) depth++;
    else if ('」』》）'.includes(c)) depth = Math.max(0, depth - 1);
    buf += c;
    if (c === '。' && depth === 0){ sentences.push(buf); buf = ''; }
  }
  if (buf) sentences.push(buf);
  const chunks = [];
  for (const s of sentences){
    if (chunks.length && GAIN_TOPIC_START.some(re => re.test(s))) chunks.push(s);
    else if (chunks.length) chunks[chunks.length - 1] += s;
    else chunks.push(s);
  }
  const out = [];
  for (const c of chunks){
    if (out.length && c.length < GAIN_MIN_CHUNK) out[out.length - 1] += c;
    else out.push(c);
  }
  if (out.length > 1 && out[0].length < GAIN_MIN_CHUNK) out.splice(0, 2, out[0] + out[1]);
  return out;
}
const SRC_OPEN = '「『（', SRC_CLOSE = '」』）';
function splitSrc(text){
  const parts = []; let buf = '', depth = 0;
  for (let i = 0; i < text.length; i++){
    const c = text[i];
    if (SRC_OPEN.includes(c)) depth++;
    if (SRC_CLOSE.includes(c)) depth = Math.max(0, depth - 1);
    const semi = c === '；' || (c === ';' && /\s/.test(text[i-1] || '') && /\s/.test(text[i+1] || ''));
    if (semi && depth === 0){ parts.push(buf); buf = ''; continue; }
    buf += c;
  }
  parts.push(buf);
  return parts.map(s => s.trim()).filter(Boolean);
}
function renderGain(el, text, terms){
  const parts = splitGain(text);
  if (parts.length < 2){ renderText(el, text, terms); return; }
  el.textContent = '';
  const ul = document.createElement('ul'); ul.className = 'chunks';
  for (const p of parts){ const li = document.createElement('li'); renderText(li, p, terms); ul.appendChild(li); }
  el.appendChild(ul);
}
function renderSrc(el, text, terms){
  el.replaceChildren();
  for (const citation of splitSrc(text)){
    if (el.childNodes.length) el.append('；');
    const span = document.createElement('span');
    renderText(span,citation,terms,false);
    const links = [...span.querySelectorAll('a')];
    if (links.length && !terms.some(t => citation.toLowerCase().includes(t))){
      links.forEach((a,i) => {
        if (i) el.append('、');
        a.title = citation;
        if (a.classList.contains('url')){
          const author = citation.match(/^([A-Z][a-zA-Z’-]+)[ ,].*?\b((?:19|20)\d{2})\b/);
          a.textContent = (a.hostname === 'doi.org' && author ? author[1]+' 等，'+author[2] : a.hostname.replace(/^www\./,''))+' ↗';
        }
        el.append(a);
      });
    } else el.append(span);
  }
}
function highlightInto(el, s, terms){
  if (!terms.length){ el.appendChild(document.createTextNode(s)); return; }
  const lower = s.toLowerCase(); let i = 0;
  while (i < s.length){
    let best = -1, bl = 0;
    for (const t of terms){ const k = lower.indexOf(t, i); if (k !== -1 && (best === -1 || k < best)) { best = k; bl = t.length; } }
    if (best === -1){ el.appendChild(document.createTextNode(s.slice(i))); break; }
    if (best > i) el.appendChild(document.createTextNode(s.slice(i, best)));
    const mk = document.createElement('mark'); mk.textContent = s.slice(best, best+bl); el.appendChild(mk);
    i = best + bl;
  }
}

/* ---------- 交叉引用 (.xref) ---------- */
const ITEMS = new Map();
const SECS = new Map();
let CUR_SEC = '';
const NUMS = '[\\d、]+(?:\\s*到\\s*\\d+)?';
const XREF_RE = new RegExp(`第\\s*(\\d+)\\s*节第\\s*(${NUMS})\\s*条|本节第\\s*(${NUMS})\\s*条|第\\s*(${NUMS})\\s*条|第\\s*([\\d、]+)\\s*节`, 'g');
const xrefKeys = (sec, spec) => {
  const ns = [];
  for (const part of String(spec).split('、')){
    const r = /^\s*(\d+)\s*到\s*(\d+)\s*$/.exec(part);
    if (r){
      const a = +r[1], b = +r[2];
      if (b >= a && b - a <= 40) for (let i = a; i <= b; i++) ns.push(i);
      continue;
    }
    const n = part.trim(); if (n) ns.push(n);
  }
  return ns.map(n => `${sec}-${n}`).filter(k => ITEMS.has(k));
};
function xrefInto(el, s, terms){
  XREF_RE.lastIndex = 0; let m, last = 0, any = false;
  while ((m = XREF_RE.exec(s))){
    const keys = m[5] != null
      ? String(m[5]).split('、').map(x => x.trim()).filter(x => SECS.has(x)).map(x => 's' + x)
      : xrefKeys(m[1] ?? CUR_SEC, m[2] ?? m[3] ?? m[4] ?? '');
    if (!keys.length) continue;
    highlightInto(el, s.slice(last, m.index), terms);
    const a = document.createElement('span');
    a.className = 'xref'; a.tabIndex = 0; a.dataset.keys = keys.join(',');
    a.textContent = m[0];
    el.appendChild(a);
    last = m.index + m[0].length; any = true;
  }
  if (!any) { highlightInto(el, s, terms); return; }
  highlightInto(el, s.slice(last), terms);
}

const POP = document.getElementById('xref-pop');
function showXref(a){
  POP.querySelectorAll('.xp-b').forEach(n => n.remove());
  POP.querySelector('.xp-h b').textContent = a.textContent;
  const keys = a.dataset.keys.split(',');
  for (const k of keys){
    if (k[0] === 's'){
      const sec = SECS.get(k.slice(1)); if (!sec) continue;
      const b = document.createElement('div'); b.className = 'xp-b';
      const s = document.createElement('div'); s.className = 'xp-s'; s.textContent = `整节，共 ${sec.entries.length} 条`;
      const t = document.createElement('strong'); t.textContent = `${sec.n}. ${sec.title}`;
      b.append(s, t); POP.appendChild(b); continue;
    }
    const e = ITEMS.get(k); if (!e) continue;
    const b = document.createElement('div'); b.className = 'xp-b';
    const s = document.createElement('div'); s.className = 'xp-s'; s.textContent = `第 ${e.sec} 节第 ${e.n} 条`;
    const t = document.createElement('strong'); t.textContent = e.title;
    b.append(s, t);
    if (e.human){ const p = document.createElement('p'); p.style.cssText = 'margin:4px 0 0'; p.textContent = e.human; b.appendChild(p); }
    POP.appendChild(b);
  }
  POP.dataset.go = keys[0];
  POP.dataset.from = a.closest('.card')?.id || '';
  POP.hidden = false;
  const r = a.getBoundingClientRect(), vw = document.documentElement.clientWidth;
  POP.style.top = (window.scrollY + r.bottom + 6) + 'px';
  POP.style.left = Math.max(window.scrollX + 14,
    Math.min(window.scrollX + r.left, window.scrollX + vw - POP.offsetWidth - 14)) + 'px';
}

let spyT = 0, jumpTimer = 0;
function spy(){
  clearTimeout(spyT);
  if (!reading() || jumpTimer) return;
  spyT = setTimeout(() => {
    if (!reading() || jumpTimer) return;
    const bar = document.querySelector('.index-mobile');
    const top = (bar.offsetHeight ? bar : document.querySelector('header.nav')).getBoundingClientRect().bottom + 28;
    const shown = BLOCKS.filter(b => !b.el.hidden);
    const current = shown.findLast(b => b.el.getBoundingClientRect().top <= top) || shown[0];
    if (current && current.n !== activeChapter) markChapter(current.n);
  }, 90);
}
addEventListener('scroll', spy, { passive:true });

// Keep the target under the sticky bars while nearby lazy cards acquire their final height.
function jumpTo(id, focus = false, returnTop = null){
  clearTimeout(jumpTimer); clearTimeout(spyT); jumpTimer = 0;
  const target = document.getElementById(id);
  if (!target || target.hidden) return;
  const block = target.closest('.sec-block');
  if (!block) { target.scrollIntoView(); return; }
  markChapter(block.dataset.sec);
  const card = CARD_OF.get(target.matches('.sec-block') ? target.querySelector('.card:not([hidden])') : target);
  if (card && card.key !== CUR_KEY) renderCard(card,CUR_TERMS,CUR_KEY);
  const spot = target.classList.contains('sec-block') ? target.querySelector('.sec-h') : target;
  document.querySelector('.brief-return')?.remove();
  if(history.state?.briefFrom && id===location.hash.slice(1)){
    const bar=target.querySelector('.card-meta,.sec-h');
    if(bar){const b=document.createElement('button');b.type='button';b.className='brief-return';b.textContent='↑ 返回导读';b.onclick=()=>history.back();bar.append(b);}
  }
  if (focus){
    const dest=spot.matches('a')?spot:spot.querySelector('h2,h3');
    if(dest && !dest.matches('a'))dest.tabIndex=-1;
    dest?.focus({preventScroll:true});
  }
  let tries = 0;
  const align = () => {
    spot.scrollIntoView({block:'start',behavior:'instant'});
    if(returnTop!==null) window.scrollBy({top:spot.getBoundingClientRect().top-returnTop,behavior:'instant'});
    jumpTimer = ++tries < 4 ? setTimeout(align,65) : 0;
  };
  align();
}
function stopJump(){clearTimeout(jumpTimer);jumpTimer=0;}
addEventListener('wheel',stopJump,{passive:true});
addEventListener('touchstart',stopJump,{passive:true});
addEventListener('keydown',stopJump);
function gotoItem(key, fromId){
  const whole = key.startsWith('s'), n = whole ? key.slice(1) : key.split('-')[0];
  if (fromId && /^e-\d+-\d+$/.test(fromId) && readerTopic()){
    history.replaceState(history.state,'',chapterHref(fromId.split('-')[1],fromId));
  }
  openChapter(n,whole ? 'sec-'+n : 'e-'+key);
}
document.addEventListener('click', ev => {
  const a = ev.target.closest?.('.xref');
  if (a){ showXref(a); return; }
  if (!ev.target.closest?.('#xref-pop')) POP.hidden = true;
});
document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape') POP.hidden = true;
  if (ev.key === 'Enter' && ev.target.classList?.contains('xref')) showXref(ev.target);
});
POP.querySelector('.xp-x').addEventListener('click', () => { POP.hidden = true; });
POP.querySelector('.xp-go').addEventListener('click', () => {
  if (!DM.mask.hidden) dmClose();
  gotoItem(POP.dataset.go, POP.dataset.from); POP.hidden = true;
});
addEventListener('resize', () => { POP.hidden = true; });

const COST_W = { money:{'0':0,'少':1,'多':2}, time:{'少':0,'中':1,'多':2}, will:{'否':0,'些':1,'是':2} };
const LENS_LABEL = {'死亡率':'换寿命','金钱':'换钱','时间':'换时间精力','自由':'换人身自由'};
const WHO_LABEL = {'怀孕':'怀孕或备孕','婴幼儿':'家有 3 岁以下孩子','孩子':'家有 3 到 18 岁孩子','老人':'家有老人','35岁':'35 岁以上','60岁':'60 岁以上','女性':'女性'};
const LABEL = { money:{'0':'不花钱','少':'花少量钱','多':'花不少钱'}, time:{'少':'顺手','中':'花几小时','多':'每天占时间'}, will:{'否':'不用毅力','些':'要一点毅力','是':'要很多毅力'} };
let CARDS = [], BLOCKS = [];
let CUR_TERMS = [], CUR_KEY = '';
const CARD_OF = new WeakMap();
const CARD_IO = new IntersectionObserver(list => {
  for (const it of list){
    const card = CARD_OF.get(it.target); if (!card) continue;
    card.vis = it.isIntersecting;
    if (card.vis && card.key !== CUR_KEY) renderCard(card, CUR_TERMS, CUR_KEY);
  }
}, {rootMargin:'600px 0px'});
function esc(s){ return s.replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch])); }

function syncCardMyUI(c, k){
  const st = MY.status[k] || '';
  const sv = !!MY.saved[k];
  const nt = (MY.notes[k] || '').trim();
  c.classList.toggle('is-done', st === 'done');
  c.classList.toggle('is-todo', st === 'todo');
  c.querySelector('.act-todo').setAttribute('aria-pressed', String(st === 'todo'));
  c.querySelector('.act-done').setAttribute('aria-pressed', String(st === 'done'));
  c.querySelector('.act-save').setAttribute('aria-pressed', String(sv));
  c.querySelector('.act-skip').setAttribute('aria-pressed', String(st === 'skip'));
  const nb = c.querySelector('.act-note');
  nb.classList.toggle('has-note', !!nt);
  nb.textContent = nt ? '编辑笔记' : '写笔记';
  const nv = c.querySelector('.note-view');
  nv.hidden = !nt || !c.querySelector('.note-box').hidden;
  if (nt) nv.innerHTML = `<b>私人笔记：</b>${esc(nt)}`;
}

// Keep the Markdown as the source of both the prose and the directory. Only
// promote a paragraph to a group when the entire line is made of valid entries.
function briefGroup(line, sec){
  const heading=/^\*\*(.+?)\*\*：(.*)$/.exec(line);
  if (!heading) return null;
  const items=[], row=/(.+?)(（第\s*(\d+)\s*条）)([，。；、]|$)/gy;
  let end=0, m;
  while ((m=row.exec(heading[2]))){
    if (!ITEMS.has(sec+'-'+m[3])) return null;
    items.push({label:m[1],ref:m[2],n:m[3],separator:m[4]}); end=row.lastIndex;
  }
  return items.length && end===heading[2].length ? {name:heading[1],items} : null;
}
function briefLink(id,label){
  const a=document.createElement('a');
  a.href=chapterHref(id.split('-')[1],id); a.dataset.briefTarget=id; a.textContent=label;
  if(/^\d+$/.test(label)){
    const [,sec,n]=id.split('-');
    a.setAttribute('aria-label',n?'第 '+sec+' 章第 '+n+' 条':'第 '+sec+' 章');
  }
  return a;
}
function briefText(node,line){
  renderText(node,line,[],false);
  for (const ref of node.querySelectorAll('.xref')){
    const keys=ref.dataset.keys.split(',');
    const dest=k=>k.startsWith('s')?'sec-'+k.slice(1):'e-'+k;
    if (keys.length===1){ref.replaceWith(briefLink(dest(keys[0]),ref.textContent));continue;}
    // A written range retains its range notation; each printed number is a link.
    const text=ref.textContent, lead=text.match(/^(?:第\s*\d+\s*节|本节)(?=第)/)?.[0] || '';
    const body=text.slice(lead.length), fragment=document.createDocumentFragment();
    fragment.append(lead); let end=0;
    for (const m of body.matchAll(/\d+/g)){
      fragment.append(body.slice(end,m.index));
      const key=keys.find(k=>(k.startsWith('s')?k.slice(1):k.split('-')[1])===m[0]);
      fragment.append(key?briefLink(dest(key),m[0]):m[0]); end=m.index+m[0].length;
    }
    fragment.append(body.slice(end)); ref.replaceWith(fragment);
  }
}
function buildChapterBrief(s,block){
  const make=(tag,cls,parent,text)=>{
    const el=document.createElement(tag); el.className=cls;
    if(text!==undefined) el.textContent=text; parent.append(el); return el;
  };
  const skip=briefLink('e-'+s.n+'-'+s.entries[0].n,'直接读正文 ↓');
  skip.className='brief-skip'; block.querySelector('.sec-h').append(skip);
  const brief=make('div','chapter-intro',block), overview=make('div','brief-overview',brief);
  const parts=s.intro.map(line=>({line,group:briefGroup(line,s.n)}));
  const groups=parts.filter(p=>p.group).map(p=>p.group);
  const covered=new Set(groups.flatMap(g=>g.items.map(e=>e.n)));
  const remaining=s.entries.filter(e=>!covered.has(e.n));
  let directory=null;
  function startDirectory(){
    if(directory) return;
    directory=make('section','brief-directory',brief);
    const head=make('div','brief-dir-head',directory);
    make('h3','',head,'本章条目');
    const count=groups.length+(groups.length && remaining.length?1:0);
    const meta=make('span','brief-count',head,count?count+' 组 / ':'');
    meta.append(block.querySelector('.shown'));
  }
  function addGroup(name,items){
    startDirectory();
    const row=make('div','brief-group',directory);
    if(name) make('h4','',row,name); else row.classList.add('ungrouped');
    const ul=make('ul','brief-entries',row);
    for(const e of items){
      const li=make('li','',ul), a=briefLink('e-'+s.n+'-'+e.n,unescMd(e.label.replace(/\*\*/g,'')));
      li.append(a); make('small','',a,e.ref);
      if(e.separator) make('span','brief-separator',li,e.separator);
    }
  }
  function paragraph(parent,text){const p=make('p','intro',parent);briefText(p,text);}
  for(const {line,group} of parts){
    if(group){addGroup(group.name+'：',group.items);continue;}
    if(groups.length && /^本节条目按主题/.test(line)){
      startDirectory();paragraph(directory,line);continue;
    }
    const parent=directory || overview;
    if (/^\*\*.+?\*\*：/.test(line)){paragraph(make('aside','brief-note',parent),line);continue;}
    // Split only explicit scope lists and evidence/cost explanations. Unknown
    // formats stay as complete paragraphs, in their original position.
    const split=line.search(/(?:^|(?<=。))(?=收益那一栏|成本那一栏|多数数字是|有几条标了「随机试验」|这里不把时间换算|本节主要依据|四种口径分开算|世界卫生组织给的数字)/);
    const main=split<0?line:line.slice(0,split), method=split<0?'':line.slice(split);
    const row=main&&method?make('div','brief-columns',parent):parent;
    const list=/^([^：。]+：)([^。]+；[^。]+。)$/.exec(main);
    if(list){
      const scope=make('div','brief-scope',row);make('h3','',scope,list[1]);
      const ul=make('ul','',scope);
      for(const part of list[2].match(/[^；。]+[；。]/g)) briefText(make('li','',ul),part);
    }else if(main) paragraph(row,main);
    if(method){
      const note=make('aside','brief-note',row);make('h3','',note,'数字怎么读');
      // Keep the two methodological notes separate when both are present.
      for(const text of method.split(/(?<=。)(?=成本那一栏)/)) paragraph(note,text);
    }
  }
  if(remaining.length) addGroup(groups.length?'其他条目':'',remaining.map(e=>({n:e.n,label:e.title,ref:'（第 '+e.n+' 条）'})));
  [skip,...brief.querySelectorAll('a[data-brief-target]')].forEach((a,i)=>a.id='brief-'+s.n+'-'+i);
}

function build(sections){
  for (const s of sections){ SECS.set(s.n, s); for (const e of s.entries) ITEMS.set(`${s.n}-${e.n}`, e); }
  const list = document.getElementById('list');
  for (const s of sections){
    const block = document.createElement('section'); block.className='sec-block'; block.dataset.sec = s.n; block.id = 'sec-'+s.n;
    block.innerHTML = `<div class="sec-h"><div><div class="kicker">${esc(topics.find(t=>t[3].includes(Number(s.n)))?.[0] || '章节阅读')} / 第 ${s.n.padStart(2,'0')} 章</div><h2>${esc(s.title)}</h2></div><span class="shown"></span></div>`;
    CUR_SEC = s.n;
    buildChapterBrief(s,block);
    for (const e of s.entries){
      const id = `e-${e.sec}-${e.n}`;
      const k = `${e.sec}-${e.n}`;
      const c = document.createElement('article'); c.className='card'; c.id = id; c.dataset.k = k;
      c.innerHTML = `
        <div class="card-meta"><span class="idx">条目 ${e.sec.padStart(2,'0')}.${e.n.padStart(2,'0')}</span><span class="money-label">${esc(LABEL.money[e.money] || e.money)}</span></div>
        <div class="card-h"><h3 class="t"></h3><a class="anchor" href="#${id}" aria-label="本条链接">#</a></div>
        <p class="human"></p>
        <div class="badges"></div>
        <dl class="rows"><dt class="k">成本</dt><dd class="v cost"></dd>
          <dt class="k">收益</dt><dd class="v gain"></dd></dl>
        <div class="entry-note"${e.note ? '' : ' hidden'}><b>备注</b> <div class="note"></div></div>
        <aside class="entry-ref" aria-label="证据与来源"><span>证据 ${esc(e.grade)} 级${esc(e.gradeNote || '')}</span><span aria-hidden="true"> · </span><span>来源：</span><span class="sources"></span></aside>
        <div class="note-view" hidden title="点击编辑笔记"></div>
        <div class="note-box" hidden><textarea aria-label="私人笔记" placeholder="写下你的笔记，自动保存在本机"></textarea></div>
        <div class="my-bar">
          <button type="button" class="my-btn act-todo" data-act="todo" aria-pressed="false">待办</button>
          <button type="button" class="my-btn act-done" data-act="done" aria-pressed="false">已做到</button>
          <button type="button" class="my-btn act-save" data-act="save" aria-pressed="false">收藏</button>
          <button type="button" class="my-btn act-note" data-act="note">写笔记</button>
          <button type="button" class="my-btn act-skip" data-act="skip" aria-pressed="false" title="对我无关，隐藏此条">隐藏</button>
        </div>`;
      const badges = c.querySelector('.badges');
      const add = (cls, text) => { const t=document.createElement('span'); t.className='badge '+cls; t.textContent=text; badges.appendChild(t); };
      if (e.who.length) add('plain', '适用：' + e.who.map(g => g.map(v => WHO_LABEL[v] || v).join('且').replace(/且(\d)/g, '且 $1')).join('、'));
      if (e.dispute) add('danger', '争议');
      if (e.todo) add('warn', '含待核实');
      e.upd = updOf(e);
      if (e.upd && e.upd.age <= 30){
        const [, m, d] = e.upd.date.split('-').map(Number);
        add('upd', `${m} 月 ${d} 日${e.upd.kind}`);
        if (e.upd.fields) badges.lastChild.title = '这次改了：' + e.upd.fields.join('、');
      }
      syncCardMyUI(c, k);
      block.appendChild(c);
      const card = {e, el:c, key:null, vis:false, f:{t:c.querySelector('.t'), cost:c.querySelector('.cost'), human:c.querySelector('.human'), gain:c.querySelector('.gain'), note:c.querySelector('.note'), src:c.querySelector('.sources')}};
      card.f.t.textContent = e.title;
      CARDS.push(card); CARD_OF.set(c, card); CARD_IO.observe(c);
    }
    list.appendChild(block);
    BLOCKS.push({n:s.n, el:block, count:block.querySelector('.shown'), total:s.entries.length});
  }
  document.getElementById('tot').textContent = CARDS.length;
  updateMyCounts();
}
function buildGlossary(){
  const box = document.getElementById('gloss'); if (!GLOSS.length) { box.hidden = true; return; }
  const dl = box.querySelector('dl');
  for (const g of [...GLOSS].sort((a,b) => a.term.localeCompare(b.term, 'zh'))){
    const dt = document.createElement('dt'); dt.textContent = g.term;
    const dd = document.createElement('dd'); dd.textContent = g.meaning;
    dl.appendChild(dt); dl.appendChild(dd);
  }
}

/* ---------- 筛选状态 ---------- */
const DIMS = ['sec','scope','my','ratio','lens','grade','money','time','will','who','upd','days'];
let UPD = {};
const TODAY = Date.parse(new Intl.DateTimeFormat('sv-SE').format(new Date()));
const ageOf = d => Math.round((TODAY - Date.parse(d)) / 864e5);
function updOf(e){
  const u = UPD[`${e.sec}-${e.n}`]; if (!u) return null;
  return u.added ? {kind:'新增', date:u.added, age:ageOf(u.added)} : {kind:'改过', date:u.changed, age:ageOf(u.changed), fields:u.fields};
}
function fitsUpd(e){
  if (!state.upd.size && !state.days.size) return true;
  const u = e.upd; if (!u) return false;
  if (state.upd.size && !state.upd.has(u.kind)) return false;
  return !state.days.size || u.age <= Number([...state.days][0]);
}
function buildUpdLine(){
  if (!Object.keys(UPD).length) return;
  document.getElementById('g-upd').hidden = false;
}
function fitsMe(e){
  if (!state.who.size || !e.who.length) return true;
  const has = v => state.who.has(v) || (v === '35岁' && state.who.has('60岁'));
  return e.who.some(g => g.every(has));
}
function fitsMyTracker(e){
  const k = `${e.sec}-${e.n}`;
  const st = MY.status[k] || '';
  // 默认隐藏标记为 skip 的条目，除非用户主动筛选「已隐藏」
  if (!state.my.has('skip') && st === 'skip' && k !== revealedKey) return false;
  if (!state.my.size) return true;
  for (const m of state.my){
    if (m === 'todo' && st === 'todo') return true;
    if (m === 'done' && st === 'done') return true;
    if (m === 'skip' && st === 'skip') return true;
    if (m === 'saved' && MY.saved[k]) return true;
    if (m === 'noted' && (MY.notes[k] || '').trim()) return true;
  }
  return false;
}
const state = { q:'', sec:new Set(), scope:new Set(), my:new Set(), ratio:new Set(), lens:new Set(), grade:new Set(), money:new Set(), time:new Set(), will:new Set(), who:new Set(), upd:new Set(), days:new Set(), dispute:false, todo:false };
function readUrl(){
  const p = new URLSearchParams(location.search);
  state.q = p.get('q') || '';
  for (const d of DIMS) state[d] = new Set((p.get(d)||'').split(',').filter(Boolean));
  state.dispute = p.get('dispute') === '1'; state.todo = p.get('todo') === '1';
}
function writeUrl(){
  const p = new URLSearchParams();
  if (browseAll) p.set('all','1');
  if (!reading() && view !== 'topics') p.set('tab', view);
  if (!reading() && topic !== null) p.set('topic',topic);
  if (state.q) p.set('q', state.q);
  for (const d of DIMS) if (state[d].size) p.set(d, [...state[d]].join(','));
  if (state.dispute) p.set('dispute','1'); if (state.todo) p.set('todo','1');
  const qs = p.toString();
  const hash = location.hash;
  const validHash = hash && (hash === '#catalog' || document.getElementById(hash.slice(1))?.offsetParent) ? hash : '';
  history.replaceState(history.state, '', (qs ? '?'+qs : location.pathname) + validHash);
}
function syncControls(){
  document.getElementById('q').value = indexQuery || state.q;
  document.querySelectorAll('[data-dim] [data-v]').forEach(b => b.setAttribute('aria-pressed', String(state[b.parentElement.dataset.dim].has(b.dataset.v))));
  document.getElementById('f-dispute').checked = state.dispute;
  document.getElementById('f-todo').checked = state.todo;
}
function renderCard(card, terms, key){
  const {e, f} = card;
  CUR_SEC = e.sec;
  renderText(f.t, e.title, terms);
  renderText(f.cost, e.cost, terms);
  f.human.hidden = !e.human;
  if (e.human) renderText(f.human, e.human, terms);
  renderGain(f.gain, e.gain, terms);
  renderGain(f.note, e.note, terms);
  renderSrc(f.src, e.src, terms);
  card.key = key;
}
function apply(){
  const reader = reading();
  setSurface(reader);
  if (!reader) { syncControls(); writeUrl(); return; }
  if (!ITEMS.size) {
    document.getElementById('status').hidden=false;
    loadBook().then(apply).catch(showReadError); return;
  }
  ensureReader();
  const terms = state.q.toLowerCase().split(/\s+/).filter(Boolean);
  const family = readerTopic()?.[3];
  const key = terms.join(' ');
  CUR_TERMS = terms; CUR_KEY = key;
  let shown = 0; const perSec = {}, firstShown = {};
  for (const card of CARDS){
    const {e, el} = card;
    const k = `${e.sec}-${e.n}`;
    const noteText = (MY.notes[k] || '').toLowerCase();
    let ok = true;
    if (!fitsMyTracker(e)) ok = false;
    if (ok && state.scope.size && !state.scope.has(e.scope)) ok = false;
    if (ok && state.ratio.size && !state.ratio.has(e.ratio)) ok = false;
    if (ok && state.lens.size && !state.lens.has(e.lens)) ok = false;
    if (ok && state.grade.size && !state.grade.has(e.grade)) ok = false;
    if (ok && state.money.size && !state.money.has(e.money)) ok = false;
    if (ok && state.time.size && !state.time.has(e.time)) ok = false;
    if (ok && state.will.size && !state.will.has(e.will)) ok = false;
    if (ok && !fitsMe(e)) ok = false;
    if (ok && !fitsUpd(e)) ok = false;
    if (ok && state.dispute && !e.dispute) ok = false;
    if (ok && state.todo && !e.todo) ok = false;
    if (ok && terms.length && !terms.every(t => e.hay.includes(t) || noteText.includes(t))) ok = false;
    if (ok && state.sec.size && !(family ? family.includes(Number(e.sec)) : state.sec.has(e.sec))) ok = false;
    if (el.hidden === ok) el.hidden = !ok;
    if (ok){
      shown++; perSec[e.sec] = (perSec[e.sec]||0)+1;
      firstShown[e.sec] ||= el.id;
      if (card.vis && card.key !== key) renderCard(card, terms, key);
    }
  }
  const wholeTheme = family && !terms.length && !state.todo && !state.dispute && !DIMS.some(d=>d!=='sec' && state[d].size);
  for (const b of BLOCKS){
    const n=perSec[b.n] || 0;
    b.el.hidden=!n && !(wholeTheme && family.includes(Number(b.n)));
    b.count.textContent=(n===b.total?n:n+' / '+b.total)+' 条';
    const skip=b.el.querySelector('.brief-skip'),first=firstShown[b.n];
    skip.hidden=!first;
    if(first){skip.dataset.briefTarget=first;skip.href=chapterHref(b.n,first);}
  }
  document.getElementById('cnt').textContent = shown;
  document.getElementById('empty').hidden = shown !== 0;
  syncControls(); writeUrl();
}

/* ---------- 事件绑定 ---------- */
function wire(){
  const sb = document.getElementById('sidebar'), mb = document.getElementById('menu');
  const setMenu = on => { if (on && !sb.open) sb.showModal(); else if (!on && sb.open) sb.close(); };
  const toTop = () => { setMenu(false); setIndexOpen(false); document.getElementById('catalog').scrollIntoView(); };
  document.getElementById('list').addEventListener('click',ev=>{
    const link=ev.target.closest('a[data-brief-target]');
    if(!link || !plainClick(ev))return;
    const id=link.dataset.briefTarget,target=document.getElementById(id);
    if(!target)return;
    ev.preventDefault();
    const top=link.getBoundingClientRect().top;
    history.replaceState({...history.state,briefSpot:{id:link.id,top}},'');
    if(!target.hidden && !target.closest('.sec-block').hidden){
      // A visible card may be a search result. Keep the user's current filters.
      history.pushState({briefFrom:link.id},'','#'+id);jumpTo(id,true);
    }else openChapter(id.split('-')[1],id,false,link.id);
  });
  mb.addEventListener('click', () => {
    setMenu(true); mb.setAttribute('aria-expanded','true');
    loadBook().then(()=>{ensureReader(); syncControls();}).catch(showReadError);
  });
  sb.addEventListener('close', () => mb.setAttribute('aria-expanded','false'));
  sb.addEventListener('click', ev => { if (ev.target === sb && (ev.clientX < sb.getBoundingClientRect().left || ev.clientX > sb.getBoundingClientRect().right)) setMenu(false); });
  document.getElementById('close-filters').onclick = () => setMenu(false);
  document.getElementById('view-matches').onclick = toTop;
  document.querySelectorAll('[data-dim]').forEach(g => g.addEventListener('click', ev => {
    const b = ev.target.closest('[data-v]'); if (!b) return;
    const dim = g.dataset.dim, v = b.dataset.v, set = state[dim];
    if (dim === 'days' || dim === 'scope'){
      const on = !set.has(v); set.clear(); if (on) set.add(v);
    } else if (dim === 'who'){
      const on = !set.has(v);
      if (v === '无') set.clear(); else set.delete('无');
      on ? set.add(v) : set.delete(v);
    } else {
      set.has(v) ? set.delete(v) : set.add(v);
    }
    apply();
  }));

  document.getElementById('all-chapters').onclick=()=>{state.sec.clear();browseAll=true;indexQuery='';renderIndexResults();apply();toTop();};
  document.getElementById('f-dispute').addEventListener('change', e => { state.dispute = e.target.checked; apply(); });
  document.getElementById('f-todo').addEventListener('change', e => { state.todo = e.target.checked; apply(); });

  let tm; document.getElementById('q').addEventListener('input', e => {
    clearTimeout(tm);
    if (readerTopic()){ indexQuery=e.target.value.trim(); renderIndexResults(); return; }
    tm = setTimeout(() => { state.q = e.target.value.trim(); apply(); }, 120);
  });
  const reset = () => { clearSelection(); selectView('topics'); apply(); toTop(); };
  document.getElementById('reset').addEventListener('click', reset);
  document.getElementById('reset2').addEventListener('click', reset);

  // 卡片内个人状态与笔记事件
  document.getElementById('list').addEventListener('click', ev => {
    const nv = ev.target.closest('.note-view');
    if (nv){
      const c = nv.closest('.card'), k = c.dataset.k, box = c.querySelector('.note-box'), ta = box.querySelector('textarea');
      box.hidden = false; nv.hidden = true; ta.value = MY.notes[k] || ''; ta.focus();
      return;
    }
    const btn = ev.target.closest('.my-btn'); if (!btn) return;
    const c = btn.closest('.card'), k = c.dataset.k, act = btn.dataset.act;
    if (act === 'todo' || act === 'done' || act === 'skip'){
      if(act==='skip' && revealedKey===k) revealedKey='';
      MY.status[k] = MY.status[k] === act ? undefined : act;
      if (!MY.status[k]) delete MY.status[k];
      saveMy(); syncCardMyUI(c, k);
      if (act === 'skip' || state.my.size) apply();
    } else if (act === 'save'){
      MY.saved[k] = !MY.saved[k];
      if (!MY.saved[k]) delete MY.saved[k];
      saveMy(); syncCardMyUI(c, k);
      if (state.my.size) apply();
    } else if (act === 'note'){
      const box = c.querySelector('.note-box'), ta = box.querySelector('textarea');
      box.hidden = !box.hidden;
      if (!box.hidden){ ta.value = MY.notes[k] || ''; ta.focus(); }
      syncCardMyUI(c, k);
    }
  });
  document.getElementById('list').addEventListener('input', ev => {
    const ta = ev.target.closest('.note-box textarea'); if (!ta) return;
    const c = ta.closest('.card'), k = c.dataset.k;
    const val = ta.value.trim();
    if (val) MY.notes[k] = ta.value; else delete MY.notes[k];
    saveMy(); syncCardMyUI(c, k);
  });

  // 导出与导入个人记录 JSON
  document.getElementById('export-my').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(MY, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `HowToLiveBetter-MY-Backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  });
  const impFile = document.getElementById('import-file');
  document.getElementById('import-my').addEventListener('click', () => impFile.click());
  impFile.addEventListener('change', async () => {
    const file = impFile.files[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      MY = { status: data.status || {}, saved: data.saved || {}, notes: data.notes || {} };
      saveMy();
      for (const {el} of CARDS) syncCardMyUI(el, el.dataset.k);
      apply();
      alert('个人清单与笔记已成功恢复！');
    } catch (e) {
      alert('导入失败：JSON 格式无效');
    }
    impFile.value = '';
  });

  // 马来西亚速查弹窗
  const PM = document.getElementById('portal-mask');
  const portalButton = document.getElementById('open-portal');
  const closePortal = () => { PM.hidden = true; setOverlay(false); portalButton.focus(); };
  portalButton.addEventListener('click', () => { PM.hidden = false; setOverlay(true); document.getElementById('pm-x').focus(); });
  document.getElementById('pm-x').addEventListener('click', closePortal);
  PM.addEventListener('click', ev => { if (ev.target === PM) closePortal(); });
  document.addEventListener('keydown', e => {
    if (!DM.mask.hidden || sb.open) return;
    if (!PM.hidden) { if (e.key === 'Escape') closePortal(); return; }
    if (e.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); if(reading() && mobileIndex.offsetWidth)setIndexOpen(true); document.getElementById('q').focus(); }
    if (e.key === 'Escape' && document.activeElement.id === 'q') document.activeElement.blur();
  });

  const pop = document.getElementById('pop');
  document.addEventListener('click', e => {
    const ab = e.target.closest('abbr.term');
    if (ab) { e.preventDefault(); showTerm(ab); return; }
    if (!e.target.closest('#pop')) pop.hidden = true;
  });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && document.activeElement.matches?.('abbr.term')) showTerm(document.activeElement); });
  addEventListener('scroll', () => { pop.hidden = true; }, {passive:true});
}

/* ---------- 读取文本 ---------- */
const CORPUS_CACHE = new Map();
async function readText(path, tries = 2){
  if (CORPUS_CACHE.has(path)) return CORPUS_CACHE.get(path);
  for (let i = 1; ; i++){
    try {
      const res = await fetch(path, {cache:'no-cache'});
      if (!res.ok) throw new Error('HTTP '+res.status+'：'+path);
      const text = await res.text();
      CORPUS_CACHE.set(path, text);
      return text;
    } catch (err) {
      if (i >= tries) throw err;
      await new Promise(r => setTimeout(r, 300));
    }
  }
}

/* ---------- 专题长文弹窗 ---------- */
const DOC_PREFIX = REPO_BLOB + 'docs/';
function docPathOf(href){
  if (!href) return null;
  if (href.indexOf(DOC_PREFIX) === 0){
    const rest = href.slice(DOC_PREFIX.length);
    if (!/^[^/?#]+[.]md$/.test(rest)) return null;
    try { return 'docs/' + decodeURIComponent(rest); } catch (e) { return 'docs/' + rest; }
  }
  return null;
}
const DM = {
  mask: document.getElementById('doc-mask'), title: document.getElementById('dm-t'),
  gh: document.getElementById('dm-gh'), toc: document.getElementById('dm-toc'),
  doc: document.getElementById('dm-doc'), heads: [], lastFocus: null
};
function dmHref(u){
  if (/^(https?:|mailto:|#)/.test(u)) return u;
  return REPO_BLOB + u.replace(/^(\.\.?\/)+/, '').split('/').map(encodeURIComponent).join('/');
}
function dmInline(s){
  let h = esc(s);
  h = h.replace(/`([^`]+)`/g, (m, c) => '<code>' + c + '</code>');
  h = h.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => '<a href="' + esc(dmHref(u)) + '" target="_blank" rel="noopener">' + t + '</a>');
  h = h.replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, (m, u) => '<a href="' + u + '" target="_blank" rel="noopener">' + u + '</a>');
  h = h.replace(/\*\*((?:\\\*|[^*])+)\*\*/g, '<strong>$1</strong>');
  return h.replace(/\\([*_])/g, '$1');
}
function dmRender(md){
  const lines = md.split('\n'); const out = []; const heads = [];
  let para = [], list = null, title = '';
  const flushP = () => { if (para.length){ out.push('<p>' + dmInline(para.join('')) + '</p>'); para = []; } };
  const flushL = () => { if (list){ out.push('</' + list + '>'); list = null; } };
  const flush = () => { flushP(); flushL(); };
  for (let i = 0; i < lines.length; i++){
    const ln = lines[i];
    if (/^\[← 回/.test(ln)) continue;
    if (!ln.trim()){ flush(); continue; }
    let m;
    if ((m = ln.match(/^(#{1,4})\s+(.*)$/))){
      flush();
      const lv = m[1].length, txt = m[2].trim();
      if (lv === 1){ title = txt; continue; }
      const id = 'dm-h-' + heads.length;
      heads.push({ id, lv, txt });
      out.push('<h' + lv + ' id="' + id + '">' + dmInline(txt) + '</h' + lv + '>');
      continue;
    }
    if (ln.startsWith('|')){
      flush();
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]);
      i--;
      const cells = r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const sep = rows[1] && /^[\s|:-]+$/.test(rows[1]);
      const head = sep ? cells(rows[0]) : null;
      const body = rows.slice(sep ? 2 : 0).map(cells);
      let t = '<div class="dm-tw"><table>';
      if (head) t += '<thead><tr>' + head.map(c => '<th>' + dmInline(c) + '</th>').join('') + '</tr></thead>';
      t += '<tbody>' + body.map(r => '<tr>' + r.map(c => '<td>' + dmInline(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
      out.push(t);
      continue;
    }
    if ((m = ln.match(/^\s*([-*])\s+(.*)$/)) || (m = ln.match(/^\s*\d+\.\s+(.*)$/))){
      const txt = m.length === 3 ? m[2] : m[1];
      const want = /^\s*\d/.test(ln) ? 'ol' : 'ul';
      flushP();
      if (list !== want){ flushL(); out.push('<' + want + '>'); list = want; }
      out.push('<li>' + dmInline(txt) + '</li>');
      continue;
    }
    para.push(ln.trim());
  }
  flush();
  return { html: out.join('\n'), heads, title };
}
function dmXrefs(root){
  const saved = CUR_SEC; CUR_SEC = '';
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT,
    { acceptNode: n => n.parentElement.closest('a,code') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  const nodes = [];
  while (w.nextNode()) if (/第\s*\d/.test(w.currentNode.nodeValue)) nodes.push(w.currentNode);
  for (const n of nodes){
    const f = document.createDocumentFragment();
    xrefInto(f, n.nodeValue, []);
    n.replaceWith(f);
  }
  CUR_SEC = saved;
}
function dmTopOf(el){
  return el.getBoundingClientRect().top - DM.doc.getBoundingClientRect().top + DM.doc.scrollTop;
}
function dmSpy(){
  const top = DM.doc.scrollTop + Math.max(90, DM.doc.clientHeight * 0.3); let cur = DM.heads[0];
  for (const h of DM.heads){ const el = document.getElementById(h.id); if (el && dmTopOf(el) <= top) cur = h; }
  for (const a of DM.toc.children) a.classList.toggle('on', !!cur && a.dataset.id === cur.id);
}
let dmSpyTick = false;
DM.doc.addEventListener('scroll', () => {
  POP.hidden = true;
  if (dmSpyTick) return; dmSpyTick = true;
  requestAnimationFrame(() => { dmSpyTick = false; dmSpy(); });
});
function setOverlay(open){
  document.body.style.overflow = open ? 'hidden' : '';
  for (const node of document.querySelectorAll('body > header, body > main, body > footer, .skip-link')) node.inert = open;
}
function dmClose(){
  if (DM.mask.hidden) return;
  DM.mask.hidden = true;
  POP.hidden = true;
  setOverlay(false);
  DM.lastFocus?.focus?.({ preventScroll: true });
  DM.lastFocus = null;
}
async function dmOpen(path, from){
  DM.lastFocus = from || null;
  DM.mask.hidden = false;
  setOverlay(true);
  DM.toc.textContent = ''; DM.heads = [];
  DM.title.textContent = decodeURIComponent(path.replace(/^docs\//, '').replace(/\.md$/, ''));
  DM.gh.href = REPO_BLOB + path.split('/').map(encodeURIComponent).join('/');
  DM.gh.hidden = false;
  DM.doc.innerHTML = '<div class="dm-load">正在读取 …</div>';
  DM.doc.scrollTop = 0;
  document.getElementById('dm-x').focus();
  let md;
  try {
    [md] = await Promise.all([readText(path),loadBook()]);
  } catch (err) {
    DM.doc.innerHTML = '<div class="dm-load">读取长文失败（' + esc(String(err.message)) + '）。</div>';
    return;
  }
  const r = dmRender(md);
  if (r.title) DM.title.textContent = r.title;
  DM.doc.innerHTML = r.html;
  dmXrefs(DM.doc);
  DM.heads = r.heads;
  for (const h of r.heads){
    const a = document.createElement('a');
    a.href = 'javascript:void 0'; a.textContent = h.txt; a.dataset.id = h.id;
    if (h.lv >= 3) a.className = 'lv3';
    a.addEventListener('click', ev => {
      ev.preventDefault();
      const el = document.getElementById(h.id);
      const soft = !matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (el) DM.doc.scrollTo({ top: dmTopOf(el) - 12, behavior: soft ? 'smooth' : 'auto' });
    });
    DM.toc.appendChild(a);
  }
  dmSpy();
}
document.addEventListener('click', ev => {
  const a = ev.target.closest?.('a[href]');
  if (!a || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button) return;
  if (a.closest('.dm-h')) return;
  const path = docPathOf(a.href);
  if (!path) return;
  ev.preventDefault();
  dmOpen(path, a);
});
document.getElementById('dm-x').addEventListener('click', dmClose);
DM.mask.addEventListener('click', ev => { if (ev.target === DM.mask) dmClose(); });
document.addEventListener('keydown', ev => {
  if (ev.key !== 'Escape' || DM.mask.hidden) return;
  ev.stopPropagation();
  if (!POP.hidden){ POP.hidden = true; return; }
  dmClose();
}, true);

/* The index loads chapter metadata first. The larger reader is built on first use. */
let corpus = [], browseAll = new URLSearchParams(location.search).get('all') === '1', view = 'topics', topic = null;
const topics = [
  ['身体与健康','health','急救、就医和日常保健',[1,2,13,16,24,28,33,34]],
  ['时间与精力','clock','工作节奏、休息和习惯',[3,4,6,22,29]],
  ['金钱与工作','wallet','日常开支、工作和生意',[5,7,12,19]],
  ['法律与安全','shield','法律边界、账号和防骗',[8,9,11,14,26]],
  ['家庭与居所','home','租房、婚育和家人照护',[10,15,17,18,20,25,27,30]],
  ['学习与出行','road','技能、升学和境外生活',[21,23,31,32]],
];
const icon = name => '<svg class="ic" aria-hidden="true"><use href="assets/icons.svg#'+name+'"/></svg>';
const reading = () => browseAll || !!state.q || state.dispute || state.todo || DIMS.some(d => state[d].size);
function ensureReader(){ if (!CARDS.length && ITEMS.size) build(corpus); }
const catalog = document.getElementById('catalog'), mobileIndex = document.getElementById('index-toggle');
let activeChapter='', indexQuery='', revealedKey='', recordKind='', routeVersion=0;
const readerTopic = () => state.sec.size === 1 ? topics.find(t => t[3].includes(Number([...state.sec][0]))) : null;
const chapterHref = (n,id='sec-'+n) => '?sec='+n+'#'+id;
const plainClick = ev => !ev.button && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey && !ev.altKey;
const chapterRow = s => '<a class="index-row" data-chapter="'+s.n+'" href="'+chapterHref(s.n)+'"><span class="row-num">'+s.n.padStart(2,'0')+'</span><span>'+esc(s.title)+'</span></a>';
function setIndexOpen(on){
  catalog.classList.toggle('index-open',on);
  mobileIndex.setAttribute('aria-expanded',String(on));
  mobileIndex.setAttribute('aria-label',on?'收起指南索引':'打开指南索引');
  document.querySelector('.reader-column').inert=on;
}
function markChapter(n){
  activeChapter=n;
  for (const a of document.querySelectorAll('#index-panel [data-chapter]')){
    if (a.dataset.chapter === n) a.setAttribute('aria-current','location'); else a.removeAttribute('aria-current');
  }
  document.getElementById('mobile-location').textContent=(readerTopic()?.[0] || '章节阅读')+(n?' · 第 '+n+' 章':'');
}
function clearSelection(){
  browseAll=false; state.q=''; indexQuery=''; revealedKey='';
  for (const d of DIMS) state[d].clear(); state.dispute=false; state.todo=false;
}
function setSurface(reader){
  if(!history.state?.briefFrom || !reader) document.querySelector('.brief-return')?.remove();
  const changed=catalog.classList.contains('is-reading')!==reader;
  catalog.classList.toggle('is-reading',reader);
  document.getElementById('cover').hidden=reader;
  document.getElementById('reader-head').hidden=!reader;
  document.getElementById('list').hidden=!reader && !!corpus.length;
  const n=DIMS.reduce((t,d)=>t+(d==='sec' && readerTopic()?0:state[d].size),Number(state.dispute)+Number(state.todo));
  const badge=document.getElementById('filter-count'); badge.hidden=!n; badge.textContent=n;
  const family=readerTopic();
  document.getElementById('reader-title').textContent=family?.[0] || (state.my.size?'我的清单':state.q?'搜索结果':browseAll?'全部章节':'筛选结果');
  document.getElementById('reader-chapters').textContent=family?family[3].length+' 章 · ':'';
  if (changed){setIndexOpen(false);selectView(reader?'topics':view,reader?null:topic);}
  const tree=document.getElementById('topic-tree');
  if (tree) for(const group of tree.children){
    const current=topics[Number(group.dataset.group)]===family;
    group.querySelector('.topic-chapters').hidden=!current;
    group.querySelector('.topic-name').classList.toggle('selected',current);
  }
  if (!reader) markChapter('');
}
function selectView(next, topicId=null){
  if (!['topics','chapters','essays','mine'].includes(next)) next='topics';
  view=next; topic=topicId;
  const inReader=catalog.classList.contains('is-reading');
  for(const btn of document.querySelectorAll('[data-view]')) btn.setAttribute('aria-pressed',String(btn.dataset.view===view));
  for(const id of ['topics','chapters','essays','mine']) document.getElementById(id).hidden=id!==view || (id==='topics' && inReader);
  const tree=document.getElementById('topic-tree'); if(tree) tree.hidden=view!=='topics'||!inReader;
  if(view==='chapters'){
    const chapters=corpus.filter(s=>topic===null || topics[topic][3].includes(Number(s.n)));
    document.getElementById('chapters').innerHTML='<div class="chapter-label"><b>'+(topic===null?'所有章节':topics[topic][0])+'</b><span>'+chapters.length+' 章</span></div><div class="chapter-grid">'+chapters.map(chapterRow).join('')+'</div>';
  }
  const records=document.getElementById('record-items');
  if(records) {records.hidden=!inReader || !readerTopic(); if(view==='mine' && !records.hidden && recordKind) renderRecords();}
  if(inReader) markChapter(activeChapter);
  renderIndexResults();
}
function renderIndexResults(){
  const out=document.getElementById('index-results'),dir=document.getElementById('directory');
  out.hidden=!indexQuery;dir.hidden=!!indexQuery;
  if(!indexQuery){out.replaceChildren();return;}
  const terms=indexQuery.toLowerCase().split(/\s+/),includes=s=>terms.every(t=>s.toLowerCase().includes(t));
  const rows=corpus.filter(s=>includes(s.n+' '+s.title)).map(chapterRow);
  for(const e of ITEMS.values()) if(includes(e.hay) && MY.status[e.sec+'-'+e.n]!=='skip'){
    const id='e-'+e.sec+'-'+e.n;
    rows.push('<a class="index-row" data-item="'+id+'" data-chapter="'+e.sec+'" href="'+chapterHref(e.sec,id)+'"><span class="row-num">'+e.sec+'.'+e.n+'</span><span>'+esc(e.title)+'</span></a>');
  }
  for(const a of document.querySelectorAll('#essays .index-row')) if(includes(a.textContent)) rows.push(a.outerHTML);
  out.innerHTML='<p class="view-hint">'+(rows.length?'搜索结果 · '+rows.length:'没有匹配项')+'</p>'+rows.join('');
}
async function openChapter(n,id='sec-'+n,themeStart=false,briefFrom=null){
  const version=++routeVersion, family=readerTopic();
  const same=family?.[3].includes(Number(n)) && !state.q && !state.dispute && !state.todo && !DIMS.some(d=>d!=='sec' && state[d].size);
  const next=chapterHref(n,id);
  if(briefFrom || location.search+location.hash!==next) history.pushState(briefFrom?{briefFrom}:null,'',next);
  const wasRevealed=revealedKey;
  clearSelection(); state.sec.add(n); revealedKey=id.startsWith('e-')?id.slice(2):'';
  setIndexOpen(false); setSurface(true);
  try{
    if(!ITEMS.size){document.getElementById('status').hidden=false; await loadBook();}
    if(version!==routeVersion) return;
    const target=document.getElementById(id);
    if(!same || !target || target.hidden || (wasRevealed && MY.status[wasRevealed]==='skip')) apply();
    else syncControls();
    renderIndexResults();
    markChapter(n);
    if(themeStart){
      stopJump();const h=document.getElementById('reader-title');h.setAttribute('tabindex','-1');h.focus({preventScroll:true});
      document.getElementById('reader-head').scrollIntoView({block:'start'});
    }else jumpTo(id,true);
  }catch(err){showReadError(err);}
}
async function restoreRoute(){
  const version=++routeVersion; stopJump();
  const p=new URLSearchParams(location.search), id=location.hash.slice(1);
  const target=/^(?:e|sec)-(\d+)(?:-\d+)?$/.exec(id);
  clearSelection();readUrl();browseAll=p.get('all')==='1';
  if(target && !reading()) state.sec.add(target[1]);
  if(target && id.startsWith('e-')) revealedKey=id.slice(2);
  const t=p.has('topic')?Number(p.get('topic')):null;
  selectView(p.get('tab'),Number.isInteger(t)&&topics[t]?t:null);setSurface(reading());
  if(reading()&&!ITEMS.size){document.getElementById('status').hidden=false;await loadBook();}
  if(version!==routeVersion)return;
  apply();updateMyCounts();
  const anchor=target && document.getElementById(id);
  if(anchor && (anchor.hidden || anchor.closest('.sec-block')?.hidden)){
    clearSelection();state.sec.add(target[1]);revealedKey=id.startsWith('e-')?id.slice(2):'';apply();
  }
  const saved=history.state?.briefSpot, origin=saved && document.getElementById(saved.id);
  if(origin?.getClientRects().length){
    // Native history traversal may reset focus after dispatching popstate.
    await new Promise(resolve=>setTimeout(resolve,0));
    if(version!==routeVersion)return;
    const bar=document.querySelector('.index-mobile');
    const min=(bar.offsetHeight?bar:document.querySelector('header.nav')).getBoundingClientRect().bottom+8;
    jumpTo(origin.id,true,Math.max(min,Math.min(saved.top,innerHeight-origin.offsetHeight-8)));
  }else if(target)jumpTo(id);
  else if(readerTopic()){const n=[...state.sec][0];jumpTo('sec-'+n);}
  else if(id==='catalog') document.getElementById('catalog').scrollIntoView();
}
function initializeDirectory(){
  const topicGrid=document.getElementById('topics');
  topicGrid.innerHTML=topics.map(([name,sym,desc,ids],i)=>'<a class="topic-tile" href="'+chapterHref(ids[0])+'" data-topic="'+i+'" data-chapter="'+ids[0]+'"><span class="tile-top"><span class="tile-icon tint-'+i+'">'+icon(sym)+'</span><span class="row-num">0'+(i+1)+' / 06</span></span><strong>'+name+'</strong><span class="topic-desc">'+desc+'</span><span class="tile-bottom">'+ids.length+' 个章节'+icon('arrow')+'</span></a>').join('');
  const tree=document.createElement('nav');tree.id='topic-tree';tree.setAttribute('aria-label','按主题定位章节');tree.hidden=true;
  tree.innerHTML=topics.map(([name,sym,,ids],i)=>'<div data-group="'+i+'"><a class="topic-name" href="'+chapterHref(ids[0])+'" data-topic-start="'+ids[0]+'">'+icon(sym)+'<strong>'+name+'</strong><small>'+ids.length+' 章</small></a><div class="topic-chapters" hidden>'+ids.map(n=>chapterRow(corpus.find(s=>Number(s.n)===n))).join('')+'</div></div>').join('');
  topicGrid.after(tree);
  document.querySelector('.record-links').innerHTML=[['todo','待办'],['done','已做到'],['saved','收藏'],['noted','笔记'],['skip','已隐藏']].map(([key,name])=>'<a class="index-row" href="?my='+key+'" data-mine="'+key+'"><span>'+name+'</span><b data-record="'+key+'">0</b>'+icon('arrow')+'</a>').join('')+'<button type="button" class="link-back" id="backup-open">备份与恢复记录</button><div id="record-items"></div>';
  document.getElementById('backup-open').onclick=()=>document.getElementById('menu').click();
  mobileIndex.onclick=()=>setIndexOpen(!catalog.classList.contains('index-open'));
  matchMedia('(max-width:790px)').addEventListener('change',()=>setIndexOpen(false));
  document.addEventListener('keydown',ev=>{if(ev.key==='Escape' && catalog.classList.contains('index-open') && !document.getElementById('sidebar').open && DM.mask.hidden){setIndexOpen(false);mobileIndex.focus();}});
  document.getElementById('index-panel').addEventListener('click',ev=>{
    if(!plainClick(ev))return;
    const a=ev.target.closest('[data-chapter],[data-topic-start]');
    if(a){ev.preventDefault();openChapter(a.dataset.chapter||a.dataset.topicStart,a.dataset.item,a.matches('.topic-tile,.topic-name'));return;}
    const record=ev.target.closest('[data-mine]');
    if(record && readerTopic()){
      ev.preventDefault();recordKind=record.dataset.mine;renderRecords();
    }
  });
  document.querySelector('.tabbar').onclick=ev=>{
    const b=ev.target.closest('[data-view]');if(!b)return;selectView(b.dataset.view);
    if(!reading()){const url=new URL(location.href);url.search='';if(view!=='topics')url.searchParams.set('tab',view);url.hash='catalog';history.pushState(null,'',url);}
  };
  addEventListener('popstate',()=>{POP.hidden=true;restoreRoute().catch(showReadError);});
}

function renderRecords(){
  const rows=[...ITEMS].filter(([id])=>recordKind==='saved'?MY.saved[id]:recordKind==='noted'?MY.notes[id]?.trim():MY.status[id]===recordKind);
  document.getElementById('record-items').innerHTML=rows.length?rows.map(([id,e])=>'<a class="index-row" data-chapter="'+e.sec+'" data-item="e-'+id+'" href="'+chapterHref(e.sec,'e-'+id)+'"><span class="row-num">'+e.sec+'.'+e.n+'</span><span>'+esc(e.title)+'</span></a>').join(''):'<p class="view-hint">还没有这类记录。</p>';
}

let chapterFiles = [], pendingBook = null;
function showReadError(err){
  const status = document.getElementById('status');
  document.getElementById('list').hidden=false; status.hidden=false;
  status.textContent='读取失败：'+err.message+'。请通过本地 HTTP 服务打开页面，或刷新重试。';
}
function loadBook(){
  if(pendingBook) return pendingBook;
  const statusText = document.getElementById('status-t'), statusBar = document.getElementById('status-b');
  const progress = (done,total) => {
    if(statusText) statusText.textContent='正在读取正文 '+done+'/'+total;
    if(statusBar) statusBar.style.width=(done/total*100)+'%';
  };
  pendingBook=(async()=>{
    const updP = fetch('updates.json', {cache:'no-cache'}).then(r => r.ok ? r.json() : null).catch(() => null);
    let done = 0;
    progress(0, chapterFiles.length);
    const parts = await Promise.all(chapterFiles.map(async f => {
      const text = await readText(f);
      progress(++done, chapterFiles.length);
      return text;
    }));
    const sections = parseReadme(parts.join('\n\n'));
    if (!sections.length) throw new Error('empty');
    UPD = (await updP)?.items ?? {};
    document.getElementById('status').hidden = true;
    corpus = sections;
    for (const s of corpus){ SECS.set(s.n,s); for (const e of s.entries) ITEMS.set(e.sec+'-'+e.n,e); }
    buildUpdLine();
  })().catch(err => {pendingBook=null; throw err;});
  return pendingBook;
}
(async function init(){
  const status=document.getElementById('status');
  try{
    const md=await readText('README.md');
    // Opening the index only needs the directory, not every chapter's full text.
    const unique=new Map();
    for(const m of md.matchAll(/\[([^\]\n]+)\]\((book\/(\d+)-[^)]+\.md)\)/g)){
      if (!unique.has(m[2])) unique.set(m[2],{n:String(Number(m[3])),title:m[1].replace(/^\d+\.\s*/,''),path:m[2]});
    }
    corpus=[...unique.values()].sort((a,b)=>Number(a.n)-Number(b.n)); chapterFiles=corpus.map(x=>x.path);
    if(!chapterFiles.length) throw new Error('找不到章节目录');
    status.hidden=true; GLOSS=parseGlossary(md);
    buildGlossary(); readUrl(); wire(); initializeDirectory();
    const launchPortal = new URLSearchParams(location.search).has('portal');
    await restoreRoute();
    if(launchPortal) document.getElementById('open-portal').click();
  } catch (err) {
    showReadError(err);
  }
})();
