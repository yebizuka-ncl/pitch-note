"use strict";
/* =========================================================
   3. ユーティリティ
   ========================================================= */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const player = id => state.roster.find(p => p.id === id);
// 公式戦で登録メンバーを決めていれば、登録された選手だけが候補
const present = () => { const r = regSet(); return state.roster.filter(p => p.status === 'present' && (!r || r.has(p.id))); };
const family = n => String(n).split(' ')[0];
const match = id => state.matches.find(m => m.id === id);
const cur = () => match(state.current);
const evOf = id => state.events.filter(e => e.matchId === id && !e.deleted);
const teamName = (m, t) => t === 'us' ? (m?.ourName || '自チーム') : (m?.opponent || '相手');
const fmtClock = ms => { const s = Math.floor(ms/1000); return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; };
// 試合時間の表示。ピリオドの時間を超えたら「30+1:12」の形（アディショナルタイム）
const fmtMatch = (ms, min) => { const s = Math.floor(ms/1000);
  if(min && s > min * 60){ const a = s - min * 60; return `${min}+${Math.floor(a/60)}:${String(a%60).padStart(2,'0')}`; }
  return fmtClock(ms); };
const posOf = p => p?.pos || (p?.num === 1 ? 'GK' : '');
const isGoalEv = e => (e.type === 'shot' && e.result === 'goal') || e.type === 'og';
const fmtDur = s => `${Math.floor(s/60)}分${String(s%60).padStart(2,'0')}秒`;
const curPer = () => cur()?.periods[state.timer.p];
const pShort = (m, i) => m?.periods?.[i]?.short ?? '';
const pLabel = (m, i) => m?.periods?.[i]?.label ?? '';
const liveMs = () => { const t = state.timer; return (t.el[t.p] || 0) + (t.startedAt ? Date.now() - t.startedAt : 0); };
const goalsOf = (evs, team) => evs.filter(e => isGoalEv(e) && e.team === team).length;
const isGoalDone = g => !!(g && g.phase && g.lastPass && (g.phase !== 'setpiece' || g.detail));
const isPending = e => e.type === 'shot' && e.result === 'goal' && !isGoalDone(e.goal);
const isStarted = (m, i) => !!m?.periods?.[i]?.started || evOf(m?.id).some(e => e.type === 'kickoff' && e.period === i);
const flipOf = (m, i) => m?.periods?.[i]?.attack === 'left';
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const dateJP = s => { const d = new Date(s + 'T00:00'); return `${d.getMonth()+1}/${d.getDate()}（${'日月火水木金土'[d.getDay()]}）`; };
function scoreText(m){
  const ev = evOf(m.id), pk = pkState(m, ev);
  return `${goalsOf(ev,'us')}-${goalsOf(ev,'them')}` + (pk.a + pk.b || pk.na ? ` (PK ${pk.a}-${pk.b})` : '');
}
function goalContext(e){
  const evs = evOf(e.matchId); const idx = evs.indexOf(e);
  const before = evs.slice(0, idx).filter(isGoalEv);
  const mine = before.filter(x => x.team === e.team).length, d = mine - (before.length - mine), us = e.team === 'us';
  if(!before.length) return us ? '先制点' : '先制される';
  if(d === 0) return us ? '勝ち越し' : '勝ち越される';
  if(d === -1) return us ? '同点弾' : '同点にされる';
  if(d < -1) return us ? '1点返す' : '1点返される';
  return us ? '追加点' : '追加点を奪われる';
}
// 動画での時間：そのピリオドのキックオフ（実時刻）からの経過。給水で時計を止めた分も含むので、動画のシークにそのまま使える
function videoTime(e){
  const m = match(e.matchId);
  if(m?.videoStart && e.wall) return fmtClock(Math.max(0, e.wall - m.videoStart));   // 🎥 撮影開始を記録していれば、動画ファイルの時間
  const ko = evOf(e.matchId).find(x => x.type === 'kickoff' && x.period === e.period);
  if(!ko || !ko.wall || !e.wall) return null;
  return fmtClock(Math.max(0, e.wall - ko.wall));
}
// PK戦の状態（5人ずつ → 決着しなければサドンデス）
function pkState(m, evs){
  const k = evs.filter(e => e.type === 'pkso');
  const us = k.filter(e => e.team === 'us'), th = k.filter(e => e.team === 'them');
  const a = us.filter(e => e.scored).length, b = th.filter(e => e.scored).length, na = us.length, nb = th.length;
  let winner = null;
  if(na <= 5 && nb <= 5){
    if(a > b + (5 - nb)) winner = 'us'; else if(b > a + (5 - na)) winner = 'them';
    else if(na === 5 && nb === 5 && a !== b) winner = a > b ? 'us' : 'them';
  } else if(na === nb && a !== b) winner = a > b ? 'us' : 'them';
  const first = m.pkFirst || 'us';
  const next = winner ? null : (na === nb ? first : (na < nb ? 'us' : 'them'));
  return { us, th, a, b, na, nb, winner, next, nextNo: next ? (next === 'us' ? na : nb) + 1 : null };
}

