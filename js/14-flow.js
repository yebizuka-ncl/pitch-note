"use strict";
/* =========================================================
   14. 試合日の流れ・試合後・出力・取り込み・Google ドライブ連携
   試合日の流れ：① 出欠 → ② スタメン → ③ トス・陣地 → ④ 試合 → ⑤ 試合後
   ========================================================= */

/* ---------- 戻る（画面の履歴） ---------- */
const navHist = [];
let navLast = null, navBackFlag = false;
function trackNav(){
  const s = state.ui.screen;
  if(navLast && navLast !== s && !navBackFlag){ navHist.push(navLast); if(navHist.length > 30) navHist.shift(); }
  navBackFlag = false; navLast = s;
  const bb = $('#backBtn'); if(bb) bb.hidden = !navHist.length;
}
function goBack(){
  if(!$('#scrim').hidden){ closeSheet(); render(); return; }
  if(state.ui.pop){ closePop(); return; }
  const prev = navHist.pop(); if(!prev) return;
  navBackFlag = true; state.ui.screen = prev; render(); $('#main').scrollTop = 0;
}

/* ---------- 試合日の流れ（ステップ表示） ---------- */
const STEPS = [
  { id:1, label:'出欠', en:'SQUAD' }, { id:2, label:'スタメン', en:'LINE-UP' }, { id:3, label:'トス・陣地', en:'COIN TOSS' },
  { id:4, label:'試合', en:'MATCH' }, { id:5, label:'試合後', en:'FULL TIME' },
];
function stepOf(m){
  if(!m) return 0;
  if(m.endedAt) return 5;
  if(m.periods.some((p, i) => isStarted(m, i)) || m.periods[0]?.kickoff) return 4;
  if(m.lineupSet) return 3;
  if(m.flow?.att) return 2;
  return 1;
}
function stepperHTML(m){
  if(!m) return '';
  const now = stepOf(m);
  const nextLabel = { 1:'出欠OK → スタメンへ', 2:'スタメンを決める', 3:'⚽ キックオフへ', 4:'試合を記録', 5:'' }[now];
  return `<nav class="stepper" aria-label="試合日の流れ">
    ${STEPS.map(s => `<button type="button" data-step="${s.id}" class="${s.id < now ? 'done' : s.id === now ? 'now' : ''}" ${s.id > now + 1 && s.id !== 5 ? 'disabled' : ''}>
      <i>${s.id < now ? '✓' : s.id}</i><span><small>${s.en}</small>${s.label}</span></button>`).join('<b class="sep">›</b>')}
    ${nextLabel ? `<button type="button" class="stnext" data-stepnext>${nextLabel} ▶</button>` : ''}
  </nav>`;
}
function goStep(n){
  const m = cur() || match(state.ui.postMatch); if(!m) return;
  if(n === 1){ state.ui.screen = 'roster'; render(); return; }
  if(n === 2){ m.flow = { ...(m.flow || {}), att:true }; save.matches(); state.ui.screen = 'record'; render(); state.ui.flow = null; starterSheet(null); return; }
  if(n === 3){ state.ui.screen = 'record'; render(); if(!m.lineupSet){ starterSheet('ko'); } return; }
  if(n === 4){ state.ui.screen = 'record'; render(); return; }
  if(n === 5){ state.ui.postMatch = m.id; state.ui.screen = 'post'; render(); return; }
}
function stepNext(){
  const m = cur(); if(!m) return;
  const now = stepOf(m);
  if(now === 1){ m.flow = { ...(m.flow || {}), att:true }; save.matches(); goStep(2); return; }
  goStep(now);
}

