"use strict";
/* =========================================================
   18. 使いやすさ・振り返り・復習の追加
   ① 画面を消さない／？（あとで確認）／記録の確認表示／記録係の担当
   ② 失点の原因／試合後の3項目／試合ごとの推移
   ③ 選手カード／動画の場面へジャンプ／今日のベストプレー
   ========================================================= */

/* ================= ① 試合中 ================= */

/* ---------- 画面を消さない：記録中の試合がある間はずっと ----------
   Wake Lock が使えない・失敗する iPad では、音なしの短い動画を繰り返し再生して消灯を防ぐ */
let awakeVideo = null;
const wantAwake = () => liveNow();
function awakeVideoOn(on){
  try{
    if(on){
      if(!awakeVideo){ awakeVideo = document.createElement('video');
        Object.assign(awakeVideo, { muted:true, loop:true, playsInline:true }); awakeVideo.setAttribute('playsinline', ''); awakeVideo.setAttribute('muted', '');
        awakeVideo.src = 'media/awake.mp4'; awakeVideo.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:0;top:0';
        document.body.appendChild(awakeVideo); }
      if(awakeVideo.paused) awakeVideo.play().catch(() => {});
    } else if(awakeVideo && !awakeVideo.paused) awakeVideo.pause();
  }catch(e){}
}
async function syncAwake(){
  if(wantAwake()){
    if(!wakeLock){ try{ if(navigator.wakeLock){ wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => wakeLock = null); } }catch(e){ wakeLock = null; } }
    awakeVideoOn(!wakeLock);
  } else {
    if(wakeLock){ try{ await wakeLock.release(); }catch(e){} wakeLock = null; }
    awakeVideoOn(false);
  }
}
// 動画の再生は「画面に触れた瞬間」でないと始められないので、タッチのたびに確認する
document.addEventListener('pointerdown', () => { if(wantAwake() && !wakeLock) syncAwake(); }, true);
document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible') syncAwake(); });

/* ---------- 記録した直後の確認表示（大きく・取り消しボタン付き） ---------- */
function recFlash(e, msg){
  const m = match(e.matchId), t = $('#toast');
  let big = '', sub = msg;
  if(e.type === 'shot') big = `${e.pk ? 'PK' : 'シュート'} ${RES[e.result]?.label || ''}`;
  else if(e.type === 'ck') big = e.side === 'L' ? '左CK' : e.side === 'R' ? '右CK' : 'CK';
  else if(e.type === 'fk') big = `FK ${lbl(FK_PLAYS2, fkPlay2(e))}`;
  else if(e.type === 'og') big = 'オウンゴール';
  else if(e.type === 'win') big = 'ボール奪取';
  else if(e.type === 'mark') big = '★ 動画メモ';
  else if(e.type === 'sub') big = '交代';
  if(!big){ toast(msg, e.id); return; }
  const who = e.num ? `#${e.num} ${family(e.name)}` : e.oppNum ? `#${e.oppNum}` : '';
  t.innerHTML = `<span class="rf-team ${e.team}">${esc(teamName(m, e.team))}</span><b class="rf-big">${esc(big)}</b>${who ? `<b class="rf-who">${esc(who)}</b>` : ''}
    <span class="rf-sub">${esc(sub)}</span><button type="button" class="tundo big" data-undoid="${e.id}">↩︎ 取り消す</button>`;
  placeBig(t);
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; t.className = 'toast'; t.style.cssText = ''; }, 4500);
}
// 試合記録の画面では、右の列の上（空いているところ）に出す。下の盤（選手をタップする場所）を隠さない
function placeBig(t){
  const col = state.ui.screen === 'record' && document.querySelector('#evCol');
  t.className = 'toast big' + (col ? ' side' : ''); t.hidden = false; t.style.cssText = '';
  if(col){ const r = col.getBoundingClientRect(); Object.assign(t.style, { left:(r.left + 6) + 'px', top:(r.top + 6) + 'px', width:(r.width - 12) + 'px', bottom:'auto', transform:'none' }); }
}
// 選手を付けたあと：背番号を大きく。間違えたら「選手を外す」
function pickFlash(e){
  const m = match(e.matchId), t = $('#toast'), who = e.num ? `#${e.num} ${family(e.name)}` : e.oppNum ? `${teamName(m, 'them')} #${e.oppNum}` : '';
  if(!who){ toast('選手を記録しました'); return; }
  t.innerHTML = `<span class="rf-team ${e.team === 'us' || e.type === 'og' && e.team === 'them' ? 'us' : 'them'}">選手</span><b class="rf-who xl">${esc(who)}</b>
    <span class="rf-sub">${esc(evText(e, m))}</span><button type="button" class="tundo big" data-unpick="${e.id}">選手を外す</button>`;
  placeBig(t);
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; t.className = 'toast'; t.style.cssText = ''; }, 4000);
}
// 通常の toast に戻すときは大きい表示の形を外す
const _toast0 = toast;
toast = function(msg, undoId){ const t = $('#toast'); t.className = 'toast'; t.style.cssText = ''; _toast0(msg, undoId); };

/* ---------- ？（あとで確認） ---------- */
const flagText = e => e.check ? '？ ' : '';
function toggleCheck(id, on){
  const e = state.events.find(x => x.id === id); if(!e) return;
  e.check = on ?? !e.check; e.synced = false; save.events();
  toast(e.check ? '？ 要確認にしました。試合後の「入力漏れチェック」に出ます' : '？ を外しました');
}

