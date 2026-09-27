"use strict";
/* =========================================================
   6. 画面2：選手リスト（出欠・名簿の編集）
   ========================================================= */
function viewRoster(){
  const active = state.roster.filter(p => p.status !== 'retired'), retired = state.roster.filter(p => p.status === 'retired');
  const counts = Object.fromEntries(STATUSES.map(s => [s.id, active.filter(p => p.status === s.id).length]));
  const ed = state.ui.rosterEdit, rm = cur()?.kind === '公式戦' ? cur() : null, rs = new Set(rm?.reg?.ids || []);
  const col = g => {
    const ps = active.filter(p => p.grade === g).sort((a,b) => a.num - b.num);
    return `<section class="card grade-col">
      <h3><span><span class="disp">${g}</span> 年</span><small>参加 ${ps.filter(p => p.status === 'present').length} / ${ps.length}名</small></h3>
      ${ps.map(p => `<div class="prow st-${p.status} ${ed ? 'editing' : ''} ${rm && !ed ? 'hasreg' : ''} ${rm && rs.size && !rs.has(p.id) ? 'unreg' : ''}">
          <span class="jersey">${p.num}</span><span class="name">${esc(p.name)} ${posOf(p) ? `<span class="ptag">${posOf(p)}</span>` : ''}${p.school ? ` <span class="muted" style="font-size:11.5px">${esc(p.school)}</span>` : ''}</span>
          ${ed ? `<button class="btn small" data-pedit="${p.id}" type="button">✏️ 編集</button>` : ''}
          ${rm && !ed ? `<button class="regbtn" data-reg="${p.id}" type="button" aria-pressed="${rs.has(p.id)}">${rs.has(p.id) ? '✓ 登録' : '登録'}</button>` : ''}
          <div class="seg" role="group" aria-label="${esc(p.name)}の状態">
            ${STATUSES.map(s => `<button type="button" data-st="${s.id}" data-pid="${p.id}" aria-pressed="${p.status===s.id}">${s.label}</button>`).join('')}
          </div></div>`).join('')}
      ${ed ? `<button class="btn small" data-padd="${g}" type="button">＋ ${g}年の選手を追加</button>` : ''}
    </section>`;
  };
  return `${cur() ? stepperHTML(cur()) : ''}<div class="roster-head">
    ${ed ? '' : '<button class="btn primary" data-allpresent type="button">✅ 全選手を「参加」にする</button>'}
    <div class="counts">${STATUSES.map(s => `<span class="count-chip"><i style="background:${s.color}"></i>${s.label} <span class="num">${counts[s.id]}</span></span>`).join('')}</div>
    <div class="rhead-tools"><button class="btn small" data-import type="button">📥 取り込む</button>${ed ? '<button class="btn small" data-yearup type="button">🎓 年度を更新</button>' : ''}<button class="btn small ${ed ? 'primary' : ''}" data-rosteredit type="button">${ed ? '✓ 編集を終える' : '✏️ 名簿を編集'}</button></div>
  </div>
  ${rm ? regBarHTML(rm) : ''}
  ${!active.length ? '<div class="note-banner" style="margin-bottom:12px">まだ選手がいません。「✏️ 名簿を編集」から選手を追加してください。</div>' : ''}
  <div class="roster-cols">${col(3)}${col(2)}${col(1)}</div>
  ${retired.length ? `<details class="card all" style="margin-top:12px"><summary>退部・卒業した選手（${retired.length}人）<span class="muted" style="font-size:12px;margin-left:8px">過去の記録には名前が残ります</span></summary>
    <div class="onlist" style="padding:6px 0">${retired.sort((a,b) => (b.leftYear || 0) - (a.leftYear || 0) || a.num - b.num).map(p => `<span>#${p.num} ${esc(p.name)} <small class="muted">${p.leftReason === 'graduated' ? `${p.leftYear || ''}卒業` : '退部'}</small> <button class="btn small" data-prestore="${p.id}" type="button">戻す</button></span>`).join('')}</div></details>` : ''}`;
}
function playerSheet(id, grade){
  const p = id ? player(id) : { num:'', name:'', grade };
  state.ui.flow = { kind:'player', id };
  openSheet(`<h2>${id ? '選手を編集' : '選手を追加'}</h2>
    <div style="display:grid;grid-template-columns:6em 1fr 6em 6.5em;gap:10px">
      <label class="field">背番号<input id="pNum" type="number" inputmode="numeric" value="${esc(p.num)}"></label>
      <label class="field">名前（姓 名）<input id="pName" value="${esc(p.name)}" placeholder="例：田中 大翔" autocomplete="off"></label>
      <label class="field">学年<select id="pGrade">${[1,2,3].map(g => `<option value="${g}" ${p.grade===g?'selected':''}>${g}年</option>`).join('')}</select></label>
      <label class="field" style="grid-column:1/-1">所属（学校・クラブ）<input id="pSchool" value="${esc(p.school || '')}" placeholder="市選抜などで使う（任意）" autocomplete="off"></label>
      <label class="field">ポジション<select id="pPos"><option value="">—</option>${POSITIONS.map(x => `<option ${posOf(p)===x?'selected':''}>${x}</option>`).join('')}</select></label>
    </div>
    <div class="row">${id ? '<button class="btn" data-pretire type="button">退部・卒業にする</button><button class="btn danger" data-pdel type="button">削除</button><span style="flex:1"></span>' : ''}
      <button class="btn" data-close type="button">キャンセル</button><button class="btn primary" data-psave type="button">保存</button></div>`);
  setTimeout(() => $('#pName')?.focus(), 50);
}

