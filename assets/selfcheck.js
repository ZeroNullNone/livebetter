const PROFILE = [
  {id:'ageYears', text:'你的周岁年龄', type:'number'},
  {id:'sex', text:'你的性别', opts:[['m','男'],['f','女']]},
  {id:'kid', text:'家里有 4 岁以下的孩子吗', opts:[['y','有'],['n','没有']]},
];
const validAge = age => age !== undefined && age !== null && String(age).trim() !== ''
  && Number.isInteger(Number(age)) && Number(age) >= 0 && Number(age) <= 120;
const ageAtLeast = (p, a) => validAge(p.ageYears) && Number(p.ageYears) >= a;

const GROUPS = [
  {name:'烟、酒和槟榔', mod:'身体', qs:[
    {sec:2, n:1, key:'戒烟', text:'不抽烟，或者已经戒了', also:[{sec:2, n:3, key:'先去拿药'},{sec:2, n:5, key:'戒烟'}]},
    {sec:2, n:19, key:'少喝或不喝酒', text:'不喝酒，或者很少喝'},
    {sec:2, n:8, key:'不嚼槟榔', text:'不嚼槟榔'},
  ]},
  {name:'吃喝', mod:'身体', qs:[
    {sec:2, n:7, key:'含糖饮料', text:'基本不喝奶茶、可乐、包装果汁这类含糖饮料（少喝 Teh Tarik / Milo 甜饮）'},
    {sec:2, n:18, key:'加工肉', text:'很少吃火腿、香肠、培根、午餐肉'},
    {sec:2, n:24, key:'全谷物', text:'主食里有一部分是糙米、燕麦、全麦这类全谷物'},
    {sec:2, n:27, key:'5 份', text:'每天吃够约 5 份水果和蔬菜'},
    {sec:2, n:22, key:'坚果', text:'每天吃一小把原味坚果'},
    {sec:2, n:9, key:'低钠盐', text:'家里做饭用低钠盐（钾盐）', hint:'有肾功能不全或正在吃保钾类药物的，换盐前先问医生；不适用可跳过'},
    {sec:2, n:30, key:'滚烫', text:'热茶热汤放一放再喝，不喝滚烫的'},
    {sec:2, n:42, key:'抽油烟机', text:'炒菜时从开火到做完一直开着抽油烟机', hint:'不做饭可以跳过'},
  ]},
  {name:'动、睡和晒太阳', mod:'身体', qs:[
    {sec:2, n:11, key:'7000', text:'每天走到 7000 步左右，或者每周快走累计 150 分钟以上'},
    {sec:2, n:16, key:'力量训练', text:'每周做点力量训练（俯卧撑、深蹲、器械都算）'},
    {sec:2, n:17, key:'别连着坐太久', text:'不会连着坐好几个小时不起身'},
    {sec:2, n:13, key:'每晚睡 7', text:'每晚睡 7 小时左右，作息基本固定'},
    {sec:2, n:31, key:'晒晒太阳', text:'白天会出门见见太阳，不是整天待在室内冷气房'},
    {sec:2, n:32, key:'BMI', text:'体重在正常范围（BMI 20–25）', hint:'BMI = 体重(公斤) ÷ 身高(米)²'},
    {sec:2, n:10, key:'认真刷牙', text:'每天认真刷牙、用牙线清一次牙缝，缺了牙会去补'},
    {sec:1, n:13, key:'平衡和腿部力量', text:'练过平衡和腿部力量，浴室楼梯装了扶手防滑', when:p => ageAtLeast(p,60)},
  ]},
  {name:'出门和家里的安全', mod:'身体', qs:[
    {sec:1, n:1, key:'系安全带', text:'坐车时前排后排都系安全带'},
    {sec:1, n:9, key:'不酒驾', text:'开车不超速、不酒驾、不看手机，累了进 R&R 休息站停下歇', hint:'不开车可以跳过'},
    {sec:1, n:2, key:'戴头盔', text:'骑摩哆（摩托车）、电动车戴 SIRIM 认证头盔并扣好', hint:'不骑可以跳过'},
    {sec:1, n:6, key:'电动', text:'电动代步车不在室内通道或卧室充电', hint:'没有电动代步车可以跳过'},
    {sec:1, n:3, key:'烟雾报警器', text:'家里装了独立烟雾报警器与干粉灭火器'},
    {sec:1, n:4, key:'燃气', text:'煤气桶（LPG）软管与调节器（Regulator）到期换过', hint:'家里只用电磁炉可以跳过'},
    {sec:1, n:5, key:'野生蘑菇', text:'不采、不买、不吃路边来路不明的野生蘑菇'},
    {sec:1, n:30, key:'安全套', text:'和不固定的伴侣发生关系，全程用安全套', hint:'没有这种情况可以跳过'},
    {sec:1, n:10, key:'安全座椅', text:'孩子坐车用儿童安全座椅（CRS），不抱在怀里', when:p => p.kid === 'y'},
    {sec:1, n:11, key:'限位器', text:'高楼窗户和阳台装了隐形铁花或限位器', when:p => p.kid === 'y'},
  ]},
  {name:'吃药与看病', mod:'身体', qs:[
    {sec:34, n:1, key:'扑热息痛', text:'同时吃两种感冒药或止痛药前，会先看成分表有没有重复的 Paracetamol（Panadol）'},
    {sec:34, n:7, key:'普通感冒', text:'普通伤风感冒不自己买或找医生要抗生素'},
    {sec:34, n:11, key:'头孢', text:'吃抗生素（头孢、甲硝唑等）期间和停药后一周不喝酒'},
    {sec:2, n:12, key:'有高血压', text:'有高血压、高血脂的，在按医嘱规律吃药（可去政府诊所 KK 拿药）', hint:'没有这些病可以跳过'},
  ]},
  {name:'检查和疫苗', mod:'身体', qs:[
    {sec:1, n:7, key:'量血压', text:'最近一年量过血压，高了在吃药控制'},
    {sec:1, n:8, key:'空腹血糖', text:'查过空腹血糖 / HbA1c', hint:'针对 35 岁以上或超重人群，满 40 岁 B40 群体可做 PeKa B40 免费体检', when:p => ageAtLeast(p,35)},
    {sec:1, n:14, key:'乙肝', rev:2, text:'核对过乙肝疫苗接种史，需要补种的已按医生建议接种'},
    {sec:1, n:23, key:'幽门螺杆菌', text:'查过幽门螺杆菌（尤其家里有人得过胃癌或常胃痛）'},
    {sec:1, n:16, key:'HPV', text:'打过 HPV 疫苗', when:p => p.sex === 'f'},
    {sec:1, n:18, key:'宫颈癌', text:'做过宫颈癌筛查（HPV 检测或 Pap Smear 抹片）', when:p => p.sex === 'f' && ageAtLeast(p,30)},
    {sec:1, n:17, key:'乳腺癌', text:'近两年做过乳房 X 光检查（Mammogram，可查 LPPKN 或 PERKESO 补贴）', when:p => p.sex === 'f' && ageAtLeast(p,40)},
    {sec:1, n:19, key:'结直肠癌', text:'做过结直肠癌筛查（政府诊所免费大便潜血 iFOBT 或肠镜）', when:p => ageAtLeast(p,45)},
    {sec:1, n:20, key:'流感疫苗', text:'每年打流感疫苗（政府诊所对高危乐龄人士提供免费接种）', when:p => ageAtLeast(p,60)},
    {sec:1, n:21, key:'带状疱疹', text:'打过带状疱疹（生蛇）疫苗', when:p => ageAtLeast(p,50)},
    {sec:1, n:22, key:'肺炎球菌', text:'打过肺炎球菌疫苗', when:p => ageAtLeast(p,65)},
    {sec:1, n:39, key:'骨密度', text:'做过 DXA 骨密度检查', when:p => p.sex === 'f' && ageAtLeast(p,65)},
  ]},
  {name:'马来西亚急救常识', mod:'急救常识', qs:[
    {sec:13, n:1, key:'叫不应', text:'看到有人倒地、叫不应、没正常呼吸，知道立刻拨打 999、用力按压胸口，并找 AED'},
    {sec:13, n:3, key:'突然嘴歪', text:'知道突然嘴歪、半边手脚无力（中风迹象）要直接打 999，不自己开车去'},
    {sec:13, n:7, key:'胸口压着疼', text:'知道胸口压榨痛超过 15 分钟不缓解要打 999'},
    {sec:13, n:26, key:'有人噎住', text:'会给噎住的人做拍背加海姆立克腹部冲击'},
    {sec:13, n:14, key:'烫伤后', text:'知道烫伤先用流动冷水冲 20 分钟，绝不涂牙膏、黑酱油或油'},
    {sec:13, n:13, key:'咬伤', text:'被狗、猫咬伤或抓破皮，会先用肥皂水冲 15 分钟再当天去诊所/医院打疫苗'},
    {sec:13, n:20, key:'误服', text:'知道误服强酸强碱清洁剂、农药绝不催吐，带上瓶子去急诊'},
    {sec:13, n:24, key:'火灾', text:'知道火灾时小火快逃、浓烟关门塞缝，走逃生梯不坐电梯'},
    {sec:13, n:43, key:'婴儿噎住', text:'会给不满 1 岁的婴儿做 5 次拍背加 5 次按胸', when:p => p.kid === 'y'},
  ]},
  {name:'精力和情绪', mod:'精力', qs:[
    {sec:3, n:1, key:'关掉非必要通知', text:'关掉了手机上不必要的通知，专注工作时手机放在看不到的地方'},
    {sec:3, n:2, key:'固定起床时间', text:'周末也基本按平时的时间起床'},
    {sec:3, n:4, key:'下午两点以后', text:'下午两点以后不喝咖啡、浓茶（Kopi / Teh）'},
    {sec:3, n:9, key:'到点就睡', text:'不会为了打游戏、刷短视频报复性熬夜'},
    {sec:3, n:8, key:'睡前一小时', text:'睡前一小时不看手机'},
    {sec:3, n:20, key:'别人过得怎么样', text:'不会每天刷社交媒体跟同龄人比生活'},
    {sec:3, n:13, key:'49 小时', text:'每周工作时间尽量控制在 45–50 小时以内', hint:'没在上班可以跳过'},
    {sec:3, n:16, key:'学会拒绝', text:'不想接的请求能干脆说出「不」'},
    {sec:22, n:9, key:'定期和人见面', text:'定期和朋友家人当面聚聚，不是心情差了才找人'},
  ]},
  {name:'钱、报税与保障（马来西亚版）', mod:'钱', qs:[
    {sec:5, n:1, key:'自动续费', text:'检查并关掉了不用的 App 订阅和自动扣款（Auto-debit）'},
    {sec:5, n:2, key:'报税', text:'按自己的收入类型和当年期限上 LHDN MyTax 报税，只申报符合资格且有凭证的减免', hint:'未达纳税门槛可以跳过'},
    {sec:5, n:7, key:'最低还款', text:'不用信用卡最低还款（Minimum Payment 18% 年息），不乱开先买后付（BNPL）和个人贷款'},
    {sec:5, n:27, key:'应急金', text:'在 PIDM 保障银行或高息灵活户口存够了 3 到 6 个月生活费的应急金'},
    {sec:5, n:6, key:'高收益', text:'看到「稳赚」「保证高回酬」先查 SC / BNM 警示名单，直接走开'},
    {sec:25, n:7, key:'公积金', text:'已经核对 KWSP (EPF) 提名（Nomination）：非穆斯林个人提名人一般是受益人，穆斯林提名人是管理人', hint:'未满 18 岁或无 EPF 户口可跳过'},
    {sec:5, n:26, key:'车险', text:'开车的话，车险买够了并视水灾风险加保了 Special Perils（水灾险）', hint:'没有车可以跳过'},
    {sec:5, n:40, key:'定期寿险', text:'家里有人靠你的收入生活，你买了保额足够的定期寿险（Term Life）', hint:'家里没人靠你收入可以跳过'},
    {sec:5, n:17, key:'宽基指数', text:'投资前核对风险、费用与个人资格，不借钱炒股；ASNB 各基金的资格和风险不同', hint:'没有投资可以跳过'},
  ]},
  {name:'账号与马来西亚防骗', mod:'账号与防骗', qs:[
    {sec:14, n:1, key:'二次验证', text:'电邮、银行 App、社交账号都开了二次验证（2FA / Passkey）'},
    {sec:14, n:2, key:'邮箱密码单独', text:'主电邮和网上银行密码独立设置，不在其他网站复用'},
    {sec:14, n:3, key:'锁屏密码', text:'手机设了锁屏密码，SIM 卡设了 PIN 码（防偷手机收 TAC 验证码）'},
    {sec:8, n:2, key:'止付', text:'知道一旦被骗转账，第一时间拨打 NSRC 997（国家诈骗应对中心）与银行反诈热线拦截资金'},
    {sec:8, n:4, key:'旧号码', text:'亲友通过 WhatsApp/电话急着借钱转账，会先挂断用旧号码打回去或当面核实'},
    {sec:8, n:8, key:'银行卡', text:'从不把银行户口、提款卡、公司 SSM 借给或租给别人（防触犯刑法典 424A 钱驴账户罪）'},
    {sec:8, n:9, key:'信用', text:'查过自己的国行 eCCRIS 或 CTOS 信用报告，确认名下无冒名贷款'},
    {sec:8, n:17, key:'签字前', text:'签合约或借条前会把条款看完，绝不在空白纸上签字或随便做担保人（Guarantor）'},
  ]},
];
const MODS = ['身体', '急救常识', '精力', '钱', '账号与防骗'];
const modOn = m => ans['mod:' + m] !== 'off';