/* ---------- 記録係の担当（1台を2人で使うときに、画面を役割に合わせて絞る） ---------- */
const ROLES = [
  { id:'all',   label:'全部',       sub:'ひとりで全部記録する' },
  { id:'shot',  label:'シュート係', sub:'ピッチ・CK・PK・OGだけ。交代やHTのボタンを隠す' },
  { id:'bench', label:'交代・時間係', sub:'大きな盤で交代・カード。時計と★・飲水も' },
];
const ROLE = () => state.meta?.settings?.role || 'all';
function roleSegHTML(){
  return `<div class="setrow lvrow"><span><b>記録係の担当</b><small>1台を2人で分担するときは、交代するたびに切り替えます</small></span>
    <div class="lvseg" role="group" aria-label="記録係の担当">${ROLES.map(r => `<button type="button" data-setrole="${r.id}" aria-pressed="${ROLE() === r.id}"><b>${r.label}</b><small>${r.sub}</small></button>`).join('')}</div></div>`;
}
$('#sheet').addEventListener('click', e => {
  const b = e.target.closest('[data-setrole]'); if(!b) return;
  state.meta.settings.role = b.dataset.setrole; save.meta();
  document.querySelectorAll('[data-setrole]').forEach(x => x.setAttribute('aria-pressed', x.dataset.setrole === b.dataset.setrole));
  toast(`記録係の担当：${ROLES.find(r => r.id === b.dataset.setrole).label}`); render();
});
// 交代・時間係のボタン（シュート係のボタンの代わり）
const benchGridHTML = () => `<div class="evgrid2">
    <button type="button" class="ev2" data-members><span class="en">SUB</span><span class="jp">交代</span></button>
    <button type="button" class="ev2 mark" data-mark><span class="en">★</span><span class="jp">動画メモ</span></button>
    <button type="button" class="ev2" data-brkopen><span class="en">💧</span><span class="jp">飲水・クーリング</span></button>
    <button type="button" class="ev2" data-halftime><span class="en">HT</span><span class="jp">ハーフタイム</span></button>
  </div>`;

/* ================= ② 反省・練習に活かす ================= */

/* ---------- 失点の原因（複数選べる） ---------- */
const CAUSES = [
  { id:'sp',      label:'セットプレーの守備' }, { id:'counter', label:'切り替えが遅れた' },
  { id:'lost',    label:'自陣でのミス・ロスト' }, { id:'behind', label:'裏へのボール' },
  { id:'wide',    label:'サイドを崩された' },   { id:'free',   label:'マークがずれた・フリー' },
  { id:'second',  label:'こぼれ球への反応' },   { id:'duel',   label:'1対1で負けた' },
];
const isConceded = e => isGoalEv(e) && e.team === 'them';
function causeChipsHTML(e, attr = 'data-cause'){
  const on = new Set(e.causes || []);
  return `<div class="chips causes">${CAUSES.map(c => `<button type="button" ${attr}="${e.id}:${c.id}" aria-pressed="${on.has(c.id)}">${c.label}</button>`).join('')}</div>`;
}
function toggleCause(id, c){
  const e = state.events.find(x => x.id === id); if(!e) return;
  const s = new Set(e.causes || []); s.has(c) ? s.delete(c) : s.add(c);
  e.causes = [...s]; e.synced = false; save.events();
}
function askCause(e){
  state.ui.cause = { id:e.id, until:Date.now() + 25000 };
  clearTimeout(askCause.t); askCause.t = setTimeout(() => { if(state.ui.cause?.id === e.id){ state.ui.cause = null; if(state.ui.screen === 'record') render(); } }, 25000);
}
function causeTickerHTML(){
  const c = state.ui.cause, e = c && Date.now() < c.until ? state.events.find(x => x.id === c.id && !x.deleted) : null;
  if(!e){ return ''; }
  return `<span class="section-title">失点の原因は？<small class="muted">（複数OK）</small></span>${causeChipsHTML(e)}<span style="flex:1"></span><button class="btn small" data-causeok type="button">OK</button>`;
}
function causeCount(ev){
  const g = ev.filter(isConceded), cnt = {};
  g.forEach(e => (e.causes || []).forEach(c => cnt[c] = (cnt[c] || 0) + 1));
  return { total:g.length, tagged:g.filter(e => (e.causes || []).length).length, rows:CAUSES.map(c => ({ ...c, n:cnt[c.id] || 0 })).filter(r => r.n).sort((a, b) => b.n - a.n) };
}
function causePanelHTML(ev){
  const c = causeCount(ev); if(!c.total) return '';
  const max = Math.max(1, ...c.rows.map(r => r.n));
  return `<section class="card panel">
    <div class="hd"><h3>🧯 失点の原因</h3><span class="muted" style="font-size:12px">失点 ${c.total}・原因を入力 ${c.tagged}。1つの失点に複数つけられます</span></div>
    ${c.rows.length ? `<div class="hbars">${c.rows.map(r => `<div class="hb"><span>${r.label}</span><i style="width:${r.n / max * 100}%"></i><b class="num">${r.n}</b></div>`).join('')}</div>`
      : '<div class="muted" style="font-size:13px">まだ原因が入力されていません。失点の「状況」から選べます。</div>'}
  </section>`;
}

