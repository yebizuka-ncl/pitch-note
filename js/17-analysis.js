"use strict";
/* =========================================================
   17. 分析の追加：ボール奪取・ゴール期待値（xG）・エリア別・入力漏れチェック
   ========================================================= */
/* ---------- ゴール期待値（簡易版：位置・距離・角度・ヘディング） ---------- */
function xgOf(e){
  if(e.type !== 'shot') return 0;
  if(e.pk) return .76;
  if(e.x == null) return .08;
  const dx = Math.max(.5, Math.abs((e.team === 'us' ? 105 : 0) - e.x)), dy = e.y - 34, d = Math.hypot(dx, dy);
  let th = Math.atan2(7.32 * dx, dx * dx + dy * dy - 3.66 * 3.66); if(th < 0) th += Math.PI;   // ゴールの見える角度
  let p = 1 / (1 + Math.exp(-(-2.3 + 3.0 * th - .07 * d)));
  if(e.foot === 'head' || e.goal?.foot === 'head') p *= .6;
  return Math.round(Math.min(.9, Math.max(.01, p)) * 100) / 100;
}
const xgSum = shots => Math.round(shots.reduce((a, e) => a + xgOf(e), 0) * 10) / 10;

/* ---------- ボール奪取 ---------- */
function recordWin(team){
  const m = cur(), pos = state.ui.pos; if(!m || !pos) return;
  const e = baseEvent('win'); e.team = team; withPos(e, pos.x, pos.y);
  pushEvent(e); state.ui.pos = null; state.ui.pop = null;
  afterRecord(e, `${teamName(m, team)}が奪った（${thirdFor(e)}）`); render();
}
// 奪った側から見たエリア
function thirdFor(e){ const x = e.team === 'us' ? e.x : 105 - e.x; return x < 35 ? '自陣' : x < 70 ? '中盤' : '敵陣'; }
const winToShot = (ev, w) => ev.some(x => x.type === 'shot' && x.team === w.team && x.matchId === w.matchId && x.period === w.period && x.sec >= w.sec && x.sec - w.sec <= 10);

/* ---------- エリア別（奪った位置・プレー全体） ---------- */
function areaBar(list){
  const n = list.length, c = ['自陣','中盤','敵陣'].map(k => list.filter(e => thirdFor(e) === k).length);
  if(!n) return '<span class="muted" style="font-size:12px">記録なし</span>';
  return `<div class="abar">${c.map((v, i) => v ? `<span class="a${i}" style="flex:${v}" title="${['自陣','中盤','敵陣'][i]} ${v}件">${Math.round(v / n * 100)}%</span>` : '').join('')}</div>`;
}
function winMapSVG(wins){
  return `<svg class="sksvg" viewBox="0 0 105 68" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${fullPitchInner()}
    <g stroke="#fff" stroke-width=".3">${wins.map(e => `<circle cx="${e.x}" cy="${e.y}" r="1.3" fill="${e.team === 'us' ? 'var(--kit-hi)' : 'var(--opp)'}" opacity=".9"/>`).join('')}</g></svg>`;
}
function winPanelHTML(ev, usName, themName){
  const wins = ev.filter(e => e.type === 'win' && e.x != null);
  const play = t => ev.filter(e => e.team === t && e.x != null && (e.type === 'win' || (e.type === 'shot' && !e.pk) || e.type === 'fk'));
  if(!wins.length && !play('us').length) return '';
  const w = t => wins.filter(e => e.team === t), ws = t => w(t).filter(x => winToShot(ev, x)).length;
  return `<section class="card panel">
    <div class="hd"><h3>🛡 ボール奪取とプレーのエリア</h3><span class="muted" style="font-size:12px">エリアは、それぞれのチームが攻める向きで見た「自陣・中盤・敵陣」</span></div>
    <div class="wingrid">
      <div>${winMapSVG(wins)}<div class="tblegend"><span><i style="background:var(--kit-hi)"></i>${esc(usName)}が奪った ${w('us').length}</span><span><i style="background:var(--opp)"></i>${esc(themName)}が奪った ${w('them').length}</span></div></div>
      <div class="arows">
        <div class="q">奪った位置</div>
        <div class="arow"><span class="us">${esc(usName)}</span>${areaBar(w('us'))}</div>
        <div class="arow"><span class="them">${esc(themName)}</span>${areaBar(w('them'))}</div>
        <div class="q">奪ってから10秒以内のシュート</div>
        <div class="arow"><span class="us">${esc(usName)}</span><b class="num">${ws('us')}</b><small class="muted">/ ${w('us').length}回</small></div>
        <div class="arow"><span class="them">${esc(themName)}</span><b class="num">${ws('them')}</b><small class="muted">/ ${w('them').length}回</small></div>
        <div class="q">プレーのエリア <span class="muted">（奪取・シュート・FKの位置）</span></div>
        <div class="arow"><span class="us">${esc(usName)}</span>${areaBar(play('us'))}</div>
        <div class="arow"><span class="them">${esc(themName)}</span>${areaBar(play('them'))}</div>
        <div class="alegend"><i class="a0"></i>自陣 <i class="a1"></i>中盤 <i class="a2"></i>敵陣</div>
      </div>
    </div></section>`;
}