const COST_W = { money:{'0':0,'少':1,'多':2}, time:{'少':0,'中':1,'多':2}, will:{'否':0,'些':1,'是':2} };
function parse(md){
  const out = []; let sec = null, e = null; let m;
  for (const raw of md.split(/\r?\n/)){
    const line = raw.trimEnd();
    if ((m = /^#{1,2} (\d+)\. /.exec(line))) { sec = +m[1]; e = null; continue; }
    if ((m = /^### (\d+)\. (.+)$/.exec(line)) && sec) { e = {sec, n:+m[1], title:m[2].trim(), human:'', cost:'', grade:'', note:''}; out.push(e); continue; }
    if (!e) continue;
    if ((m = /^\x3c!--\s*成本标签:\s*(.*?)\s*-->/.exec(line))){
      for (const kv of m[1].split(/\s+/)){ const [k,v] = kv.split('='); const p = {'钱':'money','时间':'time','毅力':'will','收益':'level','口径':'lens'}[k]; if (p) e[p] = v; }
    }
    else if ((m = /^- 说人话：(.*)$/.exec(line))) e.human = m[1];
    else if ((m = /^- 成本：(.*)$/.exec(line))) e.cost = m[1];
    else if ((m = /^- 证据等级：\s*([ABC])/.exec(line))) e.grade = m[1];
    else if ((m = /^- 备注：(.*)$/.exec(line))) e.note = m[1];
  }
  for (const x of out){
    x.cs = (COST_W.money[x.money] ?? 0) + (COST_W.time[x.time] ?? 0) + (COST_W.will[x.will] ?? 0);
    x.ratio = x.level === '大' ? (x.cs === 0 ? '极高' : (x.cs <= 2 ? '高' : '一般'))
            : x.level === '中' ? (x.cs === 0 ? '高' : '一般') : '一般';
    x.dispute = /^争议/.test(x.note);
  }
  return out;
}
const plain = s => s.replace(/\*\*/g, '').replace(/\\([*_])/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
const esc = s => s.replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));

let ENTRIES = [];
const find = (sec, n, key) => {
  const hit = (n && ENTRIES.find(x => x.sec === sec && x.n === n))
    || ENTRIES.find(x => x.sec === sec && key && x.title.includes(key));
  if (!hit) console.error(`自查题找不到条目：第 ${sec} 节第 ${n || '?'} 条（${key}）`);
  return hit;
};

const STORE = 'selfcheck-my-v1';
const TRACKER_STORE = 'htlb-my-tracker-v1';
let ans = {};
try { ans = JSON.parse(localStorage.getItem(STORE) || '{}'); } catch (e) {}
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(ans)); } catch (e) {} };
const profile = () => Object.fromEntries(PROFILE.map(p => [p.id, ans['p:'+p.id]]));
const profileDone = () => PROFILE.every(p => p.type === 'number'
  ? validAge(ans['p:'+p.id]) : p.opts.some(([v]) => v === ans['p:'+p.id]));
