"use strict";
/* =========================================================
   7. 画面3：試合記録
   ========================================================= */
function viewRecord(){
  const m = cur();
  if(!m){ state.ui.screen = 'home'; return viewHome(); }
  ensureLineup();
  const ev = evOf(m.id), t = state.timer, per = m.periods[t.p], running = !!t.startedAt;
  const pend = ev.filter(isPending).length;
  const started = isStarted(m, t.p);
  const pk = pkState(m, ev);
  const strip = `
    <section class="strip">
      <div class="sb">
        <span class="tm us"><span>${esc(m.ourName)}</span></span>
        <button type="button" class="score" data-scorepop aria-label="得点の一覧">${goalsOf(ev,'us')}<em>-</em>${goalsOf(ev,'them')}${pk.na + pk.nb ? `<small style="font-size:16px;opacity:.75;margin-left:4px">PK${pk.a}-${pk.b}</small>` : ''}</button>
        <span class="tm them"><span>${esc(m.opponent)}</span></span>
        <span class="clock ${started && !running && per.kind !== 'pk' ? 'paused' : ''}"><small>${esc(per.short)}</small><b data-clock>${per.kind === 'pk' ? 'PK' : '00:00'}</b>
          <button type="button" class="at" data-atset hidden>AT</button><span class="atv" data-atv></span></span>
      </div>
      <button class="btn small perbtn" data-periods type="button">${esc(per.label)} ▾</button>
      ${per.kind === 'pk' ? '' : running
        ? `<button class="tbtn stop hold" data-hold="stop" type="button" title="長押しで停止">❚❚ STOP<i></i></button>`
        : !started ? koInlineHTML(m, per)
        : `<button class="tbtn start" data-timer="toggle" type="button">▶ START</button>`}
      ${per.kind === 'pk' ? '' : `<button class="tbtn endper hold" data-hold="endper" data-endper type="button" hidden>⏹ ${esc(per.label)}終了<i></i></button>`}
      ${per.kind === 'pk' || !started ? '' : t.brk ? `<div class="brkmini" id="brkbar" title="目安${BREAKS[t.brk.type].min}分・試合の時計は動いたまま"><span>${BREAKS[t.brk.type].icon}</span><span class="num" data-brk>0:00</span>
          <button class="btn small" data-brkend type="button">終了</button></div>` : `
        <button class="tbtn reset icon hold" data-hold="reset" type="button" aria-label="長押しで時計を0に戻す">↺<i></i></button>
        <button class="brkbtn" data-brkopen type="button" aria-label="飲水タイム・クーリングブレイク">💧</button>`}
      <span class="spacer"></span>
      <button class="btn small ${state.lineup.length ? '' : 'attn'}" data-members type="button">👥 ${started || per.kind === 'pk' ? '交代' : 'スタメン'}</button>
      ${m.periods.some((p, i) => isStarted(m, i)) ? '<button class="btn small" data-halftime type="button">📊 HT</button>' : ''}
      ${!started && per.kind !== 'pk' ? '' : `<button class="btn small lvchip lv-${LV()}" data-settings type="button" title="記録の量・担当を変える">📝 ${LEVELS.find(l => l.id === LV()).label}${ROLE() !== 'all' ? `｜${ROLES.find(r => r.id === ROLE()).label}` : ''}</button>`}
    </section>`;
  // 画面下の1行：状況に応じて「選手を選ぶ案内」「★のタグ」「最新の記録」を出し分け
  const last = ev[ev.length - 1], pick = state.ui.pick, mt = state.ui.markTag;
  let tickerBody;
  const causeT = causeTickerHTML();
  if(pick && Date.now() < pick.until) tickerBody = `<span class="pickhint">👆 ${pick.kind === 'og' ? 'オウンゴールの選手' : '打った選手'}を下の盤でタップ（${esc(teamName(m, pick.side))}の丸が光っています）</span><span style="flex:1"></span><button class="btn small qbtn" data-pickq type="button">？ わからない（あとで確認）</button><button class="btn small" data-pickskip type="button">スキップ</button>`;
  else if(causeT) tickerBody = causeT;
  else if(mt && Date.now() < mt.until) tickerBody = `<span class="section-title">★ どんな場面？</span><div class="chips mtags">${MARK_TAGS.map(x => `<button type="button" data-mtag="${x.id}">${x.label}</button>`).join('')}</div><span style="flex:1"></span>`;
  else tickerBody = `<span class="section-title">最新</span>
      ${last ? `<span class="t num">${esc(pShort(m, last.period))} ${last.type === 'pkso' ? '' : last.clock}</span><span class="tx" ${last.type === 'kickoff' ? '' : `data-edit="${last.id}"`}>${esc(flagText(last) + evText(last, m))}</span>${['kickoff','formation'].includes(last.type) ? '' : `<button class="btn small qbtn ${last.check ? 'on' : ''}" data-flag="${last.id}" type="button" title="あとで確認する印">？${last.check ? ' 要確認' : ''}</button>`}`
        : '<span class="muted" style="font-size:13px">上の段で 🪙 キックオフのチーム → 🥅 攻める方向 → ⚽ KICK OFF の順に進みます。</span>'}
      <span style="flex:1"></span>
      ${pend ? `<button class="btn small" data-goaledit="${ev.filter(isPending)[0].id}" type="button">⚽ 状況 未入力${pend}</button>` : ''}
      <button class="btn small" data-video type="button">${m.videoStart ? `🎥 <span class="num" data-vclock>--:--</span>` : '🎥 撮影開始'}</button>
      <button class="btn small" data-logopen type="button">📜 ログ ${ev.length}</button>`;
  const ticker = `<section class="card ticker">${tickerBody}</section>`;
  if(per.kind === 'pk') return `<div class="rec rec2 ${state.meta.settings.lefty ? 'lefty' : ''}">${strip}${pkView(m, ev)}${ticker}</div>`;
  const stepBar = !m.periods.some((p, i) => isStarted(m, i)) ? stepperHTML(m) : '';

  const flip = per.attack === 'left';
  const shots = ev.filter(e => e.type === 'shot' && e.x != null);
  let center;
  if(!started){
    // キックオフ前：両チームのスタメンを大きく表示（相手の背番号はここで入力）
    center = `<div class="pitch-area"><div class="pitch-frame"><div class="thirds-head"><span></span><span>${esc(per.label)}のスタメン</span><span></span></div>
        <div class="pitch lbig">${boardLayer(m, flip, false)}</div></div></div>
      <div class="readout"><span class="muted" style="font-weight:700">${per.kickoff && per.attack ? '準備OK！ 笛が鳴ったら ⚽ KICK OFF ／ ' : '上の 🪙 キックオフのチームと 🥅 攻める方向を選ぶと ⚽ KICK OFF が押せます ／ '}相手の丸 → 背番号 ／ チーム名 → フォーメーション変更</span></div>`;
  } else if(ROLE() === 'bench'){
    center = `<div class="pitch-area"><div class="pitch-frame"><div class="thirds-head"><span></span><span>交代・カード：選手の丸をタップ</span><span></span></div>
        <div class="pitch lbig">${boardLayer(m, flip, false)}</div></div></div>
      <div class="readout"><span class="muted" style="font-weight:700">交代・時間係の画面です。シュートを記録するときは 📝 から担当を「全部」か「シュート係」に</span></div>`;
  } else {
    center = `<div class="pitch-area named"><div class="pname"><b>SHOT MAP</b><span>シュートマップ</span><small>シュート・FK・CKをタップ</small></div><div class="pitch-frame">${pitchHTML({ tap:true, dots:shots, pos:state.ui.pos, flip })}</div></div>
      <div class="readout" id="pitchReadout"><span class="muted" style="font-weight:700">自チームは${flip ? '◀ 左' : '右 ▶'}へ攻撃。シュート・FK・CK：ピッチをタップ（押したままずらすと微調整）</span></div>
      <div class="lbwrap"><div class="lboard ${pick && Date.now() < pick.until ? 'picking pick-' + pick.side : ''}">${boardLayer(m, flip, true)}</div><span class="bname"><b>FORMATION</b> フォーメーション</span></div>`;
  }
  return `
  <div class="rec rec2 role-${ROLE()} ${state.meta.settings.lefty ? 'lefty' : ''} ${stepBar ? 'withstep' : ''}">
    ${stepBar}
    ${strip}
    <section class="card pitch-wrap" id="pitchCol">${center}</section>
    <section class="card panel-ev" id="evCol">
      ${ROLE() === 'bench' && started ? '<div class="evhint">交代・時間係</div>' : '<div class="evhint">⚽ シュート・FKは<br><b>ピッチをタップ</b></div>'}
      ${ROLE() === 'bench' && started ? benchGridHTML() : `<div class="evgrid2">
        <button type="button" class="ev2 ck" data-ev="ck"><span class="en">CK</span><span class="jp">コーナー</span></button>
        <button type="button" class="ev2" data-ev="pk"><span class="en">PK</span><span class="jp">ペナルティ</span></button>
        <button type="button" class="ev2 mark" data-mark><span class="en">★</span><span class="jp">動画メモ</span></button>
        <button type="button" class="ev2" data-ev="og"><span class="en">OG</span><span class="jp">オウンゴール</span></button>
      </div>`}
      <button class="btn small" data-addpast type="button">＋ 記録を追加（あとから）</button>
    </section>
    ${ticker}
  </div>`;
}
// カードの状態（y＝警告1枚、r＝退場）
function cardState(m){
  const res = { us:{}, them:{} };
  evOf(m.id).filter(e => e.type === 'card').forEach(e => { const k = e.team === 'us' ? e.playerId : e.oppNum; if(k == null) return;
    res[e.team][k] = e.color === 'Y' && res[e.team][k] !== 'r' ? 'y' : 'r'; });
  return res;
}
const sentOffIds = m => evOf(m.id).filter(e => e.type === 'card' && e.team === 'us' && e.sentOff).map(e => e.playerId);
// ピッチの向きに合わせた両チームのフォーメーション盤（選手をタップ → 交代・カードなど）
function boardLayer(m, flip, small){
  const f = fmCur(), cs = cardState(m);
  const us = f.us.shape ? movedSlots(f.us.shape, 'us', f.us.pos) : [], th = f.them.shape ? movedSlots(f.them.shape, 'them', f.them.pos) : [];
  const at = s => { const [x, y] = D(s.x, s.y, flip); return `left:${pct(x,105)};top:${pct(y,68)}`; };
  const badge = c => c ? `<i class="cd ${c}"></i>` : '';
  const usSide = flip ? 'left:auto;right:8px' : 'left:8px;right:auto', thSide = flip ? 'right:auto;left:8px' : 'left:auto;right:8px';
  const half = (right) => right ? 'left:50%;right:0' : 'left:0;right:50%';
  let h = pitchSVG();
  h += `<button type="button" class="bteam us clk" data-bfm="us" style="${usSide}"><b>${f.us.shape || '—'}</b><span>${esc(m.ourName)} ▾</span></button>`;
  h += `<button type="button" class="bteam them clk" data-bfm="them" style="${thSide}"><b>${f.them.shape || '？'}</b><span>${esc(m.opponent)} ▾</span></button>`;
  const pop = state.ui.pop, swp = state.ui.swapFrom;
  const gt = state.ui.goalTag && Date.now() < state.ui.goalTag.until ? state.ui.goalTag : null;
  h += us.map((s, i) => { const p = player(f.us.slots[i]), g = p ? playerGoals(m, p.id).length : 0;
    return `<button type="button" data-bp="us:${i}" class="fp us ${small ? 'sm' : ''} ${p ? '' : 'empty'} ${swp === i || (pop?.side === 'us' && pop.idx === i) ? 'sel' : ''}" style="${at(s)}" aria-label="${s.full}">
      ${small ? '' : `<span class="pl">${s.label}</span>`}<span class="c">${p ? p.num : s.label}${badge(p && cs.us[p.id])}${g ? `<i class="gb">⚽${g > 1 ? g : ''}</i>` : ''}</span><span class="n">${p ? esc(family(p.name)) : (small ? s.label : '&nbsp;')}</span>
      </button>`; }).join('');
  if(gt) h += `<span class="gtagc">${esc(gt.text)}</span>`;
  h += th.map((s, i) => { const n = f.them.slots[i], o = n != null ? oppNote(m, n) : {}, tg = oppTagText(o);
    return `<button type="button" data-bp="them:${i}" class="fp them ${small ? 'sm' : ''} ${n ? '' : 'empty'} ${o.key ? 'key' : ''} ${pop?.side === 'them' && pop.idx === i ? 'sel' : ''}" style="${at(s)}" aria-label="相手 ${s.full}">
      <span class="c">${n ?? '?'}${badge(n != null && cs.them[n])}${o.key ? '<i class="kb">★</i>' : ''}</span><span class="n">${s.label}</span>${tg ? `<i class="ot">${tg}</i>` : ''}</button>`; }).join('');
  if(!f.us.shape) h += `<button type="button" class="bover" style="${half(flip)}" data-members>👥 スタメンを設定</button>`;
  if(!f.them.shape) h += `<button type="button" class="bover them" style="${half(!flip)}" data-oppshape>相手のフォーメーションを選ぶ</button>`;
  return h;
}
/* ---------- 盤上のポップアップ（別ページを出さずにその場で選ぶ） ---------- */
function showPop(p){ state.ui.pop = p; state.ui.swapFrom = null; render(); }
function closePop(silent){ if(!state.ui.pop) return; state.ui.pop = null; $('#pop').hidden = true; if(!silent) render(); }
function popHTML(){
  const p = state.ui.pop, m = cur(), fm = fmCur(), started = isStarted(m, state.timer.p);
  const x = '<button type="button" class="px" data-popx aria-label="閉じる">×</button>';
  const tn = t => esc(teamName(m, t));
  const resRow = (t, list, extra = '') => `<div class="rrow ${t}"><span class="lab">${tn(t)}</span><div class="rbtns">${list.map(r => `<button type="button" data-pshot="${t}:${r.id}${extra}" class="r-${r.id}">${r.label}</button>`).join('')}</div></div>`;
  if(p.kind === 'score') return scorePopHTML(m);
  if(p.kind === 'pitch'){
    const pos = state.ui.pos; if(!pos) return '';
    const z = zoneOf(pos.x, pos.y), near = pos.x >= 52.5 ? 'us' : 'them', order = near === 'us' ? ['us','them'] : ['them','us'];
    const head = `<div class="pop-h"><b>${zoneLabel(z.third, z.lane)}</b><span class="tag">${AREA[areaOf(pos.x, pos.y, near)]}・${distOf(pos.x, pos.y, near)}m</span>${x}</div>`;
    if(p.mode === 'fk') return head + `<div class="q">${tn(p.team)} のFK：どうした？</div>
      ${FK_KINDS.map(k => `<div class="rrow ${p.team}"><span class="lab">${k.label}</span><div class="rbtns">${FK_PLAYS.map(pl => `<button type="button" data-pfkp="${k.id}:${pl.id}">${pl.label}</button>`).join('')}</div></div>`).join('')}`;
    if(p.mode === 'fkshot') return head + `<div class="q">FKからのシュート：結果は？</div>${resRow(p.team, RESULTS, ':fk')}`;
    // コーナー付近をタップしたら CK（攻めている側と左右を自動で判定）
    const ckTeam = pos.x >= 98 ? 'us' : pos.x <= 7 ? 'them' : null, corner = ckTeam && (pos.y <= 8 || pos.y >= 60);
    const ckSide = ckTeam === 'us' ? (pos.y < 34 ? 'L' : 'R') : (pos.y > 34 ? 'L' : 'R');
    return head + (corner ? `<div class="rrow ${ckTeam} ck"><span class="lab">${tn(ckTeam)} ${ckSide === 'L' ? '左' : '右'}CK</span><div class="rbtns">
        <button type="button" data-pck="${ckTeam}:${ckSide}:">CKを記録</button></div></div>` : '')
      + order.map(t => resRow(t, RESULTS)).join('')
      + (LV() === 'full' ? `<div class="fkrow"><span>奪取</span><button type="button" data-pwin="us" class="us">${tn('us')}が奪った</button><button type="button" data-pwin="them" class="them">${tn('them')}が奪った</button></div>` : '')
      + order.map(t => `<div class="fkrow"><span>FK</span><b class="fkt ${t}">${tn(t)}</b><button type="button" data-pfkq="${t}:kick" class="${t}">シュート以外</button><button type="button" data-pfkq="${t}:shot" class="${t}">直接シュート</button></div>`).join('');
  }
  if(p.kind === 'ck') return `<div class="pop-h"><b>CK</b><span class="muted">左右は攻める向きで</span>${x}</div>
    ${['us','them'].map(t => `<div class="rrow ${t}"><span class="lab">${tn(t)}</span><div class="rbtns">${CK_SIDES.map(c => `<button type="button" data-pck="${t}:${c.id}:">${c.label}</button>`).join('')}</div></div>`).join('')}`;
  if(p.kind === 'pk') return `<div class="pop-h"><b>PK</b><span class="muted">${LV() === 'easy' ? '結果を選ぶ' : '① コース（キッカーから見て・任意） ② 結果'}</span>${x}</div>${LV() === 'easy' ? '' : pkGridHTML(p.course, 'pkc')}${['us','them'].map(t => resRow(t, RESULTS.filter(r => r.id !== 'block'), ':pk')).join('')}`;
  if(p.kind === 'og') return `<div class="pop-h"><b>オウンゴール</b>${x}</div>
    <div class="pop-act col"><button type="button" data-pog="us">⚽<span>${tn('us')}に1点（相手のOG）</span></button><button type="button" data-pog="them">⚽<span>${tn('them')}に1点（自チームのOG）</span></button></div>`;
  if(p.kind === 'foot'){ const e = state.events.find(v => v.id === p.eventId);
    return `<div class="pop-h"><b>${e?.num ? `#${e.num} ${esc(family(e.name))}` : e?.oppNum ? `${tn('them')} #${e.oppNum}` : ''}</b><span class="muted">足は？（任意）</span>${x}</div>
      <div class="rbtns r4">${FEET.map(f => `<button type="button" data-pfoot="${f.id}">${f.label}</button>`).join('')}</div>`; }
  if(p.kind === 'at') return `<div class="pop-h"><b>アディショナルタイム</b><span class="muted">審判の表示</span>${x}</div>
    <div class="rbtns r5">${[1,2,3,4,5,6,7,8,9,10].map(n => `<button type="button" data-pat="${n}" class="disp ${curPer()?.at === n ? 'on' : ''}">+${n}</button>`).join('')}</div>`;
  if(p.fm){
    const cur_ = fm[p.fm].shape, list = Object.keys(FORMATIONS);
    return `<div class="pop-h"><span class="chip ${p.fm}">${esc(teamName(m, p.fm))}</span><b>フォーメーション</b>${x}</div>
      <div class="wheel">${p.fm === 'them' ? `<button type="button" data-pfm="" class="${!cur_ ? 'on' : ''}">不明</button>` : ''}${list.map(k => `<button type="button" data-pfm="${k}" class="disp ${cur_ === k ? 'on' : ''}">${k}</button>`).join('')}</div>
      ${started ? '<div class="pop-note">変えると今の時刻で記録します</div>' : ''}
      ${hasMoved(fm[p.fm]) ? '<div class="pop-act"><button type="button" data-pfmreset>↺<span>選手の位置を元に戻す</span></button></div>' : '<div class="pop-note">選手の丸は、指で押したままずらすと好きな位置へ動かせます</div>'}`;
  }
  const sl = slotsOf(fm[p.side].shape, p.side)[p.idx];
  if(p.side === 'them'){
    const n = fm.them.slots[p.idx], cs = cardState(m).them[n];
    if(p.mode === 'in') return `<div class="pop-h"><b>🔁 IN の背番号</b><span class="muted">OUT #${n}</span>${x}</div>
      <div class="wheel">${Array.from({ length:99 }, (_, k) => k + 1).map(k => `<button type="button" data-pnum="${k}" class="disp ${fm.them.slots.includes(k) ? 'used' : ''}">${k}</button>`).join('')}</div>`;
    return `<div class="pop-h"><span class="chip them">${sl.full}</span><b class="disp" style="font-size:20px">${n != null ? '#' + n : '背番号'}</b>${cs ? `<i class="cd ${cs} inl"></i>` : ''}${x}</div>
      <div class="wheel">${Array.from({ length:99 }, (_, k) => k + 1).map(k => `<button type="button" data-pnum="${k}" class="disp ${k === n ? 'on' : ''} ${k !== n && fm.them.slots.includes(k) ? 'used' : ''}">${k}</button>`).join('')}</div>
      ${n != null ? oppNoteHTML(m, n) : ''}
      ${started && n != null ? `<div class="pop-act"><button type="button" data-pact="in">🔁<span>交代</span></button><button type="button" data-pact="Y">🟨<span>警告</span></button><button type="button" data-pact="R">🟥<span>退場</span></button></div>` : ''}`;
  }
  const pl = player(fm.us.slots[p.idx]);
  if(p.mode === 'bench'){
    const { ok:bench0, blocked } = benchOf(m), left = subsLeft(m), bench = byGroup(bench0, slotGroupOf(pl?.id));
    if(!left) return `<div class="pop-h"><b>🔁 IN</b>${x}</div><div class="pop-note">交代の回数（${subRules(m).limit}回）を使い切りました。👥 交代 からルールを変更できます</div>`;
    return `<div class="pop-h"><b>🔁 IN</b><span class="muted">OUT #${pl.num} ${esc(family(pl.name))}</span>${x}</div>
      <div class="pop-note">${subInfoHTML(m)}</div>
      <div class="wheel list">${bench.map(b => `<button type="button" data-pin="${b.id}"><span class="jersey">${b.num}</span>${esc(family(b.name))}${posOf(b) ? `<span class="ptag">${posOf(b)}</span>` : ''}</button>`).join('') || '<div class="pop-note">ベンチに選手がいません</div>'}
      ${blocked.map(b => `<button type="button" disabled><span class="jersey">${b.num}</span>${esc(family(b.name))}<span class="ptag">再入場不可</span></button>`).join('')}</div>`;
  }
  const cs = pl && cardState(m).us[pl.id];
  return `<div class="pop-h"><span class="chip us">${sl.full}</span><b>${pl ? `#${pl.num} ${esc(family(pl.name))}` : '空き'}</b>${cs ? `<i class="cd ${cs} inl"></i>` : ''}${x}</div>
    <div class="pop-act col">
      ${started && pl ? `<button type="button" data-pact="sub">🔁<span>交代</span></button><button type="button" data-pact="Y">🟨<span>警告${cs === 'y' ? '（2枚目→退場）' : ''}</span></button><button type="button" data-pact="R">🟥<span>退場</span></button>` : ''}
      <button type="button" data-pact="swap">↔️<span>${pl ? 'ポジションを入れ替え' : 'ここに選手を移す'}</span></button>
      ${!started ? '<button type="button" data-pact="starters">👥<span>スタメン設定を開く</span></button>' : ''}
    </div>`;
}
function renderPop(){
  const el = $('#pop'), p = state.ui.pop;
  if(!p || state.ui.screen !== 'record'){ el.hidden = true; return; }
  const sel = p.kind === 'score' ? '[data-scorepop]' : p.kind === 'pitch' ? '#posMarker' : ['ck','pk','og'].includes(p.kind) ? `[data-ev="${p.kind}"]` : p.kind === 'at' ? '[data-atset]'
    : p.fm ? `[data-bfm="${p.fm}"]` : `[data-bp="${p.side}:${p.idx}"]`;
  const anchor = document.querySelector(sel);
  if(!anchor){ el.hidden = true; return; }
  el.className = 'pop' + (['pitch','ck','pk','og','at','score'].includes(p.kind) ? ' wide' : '');
  el.innerHTML = popHTML(); el.hidden = false;
  const r = anchor.getBoundingClientRect(), W = el.offsetWidth, H = el.offsetHeight;
  let left = r.right + 10; if(left + W > innerWidth - 8) left = r.left - W - 10;
  const top = Math.max(8, Math.min(innerHeight - H - 8, r.top + r.height / 2 - H / 2));
  if(p.kind === 'foot'){ el.style.left = Math.max(8, Math.min(innerWidth - W - 8, r.left + r.width / 2 - W / 2)) + 'px'; el.style.top = Math.max(8, r.top - H - 12) + 'px'; }   // 盤の中央下の得点の札と重ならないよう、選手の上に出す
  else if(p.kind === 'score'){ el.style.left = Math.max(8, Math.min(innerWidth - W - 8, r.left)) + 'px'; el.style.top = (r.bottom + 8) + 'px'; }
  else { el.style.left = Math.max(8, left) + 'px'; el.style.top = top + 'px'; }
  const wh = el.querySelector('.wheel'), on = wh?.querySelector('.on');
  if(wh && on) wh.scrollTop = on.offsetTop - wh.clientHeight / 2 + on.offsetHeight / 2;
}
function popClick(b){
  const d = b.dataset, p = state.ui.pop, fm = fmCur(), m = cur();
  if('popx' in d){ if(p.kind === 'pitch'){ state.ui.pos = null; state.ui.tapAt = null; } closePop(); return; }
  if(d.pgoal){ closePop(true); openEdit(d.pgoal); return; }
  if(d.pshot){ const [t, r, flag] = d.pshot.split(':'); const pos = state.ui.pos || {};
    recordShot(t, r, { x:pos.x, y:pos.y, pk:flag === 'pk', fkShot:flag === 'fk', course:flag === 'pk' ? p.course : null }); return; }
  if(d.pkc){ p.course = p.course === d.pkc ? null : d.pkc; renderPop(); return; }
  if(d.pck){ const [t, side, style] = d.pck.split(':'); recordCK(t, side, style); return; }
  if(d.pfk){ state.ui.pop = { kind:'pitch', mode:'fk', team:d.pfk }; renderPop(); return; }
  if(d.pfkq){ const [t, pl] = d.pfkq.split(':'); recordFK(t, null, pl); return; }
  if(d.pwin){ recordWin(d.pwin); return; }
  if(d.pfkp){ const [k, pl] = d.pfkp.split(':'); recordFK(p.team, k, pl); return; }
  if(d.pog){ recordOG(d.pog); return; }
  if(d.pfoot){ const e = state.events.find(v => v.id === p.eventId); if(e){ e.foot = d.pfoot; if(e.goal) e.goal.foot = d.pfoot; e.synced = false; save.events(); } closePop(); return; }
  if('pfmreset' in d){ fm[p.fm].pos = null; save.fm(); closePop(true); toast('選手の位置を元に戻しました'); render(); return; }
  if(d.pat){ const per = curPer(); per.at = +d.pat; save.matches(); closePop(); toast(`アディショナルタイム +${d.pat}分`); return; }
  if(d.pfm !== undefined){
    fm[p.fm].shape = d.pfm || null;
    if(p.fm === 'them' && d.pfm && fm.them.slots[0] == null) fm.them.slots[0] = 1;   // 相手のGKは1番が多いので最初から入れておく
    if(p.fm === 'us' && !fm.us.slots.some(Boolean)) autoArrange();
    save.fm(); recordFormationIfStarted(); closePop(true);
    toast(`${teamName(m, p.fm)}のフォーメーション：${d.pfm || '不明'}${isStarted(m, state.timer.p) ? '（記録しました）' : ''}`); render(); return;
  }
  if(d.pnum){ const v = +d.pnum;
    if(p.mode === 'in'){ const e = baseEvent('sub'); e.team = 'them'; e.slot = p.idx; e.outNum = fm.them.slots[p.idx]; e.inNum = v;
      fm.them.slots[p.idx] = v; save.fm(); pushEvent(e); closePop(true); toast(`${m.opponent}の交代：#${e.outNum} → #${v}`); render(); return; }
    const k = fm.them.slots.indexOf(v); if(k >= 0 && k !== p.idx) fm.them.slots[k] = null;
    fm.them.slots[p.idx] = v; save.fm();
    // 次の空いているポジションへ自動で進む（キックオフ前の一括入力用）
    const cnt = slotsOf(fm.them.shape, 'them').length; let next = -1;
    for(let j = 1; j < cnt; j++){ const q = (p.idx + j) % cnt; if(fm.them.slots[q] == null){ next = q; break; } }
    if(next >= 0 && !isStarted(m, state.timer.p)) showPop({ side:'them', idx:next }); else closePop();
    return; }
  if((d.popn || d.popf) && p.side === 'them'){ const n = fm.them.slots[p.idx]; if(n != null) oppNoteClick(d, m, n); return; }
  if(d.pact === 'in'){ p.mode = 'in'; renderPop(); return; }
  if(d.pact === 'Y' || d.pact === 'R'){ giveCard(p.side, p.idx, d.pact); return; }
  if(d.pact === 'sub'){ p.mode = 'bench'; renderPop(); return; }
  if(d.pact === 'swap'){ const i = p.idx; state.ui.pop = null; state.ui.swapFrom = i; $('#pop').hidden = true; render(); toast('入れ替える相手の丸をタップしてください'); return; }
  if(d.pact === 'starters'){ closePop(true); starterSheet(null); return; }
  if(d.pin){ state.ui.subOut = fm.us.slots[p.idx]; state.ui.subIn = d.pin; closePop(true); doSub(); return; }
}
function logSheet(){
  const m = cur(), ev = evOf(m.id);
  openSheet(`<h2>📜 この試合のログ <span class="muted" style="font-size:13px;font-weight:700">${ev.length}件・文字をタップで修正</span></h2>
    <ul class="loglist" style="max-height:60vh">${ev.length ? ev.slice().reverse().map(e => logItem(e, m)).join('') : '<li class="muted">まだ記録がありません</li>'}</ul>
    <div class="row"><button class="btn" data-undo type="button" ${ev.length ? '' : 'disabled'}>↩︎ 1つ取り消す</button><span style="flex:1"></span><button class="btn primary" data-close type="button">閉じる</button></div>`, 'wide');
}
/* ---------- 選手メニュー（盤上の選手をタップ） ---------- */
function openPlayer(side, i){
  const per = curPer();
  if(side === 'us' && !fmCur().us.shape){ membersSheet(); return; }
  state.ui.flow = { kind:'pmenu', side, idx:i, mode:side === 'them' && fmCur().them.slots[i] == null ? 'num' : null, auto:true };
  if(side === 'us' && !player(fmCur().us.slots[i]) && per && !per.kickoff){ state.ui.flow = null; starterSheet(null); return; }
  renderSheet();
}
function playerMenuHTML(){
  const f = state.ui.flow, m = cur(), fm = fmCur(), kicked = !!curPer()?.kickoff;
  const sl = slotsOf(fm[f.side].shape, f.side)[f.idx], cs = cardState(m);
  const back = f.mode ? '<button class="btn" data-pmback type="button">◀ 戻る</button>' : '';
  if(f.side === 'us'){
    const p = player(fm.us.slots[f.idx]);
    const others = fm.us.slots.map((id, k) => ({ p:player(id), k, lab:slotsOf(fm.us.shape, 'us')[k].full })).filter(x => x.k !== f.idx);
    if(!p || f.mode === 'swap') return `<h2><span class="chip us">${esc(m.ourName)}</span>${sl.full}${p ? `　#${p.num} ${esc(family(p.name))}` : '（空き）'}</h2>
      <div class="q">${p ? '入れ替える相手を選ぶ' : 'このポジションに移す選手を選ぶ'}</div>
      <div class="pgrid">${others.filter(x => x.p || p).map(x => `<button type="button" data-pswap="${x.k}">${x.p ? `<span class="jersey">${x.p.num}</span>${esc(family(x.p.name))}` : '（空き）'}<span class="ptag" style="margin-left:auto">${x.lab}</span></button>`).join('')}</div>
      <div class="row">${back}<span style="flex:1"></span><button class="btn" data-close type="button">閉じる</button></div>`;
    if(f.mode === 'sub'){
      const { ok:bench0, blocked } = benchOf(m), bench = byGroup(bench0, slotGroupOf(p.id));
      if(!subsLeft(m)) return `<h2>🔁 交代</h2><p>交代の回数（${subRules(m).limit}回）を使い切りました。</p>${subRuleCtlHTML(m)}
        <div class="row">${back}<span style="flex:1"></span><button class="btn" data-close type="button">閉じる</button></div>`;
      return `<h2>🔁 交代：OUT #${p.num} ${esc(family(p.name))}（${sl.full}）</h2>
        <div class="q">入る選手（IN）　${subInfoHTML(m)}</div>
        <div class="pgrid">${bench.map(x => `<button type="button" data-psubin="${x.id}"><span class="jersey">${x.num}</span>${esc(family(x.name))}${posOf(x) ? `<span class="ptag" style="margin-left:auto">${posOf(x)}</span>` : ''}</button>`).join('') || '<span class="muted">ベンチに選手がいません</span>'}
          ${blocked.map(x => `<button type="button" disabled><span class="jersey">${x.num}</span>${esc(family(x.name))}<span class="ptag" style="margin-left:auto">再入場不可</span></button>`).join('')}</div>
        <div class="row">${back}<span style="flex:1"></span><button class="btn" data-close type="button">閉じる</button></div>`;
    }
    const c = cs.us[p.id];
    return `<h2><span class="chip us">${esc(m.ourName)}</span>#${p.num} ${esc(p.name)} <span class="ptag">${sl.full}</span>${c ? ` <i class="cd ${c} inl"></i>` : ''}</h2>
      <div class="pact">
        ${kicked ? `<button type="button" data-pmode="sub">🔁<b>交代</b></button>
        <button type="button" data-pcard="Y" class="y">🟨<b>警告</b>${c === 'y' ? '<small>2枚目 → 退場</small>' : ''}</button>
        <button type="button" data-pcard="R" class="r">🟥<b>退場</b></button>` : ''}
        <button type="button" data-pmode="swap">↔️<b>ポジション入れ替え</b></button>
        ${kicked ? '' : '<button type="button" data-pstarters>👥<b>スタメン設定を開く</b></button>'}
      </div>
      <div class="row"><button class="btn" data-close type="button">閉じる</button></div>`;
  }
  const n = fm.them.slots[f.idx];
  if(f.mode === 'num' || f.mode === 'oppsub'){
    const sub = f.mode === 'oppsub';
    return `<h2><span class="chip them">${esc(m.opponent)}</span>${sl.full}　${sub ? `交代：OUT #${n} → IN の背番号は？` : '背番号は？'}</h2>
      <div class="numgrid">${Array.from({ length:40 }, (_, k) => k + 1).map(k => { const used = fm.them.slots.includes(k) && k !== n;
        return `<button type="button" data-onum="${k}" aria-pressed="${!sub && n === k}" ${used ? 'style="opacity:.35"' : ''}>${k}</button>`; }).join('')}</div>
      ${sub ? '' : `<label class="checkrow" style="color:var(--ink-2)"><input type="checkbox" id="oppAuto" ${f.auto ? 'checked' : ''}>入力したら次の空いているポジションへ進む</label>`}
      <div class="row">${back}${!sub && n != null ? '<button class="btn" data-onum="" type="button">番号を消す</button>' : ''}<span style="flex:1"></span><button class="btn" data-close type="button">閉じる</button></div>`;
  }
  const c = cs.them[n];
  return `<h2><span class="chip them">${esc(m.opponent)}</span>#${n} <span class="ptag">${sl.full}</span>${c ? ` <i class="cd ${c} inl"></i>` : ''}</h2>
    <div class="pact">
      ${kicked ? `<button type="button" data-pmode="oppsub">🔁<b>交代</b></button>
      <button type="button" data-pcard="Y" class="y">🟨<b>警告</b>${c === 'y' ? '<small>2枚目 → 退場</small>' : ''}</button>
      <button type="button" data-pcard="R" class="r">🟥<b>退場</b></button>` : ''}
      <button type="button" data-pmode="num">🔢<b>背番号を直す</b></button>
    </div>
    <div class="row"><button class="btn" data-close type="button">閉じる</button></div>`;
}
function giveCard(side, i, color){
  const f = { side }, m = cur(), fm = fmCur();
  const e = baseEvent('card'); e.team = f.side; e.slot = i;
  if(f.side === 'us'){ const p = player(fm.us.slots[i]); Object.assign(e, { playerId:p.id, num:p.num, name:p.name }); }
  else e.oppNum = fm.them.slots[i];
  const had = cardState(m)[f.side][f.side === 'us' ? e.playerId : e.oppNum] === 'y';
  e.color = color === 'Y' && had ? 'Y2' : color; e.sentOff = e.color !== 'Y';
  if(e.sentOff){
    if(f.side === 'us'){ fm.us.slots[i] = null; state.lineup = state.lineup.filter(id => id !== e.playerId); save.lineup(); if(m.gk === e.playerId){ m.gk = null; save.matches(); } }
    else fm.them.slots[i] = null;
    save.fm();
  }
  pushEvent(e); closeSheet(); closePop(true);
  toast(`${e.color === 'Y' ? '🟨 警告' : e.color === 'Y2' ? '🟨🟨 2枚目の警告で退場' : '🟥 退場'}：${f.side === 'us' ? `#${e.num} ${e.name}` : `${m.opponent} #${e.oppNum}`}`);
  render();
}
function setOppNum(v){
  const f = state.ui.flow, fm = fmCur();
  if(f.mode === 'oppsub'){
    const e = baseEvent('sub'); e.team = 'them'; e.slot = f.idx; e.outNum = fm.them.slots[f.idx]; e.inNum = v;
    fm.them.slots[f.idx] = v; save.fm(); pushEvent(e); closeSheet(); toast(`相手の交代：#${e.outNum} → #${v}`); render(); return;
  }
  const k = fm.them.slots.indexOf(v); if(v != null && k >= 0 && k !== f.idx) fm.them.slots[k] = null;   // 同じ番号が別の場所にあれば外す
  fm.them.slots[f.idx] = v; save.fm();
  const cnt = slotsOf(fm.them.shape, 'them').length;
  let next = -1; for(let k = 1; k <= cnt; k++){ const j = (f.idx + k) % cnt; if(fm.them.slots[j] == null){ next = j; break; } }
  if(v != null && f.auto && next >= 0){ f.idx = next; f.mode = 'num'; renderSheet(); render(); return; }
  closeSheet(); render();
}
function pkView(m, ev){
  if(!m.pkFirst) return `<section class="card pkview">
    <h2 style="font-size:22px">PK戦 — 先に蹴るチームは？</h2>
    <div class="bigchoice">
      <button type="button" data-pkfirst="us" data-v="us" aria-pressed="true">${esc(m.ourName)}<small>先攻</small></button>
      <button type="button" data-pkfirst="them" data-v="them" aria-pressed="true">${esc(m.opponent)}<small>先攻</small></button>
    </div>
    <p class="muted" style="margin:0">5人ずつ蹴って決着しなければ、1人ずつのサドンデスに入ります。勝敗が決まった時点で自動で終わります。</p></section>`;
  const s = pkState(m, ev);
  const row = (team, list, total) => { const n = Math.max(5, list.length, team === 'us' ? s.nb : s.na);
    return `<div class="pkrow ${team}"><span class="nm">${esc(teamName(m, team))}${m.pkFirst === team ? ' <small style="opacity:.8">先攻</small>' : ''}</span>
      <div class="pkcs">${Array.from({ length:n }, (_, i) => { const k = list[i]; return `<span class="pkc ${k ? (k.scored ? 'ok' : 'ng') : ''}" title="${i+1}人目">${k ? (k.scored ? '○' : '×') : i+1}</span>`; }).join('')}</div>
      <span class="pktot">${total}</span></div>`; };
  const kicked = new Set(s.us.map(k => k.playerId).filter(Boolean));
  const on = state.lineup.map(player).filter(Boolean);
  return `<section class="card pkview">
    ${row('us', s.us, s.a)}${row('them', s.th, s.b)}
    ${s.winner ? `<div class="pkwin ${s.winner}">🏆 ${esc(teamName(m, s.winner))} WIN　PK ${s.a}-${s.b}</div>` : `
    <div class="pknext">
      <div style="font-weight:900;font-size:17px">次のキッカー：<span class="chip ${s.next}" style="font-size:15px">${esc(teamName(m, s.next))}</span> ${s.nextNo}人目${s.nextNo > 5 ? '（サドンデス）' : ''}</div>
      ${s.next === 'us' ? `<div class="chips">${on.map(p => `<button type="button" data-pkkicker="${p.id}" aria-pressed="${state.ui.pkKicker===p.id}" ${kicked.has(p.id) && s.nextNo <= on.length ? 'style="opacity:.45"' : ''}>#${p.num} ${esc(family(p.name))}</button>`).join('')}</div>` : ''}
      ${LV() === 'easy' ? '' : `<div class="pkcourse"><span class="muted">コース（キッカーから見て・任意）</span>${pkGridHTML(state.ui.pkCourse, 'pkcs')}</div>`}
      <div class="pkbtns"><button type="button" data-pk="goal">⚽ 成功</button><button type="button" data-pk="save">✋ 失敗（セーブ）</button><button type="button" data-pk="off">✕ 失敗（枠外）</button></div>
    </div>`}
  </section>`;
}
function evText(e, m){
  const tn = teamName(m, e.team);
  switch(e.type){
    case 'sub': return e.team === 'them' ? `${teamName(m,'them')}の交代：#${e.outNum ?? '?'} → #${e.inNum}` : `交代：#${e.outNum} ${family(e.outName)} → #${e.inNum} ${family(e.inName)}`;
    case 'card': return `${e.color === 'Y' ? '🟨 警告' : e.color === 'Y2' ? '🟨🟨 2枚目の警告 → 退場' : '🟥 退場'}　${e.team === 'us' ? `#${e.num} ${family(e.name)}` : `${teamName(m,'them')} #${e.oppNum ?? '?'}`}`;
    case 'formation': return `フォーメーション　${teamName(m,'us')} ${e.us.shape} / ${teamName(m,'them')} ${e.them.shape || '不明'}`;
    case 'kickoff': return `${pLabel(m, e.period)} キックオフ：${teamName(m, e.team)}（自チームは${e.attack === 'left' ? '左' : '右'}へ攻める）`;
    case 'break': return `${BREAKS[e.kind].icon} ${BREAKS[e.kind].label}（${fmtDur(e.dur)}）`;
    case 'mark': { const p = player(e.playerId);
      return `★ マーク${e.tag ? `：${lbl(MARK_TAGS, e.tag)}` : ''}${p ? `　#${p.num} ${family(p.name)}` : ''}${e.note ? `「${e.note}」` : ''}`; }
    case 'pkso': return `PK戦　${tn} ${e.no}人目 ${e.scored ? '○ 成功' : `× 失敗（${e.miss === 'save' ? 'セーブ' : '枠外'}）`}${e.num ? `　#${e.num} ${family(e.name)}` : ''}`;
    case 'ck': return `${tn}　${e.ckType ? lbl(CK_TYPES, e.ckType) : 'CK'}${hasDrawing(e.sketch) ? '　✏️' : ''}`;
    case 'fk': return `${tn}　${e.fkKind ? lbl(FK_KINDS, e.fkKind) : 'FK'}${e.fkPlay ? `→${lbl(FK_PLAYS, e.fkPlay)}` : ''}｜${e.zoneLabel}（ゴールまで${e.dist}m）${hasDrawing(e.sketch) ? '　✏️' : ''}`;
    case 'win': return `${tn}が奪った｜${thirdFor(e)}・${e.zoneLabel}`;
    case 'og': { const p = player(e.playerId);
      return `オウンゴール → ${teamName(m, e.team)}に1点${p ? `（#${p.num} ${family(p.name)}）` : e.oppNum ? `（相手#${e.oppNum}）` : ''}`; }
  }
  const where = e.pk ? 'PKスポット' : `${e.zoneLabel}・${AREA[e.area]}`;
  return `${tn}　${e.pk ? 'PK' : 'シュート'} → ${RES[e.result].label}｜${where}${e.foot ? `・${lbl(FEET, e.foot)}` : ''}${e.num ? `｜#${e.num} ${family(e.name)}` : ''}${e.team === 'them' && (e.oppNum || e.goal?.oppNum) ? `｜相手#${e.goal?.oppNum || e.oppNum}` : ''}${e.fromSetPiece ? `（${e.fromSetPiece.toUpperCase()}から）` : ''}`;
}
function logItem(e, m){
  const chip = ['sub','break','kickoff'].includes(e.type) ? '' : e.type === 'formation' ? '<span class="chip fm">陣形</span>' : e.type === 'og' ? `<span class="chip ${e.team}">OG</span>`
    : e.type === 'mark' ? '<span class="chip warn">★</span>' : `<span class="chip ${e.team}">${e.team==='us'?'自':'相'}</span>`;
  let btn = '', chip2 = '';
  if(isPending(e)) btn = `<button class="btn small attn" data-goaledit="${e.id}" type="button">⚽ 状況を入力</button>`;
  else if(e.type==='shot' && e.result==='goal') btn = `<button class="btn small" data-goaledit="${e.id}" type="button">状況を見る</button>`;
  else if(e.type === 'mark') btn = `<button class="btn small ${e.tag ? '' : 'attn'}" data-markedit="${e.id}" type="button">✎ ${e.tag ? '編集' : 'タグ'}</button>`;
  if(e.check) chip2 = '<span class="chip warn">？</span>';
  const ed = e.type === 'kickoff' ? '' : `<button class="x" data-edit="${e.id}" type="button" aria-label="この記録を直す・削除">✎</button>`;
  return `<li class="${['sub','break','kickoff'].includes(e.type)?'sub':''}"><span class="t">${esc(pShort(m, e.period))} ${e.type === 'pkso' ? '' : e.clock}</span>${chip}${chip2}<span class="tx" ${e.type === 'kickoff' ? '' : `data-edit="${e.id}"`}>${esc(evText(e, m))}</span>${btn}${ed}</li>`;
}

/* ---------- 記録処理 ---------- */
function baseEvent(type){
  // ピッチやボタンに最初に触れた瞬間の時刻を使う（結果を選ぶまでの数秒の遅れを入れない）
  const tp = state.ui.tapAt, useTap = tp && tp.p === state.timer.p && Date.now() - tp.wall < 60000;
  const ms = useTap ? tp.ms : liveMs(), wall = useTap ? tp.wall : Date.now();
  return { id:uid(), matchId:state.current, type, team:state.ui.team, period:state.timer.p,
           sec:Math.floor(ms/1000), clock:fmtMatch(ms, curPer()?.min), wall, synced:false, recordedAt:new Date().toISOString() };
}
// 時計が止まっていても確認は出さずに記録する（時計のまわりが点滅して知らせる）
function guardClock(fn){ fn(); }
function withPos(e, x, y){
  const z = zoneOf(x, y);
  return Object.assign(e, { x:Math.round(x*10)/10, y:Math.round(y*10)/10, zone:`${z.third}-${z.lane}`,
    zoneLabel:zoneLabel(z.third, z.lane), area:areaOf(x, y, e.team), dist:distOf(x, y, e.team) });
}
function pushEvent(e){ state.events.push(e); save.events(); return e; }
// 削除は「削除済み」の印を付けて残す（同期でスプレッドシート側からも消すため）
function removeEvent(ev){
  ev.deleted = true; ev.synced = false;
  const fm = state.fm && state.fm.matchId === ev.matchId ? fmCur() : null;
  if(fm && ev.type === 'card' && ev.sentOff){
    if(ev.team === 'us' && fm.us.slots[ev.slot] == null){ fm.us.slots[ev.slot] = ev.playerId; if(!state.lineup.includes(ev.playerId)){ state.lineup.push(ev.playerId); save.lineup(); } }
    if(ev.team === 'them' && fm.them.slots[ev.slot] == null) fm.them.slots[ev.slot] = ev.oppNum;
    save.fm();
  }
  if(fm && ev.type === 'sub' && ev.team === 'them' && fm.them.slots[ev.slot] === ev.inNum){ fm.them.slots[ev.slot] = ev.outNum; save.fm(); save.events(); return; }
  if(ev.type === 'sub' && ev.team !== 'them' && state.lineup.includes(ev.inId) && !state.lineup.includes(ev.outId)){
    state.lineup = state.lineup.map(id => id === ev.inId ? ev.outId : id); save.lineup();
    const f = fmCur(); f.us.slots = f.us.slots.map(id => id === ev.inId ? ev.outId : id); save.fm();
  }
  save.events();
}
function undo(){
  const list = evOf(state.current); const last = list[list.length - 1]; if(!last) return;
  if(last.type === 'kickoff'){ toast('キックオフは取り消せません。ピリオドの「▾」から陣地を直せます'); return; }
  if(last.synced){ toast('同期済みの記録は取り消せません'); return; }
  removeEvent(last); beep('undo'); toast(`取り消しました：${evText(last, cur())}`); render();
}

/* ---------- 時計・ピリオド ---------- */
function foldTimer(){
  const t = state.timer, m = cur();
  if(t.startedAt){ t.el[t.p] = (t.el[t.p] || 0) + Date.now() - t.startedAt; t.startedAt = null; }
  if(m && m.periods[t.p]){ m.periods[t.p].played = t.el[t.p] || 0; save.matches(); }
  save.timer();
}
let resetTimer;
function timerAction(kind){
  const t = state.timer, per = curPer();
  if(kind === 'toggle'){
    if(t.startedAt){ foldTimer(); keepAwake(false); }
    else if(!per.kickoff || !per.attack){ if(!cur().lineupSet || !state.lineup.length) starterSheet('ko'); else toast('上の 🪙 キックオフのチームと 🥅 攻める方向を選んでください'); return; }
    else if(!isStarted(cur(), t.p)){ kickOff(); return; }
    else { t.startedAt = Date.now(); keepAwake(true); }
    state.ui.resetArmed = false;
  } else if(kind === 'reset'){
    if(!state.ui.resetArmed){
      state.ui.resetArmed = true; clearTimeout(resetTimer);
      resetTimer = setTimeout(() => { state.ui.resetArmed = false; if(state.ui.screen === 'record') render(); }, 3000);
    } else { t.el[t.p] = 0; t.startedAt = null; state.ui.resetArmed = false; foldTimer(); toast(`${per.label}の時計を0:00に戻しました`); }
  }
  save.timer(); render();
}
function setPeriod(i){
  const t = state.timer; if(t.p === i){ closeSheet(); render(); return; }
  if(t.brk) endBreak(true);
  foldTimer(); keepAwake(false);
  t.p = i; save.timer(); state.ui.pos = null; closeSheet(); render();
  const per = curPer(); toast(`${per.label}に切り替えました${per.kind === 'pk' ? '' : per.kickoff ? `（${fmtClock(t.el[i] || 0)}から）` : '。上の 🪙 と 🥅 でキックオフと陣地を選びます'}`);
}
function addPeriods(kind, min){
  const m = cur(); if(!m) return;
  if(kind === 'reg'){ const n = m.periods.filter(p => p.kind === 'reg').length + 1;
    m.periods.push({ label:`${n}本目`, short:`${n}本`, min, kind:'reg', kickoff:null, attack:null, played:0 }); }
  if(kind === 'et'){ if(m.periods.some(p => p.kind === 'et')) return;
    const i = m.periods.findIndex(p => p.kind === 'pk'), et = [
      { label:'延長前半', short:'ET1', min:m.et?.min || 10, kind:'et', kickoff:null, attack:null, played:0 },
      { label:'延長後半', short:'ET2', min:m.et?.min || 10, kind:'et', kickoff:null, attack:null, played:0 }];
    if(i >= 0) m.periods.splice(i, 0, ...et); else m.periods.push(...et); }
  if(kind === 'pk'){ if(m.periods.some(p => p.kind === 'pk')) return;
    m.periods.push({ label:'PK戦', short:'PK', min:0, kind:'pk', kickoff:null, attack:null, played:0 }); }
  save.matches();
  const idx = kind === 'et' ? m.periods.findIndex(p => p.kind === 'et') : m.periods.length - 1;
  setPeriod(idx);
}
// キックオフと陣地。前のピリオドと同じ種類なら、キックオフと攻める方向を自動で入れ替えた状態から始める
function defaultKO(m, i){
  const p = m.periods[i], prev = m.periods[i-1];
  if(p.kickoff) return { team:p.kickoff, attack:p.attack };
  if(m.kind !== '公式戦') return { team:null, attack:null };   // 練習試合・紅白戦は毎回トスで決める
  if(prev && prev.kind === p.kind && prev.kickoff) return { team:prev.kickoff === 'us' ? 'them' : 'us', attack:prev.attack === 'right' ? 'left' : 'right' };
  if(prev && prev.attack) return { team:null, attack:prev.attack === 'right' ? 'left' : 'right' };
  return { team:null, attack:'right' };
}
function kickoffSheet(edit){
  const m = cur(); const i = state.timer.p;
  if(!state.ui.flow || state.ui.flow.kind !== 'ko') state.ui.flow = { kind:'ko', edit, draft:defaultKO(m, i) };
  const d = state.ui.flow.draft, per = m.periods[i], prev = m.periods[i-1];
  const auto = prev && prev.kind === per.kind && prev.kickoff && !per.kickoff;
  const dir = side => `<div class="dirpic"><b style="${side === 'left' ? 'left:12%' : 'right:12%'}">${side === 'left' ? '◀' : '▶'}</b><i style="left:4px">ベンチから見た向き</i></div>`;
  openSheet(`<h2><span class="disp" style="font-size:26px;font-weight:800;font-style:italic">🪙 COIN TOSS</span>　${esc(per.label)}のキックオフと陣地</h2>
    ${auto && m.kind === '公式戦' ? `<p style="font-size:13px">${esc(prev.label)}から自動で入れ替えました。違っていればタップで直してください。</p>` : m.kind !== '公式戦' ? '<p style="font-size:13px">練習試合は、本ごとにトスの結果を選んでください。</p>' : ''}
    <div class="q"><b>①</b> キックオフするチーム</div>
    <div class="bigchoice">
      <button type="button" data-ko="team" data-v="us" aria-pressed="${d.team==='us'}">${esc(m.ourName)}<small>キックオフ</small></button>
      <button type="button" data-ko="team" data-v="them" aria-pressed="${d.team==='them'}">${esc(m.opponent)}<small>キックオフ</small></button>
    </div>
    <div class="q"><b>②</b> ${esc(m.ourName)}が攻める方向（iPadを持っている位置から見て）</div>
    <div class="bigchoice">
      <button type="button" class="k-dir" data-ko="attack" data-v="left" aria-pressed="${d.attack==='left'}">${dir('left')}左のゴールへ攻める</button>
      <button type="button" class="k-dir" data-ko="attack" data-v="right" aria-pressed="${d.attack==='right'}">${dir('right')}右のゴールへ攻める</button>
    </div>
    <p style="font-size:12.5px">ピッチの表示がこの向きに変わります。記録データは向きをそろえて保存するので、前後半をまとめて分析できます。</p>
    <p style="font-size:13px">出場メンバー：<b>${state.lineup.length}人</b>（GK ${player(m.gk) ? `#${player(m.gk).num} ${esc(family(player(m.gk).name))}` : '未設定'}）${edit ? '' : '　<button class="btn small" data-kostarters type="button">メンバーを変える</button>'}</p>
    <div class="row"><button class="btn" data-close type="button">キャンセル</button>
      <button class="btn primary" data-kogo type="button" ${d.team && d.attack ? '' : 'disabled'}>${edit ? '保存' : '✓ READY（準備完了）'}</button></div>`);
}
function confirmKickoff(){
  const f = state.ui.flow, m = cur(), i = state.timer.p, per = m.periods[i];
  per.kickoff = f.draft.team; per.attack = f.draft.attack; save.matches();
  const ko = evOf(m.id).find(e => e.type === 'kickoff' && e.period === i);
  if(ko){ ko.team = per.kickoff; ko.attack = per.attack; ko.synced = false; save.events(); }
  closeSheet(); render();
  toast(f.edit ? 'キックオフと陣地を直しました' : '準備OK！ 笛が鳴ったら ⚽ KICK OFF');
}
// フォーメーションの記録（今の時刻で）
function formationEvent(){
  const fm = fmCur(), e = baseEvent('formation'); e.team = 'us';
  e.us = { shape:fm.us.shape, slots:slotsOf(fm.us.shape, 'us').map((sl, k) => { const p = player(fm.us.slots[k]); return { label:sl.label, playerId:p?.id ?? null, num:p?.num ?? null, name:p?.name ?? null }; }) };
  e.them = { shape:fm.them.shape || null, slots:(fm.them.slots || []).slice() };
  if(hasMoved(fm.us)) e.us.pos = JSON.parse(JSON.stringify(fm.us.pos)); if(hasMoved(fm.them)) e.them.pos = JSON.parse(JSON.stringify(fm.them.pos));
  return e;
}
function recordFormationIfStarted(){ const m = cur(); if(m && fmCur().us.shape && isStarted(m, state.timer.p)) pushEvent(formationEvent()); }
function kickOff(){
  const m = cur(), i = state.timer.p, per = m.periods[i];
  per.started = true; save.matches();
  const e = baseEvent('kickoff'); e.team = per.kickoff; e.attack = per.attack; e.lineup = state.lineup.slice(); e.gk = m.gk; e.clock = '00:00'; pushEvent(e);
  // スタメン設定の陣形を、キックオフの時刻で自動記録（前回の記録から変わっていれば）
  const fm = fmCur(), last = evOf(m.id).filter(x => x.type === 'formation').pop();
  const same = last && last.us.shape === fm.us.shape && (last.them.shape || null) === (fm.them.shape || null)
    && last.us.slots.map(x => x.playerId).join() === fm.us.slots.join() && (last.them.slots || []).join() === (fm.them.slots || []).join() && JSON.stringify(last.us.pos || null) === JSON.stringify(hasMoved(fm.us) ? fm.us.pos : null);
  if(fm.us.shape && !same){ const fe = formationEvent(); fe.clock = '00:00'; pushEvent(fe); }
  state.timer.startedAt = Date.now(); save.timer(); keepAwake(true);
  toast(`⚽ KICK OFF！ ${per.label}スタート`); render();
}
/* ---------- キックオフ前：上の段で「キックオフのチーム」「攻める方向」を選んで、そのまま KICK OFF ---------- */
const COIN_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="url(#cg)" stroke="#9a430f" stroke-width="1.2"/><circle cx="12" cy="12" r="6.6" fill="none" stroke="#fff3" stroke-width="1.4"/><path d="M12 7.6l1.3 2.7 3 .4-2.2 2.1.5 3-2.6-1.4-2.6 1.4.5-3-2.2-2.1 3-.4z" fill="#fff8"/><defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd1a6"/><stop offset=".45" stop-color="#ff9a4d"/><stop offset="1" stop-color="#b8541a"/></linearGradient></defs></svg>';
const dirSVG = a => `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="${a === 'left' ? 1.5 : 18.5}" y="6" width="4" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="1.8"/>
  <path d="${a === 'left' ? 'M20 12H8m4-4-4 4 4 4' : a === 'right' ? 'M4 12h12m-4-4 4 4-4 4' : 'M5 12h10'}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
function koInlineHTML(m, per){
  const i = state.timer.p;
  if(!per.kickoff && !per.attack && !per.koAuto){ const d = defaultKO(m, i); if(d.team || d.attack){ per.kickoff = d.team; per.attack = d.attack; per.koAuto = true; save.matches(); } }
  const ready = per.kickoff && per.attack;
  return `<div class="koinline">
    <label class="kosel ${per.kickoff ? 'set' : ''}" title="キックオフするチーム"><span class="ic">${COIN_SVG}</span>
      <select data-koteam aria-label="キックオフするチーム"><option value="" ${per.kickoff ? '' : 'selected'}>キックオフ</option>
        <option value="us" ${per.kickoff === 'us' ? 'selected' : ''}>${esc(m.ourName)}</option><option value="them" ${per.kickoff === 'them' ? 'selected' : ''}>${esc(m.opponent)}</option></select></label>
    <label class="kosel ${per.attack ? 'set' : ''}" title="${esc(m.ourName)}が攻める方向（iPadを持っている位置から見て）"><span class="ic dir">${dirSVG(per.attack)}</span>
      <select data-koattack aria-label="${esc(m.ourName)}が攻める方向"><option value="" ${per.attack ? '' : 'selected'}>攻める方向</option>
        <option value="right" ${per.attack === 'right' ? 'selected' : ''}>右へ攻める</option><option value="left" ${per.attack === 'left' ? 'selected' : ''}>左へ攻める</option></select></label>
    <button class="tbtn ${ready ? 'kick' : 'kickoff-wait'}" data-kogoinline type="button" ${ready ? '' : 'disabled'}>⚽ KICK OFF</button>
  </div>`;
}
document.addEventListener('change', e => {
  const el = e.target; if(!('koteam' in el.dataset) && !('koattack' in el.dataset)) return;
  const m = cur(), per = curPer(); if(!m || !per) return;
  if('koteam' in el.dataset) per.kickoff = el.value || null; else per.attack = el.value || null;
  per.koAuto = true; save.matches(); render();
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-kogoinline]'); if(!b || b.disabled) return;
  const m = cur(), per = curPer(); if(!m || !per?.kickoff || !per.attack) return;
  if(!m.lineupSet || !state.lineup.length){ starterSheet('ko'); return; }
  markTapTime(); kickOff();
});
function periodSheet(){
  const m = cur(), ev = evOf(m.id), t = state.timer;
  const hasEt = m.periods.some(p => p.kind === 'et'), hasPk = m.periods.some(p => p.kind === 'pk');
  const official = m.kind === '公式戦';
  openSheet(`<h2>ピリオドの切り替え <span class="muted" style="font-size:13px;font-weight:700">${official ? 'ハーフ・延長・PK戦' : '練習試合は本数を追加できます'}</span></h2>
    <div class="perlist">${m.periods.map((p, i) => { const pe = ev.filter(e => e.period === i);
      const played = i === t.p ? liveMs() : (p.played || 0);
      return `<button type="button" data-setp="${i}" aria-pressed="${i===t.p}">
        <span class="disp">${esc(p.label)}</span>
        <span class="muted" style="font-size:12.5px">${p.kind === 'pk' ? 'PK戦' : `${p.min}分・${p.kickoff ? `${p.attack === 'left' ? '◀ 左へ攻める' : '右へ攻める ▶'}` : 'キックオフ前'}`}</span>
        <span class="num" style="font-size:18px">${p.kind === 'pk' ? '' : fmtClock(played)}</span>
        <span class="num" style="font-size:20px">${p.kind === 'pk' ? (() => { const s = pkState(m, ev); return `${s.a}-${s.b}`; })() : `${goalsOf(pe,'us')}-${goalsOf(pe,'them')}`}</span></button>`; }).join('')}</div>
    ${official ? `<div class="addrow">
        <button class="btn small" data-addet type="button" ${hasEt ? 'disabled' : ''}>＋ 延長戦（前後半 各${m.et?.min || 10}分）</button>
        <button class="btn small" data-addpk type="button" ${hasPk ? 'disabled' : ''}>＋ PK戦</button>
        ${!m.et?.enabled && !hasEt ? '<span class="muted" style="font-size:12px">この試合は延長なしの設定です</span>' : ''}</div>`
      : `<div class="addrow"><span class="q">＋ 次の本を追加：</span>${[10,15,20,25,30].map(n => `<button class="btn small" data-addp="${n}" type="button">${n}分</button>`).join('')}</div>`}
    <div class="row">
      ${curPer().kickoff && curPer().kind !== 'pk' ? '<button class="btn small" data-koedit type="button">🪙 キックオフ・陣地を直す</button>' : ''}
      <button class="btn small" data-recorders type="button">✍️ 記録者（${(m.recorders || []).length}人）</button>
      <span style="flex:1"></span><button class="btn danger" data-endmatch type="button">試合を終了</button><button class="btn" data-close type="button">閉じる</button></div>`, 'wide');
}

/* ---------- 飲水タイム・クーリングブレイク（時計を止めて、休んだ時間を記録） ---------- */
function breakSheet(){
  openSheet(`<h2>💧 飲水タイム・クーリングブレイク</h2>
    <p style="font-size:13px">試合の時計は動いたままです。休んでいる時間を別に測り、「終了」でログに残します。</p>
    <div class="bigchoice">
      <button type="button" data-brk="water">💧 飲水タイム<small>目安 1分</small></button>
      <button type="button" data-brk="cool">🧊 クーリングブレイク<small>目安 3分・日陰で体を冷やす</small></button>
    </div>
    <div class="row"><button class="btn" data-close type="button">キャンセル</button></div>`);
}
// 給水中も試合の時計は止めない（休んだ時間だけを別に測って記録）
function startBreak(type){
  const t = state.timer; if(t.brk) return;
  const ms = liveMs();
  t.brk = { type, startWall:Date.now(), sec:Math.floor(ms/1000), clock:fmtMatch(ms, curPer()?.min) }; save.timer();
  keepAwake(true); closeSheet(); render();
}
function endBreak(silent){
  const t = state.timer, b = t.brk; if(!b) return;
  const dur = Math.round((Date.now() - b.startWall) / 1000);
  pushEvent({ id:uid(), matchId:state.current, type:'break', kind:b.type, team:'us', period:t.p, sec:b.sec, clock:b.clock,
              wall:b.startWall, dur, synced:false, recordedAt:new Date().toISOString() });
  t.brk = null; save.timer();
  if(!silent){ toast(`${BREAKS[b.type].label}（${fmtDur(dur)}）を記録しました`); render(); }
}
function updateClock(){
  const ms = liveMs(), m = cur(), per = curPer();
  const over = per && per.kind !== 'pk' && ms >= per.min * 60000;
  const el = document.querySelector('[data-clock]');
  if(el && per && per.kind !== 'pk'){ el.textContent = over ? fmtClock(per.min * 60000) : fmtClock(ms); el.classList.toggle('over', !!over); }
  const at = document.querySelector('[data-atset]'); if(at){ at.hidden = !over; at.textContent = per?.at ? `AT+${per.at}` : 'AT'; }
  const atv = document.querySelector('[data-atv]');
  if(atv){ if(!over) atv.textContent = '';
    else if(per.at){ const left = per.min * 60000 + per.at * 60000 - ms; atv.textContent = left > 0 ? `残り${fmtClock(left).replace(/^0/, '')}` : `+${fmtClock(-left).replace(/^0/, '')}超過`; atv.classList.toggle('late', left <= 0); }
    else atv.textContent = `+${fmtClock(ms - per.min * 60000).replace(/^0/, '')}`; }
  // 規定時間を過ぎたら「○○終了」ボタンを出す（長押しで次のピリオドへ）
  const ep = document.querySelector('[data-endper]'); if(ep) ep.hidden = !(over && m && isStarted(m, state.timer.p));
  const vc = document.querySelector('[data-vclock]'); if(vc && m?.videoStart) vc.textContent = fmtClock(Date.now() - m.videoStart);
  // 選手を選ぶ案内・★タグの表示時間が切れたら下の1行を戻す
  const pk = state.ui.pick, mt = state.ui.markTag;
  if((pk && Date.now() >= pk.until) || (mt && Date.now() >= mt.until)){ if(pk && Date.now() >= pk.until) state.ui.pick = null; if(mt && Date.now() >= mt.until) state.ui.markTag = null; if(state.ui.screen === 'record' && !state.ui.pop) render(); }
  syncWarn();
  const b = state.timer.brk, be = document.querySelector('[data-brk]');
  if(b && be){ const s = Math.floor((Date.now() - b.startWall) / 1000); be.textContent = `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
    $('#brkbar')?.classList.toggle('over', s >= BREAKS[b.type].min * 60); }
  const mini = $('#miniTimer'); const show = !!(m && state.timer.startedAt) && state.ui.screen !== 'record';
  mini.hidden = !show; if(show) mini.textContent = `${b ? BREAKS[b.type].icon + ' ' : '⏱ '}${per.label} ${fmtMatch(ms, per.min)}`;
}
setInterval(updateClock, 250);

