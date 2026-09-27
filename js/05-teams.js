"use strict";
/* =========================================================
   5-0. トップ：チーム選択（カテゴリーごと）
   ========================================================= */
function viewTeams(){
  const cats = [...new Set(state.teams.map(t => t.category || 'その他'))];
  const card = t => {
    const n = Store.read(`pn.roster.v6.${t.id}`, []).length, ms = state.matches.filter(m => m.teamId === t.id);
    const live = Store.read(`pn.current.v6.${t.id}`, null) && ms.some(m => m.id === Store.read(`pn.current.v6.${t.id}`, null));
    const last = ms.map(m => m.date).sort().pop();
    return `<div class="tcard">
      <button type="button" class="tmain" data-teamopen="${t.id}" style="--ta:${t.kits[1].a};--tb:${t.kits[1].b}">
        <span class="tkits"><span style="background:linear-gradient(135deg,${t.kits[1].a} 0 62%,${t.kits[1].b} 62%)"></span><span style="background:linear-gradient(135deg,${t.kits[2].a} 0 62%,${t.kits[2].b} 62%)"></span></span>
        <span class="tname">${esc(t.name)}</span>
        <span class="tmeta">選手 ${n}人・試合 ${ms.length}${last ? `・最終 ${dateJP(last)}` : ''}</span>
        ${live ? '<span class="chip us" style="align-self:flex-start">記録中の試合あり</span>' : ''}
      </button>
      <button type="button" class="tedit" data-teamedit="${t.id}" aria-label="${esc(t.name)}を編集">✎</button></div>`;
  };
  return `<div class="teams">
    <section class="card hero"><div class="kicker">SELECT <i>TEAM</i></div><div class="date">記録するチームを選んでください。名簿・試合・ユニフォームの色はチームごとに分かれています。</div></section>
    ${cats.map(c => `<section class="tcat"><div class="dayhead">${esc(c)}<small>${state.teams.filter(t => (t.category || 'その他') === c).length}チーム</small></div>
      <div class="tgrid">${state.teams.filter(t => (t.category || 'その他') === c).map(card).join('')}</div></section>`).join('')}
    <button type="button" class="tnew" data-teamnew>＋ 新しいチームを作る</button>
  </div>`;
}
function teamSheet(id){
  const t = id ? state.teams.find(x => x.id === id) : { name:'', short:'', category:'', kits:JSON.parse(JSON.stringify(DEFAULT_KITS)) };
  const cats = [...new Set(state.teams.map(x => x.category).filter(Boolean))];
  state.ui.flow = { kind:'team', id };
  const col = (key, v) => `<input type="color" id="${key}" value="${v}">`;
  openSheet(`<h2>${id ? 'チームを編集' : '新しいチーム'}</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <label class="field">チーム名<input id="tName" value="${esc(t.name)}" placeholder="例：○○市選抜 U-14" autocomplete="off"></label>
      <label class="field">スコアボードでの表示名<input id="tShort" value="${esc(t.short)}" placeholder="例：市選抜" autocomplete="off"></label>
      <label class="field">カテゴリー<select id="tCat">${cats.map(c => `<option ${t.category===c?'selected':''}>${esc(c)}</option>`).join('')}<option value="__new" ${!cats.length?'selected':''}>＋ 新しいカテゴリー…</option></select></label>
      <label class="field">新しいカテゴリー名<input id="tCatNew" placeholder="例：市選抜 / 中学 部活 / U-13" autocomplete="off"></label>
    </div>
    <div class="q">ユニフォームの色（メイン色・差し色）</div>
    <div class="kitedit">
      <label>1st ${col('tK1a', t.kits[1].a)} ${col('tK1b', t.kits[1].b)}</label>
      <label>2nd ${col('tK2a', t.kits[2].a)} ${col('tK2b', t.kits[2].b)}</label>
    </div>
    <p style="font-size:12.5px">メイン色がアプリ全体の色、差し色がボタンの縁や強調の色になります。</p>
    <div class="row">${id && state.teams.length > 1 ? '<button class="btn danger" data-teamdel type="button">チームを削除</button><span style="flex:1"></span>' : ''}
      <button class="btn" data-close type="button">キャンセル</button><button class="btn primary" data-teamsave type="button">保存</button></div>`);
}
function saveTeam(){
  const f = state.ui.flow;
  const name = $('#tName').value.trim(); if(!name){ toast('チーム名を入れてください'); return; }
  const cat = $('#tCat').value === '__new' ? ($('#tCatNew').value.trim() || 'その他') : ($('#tCatNew').value.trim() || $('#tCat').value);
  const kits = { 1:{ a:$('#tK1a').value, b:$('#tK1b').value }, 2:{ a:$('#tK2a').value, b:$('#tK2b').value } };
  if(f.id){ Object.assign(state.teams.find(t => t.id === f.id), { name, short:$('#tShort').value.trim() || name, category:cat, kits }); }
  else { const t = { id:'t' + uid(), name, short:$('#tShort').value.trim() || name, category:cat, kits, lastKit:1 };
    state.teams.push(t); Store.write(`pn.roster.v6.${t.id}`, []); }
  save.teams(); closeSheet(); toast('チームを保存しました'); render();
}
function openTeam(id){
  if(state.teamId !== id) loadTeam(id);
  state.ui.screen = cur() ? 'record' : 'home'; render();
  if(!state.roster.length) toast('まず選手リストで選手を登録しましょう');
}

