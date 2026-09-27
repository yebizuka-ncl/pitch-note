"use strict";
/* =========================================================
   13. 試合中の操作（止まれない状況で、少ないタップ・画面を隠さない）
   - ピッチをタップ（ドラッグで微調整）→ その場に結果ボタン → 盤の選手をタップ（任意）
   - 記録の時刻は「最初にピッチ／ボタンに触れた瞬間」
   - 大事な操作（STOP・リセット）は長押し
   ========================================================= */

/* ---------- 時刻の確保：触れた瞬間の時計を覚えておく ---------- */
function markTapTime(){ state.ui.tapAt = { ms:liveMs(), wall:Date.now(), p:state.timer.p }; }

/* ---------- ピッチ：押した位置に印 → 指でドラッグして微調整 → 離すと結果ボタン ---------- */
let drag = null;
function pitchPoint(pt, ev){
  const r = pt.getBoundingClientRect(), flip = pt.dataset.flip === '1';
  let x = (ev.clientX - r.left) / r.width * 105, y = (ev.clientY - r.top) / r.height * 68;
  [x, y] = D(x, y, flip);
  return { x:Math.min(105, Math.max(0, x)), y:Math.min(68, Math.max(0, y)) };
}
function moveMarker(pt){
  const mk = pt.querySelector('#posMarker'), hl = pt.querySelector('#zoneHl'), pos = state.ui.pos; if(!mk || !pos) return;
  const flip = pt.dataset.flip === '1', [px, py] = D(pos.x, pos.y, flip), z = zoneOf(pos.x, pos.y);
  mk.style.left = pct(px, 105); mk.style.top = pct(py, 68); mk.hidden = false;
  if(hl){ hl.setAttribute('style', rectStyle(THIRD_X[z.ti], LANE_Y[z.li], 35, LANE_Y[z.li+1] - LANE_Y[z.li], flip)); hl.hidden = false; }
  const ro = $('#pitchReadout'); if(ro){ const near = pos.x >= 52.5 ? 'us' : 'them';
    ro.innerHTML = `<span>${zoneLabel(z.third, z.lane)}</span><span class="tag ${areaOf(pos.x, pos.y, near) !== 'OUT' ? 'pa' : ''}">${AREA[areaOf(pos.x, pos.y, near)]}</span><span class="tag">ゴールまで <b class="num" style="font-size:16px">${distOf(pos.x, pos.y, near)}</b>m</span>`; }
}
document.addEventListener('pointerdown', e => {
  const pt = e.target.closest('.pitch[data-tap]'); if(!pt || e.button > 0) return;
  e.preventDefault();
  if(state.ui.pop) { state.ui.pop = null; $('#pop').hidden = true; }
  markTapTime();
  drag = { pt, id:e.pointerId };
  try{ pt.setPointerCapture(e.pointerId); }catch(_){}
  state.ui.pos = pitchPoint(pt, e); pt.classList.add('dragging'); moveMarker(pt);
});
document.addEventListener('pointermove', e => { if(!drag || e.pointerId !== drag.id) return; state.ui.pos = pitchPoint(drag.pt, e); moveMarker(drag.pt); });
document.addEventListener('pointerup', e => {
  if(!drag || e.pointerId !== drag.id) return;
  drag.pt.classList.remove('dragging'); drag = null;
  showPop({ kind:'pitch' });
});
document.addEventListener('pointercancel', () => { if(drag){ drag.pt.classList.remove('dragging'); drag = null; } });