/* ---------- 試合後：入力漏れチェック ---------- */
function gapItems(m){
  const ev = evOf(m.id), it = [];
  ev.filter(isGoalEv).forEach(e => { if(e.type === 'og') return;
    it.push({ ok:!isPending(e), label:`${pShort(m, e.period)} ${e.clock} ${e.team === 'us' ? '得点' : '失点'}の状況`, btn:`data-goaledit="${e.id}"` }); });
  ev.filter(e => e.type === 'shot' && e.team === 'us').forEach(e =>
    it.push({ ok:!!e.playerId && !e.check, label:`${e.check ? '？ ' : ''}${pShort(m, e.period)} ${e.clock} シュート（${RES[e.result]?.label || ''}）を打った選手`, btn:`data-edit="${e.id}"` }));
  ev.filter(e => e.check && !(e.type === 'shot' && e.team === 'us')).forEach(e =>
    it.push({ ok:false, label:`？ ${pShort(m, e.period)} ${e.clock} 要確認：${evText(e, m)}`, btn:`data-edit="${e.id}"` }));
  ev.filter(isConceded).forEach(e =>
    it.push({ ok:!!(e.causes || []).length, label:`${pShort(m, e.period)} ${e.clock} 失点の原因`, btn:e.type === 'og' ? `data-edit="${e.id}"` : `data-goaledit="${e.id}"`, soft:true }));
  ev.filter(e => e.type === 'ck' || (e.type === 'fk' && (e.team === 'us' ? e.x >= 70 : e.x <= 35))).forEach(e =>
    it.push({ ok:hasDrawing(e.sketch), label:`${pShort(m, e.period)} ${e.clock} ${e.team === 'us' ? '' : '相手の'}${e.type === 'ck' ? 'CK' : 'FK'}の作図`, btn:`data-sketchev="${e.id}"`, soft:true }));
  ev.filter(e => e.type === 'mark').forEach(e =>
    it.push({ ok:!!e.tag, label:`${pShort(m, e.period)} ${e.clock} ★マークのタグ`, btn:`data-markedit="${e.id}"` }));
  return it;
}
function gapPanelHTML(m){
  const it = gapItems(m); if(!it.length) return '';
  const done = it.filter(x => x.ok).length, pct = Math.round(done / it.length * 100), todo = it.filter(x => !x.ok);
  return `<section class="card panel">
    <div class="hd"><h3>✅ 入力漏れチェック</h3><span class="muted" style="font-size:12px">タップするとその場で入力できます</span></div>
    <div class="gapbar"><span style="width:${pct}%"></span><b>記録の完成度 ${pct}%</b><small>${done} / ${it.length}</small></div>
    ${todo.length ? `<div class="gaplist">${todo.map(x => `<button type="button" class="gapi ${x.soft ? 'soft' : ''}" ${x.btn}>${esc(x.label)}${x.soft ? '<small>（任意）</small>' : ''}</button>`).join('')}</div>`
      : '<div class="note-banner" style="background:rgba(47,191,113,.14);color:var(--on)">すべて入力済みです 🎉</div>'}
  </section>`;
}

