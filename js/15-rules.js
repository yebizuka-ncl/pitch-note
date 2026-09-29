"use strict";
/* =========================================================
   15. 公式戦のルール（登録メンバー・交代枠・再入場）と得点一覧
   m.reg  = { limit:20|25, ids:[選手id…] }   … 公式戦のみ。ids が空なら「未設定＝参加者全員が対象」
   m.subs = { limit:0(無制限)|n, reentry:true|false }
   ========================================================= */
const REG_SIZES = [20, 25];
const SUB_LIMITS = [0, 1, 2, 3, 4, 5, 6];   // 交代できる「回数」（同時に何人代えても1回）
const SUB_DEFAULT = kind => kind === '公式戦' ? { limit:0, reentry:false, htFree:true } : { limit:0, reentry:true, htFree:true };

/* ---------- 登録メンバー ---------- */
function regSet(){
  const m = cur(); if(!m || m.kind !== '公式戦' || !m.reg?.ids?.length) return null;
  return new Set(m.reg.ids);
}
const regLimit = m => m?.reg?.limit || 20;
// 同じ大会（なければ直近の公式戦）の登録を探す
function lastReg(m){
  const cands = teamMatches().filter(x => x.id !== m.id && x.kind === '公式戦' && x.reg?.ids?.length)
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
  return cands.find(x => m.tournament && x.tournament === m.tournament) || cands[0] || null;
}
function applyDefaultReg(m){
  if(m.kind !== '公式戦') return false;
  m.reg = { limit:regLimit(m), ids:m.reg?.ids || [] };
  if(m.reg.ids.length) return false;
  const src = lastReg(m); if(!src) return false;
  const act = new Set(state.roster.filter(p => p.status !== 'retired').map(p => p.id));
  m.reg.ids = src.reg.ids.filter(id => act.has(id)).slice(0, m.reg.limit);
  return m.reg.ids.length > 0;
}
function regBarHTML(m){
  if(!m || m.kind !== '公式戦') return '';
  const ids = m.reg?.ids || [], lim = regLimit(m), src = lastReg(m);
  return `<div class="card regbar">
    <span class="rtitle">📝 登録メンバー</span>
    <span class="rcount ${ids.length > lim ? 'over' : ''}"><b class="num">${ids.length}</b>/${lim}名</span>
    <div class="seg" role="group" aria-label="登録人数">${REG_SIZES.map(n => `<button type="button" data-reglim="${n}" aria-pressed="${lim === n}">${n}名</button>`).join('')}</div>
    <span class="muted rnote">${ids.length ? '登録外の選手はスタメン・交代の候補に出ません' : '未設定のときは「参加」の選手全員が候補です'}</span>
    <span style="flex:1"></span>
    <button class="btn small" data-regpresent type="button">「参加」を全員登録</button>
    ${src ? `<button class="btn small" data-regcopy="${src.id}" type="button">前回（${esc(src.tournament || dateJP(src.date))}）を使う</button>` : ''}
    ${ids.length ? '<button class="btn small" data-regclear type="button">全員外す</button>' : ''}
  </div>`;
}
function regClick(d){
  const m = cur(); if(!m || m.kind !== '公式戦') return false;
  m.reg = { limit:regLimit(m), ids:(m.reg?.ids || []).slice() };
  const r = m.reg;
  if(d.reg){
    const k = r.ids.indexOf(d.reg);
    if(k >= 0) r.ids.splice(k, 1);
    else if(r.ids.length >= r.limit){ toast(`登録は${r.limit}名までです`); return true; }
    else r.ids.push(d.reg);
  } else if(d.reglim){ r.limit = +d.reglim; if(r.ids.length > r.limit) toast(`登録が${r.ids.length}名います。${r.limit}名まで減らしてください`); }
  else if('regpresent' in d){
    const add = state.roster.filter(p => p.status === 'present' && !r.ids.includes(p.id)).sort((a, b) => b.grade - a.grade || a.num - b.num);
    const room = r.limit - r.ids.length; add.slice(0, Math.max(0, room)).forEach(p => r.ids.push(p.id));
    if(add.length > room) toast(`${r.limit}名に達したため、${add.length - Math.max(0, room)}名は登録していません`);
  }
  else if(d.regcopy){ const src = match(d.regcopy); if(src){ r.ids = src.reg.ids.filter(id => player(id) && player(id).status !== 'retired').slice(0, r.limit); toast(`${r.ids.length}名を登録しました`); } }
  else if('regclear' in d){ r.ids = []; }
  else return false;
  save.matches(); ensureLineup(); render(); return true;
}