/* ---------- 試合を作る（今すぐ／予定として保存） ---------- */
const TOURNAMENTS = ['練習試合', '市内大会', '地区大会', '県大会', '新人戦', '招待大会', 'リーグ戦'];
function matchFormHTML(m){
  const k = m?.kit || state.ui.setupKit || team().lastKit || 1, KITS = teamKits();
  const tours = [...new Set([...TOURNAMENTS, ...state.matches.map(x => x.tournament).filter(Boolean)])];
  const pts = m?.points?.pre || [];
  const official = (m?.kind || '練習試合') === '公式戦';
  const regs = m ? m.periods.filter(p => p.kind === 'reg') : null;
  return `<div class="form mform">
    <label class="field">日付<input id="mDate" type="date" value="${m?.date || today()}"></label>
    <label class="field">試合の種類<select id="mKind">${['練習試合','公式戦','紅白戦'].map(x => `<option ${m?.kind===x?'selected':''}>${x}</option>`).join('')}</select></label>
    <label class="field">対戦相手<input id="mOpp" value="${esc(m?.opponent || '')}" placeholder="例：○○中" autocomplete="off"></label>
    <label class="field">大会名<input id="mTour" list="tourList" value="${esc(m?.tournament || '')}" placeholder="例：市内大会（練習試合は空欄でOK）" autocomplete="off">
      <datalist id="tourList">${tours.map(t => `<option value="${esc(t)}">`).join('')}</datalist></label>
    <label class="field">自チームの表示名<input id="mOur" value="${esc(m?.ourName || team().short || team().name)}" autocomplete="off"></label>
    <div data-kindblock="practice" style="display:contents" ${official ? 'hidden' : ''}>
      <label class="field">1本の時間（分）<input id="mPMin" type="number" inputmode="numeric" min="5" max="45" value="${regs?.[0]?.min || 30}"></label>
      <label class="field">本数（あとで追加できます）<input id="mPCount" type="number" inputmode="numeric" min="1" max="8" value="${regs?.length || 2}"></label>
      ${subFormHTML(m, '練習試合', 'mSubP')}
    </div>
    <div data-kindblock="official" style="display:contents" ${official ? '' : 'hidden'}>
      <label class="field">ハーフの時間（分）<input id="mHalf" type="number" inputmode="numeric" min="10" max="45" value="${regs?.[0]?.min || 30}"></label>
      <label class="field">延長ハーフの時間（分）<input id="mEtMin" type="number" inputmode="numeric" min="5" max="15" value="${m?.et?.min || 10}"></label>
      <label class="checkrow dark"><input type="checkbox" id="mEt" ${m ? (m.et?.enabled ? 'checked' : '') : 'checked'}>同点なら延長戦あり</label>
      <label class="checkrow dark"><input type="checkbox" id="mPk" ${m ? (m.pk?.enabled ? 'checked' : '') : 'checked'}>決着しなければPK戦あり</label>
      <label class="field">登録メンバー<select id="mRegN">${REG_SIZES.map(n => `<option value="${n}" ${regLimit(m) === n ? 'selected' : ''}>${n}名</option>`).join('')}</select></label>
      ${subFormHTML(m, '公式戦', 'mSubO')}
    </div>
    <div class="field" style="grid-column:1/-1">試合前のポイント（今日のテーマ・最大3つ）
      <div class="ptsin scribwrap">${[0,1,2].map(i => `<input id="pp${i}" value="${esc(pts[i]?.text || '')}" placeholder="${['例：奪ったら3秒で前へ','例：サイドから崩す','例：声を出して守る'][i]}" autocomplete="off">`).join('')}</div></div>
    <div class="field" style="grid-column:1/-1">記録者（最大3人・それぞれスクロールで選ぶ）${recWheelsHTML(m?.recorders || state.ui.recSel || [])}</div>
    <div class="kitpick" role="group" aria-label="今日のユニフォーム">
      ${[1,2].map(n => `<button type="button" data-kitpick="${n}" aria-pressed="${k===n}"><span class="sw" style="background:linear-gradient(135deg,${KITS[n].a} 0 62%,${KITS[n].b} 62%)"></span><span><span class="disp" style="font-size:20px">${KITS[n].label}</span> ユニフォーム</span></button>`).join('')}
    </div>
  </div>`;
}
function matchSheet(id){
  const m = id ? match(id) : null;
  state.ui.flow = { kind:'match', id };
  state.ui.recSel = (m?.recorders || []).slice();
  openSheet(`<h2>${m ? '試合の予定を編集' : '試合を作る'}</h2>${matchFormHTML(m)}
    <div class="row">${m ? '<button class="btn danger" data-mdelplan type="button">この予定を削除</button><span style="flex:1"></span>' : ''}
      <button class="btn" data-close type="button">キャンセル</button>
      ${m ? '' : '<button class="btn" data-msave="next" type="button">📅 保存して、次の予定も作る</button>'}
      <button class="btn ${liveNow() ? 'primary' : ''}" data-msave="plan" type="button">📅 予定として保存</button>
      ${liveNow() ? '' : '<button class="btn primary" data-msave="start" type="button">▶ 今日の試合を始める</button>'}</div>
    ${liveNow() ? '<p class="muted" style="font-size:12.5px;margin:0">記録中の試合があるので、予定として保存だけできます。</p>' : ''}`, 'xwide');
}
function readMatchForm(base){
  const kind = $('#mKind').value, num = (sel, lo, hi, def) => Math.min(hi, Math.max(lo, parseInt($(sel)?.value, 10) || def));
  const kit = state.ui.setupKit || base?.kit || team().lastKit || 1;
  const m = base || { id:'m' + uid(), teamId:state.teamId, createdAt:new Date().toISOString(), endedAt:null, pkFirst:null };
  Object.assign(m, { date:$('#mDate').value || today(), kind, opponent:$('#mOpp').value.trim() || '相手', ourName:$('#mOur').value.trim() || team().short || '自チーム',
    tournament:$('#mTour').value.trim() || (kind === '練習試合' ? '' : ''), kit, kitColors:{ ...team().kits[kit] },
    recorders:(state.ui.recSel || []).filter(Boolean).slice(0, 3) });
  const pre = [0,1,2].map(i => $('#pp' + i).value.trim()).filter(Boolean).map((text, i) => ({ text, eval:base?.points?.pre?.[i]?.eval || null }));
  m.points = { ...(m.points || {}), pre };
  const sp = kind === '公式戦' ? 'mSubO' : 'mSubP';
  if($('#' + sp + 'Lim')) m.subs = { limit:+$('#' + sp + 'Lim').value || 0, reentry:!!$('#' + sp + 'Re').checked, htFree:!!$('#' + sp + 'Ht')?.checked };
  if(kind === '公式戦') m.reg = { limit:+($('#mRegN')?.value || 20), ids:m.reg?.ids || [] };
  if(!base || !m.periods.some((p, i) => isStarted(m, i))){
    let periods;
    if(kind === '公式戦'){ const h = num('#mHalf', 10, 45, 30);
      periods = [{ label:'前半', short:'1ST', min:h, kind:'reg' }, { label:'後半', short:'2ND', min:h, kind:'reg' }];
      m.et = { enabled:!!$('#mEt').checked, min:num('#mEtMin', 5, 15, 10) }; m.pk = { enabled:!!$('#mPk').checked };
    } else { const mn = num('#mPMin', 5, 45, 30), cnt = num('#mPCount', 1, 8, 2);
      periods = Array.from({ length:cnt }, (_, i) => ({ label:`${i+1}本目`, short:`${i+1}本`, min:mn, kind:'reg' }));
      m.et = { enabled:false, min:10 }; m.pk = { enabled:false }; }
    m.periods = periods.map(p => ({ ...p, kickoff:null, attack:null, played:0 }));
  }
  return m;
}
function saveMatchForm(mode){
  const f = state.ui.flow, base = f.id ? match(f.id) : null;
  const m = readMatchForm(base);
  if(!base){ m.status = 'planned'; state.matches.push(m); }
  m.dirty = true;   // iPadで作った・直した予定も、次の同期でシートに送る
  team().lastKit = m.kit; save.teams(); state.ui.setupKit = null; state.ui.recSel = null;
  save.matches(); closeSheet();
  if(mode === 'start') beginMatch(m.id);
  else if(mode === 'next'){ toast(`${dateJP(m.date)} vs ${m.opponent} を保存しました。続けて次の予定を入力できます`); render(); matchSheet(null); centerWheels($('#sheet')); }
  else { toast(`${dateJP(m.date)} vs ${m.opponent} を予定に保存しました`); render(); }
}
function beginMatch(id){
  const m = match(id); if(!m) return;
  if(state.current && state.current !== id && cur() && !cur().endedAt){ toast('記録中の試合があります。先に終了してください'); return; }
  m.status = 'live'; m.date = m.date || today(); m.dirty = true;
  const regCopied = applyDefaultReg(m);
  m.lineupSet = false; m.gk = null; m.prevLineup = state.lineup.slice();
  state.current = m.id; save.current();
  state.timer = { p:0, el:{}, startedAt:null, brk:null }; save.timer();
  state.ui.pos = null; state.lineup = []; save.lineup();
  const prevShape = state.fm?.us?.shape || null;
  m.prevFm = prevShape ? { shape:prevShape, slots:(state.fm.us.slots || []).slice() } : null;
  state.fm = { matchId:m.id, us:{ shape:prevShape, slots:[] }, them:{ shape:null, slots:[] } }; save.fm();
  save.matches();
  state.ui.screen = 'roster'; render();
  toast(regCopied ? `前回の登録メンバー${m.reg.ids.length}名を読み込みました。① 出欠と登録を確認して「スタメンへ ▶」` : '① 出欠を確認して「スタメンへ ▶」');
}
const plannedMatches = () => teamMatches().filter(m => m.status === 'planned').sort((a,b) => a.date.localeCompare(b.date));