const qid = q => q.sec + ':' + (q.n || q.key) + (q.rev ? ':v' + q.rev : '');
const shown = (q, p) => q.entry && modOn(q.g.mod) && (!q.when || (profileDone() && q.when(p)));
const activeQs = () => { const p = profile(); return GROUPS.flatMap(g => g.qs).filter(q => shown(q, p)); };

function seg(name, opts, cur, label){
  return `<div class="seg" role="group" aria-label="${esc(label)}">` + opts.map(([v, t, cls]) =>
    `<button type="button" data-k="${esc(name)}" data-v="${v}" class="${cls||''}" aria-pressed="${cur === v}">${t}</button>`).join('') + `</div>`;
}
const YN = [['y','做到了','yes'],['n','没做到','no'],['s','跳过']];

let current = null;
const available = () => GROUPS.filter(g => g.qs.some(q => shown(q,profile())));
const pict = name => '<svg class="ic" aria-hidden="true"><use href="assets/icons.svg#'+name+'"/></svg>';
function renderAsk(refresh = true) {
  const questions = activeQs(), answered = questions.filter(q => ans[qid(q)]).length;
  const groups = available(), g = groups.find(x => x.name === current);
  const profileBox = document.getElementById('profile-qs'), topicBox = document.getElementById('topic-qs');
  profileBox.hidden = !!g; topicBox.hidden = !g;
  document.querySelectorAll('.step-rail li').forEach((li,i) => { if(i === (g?1:0)) li.setAttribute('aria-current','step'); else li.removeAttribute('aria-current'); });
  if (!g && refresh) {
    let h = '<div class="step-index">STEP 01 / 03</div><h2 tabindex="-1">基本情况</h2><p class="form-lead">先填三项基本资料，再选你想了解的主题。</p>';
    for(const [i,f] of PROFILE.entries()){
      const key = 'p:'+f.id;
      h += '<div class="field"><div class="field-label"><span>0'+(i+1)+'</span>'+(f.type==='number'?'<label for="profile-age">'+f.text+'</label>':f.text)+'</div>';
      h += f.type==='number' ? '<div class="age-wrap"><input class="profile-age" id="profile-age" type="number" inputmode="numeric" min="0" max="120" step="1" placeholder="输入年龄" data-k="'+key+'" value="'+esc(String(ans[key] ?? ''))+'"><span>岁</span></div>' : seg(key,f.opts,ans[key],f.text);
      h += '</div>';
    }
    profileBox.innerHTML = h+'<div class="field"><div class="field-label">自查主题 <small>可多选</small></div><div class="mods">'+MODS.map(m=>'<button type="button" data-mod="'+m+'" aria-pressed="'+modOn(m)+'"><span aria-hidden="true">'+(modOn(m)?'✓':'＋')+'</span> '+m+'</button>').join('')+'</div></div>';
  }
  if(g && refresh){
    const list=g.qs.filter(q=>shown(q,profile()));
    topicBox.innerHTML='<div class="step-index">STEP 02 / 03</div><div class="question-head"><h2 tabindex="-1">'+esc(g.name)+'</h2><span>'+String(groups.indexOf(g)+1).padStart(2,'0')+' / '+String(groups.length).padStart(2,'0')+'</span></div><p class="form-lead">'+esc(g.mod)+' · 不确定的题可以跳过。</p>'+
      list.map((q,i)=>'<div class="field"><div class="field-label"><span>'+String(i+1).padStart(2,'0')+'</span>'+esc(q.text)+'</div>'+(q.hint?'<p class="question-hint">'+esc(q.hint)+'</p>':'')+seg(qid(q),YN,ans[qid(q)],q.text)+'</div>').join('');
  }
  document.getElementById('prog').textContent = g ? '已答 '+answered+' / '+questions.length+' 题' : '';
  document.getElementById('prev').hidden = !g; document.getElementById('reset').hidden = !!g;
  document.getElementById('early-result').hidden = !g || !answered || groups.at(-1)===g;
  document.getElementById('go').innerHTML = (g ? (groups.at(-1)===g ? '查看结果' : '下一组') : '开始答题')+' '+pict('arrow');
}
function move(group) {
  current = group?.name || null;
  try { if(current) sessionStorage.setItem('htlb-check-group',current); else sessionStorage.removeItem('htlb-check-group'); } catch {}
  document.getElementById('form-error').textContent='';
  renderAsk(); document.getElementById('ask').scrollIntoView(); document.querySelector('#qs > div:not([hidden]) h2')?.focus({preventScroll:true});
}