let toastTimer;
// undoId を渡すと「取り消す」ボタン付き（記録の直後にその場で戻せる）
function toast(msg, undoId){ const t = $('#toast');
  t.innerHTML = esc(msg) + (undoId ? ` <button type="button" class="tundo" data-undoid="${undoId}">↩︎ 取り消す</button>` : '');
  t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => t.hidden = true, undoId ? 4500 : 2600); }
function showStorageWarn(){ $('#storageWarn').hidden = false; }
function flash(sel){ const el = $(sel); if(!el) return; el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
let fxTimer;
function celebrate(name){
  const fx = $('#goalFx'); $('#goalFxName').textContent = name; $('#goalFxName').hidden = !name;
  fx.hidden = true; void fx.offsetWidth; fx.hidden = false;
  clearTimeout(fxTimer); fxTimer = setTimeout(() => fx.hidden = true, 1500);
}
// 記録中は画面が暗くならないようにする（対応していない環境では何もしない）
let wakeLock = null;
async function keepAwake(on){
  try{
    if(on && !wakeLock && navigator.wakeLock){ wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => wakeLock = null); }
    else if(!on && wakeLock){ await wakeLock.release(); wakeLock = null; }
  }catch(e){ wakeLock = null; }
}
document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible' && (state.timer.startedAt || state.timer.brk)) keepAwake(true); });

function ensureLineup(){
  const ids = new Set(present().map(p => p.id));
  state.lineup = state.lineup.filter(id => ids.has(id));
  save.lineup();
}
// 集計のまとめ方：日付ごと／大会ごと／年度（4月〜3月）ごと
const schoolYear = d => { const [y, mo] = String(d).split('-').map(Number); return mo >= 4 ? y : y - 1; };
const tourName = m => m.tournament || (m.kind === '公式戦' ? '公式戦（大会名なし）' : '練習試合');
function scopeMatches(){
  const all = teamMatches().filter(m => m.status !== 'planned'), mode = state.ui.dataMode || 'day';
  if(mode === 'tour') return all.filter(m => tourName(m) === state.ui.dataTour);
  if(mode === 'year') return all.filter(m => String(schoolYear(m.date)) === String(state.ui.dataYear));
  return all.filter(m => m.date === state.ui.dataDate);
}
function dataMatches(){
  const ms = scopeMatches();
  if(state.ui.dataMatch && state.ui.dataMatch !== 'day'){ const m = match(state.ui.dataMatch); if(m && ms.includes(m)) return [m]; }
  const real = ms.filter(m => m.kind !== '紅白戦');   // 紅白戦は日のまとめから除外
  return real.length || ms.length !== 1 ? real : ms;
}
// 色の計算（チームカラーから濃い色・明るい色・相手の色を作る）
function hexToHsl(h){ h = h.replace('#',''); const r = parseInt(h.substr(0,2),16)/255, g = parseInt(h.substr(2,2),16)/255, b = parseInt(h.substr(4,2),16)/255;
  const mx = Math.max(r,g,b), mn = Math.min(r,g,b); let hh = 0, ss = 0; const l = (mx + mn) / 2;
  if(mx !== mn){ const d = mx - mn; ss = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
    hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hh *= 60; }
  return [hh, ss * 100, l * 100]; }
