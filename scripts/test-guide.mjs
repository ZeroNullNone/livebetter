/* End-to-end regression: node scripts/test-guide.mjs (CHROME_PATH can override the browser). */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdtemp, rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

const root=process.env.SITE_ROOT ? path.resolve(process.env.SITE_ROOT)+path.sep : fileURLToPath(new URL('../',import.meta.url));
const browser=[process.env.CHROME_PATH,'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/chromium','/usr/bin/google-chrome'].find(p=>p&&existsSync(p));
assert.ok(browser,'Set CHROME_PATH to a Chrome or Chromium executable.');
// The runner uses the real static site on a new origin and a disposable profile.
async function exercise(){
  const frame=document.querySelector('iframe'), log=[];
  const doc=()=>frame.contentDocument, win=()=>frame.contentWindow, el=s=>doc().querySelector(s);
  const assert=(ok,msg)=>{if(!ok)throw new Error(msg);log.push(msg);};
  const wait=async(f,msg)=>{const start=Date.now();while(!f()){if(Date.now()-start>15000)throw new Error(msg);await new Promise(r=>setTimeout(r,70));}};
  const open=async(url,ready)=>{await new Promise(r=>{frame.onload=r;frame.src=url;});await wait(()=>el(ready),'Missing '+ready+' after opening '+url);};
  const click=s=>{const node=el(s);if(!node)throw new Error('Missing '+s);node.click();};
  const type=(s,val)=>{const node=el(s);node.value=val;node.dispatchEvent(new Event('input',{bubbles:true}));};
  const noOverflow=()=>doc().documentElement.scrollWidth<=doc().documentElement.clientWidth+1;
  try{
    await open('/index.html','#topics .topic-tile');
    assert(doc().querySelectorAll('.topic-tile').length===6,'Six topics loaded');
    assert(!win().performance.getEntriesByType('resource').some(r=>new URL(r.name).pathname.startsWith('/book/')),'Directory opens without fetching the full book');
    for(const w of [1440,1024,820,768,390,320]) {frame.style.width=w+'px';await new Promise(r=>requestAnimationFrame(r));assert(noOverflow(),'Home fits '+w+'px');}
    frame.style.width='1024px';click('[data-topic="2"]');
    const visibleChapters=()=>[...doc().querySelectorAll('.sec-block:not([hidden])')].map(b=>Number(b.dataset.sec));
    await wait(()=>visibleChapters().join()==='5,7,12,19','Money theme did not load all four chapters');
    const counts=[219,107,127,121,131,67];
    for(const [i,expected] of counts.entries()){
      click('#topic-tree [data-group="'+i+'"] .topic-name');
      assert(Number(el('#cnt').textContent)===expected,'Theme '+(i+1)+' contains its '+expected+' entries');
    }
    click('#topic-tree [data-group="3"] .topic-name');
    const first=el('#sec-8'), sameCard=el('#e-14-1'), selectChapter=n=>click('#topic-tree [data-chapter="'+n+'"]');
    selectChapter(14);selectChapter(26);
    await wait(()=>Math.abs(el('#sec-26 .sec-h').getBoundingClientRect().top-el('header.nav').getBoundingClientRect().bottom)<30,'Jump missed chapter heading');
    assert(el('#sec-8')===first && el('#e-14-1')===sameCard && visibleChapters().join()==='8,9,11,14,26','Chapter anchors scroll in the existing theme');
    win().history.back();await wait(()=>el('#topic-tree [data-chapter="14"][aria-current]') && win().location.hash==='#sec-14','Back did not restore chapter');
    await wait(()=>el('#e-14-1 .entry-ref a'),'Sources did not render');
    assert(!sameCard.querySelector('details') && sameCard.querySelector('.cost').textContent && sameCard.querySelector('.gain').textContent && sameCard.querySelector('.entry-ref').textContent.includes('证据 A 级'),'Cost and gain shown; evidence and sources grouped');
    assert(win().getComputedStyle(sameCard.querySelector('.entry-ref')).fontSize!==win().getComputedStyle(sameCard.querySelector('.gain')).fontSize,'Reference uses secondary type');
    frame.style.width='320px';await wait(()=>el('#index-toggle').offsetWidth,'Mobile index missing');
    click('#index-toggle');assert(el('.reader-column').inert,'Open mobile index keeps keyboard focus out of the covered text');selectChapter(26);
    assert(!el('#catalog').classList.contains('index-open') && noOverflow(),'Mobile chapter navigation closes the index and fits');
    await wait(()=>Math.abs(el('#sec-26 .sec-h').getBoundingClientRect().top-el('.index-mobile').getBoundingClientRect().bottom)<30,'Mobile chapter heading obscured');
    click('#index-toggle');type('#q','二次验证');await wait(()=>el('#index-results [data-item]'),'Reader search returned no entries');
    click('#index-results [data-item="e-14-1"]');assert(!el('#sec-8').hidden && el('#e-14-1')===sameCard,'Index search locates an entry without losing its theme');
    await open('/index.html','#topics .topic-tile');
    click('[data-view="chapters"]');assert(doc().querySelectorAll('#chapters .index-row').length===34,'All 34 chapters available');
    click('[data-view="essays"]');click('#essays .index-row');await wait(()=>el('#dm-doc h2'),'Essay failed to load');click('#dm-x');
    click('#open-portal');assert(!el('#portal-mask').hidden,'Quick reference opens');click('#pm-x');
    type('#q','EPF');await wait(()=>Number(el('#cnt').textContent)>0 && !el('#reader-head').hidden,'Search failed');
    assert(Number(el('#cnt').textContent)<Number(el('#tot').textContent),'Search filters entries');
    type('#q','xyzzynotfound');await wait(()=>!el('#empty').hidden,'Missing empty state');click('#reset2');
    click('#menu');click('[data-dim="scope"] [data-v="my"]');click('#view-matches');
    assert(!el('#sidebar').open && Number(el('#cnt').textContent)>0 && win().location.search.includes('scope=my'),'Filter drawer applies selection');
    await open('/index.html?sec=5','#e-5-23');
    el('#e-5-23').scrollIntoView({block:'center'});
    await wait(()=>el('#e-5-23 .human').textContent.trim(),'Review entry did not hydrate');
    assert(!el('#e-5-23').hidden && el('#e-5-23 .human').textContent.trim().length>5 && !el('#e-5-23').textContent.includes('含待核实'),'Consumer entry renders reviewed advice without a stale badge');
    await open('/index.html?sec=26','#e-26-5');
    el('#e-26-5').scrollIntoView({block:'center'});
    await wait(()=>el('#e-26-5 .human').textContent.trim().length>5,'Marketplace records did not hydrate');
    assert(el('#e-26-5 .entry-ref a'),'Marketplace entry renders its sources');
    await open('/index.html?sec=10','#e-10-13');
    el('#e-10-13').scrollIntoView({block:'center'});
    await wait(()=>el('#e-10-13 .human').textContent.trim().length>5,'Marriage routes did not hydrate');
    assert(el('#e-10-13 .entry-ref a'),'Marriage entry renders its sources');
    await open('/index.html?sec=27','#e-27-15');
    el('#e-27-15').scrollIntoView({block:'center'});
    await wait(()=>el('#e-27-15 .human').textContent.trim().length>5,'Birth deadlines did not hydrate');
    assert(el('#e-27-15 .entry-ref a'),'Birth entry renders its sources');
    await open('/index.html?sec=5','#e-5-1');await wait(()=>el('#e-5-1 .human').textContent.trim(),'Reader did not hydrate');
    click('#e-5-1 .act-save');click('#e-5-1 .act-note');type('#e-5-1 textarea','reading test');click('#e-5-1 .act-todo');
    await open('/index.html?my=saved','#e-5-1');await wait(()=>Number(el('#cnt').textContent)===1,'Saved filter failed');
    assert(el('#e-5-1 .note-view').textContent.includes('reading test'),'Notes and saved state persist');
    await open('/index.html?sec=14#e-14-1','#e-14-1');click('#e-14-1 .act-skip');
    await open('/index.html#e-14-1','#e-14-1');await wait(()=>!el('#e-14-1').hidden,'Hidden deep link failed');click('#e-14-1 .act-skip');
    assert(!JSON.parse(localStorage.getItem('htlb-my-tracker-v1')).status['14-1'],'Hidden entry can be recovered from its permalink');
    await open('/selfcheck.html','#profile-age');
    for(const w of [1440,1024,820,768,390,320]) {frame.style.width=w+'px';await new Promise(r=>requestAnimationFrame(r));assert(noOverflow(),'Self-check fits '+w+'px');}
    click('#go');assert(el('#form-error').textContent.includes('年龄'),'Profile validates missing age');
    type('#profile-age','35');click('[data-k="p:sex"][data-v="f"]');click('[data-k="p:kid"][data-v="n"]');
    for(const node of doc().querySelectorAll('[data-mod]'))node.click();click('#go');assert(el('#form-error').textContent.includes('主题'),'At least one topic required');
    click('[data-mod="账号与防骗"]');click('#go');await wait(()=>el('#topic-qs .seg'),'Questions not visible');
    const answers=doc().querySelectorAll('#topic-qs .seg');
    answers[0].querySelector('[data-v="y"]').click();answers[1].querySelector('[data-v="n"]').click();answers[2].querySelector('[data-v="s"]').click();
    await open('/selfcheck.html','#topic-qs .seg');assert(doc().querySelectorAll('#topic-qs .seg [aria-pressed=true]').length===3,'Reload restores step and answers');
    click('#prev');click('#go');click('#go');assert(!el('#out').hidden && el('#verdict').textContent.includes('你答了 2 题'),'Skipped answers excluded from report');
    click('#sync-tracker');const my=JSON.parse(localStorage.getItem('htlb-my-tracker-v1'));
    assert(my.status['14-1']==='done' && my.status['14-2']==='todo' && my.status['5-1']==='todo' && my.notes['5-1']==='reading test','Sync merges answers without losing existing records');
    click('#sync-tracker');assert(el('#copy-status').textContent.includes('新增 0'),'Repeat sync adds nothing');
    const href=el('#done a').href;await open(href,'#e-14-1');await wait(()=>el('#e-14-1 .human').textContent.trim(),'Deep link not hydrated');
    assert(!el('#sec-14').hidden && !el('#reader-head').hidden,'Result deep link opens the correct chapter');
    const broken=[...doc().querySelectorAll('link[rel=stylesheet]')].filter(l=>!l.sheet);assert(!broken.length,'Local styles resolve');
    await fetch('/__result',{method:'POST',body:JSON.stringify({log})});
  }catch(e){await fetch('/__result',{method:'POST',body:JSON.stringify({log,error:String(e.stack||e)})});}
}