const RANK = {'极高':0,'高':1,'一般':2}, LV = {'大':0,'中':1,'小':2}, GR = {A:0,B:1,C:2};
function card(e, also){
  const r = {'极高':'r3','高':'r2','一般':'r1'}[e.ratio];
  const lens = e.lens ? `<span class="badge plain">口径 ${e.lens}</span>` : '';
  const alsoH = also.length ? `<div class="also">相关做法：` + also.map(a =>
    `<a href="index.html#e-${a.sec}-${a.n}">${esc(plain(a.title))}</a>`).join('；') + `</div>` : '';
  return `<div class="card" id="c-${e.sec}-${e.n}">
    <div class="h"><b>${esc(plain(e.title))}</b><a href="index.html#e-${e.sec}-${e.n}">第 ${e.sec} 节第 ${e.n} 条 →</a></div>
    ${e.note ? `<details class="caution"><summary>适用条件与注意事项</summary>${esc(plain(e.note))}</details>` : ''}
    ${e.human ? `<div class="human">${esc(plain(e.human))}</div>` : ''}
    <div class="badges"><span class="badge ${r}">性价比 ${e.ratio}</span><span class="badge ${e.grade}">证据 ${e.grade} 级</span><span class="badge plain">收益 ${e.level}</span>${lens}${e.dispute ? '<span class="badge warn">有争议</span>' : ''}</div>
    <div class="cost">要花的：${esc(plain(e.cost))}</div>${alsoH}
  </div>`;
}
const PILES = [
  {will:'否', name:'一次办完就行', sub:'做一次或者记住就够，不用改习惯'},
  {will:'些', name:'要改一个习惯', sub:'要忍一点不适，坚持几周就成了习惯'},
  {will:'是', name:'要长期坚持', sub:'和惯性长期对着干，最难，挑一件慢慢来'},
];
const WILL = {'否':0,'些':1,'是':2};
const byValue = (a, b) => RANK[a.entry.ratio] - RANK[b.entry.ratio] || LV[a.entry.level] - LV[b.entry.level]
  || WILL[a.entry.will] - WILL[b.entry.will] || GR[a.entry.grade] - GR[b.entry.grade] || a.entry.cs - b.entry.cs;