/* ---------- 長押し（STOP・リセットの誤操作防止） ---------- */
let hold = null;
document.addEventListener('pointerdown', e => {
  const b = e.target.closest('[data-hold]'); if(!b) return;
  b.classList.add('holding');
  hold = { b, t:setTimeout(() => { b.classList.remove('holding'); hold = null; beep('ok');
    const k = b.dataset.hold;
    if(k === 'stop') timerAction('toggle');
    if(k === 'reset'){ state.ui.resetArmed = true; timerAction('reset'); }
    if(k === 'endper') endPeriod();
  }, 550) };
});
['pointerup','pointerleave','pointercancel'].forEach(t => document.addEventListener(t, e => {
  if(!hold) return; if(t === 'pointerleave' && e.target !== hold.b) return;
  clearTimeout(hold.t); hold.b.classList.remove('holding');
  if(t === 'pointerup' && e.target.closest('[data-hold]') === hold.b) toast('長押しで操作します（誤操作防止）');
  hold = null;
}, true));

/* ---------- 効果音（画面を見なくても記録できたと分かる） ---------- */
let actx = null;
function beep(kind = 'rec'){
  if(!state.meta?.settings?.sound) return;
  try{
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    const tones = { rec:[[880, .07]], goal:[[660, .09], [880, .09], [1320, .16]], ok:[[520, .06], [780, .08]], undo:[[440, .08], [330, .1]] }[kind] || [[880, .07]];
    let t = actx.currentTime;
    tones.forEach(([f, d]) => { const o = actx.createOscillator(), g = actx.createGain();
      o.frequency.value = f; o.type = 'sine'; g.gain.setValueAtTime(.18, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + d); t += d * .9; });
  }catch(e){}
}

/* ---------- 記録（ポップアップから呼ばれる） ---------- */
function afterRecord(e, msg){
  state.ui.tapAt = null;
  beep(isGoalEv(e) ? 'goal' : 'rec');
  toast(msg, e.id);
}
function startPick(e, side, kind){
  state.ui.pick = { eventId:e.id, side, kind, until:Date.now() + 10000 };
  clearTimeout(startPick.t); startPick.t = setTimeout(() => { if(state.ui.pick?.eventId === e.id){ state.ui.pick = null; if(state.ui.screen === 'record') render(); } }, 10000);
}
function recordShot(team, result, opt = {}){
  const m = cur(); if(!m) return;
  const pk = !!opt.pk, x = pk ? (team === 'us' ? 94 : 11) : opt.x, y = pk ? 34 : opt.y;
  const e = baseEvent('shot'); e.team = team; withPos(e, x, y);
  e.area = pk ? 'PA' : areaOf(x, y, team); e.dist = distOf(x, y, team);
  e.result = result; e.pk = pk; e.foot = null; if(opt.fkShot) e.fkShot = true;
  const sp = pk ? null : evOf(m.id).slice().reverse().find(v => (v.type === 'ck' || v.type === 'fk') && v.team === team && v.period === e.period && e.sec - v.sec >= 0 && e.sec - v.sec <= 15);
  e.fromSetPiece = sp ? sp.type : null;
  e.goal = result === 'goal' && pk ? { phase:'setpiece', detail:'pk', lastPass:'direct', lane:3, foot:null, touch:null, originZone:null, assistId:null, oppNum:null } : null;
  pushEvent(e);
  state.ui.pos = null; state.ui.pop = null;
  if(result === 'goal' && team === 'us') celebrate(m.ourName);
  startPick(e, team, 'shooter');
  afterRecord(e, `${teamName(m, team)} ${pk ? 'PK' : 'シュート'} → ${RES[result].label}。打った選手を下の盤でタップ（任意）`);
  render();
}
function recordCK(team, side, style){
  const m = cur(), t = CK_TYPES.find(x => x.side === side && x.style === style);
  const e = baseEvent('ck'); e.team = team; e.ckType = t.id; e.side = side; e.style = style;
  if(state.ui.pos) withPos(e, state.ui.pos.x, state.ui.pos.y);
  pushEvent(e); state.ui.pos = null; state.ui.pop = null;
  afterRecord(e, `${teamName(m, team)} ${t.label}`); render();
}
function recordFK(team, kind, play){
  const m = cur(), pos = state.ui.pos;
  const e = baseEvent('fk'); e.team = team; withPos(e, pos.x, pos.y); e.area = areaOf(pos.x, pos.y, team); e.dist = distOf(pos.x, pos.y, team);
  e.fkKind = kind; e.fkPlay = play;
  pushEvent(e);
  if(play === 'shot'){ state.ui.pop = { kind:'pitch', mode:'fkshot', team }; beep('rec'); render(); return; }
  state.ui.pos = null; state.ui.pop = null;
  afterRecord(e, `${teamName(m, team)} ${lbl(FK_KINDS, kind)}→${lbl(FK_PLAYS, play)}`); render();
}
function recordOG(team){
  const m = cur(), e = baseEvent('og'); e.team = team; e.playerId = null; e.oppNum = null;
  pushEvent(e); state.ui.pop = null;
  if(team === 'us') celebrate('OWN GOAL');
  startPick(e, team === 'us' ? 'them' : 'us', 'og');
  afterRecord(e, `オウンゴール：${teamName(m, team)}に1点。入れてしまった選手を盤でタップ（任意）`); render();
}
// 盤の選手をタップして、直前のシュート（またはOG）に選手を付ける
function applyPick(side, idx){
  const pk = state.ui.pick, e = state.events.find(x => x.id === pk.eventId), fm = fmCur(); state.ui.pick = null;
  if(!e){ render(); return; }
  if(side === 'us'){ const p = player(fm.us.slots[idx]); if(p) Object.assign(e, { playerId:p.id, num:p.num, name:p.name, grade:p.grade }); }
  else e.oppNum = fm.them.slots[idx] ?? null;
  e.synced = false; save.events();
  if(e.type === 'shot'){ if(e.result === 'goal' && side === 'us') celebrate(e.num ? `#${e.num} ${e.name}` : ''); showPop({ kind:'foot', side, idx, eventId:e.id }); }
  else { toast('選手を記録しました'); render(); }
}
function addMark(){
  const e = baseEvent('mark'); e.team = 'us'; e.tag = null; e.note = ''; e.playerId = null;
  pushEvent(e);
  state.ui.markTag = { id:e.id, until:Date.now() + 8000 };
  clearTimeout(addMark.t); addMark.t = setTimeout(() => { if(state.ui.markTag?.id === e.id){ state.ui.markTag = null; if(state.ui.screen === 'record') render(); } }, 8000);
  afterRecord(e, `★ ${pShort(cur(), e.period)} ${e.clock} をマーク`); render();
}