/* ---------- 記録者：3つのスクロール枠 ---------- */
function recWheelsHTML(sel){
  const opts = recorderOptions();
  return `<div class="recwheels">${[0,1,2].map(k => `<div class="recw"><div class="q">記録者${k + 1}</div><div class="wheel">
    <button type="button" data-recw="${k}:" class="${!sel[k] ? 'on' : ''}">— なし —</button>
    ${opts.map(o => `<button type="button" data-recw="${k}:${esc(o.id)}" class="${sel[k] === o.id ? 'on' : ''} ${sel.includes(o.id) && sel[k] !== o.id ? 'used' : ''}">${esc(o.label)}</button>`).join('')}</div></div>`).join('')}</div>`;
}
function recWheelClick(b){
  const [k, id] = b.dataset.recw.split(':'), sel = state.ui.recSel ||= [];
  if(id && sel.includes(id) && sel[+k] !== id) sel[sel.indexOf(id)] = null;   // 別の枠で選ばれていたら外す
  sel[+k] = id || null;
  const wrap = b.closest('.recwheels');
  wrap.querySelectorAll('[data-recw]').forEach(x => { const [kk, ii] = x.dataset.recw.split(':');
    x.classList.toggle('on', (sel[+kk] || '') === ii); x.classList.toggle('used', !!ii && sel.includes(ii) && sel[+kk] !== ii); });
}
function centerWheels(root){ root?.querySelectorAll('.wheel').forEach(w => { const on = w.querySelector('.on'); if(on) w.scrollTop = on.offsetTop - w.clientHeight / 2 + on.offsetHeight / 2; }); }

/* ---------- 試合前のポイント・ハーフタイムの修正点・試合後の評価 ---------- */
const EVALS = [{ id:'◎', label:'◎ できた' }, { id:'○', label:'○ まあまあ' }, { id:'△', label:'△ できなかった' }];
function htPointsHTML(m){
  const ht = m.points?.ht || [];
  return `<div class="q">後半（次の本）に修正すること（最大3つ）</div>
    <div class="ptsin scribwrap">${[0,1,2].map(i => `<input id="hp${i}" value="${esc(ht[i]?.text || '')}" placeholder="${['例：SBの裏のスペースを使う','例：切り替えを速く','例：CKの守備はゾーンで'][i]}" autocomplete="off">`).join('')}</div>
    <div class="row" style="justify-content:flex-start"><button class="btn small" data-htsave type="button">修正点を保存</button>
    ${(m.points?.pre || []).length ? `<span class="muted" style="font-size:12.5px">試合前のポイント：${m.points.pre.map(x => esc(x.text)).join('／')}</span>` : ''}</div>`;
}
function saveHtPoints(){
  const m = cur(); if(!m) return;
  const old = m.points?.ht || [];
  m.points = { ...(m.points || {}), ht:[0,1,2].map(i => $('#hp' + i).value.trim()).filter(Boolean).map((text, i) => ({ text, eval:old[i]?.eval || null, period:state.timer.p })) };
  save.matches(); toast('修正点を保存しました。試合後に振り返ります');
}