function renderOut(){
  const qs = activeQs();
  const no = qs.filter(q => ans[qid(q)] === 'n').sort(byValue), yes = qs.filter(q => ans[qid(q)] === 'y');
  const answered = no.length + yes.length;

  const groups = GROUPS.map(g => {
    const y = yes.filter(q => q.g === g).length, n = no.filter(q => q.g === g).length;
    return {g, y, t:y + n, pct: y + n ? y / (y + n) : 1};
  }).filter(r => r.t).sort((a, b) => a.pct - b.pct || b.t - a.t);
  document.getElementById('bars').innerHTML = groups.map(r =>
    `<div class="hbar" title="${esc(r.g.name)}：答了 ${r.t} 题，做到 ${r.y} 项"><span class="nm">${esc(r.g.name)}</span>`
    + `<span class="tr"><span class="fl" style="display:block;width:${(r.pct * 100).toFixed(0)}%"></span></span>`
    + `<span class="v">${r.y} / ${r.t}</span></div>`).join('');

  const easy = no.filter(q => q.entry.will === '否'), free = easy.filter(q => q.entry.money === '0');
  const good = no.filter(q => q.entry.ratio !== '一般'), disp = no.filter(q => q.entry.dispute);
  const weak = groups.find(r => r.t >= 2 && r.pct < 1);
  let v = `你答了 ${answered} 题，做到 <b>${yes.length}</b> 项，没做到 <b>${no.length}</b> 项。`;
  if (answered > 0 && !no.length) v += '已答的这些事，你都做到了。';
  else if (!answered) v += '你还没有回答任何具体题目，返回答题后查看分析。';
  if (weak) v += `漏得最多的是「${esc(weak.g.name)}」，${weak.t} 项里做到 ${weak.y} 项。`;
  if (easy.length) v += `没做到的里有 <b>${easy.length}</b> 项一次办完就行，不用改习惯` + (free.length ? `，其中 ${free.length} 项不花钱。` : '。');
  if (disp.length) v += `有 ${disp.length} 项证据有争议，先看原条目的备注再决定。`;
  document.getElementById('verdict').innerHTML = v;

  document.getElementById('sum').innerHTML =
    `<div class="tile"><b>${answered ? Math.round(yes.length / answered * 100) : 0}%</b><span>答过的题里做到的比例</span></div>` +
    `<div class="tile"><b>${no.length}</b><span>还没做到</span></div>` +
    `<div class="tile r3"><b>${good.length}</b><span>其中性价比高或极高</span></div>` +
    `<div class="tile r2"><b>${easy.length}</b><span>其中一次办完就行</span></div>`;

  const top = no.slice(0, 3);
  const topTitle = `先做这${top.length === 3 ? '三' : top.length === 2 ? '两' : '一'}件`;
  const alsoOf = q => (q.also || []).map(a => find(a.sec, a.n, a.key)).filter(Boolean);
  let h = '';
  if (top.length) h += `<h2>${topTitle}<small>没做到的里性价比最高的</small></h2><ol class="top3">`
    + top.map(q => `<li><a href="#c-${q.entry.sec}-${q.entry.n}">${esc(plain(q.entry.title))}</a> <span class="why">性价比${q.entry.ratio}，证据 ${q.entry.grade} 级，${PILES.find(p => p.will === q.entry.will)?.name ?? ''}</span></li>`).join('') + '</ol>';
  if (answered) h += `<div class="copy-tools">
      <button class="btn green" id="sync-tracker" type="button">同步到我的清单</button>
      ${top.length ? '<button class="btn ghost" id="copy-actions" type="button">复制优先行动清单</button>' : ''}<a class="link-back" href="index.html?tab=mine#catalog">打开我的清单 →</a>
      <p class="copy-status" id="copy-status" role="status" aria-live="polite" aria-atomic="true"></p>
      <div id="copy-fallback" hidden>
        <label for="copy-text">行动清单</label>
        <textarea id="copy-text" rows="10" readonly aria-describedby="copy-status"></textarea>
      </div>
    </div>`;
  for (const p of PILES){
    const list = no.filter(q => q.entry.will === p.will);
    if (!list.length) continue;
    h += `<h2>${p.name}（${list.length} 项）<small>${p.sub}</small></h2>` + list.map(q => card(q.entry, alsoOf(q))).join('');
  }
  document.getElementById('todo').innerHTML = h;
  if (top.length) document.getElementById('copy-text').value = `高性价比人生指南 · ${topTitle}\n\n` + top.map(({entry:e}) =>
    `- [ ] ${plain(e.title)}（第 ${e.sec} 节第 ${e.n} 条）\n`
    + `  性价比${e.ratio}，证据 ${e.grade} 级，${PILES.find(p => p.will === e.will)?.name ?? ''}\n`
    + `  要花的：${plain(e.cost)}`).join('\n\n');
  document.getElementById('done').innerHTML = yes.map(q =>
    `<li><a href="index.html#e-${q.entry.sec}-${q.entry.n}">${esc(plain(q.entry.title))}</a></li>`).join('');
  document.getElementById('done-h').hidden = !yes.length;
}

