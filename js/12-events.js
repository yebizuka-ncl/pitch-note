"use strict";
/* =========================================================
   11. イベント
   ========================================================= */
document.addEventListener('click', e => {
  if(e.target.closest('#sheet')) return;
  const tu = e.target.closest('[data-undoid]');
  if(tu){ const ev = state.events.find(x => x.id === tu.dataset.undoid);
    if(ev && !ev.deleted){ removeEvent(ev); state.ui.pick = null; state.ui.markTag = null; beep('undo'); toast('取り消しました'); render(); } else $('#toast').hidden = true; return; }
  if(e.target.closest('[data-hold]')) return;   // 長押しボタンはpointerイベントで処理
  const pb = e.target.closest('#pop button'); if(pb){ popClick(pb); return; }
  if(e.target.closest('#pop')) return;
  const bfm = e.target.closest('[data-bfm]'); if(bfm){ const side = bfm.dataset.bfm; if(state.ui.pop?.fm === side) closePop(); else showPop({ fm:side }); return; }
  const bp0 = e.target.closest('[data-bp]');
  if(bp0){ const [side, i] = bp0.dataset.bp.split(':'), idx = +i;
    const pk = state.ui.pick; if(pk && Date.now() < pk.until && pk.side === side){ applyPick(side, idx); return; }
    if(state.ui.swapFrom != null && side === 'us'){ const sl = fmCur().us.slots, a = state.ui.swapFrom; state.ui.swapFrom = null;
      if(a !== idx){ [sl[a], sl[idx]] = [sl[idx], sl[a]]; save.fm(); recordFormationIfStarted(); toast('ポジションを入れ替えました'); } render(); return; }
    if(side === 'us' && !fmCur().us.shape){ membersSheet(); return; }
    if(state.ui.pop && state.ui.pop.side === side && state.ui.pop.idx === idx) closePop(); else showPop({ side, idx });
    return; }
  if(e.target.closest('[data-scorepop]')){ if(state.ui.pop?.kind === 'score') closePop(); else showPop({ kind:'score' }); return; }
  if(state.ui.pop){ closePop(); }
  if(state.ui.swapFrom != null){ state.ui.swapFrom = null; render(); }
  if(e.target.closest('.pitch[data-tap]')) return;   // ピッチはpointerイベントで処理
  const stp = e.target.closest('[data-step]');
  if(stp && !stp.disabled){ goStep(+stp.dataset.step); return; }
  const row = e.target.closest('tr[data-fmrow]');
  if(row){ state.ui.fmPeriod = +row.dataset.fmrow; render(); return; }
  const edt = e.target.closest('[data-edit]');
  if(edt){ openEdit(edt.dataset.edit); return; }
  const bp = e.target.closest('[data-bp]');
  if(bp){ const [side, i] = bp.dataset.bp.split(':'); openPlayer(side, +i); return; }
  const b = e.target.closest('button'); if(!b) return;
  const d = b.dataset;
  if(d.nav){ state.ui.pop = null; if(!state.teamId) loadTeam(state.teams[0].id); state.ui.screen = d.nav; state.ui.resetArmed = false; render(); $('#main').scrollTop = 0; return; }
  if(d.go){ state.ui.screen = d.go; render(); return; }
  if('back' in d){ goBack(); return; }
  if((d.reg || d.reglim || 'regpresent' in d || d.regcopy || 'regclear' in d) && regClick(d)) return;
  if('stepnext' in d){ stepNext(); return; }
  if('newmatch' in d){ matchSheet(null); centerWheels($('#sheet')); return; }
  if(d.planstart){ beginMatch(d.planstart); return; }
  if(d.planedit){ matchSheet(d.planedit); centerWheels($('#sheet')); return; }
  if(d.peval){ const [k, i, v] = d.peval.split(':'), m = match(state.ui.postMatch); const it = m?.points?.[k]?.[+i];
    if(it){ it.eval = it.eval === v ? null : v; m.dirty = true; save.matches(); render(); } return; }
  if(d.export){ exportReport(d.export); return; }
  if('classroom' in d){ openModal({ title:'📮 振り返りの配信', body:`<p>Classroomへの配信は、Googleドライブ連携（GAS）を設定すると使えるようになります（次の段階で実装します）。</p><p style="font-size:13px">配信すると、この試合のまとめ付きの振り返りページが選手に届き、提出された振り返りが「チームの振り返り」と「選手ポートフォリオ」にたまります。</p>`, actions:[{ label:'閉じる', kind:'primary' }] }); return; }
  if('import' in d){ importSheet(); return; }
  if(d.dmode){ state.ui.dataMode = d.dmode; state.ui.dataMatch = null; state.ui.dataPeriod = 'all'; state.ui.fmPeriod = null; render(); return; }
  if('goteams' in d){ state.ui.screen = 'teams'; render(); $('#main').scrollTop = 0; return; }
  if(d.teamopen){ openTeam(d.teamopen); return; }
  if(d.teamedit){ teamSheet(d.teamedit); return; }
  if('teamnew' in d){ teamSheet(null); return; }
  if(d.kitpick){ state.ui.setupKit = +d.kitpick; applyTheme();
    document.querySelectorAll('[data-kitpick]').forEach(x => x.setAttribute('aria-pressed', x.dataset.kitpick === d.kitpick)); return; }
  if('sync' in d){ $('#syncBtn').click(); return; }
  if(d.recpick){ b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true'); return; }
  if('startmatch' in d){ startMatch(); return; }
  if('endmatch' in d){ endMatch(); return; }
  if(d.openmatch){ const m = match(d.openmatch); state.ui.dataMode = 'day'; state.ui.dataDate = m.date; state.ui.dataMatch = m.id; state.ui.dataPeriod = 'all'; state.ui.fmPeriod = null; state.ui.screen = 'data'; render(); return; }
  if(d.st && d.pid){ player(d.pid).status = d.st; save.roster(); ensureLineup(); render(); return; }
  if('allpresent' in d){ state.roster.forEach(p => p.status = 'present'); save.roster(); toast('全選手を「参加」にしました'); render(); return; }
  if('rosteredit' in d){ state.ui.rosterEdit = !state.ui.rosterEdit; render(); return; }
  if(d.prestore){ const p = player(d.prestore); p.status = 'present'; delete p.leftReason; save.roster(); toast(`${p.name} を名簿に戻しました`); render(); return; }
  if('yearup' in d){ const g3 = state.roster.filter(p => p.status !== 'retired' && p.grade === 3), y = new Date().getFullYear();
    openModal({ title:'🎓 年度を更新しますか？', body:`<p>3年生 <b>${g3.length}人</b> を「卒業」にして、1・2年生の学年を1つ上げます。</p><p style="font-size:13px">卒業した選手の過去の記録は残ります。新1年生は、このあと「＋ 1年の選手を追加」から登録してください。</p>`,
      actions:[{ label:'キャンセル' }, { label:'年度を更新する', kind:'primary', onClick:() => {
        state.roster.forEach(p => { if(p.status === 'retired') return; if(p.grade >= 3){ p.status = 'retired'; p.leftReason = 'graduated'; p.leftYear = y; } else p.grade++; });
        save.roster(); ensureLineup(); toast('年度を更新しました'); render(); } }] }); return; }
  if(d.pedit){ playerSheet(d.pedit); return; }
  if(d.padd){ playerSheet(null, +d.padd); return; }
  if(d.team){ state.ui.team = d.team; render(); return; }
  if(d.ev){ markTapTime(); showPop({ kind:d.ev }); return; }
  if('mark' in d){ addMark(); return; }
  if(d.mtag){ const e = state.events.find(x => x.id === state.ui.markTag?.id); if(e){ e.tag = d.mtag; e.synced = false; save.events(); } state.ui.markTag = null; toast(`★ ${lbl(MARK_TAGS, d.mtag)}`); render(); return; }
  if('pickskip' in d){ state.ui.pick = null; render(); return; }
  if('video' in d){ const m = cur(); if(!m) return;
    if(!m.videoStart){ m.videoStart = Date.now(); save.matches(); beep('ok'); toast('🎥 撮影開始の時刻を記録しました。★マークの「動画の時間」がこの時刻基準になります'); render(); }
    else openModal({ title:'🎥 撮影開始の時刻', body:`<p>${new Date(m.videoStart).toLocaleTimeString('ja-JP')} に撮影開始を記録しています。撮影をやり直した場合は記録し直してください。</p>`,
      actions:[{ label:'閉じる' }, { label:'今の時刻で記録し直す', kind:'primary', onClick:() => { m.videoStart = Date.now(); save.matches(); toast('撮影開始を記録し直しました'); render(); } }] });
    return; }
  if('addpast' in d){ state.ui.flow = null; addPastSheet(); return; }
  if('atset' in d){ showPop({ kind:'at' }); return; }
  if('settings' in d){ settingsSheet(); return; }
  if(d.markedit){ openMark(d.markedit); return; }
  if('clearpos' in d){ state.ui.pos = null; render(); return; }
  if(d.timer){ timerAction(d.timer); return; }
  if('periods' in d){ periodSheet(); return; }
  if('brkopen' in d){ breakSheet(); return; }
  if('brkend' in d){ endBreak(false); return; }
  if(d.pkfirst){ cur().pkFirst = d.pkfirst; save.matches(); render(); return; }
  if(d.pkkicker){ state.ui.pkKicker = state.ui.pkKicker === d.pkkicker ? null : d.pkkicker; render(); return; }
  if(d.pk){ const m = cur(), s = pkState(m, evOf(m.id)); if(!s.next) return;
    const e = baseEvent('pkso'); e.team = s.next; e.no = s.nextNo; e.scored = d.pk === 'goal'; e.miss = d.pk === 'goal' ? null : d.pk; e.course = state.ui.pkCourse || null; state.ui.pkCourse = null;
    if(s.next === 'us' && state.ui.pkKicker){ const p = player(state.ui.pkKicker); Object.assign(e, { playerId:p.id, num:p.num, name:p.name }); }
    pushEvent(e); state.ui.pkKicker = null;
    const s2 = pkState(m, evOf(m.id));
    if(s2.winner === 'us') celebrate(`PK ${s2.a}-${s2.b}`);
    render(); return; }
  if('undo' in d){ undo(); return; }
  if(d.del){ const ev = state.events.find(x => x.id === d.del); if(!ev) return;
    openModal({ title:'この記録を削除しますか？', body:`<p>${esc(evText(ev, match(ev.matchId)))}</p>`,
      actions:[{ label:'キャンセル' }, { label:'削除する', kind:'danger', onClick:() => { removeEvent(ev); toast('削除しました'); render(); } }] }); return; }
  if('members' in d){ membersSheet(); return; }
  if('logopen' in d){ logSheet(); return; }
  if('oppshape' in d){ showPop({ fm:'them' }); return; }
  if('formation' in d){ state.ui.fmSel = null; state.ui.fmTeam = 'us'; fmSheet(); return; }
  if('halftime' in d){ halftimeSheet(); return; }
  if(d.goaledit){ openGoal(d.goaledit); return; }
  if(d.dper){ state.ui.dataPeriod = d.dper; render(); return; }
  if('copymarks' in d){ copyMarks(); return; }
  if('sample' in d){ seedSample(); return; }
  if('clearsample' in d){ const ids = new Set(teamMatches().filter(x => x.sample).map(x => x.id));
    state.matches = state.matches.filter(x => !ids.has(x.id)); state.events = state.events.filter(x => !ids.has(x.matchId));
    save.matches(); save.events(); state.ui.dataDate = null; state.ui.dataMatch = null; toast('サンプルを削除しました'); render(); return; }
  if('ai' in d){
    openModal({ title:'🤖 AI分析レポート', body:`<p>Geminiにデータを送信してレポートを生成します。</p>
      <p style="font-size:13px">送る内容：選んだ日・試合のシュート（位置・結果）、CK・FK、得点・失点の分析、フォーメーションの変更、★マークのメモ、選手の出場時間。現在はプロトタイプのため、実際には送信されません。</p>`,
      actions:[{ label:'閉じる', kind:'primary' }] });
  }
});
$('#sheet').addEventListener('click', e => {
  const edt = e.target.closest('[data-edit]');
  if(edt){ openEdit(edt.dataset.edit); return; }
  const b = e.target.closest('button'); if(!b) return;
  const d = b.dataset, f = state.ui.flow;
  if(d.mi !== undefined){ const a = state.ui.modal?.[+d.mi]; closeSheet(); a?.onClick?.(); return; }
  if('close' in d){ closeSheet(); render(); return; }
  if('dosub' in d){ doSub(); return; }
  if('endmatch' in d){ closeSheet(); endMatch(); return; }
  if(d.setp){ setPeriod(+d.setp); return; }
  if('teamsave' in d){ saveTeam(); return; }
  if('teamdel' in d){ const id = f.id, t = state.teams.find(x => x.id === id);
    openModal({ title:`「${esc(t.name)}」を削除しますか？`, body:'<p>このチームの名簿と試合の記録もすべて消えます。元に戻せません。</p>',
      actions:[{ label:'キャンセル' }, { label:'削除する', kind:'danger', onClick:() => {
        const ids = new Set(state.matches.filter(m => m.teamId === id).map(m => m.id));
        state.matches = state.matches.filter(m => !ids.has(m.id)); state.events = state.events.filter(e => !ids.has(e.matchId));
        ['roster','lineup','current','timer','fm'].forEach(k => Store.remove(`pn.${k}.v6.${id}`));
        state.teams = state.teams.filter(x => x.id !== id); save.teams(); save.matches(); save.events();
        if(state.teamId === id) loadTeam(state.teams[0].id);
        state.ui.screen = 'teams'; render(); } }] }); return; }
  if(d.addp){ addPeriods('reg', +d.addp); return; }
  if('addet' in d){ addPeriods('et'); return; }
  if('addpk' in d){ addPeriods('pk'); return; }
  if('koedit' in d){ state.ui.flow = null; kickoffSheet(true); return; }
  if('kostarters' in d){ state.ui.flow = null; starterSheet('ko'); return; }
  if(d.goaledit){ openGoal(d.goaledit); return; }
  if(d.markedit){ openMark(d.markedit); return; }
  if('backup' in d){ exportBackup(); return; }
  if(d.kitpick){ state.ui.setupKit = +d.kitpick; applyTheme(); $('#sheet').querySelectorAll('[data-kitpick]').forEach(x => x.setAttribute('aria-pressed', x.dataset.kitpick === d.kitpick)); return; }
  if(d.recw !== undefined){ recWheelClick(b); return; }
  if(d.msave){ saveMatchForm(d.msave); return; }
  if('mdelplan' in d){ const id = f.id, pm = match(id); if(pm?.srcId){ state.meta.deletedSrc = [...new Set([...(state.meta.deletedSrc || []), pm.srcId])]; save.meta(); }
    if(pm?.pushedAt){ pm.deleted = true; pm.dirty = true; save.matches(); closeSheet(); toast('予定を削除しました（次の同期でシートにも反映します）'); render(); return; }
    state.matches = state.matches.filter(x => x.id !== id); save.matches(); closeSheet(); toast('予定を削除しました'); render(); return; }
  if('htsave' in d){ saveHtPoints(); return; }
  if('impparse' in d){ importPreview(parseRoster($('#impText').value)); return; }
  if('imppull' in d){ gasPull().then(r => { closeSheet(); toast(`Googleドライブから名簿${r.players}人を読み込みました`); render(); }).catch(err => toast(`読み込めませんでした（${err.message}）`)); return; }
  if(d.impmode){ f.mode = d.impmode; importPreview(f.rows || []); return; }
  if('impgo' in d){ importGo(); return; }
  if('gassave' in d){ state.meta.gas = { ...(state.meta.gas || {}), url:$('#gasUrl').value.trim(), key:$('#gasKey').value.trim() }; save.meta(); toast('Googleドライブ連携の設定を保存しました'); return; }
  if('gastest' in d){ state.meta.gas = { ...(state.meta.gas || {}), url:$('#gasUrl').value.trim(), key:$('#gasKey').value.trim() }; save.meta();
    gasCall('ping').then(r => toast(`接続できました：${r.name || 'マスター'}`)).catch(err => toast(`接続できませんでした（${err.message}）`)); return; }
  if('recorders' in d){ recorderSheet(); return; }
  if(f?.kind === 'recorders'){
    if('recsave' in d){ cur().recorders = (state.ui.recSel || []).filter(Boolean).slice(0, 3); save.matches(); closeSheet(); toast('記録者を保存しました'); render(); return; } }
  if(f?.kind === 'bsub' && (d.bout || d.bin || d.bdel !== undefined || 'bgo' in d)){ batchSubClick(d); return; }
  if(f?.kind === 'addpast'){ if('apgo' in d){ addPastGo(); return; } if(d.g){ f.draft[d.g] = d.v; addPastSheet(); return; } }
  if('undo' in d){ undo(); if(evOf(state.current).length) logSheet(); else closeSheet(); return; }
  if(f?.kind === 'pmenu'){
    if('pmback' in d){ f.mode = null; renderSheet(); return; }
    if(d.pmode){ f.mode = d.pmode; renderSheet(); return; }
    if(d.pcard){ giveCard(f.side, f.idx, d.pcard); return; }
    if('pstarters' in d){ state.ui.flow = null; starterSheet(null); return; }
    if(d.psubin){ state.ui.subOut = fmCur().us.slots[f.idx]; state.ui.subIn = d.psubin; doSub(); return; }
    if(d.pswap !== undefined){ const sl = fmCur().us.slots, k = +d.pswap; [sl[f.idx], sl[k]] = [sl[k], sl[f.idx]]; save.fm(); closeSheet(); toast('ポジションを入れ替えました'); render(); return; }
    if(d.onum !== undefined){ setOppNum(d.onum === '' ? null : +d.onum); return; }
  }
  if(d.brk){ startBreak(d.brk); return; }
  // フォーメーション
  if(d.fmteam && d.fmteam !== 'x'){ state.ui.fmTeam = d.fmteam; fmSheet(); return; }
  if(d.fshape !== undefined){ const cf = fmCur();
    if(state.ui.fmTeam === 'us'){ cf.us.shape = d.fshape; if(!cf.us.slots.some(Boolean)) autoArrange(); }
    else cf.them.shape = d.fshape || null;
    save.fm(); state.ui.fmSel = null; fmSheet(); return; }
  if('fauto' in d){ autoArrange(); state.ui.fmSel = null; fmSheet(); return; }
  if('fsave' in d){ saveFormation(); return; }
  if(d.fslot !== undefined){
    const i = +d.fslot, s = state.ui.fmSel, sl = fmCur().us.slots;
    if(s === null) state.ui.fmSel = i; else if(s === i) state.ui.fmSel = null;
    else { [sl[s], sl[i]] = [sl[i], sl[s]]; state.ui.fmSel = null; save.fm(); }
    fmSheet(); return;
  }
  if(d.fplayer){
    const s = state.ui.fmSel; if(s === null){ toast('先にポジションの丸をタップしてください'); return; }
    const sl = fmCur().us.slots, k = sl.indexOf(d.fplayer);
    if(k >= 0) sl[k] = sl[s] ?? null;
    sl[s] = d.fplayer; state.ui.fmSel = null; save.fm(); fmSheet(); return;
  }
  if(!f) return;
  if(f.kind === 'starters'){
    if(d.ststep){ const st = +d.ststep; if(st === 2 && !f.shape) return; f.step = st; starterSheet(f.then); return; }
    if(d.stshape){ f.shape = d.stshape; starterSheet(f.then); return; }
    if('stnext' in d){ f.step = 2; if(!f.slots.some(Boolean)) stAuto(); starterSheet(f.then); return; }
    if(d.stp){ const pid = d.stp;
      if(f.selS != null) stAssign(pid, f.selS); else f.selP = f.selP === pid ? null : pid;
      starterSheet(f.then); return; }
    if(d.stslot !== undefined){ const i = +d.stslot;
      if(f.selP) stAssign(f.selP, i);
      else if(f.selS === i) f.selS = null;
      else if(f.selS != null){ [f.slots[f.selS], f.slots[i]] = [f.slots[i], f.slots[f.selS]]; f.selS = null; }   // ポジションどうしで入れ替え
      else f.selS = i;
      starterSheet(f.then); return; }
    if('stbench' in d){ const k = f.slots.indexOf(f.selP); if(k >= 0) f.slots[k] = null; f.selP = null; starterSheet(f.then); return; }
    if('stauto' in d){ stAuto(); starterSheet(f.then); return; }
    if('stprev' in d){ const pv = cur().prevFm; f.slots = (pv?.slots || []).map(id => player(id)?.status === 'present' ? id : null);
      while(f.slots.length < 11) f.slots.push(null); f.selP = f.selS = null; starterSheet(f.then); return; }
    if('stclear' in d){ f.slots = Array(11).fill(null); f.selP = f.selS = null; starterSheet(f.then); return; }
    if('stok' in d){ confirmStarters(); return; }
  }
  if(d.ckt){ commitCK(d.ckt); return; }
  if(d.fkp){ commitFK(d.fkp); return; }
  if('ogok' in d){ commitOG(); return; }
  if(f.kind === 'edit'){
    if('edsave' in d){ saveEdit(); return; }
    if('eddel' in d){ const ev = state.events.find(x => x.id === f.eventId);
      openModal({ title:'この記録を削除しますか？', body:`<p>${esc(evText(ev, match(ev.matchId)))}</p>`,
        actions:[{ label:'キャンセル' }, { label:'削除する', kind:'danger', onClick:() => { removeEvent(ev); toast('削除しました'); render(); } }] }); return; }
  }
  if(f.kind === 'ko'){
    if(d.ko){ f.draft[d.ko] = d.v; kickoffSheet(f.edit); return; }
    if('kogo' in d){ confirmKickoff(); return; }
  }
  if(f.kind === 'player'){
    if('psave' in d){
      const num = parseInt($('#pNum').value, 10), name = $('#pName').value.trim(), grade = +$('#pGrade').value, pos = $('#pPos').value;
      if(!name || isNaN(num)){ toast('背番号と名前を入力してください'); return; }
      if(state.roster.some(p => p.num === num && p.id !== f.id)){ toast(`背番号${num}はすでに使われています`); return; }
      const school = ($('#pSchool')?.value || '').trim();
      if(f.id) Object.assign(player(f.id), { num, name, grade, pos, school });
      else state.roster.push({ id:'p' + uid(), num, name, grade, pos, school, status:'present' });
      save.roster(); closeSheet(); toast('名簿を保存しました'); render(); return;
    }
    if('pretire' in d){ const p = player(f.id); p.status = 'retired'; p.leftReason = 'left'; p.leftYear = new Date().getFullYear();
      state.lineup = state.lineup.filter(x => x !== p.id); save.roster(); save.lineup(); closeSheet(); toast(`${p.name} を退部・卒業にしました（記録は残ります）`); render(); return; }
    if('pdel' in d){ const id = f.id; state.roster = state.roster.filter(p => p.id !== id); state.lineup = state.lineup.filter(x => x !== id);
      save.roster(); save.lineup(); closeSheet(); toast('名簿から削除しました（過去の記録は残ります）'); render(); return; }
  }
  if(d.res){ f.draft.result = d.res; f.step = 'shooter'; renderSheet(); return; }
  if(d.shooternum){ f.draft.oppNum = +d.shooternum; commitShot(); return; }
  if(d.shooter !== undefined){ f.draft.playerId = d.shooter || null; commitShot(); return; }
  if(d.g){
    const v = ['lane','oppNum'].includes(d.g) ? +d.v : d.v, prev = f.draft[d.g];
    f.draft[d.g] = ['team','fkKind'].includes(d.g) ? v : (prev === v ? null : v);
    if(d.g === 'phase' && prev !== f.draft.phase){ f.draft.detail = null; if(f.draft.phase === 'setpiece') f.draft.originZone = null; }
    renderSheet(); return;
  }
  if(f.kind === 'mark'){
    const ev = state.events.find(x => x.id === f.eventId);
    if('msave' in d && ev){ Object.assign(ev, { tag:f.draft.tag, playerId:f.draft.playerId, note:($('#markNote')?.value || '').trim(), synced:false }); save.events(); toast('★マークを保存しました'); }
    if('mdel' in d && ev){ removeEvent(ev); toast('★マークを削除しました'); }
    closeSheet(); render(); return;
  }
  if('gsave' in d || 'glater' in d){
    const ev = state.events.find(x => x.id === f.eventId);
    if(ev && 'gsave' in d){ ev.goal = { ...f.draft }; ev.synced = false; save.events();
      toast(isGoalDone(ev.goal) ? 'ゴールの状況を保存しました' : '途中まで保存しました（あとで続きを入力できます）'); }
    else toast('あとで「状況を入力」から入力できます');
    closeSheet(); render(); return;
  }
});
$('#sheet').addEventListener('input', e => {
  const f = state.ui.flow; if(!f) return;
  if(e.target.id === 'markNote' && f.kind === 'mark') f.draft.note = e.target.value;
  if(e.target.id === 'edMm' && f.kind === 'edit') f.draft.mm = e.target.value;
  if(e.target.id === 'edSs' && f.kind === 'edit') f.draft.ss = e.target.value;
  if(e.target.id === 'apMm' && f.kind === 'addpast') f.draft.mm = e.target.value;
  if(e.target.id === 'apSs' && f.kind === 'addpast') f.draft.ss = e.target.value;
});
$('#sheet').addEventListener('change', e => {
  const el = e.target;
  if(setSubRule(el)){ if(state.ui.flow?.kind === 'bsub') batchSubSheet(); else if(state.ui.flow?.kind === 'pmenu') openSheet(playerMenuHTML()); return; }
  if(el.dataset.sub === 'out'){ state.ui.subOut = el.value; membersSheet(); }
  if(el.dataset.sub === 'in'){ state.ui.subIn = el.value; membersSheet(); }
  if(el.id === 'mKind'){ const off = el.value === '公式戦';
    $('#sheet').querySelector('[data-kindblock="official"]').hidden = !off; $('#sheet').querySelector('[data-kindblock="practice"]').hidden = off; }
  if(el.id === 'impFile' && el.files[0]){ const rd = new FileReader(); rd.onload = () => { $('#impText').value = rd.result; importPreview(parseRoster(rd.result)); }; rd.readAsText(el.files[0]); }
  if(el.id === 'edPer' && state.ui.flow?.kind === 'edit') state.ui.flow.draft.period = +el.value;
  if(el.id === 'stThem' && state.ui.flow?.kind === 'starters') state.ui.flow.them = el.value || null;
  if(el.id === 'oppAuto' && state.ui.flow?.kind === 'pmenu') state.ui.flow.auto = el.checked;
  if(el.id === 'setSound'){ state.meta.settings.sound = el.checked; save.meta(); if(el.checked) beep('ok'); }
  if(el.id === 'setLefty'){ state.meta.settings.lefty = el.checked; save.meta(); render(); }
  if(el.id === 'setBright'){ state.meta.bright = el.checked; save.meta(); applyTheme(); }
  if(el.id === 'restoreFile' && el.files[0]){ importBackup(el.files[0]); el.value = ''; }
  if(el.id === 'apPer' && state.ui.flow?.kind === 'addpast') state.ui.flow.draft.period = +el.value;
});
document.addEventListener('change', e => {
  const el = e.target; if(el.closest('#sheet')) return;
  if(el.id === 'mKind'){ const off = el.value === '公式戦';
    document.querySelector('[data-kindblock="official"]').hidden = !off; document.querySelector('[data-kindblock="practice"]').hidden = off; }
  if('dtour' in el.dataset){ state.ui.dataTour = el.value; state.ui.dataMatch = null; state.ui.dataPeriod = 'all'; render(); }
  if('dyear' in el.dataset){ state.ui.dataYear = el.value; state.ui.dataMatch = null; state.ui.dataPeriod = 'all'; render(); }
  if('ddate' in el.dataset){ state.ui.dataDate = el.value; state.ui.dataMatch = null; state.ui.dataPeriod = 'all'; state.ui.fmPeriod = null; render(); }
  if('dmatch' in el.dataset){ state.ui.dataMatch = el.value; state.ui.dataPeriod = 'all'; state.ui.fmPeriod = null; render(); }
});
$('#scrim').addEventListener('click', e => {
  if(e.target.id !== 'scrim') return;
  if(state.ui.flow?.kind === 'goal') toast('あとで「状況を入力」から入力できます');
  closeSheet(); render();
});
document.addEventListener('keydown', e => { if(e.key === 'Escape'){ if(!$('#scrim').hidden){ closeSheet(); render(); } else closePop(); } });
window.addEventListener('resize', () => renderPop());
$('#syncBtn').addEventListener('click', () => {
  if(state.meta.gas?.url){ syncNow(); return; }
  const n = unsynced().length;
  if(!n){ toast('未同期のデータはありません'); return; }
  openModal({ title:'☁️ ドライブへ同期', body:`<p>未同期の記録 <b class="num" style="font-size:20px">${n}</b> 件があります。</p>
      <p style="font-size:13px">Googleドライブ連携（⚙ 設定）がまだなので、今はJSONをブラウザのコンソールに出力します。連携を設定すると、スプレッドシートに書き足し、名簿と予定を読み込むようになります。</p>`,
    actions:[{ label:'キャンセル' }, { label:'出力する', kind:'primary', onClick:runSync }] });
});
$('#brightBtn').addEventListener('click', () => { state.meta.bright = !state.meta.bright; save.meta(); applyTheme(); });
function updateNet(){ const on = navigator.onLine; $('#netPill').classList.toggle('on', on); $('#netText').textContent = on ? 'オンライン' : 'オフライン（記録は保存されます）'; }
window.addEventListener('online', updateNet); window.addEventListener('offline', updateNet);

/* ---------- 起動：保存データを読み込んでから画面を出す ---------- */
Store.boot().then(() => {
  initState();
  if(!Store.ok) showStorageWarn();
  loadTeam(state.meta.teamId && state.teams.some(t => t.id === state.meta.teamId) ? state.meta.teamId : state.teams[0].id);
  state.ui.screen = 'teams';
  if(cur() && (state.timer.startedAt || state.timer.brk)) keepAwake(true);
  updateNet(); ensureLineup(); render();
  document.body.classList.add('ready');
});
// PWA：GitHub Pages などで公開したときだけ有効（オフラインでも起動できるようにする）
if('serviceWorker' in navigator && location.protocol === 'https:' && !/claude|claudeusercontent/.test(location.hostname)){
  const hadSW = !!navigator.serviceWorker.controller;   // 初めて開いたとき（前の版がない）は知らせない
  navigator.serviceWorker.register('sw.js').then(reg => {
    reg.update().catch(() => {});
    // アプリに戻ってきたときにも、新しい版がないか確かめる
    document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {});
  navigator.serviceWorker.addEventListener('message', e => { if(e.data?.type === 'sw-ready' && hadSW && e.data.version !== APP_VERSION) showUpdateBar(e.data.version); });
}
// 新しい版が届いたら画面の上に帯を出す（押すと読み込み直す。記録はiPadに保存済みなので消えない）
function showUpdateBar(v){
  let bar = $('#updBar'); if(!bar){ bar = document.createElement('div'); bar.id = 'updBar'; bar.className = 'updbar'; document.body.appendChild(bar); }
  bar.innerHTML = `<span>✨ 新しい版（ver.${esc(String(v).replace('pn-v', ''))}）が届きました</span><button type="button" data-updnow>更新する</button><button type="button" class="x" data-updlater aria-label="あとで">あとで</button>`;
  bar.hidden = false;
}
document.addEventListener('click', e => {
  if(e.target.closest('[data-updnow]')){ Store.flush(); setTimeout(() => location.reload(), 150); }
  if(e.target.closest('[data-updlater]')){ $('#updBar').hidden = true; }
});