/* ---------- 試合後の3項目と、チームの原則 ---------- */
const DEFAULT_PRINCIPLES = ['奪ったら3秒で前へ', '幅と深さをとる', '3人目の動き', 'サイドで数的優位', '切り替え5秒でプレス', '中を閉めて外へ',
  'ラインを押し上げる', 'セカンドボールを拾う', 'セットプレーは声とマーク確認', '声でつながる'];
const principles = () => team().principles?.length ? team().principles : DEFAULT_PRINCIPLES;
const REVIEW_KEYS = [
  { id:'good',  label:'良かったこと',        ph:'例：奪ってからのカウンターでチャンスを作れた' },
  { id:'issue', label:'課題',                ph:'例：CKの守備でマークが外れた' },
  { id:'next',  label:'次の練習でやること',  ph:'例：CK守備のマークの確認・切り替えの5秒' },
];
function dataHints(m){
  const ev = evOf(m.id), out = [], cc = causeCount(ev);
  if(cc.rows[0]) out.push(`失点の原因でいちばん多いのは「${cc.rows[0].label}」（${cc.rows[0].n}回）`);
  const us = ev.filter(e => e.type === 'shot' && e.team === 'us' && !e.pk), inPa = us.filter(e => e.area === 'PA' || e.area === 'GA').length;
  if(us.length >= 3) out.push(`シュート${us.length}本のうちPA内は${inPa}本（${Math.round(inPa / us.length * 100)}%）`);
  const wins = ev.filter(e => e.type === 'win' && e.team === 'us');
  if(wins.length >= 3) out.push(`奪って10秒以内のシュート：${wins.filter(w => winToShot(ev, w)).length} / ${wins.length}回`);
  const tb = timeBuckets([m]).filter(b => b.them.g);
  if(tb.length) out.push(`失点した時間帯：${tb.map(b => `${b.label} ${b.at ? 'AT' : `${b.from}-${b.to}分`}`).join('、')}`);
  const cks = ev.filter(e => e.type === 'ck' && e.team === 'us');
  if(cks.length >= 3) out.push(`自チームのCK ${cks.length}本 → シュートまで ${cks.filter(c => ev.some(x => x.type === 'shot' && x.team === 'us' && x.period === c.period && x.sec >= c.sec && x.sec - c.sec <= 15)).length}本`);
  return out;
}
function reviewPanelHTML(m){
  const r = m.review || {}, tags = new Set(r.tags || []), hints = dataHints(m);
  return `<section class="card panel review">
    <div class="hd"><h3>📝 今日のふり返り（チーム）</h3><span class="muted" style="font-size:12px">短くてOK。書いた内容はレポートとホーム画面に出ます</span></div>
    ${hints.length ? `<div class="hints"><b>この試合のデータから</b>${hints.map(h => `<span>・${esc(h)}</span>`).join('')}</div>` : ''}
    <div class="rv3 scribwrap">${REVIEW_KEYS.map(k => `<label class="rvbox rv-${k.id}"><span>${k.label}</span><textarea class="scrib" data-review="${k.id}" rows="3" placeholder="${k.ph}">${esc(r[k.id] || '')}</textarea></label>`).join('')}</div>
    <div class="q">次の練習で意識する原則 <span class="muted">（タップで選ぶ・チームの戦術ブックと同じ言葉に）</span>
      <button class="btn small" data-editprin type="button" style="margin-left:8px">原則を編集</button></div>
    <div class="chips">${principles().map(p => `<button type="button" data-rvtag="${esc(p)}" aria-pressed="${tags.has(p)}">${esc(p)}</button>`).join('')}</div>
  </section>`;
}
let rvTimer;
document.addEventListener('input', e => {
  const k = e.target.dataset?.review; if(!k) return;
  const m = match(state.ui.postMatch); if(!m) return;
  m.review = { ...(m.review || {}), [k]:e.target.value };
  clearTimeout(rvTimer); rvTimer = setTimeout(() => { m.dirty = true; save.matches(); }, 400);
});
function principleSheet(){
  state.ui.flow = { kind:'principles' };
  openSheet(`<h2>🧭 チームの原則</h2>
    <p style="font-size:13px">1行に1つ。戦術ブックに書いた言葉と同じにしておくと、練習・試合・ふり返りがつながります。</p>
    <textarea id="prinText" class="scrib" rows="10" style="width:100%;border-radius:12px;padding:10px;background:var(--surface-2);color:var(--ink);border:1px solid var(--line);font-size:15px">${esc(principles().join('\n'))}</textarea>
    <div class="row"><button class="btn" data-prinreset type="button">見本に戻す</button><span style="flex:1"></span><button class="btn" data-close type="button">キャンセル</button><button class="btn primary" data-prinsave type="button">保存</button></div>`, 'wide');
}
// ホーム：前の試合から「次の練習でやること」
function lastReviewHTML(){
  const m = teamMatches().filter(x => x.endedAt && (x.review?.next || x.review?.tags?.length || x.best?.id)).sort((a, b) => b.endedAt.localeCompare(a.endedAt))[0];
  if(!m) return '';
  const r = m.review || {}, be = m.best?.id ? state.events.find(e => e.id === m.best.id && !e.deleted) : null;
  return `<section class="card nextprac">
    <div class="section-title">前の試合から（${esc(dateJP(m.date))} vs ${esc(m.opponent)}）</div>
    ${r.next ? `<div class="np-next"><b>次の練習でやること</b><p>${esc(r.next)}</p></div>` : ''}
    ${r.tags?.length ? `<div class="chips">${r.tags.map(t => `<span class="ptag">${esc(t)}</span>`).join('')}</div>` : ''}
    ${be ? `<div class="np-best">🏆 ベストプレー：${esc(sceneLabel(be, m))}${m.best.note ? `「${esc(m.best.note)}」` : ''} ${playBtn(be, m)}</div>` : ''}
    <button class="btn small" data-openpost="${m.id}" type="button">ふり返りを開く</button>
  </section>`;
}