function show(which){
  document.getElementById('ask').hidden = which !== 'ask';
  document.getElementById('out').hidden = which !== 'out';
  document.querySelector('.check-mast').hidden = which === 'out';
  scrollTo(0, 0);
  if (which === 'out') document.getElementById('result-title').focus({preventScroll:true});
}

document.getElementById('todo').addEventListener('click', async ev => {
  const syncBtn = ev.target.closest('#sync-tracker');
  if (syncBtn) {
    try {
      const qs = activeQs();
      const tracker = JSON.parse(localStorage.getItem(TRACKER_STORE) || '{"status":{},"saved":{},"notes":{}}');
      tracker.status = tracker.status || {};
      let addedTodo = 0, addedDone = 0;
      for (const q of qs) {
        const key = `${q.entry.sec}-${q.entry.n}`;
        if (ans[qid(q)] === 'n' && !tracker.status[key]) { tracker.status[key] = 'todo'; addedTodo++; }
        else if (ans[qid(q)] === 'y' && !tracker.status[key]) { tracker.status[key] = 'done'; addedDone++; }
      }
      localStorage.setItem(TRACKER_STORE, JSON.stringify(tracker));
      document.getElementById('copy-status').textContent = `已同步到主阅读器：新增 ${addedTodo} 项「待办」、${addedDone} 项「已做到」！`;
    } catch (e) {
      document.getElementById('copy-status').textContent = '同步失败：' + e.message;
    }
    return;
  }
  const b = ev.target.closest('#copy-actions'); if (!b) return;
  const status = document.getElementById('copy-status'), fallback = document.getElementById('copy-fallback');
  const text = document.getElementById('copy-text');
  b.disabled = true;
  fallback.hidden = true;
  status.textContent = '正在复制…';
  try {
    await navigator.clipboard.writeText(text.value);
    if (b.isConnected && !document.getElementById('out').hidden) status.textContent = '已复制到剪贴板！';
  } catch (err) {
    if (!b.isConnected || document.getElementById('out').hidden) return;
    fallback.hidden = false;
    status.textContent = '无法自动复制，请在下方手动复制清单。';
    text.focus();
    text.select();
    text.scrollTop = 0;
  } finally {
    b.disabled = false;
  }
});

