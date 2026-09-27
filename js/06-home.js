"use strict";
/* =========================================================
   5. 画面1：ホーム
   ========================================================= */
// 記録者の候補：参加の選手＋顧問・コーチ・保護者
function recorderOptions(){
  return [{ id:'coach', label:'顧問' }, { id:'staff', label:'コーチ' }, { id:'parent', label:'保護者' },
    ...state.roster.filter(p => p.status !== 'retired').sort((a,b) => b.grade - a.grade || a.num - b.num).map(p => ({ id:p.id, label:`${p.grade}年 ${family(p.name)}` }))];
}
const recorderLabel = id => (recorderOptions().find(o => o.id === id) || {}).label || (player(id) ? family(player(id).name) : id);
function recorderSheet(){
  const m = cur(); if(!m) return;
  state.ui.flow = { kind:'recorders' }; state.ui.recSel = (m.recorders || []).slice();
  openSheet(`<h2>✍️ 記録者（最大3人）</h2>${recWheelsHTML(state.ui.recSel)}
    <div class="row"><button class="btn" data-close type="button">キャンセル</button><button class="btn primary" data-recsave type="button">保存</button></div>`, 'wide');
  centerWheels($('#sheet'));
}
function setupForm(){
  const k = state.ui.setupKit || team().lastKit || 1, KITS = teamKits();
  return `<div class="form">
    <label class="field">日付<input id="mDate" type="date" value="${today()}"></label>
    <label class="field">試合の種類<select id="mKind"><option>練習試合</option><option>公式戦</option><option>紅白戦</option></select></label>
    <label class="field">自チームの表示名<input id="mOur" value="${esc(team().short || team().name)}" autocomplete="off"></label>
    <label class="field">対戦相手<input id="mOpp" placeholder="例：○○中" autocomplete="off"></label>
    <div data-kindblock="practice" style="display:contents">
      <label class="field">1本の時間（分）<input id="mPMin" type="number" inputmode="numeric" min="5" max="45" value="30"></label>
      <label class="field">本数（あとで追加できます）<input id="mPCount" type="number" inputmode="numeric" min="1" max="8" value="2"></label>
    </div>
    <div data-kindblock="official" style="display:contents" hidden>
      <label class="field">ハーフの時間（分）<input id="mHalf" type="number" inputmode="numeric" min="10" max="45" value="30"></label>
      <label class="field">延長ハーフの時間（分）<input id="mEtMin" type="number" inputmode="numeric" min="5" max="15" value="10"></label>
      <label class="checkrow"><input type="checkbox" id="mEt" checked>同点なら延長戦あり</label>
      <label class="checkrow"><input type="checkbox" id="mPk" checked>決着しなければPK戦あり</label>
    </div>
    <div class="field" style="grid-column:1/-1">記録者（複数選べます）
      <div class="chips recpick">${recorderOptions().map(o => `<button type="button" data-recpick="${esc(o.id)}" aria-pressed="false">${esc(o.label)}</button>`).join('')}</div></div>
    <div class="kitpick" role="group" aria-label="今日のユニフォーム">
      ${[1,2].map(n => `<button type="button" data-kitpick="${n}" aria-pressed="${k===n}"><span class="sw" style="background:linear-gradient(135deg,${KITS[n].a} 0 62%,${KITS[n].b} 62%)"></span><span><span class="disp" style="font-size:20px">${KITS[n].label}</span> ユニフォーム</span></button>`).join('')}
    </div>
  </div>`;
}
function viewHome(){
  const m = cur(), n = unsynced().length;
  const last = state.meta.lastSync ? new Date(state.meta.lastSync) : null;
  const lastStr = last ? `${last.getMonth()+1}/${last.getDate()} ${String(last.getHours()).padStart(2,'0')}:${String(last.getMinutes()).padStart(2,'0')}` : 'まだ同期していません';
  const done = teamMatches().filter(x => x.status !== 'planned');
  const dates = [...new Set(done.map(x => x.date))].sort().reverse().slice(0, 4);
  const plans = plannedMatches();
  const planItem = p => `<div class="plan"><div class="pl-l"><span class="disp">${esc(dateJP(p.date))}</span><b>vs ${esc(p.opponent)}</b>
      <span class="ptag">${esc(p.tournament || p.kind)}</span>${p.points?.pre?.length ? `<span class="muted" style="font-size:12px">テーマ：${p.points.pre.map(x => esc(x.text)).join('／')}</span>` : ''}</div>
      <div class="pl-r"><button class="btn small" data-planedit="${p.id}" type="button">✎</button><button class="btn small primary" data-planstart="${p.id}" type="button" ${m ? 'disabled' : ''}>▶ 始める</button></div></div>`;
  const heroBody = m ? `
      <div class="kicker">NOW <i>LIVE</i></div>
      <div class="date">${dateJP(m.date)}・${esc(m.tournament || m.kind)}・${m.kit === 2 ? '2nd' : '1st'}ユニ・${esc(pLabel(m, state.timer.p))}</div>
      <div class="live-score"><span class="tm">${esc(m.ourName)}</span><span class="sc">${esc(scoreText(m))}</span><span class="tm">${esc(m.opponent)}</span></div>
      <div class="row">
        <button class="hero-start" data-stepnext type="button"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l10.5-6.5z"/></svg>次へ：${STEPS[Math.max(0, stepOf(m) - 1)].label}</button>
        <button class="ghost" data-endmatch type="button">試合を終了する</button>
      </div>` : `
      <div class="kicker">MATCH <i>DAY</i></div>
      <div class="date">予定の試合から始めるか、新しく作ります</div>
      <div class="plans">${plans.length ? plans.map(planItem).join('') : '<div class="date" style="opacity:.8">予定の試合はまだありません</div>'}</div>
      <div class="row"><button class="hero-start" data-newmatch type="button">＋ 試合を作る</button></div>`;
  return `
  ${m ? stepperHTML(m) : ''}
  <div class="home">
    <section class="card hero">${heroBody}</section>
    <div class="side">
      <section class="card unsynced">
        <div><div class="section-title">未同期のデータ</div><div class="big">${n}<small>件</small></div></div>
        <div style="flex:1;min-width:10em">
          <div class="muted" style="font-size:13px;margin-bottom:6px">最終同期：${lastStr}</div>
          <button class="btn primary" data-sync type="button" ${n || state.meta.gas?.url ? '' : 'disabled'}>☁️ Wi-Fiで同期する</button>
        </div>
      </section>
      <section class="card history">
        <div class="section-title">これまでの試合（日付ごと）</div>
        ${dates.length ? dates.map(dt => { const ms = done.filter(x => x.date === dt);
          return `<div class="dayhead">${dateJP(dt)}<small>${ms.length}試合</small></div>
          ${ms.map(h => `<button class="hist-item" data-openmatch="${h.id}" type="button">
            <span class="kitdot" style="background:linear-gradient(180deg,${kitOf(h).a} 0 65%,${kitOf(h).b} 65%)"></span>
            <span class="nm">vs ${esc(h.opponent)} <span class="ptag">${esc(h.tournament || h.kind)}</span>${h.id === state.current ? ' <span class="chip us">記録中</span>' : ''}${h.sample ? ' <span class="chip warn">サンプル</span>' : ''}</span>
            <span class="sc">${esc(scoreText(h))}</span></button>`).join('')}`; }).join('')
          : '<div class="empty">まだ試合の記録がありません</div>'}
      </section>
    </div>
    <section class="card flow">
      <div class="section-title">試合日の流れ ${m ? '<span class="muted" style="font-weight:700">（タップでその手順へ）</span>' : ''}</div>
      <ol>
        <li ${m ? 'data-step="1"' : ''}><div><b>① 出欠とユニフォーム</b><span>選手リストで「参加」を確定</span></div></li>
        <li ${m ? 'data-step="2"' : ''}><div><b>② スタメン</b><span>フォーメーションと配置、相手の背番号</span></div></li>
        <li ${m ? 'data-step="3"' : ''}><div><b>③ トス・陣地 → KICK OFF</b><span>ピッチをタップで記録、💧で飲水、📊でHT</span></div></li>
        <li ${m ? 'data-step="5"' : ''}><div><b>④ 試合後：ふり返り・出力</b><span>テーマの評価、PDF、同期、Classroom</span></div></li>
      </ol>
    </section>
  </div>`;
}
function startMatch(){ matchSheet(null); }
function endMatch(){
  openModal({ title:'試合を終了しますか？', body:`<p>タイマーを止めて、この試合の記録を締めます。続けて「試合後」の画面で、テーマのふり返りと結果の出力ができます。</p>`,
    actions:[{ label:'キャンセル' }, { label:'終了する', kind:'danger', onClick:() => {
      if(state.timer.brk) endBreak(true);
      foldTimer(); keepAwake(false);
      const m = cur(); if(m){ m.endedAt = new Date().toISOString(); save.matches(); state.ui.dataDate = m.date; state.ui.dataMatch = m.id; state.ui.dataPeriod = 'all'; }
      if(m){ m.status = 'done'; save.matches(); state.ui.postMatch = m.id; }
      state.current = null; save.current(); state.ui.screen = 'post'; render();
    }}]});
}