/* ---------- ハーフタイムの図 ---------- */
function htVisHTML(m, p){
  const ev = evOf(m.id), shots = ev.filter(e => e.type === 'shot' && e.x != null && e.period <= p);
  const label = m.periods.slice(0, p + 1).map(x => x.label);
  return `<div class="htvis">
    <div><div class="q" style="margin-bottom:4px">シュートマップ（ここまで ${shots.length}本）</div>${pitchHTML({ dots:shots })}</div>
    <div><div class="q" style="margin-bottom:4px">時間帯別</div>${bucketsSVG(timeBuckets([m]).filter(b => label.includes(b.label)), m.ourName, m.opponent)}</div>
  </div>`;
}

/* ---------- 交代：同じポジションの選手を上に ---------- */
function slotGroupOf(id){
  const f = fmCur(), k = f.us.slots.indexOf(id); if(k < 0 || !f.us.shape) return null;
  const g = slotsOf(f.us.shape, 'us')[k]?.group; return g === 'GK' ? 'GK' : g;
}
const byGroup = (list, g) => g ? list.slice().sort((a, b) => ((posOf(a) === g) ? 0 : 1) - ((posOf(b) === g) ? 0 : 1) || a.num - b.num) : list;

/* ---------- 時計が止まったままの記録に気づかせる ---------- */
let stopWarnAt = 0;
function warnIfStopped(){
  const m = cur(), per = curPer(); if(!m || !per || per.kind === 'pk') return;
  if(!isStarted(m, state.timer.p) || state.timer.startedAt) return;
  if(Date.now() - stopWarnAt < 20000) return;
  stopWarnAt = Date.now(); beep('undo');
  setTimeout(() => toast('⏸ 時計が止まっています。記録は止まった時刻で残ります（▶ START で再開）'), 50);
}

/* ---------- 記録の量（かんたん／ふつう／くわしい） ---------- */
const LEVELS = [
  { id:'easy',   label:'かんたん', sub:'シュート・得点・CK・FK・交代だけ。選手を選ぶのは自チームのゴールのときだけ' },
  { id:'normal', label:'ふつう',   sub:'打った選手も記録。ボール奪取と試合中の作図はなし' },
  { id:'full',   label:'くわしい', sub:'ボール奪取・PKのコース・CK/FKのあとの作図まで全部' },
];
const LV = () => state.meta?.settings?.level || 'normal';
$('#sheet').addEventListener('click', e => {
  const b = e.target.closest('[data-setlevel]'); if(!b) return;
  state.meta.settings.level = b.dataset.setlevel; save.meta();
  document.querySelectorAll('[data-setlevel]').forEach(x => x.setAttribute('aria-pressed', x.dataset.setlevel === b.dataset.setlevel));
  toast(`記録の量：${LEVELS.find(l => l.id === b.dataset.setlevel).label}`); render();
});

/* ---------- スタメン設定でユニフォームを選ぶ ---------- */
$('#sheet').addEventListener('click', e => {
  const b = e.target.closest('[data-stkit]'); if(!b) return;
  const m = cur(), f = state.ui.flow; if(!m) return;
  const n = +b.dataset.stkit;
  m.kit = n; m.kitColors = { ...team().kits[n] }; m.dirty = true; team().lastKit = n;
  save.matches(); save.teams(); applyTheme();
  if(f?.kind === 'starters') starterSheet(f.then); render();
  toast(`${teamKits()[n].label}ユニフォームにしました`);
});