document.getElementById('qs').addEventListener('click', ev => {
  const mb = ev.target.closest('button[data-mod]'), b = ev.target.closest('button[data-k]');
  if (!mb && !b) return;
  if (mb) {
    const key = 'mod:'+mb.dataset.mod; if(modOn(mb.dataset.mod)) ans[key]='off'; else delete ans[key];
    mb.setAttribute('aria-pressed',String(modOn(mb.dataset.mod))); mb.firstElementChild.textContent=modOn(mb.dataset.mod)?'✓':'＋';
  } else {
    const key=b.dataset.k; if(ans[key]===b.dataset.v) delete ans[key]; else ans[key]=b.dataset.v;
    for(const item of b.parentElement.children) item.setAttribute('aria-pressed',String(ans[key]===item.dataset.v));
  }
  document.getElementById('form-error').textContent=''; save(); renderAsk(false);
});
document.getElementById('qs').addEventListener('input', ev => {
  if (ev.target.id !== 'profile-age') return;
  ans['p:ageYears']=ev.target.value; save(); document.getElementById('form-error').textContent='';
});
const results = () => { renderOut(); show('out'); };
document.getElementById('go').addEventListener('click', () => {
  const err = document.getElementById('form-error');
  if (!profileDone()) {
    const f=PROFILE.find(f=>f.type==='number'?!validAge(ans['p:'+f.id]):!f.opts.some(([v])=>v===ans['p:'+f.id]));
    err.textContent=f.type==='number'?'请输入 0 到 120 之间的整数年龄。':'请先回答「'+f.text+'」。';
    document.querySelector('[data-k="p:'+f.id+'"]').focus(); return;
  }
  const groups=available(); if(!groups.length){err.textContent='请至少选择一个自查主题。';document.querySelector('[data-mod]').focus();return;}
  const next=groups.findIndex(g=>g.name===current)+1;
  if(next===groups.length) results(); else move(groups[next]);
});
document.getElementById('early-result').onclick=results;
document.getElementById('prev').onclick=()=>{const groups=available(),i=groups.findIndex(g=>g.name===current);move(groups[i-1]);};
document.getElementById('back').addEventListener('click', () => { show('ask'); move(available().find(g=>g.name===current)); });
document.getElementById('reset').addEventListener('click', () => { if(Object.keys(ans).length && confirm('清空本机的自查答案？已同步到指南的记录会保留。')){ans={};save();move(null);} });

