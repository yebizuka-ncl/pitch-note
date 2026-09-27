"use strict";
/* =========================================================
   8. シート
   ========================================================= */
function openSheet(html, size){ const s = $('#sheet'); s.className = 'sheet' + (size ? ' ' + size : ''); s.innerHTML = html; $('#scrim').hidden = false; }
function closeSheet(){ $('#scrim').hidden = true; state.ui.flow = null; state.ui.modal = null; }
function openModal({ title, body, actions, size }){
  state.ui.modal = actions;
  openSheet(`<h2>${title}</h2>${body}<div class="row">${actions.map((a,i) => `<button class="btn ${a.kind||''}" data-mi="${i}" type="button">${a.label}</button>`).join('')}</div>`, size);
}
const chipsHTML = (items, key, sel) => `<div class="chips">${items.map(o => `<button type="button" data-g="${key}" data-v="${o.id}" aria-pressed="${sel===o.id}">${o.label}${o.hint ? `<small>${o.hint}</small>` : ''}</button>`).join('')}</div>`;
const numGrid = (key, sel) => `<div class="numgrid">${Array.from({ length:30 }, (_, i) => i + 1).map(n => `<button type="button" data-g="${key}" data-v="${n}" aria-pressed="${sel===n}">${n}</button>`).join('')}</div>`;
const teamChips = (m, sel) => chipsHTML([{ id:'us', label:m.ourName }, { id:'them', label:m.opponent }], 'team', sel);
/* ---------- スタメン（ピリオド開始前ならいつでも変更できる） ---------- */
/* ---------- スタメン設定：① フォーメーション → ② 選手をポジションに配置 ---------- */
function starterSheet(then){
  const m = cur(); if(!m) return;
  if(!state.ui.flow || state.ui.flow.kind !== 'starters'){
    const fm = fmCur();
    const shape = fm.us.shape || m.prevFm?.shape || null;
    let slots = (fm.us.shape === shape ? fm.us.slots : []).map(id => player(id)?.status === 'present' ? id : null);
    if(!slots.some(Boolean) && state.lineup.length && shape){ slots = []; }
    while(slots.length < 11) slots.push(null);
    state.ui.flow = { kind:'starters', then, step:shape && slots.some(Boolean) ? 2 : 1, shape, them:fm.them.shape, slots:slots.slice(0, 11), selP:null, selS:null };
  }
  const f = state.ui.flow, per = curPer();
  const steps = `<div class="fmtabs" role="group" aria-label="手順">
      <button type="button" data-ststep="1" aria-pressed="${f.step===1}" data-fmteam="x">① フォーメーション <b>${f.shape || '—'}</b></button>
      <button type="button" data-ststep="2" aria-pressed="${f.step===2}" data-fmteam="x" ${f.shape ? '' : 'disabled'}>② 選手の配置 <b>${f.slots.filter(Boolean).length}/11</b></button></div>`;
  if(f.step === 1){
    openSheet(`<h2>👥 ${esc(per.label)}のスタメン設定</h2>${steps}
      <div class="st1">
        <div class="fmgroups">
          ${FM_GROUPS.map(([g, list]) => `<div class="g"><span>${g}</span><div class="chips fmc">${list.map(k => `<button type="button" data-stshape="${k}" aria-pressed="${f.shape===k}">${k}</button>`).join('')}</div></div>`).join('')}
          <label class="field" style="margin-top:8px">相手のフォーメーション（わかれば）
            <select id="stThem"><option value="">不明</option>${Object.keys(FORMATIONS).map(k => `<option ${f.them===k?'selected':''}>${k}</option>`).join('')}</select></label>
        </div>
        <div>${f.shape ? boardHTML({ m, usShape:f.shape, usPlayers:[], full:true }) : '<div class="empty">左からフォーメーションを選ぶと、ここに形が出ます</div>'}</div>
      </div>
      <div class="row"><button class="btn" data-close type="button">閉じる</button><button class="btn primary" data-stnext type="button" ${f.shape ? '' : 'disabled'}>次へ：選手を配置 ▶</button></div>`, 'xwide');
    return;
  }
  const sl = slotsOf(f.shape, 'us'), assigned = new Map(f.slots.map((id, i) => [id, i]).filter(([id]) => id));
  const ord = { GK:0, DF:1, MF:2, FW:3 };
  const ps = present().slice().sort((a,b) => (ord[posOf(a) || 'MF'] - ord[posOf(b) || 'MF']) || a.num - b.num);
  const n = f.slots.filter(Boolean).length, gkOk = !!f.slots[0];
  const hint = f.selP ? `#${player(f.selP).num} ${esc(family(player(f.selP).name))} を置くポジションを選んでください` : f.selS != null ? `${sl[f.selS].full} に入る選手を選んでください` : '選手 → ポジションの順にタップ（逆でもOK）';
  openSheet(`<h2>👥 ${esc(per.label)}のスタメン設定 <span class="muted" style="font-size:13px;font-weight:800">${hint}</span></h2>${steps}
    <div class="stwrap">
      ${boardHTML({ m, usShape:f.shape, usPlayers:f.slots.map(player), interactive:true, slotAttr:'stslot', sel:f.selS, full:true })}
      <div class="stlist"><div class="q">選手（参加 ${ps.length}人）</div>
        ${ps.map(p => { const i = assigned.get(p.id); return `<button type="button" data-stp="${p.id}" aria-pressed="${f.selP===p.id}" class="${i != null ? 'on' : ''}">
          <span class="jersey">${p.num}</span><span class="nm">${esc(family(p.name))}${posOf(p) ? ` <span class="ptag">${posOf(p)}</span>` : ''}</span><em>${i != null ? sl[i].full : 'ベンチ'}</em></button>`; }).join('')}</div>
      <div class="stlist"><div class="q">ポジション</div>
        ${sl.map((s, i) => { const p = player(f.slots[i]); return `<button type="button" data-stslot="${i}" aria-pressed="${f.selS===i}" class="${p ? 'on' : 'open'}">
          <b>${s.full}</b><em>${p ? `#${p.num} ${esc(family(p.name))}` : '空き'}</em></button>`; }).join('')}
        <button type="button" class="bench" data-stbench ${f.selP && assigned.has(f.selP) ? '' : 'disabled'}>ベンチへ戻す</button></div>
    </div>
    <div class="row"><button class="btn small" data-stauto type="button">ポジションから自動で並べる</button>
      ${m.prevFm?.shape === f.shape ? '<button class="btn small" data-stprev type="button">前の試合と同じ</button>' : ''}
      <button class="btn small" data-stclear type="button">全部外す</button><span style="flex:1"></span>
      <span class="stcount ${n === 11 ? 'ok' : 'ng'}">${n}<small style="font-size:15px"> / 11</small></span>
      <button class="btn" data-close type="button">閉じる</button>
      <button class="btn primary" data-stok type="button" ${gkOk && n >= 7 ? '' : 'disabled'}>${f.then === 'ko' ? '決定してキックオフ設定へ' : '決定'}</button></div>`, 'xwide');
}
function stAssign(pid, i){
  const f = state.ui.flow, k = f.slots.indexOf(pid);
  if(k >= 0) f.slots[k] = f.slots[i];   // すでに別のポジションにいる選手なら入れ替え
  f.slots[i] = pid; f.selP = null; f.selS = null;
}
function stAuto(){
  const f = state.ui.flow, sl = slotsOf(f.shape, 'us');
  const pool = present().slice().sort((a,b) => b.grade - a.grade || a.num - b.num);
  const used = new Set(f.slots.filter(Boolean));
  sl.forEach((s, i) => { if(f.slots[i]) return;
    const p = pool.find(x => !used.has(x.id) && (posOf(x) || 'MF') === s.group); if(p){ f.slots[i] = p.id; used.add(p.id); } });
  sl.forEach((s, i) => { if(f.slots[i] || s.group === 'GK') return;
    const p = pool.find(x => !used.has(x.id) && posOf(x) !== 'GK'); if(p){ f.slots[i] = p.id; used.add(p.id); } });
}
function confirmStarters(){
  const f = state.ui.flow, m = cur(), fm = fmCur();
  const sel = f.slots.filter(Boolean);
  state.lineup = sel; save.lineup();
  m.lineupSet = true; m.gk = f.slots[0]; save.matches();
  fm.us.shape = f.shape; fm.us.slots = f.slots.slice(); fm.them.shape = f.them || null;
  if(fm.them.shape && fm.them.slots[0] == null) fm.them.slots[0] = 1;
  save.fm();
  const then = f.then; state.ui.flow = null;
  if(sel.length < 11) toast(`${sel.length}人で登録しました`);
  if(then === 'ko') kickoffSheet(false); else { closeSheet(); render(); }
}
function openEdit(id){
  const e = state.events.find(x => x.id === id); if(!e || e.type === 'kickoff') return;
  if(e.type === 'mark'){ openMark(id); return; }
  const sec = e.sec || 0;
  state.ui.flow = { kind:'edit', eventId:id, draft:{ period:e.period, mm:Math.floor(sec/60), ss:sec % 60, team:e.team, result:e.result, foot:e.foot ?? null,
    playerId:e.playerId ?? null, ckType:e.ckType ?? null, fkKind:e.fkKind ?? null, fkPlay:e.fkPlay ?? null, oppNum:e.oppNum ?? null } };
  renderSheet();
}
function saveEdit(){
  const f = state.ui.flow, d = f.draft, e = state.events.find(x => x.id === f.eventId); if(!e) return;
  const m = match(e.matchId), per = m.periods[d.period];
  e.period = d.period; e.sec = Math.max(0, (parseInt(d.mm, 10) || 0) * 60 + (parseInt(d.ss, 10) || 0));
  if(e.type !== 'pkso') e.clock = fmtMatch(e.sec * 1000, per?.min);
  if(['shot','ck','fk','og'].includes(e.type)) e.team = d.team;
  if(e.x != null && e.type !== 'ck'){ e.area = e.pk ? 'PA' : areaOf(e.x, e.y, e.team); e.dist = distOf(e.x, e.y, e.team); }
  if(e.type === 'shot'){
    if(e.result === 'goal' && d.result !== 'goal') e.goal = null;
    e.result = d.result; e.foot = d.foot;
    const p = e.team === 'us' ? player(d.playerId) : null;
    Object.assign(e, { playerId:p?.id ?? null, num:p?.num ?? null, name:p?.name ?? null, grade:p?.grade ?? null });
  }
  if(e.type === 'ck' && d.ckType){ const t = CK_TYPES.find(x => x.id === d.ckType); Object.assign(e, { ckType:t.id, side:t.side, style:t.style }); }
  if(e.type === 'fk'){ e.fkKind = d.fkKind; e.fkPlay = d.fkPlay; }
  if(e.type === 'og'){ e.playerId = e.team === 'them' ? d.playerId : null; e.oppNum = e.team === 'us' ? d.oppNum : null; }
  e.synced = false; save.events(); closeSheet(); toast('記録を直しました'); render();
}
function openGoal(id){
  const e = state.events.find(x => x.id === id); if(!e) return;
  const g = e.goal || {};
  state.ui.flow = { kind:'goal', eventId:id, draft:{ phase:g.phase ?? (e.fromSetPiece ? 'setpiece' : null), detail:g.detail ?? (e.fromSetPiece === 'ck' ? 'ck' : null),
    originZone:g.originZone ?? null, lastPass:g.lastPass ?? null, lane:g.lane ?? (e.zone ? +e.zone.split('-')[1] : null),
    foot:g.foot ?? e.foot ?? null, touch:g.touch ?? null, assistId:g.assistId ?? null, oppNum:g.oppNum ?? e.oppNum ?? null } };
  renderSheet();
}
function openMark(id){
  const e = state.events.find(x => x.id === id); if(!e) return;
  state.ui.flow = { kind:'mark', eventId:id, draft:{ tag:e.tag, playerId:e.playerId, note:e.note || '' } };
  renderSheet();
}
function renderSheet(){
  const f = state.ui.flow; if(!f) return;
  if(f.kind === 'ko'){ kickoffSheet(f.edit); return; }
  if(f.kind === 'starters'){ starterSheet(f.then); return; }
  if(f.kind === 'pmenu'){ openSheet(playerMenuHTML(), f.side === 'them' && (f.mode === 'num' || f.mode === 'oppsub') ? 'wide' : ''); return; }
  if(f.kind === 'ck'){
    const m = cur(), d = f.draft;
    openSheet(`<h2><span class="chip ${d.team}">${esc(teamName(m, d.team))}</span>CK</h2>
      <p style="font-size:13px">左右は「${esc(teamName(m, d.team))}が攻める向き」で見た左・右です。${d.side ? 'タップした位置から推定した方を光らせています。' : ''}</p>
      <div class="bigchoice">${CK_TYPES.map(t => `<button type="button" class="k-dir" data-ckt="${t.id}" aria-pressed="${d.side === t.side && t.style === 'cross'}">${t.side === 'L' ? '◀ 左' : '右 ▶'}CK<small>${t.style === 'cross' ? 'クロス（ゴール前へ）' : 'ショートコーナー'}</small></button>`).join('')}</div>
      <div class="row"><button class="btn" data-close type="button">キャンセル</button></div>`);
    return;
  }
  if(f.kind === 'fk'){
    const m = cur(), d = f.draft, z = zoneOf(d.x, d.y);
    openSheet(`<h2><span class="chip ${d.team}">${esc(teamName(m, d.team))}</span>FK</h2>
      <p style="font-size:13px">${zoneLabel(z.third, z.lane)}・${AREA[areaOf(d.x, d.y, d.team)]}・ゴールまで${distOf(d.x, d.y, d.team)}m</p>
      <div class="q">種類</div>${chipsHTML(FK_KINDS, 'fkKind', d.fkKind)}
      <div class="q">どうした？</div>
      <div class="bigchoice" style="grid-template-columns:repeat(3,1fr)">${FK_PLAYS.map(x => `<button type="button" data-fkp="${x.id}">${x.label}<small>${x.id === 'shot' ? '→ このまま結果を選ぶ' : x.id === 'cross' ? 'ゴール前へ入れた' : '近くの味方へ'}</small></button>`).join('')}</div>
      <div class="row"><button class="btn" data-close type="button">キャンセル</button></div>`);
    return;
  }
  if(f.kind === 'og'){
    const m = cur(), d = f.draft, on = state.lineup.map(player).filter(Boolean);
    openSheet(`<h2>⚽ オウンゴール</h2>
      <div class="q">得点が入ったチーム</div>
      <div class="bigchoice">
        <button type="button" data-g="team" data-v="us" aria-pressed="${d.team==='us'}">${esc(m.ourName)}に1点<small>相手のオウンゴール</small></button>
        <button type="button" data-g="team" data-v="them" aria-pressed="${d.team==='them'}">${esc(m.opponent)}に1点<small>自チームのオウンゴール</small></button>
      </div>
      ${d.team === 'them' ? `<div class="q">ゴールに入ってしまった選手 <span class="muted">（任意）</span></div>
        <div class="chips">${on.map(p => `<button type="button" data-g="playerId" data-v="${p.id}" aria-pressed="${d.playerId===p.id}">#${p.num} ${esc(family(p.name))}</button>`).join('')}</div>`
        : `<div class="q">相手の選手の背番号 <span class="muted">（任意）</span></div>${numGrid('oppNum', d.oppNum)}`}
      <p style="font-size:12.5px">スコアには入りますが、シュート数には数えません。</p>
      <div class="row"><button class="btn" data-close type="button">キャンセル</button><button class="btn primary" data-ogok type="button">記録する</button></div>`);
    return;
  }
  if(f.kind === 'edit'){
    const e = state.events.find(x => x.id === f.eventId); if(!e){ closeSheet(); return; }
    const m = match(e.matchId), d = f.draft;
    const ps = present().slice().sort((a,b) => a.num - b.num);
    let fields = '';
    if(['shot','ck','fk','og'].includes(e.type)) fields += `<span class="q">チーム</span>${teamChips(m, d.team)}`;
    if(e.type === 'shot'){
      fields += `<span class="q">結果</span>${chipsHTML(RESULTS.filter(r => !e.pk || r.id !== 'block'), 'result', d.result)}<span class="q">足</span>${chipsHTML(FEET, 'foot', d.foot)}`;
      if(d.team === 'us') fields += `<span class="q">打った選手</span><div class="chips">${ps.map(p => `<button type="button" data-g="playerId" data-v="${p.id}" aria-pressed="${d.playerId===p.id}">#${p.num} ${esc(family(p.name))}</button>`).join('')}</div>`;
    }
    if(e.type === 'ck') fields += `<span class="q">CKの種類</span>${chipsHTML(CK_TYPES, 'ckType', d.ckType)}`;
    if(e.type === 'fk') fields += `<span class="q">種類</span>${chipsHTML(FK_KINDS, 'fkKind', d.fkKind)}<span class="q">どうした？</span>${chipsHTML(FK_PLAYS, 'fkPlay', d.fkPlay)}`;
    if(e.type === 'og') fields += d.team === 'them'
      ? `<span class="q">自チームの選手</span><div class="chips">${ps.map(p => `<button type="button" data-g="playerId" data-v="${p.id}" aria-pressed="${d.playerId===p.id}">#${p.num} ${esc(family(p.name))}</button>`).join('')}</div>`
      : `<span class="q">相手の背番号</span>${numGrid('oppNum', d.oppNum)}`;
    openSheet(`<h2>✎ 記録を直す</h2>
      <p style="font-size:13px">${esc(evText(e, m))}</p>
      <div class="editgrid">
        <span class="q">時刻</span>
        <div class="timeedit"><select id="edPer">${m.periods.map((p, i) => `<option value="${i}" ${i===d.period?'selected':''}>${esc(p.label)}</option>`).join('')}</select>
          <input id="edMm" type="number" inputmode="numeric" min="0" value="${d.mm}">分<input id="edSs" type="number" inputmode="numeric" min="0" max="59" value="${d.ss}">秒
          <span class="muted" style="font-size:12px">ATは続けて数えます（例：31分12秒 → 30+1:12）</span></div>
        ${fields}
      </div>
      <div class="row"><button class="btn danger" data-eddel type="button">この記録を削除</button><span style="flex:1"></span>
        ${e.type === 'shot' && e.result === 'goal' ? `<button class="btn" data-goaledit="${e.id}" type="button">⚽ 得点の状況</button>` : ''}
        <button class="btn" data-close type="button">キャンセル</button><button class="btn primary" data-edsave type="button">保存</button></div>`, 'wide');
    return;
  }
  if(f.kind === 'shot' && f.step === 'result'){
    const m = cur(), d = f.draft, z = zoneOf(d.x, d.y);
    const where = d.pk ? 'PK' : `${zoneLabel(z.third, z.lane)}・${AREA[areaOf(d.x,d.y,d.team)]}（${distOf(d.x,d.y,d.team)}m）`;
    openSheet(`<h2><span class="chip ${d.team}">${esc(teamName(m, d.team))}</span>${d.pk ? 'PK' : 'シュート'}の結果は？</h2>
      <p style="font-size:13px">${esc(where)}${d.fromFk ? '（FKから直接）' : ''}</p>
      <div class="q">足 <span class="muted">（任意・先に選んでから結果をタップ）</span></div>${chipsHTML(FEET, 'foot', d.foot)}
      <div class="res">${(d.pk ? RESULTS.filter(r => r.id !== 'block') : RESULTS).map(r => `<button type="button" data-res="${r.id}"><span class="en">${r.en}</span>${r.label}${r.sub ? `<small>${r.sub}</small>` : ''}</button>`).join('')}</div>
      <div class="row"><button class="btn" data-close type="button">キャンセル</button></div>`);
    return;
  }
  if(f.kind === 'shot' && f.step === 'shooter'){
    const m = cur(), d = f.draft, fm = fmCur(), us = d.team === 'us';
    const sl = fm[d.team].shape ? slotsOf(fm[d.team].shape, d.team) : [];
    let body;
    if(us){
      const list = fm.us.shape ? fm.us.slots.map((id, i) => ({ p:player(id), lab:sl[i]?.label })).filter(x => x.p) : state.lineup.map(id => ({ p:player(id), lab:posOf(player(id)) })).filter(x => x.p);
      body = `<div class="pgrid">${list.map(x => `<button type="button" data-shooter="${x.p.id}"><span class="jersey">${x.p.num}</span>${esc(family(x.p.name))}<span class="ptag" style="margin-left:auto">${x.lab || ''}</span></button>`).join('')}</div>`;
    } else {
      const list = fm.them.slots.map((n, i) => ({ n, lab:sl[i]?.label })).filter(x => x.n != null);
      body = (list.length ? `<div class="pgrid">${list.map(x => `<button type="button" data-shooternum="${x.n}"><span class="jersey opp">${x.n}</span>${x.lab || ''}</button>`).join('')}</div>` : '')
        + `<div class="q">${list.length ? '上にいない番号' : '背番号'}</div><div class="numgrid">${Array.from({ length:40 }, (_, k) => k + 1).map(k => `<button type="button" data-shooternum="${k}">${k}</button>`).join('')}</div>`;
    }
    openSheet(`<h2><span class="chip ${d.team}">${esc(teamName(m, d.team))}</span>打った選手は？</h2>
      <p style="font-size:13px">結果：${RES[f.draft.result].label}。わからなければ「スキップ」で大丈夫です。</p>
      ${body}
      <div class="row"><button class="btn" data-close type="button">キャンセル</button><button class="btn primary" data-shooter="" type="button">スキップして記録</button></div>`, us ? '' : 'wide');
    return;
  }
  if(f.kind === 'mark'){
    const e = state.events.find(x => x.id === f.eventId); if(!e){ closeSheet(); return; }
    const m = match(e.matchId), d = f.draft, vt = videoTime(e);
    const ps = (state.current === e.matchId ? state.lineup.map(player) : present()).filter(Boolean);
    openSheet(`<h2>★ 動画メモ　<span class="disp" style="font-size:24px;font-weight:800">${esc(pShort(m, e.period))} ${e.clock}</span>
        ${vt ? `<span class="muted" style="font-size:13px;font-weight:700">動画ではキックオフから約 <b class="num" style="font-size:17px">${vt}</b>（少し前から見るのがおすすめ）</span>` : ''}</h2>
      <div class="q">どんな場面？</div>${chipsHTML(MARK_TAGS, 'tag', d.tag)}
      <div class="q">関わった選手 <span class="muted">（任意）</span></div>
      <div class="chips">${ps.map(p => `<button type="button" data-g="playerId" data-v="${p.id}" aria-pressed="${d.playerId===p.id}">#${p.num} ${esc(family(p.name))}</button>`).join('')}</div>
      <label class="field">ひとことメモ <span class="muted" style="font-weight:600">（任意・あとで入力してもOK）</span><input id="markNote" value="${esc(d.note)}" placeholder="例：右サイドの3人目の動き" autocomplete="off"></label>
      <div class="row"><button class="btn danger" data-mdel type="button">マークを削除</button><span style="flex:1"></span><button class="btn" data-close type="button">閉じる</button><button class="btn primary" data-msave type="button">保存</button></div>`);
    return;
  }
  if(f.kind === 'goal'){
    const e = state.events.find(x => x.id === f.eventId); if(!e){ closeSheet(); return; }
    const m = match(e.matchId), d = f.draft, us = e.team === 'us', sp = d.phase === 'setpiece';
    const flip = flipOf(m, e.period);
    const lanes = flip ? LANES.slice().reverse() : LANES, thirds = flip ? THIRDS.slice().reverse() : THIRDS;
    const assists = (state.current === e.matchId ? state.lineup : []).map(player).filter(p => p && p.id !== e.playerId);
    openSheet(`<h2><span class="chip ${e.team}">${us ? '得点' : '失点'}</span><span class="disp" style="font-size:24px;font-weight:800">${esc(pShort(m, e.period))} ${e.clock}</span>
        ${e.num ? `#${e.num} ${esc(family(e.name))}` : ''}<span class="chip ctx">${goalContext(e)}</span></h2>
      <div class="gsheet">
        <section>
          <div class="q"><b>①</b> 局面 <span class="muted">（必須）</span></div>
          ${chipsHTML(PHASES, 'phase', d.phase)}
          ${d.phase ? `<div class="q"><b>①-2</b> ${sp ? 'セットプレーの種類 <span class="muted">（必須）</span>' : (us ? 'ボールを得た方法' : '相手にボールを渡した形')}</div>
            ${chipsHTML(sp ? SP_DETAILS : WIN_DETAILS, 'detail', d.detail)}` : ''}
          ${d.phase && !sp ? `<div class="q"><b>①-3</b> ${us ? 'ボールを得た場所' : 'ボールを失った場所'} <span class="muted">（そのときのピッチの見た目と同じ向き）</span></div>
            <div class="mgrid">${lanes.map((l,r) => thirds.map((t,c) => { const k = `${t.id}-${l.id}`;
              return `<button type="button" data-g="originZone" data-v="${k}" class="${t.id==='A'&&l.id>=2&&l.id<=4?'v':''}" style="grid-row:${r+1};grid-column:${c+1}" aria-pressed="${d.originZone===k}">${t.short}<br>${l.short}</button>`; }).join('')).join('')}</div>` : ''}
        </section>
        <section>
          <div class="q"><b>②</b> 崩し方（ラストパス） <span class="muted">（必須）</span></div>
          ${chipsHTML(LASTPASS, 'lastPass', d.lastPass)}
          <div class="q"><b>②-2</b> どのレーンで崩した？ <span class="muted">（${us ? '自チーム' : '相手'}が攻める向きで）</span></div>
          <div class="lanebtns">${LANES.map(l => `<button type="button" data-g="lane" data-v="${l.id}" aria-pressed="${d.lane===l.id}">${l.short}</button>`).join('')}</div>
          <div class="q"><b>③</b> フィニッシュ</div>
          ${chipsHTML(FEET, 'foot', d.foot)}
          ${chipsHTML(TOUCH, 'touch', d.touch)}
          ${!us ? `<div class="q">相手の得点者（背番号） <span class="muted">（任意）</span></div>${numGrid('oppNum', d.oppNum)}` : ''}
          ${us && assists.length ? `<div class="q">アシスト <span class="muted">（任意）</span></div>
            <div class="chips">${assists.map(p => `<button type="button" data-g="assistId" data-v="${p.id}" aria-pressed="${d.assistId===p.id}">#${p.num} ${esc(family(p.name))}</button>`).join('')}</div>` : ''}
        </section>
      </div>
      <div class="row"><button class="btn" data-glater type="button">あとで入力</button><button class="btn primary" data-gsave type="button">保存</button></div>`, 'xwide');
  }
}
function membersSheet(){
  ensureLineup();
  const per = curPer();
  if(per && per.kind !== 'pk' && !isStarted(cur(), state.timer.p)){ state.ui.flow = null; starterSheet(null); return; }
  state.ui.flow = null; batchSubSheet(); return;
  const on = state.lineup.map(player).filter(Boolean);
  const bench = present().filter(p => !state.lineup.includes(p.id)).sort((a,b) => a.num - b.num);
  openSheet(`<h2>👥 メンバー・交代</h2>
    <div class="q">出場中 ${on.length}名</div>
    <div class="onlist">${on.map(p => `<span>#${p.num} ${esc(p.name)}</span>`).join('')}</div>
    <div class="q">ベンチ ${bench.length}名</div>
    <div class="onlist">${bench.length ? bench.map(p => `<span>#${p.num} ${esc(p.name)}</span>`).join('') : '<span class="muted" style="border:0;background:none">なし（選手リストで「参加」を増やせます）</span>'}</div>
    <div class="subsel">
      <label class="field" for="subOut">OUT（下がる選手）<select id="subOut" data-sub="out"><option value="">選択…</option>${on.map(p => `<option value="${p.id}" ${state.ui.subOut===p.id?'selected':''}>#${p.num} ${esc(p.name)}</option>`).join('')}</select></label>
      <label class="field" for="subIn">IN（入る選手）<select id="subIn" data-sub="in"><option value="">選択…</option>${bench.map(p => `<option value="${p.id}" ${state.ui.subIn===p.id?'selected':''}>#${p.num} ${esc(p.name)}</option>`).join('')}</select></label>
      <button class="btn primary" data-dosub type="button" ${state.ui.subOut && state.ui.subIn ? '' : 'disabled'}>🔁 交代実行</button>
    </div>
    <p style="font-size:12.5px">ハーフタイム中の交代もここで記録してください。出場時間の計算に使います。</p>
    <div class="row"><button class="btn" data-close type="button">閉じる</button></div>`);
}
function halftimeSheet(){
  const m = cur(), ev = evOf(m.id), p = state.timer.p, pend = ev.filter(isPending);
  openSheet(`<h2>📊 ハーフタイムボード</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px">
      <div><div class="q" style="margin-bottom:6px">${esc(pLabel(m, p))}</div>${compareTable(ev.filter(e => e.period === p), m.ourName, m.opponent)}</div>
      <div><div class="q" style="margin-bottom:6px">試合全体</div>${compareTable(ev, m.ourName, m.opponent)}</div>
    </div>
    ${pend.length ? `<p style="font-size:13px"><span class="chip warn">状況が未入力のゴール ${pend.length}件</span>　${pend.map(e => `<button class="btn small attn" data-goaledit="${e.id}" type="button">${esc(pShort(m, e.period))} ${e.clock} ${e.team==='us'?'得点':'失点'}</button>`).join(' ')}</p>` : ''}
    <p style="font-size:13px">話し合いのヒント：PA内から打てている？　被シュートはどのレーンから？　CKはシュートまでつながった？　★マークの場面は？</p>
    ${htPointsHTML(m)}
    <div class="row"><button class="btn primary" data-close type="button">閉じる</button></div>`, 'wide');
}
function fmSheet(){
  const m = cur(), f = fmCur(), tm = state.ui.fmTeam;
  ensureLineup();
  const on = state.lineup.map(player).filter(Boolean).sort((a,b) => a.num - b.num);
  const us = f.us.shape ? slotsOf(f.us.shape, 'us') : [];
  const posOf = id => { const i = f.us.slots.indexOf(id); return i >= 0 && us[i] ? us[i].label : null; };
  const sel = tm === 'us' ? f.us.shape : f.them.shape;
  openSheet(`<h2>📋 フォーメーション <span class="muted" style="font-size:13px;font-weight:800">記録する時刻：${esc(curPer().label)} <span class="num" style="font-size:16px">${fmtClock(liveMs())}</span></span></h2>
    <div class="fmtabs" role="group" aria-label="どちらのチーム">
      <button type="button" data-fmteam="us" aria-pressed="${tm==='us'}">${esc(m.ourName)} <b>${f.us.shape || '—'}</b></button>
      <button type="button" data-fmteam="them" aria-pressed="${tm==='them'}">${esc(m.opponent)} <b>${f.them.shape || '？'}</b></button>
    </div>
    <div class="fmgroups">
      ${FM_GROUPS.map(([g, list]) => `<div class="g"><span>${g}</span><div class="chips fmc">${list.map(k => `<button type="button" data-fshape="${k}" aria-pressed="${sel===k}">${k}</button>`).join('')}${tm==='them' && g==='5バック' ? `<button type="button" data-fshape="" aria-pressed="${!sel}">不明</button>` : ''}</div></div>`).join('')}
    </div>
    <div class="fmgrid">
      ${f.us.shape || f.them.shape ? boardHTML({ m, usShape:f.us.shape, usPlayers:f.us.slots.map(player), themShape:f.them.shape, interactive:true })
        : '<div class="empty">上で自チームのフォーメーションを選んでください</div>'}
      <div class="fplist">
        <div class="q">出場中の選手</div>
        ${on.map(p => { const ps = posOf(p.id); return `<button type="button" data-fplayer="${p.id}" class="${f.us.shape && !ps ? 'unplaced' : ''}"><span class="jersey">${p.num}</span>${esc(family(p.name))}<em>${ps || '未配置'}</em></button>`; }).join('')}
        <button class="btn small" data-fauto type="button" ${f.us.shape ? '' : 'disabled'}>背番号順に並べ直す</button>
      </div>
    </div>
    <p style="font-size:12.5px">丸をタップ → 右の選手をタップで配置。丸どうしをタップすると入れ替わります。交代すると同じポジションに自動で入ります。</p>
    <div class="row"><button class="btn" data-close type="button">閉じる</button><button class="btn primary" data-fsave type="button" ${f.us.shape ? '' : 'disabled'}>この時刻で記録する</button></div>`, 'xwide');
}
function saveFormation(){
  const f = fmCur(); if(!f.us.shape) return;
  const e = baseEvent('formation'); e.team = 'us';
  e.us = { shape:f.us.shape, slots:slotsOf(f.us.shape, 'us').map((s, i) => { const p = player(f.us.slots[i]);
    return { label:s.label, playerId:p ? p.id : null, num:p ? p.num : null, name:p ? p.name : null }; }) };
  e.them = { shape:f.them.shape || null, slots:(f.them.slots || []).slice() };
  pushEvent(e); state.ui.fmSel = null; closeSheet();
  toast(`フォーメーションを記録しました：${f.us.shape} vs ${f.them.shape || '不明'}`); render();
}