/* ---------- 交代枠・再入場 ---------- */
const subRules = m => ({ ...SUB_DEFAULT(m?.kind), ...(m?.subs || {}) });
const usSubs = m => evOf(m.id).filter(e => e.type === 'sub' && e.team === 'us');
// 交代の回数：同時に確定した交代は1回。ハーフタイム（ピリオド開始前）の交代は、設定により数えない
const subWindows = m => { const r = subRules(m); return new Set(usSubs(m).filter(e => !(r.htFree && e.ht)).map(e => e.win || e.id)); };
const subsUsed = m => subWindows(m).size;
const atBreak = m => !isStarted(m, state.timer.p);
const subsLeft = m => { const r = subRules(m); if(!r.limit || (r.htFree && atBreak(m))) return Infinity; return Math.max(0, r.limit - subsUsed(m)); };
const wentOffIds = m => new Set(usSubs(m).map(e => e.outId));
// ベンチ：ok＝今入れる選手、blocked＝再入場できない選手
function benchOf(m){
  const off = new Set(sentOffIds(m)), r = subRules(m), gone = wentOffIds(m);
  const all = present().filter(p => !state.lineup.includes(p.id) && !off.has(p.id)).sort((a, b) => a.num - b.num);
  return { ok:all.filter(p => r.reentry || !gone.has(p.id)), blocked:all.filter(p => !r.reentry && gone.has(p.id)) };
}
function subInfoHTML(m, pending = 0){
  const r = subRules(m), free = r.htFree && atBreak(m), u = subsUsed(m) + (pending && !free ? 1 : 0), full = r.limit && u >= r.limit;
  return `<span class="subinfo ${full && !free ? 'full' : ''}">交代 <b class="num">${u}</b>${r.limit ? `/${r.limit}回（残り${Math.max(0, r.limit - u)}回）` : '回（無制限）'}・再入場${r.reentry ? 'あり' : 'なし'}${free && r.limit ? '・今はハーフタイムなので数えません' : ''}</span>`;
}
function subRuleCtlHTML(m){
  const r = subRules(m);
  return `<div class="subctl">${subInfoHTML(m)}
    <label>交代<select data-sublim>${SUB_LIMITS.map(n => `<option value="${n}" ${r.limit === n ? 'selected' : ''}>${n ? n + '回まで' : '回数は無制限'}</option>`).join('')}</select></label>
    <label class="checkrow dark"><input type="checkbox" data-subre ${r.reentry ? 'checked' : ''}>再入場あり</label>
    <label class="checkrow dark"><input type="checkbox" data-subht ${r.htFree ? 'checked' : ''}>ハーフタイムの交代は数えない</label></div>`;
}
function setSubRule(el){
  const m = cur(); if(!m) return false;
  if(el.matches('[data-sublim]')){ m.subs = { ...subRules(m), limit:+el.value }; }
  else if(el.matches('[data-subre]')){ m.subs = { ...subRules(m), reentry:el.checked }; }
  else if(el.matches('[data-subht]')){ m.subs = { ...subRules(m), htFree:el.checked }; }
  else return false;
  save.matches(); return true;
}
// 試合作成フォームの交代ルール欄（練習試合・公式戦で別々に持つ）
function subFormHTML(m, kind, pre){
  const r = m && m.kind === kind ? subRules(m) : SUB_DEFAULT(kind);
  return `<label class="field">交代の回数<select id="${pre}Lim">${SUB_LIMITS.map(n => `<option value="${n}" ${r.limit === n ? 'selected' : ''}>${n ? n + '回まで' : '無制限'}</option>`).join('')}</select></label>
    <label class="checkrow dark"><input type="checkbox" id="${pre}Re" ${r.reentry ? 'checked' : ''}>一度下がった選手の再入場を認める</label>
    <label class="checkrow dark"><input type="checkbox" id="${pre}Ht" ${r.htFree ? 'checked' : ''}>ハーフタイムの交代は回数に数えない</label>`;
}

/* ---------- 得点一覧（スコアをタップ） ---------- */
const clockMark = c => String(c || '').replace(/^0(\d)/, '$1').replace(/:(\d\d)$/, "'$1");
function goalWho(e){
  if(e.type === 'og'){
    const who = e.team === 'them' ? (e.num ? `${e.num} ${family(e.name)}` : '') : (e.oppNum != null ? `#${e.oppNum}` : '');
    return `OG${who ? `（${who}）` : ''}`;
  }
  const tag = e.pk ? '（PK）' : e.fkShot ? '（FK）' : '';
  if(e.team === 'us') return (e.num ? `${e.num} ${family(e.name)}` : '<span class="muted">得点者 未入力</span>') + tag;
  const n = e.oppNum ?? e.goal?.oppNum;
  return (n != null ? `#${n}` : '<span class="muted">相手</span>') + tag;
}
function scorePopHTML(m){
  const x = '<button type="button" class="px" data-popx aria-label="閉じる">×</button>';
  const gs = evOf(m.id).filter(e => isGoalEv(e) && m.periods[e.period]?.kind !== 'pk').sort((a, b) => a.period - b.period || a.sec - b.sec);
  const multi = m.periods.filter(p => p.kind !== 'pk').length > 1;
  let a = 0, b = 0;
  const rows = gs.map(e => { e.team === 'us' ? a++ : b++;
    const as = e.team === 'us' && e.goal?.assistId ? player(e.goal.assistId) : null;
    return `<button type="button" class="grow ${e.team}" data-pgoal="${e.id}">
      <span class="gsc num">${a}-${b}</span>
      <span class="gtx">${multi ? `<small>${esc(m.periods[e.period]?.label || "")}</small> ` : ''}<b class="num">${clockMark(e.clock)}</b> / ${goalWho(e)}${as ? ` <small class="muted">A ${as.num} ${esc(family(as.name))}</small>` : ''}</span></button>`; }).join('');
  return `<div class="pop-h"><b>得点</b><span class="tag">${esc(m.ourName)} ${a}-${b} ${esc(m.opponent)}</span>${x}</div>
    ${rows ? `<div class="glist">${rows}</div><div class="pop-note">行をタップすると得点者などを直せます</div>` : '<div class="pop-note">まだ得点はありません</div>'}`;
}