const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg','.json':'application/json','.md':'text/plain'};
const profile=await mkdtemp(path.join(tmpdir(),'guide-flow-'));
let resolve, reject;const result=new Promise((yes,no)=>{resolve=yes;reject=no;});
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/__result' && req.method==='POST'){let body='';for await(const part of req)body+=part;res.end('OK');resolve(JSON.parse(body));return;}
  if(url.pathname==='/__test'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<!doctype html><iframe title="site" style="width:1440px;height:900px"></iframe><script>('+exercise.toString()+')()</script>');return;}
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root)){res.writeHead(403);res.end();return;}
  try{const data=await readFile(file);res.writeHead(200,{'Content-Type':(mime[path.extname(file)]||'text/plain')+'; charset=utf-8'});res.end(data);}catch{res.writeHead(404);res.end();}
});
server.listen(0,'127.0.0.1');await once(server,'listening');
const child=spawn(browser,['--headless=new','--no-first-run','--disable-background-networking','--disable-sync','--no-default-browser-check','--user-data-dir='+profile,'http://127.0.0.1:'+server.address().port+'/__test'],{stdio:'ignore'});
child.on('error',reject);child.once('exit',code=>reject(new Error('Browser exited before results: '+code)));
const timeout=setTimeout(()=>reject(new Error('UI test timed out')),85000);
try { const r=await result; for(const msg of r.log)console.log('✓ '+msg); assert.ok(!r.error,r.error); }
finally {clearTimeout(timeout);const stopped=child.exitCode===null?once(child,'exit'):Promise.resolve();child.kill();await stopped;server.closeAllConnections();server.close();await rm(profile,{recursive:true,force:true,maxRetries:4,retryDelay:100});}