(async function init(){
  const status = document.getElementById('status');
  try {
    const res = await fetch('README.md', {cache:'no-cache'});
    if (!res.ok) throw new Error('HTTP ' + res.status + ' 读取 README.md 失败');
    const readme = await res.text();
    const files = [...new Set(Array.from(readme.matchAll(/\]\((book\/[^)]+\.md)\)/g), m => m[1]))]
      .filter(f => GROUPS.some(g => g.qs.some(q => f.startsWith(`book/${String(q.sec).padStart(2,'0')}-`))));
    const parts = await Promise.all(files.map(async f => {
      const r = await fetch(f, {cache:'no-cache'});
      if (!r.ok) throw new Error('HTTP ' + r.status + ' 读取 ' + f + ' 失败');
      return await r.text();
    }));
    ENTRIES = parse(parts.join('\n\n'));
    for (const g of GROUPS) for (const q of g.qs) { q.g = g; q.entry = find(q.sec, q.n, q.key); }
    status.remove();
    try { const saved=sessionStorage.getItem('htlb-check-group'); if(profileDone() && available().some(g=>g.name===saved)) current=saved; } catch {}
    renderAsk(); show('ask');
  } catch (err) {
    status.textContent = `读取正文失败：${err.message}。请通过 Web 服务器或本地 HTTP 服务（如 python3 -m http.server）访问。`;
  }
})();