/* ---------- ピリオドの締め・AT ---------- */
function endPeriod(){
  const m = cur(), t = state.timer, i = t.p, per = m.periods[i];
  if(t.startedAt) foldTimer(); keepAwake(false);
  per.ended = true; save.matches();
  const next = m.periods[i + 1];
  if(next && next.kind !== 'pk'){
    setPeriod(i + 1);
    const ko = defaultKO(m, i + 1);
    if(ko.team && ko.attack){ next.kickoff = ko.team; next.attack = ko.attack; save.matches(); }
    toast(`${per.label}終了。${next.label}は${next.kickoff ? 'キックオフと陣地を自動で入れ替えました。⚽ KICK OFFで開始' : '🪙 COIN TOSSでトスの結果を選んでから'}`);
    render();
  } else { toast(`${per.label}終了`); render(); periodSheet(); }
}

/* ---------- まとめて交代（OUT→IN の組を作ってから一度に確定） ---------- */
function subPair(outId, inId){
  const outP = player(outId), inP = player(inId); if(!outP || !inP) return;
  state.lineup = state.lineup.map(id => id === outP.id ? inP.id : id); save.lineup();
  const f = fmCur(); f.us.slots = f.us.slots.map(id => id === outP.id ? inP.id : id); save.fm();
  const m = cur(); if(m.gk === outP.id){ m.gk = inP.id; save.matches(); }
  const e = baseEvent('sub'); e.team = 'us';
  Object.assign(e, { outId:outP.id, outNum:outP.num, outName:outP.name, inId:inP.id, inNum:inP.num, inName:inP.name });
  pushEvent(e); return e;
}
function doSub(){
  const e = subPair(state.ui.subOut, state.ui.subIn); state.ui.subOut = ''; state.ui.subIn = '';
  closeSheet(); if(e){ afterRecord(e, `交代：#${e.outNum} ${family(e.outName)} → #${e.inNum} ${family(e.inName)}`); } render();
}
function batchSubSheet(){
  const m = cur(); if(!m) return;
  if(!state.ui.flow || state.ui.flow.kind !== 'bsub') state.ui.flow = { kind:'bsub', pairs:[], selOut:null, selIn:null };
  const f = state.ui.flow, fm = fmCur(), sl = fm.us.shape ? slotsOf(fm.us.shape, 'us') : [];
  const usedOut = new Set(f.pairs.map(p => p[0])), usedIn = new Set(f.pairs.map(p => p[1]));
  const on = state.lineup.map(player).filter(Boolean), { ok:bench, blocked } = benchOf(m);
  const left = subsLeft(m) - f.pairs.length, full = left <= 0;
  const lab = id => { const k = fm.us.slots.indexOf(id); return k >= 0 && sl[k] ? sl[k].full : posOf(player(id)); };
  openSheet(`<h2>👥 交代 <span class="muted" style="font-size:13px;font-weight:700">OUT → IN の順にタップして組を作り、最後にまとめて確定</span></h2>
    ${subRuleCtlHTML(m).replace(subInfoHTML(m), subInfoHTML(m, f.pairs.length))}
    ${full ? `<div class="note-banner" style="margin-bottom:8px">交代枠（${subRules(m).limit}人）に達しました。これ以上は選べません</div>` : ''}
    <div class="bsub">
      <div><div class="q">OUT（出場中）</div><div class="stlist">${on.map(p => `<button type="button" data-bout="${p.id}" aria-pressed="${f.selOut===p.id}" ${usedOut.has(p.id) ? 'disabled' : ''}><span class="jersey">${p.num}</span><span class="nm">${esc(family(p.name))}</span><em>${lab(p.id) || ''}</em></button>`).join('')}</div></div>
      <div><div class="q">IN（ベンチ）</div><div class="stlist">${bench.map(p => `<button type="button" data-bin="${p.id}" aria-pressed="${f.selIn===p.id}" ${usedIn.has(p.id) || full ? 'disabled' : ''}><span class="jersey">${p.num}</span><span class="nm">${esc(family(p.name))}</span><em>${posOf(p) || ''}</em></button>`).join('') || '<span class="muted">ベンチに選手がいません</span>'}
        ${blocked.map(p => `<button type="button" disabled><span class="jersey">${p.num}</span><span class="nm">${esc(family(p.name))}</span><em>再入場不可</em></button>`).join('')}</div></div>
      <div><div class="q">この交代（${f.pairs.length}組）</div><div class="pairs">${f.pairs.map(([o, i], k) => `<div class="pair"><span>#${player(o).num} ${esc(family(player(o).name))}</span><b>→</b><span>#${player(i).num} ${esc(family(player(i).name))}</span><button type="button" class="x" data-bdel="${k}" aria-label="この組を外す">×</button></div>`).join('') || '<div class="muted" style="font-size:12.5px">まだありません</div>'}</div></div>
    </div>
    <p style="font-size:12.5px">交代した選手は、出た選手のポジションにそのまま入ります。時刻は確定した瞬間です。</p>
    <div class="row"><button class="btn" data-close type="button">閉じる</button><button class="btn primary" data-bgo type="button" ${f.pairs.length ? '' : 'disabled'}>🔁 ${f.pairs.length}組の交代を確定</button></div>`, 'xwide');
}
function batchSubClick(d){
  const f = state.ui.flow;
  if(d.bout){ f.selOut = f.selOut === d.bout ? null : d.bout; }
  if(d.bin){ f.selIn = f.selIn === d.bin ? null : d.bin; }
  if(f.selOut && f.selIn && subsLeft(cur()) - f.pairs.length <= 0){ f.selIn = null; toast('交代枠に達しています'); }
  if(f.selOut && f.selIn){ f.pairs.push([f.selOut, f.selIn]); f.selOut = f.selIn = null; }
  if(d.bdel !== undefined) f.pairs.splice(+d.bdel, 1);
  if('bgo' in d){ const n = f.pairs.length; f.pairs.forEach(([o, i]) => subPair(o, i)); closeSheet(); beep('ok'); toast(`${n}組の交代を記録しました`); render(); return; }
  batchSubSheet();
}

/* ---------- あとから記録を追加（記録漏れ・得点だけ） ---------- */
function addPastSheet(){
  const m = cur(); if(!m) return;
  if(!state.ui.flow || state.ui.flow.kind !== 'addpast'){ const s = Math.floor(liveMs() / 1000);
    state.ui.flow = { kind:'addpast', draft:{ type:'goal', team:'us', period:state.timer.p, mm:Math.floor(s/60), ss:s % 60 } }; }
  const d = state.ui.flow.draft;
  const types = [{ id:'goal', label:'得点だけ' }, { id:'shot', label:'シュート' }, { id:'ck', label:'CK' }, { id:'fk', label:'FK' }, { id:'mark', label:'★マーク' }];
  openSheet(`<h2>＋ あとから記録を追加</h2>
    <div class="editgrid">
      <span class="q">種類</span>${chipsHTML(types, 'type', d.type)}
      <span class="q">チーム</span>${teamChips(m, d.team)}
      <span class="q">時刻</span><div class="timeedit"><select id="apPer">${m.periods.map((p, i) => p.kind === 'pk' ? '' : `<option value="${i}" ${i===d.period?'selected':''}>${esc(p.label)}</option>`).join('')}</select>
        <input id="apMm" type="number" inputmode="numeric" min="0" value="${d.mm}">分<input id="apSs" type="number" inputmode="numeric" min="0" max="59" value="${d.ss}">秒</div>
    </div>
    <p style="font-size:12.5px">位置の分からないシュートは、位置なしで記録します。追加したあとに詳しい内容を直せます。</p>
    <div class="row"><button class="btn" data-close type="button">キャンセル</button><button class="btn primary" data-apgo type="button">追加して内容を確認</button></div>`, 'wide');
}
function addPastGo(){
  const m = cur(), d = state.ui.flow.draft;
  const sec = (parseInt($('#apMm').value, 10) || 0) * 60 + (parseInt($('#apSs').value, 10) || 0), period = +$('#apPer').value;
  const e = { id:uid(), matchId:m.id, team:d.team, period, sec, clock:fmtMatch(sec * 1000, m.periods[period]?.min), wall:null, synced:false, recordedAt:new Date().toISOString(), added:true };
  if(d.type === 'goal' || d.type === 'shot') Object.assign(e, { type:'shot', result:d.type === 'goal' ? 'goal' : 'on', pk:false, x:null, y:null, area:'OUT', dist:null, zoneLabel:'位置不明', goal:null });
  else if(d.type === 'mark') Object.assign(e, { type:'mark', team:'us', tag:null, note:'', playerId:null });
  else Object.assign(e, { type:d.type });
  // 時刻の順に並ぶように差し込む（得点の状況「先制・同点」の判定に使うため）
  const key = x => x.matchId === m.id ? x.period * 1e5 + x.sec : -1;
  const at = state.events.findIndex(x => x.matchId === m.id && !x.deleted && key(x) > key(e));
  if(at >= 0) state.events.splice(at, 0, e); else state.events.push(e);
  save.events(); closeSheet(); render(); openEdit(e.id);
}

/* ---------- 設定・バックアップ ---------- */
function settingsSheet(){
  const st = state.meta.settings;
  openSheet(`<h2>⚙ 設定</h2>
    <div class="setlist">
      <label class="setrow"><span><b>記録したときの効果音</b><small>画面を見なくても記録できたと分かります</small></span><input type="checkbox" id="setSound" ${st.sound ? 'checked' : ''}></label>
      <label class="setrow"><span><b>左手で操作する</b><small>記録ボタンの列を左側に置きます</small></span><input type="checkbox" id="setLefty" ${st.lefty ? 'checked' : ''}></label>
      <label class="setrow"><span><b>屋外モード（明るい配色）</b><small>直射日光の下で見やすくします</small></span><input type="checkbox" id="setBright" ${state.meta.bright ? 'checked' : ''}></label>
    </div>
    ${gasSettingsHTML()}
    <div class="q">バックアップ</div>
    <p style="font-size:12.5px">全チームの名簿・試合・記録を1つのファイルに書き出します。iPadの故障や機種変更に備えて、ときどき保存してください。</p>
    <div class="row" style="justify-content:flex-start"><button class="btn" data-backup type="button">⬇︎ バックアップを書き出す</button>
      <label class="btn" for="restoreFile">⬆︎ バックアップから戻す</label><input type="file" id="restoreFile" accept="application/json,.json" hidden></div>
    <p class="muted" style="font-size:12px">保存先：${Store.mode === 'idb' ? 'IndexedDB（端末内）' : 'localStorage（容量が小さめ）'}・${navigator.standalone || matchMedia('(display-mode: standalone)').matches ? 'ホーム画面のアプリとして起動中' : 'ブラウザで起動中（ホーム画面に追加するとデータが消えにくくなります）'}</p>
    <div class="row"><button class="btn primary" data-close type="button">閉じる</button></div>`, 'wide');
}
function exportBackup(){
  Store.flush();
  const data = { app:'pitch-note', kind:'backup', version:1, exportedAt:new Date().toISOString(), store:Store.dump() };
  const text = JSON.stringify(data), name = `pitch-note-backup-${today()}.json`;
  try{
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type:'application/json' })); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    toast('バックアップを書き出しました（「ファイル」アプリに保存されます）');
  }catch(e){ showCopy(text); }
  // プレビュー環境などでダウンロードできない場合に備えて、コピー用の表示も用意
  if(/claude/.test(location.hostname)) setTimeout(() => showCopy(text), 300);
}
function importBackup(file){
  const rd = new FileReader();
  rd.onload = () => {
    try{
      const data = JSON.parse(rd.result); if(data.app !== 'pitch-note' || !data.store) throw 0;
      openModal({ title:'バックアップから戻しますか？', body:`<p>${esc(data.exportedAt?.slice(0,16).replace('T',' ') || '')} のバックアップで、今の端末のデータを<b>すべて置き換え</b>ます。</p>`,
        actions:[{ label:'キャンセル' }, { label:'置き換える', kind:'danger', onClick:() => {
          [...Store.cache.keys()].forEach(k => Store.remove(k));
          Object.entries(data.store).forEach(([k, v]) => Store.write(k, v));
          Store.flush(); initState(); loadTeam(state.teams[0].id); state.ui.screen = 'teams'; render(); toast('バックアップから戻しました'); } }] });
    }catch(e){ toast('このファイルはピッチノートのバックアップではありません'); }
  };
  rd.readAsText(file);
}
// 未同期の記録がたまっていたら知らせる（Safari は 7 日開かないサイトのデータを消すことがあるため）
function syncWarn(){
  const el = $('#syncWarn'); if(!el) return;
  const old = state.events.filter(e => !e.synced).map(e => Date.parse(e.recordedAt)).filter(Boolean).sort()[0];
  const days = old ? Math.floor((Date.now() - old) / 86400000) : 0;
  const pwa = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  el.hidden = days < 3;
  if(days >= 3) el.innerHTML = `⚠️ 未同期の記録が <b>${days}日分</b> たまっています。Wi-Fiにつないで「☁️ ドライブへ同期」を押してください。${pwa ? '' : '（ブラウザで使っている場合、7日以上開かないとデータが消えることがあります）'}`;
}