/* ---------- 画面⑤：試合後 ---------- */
function viewPost(){
  const m = match(state.ui.postMatch) || teamMatches().filter(x => x.endedAt).sort((a,b) => b.endedAt.localeCompare(a.endedAt))[0];
  if(!m) return '<div class="empty">終了した試合がありません</div>';
  state.ui.postMatch = m.id;
  const pt = m.points || {}, evalRow = (kind, list) => list.map((x, i) => `<div class="evrow"><span>${esc(x.text)}</span>
    <div class="chips">${EVALS.map(v => `<button type="button" data-peval="${kind}:${i}:${v.id}" aria-pressed="${x.eval === v.id}">${v.label}</button>`).join('')}</div></div>`).join('');
  return `<div class="post">
    ${stepperHTML(m)}
    <div class="row" style="justify-content:flex-start"><button class="btn" data-nav="home" type="button">🏠 トップに戻る</button></div>
    <section class="card panel">
      <div class="hd"><h3>試合前のポイント・修正点をふり返る</h3><span class="muted" style="font-size:12px">チームで話し合って評価をつけましょう</span></div>
      ${(pt.pre || []).length ? `<div class="q">試合前のポイント</div>${evalRow('pre', pt.pre)}` : '<div class="muted" style="font-size:13px">試合前のポイントは入力されていません（試合を作るときに入力できます）</div>'}
      ${(pt.ht || []).length ? `<div class="q" style="margin-top:6px">ハーフタイムの修正点</div>${evalRow('ht', pt.ht)}` : ''}
    </section>
    ${gapPanelHTML(m)}
    ${reviewPanelHTML(m)}
    ${bestPanelHTML(m)}
    ${playerCardsHTML(m)}
    ${videoPanelHTML(m)}
    <section class="card panel">
      <div class="hd"><h3>📄 試合レポート</h3>
        <div class="expbtns"><span class="muted" style="font-size:12px">出力：</span>
          <button class="btn small primary" data-export="pdf" type="button">PDF</button>
          <button class="btn small" data-export="png" type="button">画像（PNG）</button>
          <button class="btn small" data-export="csv" type="button">記録一覧（CSV）</button>
          <button class="btn small" data-export="text" type="button">連絡用テキスト</button>
          <button class="btn small" data-export="chapters" type="button">🎬 動画の目次</button></div></div>
      <div class="paperwrap"><div class="paper" id="reportPaper">${reportHTML(m)}</div></div>
      <p class="muted" style="font-size:12px;margin:0">PDF：印刷・保存用（A4横）／画像：LINE・Classroomに貼る用／CSV：Excel・スプレッドシート用／テキスト：保護者への連絡などに貼り付け</p>
    </section>
    <section class="card panel">
      <div class="hd"><h3>🧑‍🎓 選手の振り返り（Classroom）</h3></div>
      <p style="font-size:13px;margin:0">この試合のまとめを添えて、選手に振り返りを配信します。提出された振り返りは「チームの振り返り」と「選手ポートフォリオ」にたまっていきます。</p>
      <div class="row" style="justify-content:flex-start"><button class="btn" data-classroom type="button">📮 振り返りを配信（Googleドライブ連携が必要）</button>
        <button class="btn" data-openmatch="${m.id}" type="button">📊 データ分析を見る</button></div>
    </section>
    <section class="card panel delzone"><div class="hd"><h3>🗑 この試合を削除</h3><span class="muted" style="font-size:12px">試しに記録した試合などを消します。元に戻せません</span></div>
      <div class="row" style="justify-content:flex-start"><button class="btn danger" data-delmatch="${m.id}" type="button">この試合を削除する</button></div></section>
  </div>`;
}
// 試合レポート（A4横 1枚）。画面・PDF・画像で同じものを使う
function reportHTML(m){
  const ev = evOf(m.id), pk = pkState(m, ev), goals = ev.filter(isGoalEv);
  const shots = ev.filter(e => e.type === 'shot' && e.x != null);
  const firstFm = ev.find(e => e.type === 'formation');
  const idx = m.periods.map((_, i) => i), secs = playSeconds(m, idx);
  const rows = Object.entries(secs).map(([id, s]) => ({ p:player(id), s })).filter(x => x.p).sort((a,b) => b.s - a.s || a.p.num - b.p.num);
  const stat = id => { const my = ev.filter(e => e.type === 'shot' && e.team === 'us' && e.playerId === id);
    return { sh:my.length, g:my.filter(e => e.result === 'goal').length, a:ev.filter(e => e.goal?.assistId === id).length,
      c:ev.filter(e => e.type === 'card' && e.playerId === id).map(e => e.color === 'Y' ? '🟨' : '🟥').join('') }; };
  const perScores = m.periods.filter(p => p.kind !== 'pk').map(p => { const i = m.periods.indexOf(p), pe = ev.filter(e => e.period === i);
    return `${esc(p.label)} ${goalsOf(pe,'us')}-${goalsOf(pe,'them')}`; }).join('　');
  const who = g => g.type === 'og' ? 'OG' : g.team === 'us' ? (g.num ? `#${g.num} ${esc(family(g.name))}` : '') : (g.oppNum || g.goal?.oppNum ? `#${g.oppNum || g.goal.oppNum}` : '');
  const subs = ev.filter(e => e.type === 'sub'), cards = ev.filter(e => e.type === 'card'), marks = ev.filter(e => e.type === 'mark');
  const pts = m.points || {};
  return `<div class="rp">
    <header class="rp-h">
      <div><div class="rp-meta">${esc(dateJP(m.date))}　${esc(m.tournament || m.kind)}${m.tournament ? `（${esc(m.kind)}）` : ''}</div>
        <div class="rp-title"><span>${esc(m.ourName)}</span><b>${goalsOf(ev,'us')} - ${goalsOf(ev,'them')}</b><span>${esc(m.opponent)}</span></div>
        <div class="rp-meta">${perScores}${pk.na + pk.nb ? `　PK ${pk.a}-${pk.b}` : ''}</div></div>
      <div class="rp-brand">${logoLockup(kitOf(m).a, kitOf(m).b)}<small>${esc(team().name)}</small></div>
    </header>
    <div class="rp-grid">
      <div class="rp-col">
        <h4>得点</h4>
        <table class="rp-t">${goals.length ? goals.map(g => `<tr><td>${esc(pShort(m, g.period))} ${g.clock}</td><td class="${g.team}">${g.team === 'us' ? esc(m.ourName) : esc(m.opponent)}</td><td>${who(g)}</td>
          <td class="sm">${g.goal ? esc(lbl(PHASES, g.goal.phase)) + (g.goal.lastPass ? '・' + esc(lbl(LASTPASS, g.goal.lastPass)) : '') : ''}${g.goal?.assistId && player(g.goal.assistId) ? `（A:#${player(g.goal.assistId).num}）` : ''}</td></tr>`).join('') : '<tr><td>得点なし</td></tr>'}</table>
        <h4>スタッツ</h4>${compareTable(ev, m.ourName, m.opponent)}
      </div>
      <div class="rp-col">
        <h4>シュートマップ（${shots.length}本）</h4><div>${pitchHTML({ dots:shots })}</div>
        <h4>先発（${firstFm ? esc(firstFm.us.shape) : '—'}）</h4>
        ${firstFm ? boardHTML({ m, usShape:firstFm.us.shape, usPlayers:firstFm.us.slots.map(s => s.num != null ? s : null), full:true }) : '<div class="sm">フォーメーションの記録なし</div>'}
      </div>
      <div class="rp-col">
        <h4>出場選手</h4>
        <table class="rp-t"><tr class="th"><td>選手</td><td>分</td><td>S</td><td>G</td><td>A</td><td></td></tr>
          ${rows.map(r => { const s = stat(r.p.id); return `<tr><td>#${r.p.num} ${esc(family(r.p.name))}</td><td>${Math.round(r.s / 60)}</td><td>${s.sh || ''}</td><td>${s.g || ''}</td><td>${s.a || ''}</td><td>${s.c}</td></tr>`; }).join('')}</table>
        ${subs.length ? `<h4>交代</h4><div class="sm">${subs.map(e => `${esc(pShort(m, e.period))} ${e.clock} ${e.team === 'them' ? `相手 #${e.outNum ?? '?'}→#${e.inNum}` : `#${e.outNum} ${esc(family(e.outName || ''))} → #${e.inNum} ${esc(family(e.inName || ''))}`}`).join('<br>')}</div>` : ''}
        ${oppNotesLine(m) ? `<h4>相手の注意選手</h4><div class="sm">${esc(oppNotesLine(m))}</div>` : ''}
        ${cards.length ? `<h4>カード</h4><div class="sm">${cards.map(e => esc(evText(e, m))).join('　')}</div>` : ''}
        ${(pts.pre || []).length ? `<h4>試合前のポイント</h4><div class="sm">${pts.pre.map(x => `${x.eval || '・'} ${esc(x.text)}`).join('<br>')}</div>` : ''}
        ${(pts.ht || []).length ? `<h4>修正点</h4><div class="sm">${pts.ht.map(x => `${x.eval || '・'} ${esc(x.text)}`).join('<br>')}</div>` : ''}
        ${m.review?.good || m.review?.issue || m.review?.next ? `<h4>ふり返り</h4><div class="sm">${[['good','良'],['issue','課題'],['next','次の練習']].filter(([k]) => m.review[k]).map(([k, l]) => `<b>${l}</b> ${esc(m.review[k]).replace(/\n/g, ' ')}`).join('<br>')}${m.review.tags?.length ? `<br><b>原則</b> ${m.review.tags.map(esc).join('・')}` : ''}</div>` : ''}
        ${m.best?.id && state.events.find(e => e.id === m.best.id && !e.deleted) ? `<h4>🏆 ベストプレー</h4><div class="sm">${esc(sceneLabel(state.events.find(e => e.id === m.best.id), m))}${m.best.note ? `「${esc(m.best.note)}」` : ''}</div>` : ''}
        ${marks.length ? `<h4>動画チェック（★${marks.length}）</h4><div class="sm">${marks.slice(0, 8).map(e => `${esc(pShort(m, e.period))} ${e.clock}${e.tag ? ' ' + esc(lbl(MARK_TAGS, e.tag)) : ''}`).join('　')}</div>` : ''}
        ${m.recorders?.length ? `<div class="sm" style="margin-top:6px">記録：${m.recorders.map(r => esc(recorderLabel(r))).join('、')}</div>` : ''}
      </div>
    </div>
    ${reportDrawHTML(m)}
  </div>`;
}

/* ---------- 出力（PDF・画像・CSV・テキスト） ---------- */
const LIBS = { h2c:'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', pdf:'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js' };
function loadScript(src){ return new Promise((res, rej) => { if(document.querySelector(`script[src="${src}"]`)) return res();
  const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('load')); document.head.appendChild(s); }); }
function downloadBlob(blob, name){
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  if(/claude/.test(location.hostname)) toast('プレビュー画面ではファイルを保存できません。アプリとして公開後に使えます');
}
async function paperCanvas(){
  await loadScript(LIBS.h2c);
  const el = $('#reportPaper');
  return html2canvas(el, { scale:2, backgroundColor:'#ffffff', useCORS:true, logging:false });
}
async function exportReport(kind){
  const m = match(state.ui.postMatch); if(!m) return;
  const base = `試合結果_${m.date}_vs${m.opponent}`.replace(/[\\/:*?"<>|\s]/g, '');
  try{
    if(kind === 'csv'){
      const head = ['ピリオド','時刻','種類','チーム','内容','選手','背番号','結果','エリア','ゾーン','足','x','y'];
      const typeJP = { shot:'シュート', ck:'CK', fk:'FK', og:'オウンゴール', sub:'交代', card:'カード', mark:'★マーク', formation:'フォーメーション', kickoff:'キックオフ', break:'給水', pkso:'PK戦', win:'ボール奪取' };
      const rows = evOf(m.id).map(e => [pLabel(m, e.period), e.clock, typeJP[e.type] || e.type, e.team === 'us' ? m.ourName : m.opponent, evText(e, m),
        e.name || '', e.num || e.oppNum || '', e.result ? RES[e.result]?.label : '', e.area ? AREA[e.area] : '', e.zoneLabel || '', e.foot ? lbl(FEET, e.foot) : '', e.x ?? '', e.y ?? '']);
      const csv = '﻿' + [head, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
      downloadBlob(new Blob([csv], { type:'text/csv' }), base + '.csv'); return;
    }
    if(kind === 'text'){ showCopy(resultText(m)); return; }
    if(kind === 'chapters'){ showChapters(m); return; }
    toast('出力を準備しています…');
    const canvas = await paperCanvas();
    if(kind === 'png'){ canvas.toBlob(b => downloadBlob(b, base + '.png'), 'image/png'); return; }
    await loadScript(LIBS.pdf);
    const { jsPDF } = window.jspdf, doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });
    // A4横に収まらない長さのときは、ページを分けて続ける
    const w = 297, h = canvas.height / canvas.width * w;
    if(h <= 210) doc.addImage(canvas.toDataURL('image/jpeg', .92), 'JPEG', 0, (210 - h) / 2, w, h);
    else { const pagePx = Math.floor(canvas.width * 210 / 297);
      for(let y = 0, n = 0; y < canvas.height; y += pagePx, n++){
        const c = document.createElement('canvas'), hh = Math.min(pagePx, canvas.height - y); c.width = canvas.width; c.height = hh;
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, hh); g.drawImage(canvas, 0, y, canvas.width, hh, 0, 0, canvas.width, hh);
        if(n) doc.addPage();
        doc.addImage(c.toDataURL('image/jpeg', .92), 'JPEG', 0, 0, w, hh / canvas.width * w); } }
    downloadBlob(doc.output('blob'), base + '.pdf');
  }catch(e){ toast('出力に失敗しました。一度インターネットにつないでから試してください（出力用の部品を読み込みます）'); }
}
function resultText(m){
  const ev = evOf(m.id), pk = pkState(m, ev), goals = ev.filter(isGoalEv);
  const who = g => g.type === 'og' ? 'OG' : g.team === 'us' ? (g.num ? `#${g.num} ${family(g.name)}` : '') : '';
  return [`【試合結果】${dateJP(m.date)} ${m.tournament || m.kind}`,
    `${m.ourName} ${goalsOf(ev,'us')} - ${goalsOf(ev,'them')} ${m.opponent}${pk.na + pk.nb ? `（PK ${pk.a}-${pk.b}）` : ''}`,
    m.periods.filter(p => p.kind !== 'pk').map(p => { const i = m.periods.indexOf(p), pe = ev.filter(e => e.period === i); return `${p.label} ${goalsOf(pe,'us')}-${goalsOf(pe,'them')}`; }).join(' / '),
    goals.filter(g => g.team === 'us').length ? '得点：' + goals.filter(g => g.team === 'us').map(g => `${pShort(m, g.period)} ${g.clock} ${who(g)}`).join('、') : '',
    (m.points?.pre || []).length ? '今日のテーマ：' + m.points.pre.map(x => `${x.eval || ''}${x.text}`).join('、') : '',
    m.best?.id && state.events.find(e => e.id === m.best.id && !e.deleted) ? `ベストプレー：${sceneLabel(state.events.find(e => e.id === m.best.id), m)}${m.best.note ? `「${m.best.note}」` : ''}` : '',
    m.review?.next ? `次の練習でやること：${m.review.next.replace(/\n/g, ' ')}` : '',
  ].filter(Boolean).join('\n');
}