/* ---------- 試合ごとの推移（複数試合のとき） ---------- */
function trendPanelHTML(ms){
  const list = ms.slice().sort((a, b) => (a.date + (a.createdAt || '')).localeCompare(b.date + (b.createdAt || '')));
  if(list.length < 2) return '';
  const rows = list.map(m => { const ev = evOf(m.id), sh = t => ev.filter(e => e.type === 'shot' && e.team === t);
    const us = sh('us').filter(e => !e.pk), pa = us.filter(e => e.area === 'PA' || e.area === 'GA').length, cc = causeCount(ev);
    return { m, gu:goalsOf(ev, 'us'), gt:goalsOf(ev, 'them'), su:sh('us').length, st:sh('them').length, pa:us.length ? Math.round(pa / us.length * 100) : null, cause:cc.rows[0]?.label || '' }; });
  return `<section class="card panel">
    <div class="hd"><h3>📈 試合ごとの推移</h3><span class="muted" style="font-size:12px">古い試合 → 新しい試合。点にふれると数字が出ます</span></div>
    <div class="trend2">
      ${lineChartHTML('得点と失点', rows, [{ k:'gu', name:'得点', cls:'us' }, { k:'gt', name:'失点', cls:'them' }])}
      ${lineChartHTML('シュート数', rows, [{ k:'su', name:'自チーム', cls:'us' }, { k:'st', name:'相手', cls:'them' }])}
    </div>
    <div class="tbl-wrap"><table class="pstat"><thead><tr><th>日付</th><th>相手</th><th>結果</th><th>シュート</th><th>PA内の割合</th><th>多かった失点の原因</th></tr></thead>
      <tbody>${rows.slice().reverse().map(r => `<tr><td>${esc(r.m.date.slice(5).replace('-', '/'))}</td><td>vs ${esc(r.m.opponent)}</td><td><span class="num">${r.gu}-${r.gt}</span> ${resultChip(r.m)}</td>
        <td><span class="num">${r.su} - ${r.st}</span></td><td>${r.pa == null ? '—' : `<span class="num">${r.pa}</span>%`}</td><td>${esc(r.cause) || '<span class="muted">—</span>'}</td></tr>`).join('')}</tbody></table></div>
  </section>`;
}
function lineChartHTML(title, rows, series){
  const W = 440, H = 176, L = 30, R = 78, T = 16, B = 34, n = rows.length;
  const max = Math.max(1, ...rows.flatMap(r => series.map(s => r[s.k])));
  const step = max > 8 ? 5 : 1, top = Math.ceil(max / step) * step;
  const x = i => L + (n === 1 ? (W - L - R) / 2 : i * (W - L - R) / (n - 1)), y = v => T + (H - T - B) * (1 - v / top);
  const ticks = [...new Set([0, Math.round(top / 2), top])];
  // 同じ日に複数試合あるときは相手名の頭2文字を添える
  const dup = d => rows.filter(r => r.m.date === d).length > 1;
  const lab = r => `${r.m.date.slice(5).replace('-', '/')}${dup(r.m.date) ? ' ' + r.m.opponent.slice(0, 2) : ''}`;
  const every = Math.ceil(n / 7);
  // 最後の点の横に名前（近すぎるときは上下にずらす）
  const ends = series.map(s => ({ s, v:rows[n - 1][s.k], yy:y(rows[n - 1][s.k]) })).sort((a, b) => a.yy - b.yy);
  for(let i = 1; i < ends.length; i++) if(ends[i].yy - ends[i - 1].yy < 14) ends[i].yy = ends[i - 1].yy + 14;
  return `<figure class="lc"><figcaption>${title}</figcaption>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}の推移">
      ${ticks.map(t => `<line x1="${L}" x2="${W - R + 6}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${L - 6}" y="${y(t) + 4}" text-anchor="end" class="ax">${t}</text>`).join('')}
      ${rows.map((r, i) => i % every === 0 || i === n - 1 ? `<text x="${x(i)}" y="${H - 12}" text-anchor="middle" class="ax">${esc(lab(r))}</text>` : '').join('')}
      ${series.map(s => `<polyline class="ln ${s.cls}" points="${rows.map((r, i) => `${x(i)},${y(r[s.k])}`).join(' ')}"/>
        ${rows.map((r, i) => `<circle class="pt ${s.cls}" cx="${x(i)}" cy="${y(r[s.k])}" r="4.5"><title>${esc(lab(r))} vs ${esc(r.m.opponent)}：${s.name} ${r[s.k]}</title></circle>`).join('')}`).join('')}
      ${ends.map(e => `<text x="${x(n - 1) + 9}" y="${e.yy + 4}" class="dl">${e.s.name} ${e.v}</text>`).join('')}
    </svg>
    <div class="tblegend">${series.map(s => `<span><i class="${s.cls}"></i>${s.name}</span>`).join('')}</div></figure>`;
}