const hsl = (h, s2, l) => `hsl(${Math.round(h)} ${Math.round(s2)}% ${Math.round(Math.max(0, Math.min(100, l)))}%)`;
function applyTheme(){
  let kit = null, m = null;
  if(state.ui.screen === 'data'){ const ms = dataMatches(); if(ms.length === 1) m = ms[0]; }
  else if(state.ui.screen !== 'teams') m = cur();
  let colors = m ? kitOf(m) : (team()?.kits[state.ui.setupKit || team()?.lastKit || 1] || DEFAULT_KITS[1]);
  const root = document.documentElement, bright = !!state.meta.bright;
  const [h, sa, l] = hexToHsl(colors.a), [bh, bs, bl] = hexToHsl(colors.b);
  const set = (k, v) => root.style.setProperty(k, v);
  set('--kit', colors.a); set('--kit-deep', hsl(h, sa, l * .55));
  set('--kit-hi', bright ? hsl(h, sa, Math.min(l, 38)) : hsl(h, Math.max(sa, 55), Math.max(l, 62)));
  set('--us-soft', bright ? hsl(h, sa, 92) : `hsl(${Math.round(h)} ${Math.round(sa)}% 60% / .2)`);
  set('--accent', bright && bl > 70 ? hsl(bh, bs, 45) : colors.b); set('--vital', colors.b);
  set('--accent-ink', bl > 60 ? '#12151b' : '#ffffff');
  // 相手の色：自チームが青系ならオレンジ、それ以外はシアン
  const blue = h > 180 && h < 260;
  set('--opp', bright ? (blue ? '#c45f08' : '#08869a') : (blue ? '#ff8a1f' : '#26c6da'));
  set('--opp-soft', blue ? 'rgba(255,138,31,.18)' : 'rgba(38,198,218,.18)');
  set('--opp-ink', bright ? '#ffffff' : (blue ? '#2a1300' : '#032a30'));
  root.classList.remove('kit2');
  root.classList.toggle('bright', bright);
  $('#brightBtn').textContent = bright ? '🌙 通常モード' : '☀️ 屋外モード';
  const tc = $('#teamChip'); if(tc){ const t = team(); tc.hidden = state.ui.screen === 'teams';
    tc.innerHTML = `<span class="tsw" style="background:linear-gradient(135deg,${t.kits[1].a} 0 60%,${t.kits[1].b} 60%)"></span>${esc(t.name)} ▾`; }
}

/* ---------- フォーメーション ---------- */
function fmCur(){
  if(!state.fm || state.fm.matchId !== state.current) state.fm = { matchId:state.current, us:{ shape:null, slots:[] }, them:{ shape:null, slots:[] } };
  state.fm.them.slots ||= [];
  return state.fm;
}
function autoArrange(){
  const f = fmCur(); ensureLineup();
  const on = state.lineup.map(player).filter(Boolean);
  const gk = player(cur()?.gk) && on.includes(player(cur().gk)) ? player(cur().gk) : (on.find(p => posOf(p) === 'GK') || on[0]);
  const ord = { DF:0, MF:1, FW:2 };
  const rest = on.filter(p => p !== gk).sort((a,b) => (ord[posOf(a)] ?? 1) - (ord[posOf(b)] ?? 1) || a.num - b.num);
  f.us.slots = [gk, ...rest].slice(0, 11).map(p => p ? p.id : null);
  while(f.us.slots.length < 11) f.us.slots.push(null);
  save.fm();
}
function boardHTML({ m, usShape, usPlayers = [], themShape, interactive = false, slotAttr = 'fslot', sel = state.ui.fmSel, full = false }){
  let us = usShape ? slotsOf(usShape, 'us') : [], th = themShape && !full ? slotsOf(themShape, 'them') : [];
  if(full) us = us.map(s => ({ ...s, x:7 + (s.x - 4) * (90 / 44) }));   // 自チームだけをピッチ全体に広げて表示
  const tag = interactive ? 'button' : 'div';
  return `<div class="board"><div class="pitch">${pitchSVG()}
    <div class="bteam us"><b>${usShape || '—'}</b><span>${esc(teamName(m,'us'))}</span></div>
    ${full ? '' : `<div class="bteam them"><b>${themShape || '？'}</b><span>${esc(teamName(m,'them'))}</span></div>`}
    ${us.map((s, i) => { const p = usPlayers[i];
      return `<${tag} ${interactive ? `type="button" data-${slotAttr}="${i}" aria-label="${s.full}"` : ''} class="fp us ${p ? '' : 'empty'} ${interactive && sel === i ? 'sel' : ''}" style="left:${pct(s.x,105)};top:${pct(s.y,68)}">
        <span class="pl">${p ? s.label : '&nbsp;'}</span><span class="c">${p ? p.num : s.label}</span><span class="n">${p ? esc(family(p.name)) : '&nbsp;'}</span></${tag}>`; }).join('')}
    ${th.map(s => `<div class="fp them" style="left:${pct(s.x,105)};top:${pct(s.y,68)}"><span class="c">${s.label}</span></div>`).join('')}
  </div></div>`;
}
function makeFormationEvent(usShape, themShape){
  const ids = state.lineup.slice();
  return { type:'formation', team:'us', us:{ shape:usShape, slots:slotsOf(usShape,'us').map((s,i) => { const p = player(ids[i]);
    return { label:s.label, playerId:p?.id ?? null, num:p?.num ?? null, name:p?.name ?? null }; }) }, them:{ shape:themShape } };
}

