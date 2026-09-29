"use strict";
/* =========================================================
   10. 画面4：データ・AI分析（日付 → 試合 → ピリオド）
   ========================================================= */
function viewData(){
  if(!teamMatches().filter(m => m.status !== 'planned').length) return `<div class="data"><section class="card panel" style="max-width:560px;margin:40px auto;text-align:center;align-items:center">
    <h3>まだ試合の記録がありません</h3><p class="muted" style="margin:0">試合を記録すると、ここでシュートマップや得点・失点の分析を見られます。</p>
    <button class="btn primary" data-sample type="button">サンプルの1日で試す</button></section></div>`;
  const done = teamMatches().filter(m => m.status !== 'planned'), mode = state.ui.dataMode ||= 'day';
  const dates = [...new Set(done.map(x => x.date))].sort().reverse();
  const tours = [...new Set(done.map(tourName))], years = [...new Set(done.map(m => schoolYear(m.date)))].sort().reverse();
  if(!dates.includes(state.ui.dataDate)){ state.ui.dataDate = cur()?.date || dates[0]; if(mode === 'day') state.ui.dataMatch = null; }
  if(!tours.includes(state.ui.dataTour)) state.ui.dataTour = tours[0];
  if(!years.includes(+state.ui.dataYear)) state.ui.dataYear = years[0];
  const dayMs = scopeMatches();
  const scopeName = mode === 'tour' ? state.ui.dataTour : mode === 'year' ? `${state.ui.dataYear}年度` : dateJP(state.ui.dataDate);
  const keySel = mode === 'tour' ? `<select data-dtour aria-label="大会">${tours.map(t => `<option ${t===state.ui.dataTour?'selected':''}>${esc(t)}</option>`).join('')}</select>`
    : mode === 'year' ? `<select data-dyear aria-label="年度">${years.map(y => `<option value="${y}" ${y==state.ui.dataYear?'selected':''}>${y}年度</option>`).join('')}</select>`
    : `<select data-ddate aria-label="日付">${dates.map(d => `<option value="${d}" ${d===state.ui.dataDate?'selected':''}>${dateJP(d)}（${done.filter(m => m.date === d).length}試合）</option>`).join('')}</select>`;
  const modeSeg = `<div class="seg2" role="group" aria-label="まとめ方">${[['day','日付'],['tour','大会'],['year','年度']].map(([v,l]) => `<button type="button" data-dmode="${v}" aria-pressed="${mode===v}">${l}</button>`).join('')}</div>`;
  const ms = dataMatches(), single = ms.length === 1 ? ms[0] : null;
  if(!ms.length) return `<div class="data"><div class="dbar">${modeSeg}${keySel}</div>
    <div class="note-banner">この範囲は紅白戦だけなので、まとめの集計はありません。試合を選ぶと個別に見られます。</div>
    <select data-dmatch>${dayMs.map(m => `<option value="${m.id}">vs ${esc(m.opponent)}（紅白戦）</option>`).join('')}<option value="day" selected>選んでください</option></select></div>`;
  const per = single && state.ui.dataPeriod !== 'all' ? +state.ui.dataPeriod : null;
  const all = ms.flatMap(m => evOf(m.id));
  const ev = per == null ? all : all.filter(e => e.period === per);
  const usName = single ? single.ourName : (ms[0]?.ourName || '自チーム'), themName = single ? single.opponent : '相手（合計）';
  const shots = ev.filter(e => e.type === 'shot' && e.x != null);
  const goals = ev.filter(isGoalEv);
  const gU = goals.filter(g => g.team === 'us' && g.goal), gT = goals.filter(g => g.team === 'them' && g.goal);
  const groups = ms.flatMap(m => m.periods.map((p, i) => ({ m, p, i })).filter(x => x.p.kind !== 'pk' && (per == null || x.i === per)));
  const bks = groups.map(({ m, p, i }) => { const pe = evOf(m.id).filter(e => e.type === 'shot' && e.period === i);
    return { lb:`${ms.length > 1 ? esc(m.opponent.slice(0,4)) + '<br>' : ''}${esc(p.label)}`, u:pe.filter(e => e.team === 'us').length, t:pe.filter(e => e.team === 'them').length }; });
  const bmax = Math.max(1, ...bks.map(b => Math.max(b.u, b.t)));
  const marks = ev.filter(e => e.type === 'mark');
  const hasSample = teamMatches().some(x => x.sample);
  // 選手別
  const secs = {};
  ms.forEach(m => { const idx = m.periods.map((_, i) => i).filter(i => per == null || i === per);
    Object.entries(playSeconds(m, idx)).forEach(([id, s]) => secs[id] = (secs[id] || 0) + s); });
  const pl = {};
  const P = id => (pl[id] ||= { id, sec:secs[id] || 0, shots:0, onT:0, goals:0, ast:0, marks:0, y:0, r:0 });
  const opp = {}; const O = n => (opp[n] ||= { n, shots:0, goals:0, y:0, r:0 });
  Object.keys(secs).forEach(P);
  ev.forEach(e => {
    if(e.type === 'shot' && e.team === 'us' && e.playerId){ const r = P(e.playerId); r.shots++; if(e.result === 'goal' || e.result === 'on') r.onT++; if(e.result === 'goal') r.goals++; }
    if(e.type === 'shot' && e.team === 'us' && e.goal?.assistId) P(e.goal.assistId).ast++;
    if(e.type === 'mark' && e.playerId) P(e.playerId).marks++;
    if(e.type === 'card' && e.team === 'us' && e.playerId){ if(e.color === 'Y') P(e.playerId).y++; else P(e.playerId).r++; }
    if(e.type === 'shot' && e.team === 'them' && e.oppNum){ const o = O(e.oppNum); o.shots++; if(e.result === 'goal') o.goals++; }
    if(e.type === 'card' && e.team === 'them' && e.oppNum){ if(e.color === 'Y') O(e.oppNum).y++; else O(e.oppNum).r++; }
  });
  const orow = Object.values(opp).sort((a,b) => b.goals - a.goals || b.shots - a.shots);
  const prow = Object.values(pl).map(r => ({ ...r, p:player(r.id) })).filter(r => r.p).sort((a,b) => b.sec - a.sec || a.p.num - b.p.num);

  return `
  <div class="data">
    <div class="dbar">
      ${modeSeg}${keySel}
      <select data-dmatch aria-label="試合">
        ${dayMs.length > 1 ? `<option value="day" ${state.ui.dataMatch === 'day' || !state.ui.dataMatch ?'selected':''}>${mode === 'day' ? 'この日' : 'この範囲'}の全試合まとめ${dayMs.some(m => m.kind === '紅白戦') ? '（紅白戦を除く）' : ''}</option>` : ''}
        ${dayMs.map(m => `<option value="${m.id}" ${single && single.id===m.id && state.ui.dataMatch !== 'day' ?'selected':''}>${mode === 'day' ? '' : esc(m.date.slice(5).replace('-','/')) + ' '}vs ${esc(m.opponent)}（${esc(scoreText(m))}）${m.kind === '紅白戦' ? '・紅白戦（集計外）' : ''}${m.sample?' サンプル':''}</option>`).join('')}
      </select>
      ${single ? `<div class="seg2" role="group" aria-label="集計範囲"><button type="button" data-dper="all" aria-pressed="${per==null}">全体</button>${single.periods.map((p, i) => p.kind === 'pk' ? '' : `<button type="button" data-dper="${i}" aria-pressed="${per===i}">${esc(p.label)}</button>`).join('')}</div>` : ''}
      ${hasSample ? '<button class="btn small" data-clearsample type="button">サンプルを削除</button>' : '<button class="btn small" data-sample type="button">サンプルの1日を追加</button>'}
      <button class="ai-btn" data-ai type="button">🤖 Gemini APIでAI分析レポートを生成</button>
    </div>
    ${single && single.kind === '紅白戦' ? '<div class="note-banner">紅白戦は、日のまとめ・選手別の集計には含まれません（この画面では個別に確認できます）。</div>' : ''}
    <div class="dgrid">
      <section class="card panel">
        <div class="hd"><h3>${single ? `${esc(single.ourName)} vs ${esc(single.opponent)}` : `${esc(scopeName)} の全${ms.length}試合`}</h3>
          <span class="muted" style="font-size:12px">${single ? `${esc(single.kind)}・${single.kit === 2 ? '2nd' : '1st'}ユニ・${esc(scoreText(single))}${single.recorders?.length ? `・記録：${single.recorders.map(r => esc(recorderLabel(r))).join('、')}` : ''}` : ms.map(m => `vs ${esc(m.opponent)} ${esc(scoreText(m))}`).join('　')}</span></div>
        ${compareTable(ev, usName, themName)}
      </section>
      <section class="card panel">
        <div class="hd"><h3>シュートマップ</h3><span class="muted" style="font-size:12px"><span class="num" style="font-size:17px">${shots.length}</span> 本・自チームの攻撃方向（▶）にそろえて表示</span></div>
        <div>${pitchHTML({ dots:shots })}</div>
        ${shotLegend(usName, themName)}
        <div class="section-title" style="margin-top:6px">ピリオド・本ごとのシュート数</div>
        <div class="buckets" style="margin-top:14px;grid-template-columns:repeat(${Math.min(bks.length, 8) || 1},1fr)">${bks.map(b => `<div class="bk"><div class="bars">
            <span class="u" style="height:${b.u/bmax*60+2}px"><b>${b.u}</b></span><span class="t" style="height:${b.t/bmax*60+2}px"><b>${b.t}</b></span></div>
            <div class="lb">${b.lb}</div></div>`).join('')}</div>
      </section>
    </div>
    ${trendPanelHTML(ms)}
    ${winPanelHTML(ev, usName, themName)}
    ${drawPanelsHTML(ms, ev, usName, themName)}
    ${breakdownPanel(ev)}
    ${causePanelHTML(ev)}
    <section class="card panel">
      <div class="hd"><h3>得点・失点の分析</h3><span class="muted" style="font-size:12px">数字は「得点 - 失点」。状況を入力したゴールだけを数えます</span></div>
      <div class="ga">
        <div><h4>局面</h4>${countRows(PHASES, gU, gT, g => g.goal.phase)}
          <h4 style="margin-top:12px">始まり方</h4>${countRows(ALL_DETAILS, gU, gT, g => g.goal.detail)}</div>
        <div><h4>崩し方（ラストパス）</h4>${countRows(LASTPASS, gU, gT, g => g.goal.lastPass)}</div>
        <div><h4>崩したレーン</h4>
          <div class="lanes5"><div><span></span><span class="muted" style="text-align:center">得点</span><span class="muted" style="text-align:center">失点</span></div>
          ${LANES.map(l => `<div><span>${l.short}</span><span class="n u">${gU.filter(g => g.goal.lane === l.id).length}</span><span class="n t">${gT.filter(g => g.goal.lane === l.id).length}</span></div>`).join('')}</div>
          <h4 style="margin-top:12px">フィニッシュ</h4>${countRows(FEET, gU, gT, g => g.goal.foot)}</div>
        <div><h4>ゴール一覧</h4><div class="glist">
          ${goals.length ? goals.map(g => { const gm = match(g.matchId); return `<div class="gi">
              <div class="top"><span class="chip ${g.team}">${g.team==='us'?'得点':'失点'}</span><b class="num">${esc(pShort(gm, g.period))} ${g.clock}</b>${g.type === 'og' ? ' OG' : ''}${g.num ? `#${g.num} ${esc(family(g.name))}` : ''}${g.goal?.oppNum ? `相手#${g.goal.oppNum}` : ''}${g.pk ? ' PK' : ''}<span class="chip ctx">${goalContext(g)}</span>${ms.length > 1 ? `<span class="muted" style="font-size:12px">vs ${esc(gm.opponent)}</span>` : ''}</div>
              ${g.type === 'og' ? `<div class="body">${esc(evText(g, gm))}</div>`
                : isPending(g) ? `<div class="body"><button class="btn small attn" data-goaledit="${g.id}" type="button">⚽ 状況を入力する</button></div>`
                : `<div class="body">${esc(goalDesc(g))}　<button class="btn small" data-goaledit="${g.id}" type="button">直す</button></div>`}
            </div>`; }).join('') : '<div class="empty">この範囲では得点・失点はありません</div>'}
        </div></div>
      </div>
    </section>
    <div class="dgrid" style="grid-template-columns:1fr 1fr">
      <section class="card panel">
        <div class="hd"><h3>🎬 動画チェックリスト（★マーク）</h3>
          ${marks.length ? '<button class="btn small" data-copymarks type="button">📋 テキストでコピー</button>' : ''}</div>
        <div class="marks">${marks.length ? marks.map(e => { const m = match(e.matchId), vt = videoTime(e), p = player(e.playerId);
          return `<div class="mk"><span class="t">${esc(pShort(m, e.period))} ${e.clock}</span>
            <span class="v">動画<br>${vt ? `<b>${vt}</b>` : '—'}</span>
            <span class="d">${e.tag ? `<b>${esc(lbl(MARK_TAGS, e.tag))}</b>` : '<span class="muted">タグなし</span>'}${p ? `　#${p.num} ${esc(family(p.name))}` : ''}${e.note ? `<br>${esc(e.note)}` : ''}${ms.length > 1 ? `<br><span class="muted">vs ${esc(m.opponent)}</span>` : ''}</span>
            ${playBtn(e, m)}<button class="btn small" data-markedit="${e.id}" type="button">✎</button></div>`; }).join('')
          : '<div class="empty">試合中に「★」を押すと、動画で見直したい時間がここにたまります。</div>'}</div>
        <p class="muted" style="font-size:12px;margin:0">「動画」の時間は、そのピリオドのキックオフからの実時間です（給水で止めた時間も含むので、動画のシークにそのまま使えます）。</p>
      </section>
      <section class="card panel">
        <div class="hd"><h3>👟 選手別（出場時間・シュート）</h3><span class="muted" style="font-size:12px">名前をタップで選手カード。出場時間はキックオフ時のメンバーと交代から自動計算</span></div>
        <div class="tbl-wrap">${prow.length ? `<table class="pstat"><thead><tr><th>選手</th><th>出場</th><th>シュート</th><th>枠内</th><th>ゴール</th><th>アシスト</th><th>★</th><th>🟨</th><th>🟥</th></tr></thead>
          <tbody>${prow.map(r => `<tr><td><button type="button" class="plink" data-pcardopen="${r.p.id}"><b>#${r.p.num}</b> ${esc(r.p.name)} <span class="muted" style="font-size:12px">${r.p.grade}年</span> 🪪</button></td>
            <td><span class="num">${Math.round(r.sec/60)}</span>分</td><td><span class="num">${r.shots}</span></td><td><span class="num">${r.onT}</span></td>
            <td><span class="num">${r.goals}</span></td><td><span class="num">${r.ast}</span></td><td><span class="num">${r.marks}</span></td><td><span class="num">${r.y || ''}</span></td><td><span class="num">${r.r || ''}</span></td></tr>`).join('')}</tbody></table>`
          : '<div class="empty">キックオフを記録すると、選手ごとの出場時間が出ます</div>'}</div>
        ${single && orow.length ? `<div class="section-title" style="margin-top:6px">${esc(single.opponent)}の選手（背番号）</div>
          <div class="tbl-wrap"><table class="pstat"><thead><tr><th>背番号</th><th>シュート</th><th>ゴール</th><th>🟨</th><th>🟥</th></tr></thead>
          <tbody>${orow.map(o => `<tr><td><b>#${o.n}</b></td><td><span class="num">${o.shots}</span></td><td><span class="num">${o.goals}</span></td><td><span class="num">${o.y || ''}</span></td><td><span class="num">${o.r || ''}</span></td></tr>`).join('')}</tbody></table></div>` : ''}
      </section>
    </div>
    ${single ? formationPanel(evOf(single.id), single) : ''}
    <details class="card all"><summary>全ログ（${ev.length}件）</summary>
      <div class="tbl-wrap"><table><thead><tr><th>時間</th><th>内容</th><th>同期</th></tr></thead>
        <tbody>${ev.slice().reverse().map(e => { const m = match(e.matchId); return `<tr><td><span class="num">${esc(pShort(m, e.period))} ${e.type === 'pkso' ? '' : e.clock}</span></td><td>${esc(evText(e, m))}${ms.length > 1 ? `<span class="muted">（vs ${esc(m.opponent)}）</span>` : ''}</td><td>${e.synced ? '済' : '<span class="chip warn">未</span>'}</td></tr>`; }).join('')}</tbody></table></div>
    </details>
  </div>`;
}
// シュート（足）・CK・FKの内訳
function breakdownPanel(ev){
  const shots = t => ev.filter(e => e.type === 'shot' && e.team === t);
  const cell = a => a.n ? `<b class="num" style="font-size:18px">${a.n}</b> <small class="muted">${a.sub}</small>` : '<span class="muted">—</span>';
  const footRows = [...FEET, { id:null, label:'未入力' }].map(f => { const c = t => { const a = shots(t).filter(e => (e.foot || null) === f.id);
      return { n:a.length, sub:a.length ? `枠内${a.filter(e => e.result === 'goal' || e.result === 'on').length}・G${a.filter(e => e.result === 'goal').length}` : '' }; };
    return { label:f.label, u:c('us'), t:c('them') }; }).filter(r => r.u.n || r.t.n);
  const ckToShot = c => ev.some(x => x.type === 'shot' && x.team === c.team && x.matchId === c.matchId && x.period === c.period && x.sec >= c.sec && x.sec - c.sec <= 15);
  const ckRows = [...CK_SIDES, { id:null, label:'左右なし' }].map(k => { const c = t => { const a = ev.filter(e => e.type === 'ck' && e.team === t && (e.side || null) === k.id);
      return { n:a.length, sub:a.length ? `→シュート${a.filter(ckToShot).length}` : '' }; };
    return { label:k.label, u:c('us'), t:c('them') }; }).filter(r => r.u.n || r.t.n);
  const fkRows = [null].flatMap(k => FK_PLAYS2.map(pl => { const c = t => { const a = ev.filter(e => e.type === 'fk' && e.team === t && fkPlay2(e) === pl.id);
      const sh = pl.id === 'shot' ? ev.filter(x => x.type === 'shot' && x.fkShot && x.team === t && a.some(f => f.matchId === x.matchId && f.period === x.period && f.sec === x.sec)) : [];
      return { n:a.length, sub:pl.id === 'shot' && a.length ? `枠内${sh.filter(x => x.result === 'goal' || x.result === 'on').length}・G${sh.filter(x => x.result === 'goal').length}` : '' }; };
    return { label:`FK→${pl.label}`, u:c('us'), t:c('them') }; })).filter(r => r.u.n || r.t.n);
  const tbl = (title, rows) => `<div><h4 style="margin:0 0 6px;font-size:12.5px;font-weight:900;color:var(--ink-2)">${title}</h4>${rows.length ? `<table>
    <thead><tr><th></th><th class="us">自チーム</th><th class="them">相手</th></tr></thead>
    <tbody>${rows.map(r => `<tr><td>${r.label}</td><td>${cell(r.u)}</td><td>${cell(r.t)}</td></tr>`).join('')}</tbody></table>` : '<div class="muted" style="font-size:12.5px">まだありません</div>'}</div>`;
  return `<section class="card panel"><div class="hd"><h3>🔍 シュートとセットプレーの内訳</h3><span class="muted" style="font-size:12px">G＝ゴール。CKの→シュートは15秒以内</span></div>
    <div class="bd">${tbl('足別のシュート', footRows)}${tbl('CK（左右）', ckRows)}${tbl('FK', fkRows)}</div></section>`;
}
function formationPanel(all, m){
  const key = e => e.period * 100000 + e.sec;
  const fms = all.filter(e => e.type === 'formation').sort((a,b) => key(a) - key(b));
  if(!fms.length) return `<section class="card panel"><div class="hd"><h3>📋 フォーメーション別</h3></div>
    <div class="empty">この試合ではフォーメーションが記録されていません。試合記録の「📋」ボタンから記録できます。</div></section>`;
  const periods = fms.map((f, i) => {
    const from = key(f), to = fms[i+1] ? key(fms[i+1]) : Infinity;
    const shots = all.filter(e => e.type === 'shot' && key(e) >= from && key(e) < to);
    const c = (t, r) => shots.filter(e => e.team === t && (!r || e.result === r)).length;
    return { f, label:`${pLabel(m, f.period)} ${f.clock}〜${fms[i+1] ? `${pLabel(m, fms[i+1].period)} ${fms[i+1].clock}` : '終了'}`, su:c('us'), st:c('them'), gu:c('us','goal'), gt:c('them','goal') };
  });
  const sel = Math.min(state.ui.fmPeriod ?? periods.length - 1, periods.length - 1), f = periods[sel].f;
  return `<section class="card panel">
    <div class="hd"><h3>📋 フォーメーション別</h3><span class="muted" style="font-size:12px">行をタップすると、その時間帯の配置を表示します</span></div>
    <div class="fmpanel">
      ${boardHTML({ m, usShape:f.us.shape, usPlayers:f.us.slots.map(s => s.num != null ? s : null), themShape:f.them.shape, usPos:f.us.pos, themPos:f.them.pos })}
      <div class="tbl-wrap"><table>
        <thead><tr><th>時間帯</th><th>自</th><th>相手</th><th>シュート</th><th>得点</th></tr></thead>
        <tbody>${periods.map((p, i) => `<tr data-fmrow="${i}" class="${i===sel?'on':''}">
          <td>${p.label}</td><td><span class="num">${p.f.us.shape}</span></td><td><span class="num">${p.f.them.shape || '不明'}</span></td>
          <td><span class="num">${p.su} - ${p.st}</span></td><td><span class="num">${p.gu} - ${p.gt}</span></td></tr>`).join('')}</tbody>
      </table>
      <p class="muted" style="font-size:12px;margin:8px 0 0">数字は「自チーム - 相手」。陣形を変えた後に、シュートの差がどう変わったかを見比べられます。</p></div>
    </div></section>`;
}
function copyMarks(){
  const ms = dataMatches();
  const lines = ms.flatMap(m => evOf(m.id).filter(e => e.type === 'mark' && (state.ui.dataPeriod === 'all' || ms.length > 1 || e.period === +state.ui.dataPeriod)).map(e => {
    const p = player(e.playerId), vt = videoTime(e);
    return `${pLabel(m, e.period)} ${e.clock}（動画 ${vt || '--:--'}）${e.tag ? lbl(MARK_TAGS, e.tag).replace(/^\S+\s/, '') : ''}${p ? ` #${p.num} ${family(p.name)}` : ''}${e.note ? ` ${e.note}` : ''}${ms.length > 1 ? `［vs ${m.opponent}］` : ''}`; }));
  const text = `【動画チェックリスト】${state.ui.dataMode === 'tour' ? state.ui.dataTour : state.ui.dataMode === 'year' ? state.ui.dataYear + '年度' : dateJP(state.ui.dataDate)}\n` + lines.join('\n');
  if(navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => toast('コピーしました。Classroomなどに貼り付けられます'), () => showCopy(text));
  else showCopy(text);
}
function showCopy(text){
  openModal({ title:'テキストをコピー', body:`<p style="font-size:13px">自動でコピーできませんでした。下を長押しして選択・コピーしてください。</p><textarea readonly style="width:100%;min-height:200px;border-radius:10px;padding:10px;background:var(--surface-2);color:var(--ink);border:1px solid var(--line)">${esc(text)}</textarea>`, actions:[{ label:'閉じる', kind:'primary' }] });
}

/* ---------- サンプル：練習試合（30分×2本＋20分×1本）と、同じ日のもう1試合 ---------- */
function seedSample(){
  const saved = state.lineup.slice();
  const pres = present(), gkP = pres.find(p => posOf(p) === 'GK') || pres[0];
  state.lineup = [gkP, ...pres.filter(p => p !== gkP && posOf(p) !== 'GK')].slice(0, 11).map(p => p.id);
  const date = today(), rnd = n => Math.floor(Math.random() * n), pick = a => a[rnd(a.length)];
  const make = (opp, kind, periods) => ({ id:'m' + uid(), teamId:state.teamId, kitColors:{ ...team().kits[team().lastKit || 1] }, date, ourName:team().short || team().name, opponent:opp, kind, kit:team().lastKit || 1,
    createdAt:new Date().toISOString(), endedAt:new Date().toISOString(), sample:true, status:'done', tournament:'練習試合', pkFirst:null, lineupSet:true, gk:state.lineup[0], et:{ enabled:false, min:10 }, pk:{ enabled:false },
    periods:periods.map(([label, short, min], i) => ({ label, short, min, kind:'reg', kickoff:i % 2 ? 'them' : 'us', attack:i % 2 ? 'left' : 'right', played:min * 60000 })) });
  const m1 = make('サンプル中', '練習試合', [['1本目','1本',30],['2本目','2本',30],['3本目','3本',20]]);
  const m2 = make('テスト中', '練習試合', [['1本目','1本',20],['2本目','2本',20]]);
  [m1, m2].forEach(m => {
    state.matches.push(m);
    let lineup = state.lineup.slice(), bench = present().map(p => p.id).filter(id => !lineup.includes(id)), wall = Date.now() - 3 * 3600e3;
    const push = o => { const e = Object.assign({ id:uid(), matchId:m.id, synced:false, recordedAt:new Date().toISOString(), sample:true }, o);
      e.clock = fmtMatch(e.sec * 1000, m.periods[e.period]?.min); state.events.push(e); return e; };
    m.periods.forEach((p, i) => {
      const koWall = wall;
      push({ type:'kickoff', team:p.kickoff, attack:p.attack, lineup:lineup.slice(), period:i, sec:0, wall:koWall });
      if(i === 0){ state.lineup = lineup; push(Object.assign(makeFormationEvent('4-4-2', '4-3-3'), { period:0, sec:0, wall:koWall })); }
      if(i === 1) push(Object.assign(makeFormationEvent('3-4-2-1', '4-3-3'), { period:1, sec:0, wall:koWall }));
      let sec = 30, extra = 0; const end = p.min * 60 - 20;
      while(sec < end){
        sec += 45 + rnd(110); if(sec >= end) break;
        const w = () => koWall + (sec + extra) * 1000;
        if(i === 0 && sec > 900 && !extra){ push({ type:'break', kind:'water', team:'us', period:i, sec, wall:w(), dur:75 }); extra = 75; continue; }
        const team = Math.random() < .6 ? 'us' : 'them', r = Math.random();
        if(r < .08){ push({ type:'mark', team:'us', period:i, sec, wall:w(), tag:pick(MARK_TAGS).id, playerId:pick(lineup), note:pick(['','3人目の動き','切り替えが速い','ラインが下がりすぎ']) }); continue; }
        if(r < .12 && bench.length){ const o = lineup[1 + rnd(lineup.length - 1)], n = bench.shift(), op = player(o), np = player(n);
          lineup = lineup.map(id => id === o ? n : id); bench.push(o);
          push({ type:'sub', team:'us', period:i, sec, wall:w(), outId:o, outNum:op.num, outName:op.name, inId:n, inNum:np.num, inName:np.name }); continue; }
        if(r < .135){ push({ type:'og', team, period:i, sec, wall:w(), playerId:team === 'them' ? pick(lineup) : null, oppNum:team === 'us' ? 1 + rnd(20) : null }); continue; }
        if(r < .28){ const t = pick(CK_TYPES); push({ type:'ck', team, period:i, sec, wall:w(), ckType:t.id, side:t.side, style:t.style }); continue; }
        if(r < .36){ const f = withPos({ type:'fk', team, period:i, sec, wall:w() }, team==='us' ? 60 + rnd(30) : 15 + rnd(30), 10 + rnd(48));
          f.fkKind = pick(FK_KINDS).id; f.fkPlay = pick(FK_PLAYS).id; push(f); continue; }
        const inBox = Math.random() < .55;
        const x = team==='us' ? (inBox ? 89 + rnd(15) : 72 + rnd(16)) : (inBox ? 1 + rnd(15) : 17 + rnd(16));
        const e = withPos({ type:'shot', team, period:i, sec, wall:w() }, x, inBox ? 16 + rnd(36) : 8 + rnd(52));
        e.result = (() => { const q = Math.random(); return q < .15 ? 'goal' : q < .43 ? 'on' : q < .75 ? 'off' : 'block'; })(); e.pk = false; e.fromSetPiece = null; e.foot = pick(['right','right','left','head', null]);
        if(team === 'us' && Math.random() < .8){ const pp = player(pick(lineup)); Object.assign(e, { playerId:pp.id, num:pp.num, name:pp.name, grade:pp.grade }); }
        if(e.result === 'goal' && Math.random() < .85){ const ph = pick(PHASES).id;
          e.goal = { phase:ph, detail:ph === 'setpiece' ? pick(SP_DETAILS.slice(0,4)).id : pick(WIN_DETAILS).id,
            originZone:ph === 'setpiece' ? null : `${pick(THIRDS).id}-${1+rnd(5)}`, lastPass:ph === 'setpiece' ? pick(['direct','cross','rebound']) : pick(LASTPASS.slice(0,7)).id,
            lane:1 + rnd(5), foot:e.foot, touch:pick(TOUCH).id, assistId:team === 'us' && Math.random() < .6 ? pick(lineup) : null, oppNum:team === 'them' ? 1 + rnd(20) : null };
        } else e.goal = null;
        push(e);
      }
      wall += (p.min * 60 + extra + 600) * 1000;
    });
  });
  state.lineup = saved; save.lineup();
  save.matches(); save.events();
  state.ui.dataMode = 'day'; state.ui.dataDate = date; state.ui.dataMatch = 'day'; state.ui.dataPeriod = 'all'; state.ui.fmPeriod = null;
  toast('サンプルの1日（2試合）を追加しました'); render();
}