/* ---------- 選手リストの取り込み（スプレッドシートからコピー＆貼り付け／CSV） ---------- */
function importSheet(){
  state.ui.flow = { kind:'import', rows:null, mode:'merge' };
  openSheet(`<h2>📥 選手リストを取り込む</h2>
    <p style="font-size:13px">Googleスプレッドシートで表を選んで<b>コピー</b>し、下に<b>貼り付け</b>てください。1行目に「背番号・名前・学年・ポジション・所属」の見出しがあると自動で読み取ります（順番は自由）。CSVファイルも使えます。</p>
    <textarea id="impText" class="imptext" placeholder="背番号	名前	学年	ポジション	所属
10	田中 大翔	3	MF	○○中"></textarea>
    <div class="row" style="justify-content:flex-start"><label class="btn small" for="impFile">📄 CSVファイルを選ぶ</label><input type="file" id="impFile" accept=".csv,text/csv,text/plain" hidden>
      <button class="btn small" data-impparse type="button">読み取る</button>
      ${state.meta.gas?.url ? '<button class="btn small" data-imppull type="button">☁️ Googleドライブのマスターから読み込む</button>' : ''}</div>
    <div id="impPreview"></div>
    <div class="row"><button class="btn" data-close type="button">キャンセル</button><button class="btn primary" data-impgo type="button" disabled>取り込む</button></div>`, 'xwide');
}
function parseRoster(text){
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
  if(!lines.length) return [];
  const sep = lines[0].includes('\t') ? '\t' : ',';
  const split = l => sep === ',' ? (l.match(/("([^"]|"")*"|[^,]*)(,|$)/g) || []).map(c => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"')) : l.split('\t');
  let head = split(lines[0]).map(h => h.trim());
  const find = keys => head.findIndex(h => keys.some(k => h.includes(k)));
  let col = { num:find(['背番号','番号','No','no','#']), name:find(['名前','氏名','選手']), grade:find(['学年']), pos:find(['ポジション','POS','Pos']), school:find(['所属','学校','チーム']) };
  let body = lines.slice(1);
  if(col.name < 0){ col = { num:0, name:1, grade:2, pos:3, school:4 }; body = lines; }   // 見出しがなければ「背番号・名前・学年・ポジション・所属」の順とみなす
  return body.map(split).map(c => {
    const g = parseInt(String(c[col.grade] ?? '').replace(/[^\d]/g, ''), 10), pos = String(c[col.pos] ?? '').toUpperCase().trim();
    return { num:parseInt(c[col.num], 10), name:String(c[col.name] ?? '').trim(), grade:g >= 1 && g <= 3 ? g : 1,
      pos:POSITIONS.includes(pos) ? pos : '', school:String(c[col.school] ?? '').trim() };
  }).filter(r => r.name && !isNaN(r.num));
}
function importPreview(rows){
  state.ui.flow.rows = rows;
  $('#impPreview').innerHTML = rows.length ? `<div class="q">${rows.length}人を読み取りました</div>
    <div class="tbl-wrap" style="max-height:220px"><table><tr><th>背番号</th><th>名前</th><th>学年</th><th>ポジション</th><th>所属</th><th></th></tr>
    ${rows.map(r => { const ex = state.roster.find(p => p.num === r.num && p.status !== 'retired'); return `<tr><td>${r.num}</td><td>${esc(r.name)}</td><td>${r.grade}年</td><td>${r.pos}</td><td>${esc(r.school)}</td><td>${ex ? (ex.name === r.name ? '<span class="chip us">更新</span>' : `<span class="chip warn">#${r.num} ${esc(ex.name)} と重複</span>`) : '<span class="chip them">追加</span>'}</td></tr>`; }).join('')}</table></div>
    <div class="chips"><button type="button" data-impmode="merge" aria-pressed="${state.ui.flow.mode === 'merge'}">今の名簿に追加・更新</button><button type="button" data-impmode="replace" aria-pressed="${state.ui.flow.mode === 'replace'}">今の名簿を置き換える（元の選手は退部扱い）</button></div>`
    : '<div class="note-banner">選手を読み取れませんでした。見出し（背番号・名前）があるか確認してください。</div>';
  const go = document.querySelector('[data-impgo]'); if(go) go.disabled = !rows.length;
}
function importGo(){
  const f = state.ui.flow, rows = f.rows || [];
  if(f.mode === 'replace') state.roster.forEach(p => { if(p.status !== 'retired' && !rows.some(r => r.name === p.name)){ p.status = 'retired'; p.leftReason = 'left'; } });
  let add = 0, upd = 0;
  rows.forEach(r => {
    const ex = state.roster.find(p => p.name === r.name) || state.roster.find(p => p.num === r.num && p.status !== 'retired' && f.mode === 'merge' && p.name === r.name);
    if(ex){ Object.assign(ex, { num:r.num, grade:r.grade, pos:r.pos || ex.pos, school:r.school || ex.school }); if(ex.status === 'retired') ex.status = 'present'; upd++; }
    else { state.roster.push({ id:'p' + uid(), ...r, status:'present' }); add++; }
  });
  save.roster(); closeSheet(); toast(`追加 ${add}人・更新 ${upd}人`); render();
}

/* ---------- Google ドライブ（スプレッドシート）連携：GAS の Web アプリ経由 ----------
   マスター（チーム・選手・予定）はスプレッドシートが正。アプリは読み込み、試合結果と記録を書き足していく */
function gasSettingsHTML(){
  const g = state.meta.gas || {};
  return `<div class="q">Googleドライブ連携（GAS）</div>
    <p style="font-size:12.5px">マスターのスプレッドシートに付けたGASのWebアプリURLと合言葉を入れると、同期のときに<b>試合結果を書き足し</b>、<b>名簿・予定を読み込み</b>ます。設定方法は同梱の「GAS設定手順」を見てください。</p>
    <label class="field">WebアプリのURL<input id="gasUrl" value="${esc(g.url || '')}" placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off"></label>
    <label class="field">合言葉（GAS側と同じもの）<input id="gasKey" value="${esc(g.key || '')}" placeholder="例：pitch-2026" autocomplete="off"></label>
    <div class="row" style="justify-content:flex-start"><button class="btn small" data-gassave type="button">保存</button><button class="btn small" data-gastest type="button">接続テスト</button>
      ${g.lastPull ? `<span class="muted" style="font-size:12px">最終読み込み：${esc(g.lastPull.slice(0,16).replace('T',' '))}</span>` : ''}</div>`;
}
const isSampleP = p => DEFAULT_ROSTER.some(d => d.id === p.id && d.name === p.name);
async function gasCall(action, payload){
  const g = state.meta.gas || {}; if(!g.url) throw new Error('nourl');
  // 電波が弱いときに止まったままにならないよう、45秒で打ち切る
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 45000);
  try{
    const res = await fetch(`${g.url}?action=${action}&key=${encodeURIComponent(g.key || '')}`, { signal:ac.signal, ...(payload ? { method:'POST', body:JSON.stringify({ key:g.key, action, ...payload }) } : {}) });
    const text = await res.text(); let data;
    try{ data = JSON.parse(text); }
    catch(_){ // Googleから表のデータではなくページ（エラー画面など）が返ってきたとき、その中身の手がかりを出す
      const hint = text.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
      throw new Error(`${action === 'push' ? '送信' : '読み込み'}のとき、Googleから想定外の返事（HTTP ${res.status}）：${hint || '空'}`); }
    if(!data.ok) throw new Error(`${action === 'push' ? '送信' : '読み込み'}：${data.error || 'error'}`); return data;
  }catch(e){ throw e.name === 'AbortError' ? new Error('時間切れ：45秒たっても返事がありません') : e; }
  finally{ clearTimeout(to); }
}
// マスターの読み込み：チーム・選手・予定をアプリに反映（id で突き合わせ、スプレッドシート側を優先）
async function gasPull(){
  const d = await gasCall('master');
  (d.teams || []).forEach(t => { const ex = state.teams.find(x => x.id === t.id || x.name === t.name);
    if(ex) Object.assign(ex, { name:t.name, short:t.short || ex.short, category:t.category || ex.category, kits:t.kits || ex.kits, id:ex.id });
    else state.teams.push({ id:t.id || 't' + uid(), name:t.name, short:t.short || t.name, category:t.category || 'その他', kits:t.kits || JSON.parse(JSON.stringify(DEFAULT_KITS)), lastKit:1 }); });
  save.teams();
  const tm = team(), players = (d.players || []).filter(p => p.team === tm.name || p.teamId === tm.id);
  players.forEach(p => { const ex = state.roster.find(x => (p.id && x.id === p.id) || x.name === p.name);
    const st = p.status === '退部' || p.status === '卒業' ? 'retired' : null;
    if(ex) Object.assign(ex, { num:+p.num || ex.num, name:p.name, grade:+p.grade || ex.grade, pos:p.pos || ex.pos, school:p.school || ex.school, ...(st ? { status:st } : {}) });
    else state.roster.push({ id:p.id || 'p' + uid(), num:+p.num, name:p.name, grade:+p.grade || 1, pos:p.pos || '', school:p.school || '', status:st || 'present' }); });
  // シートから選手を読み込めたら、最初から入っている見本の選手（試合の記録に出てこないもの）は名簿から外す
  if(players.length){ const used = new Set(state.events.flatMap(e => [e.playerId, e.inId, e.outId, e.goal?.assistId, ...(e.lineup || [])]).filter(Boolean));
    state.roster = state.roster.filter(p => !isSampleP(p) || used.has(p.id)); ensureLineup(); }
  save.roster();
  (d.schedule || []).filter(s => s.team === tm.name || s.teamId === tm.id).forEach(s => {
    if(state.matches.some(m => m.id === s.id || (m.srcId && m.srcId === s.id))) return;
    // 同じ日・同じ相手の試合がすでにiPadにあれば（iPadで先に作った予定など）、二重にせずその試合とひも付ける
    const same = state.matches.find(m => !m.deleted && m.teamId === tm.id && m.date === s.date && m.opponent === (s.opponent || '相手'));
    if(same){ same.srcId = s.id; return; }
    const official = s.kind === '公式戦', min = +s.min || 30, cnt = +s.count || 2;
    const periods = official ? [{ label:'前半', short:'1ST', min, kind:'reg' }, { label:'後半', short:'2ND', min, kind:'reg' }]
      : Array.from({ length:cnt }, (_, i) => ({ label:`${i+1}本目`, short:`${i+1}本`, min, kind:'reg' }));
    state.matches.push({ id:'m' + uid(), srcId:s.id, teamId:tm.id, status:'planned', date:s.date, kind:s.kind || '練習試合', opponent:s.opponent || '相手', tournament:s.tournament || '',
      ourName:tm.short || tm.name, kit:1, kitColors:{ ...tm.kits[1] }, createdAt:new Date().toISOString(), endedAt:null, pkFirst:null,
      et:{ enabled:official, min:10 }, pk:{ enabled:official }, points:{ pre:(s.points || []).filter(Boolean).map(text => ({ text, eval:null })) },
      periods:periods.map(p => ({ ...p, kickoff:null, attack:null, played:0 })) }); });
  save.matches();
  state.meta.gas = { ...(state.meta.gas || {}), lastPull:new Date().toISOString() }; save.meta();
  return { players:players.length, schedule:(d.schedule || []).length };
}
// 試合結果と記録を書き足す（id で上書き保存。削除した記録は deleted の印で送る）
// スプレッドシートの1つのマスには50,000文字までしか入らない。Apple Pencilの作図が多い記録・試合は、作図だけ省いて送る（作図はiPadに残る）
const SHEET_MAX = 45000;
function slimForSheet(o){
  if(JSON.stringify(o).length < SHEET_MAX) return o;
  const c = JSON.parse(JSON.stringify(o)), omit = { omitted:true, note:'作図はiPadに保存（大きいためシートでは省略）' };
  ['sketch', 'buildup'].forEach(k => { if(c[k]) c[k] = omit; });
  if(c.boards) c.boards = c.boards.map(b => ({ label:b.label, ...omit }));
  if(JSON.stringify(c).length >= SHEET_MAX) Object.keys(c).forEach(k => { if(JSON.stringify(c[k] ?? '').length > 8000) c[k] = omit; });
  return c;
}
async function gasPush(){
  const evs = unsynced(), ids = new Set(evs.map(e => e.matchId));
  // 変更のあった試合と、まだ一度も送っていない試合（前の版で作った予定など）を送る。見本の試合は送らない
  state.matches.filter(m => (m.dirty || !m.pushedAt) && !m.sample).forEach(m => ids.add(m.id));
  const matches = state.matches.filter(m => ids.has(m.id) && !m.sample).map(m => { const ev = evOf(m.id), pk = pkState(m, ev);
    return slimForSheet({ ...m, teamName:(state.teams.find(t => t.id === m.teamId) || {}).name, scoreUs:goalsOf(ev,'us'), scoreThem:goalsOf(ev,'them'), pk:pk.na + pk.nb ? `${pk.a}-${pk.b}` : '',
      recordersText:(m.recorders || []).map(recorderLabel).join('、'),
      pointsText:[...(m.points?.pre || []).map(x => `[前]${x.eval || ''}${x.text}`), ...(m.points?.ht || []).map(x => `[HT]${x.eval || ''}${x.text}`),
        ...[['good','良'],['issue','課題'],['next','次']].filter(([k]) => m.review?.[k]).map(([k, l]) => `[${l}]${m.review[k].replace(/\n/g, ' ')}`)].join(' / ') }); });
  const events = evs.map(e => { const m = match(e.matchId); return slimForSheet({ ...e, text:m ? evText(e, m) : '' }); });
  const r = await gasCall('push', { team:team(), roster:state.roster.filter(p => !isSampleP(p)), matches, events });   // 見本の選手はシートに送らない
  evs.forEach(e => e.synced = true); state.matches.forEach(m => { if(ids.has(m.id)) m.pushedAt = new Date().toISOString(); delete m.dirty; });
  state.matches = state.matches.filter(m => !m.deleted); save.matches();   // 削除した試合は、シートに「削除」を送り終えたら端末から消す
  state.events = state.events.filter(e => !(e.deleted && e.synced));
  save.events(); state.meta.lastSync = new Date().toISOString(); save.meta();
  return { events:evs.length, matches:matches.length, ...r };
}
let syncBusy = false;
// 同期中は、ボタンに回るマークと「送信中／読み込み中」を出し、画面の上にも細い帯を流す
function syncUI(on, label){
  const b = $('#syncBtn'); if(!b) return;
  b.classList.toggle('syncing', on); b.disabled = on;
  b.innerHTML = on ? `<span class="spin" aria-hidden="true"></span>同期中 ${label || ''}` : `☁️ ドライブへ同期 <span class="badge ${unsynced().length ? '' : 'zero'}" id="syncBadge">${unsynced().length}</span>`;
  document.body.classList.toggle('syncing', on);
}
async function syncNow(){
  if(!state.meta.gas?.url){ runSync(); return; }   // 未設定のときは従来どおり（コンソールへ出力）
  if(!navigator.onLine){ toast('オフラインです。Wi-Fiにつないでから同期してください'); return; }
  if(syncBusy) return;
  syncBusy = true; syncUI(true, '送信中…');
  try{ const p = await gasPush(); syncUI(true, '読み込み中…'); const q = await gasPull(); beep('ok');
    state.meta.lastSyncInfo = { at:new Date().toISOString(), ok:true, events:p.events, matches:p.matches, players:q.players, schedule:q.schedule }; save.meta();
    syncBusy = false; syncUI(false); toast(`✅ 同期しました：記録${p.events}件・試合${p.matches}件を送信／名簿${q.players}人と予定を読み込み`); render(); }
  catch(e){ syncBusy = false; syncUI(false);
    state.meta.lastSyncInfo = { at:new Date().toISOString(), ok:false, error:e.message }; save.meta();
    toast(e.message === 'nourl' ? 'GASのURLが未設定です' : `⚠️ 同期に失敗しました（${e.message}）。電波の良い場所でもう一度試してください`); render(); }
}