/* ---------- 得点者を選んだら、盤の上に小さく「時間・背番号・名前」。2点目からは「○点目」、3点目はハットトリック ---------- */
const playerGoals = (m, pid) => evOf(m.id).filter(g => g.type === 'shot' && g.result === 'goal' && g.team === 'us' && g.playerId === pid);
function showGoalTag(e){
  const m = match(e.matchId), n = playerGoals(m, e.playerId).length;
  const text = `⚽ ${n >= 2 ? n + '点目　' : ''}${clockMark(e.clock)}　#${e.num} ${family(e.name)}`;
  state.ui.goalTag = { playerId:e.playerId, text, until:Date.now() + 8000 };
  clearTimeout(showGoalTag.t); showGoalTag.t = setTimeout(() => { state.ui.goalTag = null; if(state.ui.screen === 'record') render(); }, 8000);
  if(n === 3) celebrate(`#${e.num} ${e.name}`, 'HAT TRICK!!');
}

/* ---------- 相手選手のメモ（重要・CK・FK・利き足）。背番号ごとに試合に保存 ---------- */
const OPP_FEET = [{ id:'R', label:'右' }, { id:'L', label:'左' }, { id:'B', label:'両' }];
const oppNote = (m, n) => (m.oppNotes || {})[n] || {};
function oppNoteHTML(m, n){
  const o = oppNote(m, n);
  return `<div class="pop-tags"><button type="button" data-popn="key" aria-pressed="${!!o.key}">★ 重要</button><button type="button" data-popn="ck" aria-pressed="${!!o.ck}">CK</button><button type="button" data-popn="fk" aria-pressed="${!!o.fk}">FK</button></div>
    <div class="pop-tags"><span>利き足</span>${OPP_FEET.map(f => `<button type="button" data-popf="${f.id}" aria-pressed="${o.foot === f.id}">${f.label}</button>`).join('')}</div>`;
}
function oppNoteClick(d, m, n){
  m.oppNotes ||= {}; const o = m.oppNotes[n] ||= {};
  if(d.popn) o[d.popn] = !o[d.popn];
  if(d.popf) o.foot = o.foot === d.popf ? null : d.popf;
  m.dirty = true; save.matches(); render();
}
const oppTagText = o => [o.ck ? 'CK' : '', o.fk ? 'FK' : '', o.foot ? { R:'右', L:'左', B:'両' }[o.foot] : ''].filter(Boolean).join('・');
function oppNotesLine(m){
  const list = Object.entries(m.oppNotes || {}).filter(([, o]) => o.key || o.ck || o.fk || o.foot).sort((a, b) => (b[1].key ? 1 : 0) - (a[1].key ? 1 : 0) || a[0] - b[0]);
  return list.map(([n, o]) => `${o.key ? '★' : ''}#${n}${oppTagText(o) ? `（${oppTagText(o)}${o.foot ? '足' : ''}）` : ''}`).join('　');
}

/* ---------- 記録中かどうか・勝敗ラベル ---------- */
const liveNow = () => { const m = cur(); return !!(m && !m.endedAt && m.status === 'live'); };
function resultOf(m){
  const ev = evOf(m.id), a = goalsOf(ev, 'us'), b = goalsOf(ev, 'them'), pk = pkState(m, ev);
  if(a > b) return { id:'w', label:'WIN' };
  if(a < b) return { id:'l', label:'LOSE' };
  if(pk.winner) return { id:'d', label:'DRAW', sub:pk.winner === 'us' ? 'PK勝ち' : 'PK負け' };
  return { id:'d', label:'DRAW' };
}
const resultChip = m => { if(!m.endedAt) return ''; const r = resultOf(m); return `<span class="wld ${r.id}">${r.label}${r.sub ? `<small>${r.sub}</small>` : ''}</span>`; };