/* ================= ③ 復習したくなる ================= */

/* ---------- 試合動画（YouTube）の時刻へジャンプ ---------- */
function ytId(url){
  const u = String(url || '').trim(); if(!u) return null;
  const m = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|live\/|shorts\/|embed\/))([\w-]{11})/); return m ? m[1] : null;
}
// その場面の動画URL（少し前から再生）
function sceneUrl(e, m){
  const v = m.video || {}; if(!e.wall) return null;
  const per = v.per?.[e.period], url = per || v.url; if(!url) return null;
  let base;
  if(per) base = evOf(m.id).find(x => x.type === 'kickoff' && x.period === e.period)?.wall;
  else base = m.videoStart || evOf(m.id).find(x => x.type === 'kickoff' && x.wall)?.wall;
  if(!base) return null;
  const sec = Math.max(0, Math.round((e.wall - base) / 1000) - (v.lead ?? 8)), id = ytId(url);
  return id ? `https://www.youtube.com/watch?v=${id}&t=${sec}s` : url;
}
const playBtn = (e, m) => { const u = sceneUrl(e, m); return u ? `<a class="playbtn" href="${esc(u)}" target="_blank" rel="noopener">▶ 動画</a>` : ''; };
function sceneLabel(e, m){
  const t = `${pShort(m, e.period)} ${e.clock}`;
  if(e.type === 'mark'){ const p = player(e.playerId); return `${t} ★${e.tag ? lbl(MARK_TAGS, e.tag).replace(/^\S+\s/, '') : ''}${p ? ` #${p.num} ${family(p.name)}` : ''}${e.note ? `「${e.note}」` : ''}`; }
  if(isGoalEv(e)) return `${t} ⚽ ${e.team === 'us' ? '得点' : '失点'}${e.num ? ` #${e.num} ${family(e.name)}` : ''}`;
  if(e.type === 'shot') return `${t} シュート（${RES[e.result]?.label}）${e.num ? ` #${e.num} ${family(e.name)}` : ''}`;
  return `${t} ${evText(e, m)}`;
}
function videoPanelHTML(m){
  const v = m.video || {}, perOn = !!v.split;
  const regs = m.periods.map((p, i) => ({ p, i })).filter(x => x.p.kind !== 'pk');
  const ok = v.url ? !!ytId(v.url) : true;
  return `<section class="card panel">
    <div class="hd"><h3>🎬 試合動画</h3><span class="muted" style="font-size:12px">YouTubeにアップしたURLを貼ると、★や得点の場面へ「▶ 動画」で飛べます（限定公開でOK）</span></div>
    <div class="vidrow"><label class="field" style="flex:1">試合全体の動画のURL<input data-vid="url" value="${esc(v.url || '')}" placeholder="https://youtu.be/…" autocomplete="off" inputmode="url"></label>
      <label class="checkrow"><input type="checkbox" data-vidsplit ${perOn ? 'checked' : ''}>ピリオドごとに分かれている</label></div>
    ${perOn ? `<div class="vidper">${regs.map(({ p, i }) => `<label class="field">${esc(p.label)}<input data-vid="per:${i}" value="${esc(v.per?.[i] || '')}" placeholder="https://youtu.be/…" autocomplete="off" inputmode="url"></label>`).join('')}</div>` : ''}
    ${!ok ? '<div class="note-banner">YouTubeのURLではないようです。YouTube以外の動画は時刻へ飛べません（開くだけになります）</div>' : ''}
    <p class="muted" style="font-size:12px;margin:0">${m.videoStart ? '「🎥 撮影開始」を押した時刻を動画の0:00にしています。' : '「🎥 撮影開始」が記録されていないので、最初のキックオフを動画の0:00として計算します（ピリオドごとの動画は、そのキックオフが0:00）。'}場面の8秒前から再生します。</p>
  </section>`;
}
let vidTimer;
document.addEventListener('input', e => {
  const k = e.target.dataset?.vid; if(!k) return;
  const m = match(state.ui.postMatch); if(!m) return;
  m.video ||= {};
  if(k === 'url') m.video.url = e.target.value.trim(); else { m.video.per ||= {}; m.video.per[k.split(':')[1]] = e.target.value.trim(); }
  clearTimeout(vidTimer); vidTimer = setTimeout(() => { m.dirty = true; save.matches(); }, 400);
});
document.addEventListener('change', e => {
  const k = e.target.dataset?.vid;
  if(k){ const m = match(state.ui.postMatch); if(m) save.matches(); return; }   // ここで描き直すと、入力欄から離れた瞬間の描き直しと重なるので保存だけ
  if(!('vidsplit' in (e.target.dataset || {}))) return;
  const m = match(state.ui.postMatch); if(!m) return; m.video ||= {}; m.video.split = e.target.checked; m.dirty = true; save.matches(); render();
});

/* ---------- 今日のベストプレー ---------- */
const bestCands = m => evOf(m.id).filter(e => e.type === 'mark' || (isGoalEv(e) && e.team === 'us') || (e.type === 'shot' && e.team === 'us' && e.result === 'on'));
function bestPanelHTML(m){
  const c = bestCands(m), b = m.best || {}, sel = b.id ? state.events.find(e => e.id === b.id && !e.deleted) : null;
  return `<section class="card panel best">
    <div class="hd"><h3>🏆 今日のベストプレー</h3><span class="muted" style="font-size:12px">★・得点・枠内シュートから1つ選んで、チームで共有します</span></div>
    ${sel ? `<div class="bestsel"><b>${esc(sceneLabel(sel, m))}</b>${playBtn(sel, m)}
      <label class="field" style="flex:1 1 100%">ひとこと<input data-bestnote value="${esc(b.note || '')}" placeholder="例：3人目の動きで崩した！" autocomplete="off"></label></div>` : ''}
    ${c.length ? `<div class="bestlist">${c.map(e => `<button type="button" class="${sel?.id === e.id ? 'on' : ''}" data-best="${e.id}">${esc(sceneLabel(e, m))}</button>`).join('')}</div>`
      : '<div class="muted" style="font-size:13px">この試合には★マーク・得点がありません。試合中に★を押しておくと、ここから選べます。</div>'}
  </section>`;
}
document.addEventListener('input', e => {
  if(!('bestnote' in (e.target.dataset || {}))) return;
  const m = match(state.ui.postMatch); if(!m) return;
  m.best = { ...(m.best || {}), note:e.target.value }; m.dirty = true;
  clearTimeout(rvTimer); rvTimer = setTimeout(() => save.matches(), 400);
});

/* ---------- 選手カード ---------- */
function playerStats(ms, pid){
  const s = { sec:0, games:0, starts:0, shots:0, onT:0, goals:0, ast:0, marks:0, best:0, scenes:[] };
  ms.forEach(m => { const ev = evOf(m.id), sec = playSeconds(m, m.periods.map((_, i) => i))[pid] || 0;
    if(sec > 0){ s.sec += sec; s.games++; if(ev.filter(e => e.type === 'kickoff').sort((a, b) => a.period - b.period)[0]?.lineup?.includes(pid)) s.starts++; }
    ev.forEach(e => {
      if(e.type === 'shot' && e.team === 'us' && e.playerId === pid){ s.shots++; if(e.result === 'goal' || e.result === 'on') s.onT++; if(e.result === 'goal') s.goals++;
        if(e.result !== 'block' && e.result !== 'off') s.scenes.push({ e, m }); }
      if(e.type === 'shot' && e.team === 'us' && e.goal?.assistId === pid){ s.ast++; s.scenes.push({ e, m, a:true }); }
      if(e.type === 'mark' && e.playerId === pid){ s.marks++; s.scenes.push({ e, m }); }
    });
    if(m.best?.id){ const be = ev.find(e => e.id === m.best.id); if(be && (be.playerId === pid || be.goal?.assistId === pid)) s.best++; }
  });
  s.scenes.sort((a, b) => a.m.date.localeCompare(b.m.date) || a.e.period - b.e.period || a.e.sec - b.e.sec);
  return s;
}
// 先発か途中出場か（その試合の最初のキックオフのメンバーと交代の記録から）
function playerRole(m, pid){
  const ev = evOf(m.id), ko = ev.filter(e => e.type === 'kickoff').sort((a, b) => a.period - b.period)[0];
  const sin = ev.find(e => e.type === 'sub' && e.team === 'us' && e.inId === pid), sout = ev.filter(e => e.type === 'sub' && e.team === 'us' && e.outId === pid).pop();
  const t = e => `${pShort(m, e.period)} ${clockMark(e.clock)}`;
  if(ko?.lineup?.includes(pid)) return { kind:'start', text:sout ? `先発 → ${t(sout)} 交代` : '先発' };
  if(sin) return { kind:'sub', text:`途中出場 ${t(sin)}〜${sout ? ` ${t(sout)} 交代` : ''}` };
  return { kind:'start', text:'出場' };
}
function playerCardHTML(p, s, m){
  const k = m ? kitOf(m) : team().kits[1];
  const role = m ? playerRole(m, p.id) : { kind:'sum', text:`${s.games}試合出場・先発${s.starts}` };
  const badges = [s.goals >= 3 && m ? 'HAT TRICK' : '', s.best ? `🏆 BEST PLAY${s.best > 1 ? ' ×' + s.best : ''}` : ''].filter(Boolean);
  const row = (l, v, sub, hi) => `<div class="pc-r ${hi ? 'hi' : ''}"><span>${l}</span><b class="num">${v}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
  return `<div class="pcard" style="--pa:${k.a};--pb:${k.b}">
    <div class="pc-head"><span class="pc-num num">${p.num}</span>
      <div class="pc-id"><div class="pc-name">${esc(p.name)}</div><div class="pc-meta"><span class="pc-pos">${posOf(p) || '—'}</span>${p.grade}年</div></div></div>
    <div class="pc-role ${role.kind}">${esc(role.text)}</div>
    ${badges.length ? `<div class="pc-badges">${badges.map(b => `<span>${b}</span>`).join('')}</div>` : ''}
    <div class="pc-big">
      <div><b class="num">${s.goals}</b><small>ゴール</small></div><div><b class="num">${s.ast}</b><small>アシスト</small></div><div><b class="num">${Math.round(s.sec / 60)}</b><small>出場(分)</small></div>
    </div>
    <div class="pc-rows">${row('シュート', s.shots, s.shots ? `枠内 ${s.onT}` : '')}${row('★ 動画の場面', s.marks, '')}</div>
    <div class="pc-foot">${m ? `${esc(dateJP(m.date))} vs ${esc(m.opponent)}` : 'この範囲の合計'}</div>
  </div>`;
}
function playerCardSheet(pid, ms, single){
  const p = player(pid); if(!p) return;
  const s = playerStats(ms, pid);
  openSheet(`<h2>🪪 選手カード</h2>
    <div class="pcwrap"><div id="pcardShot">${playerCardHTML(p, s, single)}</div>
      <div class="pcscenes"><div class="q">この選手の場面 ${s.scenes.length ? `<span class="muted">（▶ で動画のその時刻へ）</span>` : ''}</div>
        ${s.scenes.length ? s.scenes.map(({ e, m, a }) => `<div class="scn"><span>${ms.length > 1 ? `<small class="muted">${esc(m.date.slice(5).replace('-', '/'))} vs ${esc(m.opponent)}</small><br>` : ''}${esc(sceneLabel(e, m))}${a ? '（アシスト）' : ''}${m.best?.id === e.id ? ' 🏆' : ''}</span>${playBtn(e, m) || '<span class="muted" style="font-size:11px">動画URL未登録</span>'}</div>`).join('')
          : '<div class="muted" style="font-size:13px">まだ場面がありません。★マークで関わった選手を選ぶと、ここに出ます。</div>'}</div></div>
    <div class="row"><button class="btn" data-pcardpng type="button">⬇︎ 画像で保存</button><span style="flex:1"></span><button class="btn primary" data-close type="button">閉じる</button></div>`, 'wide');
}
function playerCardsHTML(m){
  const secs = playSeconds(m, m.periods.map((_, i) => i));
  // 出場した選手（途中出場で出場時間がほぼ0の選手も含める）
  const subIn = evOf(m.id).filter(e => e.type === 'sub' && e.team === 'us').map(e => e.inId);
  const ids = [...new Set([...Object.keys(secs).filter(id => secs[id] > 0), ...subIn])].filter(id => player(id))
    .sort((a, b) => (playerRole(m, a).kind === 'sub') - (playerRole(m, b).kind === 'sub') || player(a).num - player(b).num);
  if(!ids.length) return '';
  return `<section class="card panel">
    <div class="hd"><h3>🪪 選手カード</h3><span class="muted" style="font-size:12px">タップすると、その選手の場面と動画へのリンクが出ます</span></div>
    <div class="pcards">${ids.map(id => `<button type="button" class="pcbtn" data-pcardopen="${id}">${playerCardHTML(player(id), playerStats([m], id), m)}</button>`).join('')}</div>
  </section>`;
}
async function savePlayerCard(){
  const el = $('#pcardShot .pcard'); if(!el) return;
  try{ await loadScript(LIBS.h2c);
    const c = await html2canvas(el, { scale:3, backgroundColor:null, logging:false });
    c.toBlob(b => downloadBlob(b, `選手カード_${el.querySelector('.pc-name')?.firstChild?.textContent || ''}.png`.replace(/\s/g, '')), 'image/png');
  }catch(e){ toast('画像にできませんでした。インターネットにつないでから試してください'); }
}

/* ================= クリック ================= */
document.addEventListener('click', ev => {
  if(ev.target.closest('#sheet')) return;
  const b = ev.target.closest('button,a'); if(!b) return;
  const d = b.dataset;
  if(d.unpick){ const e = state.events.find(x => x.id === d.unpick);
    if(e){ Object.assign(e, { playerId:null, num:null, name:null, grade:null, oppNum:null }); e.synced = false; save.events(); state.ui.goalTag = null; beep('undo'); toast('選手を外しました'); render(); } return; }
  if('pickq' in d){ const pk = state.ui.pick; if(pk) toggleCheck(pk.eventId, true); state.ui.pick = null; render(); return; }
  if(d.flag){ toggleCheck(d.flag); render(); return; }
  if(d.cause){ const [id, c] = d.cause.split(':'); toggleCause(id, c); if(state.ui.cause) state.ui.cause.until = Date.now() + 25000; render(); return; }
  if('causeok' in d){ state.ui.cause = null; toast('失点の原因を記録しました'); render(); return; }
  if(d.rvtag){ const m = match(state.ui.postMatch); if(!m) return; m.review ||= {}; const s = new Set(m.review.tags || []);
    s.has(d.rvtag) ? s.delete(d.rvtag) : s.add(d.rvtag); m.review.tags = [...s]; m.dirty = true; save.matches(); b.setAttribute('aria-pressed', s.has(d.rvtag)); return; }
  if('editprin' in d){ principleSheet(); return; }
  if(d.best){ const m = match(state.ui.postMatch); if(!m) return; m.best = m.best?.id === d.best ? null : { id:d.best, note:m.best?.note || '' }; m.dirty = true; save.matches(); render(); return; }
  if(d.pcardopen){ const m = state.ui.screen === 'post' ? match(state.ui.postMatch) : null;
    if(m) playerCardSheet(d.pcardopen, [m], m); else { const ms = dataMatches(); playerCardSheet(d.pcardopen, ms, ms.length === 1 ? ms[0] : null); } return; }
  if(d.openpost){ state.ui.postMatch = d.openpost; state.ui.screen = 'post'; render(); $('#main').scrollTop = 0; return; }
});
$('#sheet').addEventListener('click', ev => {
  const b = ev.target.closest('button'); if(!b) return;
  const d = b.dataset;
  if(d.gcause){ const [id, c] = d.gcause.split(':'); toggleCause(id, c); b.setAttribute('aria-pressed', (state.events.find(x => x.id === id)?.causes || []).includes(c)); return; }
  if('pcardpng' in d){ savePlayerCard(); return; }
  if('prinsave' in d){ team().principles = $('#prinText').value.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 30); save.teams(); closeSheet(); toast('チームの原則を保存しました'); render(); return; }
  if('prinreset' in d){ $('#prinText').value = DEFAULT_PRINCIPLES.join('\n'); return; }
});

/* ================= フォーメーション：選手の丸を指で動かす =================
   位置は「その陣形のときだけ」有効（陣形を変えると元の配置に戻る）。座標は自チームが右へ攻める向き */
const hasMoved = t => !!(t?.pos && t.pos.shape === t.shape && Object.keys(t.pos.at || {}).length);
function movedSlots(shape, team, pos){
  const sl = slotsOf(shape, team);
  if(!pos || pos.shape !== shape) return sl;
  return sl.map((s, i) => pos.at?.[i] ? { ...s, x:pos.at[i].x, y:pos.at[i].y, moved:true } : s);
}
let fpDrag = null, fpSuppress = 0;
document.addEventListener('pointerdown', e => {
  const el = e.target.closest('.fp[data-bp]'); if(!el || e.button > 0) return;
  const box = el.parentElement.getBoundingClientRect();
  fpDrag = { el, id:e.pointerId, sx:e.clientX, sy:e.clientY, box, moved:false, flip:curPer()?.attack === 'left' };
});
document.addEventListener('pointermove', e => {
  const d = fpDrag; if(!d || e.pointerId !== d.id) return;
  if(!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 12) return;
  if(!d.moved){ d.moved = true; d.el.classList.add('fpdrag'); try{ d.el.setPointerCapture(e.pointerId); }catch(_){} if(state.ui.pop){ state.ui.pop = null; $('#pop').hidden = true; } }
  e.preventDefault();
  const px = Math.min(1, Math.max(0, (e.clientX - d.box.left) / d.box.width)), py = Math.min(1, Math.max(0, (e.clientY - d.box.top) / d.box.height));
  d.el.style.left = (px * 100).toFixed(2) + '%'; d.el.style.top = (py * 100).toFixed(2) + '%'; d.px = px; d.py = py;
}, { passive:false });
document.addEventListener('pointerup', e => {
  const d = fpDrag; if(!d || e.pointerId !== d.id) return; fpDrag = null;
  if(!d.moved) return;
  fpSuppress = Date.now();   // 動かしたあとのタップ（選手メニュー）は出さない
  const [side, i] = d.el.dataset.bp.split(':'), f = fmCur(), t = f[side];
  let x = d.px * 105, y = d.py * 68; [x, y] = D(x, y, d.flip);
  if(!t.pos || t.pos.shape !== t.shape) t.pos = { shape:t.shape, at:{} };
  t.pos.at[i] = { x:Math.round(x * 10) / 10, y:Math.round(y * 10) / 10 };
  save.fm(); render();
});
document.addEventListener('pointercancel', () => { if(fpDrag){ fpDrag = null; render(); } });
document.addEventListener('click', e => { if(Date.now() - fpSuppress < 400 && e.target.closest('.fp[data-bp]')){ e.stopImmediatePropagation(); e.preventDefault(); } }, true);

/* ================= 試合の削除（記録した試合も） =================
   まだ同期していない試合は、その場で端末から消す。
   同期済みの試合は「削除」の印を付けて隠し、次の同期でシートに「削除」を書いてから端末から消す */
function deleteMatch(id){
  const m = match(id); if(!m) return;
  const ev = state.events.filter(e => e.matchId === id), sent = !!m.pushedAt || ev.some(e => e.synced);
  openModal({ title:'この試合を削除しますか？', size:'wide',
    body:`<p><b>${esc(dateJP(m.date))} vs ${esc(m.opponent)}（${esc(scoreText(m))}）</b></p>
      <p style="font-size:13px">試合と、その中の記録 ${ev.filter(e => !e.deleted).length}件がすべて消えます。元に戻せません。</p>
      ${sent ? '<p style="font-size:13px">この試合はスプレッドシートに同期済みです。次に「☁️ 同期」したとき、シートの行に「削除」の印が付きます（行そのものは残ります）。</p>' : ''}`,
    actions:[{ label:'キャンセル' }, { label:'削除する', kind:'danger', onClick:() => {
      if(state.current === id){ foldTimer(); state.current = null; save.current(); state.timer = { p:0, el:{}, startedAt:null, brk:null }; save.timer(); }
      const fromSheet = !!m.srcId;   // 予定シートから来た試合は、シートの行が残っていると次の同期でまた予定として入る
      if(sent){ m.deleted = true; m.dirty = true; ev.forEach(e => { e.deleted = true; e.synced = false; }); }
      else { state.matches = state.matches.filter(x => x.id !== id); state.events = state.events.filter(e => e.matchId !== id); }
      save.matches(); save.events();
      if(state.ui.postMatch === id) state.ui.postMatch = null;
      if(state.ui.dataMatch === id) state.ui.dataMatch = null;
      state.ui.screen = 'home'; render(); toast((sent ? '試合を削除しました（次の同期でシートにも反映します）' : '試合を削除しました') + (fromSheet ? '。「予定」シートの行も消してください' : ''));
    } }] });
}
document.addEventListener('click', e => { const b = e.target.closest('[data-delmatch]'); if(b && !e.target.closest('#sheet')) deleteMatch(b.dataset.delmatch); });
